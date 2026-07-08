#!/usr/bin/env python3
"""
Glitch Code + UE5 MCP Server
FastMCP server exposing Unreal Engine 5 and Glitch Code tools via JSON-RPC 2.0.
"""

import asyncio
import json
import logging
import os
import signal
import sys
from pathlib import Path
from typing import Any, Optional

from fastmcp import FastMCP
from pydantic import BaseModel, Field

from ue5_client import UE5Client, UE5ConnectionError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stderr),
        logging.FileHandler("mcp_server.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("mcp_server")

# Load configuration
CONFIG_PATH = Path(__file__).parent / "config.json"


def load_config() -> dict:
    """Load configuration from config.json."""
    default_config = {
        "ue5_host": "localhost",
        "ue5_port": 9877,
        "glitch_code_path": "glitch",
        "auto_reconnect": True,
    }
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                config = json.load(f)
            logger.info("Loaded configuration from %s", CONFIG_PATH)
            return {**default_config, **config}
        except Exception as e:
            logger.warning("Failed to load config: %s. Using defaults.", e)
    return default_config


config = load_config()

# Initialize FastMCP server
mcp = FastMCP(
    "Glitch Code UE5 Server",
    version="1.0.0",
    description="MCP server for UE5 Editor and Glitch Code integration",
)

# Global UE5 client instance
ue5_client: Optional[UE5Client] = None


class ToolResponse(BaseModel):
    """Standard tool response format."""
    success: bool
    data: Any = None
    error: Optional[str] = None


# ============================================================================
# UE5 TOOLS
# ============================================================================


@mcp.tool()
async def spawn_actor(
    actor_class: str = Field(description="UE5 Actor class to spawn (e.g., 'StaticMeshActor')"),
    name: str = Field(description="Name for the spawned actor"),
    location: list[float] = Field(default=[0, 0, 0], description="World location [X, Y, Z]"),
    rotation: list[float] = Field(default=[0, 0, 0], description="Rotation [Pitch, Yaw, Roll]"),
    scale: list[float] = Field(default=[1, 1, 1], description="Scale [X, Y, Z]"),
    static_mesh: Optional[str] = Field(default=None, description="Static mesh asset path"),
) -> dict:
    """Spawn an actor in the UE5 level."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    command = {
        "type": "spawn_actor",
        "actor_class": actor_class,
        "name": name,
        "location": location,
        "rotation": rotation,
        "scale": scale,
    }
    if static_mesh:
        command["static_mesh"] = static_mesh

    try:
        result = await ue5_client.send_command(command)
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("spawn_actor failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def list_actors(
    actor_class: Optional[str] = Field(default=None, description="Filter by actor class"),
    name_filter: Optional[str] = Field(default=None, description="Filter by name (substring match)"),
) -> dict:
    """List all actors in the current UE5 level."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    command = {"type": "list_actors"}
    if actor_class:
        command["actor_class"] = actor_class
    if name_filter:
        command["name_filter"] = name_filter

    try:
        result = await ue5_client.send_command(command)
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("list_actors failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def edit_blueprint(
    blueprint_name: str = Field(description="Name of the Blueprint asset"),
    graph_name: str = Field(default="EventGraph", description="Graph to edit"),
    nodes: list[dict] = Field(default=[], description="Nodes to add/modify"),
    connections: list[dict] = Field(default=[], description="Connections between nodes"),
) -> dict:
    """Edit a UE5 Blueprint asset."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    command = {
        "type": "edit_blueprint",
        "blueprint_name": blueprint_name,
        "graph_name": graph_name,
        "nodes": nodes,
        "connections": connections,
    }

    try:
        result = await ue5_client.send_command(command)
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("edit_blueprint failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def compile_blueprint(
    blueprint_name: str = Field(description="Name of the Blueprint asset to compile"),
) -> dict:
    """Compile a UE5 Blueprint asset."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    command = {"type": "compile_blueprint", "blueprint_name": blueprint_name}

    try:
        result = await ue5_client.send_command(command)
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("compile_blueprint failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def screenshot(
    filename: str = Field(default="screenshot.png", description="Output filename"),
    resolution: list[int] = Field(default=[1920, 1080], description="Resolution [width, height]"),
    viewport_only: bool = Field(default=False, description="Capture viewport only"),
) -> dict:
    """Take a screenshot of the UE5 viewport."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    command = {
        "type": "screenshot",
        "filename": filename,
        "resolution": resolution,
        "viewport_only": viewport_only,
    }

    try:
        result = await ue5_client.send_command(command)
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("screenshot failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def run_console_command(
    command: str = Field(description="UE5 console command to execute"),
) -> dict:
    """Run a console command in UE5 Editor."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    try:
        result = await ue5_client.send_command({
            "type": "console_command",
            "command": command,
        })
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("run_console_command failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ============================================================================
# GLITCH CODE TOOLS
# ============================================================================


@mcp.tool()
async def bash(
    command: str = Field(description="Shell command to execute"),
    workdir: Optional[str] = Field(default=None, description="Working directory"),
    timeout: int = Field(default=120, description="Timeout in seconds"),
) -> dict:
    """Execute a shell command via Glitch Code."""
    import subprocess

    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=workdir,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace",
        )
        return ToolResponse(
            success=result.returncode == 0,
            data={
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
            },
        ).model_dump()
    except subprocess.TimeoutExpired:
        return ToolResponse(success=False, error=f"Command timed out after {timeout}s").model_dump()
    except Exception as e:
        logger.error("bash failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def read_file(
    file_path: str = Field(description="Path to file to read"),
    offset: int = Field(default=0, description="Line offset to start reading"),
    limit: int = Field(default=2000, description="Max lines to read"),
) -> dict:
    """Read a file's contents."""
    try:
        path = Path(file_path)
        if not path.exists():
            return ToolResponse(success=False, error=f"File not found: {file_path}").model_dump()

        with open(path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

        total = len(lines)
        selected = lines[offset : offset + limit]
        content = "".join(selected)

        return ToolResponse(
            success=True,
            data={
                "content": content,
                "total_lines": total,
                "offset": offset,
                "limit": limit,
                "has_more": offset + limit < total,
            },
        ).model_dump()
    except Exception as e:
        logger.error("read_file failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def write_file(
    file_path: str = Field(description="Path to file to write"),
    content: str = Field(description="Content to write"),
    mode: str = Field(default="overwrite", description="'overwrite' or 'append'"),
) -> dict:
    """Write content to a file."""
    try:
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        file_mode = "a" if mode == "append" else "w"
        with open(path, file_mode, encoding="utf-8") as f:
            f.write(content)

        return ToolResponse(
            success=True,
            data={"file_path": str(path), "bytes_written": len(content.encode("utf-8"))},
        ).model_dump()
    except Exception as e:
        logger.error("write_file failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def edit_file(
    file_path: str = Field(description="Path to file to edit"),
    old_string: str = Field(description="Exact string to find and replace"),
    new_string: str = Field(description="Replacement string"),
    replace_all: bool = Field(default=False, description="Replace all occurrences"),
) -> dict:
    """Edit a file by performing string replacement."""
    try:
        path = Path(file_path)
        if not path.exists():
            return ToolResponse(success=False, error=f"File not found: {file_path}").model_dump()

        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        if old_string not in content:
            return ToolResponse(success=False, error="old_string not found in file").model_dump()

        count = content.count(old_string)
        if not replace_all and count > 1:
            return ToolResponse(
                success=False,
                error=f"Found {count} matches. Use replace_all=true or provide more context.",
            ).model_dump()

        new_content = content.replace(old_string, new_string) if replace_all else content.replace(old_string, new_string, 1)

        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)

        return ToolResponse(
            success=True,
            data={"file_path": str(path), "replacements": count if replace_all else 1},
        ).model_dump()
    except Exception as e:
        logger.error("edit_file failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def grep_search(
    pattern: str = Field(description="Regex pattern to search for"),
    path: str = Field(default=".", description="Directory or file to search in"),
    include: Optional[str] = Field(default=None, description="File pattern to include (e.g., '*.py')"),
    max_results: int = Field(default=100, description="Maximum results to return"),
) -> dict:
    """Search file contents using regex pattern."""
    import re

    try:
        search_path = Path(path)
        if not search_path.exists():
            return ToolResponse(success=False, error=f"Path not found: {path}").model_dump()

        regex = re.compile(pattern)
        results = []

        if search_path.is_file():
            files = [search_path]
        else:
            files = []
            for f in search_path.rglob("*"):
                if f.is_file():
                    if include:
                        import fnmatch
                        if not fnmatch.fnmatch(f.name, include):
                            continue
                    files.append(f)

        for file_path in files:
            if len(results) >= max_results:
                break
            try:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    for line_num, line in enumerate(f, 1):
                        if regex.search(line):
                            results.append({
                                "file": str(file_path),
                                "line": line_num,
                                "content": line.rstrip(),
                            })
                            if len(results) >= max_results:
                                break
            except (PermissionError, OSError):
                continue

        return ToolResponse(
            success=True,
            data={"matches": results, "total": len(results)},
        ).model_dump()
    except re.error as e:
        return ToolResponse(success=False, error=f"Invalid regex: {e}").model_dump()
    except Exception as e:
        logger.error("grep_search failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def glob_search(
    pattern: str = Field(description="Glob pattern (e.g., '**/*.py')"),
    path: str = Field(default=".", description="Directory to search in"),
) -> dict:
    """Find files matching a glob pattern."""
    try:
        search_path = Path(path)
        if not search_path.exists():
            return ToolResponse(success=False, error=f"Path not found: {path}").model_dump()

        matches = sorted([str(p) for p in search_path.glob(pattern) if p.is_file()])

        return ToolResponse(
            success=True,
            data={"files": matches, "total": len(matches)},
        ).model_dump()
    except Exception as e:
        logger.error("glob_search failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ============================================================================
# LIFECYCLE MANAGEMENT
# ============================================================================


async def initialize_ue5_client():
    """Initialize and connect the UE5 WebSocket client."""
    global ue5_client
    try:
        ue5_client = UE5Client(
            host=config["ue5_host"],
            port=config["ue5_port"],
            auto_reconnect=config["auto_reconnect"],
        )
        await ue5_client.connect()
        logger.info("Connected to UE5 Editor at ws://%s:%d", config["ue5_host"], config["ue5_port"])
    except UE5ConnectionError as e:
        logger.warning("Could not connect to UE5 Editor: %s. UE5 tools will be unavailable.", e)
        ue5_client = None
    except Exception as e:
        logger.error("Unexpected error connecting to UE5: %s", e)
        ue5_client = None


async def shutdown_ue5_client():
    """Gracefully disconnect the UE5 client."""
    global ue5_client
    if ue5_client:
        try:
            await ue5_client.disconnect()
            logger.info("Disconnected from UE5 Editor")
        except Exception as e:
            logger.error("Error disconnecting from UE5: %s", e)
        ue5_client = None


async def main():
    """Main entry point for the MCP server."""
    logger.info("Starting Glitch Code UE5 MCP Server v1.0.0")
    logger.info("Configuration: UE5 at %s:%d", config["ue5_host"], config["ue5_port"])

    # Initialize UE5 connection
    await initialize_ue5_client()

    # Set up signal handlers for graceful shutdown
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(shutdown_ue5_client()))

    try:
        # Run the MCP server
        await mcp.run_async()
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
    except Exception as e:
        logger.error("Server error: %s", e)
        raise
    finally:
        await shutdown_ue5_client()
        logger.info("Server shutdown complete")


if __name__ == "__main__":
    asyncio.run(main())
