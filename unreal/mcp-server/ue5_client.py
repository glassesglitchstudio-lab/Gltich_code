#!/usr/bin/env python3
"""
UE5 WebSocket Client
Handles communication with Unreal Engine 5 Editor via WebSocket.
"""

import asyncio
import json
import logging
import uuid
from typing import Any, Optional

import websockets
from websockets.exceptions import ConnectionClosed

logger = logging.getLogger("ue5_client")


class UE5ConnectionError(Exception):
    """Raised when connection to UE5 fails."""
    pass


class UE5Client:
    """WebSocket client for UE5 Editor communication."""

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

        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._connected = False
        self._reconnect_attempts = 0
        self._pending_commands: dict[str, asyncio.Future] = {}
        self._listen_task: Optional[asyncio.Task] = None

    @property
    def is_connected(self) -> bool:
        return self._connected and self._ws is not None

    @property
    def url(self) -> str:
        return f"ws://{self.host}:{self.port}"

    async def connect(self):
        """Connect to UE5 Editor WebSocket server."""
        try:
            self._ws = await websockets.connect(
                self.url,
                ping_interval=20,
                ping_timeout=10,
                close_timeout=5,
            )
            self._connected = True
            self._reconnect_attempts = 0
            logger.info("Connected to UE5 at %s", self.url)

            # Start listening for responses
            self._listen_task = asyncio.create_task(self._listen_loop())

        except Exception as e:
            self._connected = False
            raise UE5ConnectionError(f"Failed to connect to UE5 at {self.url}: {e}") from e

    async def disconnect(self):
        """Disconnect from UE5 Editor."""
        self._connected = False

        if self._listen_task:
            self._listen_task.cancel()
            try:
                await self._listen_task
            except asyncio.CancelledError:
                pass
            self._listen_task = None

        # Cancel all pending commands
        for cmd_id, future in self._pending_commands.items():
            if not future.done():
                future.set_exception(UE5ConnectionError("Disconnected from UE5"))
        self._pending_commands.clear()

        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None

        logger.info("Disconnected from UE5")

    async def _listen_loop(self):
        """Listen for incoming WebSocket messages."""
        try:
            async for message in self._ws:
                try:
                    data = json.loads(message)
                    await self._handle_message(data)
                except json.JSONDecodeError as e:
                    logger.warning("Invalid JSON received: %s", e)
                except Exception as e:
                    logger.error("Error handling message: %s", e)
        except ConnectionClosed as e:
            logger.warning("WebSocket connection closed: %s", e)
            self._connected = False
            if self.auto_reconnect:
                await self._reconnect()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Listen loop error: %s", e)
            self._connected = False

    async def _handle_message(self, data: dict):
        """Handle an incoming WebSocket message."""
        msg_id = data.get("id")
        if msg_id and msg_id in self._pending_commands:
            future = self._pending_commands.pop(msg_id)
            if "error" in data:
                future.set_exception(Exception(data["error"]))
            else:
                future.set_result(data.get("result", data))
        else:
            # Unsolicited message or event
            msg_type = data.get("type", "unknown")
            logger.debug("Unsolicited message type=%s: %s", msg_type, data)

    async def _reconnect(self):
        """Attempt to reconnect to UE5."""
        if not self.auto_reconnect:
            return

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
        if not self.is_connected:
            raise UE5ConnectionError("Not connected to UE5")

        cmd_id = str(uuid.uuid4())
        command["id"] = cmd_id

        timeout = timeout or self.command_timeout
        future: asyncio.Future = asyncio.get_event_loop().create_future()
        self._pending_commands[cmd_id] = future

        try:
            await self._ws.send(json.dumps(command))
            logger.debug("Sent command %s: %s", cmd_id, command.get("type", "unknown"))

            result = await asyncio.wait_for(future, timeout=timeout)
            return result

        except asyncio.TimeoutError:
            self._pending_commands.pop(cmd_id, None)
            raise UE5ConnectionError(f"Command timed out after {timeout}s")
        except ConnectionClosed as e:
            self._pending_commands.pop(cmd_id, None)
            self._connected = False
            if self.auto_reconnect:
                asyncio.create_task(self._reconnect())
            raise UE5ConnectionError(f"Connection closed: {e}") from e
        except Exception as e:
            self._pending_commands.pop(cmd_id, None)
            raise

    async def send_command_streaming(self, command: dict, timeout: float = 60.0):
        """Send a command and yield streaming responses."""
        if not self.is_connected:
            raise UE5ConnectionError("Not connected to UE5")

        cmd_id = str(uuid.uuid4())
        command["id"] = cmd_id
        command["streaming"] = True

        try:
            await self._ws.send(json.dumps(command))
            logger.debug("Sent streaming command %s: %s", cmd_id, command.get("type", "unknown"))

            async with asyncio.timeout(timeout):
                async for message in self._ws:
                    try:
                        data = json.loads(message)
                        if data.get("id") == cmd_id:
                            if data.get("complete"):
                                return data.get("result")
                            yield data.get("chunk", data)
                    except json.JSONDecodeError:
                        continue

        except asyncio.TimeoutError:
            raise UE5ConnectionError(f"Streaming command timed out after {timeout}s")
        except ConnectionClosed as e:
            self._connected = False
            if self.auto_reconnect:
                asyncio.create_task(self._reconnect())
            raise UE5ConnectionError(f"Connection closed: {e}") from e

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
