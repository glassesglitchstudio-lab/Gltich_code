#!/usr/bin/env python3
"""
UE5 HTTP Client
Handles communication with Unreal Engine 5 Editor via HTTP REST API.
Compatible with TypeScript tools that also use HTTP.
"""

import asyncio
import json
import logging
import uuid
from typing import Any, Optional

import httpx

logger = logging.getLogger("ue5_client")


class UE5ConnectionError(Exception):
    """Raised when connection to UE5 fails."""
    pass


class UE5Client:
    """HTTP client for UE5 Editor communication."""

    def __init__(
        self,
        host: str = "localhost",
        port: int = 9877,
        auto_reconnect: bool = True,
        reconnect_delay: float = 5.0,
        max_reconnect_attempts: int = 10,
        command_timeout: float = 30.0,
    ):
        self.host = host
        self.port = port
        self.auto_reconnect = auto_reconnect
        self.reconnect_delay = reconnect_delay
        self.max_reconnect_attempts = max_reconnect_attempts
        self.command_timeout = command_timeout

        self._client: Optional[httpx.AsyncClient] = None
        self._connected = False
        self._reconnect_attempts = 0

    @property
    def is_connected(self) -> bool:
        return self._connected and self._client is not None

    @property
    def base_url(self) -> str:
        return f"http://{self.host}:{self.port}"

    async def connect(self):
        """Connect to UE5 Editor HTTP server."""
        try:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(self.command_timeout),
            )

            # Verify connection by checking status endpoint
            response = await self._client.get("/status")
            if response.status_code == 200:
                self._connected = True
                self._reconnect_attempts = 0
                logger.info("Connected to UE5 at %s", self.base_url)
            else:
                raise UE5ConnectionError(
                    f"UE5 returned status {response.status_code}"
                )

        except httpx.ConnectError as e:
            self._connected = False
            raise UE5ConnectionError(
                f"Failed to connect to UE5 at {self.base_url}: {e}"
            ) from e
        except Exception as e:
            self._connected = False
            if self._client:
                await self._client.aclose()
                self._client = None
            raise UE5ConnectionError(
                f"Failed to connect to UE5 at {self.base_url}: {e}"
            ) from e

    async def disconnect(self):
        """Disconnect from UE5 Editor."""
        self._connected = False

        if self._client:
            try:
                await self._client.aclose()
            except Exception:
                pass
            self._client = None

        logger.info("Disconnected from UE5")

    async def _ensure_connected(self):
        """Ensure we have an active connection, reconnecting if needed."""
        if self.is_connected:
            return

        if not self.auto_reconnect:
            raise UE5ConnectionError("Not connected to UE5")

        await self._reconnect()

    async def _reconnect(self):
        """Attempt to reconnect to UE5."""
        while (
            self._reconnect_attempts < self.max_reconnect_attempts
            and not self._connected
        ):
            self._reconnect_attempts += 1
            logger.info(
                "Reconnect attempt %d/%d in %.1fs...",
                self._reconnect_attempts,
                self.max_reconnect_attempts,
                self.reconnect_delay,
            )
            await asyncio.sleep(self.reconnect_delay)

            try:
                await self.connect()
                logger.info("Reconnected to UE5 successfully")
                return
            except UE5ConnectionError as e:
                logger.warning("Reconnect failed: %s", e)

        logger.error("Max reconnect attempts reached. UE5 tools will be unavailable.")

    async def send_command(self, command: dict, timeout: Optional[float] = None) -> Any:
        """Send a command to UE5 and wait for response."""
        await self._ensure_connected()

        timeout = timeout or self.command_timeout

        try:
            response = await self._client.post(
                "/command",
                json=command,
                timeout=timeout,
            )

            if response.status_code == 200:
                data = response.json()
                return data.get("result", data)
            else:
                error_data = response.json() if response.content else {}
                raise UE5ConnectionError(
                    f"Command failed with status {response.status_code}: "
                    f"{error_data.get('error', 'Unknown error')}"
                )

        except httpx.TimeoutException:
            raise UE5ConnectionError(f"Command timed out after {timeout}s")
        except httpx.ConnectError as e:
            self._connected = False
            if self.auto_reconnect:
                asyncio.create_task(self._reconnect())
            raise UE5ConnectionError(f"Connection lost: {e}") from e
        except UE5ConnectionError:
            raise
        except Exception as e:
            raise UE5ConnectionError(f"Command failed: {e}") from e

    async def send_command_streaming(self, command: dict, timeout: float = 60.0):
        """Send a command and yield streaming responses via SSE/polling."""
        await self._ensure_connected()

        # For streaming, we poll the /events endpoint
        try:
            # Send the command
            response = await self._client.post(
                "/command",
                json={**command, "streaming": True},
                timeout=timeout,
            )

            if response.status_code != 200:
                error_data = response.json() if response.content else {}
                raise UE5ConnectionError(
                    f"Streaming command failed: {error_data.get('error', 'Unknown error')}"
                )

            # Poll for streaming results
            import time
            start_time = time.time()

            while time.time() - start_time < timeout:
                try:
                    events_response = await self._client.get("/events", timeout=5.0)
                    if events_response.status_code == 200:
                        events = events_response.json()
                        if isinstance(events, list):
                            for event in events:
                                yield event
                        elif events:
                            yield events
                except httpx.TimeoutException:
                    pass

                await asyncio.sleep(0.1)

        except httpx.TimeoutException:
            raise UE5ConnectionError(f"Streaming command timed out after {timeout}s")
        except httpx.ConnectError as e:
            self._connected = False
            if self.auto_reconnect:
                asyncio.create_task(self._reconnect())
            raise UE5ConnectionError(f"Connection lost: {e}") from e
        except UE5ConnectionError:
            raise
        except Exception as e:
            raise UE5ConnectionError(f"Streaming command failed: {e}") from e

    def parse_ue5_console_output(self, output: str) -> list[dict]:
        """Parse UE5 console output into structured format."""
        lines = output.strip().split("\n")
        parsed = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            entry = {"raw": line}

            # Parse common UE5 log patterns
            if line.startswith("[") and "]" in line:
                # Timestamped log: [Timestamp] Category: Message
                bracket_end = line.index("]")
                entry["timestamp"] = line[1:bracket_end]
                remainder = line[bracket_end + 1:].strip()

                if ":" in remainder:
                    cat_end = remainder.index(":")
                    entry["category"] = remainder[:cat_end].strip()
                    entry["message"] = remainder[cat_end + 1:].strip()
                else:
                    entry["message"] = remainder

            elif "Error:" in line or "Warning:" in line:
                entry["level"] = "error" if "Error:" in line else "warning"
                entry["message"] = line

            elif line.startswith("Log") and ":" in line:
                # UE5 log format: LogCategory: Message
                colon_pos = line.index(":")
                entry["category"] = line[:colon_pos].strip()
                entry["message"] = line[colon_pos + 1:].strip()

            else:
                entry["message"] = line

            parsed.append(entry)

        return parsed
