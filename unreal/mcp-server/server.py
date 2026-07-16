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


@mcp.tool()
async def delete_actor(
    actor_name: str = Field(description="Name of the actor to delete"),
) -> dict:
    """Delete an actor from the UE5 level."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    try:
        result = await ue5_client.send_command({
            "type": "console_command",
            "command": f"actor destroy {actor_name}",
        })
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("delete_actor failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def move_actor(
    actor_name: str = Field(description="Name of the actor to move"),
    location: Optional[list[float]] = Field(default=None, description="World location [X, Y, Z]"),
    rotation: Optional[list[float]] = Field(default=None, description="Rotation [Pitch, Yaw, Roll]"),
) -> dict:
    """Move or rotate an actor in the UE5 level."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    if location is None and rotation is None:
        return ToolResponse(success=False, error="At least one of location or rotation must be provided").model_dump()

    try:
        results = []
        if location is not None:
            x, y, z = location
            result = await ue5_client.send_command({
                "type": "console_command",
                "command": f"actor set {actor_name} Location={x},{y},{z}",
            })
            results.append(result)
        if rotation is not None:
            p, y, r = rotation
            result = await ue5_client.send_command({
                "type": "console_command",
                "command": f"actor set {actor_name} Rotation={p},{y},{r}",
            })
            results.append(result)
        return ToolResponse(success=True, data=results).model_dump()
    except Exception as e:
        logger.error("move_actor failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def set_material(
    actor_name: str = Field(description="Name of the actor to set material on"),
    material_path: str = Field(description="Asset path of the material (e.g., '/Game/Materials/M_MyMat')"),
    slot_index: int = Field(default=0, description="Material slot index"),
) -> dict:
    """Set a material on an actor's mesh slot."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    try:
        result = await ue5_client.send_command({
            "type": "console_command",
            "command": f"material set {actor_name} {slot_index} {material_path}",
        })
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("set_material failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def open_level(
    level_path: str = Field(description="Path of the level to open (e.g., '/Game/Maps/MyLevel')"),
) -> dict:
    """Open a level in UE5 Editor."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    try:
        result = await ue5_client.send_command({
            "type": "console_command",
            "command": f"open {level_path}",
        })
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("open_level failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def play_in_editor(
    mode: str = Field(default="standalone", description="Play mode: 'standalone', 'selected', or 'current_camera'"),
) -> dict:
    """Start play-in-editor session in UE5."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    mode_commands = {
        "standalone": "play",
        "selected": "play -game",
        "current_camera": "play -camera",
    }
    command = mode_commands.get(mode, "play")

    try:
        result = await ue5_client.send_command({
            "type": "console_command",
            "command": command,
        })
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("play_in_editor failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def stop_play() -> dict:
    """Stop the current play-in-editor session in UE5."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    try:
        result = await ue5_client.send_command({
            "type": "console_command",
            "command": "stop",
        })
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("stop_play failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def select_actor(
    actor_name: str = Field(description="Name of the actor to select"),
) -> dict:
    """Select an actor in the UE5 viewport."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    try:
        result = await ue5_client.send_command({
            "type": "console_command",
            "command": f"actor select {actor_name}",
        })
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("select_actor failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def undo_action(
    steps: int = Field(default=1, description="Number of undo steps"),
) -> dict:
    """Undo actions in the UE5 Editor."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    command = "undo" if steps == 1 else f"undo {steps}"

    try:
        result = await ue5_client.send_command({
            "type": "console_command",
            "command": command,
        })
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("undo_action failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def redo_action(
    steps: int = Field(default=1, description="Number of redo steps"),
) -> dict:
    """Redo actions in the UE5 Editor."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    command = "redo" if steps == 1 else f"redo {steps}"

    try:
        result = await ue5_client.send_command({
            "type": "console_command",
            "command": command,
        })
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("redo_action failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def get_context() -> dict:
    """Get current UE5 editor context (FPS, actor list, current level)."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()

    try:
        fps_result = await ue5_client.send_command({
            "type": "console_command",
            "command": "stat fps",
        })
        actors_result = await ue5_client.send_command({
            "type": "list_actors",
        })
        level_result = await ue5_client.send_command({
            "type": "console_command",
            "command": "get current level",
        })

        return ToolResponse(
            success=True,
            data={
                "fps": fps_result,
                "actors": actors_result,
                "current_level": level_result,
            },
        ).model_dump()
    except Exception as e:
        logger.error("get_context failed: %s", e)
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
# NEW SYSTEM TOOLS (88 tools)
# ============================================================================

# ---------------------------------------------------------------------------
# Procedural Generation (6)
# ---------------------------------------------------------------------------

@mcp.tool()
async def proc_room(
    action: str = Field(description="Action: create, delete, configure, list, preview, seed"),
    width: Optional[int] = Field(default=None, description="Room width in grid units"),
    height: Optional[int] = Field(default=None, description="Room height in grid units"),
    style: Optional[str] = Field(default=None, description="Room style preset"),
    seed: Optional[int] = Field(default=None, description="Random seed for reproducibility"),
) -> dict:
    """Procedural room generation and configuration."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"proc_room {action}"]
        if width is not None:
            cmd_parts.append(f"width={width}")
        if height is not None:
            cmd_parts.append(f"height={height}")
        if style:
            cmd_parts.append(f"style={style}")
        if seed is not None:
            cmd_parts.append(f"seed={seed}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("proc_room failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def proc_corridor(
    action: str = Field(description="Action: create, delete, configure, list, preview, seed"),
    length: Optional[int] = Field(default=None, description="Corridor length in grid units"),
    width: Optional[int] = Field(default=None, description="Corridor width in grid units"),
    style: Optional[str] = Field(default=None, description="Corridor style preset"),
    seed: Optional[int] = Field(default=None, description="Random seed"),
) -> dict:
    """Procedural corridor generation and configuration."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"proc_corridor {action}"]
        if length is not None:
            cmd_parts.append(f"length={length}")
        if width is not None:
            cmd_parts.append(f"width={width}")
        if style:
            cmd_parts.append(f"style={style}")
        if seed is not None:
            cmd_parts.append(f"seed={seed}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("proc_corridor failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def proc_door(
    action: str = Field(description="Action: spawn, remove, configure, lock, unlock, trap"),
    location: Optional[list[float]] = Field(default=None, description="Spawn location [X, Y, Z]"),
    door_type: Optional[str] = Field(default=None, description="Door type: wooden, metal, glass, secret"),
    locked: Optional[bool] = Field(default=None, description="Lock state"),
) -> dict:
    """Procedural door placement and configuration."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"proc_door {action}"]
        if location:
            cmd_parts.append(f"loc={','.join(str(v) for v in location)}")
        if door_type:
            cmd_parts.append(f"type={door_type}")
        if locked is not None:
            cmd_parts.append(f"locked={'true' if locked else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("proc_door failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def proc_lighting(
    action: str = Field(description="Action: create, delete, configure, preset, bake, flicker"),
    light_type: Optional[str] = Field(default=None, description="Light type: point, spot, rect, skylight"),
    intensity: Optional[float] = Field(default=None, description="Light intensity"),
    color: Optional[list[float]] = Field(default=None, description="RGB color [0-1, 0-1, 0-1]"),
    location: Optional[list[float]] = Field(default=None, description="Location [X, Y, Z]"),
) -> dict:
    """Procedural lighting setup and configuration."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"proc_lighting {action}"]
        if light_type:
            cmd_parts.append(f"type={light_type}")
        if intensity is not None:
            cmd_parts.append(f"intensity={intensity}")
        if color:
            cmd_parts.append(f"color={','.join(str(v) for v in color)}")
        if location:
            cmd_parts.append(f"loc={','.join(str(v) for v in location)}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("proc_lighting failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def proc_props(
    action: str = Field(description="Action: scatter, clear, configure, list, preset"),
    category: Optional[str] = Field(default=None, description="Props category: furniture, clutter, nature, industrial"),
    density: Optional[float] = Field(default=None, description="Scatter density 0.0-1.0"),
    radius: Optional[float] = Field(default=None, description="Scatter radius"),
    seed: Optional[int] = Field(default=None, description="Random seed"),
) -> dict:
    """Procedural prop scattering and configuration."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"proc_props {action}"]
        if category:
            cmd_parts.append(f"cat={category}")
        if density is not None:
            cmd_parts.append(f"density={density}")
        if radius is not None:
            cmd_parts.append(f"radius={radius}")
        if seed is not None:
            cmd_parts.append(f"seed={seed}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("proc_props failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def proc_spawn(
    action: str = Field(description="Action: spawn, despawn, configure, wave, patrol, flee"),
    entity_type: Optional[str] = Field(default=None, description="Entity type to spawn"),
    count: Optional[int] = Field(default=None, description="Number of entities"),
    location: Optional[list[float]] = Field(default=None, description="Spawn location [X, Y, Z]"),
    radius: Optional[float] = Field(default=None, description="Spawn radius"),
    wave: Optional[int] = Field(default=None, description="Wave number"),
) -> dict:
    """Procedural entity spawning system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"proc_spawn {action}"]
        if entity_type:
            cmd_parts.append(f"entity={entity_type}")
        if count is not None:
            cmd_parts.append(f"count={count}")
        if location:
            cmd_parts.append(f"loc={','.join(str(v) for v in location)}")
        if radius is not None:
            cmd_parts.append(f"radius={radius}")
        if wave is not None:
            cmd_parts.append(f"wave={wave}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("proc_spawn failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ---------------------------------------------------------------------------
# Game Mechanics (13)
# ---------------------------------------------------------------------------

@mcp.tool()
async def health_manager(
    action: str = Field(description="Action: get, set, damage, heal, revive, configure"),
    target: Optional[str] = Field(default=None, description="Target actor or player"),
    amount: Optional[float] = Field(default=None, description="Health amount"),
    max_health: Optional[float] = Field(default=None, description="Maximum health value"),
) -> dict:
    """Manage health system for actors and players."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"health_manager {action}"]
        if target:
            cmd_parts.append(f"target={target}")
        if amount is not None:
            cmd_parts.append(f"amount={amount}")
        if max_health is not None:
            cmd_parts.append(f"max={max_health}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("health_manager failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def stamina_manager(
    action: str = Field(description="Action: get, set, drain, recharge, configure"),
    target: Optional[str] = Field(default=None, description="Target actor or player"),
    amount: Optional[float] = Field(default=None, description="Stamina amount"),
    drain_rate: Optional[float] = Field(default=None, description="Drain rate per second"),
    recharge_rate: Optional[float] = Field(default=None, description="Recharge rate per second"),
) -> dict:
    """Manage stamina system for player actions."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"stamina_manager {action}"]
        if target:
            cmd_parts.append(f"target={target}")
        if amount is not None:
            cmd_parts.append(f"amount={amount}")
        if drain_rate is not None:
            cmd_parts.append(f"drain={drain_rate}")
        if recharge_rate is not None:
            cmd_parts.append(f"recharge={recharge_rate}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("stamina_manager failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def combat_system(
    action: str = Field(description="Action: attack, block, dodge, combo, configure, test"),
    weapon_type: Optional[str] = Field(default=None, description="Weapon type: melee, ranged, magic"),
    combo_index: Optional[int] = Field(default=None, description="Combo sequence index"),
    damage_multiplier: Optional[float] = Field(default=None, description="Damage multiplier"),
    target: Optional[str] = Field(default=None, description="Target actor"),
) -> dict:
    """Combat system management and testing."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"combat_system {action}"]
        if weapon_type:
            cmd_parts.append(f"weapon={weapon_type}")
        if combo_index is not None:
            cmd_parts.append(f"combo={combo_index}")
        if damage_multiplier is not None:
            cmd_parts.append(f"mult={damage_multiplier}")
        if target:
            cmd_parts.append(f"target={target}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("combat_system failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def interact_system(
    action: str = Field(description="Action: register, unregister, trigger, configure, range, prompt"),
    target: Optional[str] = Field(default=None, description="Target actor to interact with"),
    interaction_type: Optional[str] = Field(default=None, description="Interaction type: pickup, use, talk, examine"),
    range: Optional[float] = Field(default=None, description="Interaction range"),
    prompt_text: Optional[str] = Field(default=None, description="UI prompt text"),
) -> dict:
    """Interaction system for objects and NPCs."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"interact_system {action}"]
        if target:
            cmd_parts.append(f"target={target}")
        if interaction_type:
            cmd_parts.append(f"type={interaction_type}")
        if range is not None:
            cmd_parts.append(f"range={range}")
        if prompt_text:
            cmd_parts.append(f"prompt={prompt_text}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("interact_system failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def crafting_system(
    action: str = Field(description="Action: add_recipe, remove_recipe, craft, list_recipes, configure"),
    recipe_name: Optional[str] = Field(default=None, description="Recipe name"),
    ingredients: Optional[list[str]] = Field(default=None, description="List of ingredient item IDs"),
    result_item: Optional[str] = Field(default=None, description="Resulting item ID"),
    crafting_station: Optional[str] = Field(default=None, description="Required crafting station"),
) -> dict:
    """Crafting system for creating items from recipes."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"crafting_system {action}"]
        if recipe_name:
            cmd_parts.append(f"recipe={recipe_name}")
        if ingredients:
            cmd_parts.append(f"ingredients={','.join(ingredients)}")
        if result_item:
            cmd_parts.append(f"result={result_item}")
        if crafting_station:
            cmd_parts.append(f"station={crafting_station}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("crafting_system failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def inventory_upgrade(
    action: str = Field(description="Action: add_slot, remove_slot, expand, configure, get_capacity"),
    capacity: Optional[int] = Field(default=None, description="New inventory capacity"),
    slot_type: Optional[str] = Field(default=None, description="Slot type: general, weapon, armor, consumable"),
    upgrade_level: Optional[int] = Field(default=None, description="Upgrade level"),
) -> dict:
    """Inventory capacity and upgrade management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"inventory_upgrade {action}"]
        if capacity is not None:
            cmd_parts.append(f"capacity={capacity}")
        if slot_type:
            cmd_parts.append(f"slot_type={slot_type}")
        if upgrade_level is not None:
            cmd_parts.append(f"level={upgrade_level}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("inventory_upgrade failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def damage_system(
    action: str = Field(description="Action: apply, absorb, reflect, configure, type_check"),
    target: Optional[str] = Field(default=None, description="Target actor"),
    damage_type: Optional[str] = Field(default=None, description="Damage type: physical, fire, ice, poison, electric, psychic"),
    amount: Optional[float] = Field(default=None, description="Damage amount"),
    source: Optional[str] = Field(default=None, description="Damage source actor"),
    armor_penetration: Optional[float] = Field(default=None, description="Armor penetration 0.0-1.0"),
) -> dict:
    """Damage calculation and type system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"damage_system {action}"]
        if target:
            cmd_parts.append(f"target={target}")
        if damage_type:
            cmd_parts.append(f"dmg_type={damage_type}")
        if amount is not None:
            cmd_parts.append(f"amount={amount}")
        if source:
            cmd_parts.append(f"source={source}")
        if armor_penetration is not None:
            cmd_parts.append(f"apen={armor_penetration}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("damage_system failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def healing_system(
    action: str = Field(description="Action: apply, configure, potion, aura, regen, cleanse"),
    target: Optional[str] = Field(default=None, description="Target actor"),
    heal_type: Optional[str] = Field(default=None, description="Heal type: instant, hot, shield, cleanse"),
    amount: Optional[float] = Field(default=None, description="Heal amount"),
    duration: Optional[float] = Field(default=None, description="Duration for HOT/shield"),
    source: Optional[str] = Field(default=None, description="Heal source"),
) -> dict:
    """Healing and recovery system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"healing_system {action}"]
        if target:
            cmd_parts.append(f"target={target}")
        if heal_type:
            cmd_parts.append(f"heal_type={heal_type}")
        if amount is not None:
            cmd_parts.append(f"amount={amount}")
        if duration is not None:
            cmd_parts.append(f"duration={duration}")
        if source:
            cmd_parts.append(f"source={source}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("healing_system failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def puzzle_system(
    action: str = Field(description="Action: create, solve, hint, configure, reset, state"),
    puzzle_type: Optional[str] = Field(default=None, description="Puzzle type: lever, button, sequence, sliding, combination, pressure"),
    puzzle_id: Optional[str] = Field(default=None, description="Unique puzzle identifier"),
    solution: Optional[str] = Field(default=None, description="Solution string"),
    difficulty: Optional[int] = Field(default=None, description="Difficulty 1-10"),
) -> dict:
    """Puzzle creation and state management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"puzzle_system {action}"]
        if puzzle_type:
            cmd_parts.append(f"type={puzzle_type}")
        if puzzle_id:
            cmd_parts.append(f"id={puzzle_id}")
        if solution:
            cmd_parts.append(f"solution={solution}")
        if difficulty is not None:
            cmd_parts.append(f"difficulty={difficulty}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("puzzle_system failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def trap_system(
    action: str = Field(description="Action: place, remove, trigger, disarm, configure, state"),
    trap_type: Optional[str] = Field(default=None, description="Trap type: spike, poison, fire, ice, alarm, proximity"),
    location: Optional[list[float]] = Field(default=None, description="Trap location [X, Y, Z]"),
    damage: Optional[float] = Field(default=None, description="Trap damage amount"),
    radius: Optional[float] = Field(default=None, description="Trigger radius"),
    trap_id: Optional[str] = Field(default=None, description="Unique trap identifier"),
) -> dict:
    """Trap placement and management system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"trap_system {action}"]
        if trap_type:
            cmd_parts.append(f"type={trap_type}")
        if location:
            cmd_parts.append(f"loc={','.join(str(v) for v in location)}")
        if damage is not None:
            cmd_parts.append(f"damage={damage}")
        if radius is not None:
            cmd_parts.append(f"radius={radius}")
        if trap_id:
            cmd_parts.append(f"id={trap_id}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("trap_system failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def key_item(
    action: str = Field(description="Action: add, remove, give, check, configure, log"),
    item_id: Optional[str] = Field(default=None, description="Item identifier"),
    item_name: Optional[str] = Field(default=None, description="Display name"),
    item_type: Optional[str] = Field(default=None, description="Item type: key, quest, lore, collectible"),
    target: Optional[str] = Field(default=None, description="Target actor to receive item"),
    description: Optional[str] = Field(default=None, description="Item description text"),
) -> dict:
    """Key item and quest item management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"key_item {action}"]
        if item_id:
            cmd_parts.append(f"id={item_id}")
        if item_name:
            cmd_parts.append(f"name={item_name}")
        if item_type:
            cmd_parts.append(f"type={item_type}")
        if target:
            cmd_parts.append(f"target={target}")
        if description:
            cmd_parts.append(f"desc={description}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("key_item failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def tutorial_system(
    action: str = Field(description="Action: start, stop, skip, step, configure, state"),
    tutorial_id: Optional[str] = Field(default=None, description="Tutorial identifier"),
    step: Optional[int] = Field(default=None, description="Tutorial step number"),
    text: Optional[str] = Field(default=None, description="Tutorial text to display"),
    target_actor: Optional[str] = Field(default=None, description="Actor to highlight"),
    auto_advance: Optional[bool] = Field(default=None, description="Auto-advance on trigger"),
) -> dict:
    """Tutorial and onboarding system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"tutorial_system {action}"]
        if tutorial_id:
            cmd_parts.append(f"id={tutorial_id}")
        if step is not None:
            cmd_parts.append(f"step={step}")
        if text:
            cmd_parts.append(f"text={text}")
        if target_actor:
            cmd_parts.append(f"target={target_actor}")
        if auto_advance is not None:
            cmd_parts.append(f"auto={'true' if auto_advance else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("tutorial_system failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def difficulty_manager(
    action: str = Field(description="Action: set, get, scale, configure, auto_adjust"),
    difficulty_level: Optional[str] = Field(default=None, description="Difficulty: easy, normal, hard, nightmare, adaptive"),
    damage_scale: Optional[float] = Field(default=None, description="Damage multiplier"),
    health_scale: Optional[float] = Field(default=None, description="Health multiplier"),
    ai_aggression: Optional[float] = Field(default=None, description="AI aggression 0.0-1.0"),
    resource_multiplier: Optional[float] = Field(default=None, description="Resource drop multiplier"),
) -> dict:
    """Dynamic difficulty adjustment system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"difficulty_manager {action}"]
        if difficulty_level:
            cmd_parts.append(f"level={difficulty_level}")
        if damage_scale is not None:
            cmd_parts.append(f"dmg_scale={damage_scale}")
        if health_scale is not None:
            cmd_parts.append(f"hp_scale={health_scale}")
        if ai_aggression is not None:
            cmd_parts.append(f"ai_aggro={ai_aggression}")
        if resource_multiplier is not None:
            cmd_parts.append(f"res_mult={resource_multiplier}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("difficulty_manager failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ---------------------------------------------------------------------------
# Animation (7)
# ---------------------------------------------------------------------------

@mcp.tool()
async def anim_state(
    action: str = Field(description="Action: set, get, blend_to, transition, configure"),
    target: Optional[str] = Field(default=None, description="Target actor"),
    state_name: Optional[str] = Field(default=None, description="Animation state name"),
    layer: Optional[int] = Field(default=None, description="Animation layer index"),
    blend_time: Optional[float] = Field(default=None, description="Blend duration in seconds"),
) -> dict:
    """Animation state machine management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"anim_state {action}"]
        if target:
            cmd_parts.append(f"target={target}")
        if state_name:
            cmd_parts.append(f"state={state_name}")
        if layer is not None:
            cmd_parts.append(f"layer={layer}")
        if blend_time is not None:
            cmd_parts.append(f"blend={blend_time}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("anim_state failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def anim_blend(
    action: str = Field(description="Action: start, stop, configure, layer, mask"),
    target: Optional[str] = Field(default=None, description="Target actor"),
    from_anim: Optional[str] = Field(default=None, description="Source animation"),
    to_anim: Optional[str] = Field(default=None, description="Target animation"),
    blend_duration: Optional[float] = Field(default=None, description="Blend duration in seconds"),
    blend_curve: Optional[str] = Field(default=None, description="Blend curve: linear, ease_in, ease_out, cubic"),
) -> dict:
    """Animation blend and transition control."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"anim_blend {action}"]
        if target:
            cmd_parts.append(f"target={target}")
        if from_anim:
            cmd_parts.append(f"from={from_anim}")
        if to_anim:
            cmd_parts.append(f"to={to_anim}")
        if blend_duration is not None:
            cmd_parts.append(f"duration={blend_duration}")
        if blend_curve:
            cmd_parts.append(f"curve={blend_curve}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("anim_blend failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def anim_ragdoll(
    action: str = Field(description="Action: enable, disable, configure, impulse, blend_to"),
    target: Optional[str] = Field(default=None, description="Target actor"),
    force: Optional[list[float]] = Field(default=None, description="Impulse force [X, Y, Z]"),
    duration: Optional[float] = Field(default=None, description="Ragdoll duration in seconds"),
    blend_time: Optional[float] = Field(default=None, description="Blend time from/to ragdoll"),
) -> dict:
    """Ragdoll physics animation system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"anim_ragdoll {action}"]
        if target:
            cmd_parts.append(f"target={target}")
        if force:
            cmd_parts.append(f"force={','.join(str(v) for v in force)}")
        if duration is not None:
            cmd_parts.append(f"duration={duration}")
        if blend_time is not None:
            cmd_parts.append(f"blend={blend_time}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("anim_ragdoll failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def anim_ik(
    action: str = Field(description="Action: enable, disable, configure, target, weight"),
    target: Optional[str] = Field(default=None, description="Target actor"),
    bone_name: Optional[str] = Field(default=None, description="Bone to apply IK to"),
    target_location: Optional[list[float]] = Field(default=None, description="IK target location [X, Y, Z]"),
    weight: Optional[float] = Field(default=None, description="IK weight 0.0-1.0"),
    pole_vector: Optional[list[float]] = Field(default=None, description="Pole vector direction"),
) -> dict:
    """Inverse Kinematics animation system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"anim_ik {action}"]
        if target:
            cmd_parts.append(f"target={target}")
        if bone_name:
            cmd_parts.append(f"bone={bone_name}")
        if target_location:
            cmd_parts.append(f"ik_target={','.join(str(v) for v in target_location)}")
        if weight is not None:
            cmd_parts.append(f"weight={weight}")
        if pole_vector:
            cmd_parts.append(f"pole={','.join(str(v) for v in pole_vector)}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("anim_ik failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def anim_montage(
    action: str = Field(description="Action: play, stop, pause, resume, configure, section"),
    target: Optional[str] = Field(default=None, description="Target actor"),
    montage_name: Optional[str] = Field(default=None, description="Montage asset name"),
    play_rate: Optional[float] = Field(default=None, description="Playback rate"),
    section_name: Optional[str] = Field(default=None, description="Montage section to jump to"),
    slot: Optional[str] = Field(default=None, description="Animation slot"),
) -> dict:
    """Animation montage playback control."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"anim_montage {action}"]
        if target:
            cmd_parts.append(f"target={target}")
        if montage_name:
            cmd_parts.append(f"montage={montage_name}")
        if play_rate is not None:
            cmd_parts.append(f"rate={play_rate}")
        if section_name:
            cmd_parts.append(f"section={section_name}")
        if slot:
            cmd_parts.append(f"slot={slot}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("anim_montage failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def anim_notify(
    action: str = Field(description="Action: add, remove, trigger, configure, list"),
    target: Optional[str] = Field(default=None, description="Target actor"),
    notify_name: Optional[str] = Field(default=None, description="Notify name"),
    notify_type: Optional[str] = Field(default=None, description="Notify type: sound, particle, footstep, damage, camera_shake"),
    bone_name: Optional[str] = Field(default=None, description="Bone to attach notify"),
    offset: Optional[list[float]] = Field(default=None, description="Offset from bone [X, Y, Z]"),
) -> dict:
    """Animation notify event system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"anim_notify {action}"]
        if target:
            cmd_parts.append(f"target={target}")
        if notify_name:
            cmd_parts.append(f"name={notify_name}")
        if notify_type:
            cmd_parts.append(f"type={notify_type}")
        if bone_name:
            cmd_parts.append(f"bone={bone_name}")
        if offset:
            cmd_parts.append(f"offset={','.join(str(v) for v in offset)}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("anim_notify failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def anim_locomotion(
    action: str = Field(description="Action: configure, blend_space, stride, turn, root_motion"),
    target: Optional[str] = Field(default=None, description="Target actor"),
    move_speed: Optional[float] = Field(default=None, description="Movement speed"),
    direction: Optional[float] = Field(default=None, description="Movement direction angle"),
    stance: Optional[str] = Field(default=None, description="Stance: standing, crouching, prone"),
    turn_rate: Optional[float] = Field(default=None, description="Turn rate"),
    root_motion: Optional[bool] = Field(default=None, description="Enable root motion"),
) -> dict:
    """Locomotion animation blending system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"anim_locomotion {action}"]
        if target:
            cmd_parts.append(f"target={target}")
        if move_speed is not None:
            cmd_parts.append(f"speed={move_speed}")
        if direction is not None:
            cmd_parts.append(f"dir={direction}")
        if stance:
            cmd_parts.append(f"stance={stance}")
        if turn_rate is not None:
            cmd_parts.append(f"turn={turn_rate}")
        if root_motion is not None:
            cmd_parts.append(f"root_motion={'true' if root_motion else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("anim_locomotion failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ---------------------------------------------------------------------------
# Camera (5)
# ---------------------------------------------------------------------------

@mcp.tool()
async def camera_first_person(
    action: str = Field(description="Action: enable, disable, configure, bob, sway"),
    fov: Optional[float] = Field(default=None, description="Field of view"),
    bob_intensity: Optional[float] = Field(default=None, description="Head bob intensity"),
    sway_intensity: Optional[float] = Field(default=None, description="Weapon sway intensity"),
    sensitivity: Optional[float] = Field(default=None, description="Mouse sensitivity"),
) -> dict:
    """First-person camera system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"camera_first_person {action}"]
        if fov is not None:
            cmd_parts.append(f"fov={fov}")
        if bob_intensity is not None:
            cmd_parts.append(f"bob={bob_intensity}")
        if sway_intensity is not None:
            cmd_parts.append(f"sway={sway_intensity}")
        if sensitivity is not None:
            cmd_parts.append(f"sens={sensitivity}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("camera_first_person failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def camera_third_person(
    action: str = Field(description="Action: enable, disable, configure, orbit, offset"),
    distance: Optional[float] = Field(default=None, description="Camera distance from target"),
    height: Optional[float] = Field(default=None, description="Camera height offset"),
    fov: Optional[float] = Field(default=None, description="Field of view"),
    shoulder_offset: Optional[float] = Field(default=None, description="Shoulder offset for over-the-shoulder"),
    auto_aim: Optional[bool] = Field(default=None, description="Auto-aim camera assist"),
) -> dict:
    """Third-person camera system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"camera_third_person {action}"]
        if distance is not None:
            cmd_parts.append(f"dist={distance}")
        if height is not None:
            cmd_parts.append(f"height={height}")
        if fov is not None:
            cmd_parts.append(f"fov={fov}")
        if shoulder_offset is not None:
            cmd_parts.append(f"shoulder={shoulder_offset}")
        if auto_aim is not None:
            cmd_parts.append(f"auto_aim={'true' if auto_aim else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("camera_third_person failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def camera_cinematic(
    action: str = Field(description="Action: play, stop, pause, configure, sequence"),
    sequence_name: Optional[str] = Field(default=None, description="Cinematic sequence name"),
    play_rate: Optional[float] = Field(default=None, description="Playback rate"),
    fov: Optional[float] = Field(default=None, description="Field of view"),
    letterbox: Optional[bool] = Field(default=None, description="Enable letterbox bars"),
    fade_in: Optional[float] = Field(default=None, description="Fade in duration"),
    fade_out: Optional[float] = Field(default=None, description="Fade out duration"),
) -> dict:
    """Cinematic camera sequence system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"camera_cinematic {action}"]
        if sequence_name:
            cmd_parts.append(f"seq={sequence_name}")
        if play_rate is not None:
            cmd_parts.append(f"rate={play_rate}")
        if fov is not None:
            cmd_parts.append(f"fov={fov}")
        if letterbox is not None:
            cmd_parts.append(f"letterbox={'true' if letterbox else 'false'}")
        if fade_in is not None:
            cmd_parts.append(f"fade_in={fade_in}")
        if fade_out is not None:
            cmd_parts.append(f"fade_out={fade_out}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("camera_cinematic failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def camera_shake(
    action: str = Field(description="Action: trigger, stop, configure, preset"),
    shake_type: Optional[str] = Field(default=None, description="Shake type: small, medium, large, explosion, hit, footsteps"),
    intensity: Optional[float] = Field(default=None, description="Shake intensity 0.0-1.0"),
    duration: Optional[float] = Field(default=None, description="Shake duration in seconds"),
    location: Optional[list[float]] = Field(default=None, description="Shake origin location [X, Y, Z]"),
    falloff: Optional[float] = Field(default=None, description="Distance falloff"),
) -> dict:
    """Camera shake and screen effects."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"camera_shake {action}"]
        if shake_type:
            cmd_parts.append(f"type={shake_type}")
        if intensity is not None:
            cmd_parts.append(f"intensity={intensity}")
        if duration is not None:
            cmd_parts.append(f"duration={duration}")
        if location:
            cmd_parts.append(f"loc={','.join(str(v) for v in location)}")
        if falloff is not None:
            cmd_parts.append(f"falloff={falloff}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("camera_shake failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def camera_follow(
    action: str = Field(description="Action: start, stop, configure, target, smooth"),
    target_actor: Optional[str] = Field(default=None, description="Actor to follow"),
    offset: Optional[list[float]] = Field(default=None, description="Camera offset [X, Y, Z]"),
    smooth_speed: Optional[float] = Field(default=None, description="Follow smoothing speed"),
    look_ahead: Optional[float] = Field(default=None, description="Look ahead distance"),
    lock_rotation: Optional[bool] = Field(default=None, description="Lock camera to target rotation"),
) -> dict:
    """Camera follow target system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"camera_follow {action}"]
        if target_actor:
            cmd_parts.append(f"target={target_actor}")
        if offset:
            cmd_parts.append(f"offset={','.join(str(v) for v in offset)}")
        if smooth_speed is not None:
            cmd_parts.append(f"smooth={smooth_speed}")
        if look_ahead is not None:
            cmd_parts.append(f"lookahead={look_ahead}")
        if lock_rotation is not None:
            cmd_parts.append(f"lock_rot={'true' if lock_rotation else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("camera_follow failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ---------------------------------------------------------------------------
# VFX (9)
# ---------------------------------------------------------------------------

@mcp.tool()
async def vfx_particle(
    action: str = Field(description="Action: spawn, stop, configure, preset, attach, pool"),
    effect_name: Optional[str] = Field(default=None, description="Particle system name"),
    location: Optional[list[float]] = Field(default=None, description="Location [X, Y, Z]"),
    scale: Optional[float] = Field(default=None, description="Effect scale"),
    target_actor: Optional[str] = Field(default=None, description="Actor to attach to"),
    duration: Optional[float] = Field(default=None, description="Duration in seconds"),
) -> dict:
    """Particle effects spawning and control."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"vfx_particle {action}"]
        if effect_name:
            cmd_parts.append(f"effect={effect_name}")
        if location:
            cmd_parts.append(f"loc={','.join(str(v) for v in location)}")
        if scale is not None:
            cmd_parts.append(f"scale={scale}")
        if target_actor:
            cmd_parts.append(f"target={target_actor}")
        if duration is not None:
            cmd_parts.append(f"duration={duration}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("vfx_particle failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def vfx_postprocess(
    action: str = Field(description="Action: enable, disable, configure, preset, stack"),
    effect_type: Optional[str] = Field(default=None, description="Effect type: bloom, motion_blur, dof, tone_mapping, chromatic_aberration, vignette"),
    intensity: Optional[float] = Field(default=None, description="Effect intensity"),
    radius: Optional[float] = Field(default=None, description="Effect radius"),
    color_tint: Optional[list[float]] = Field(default=None, description="Color tint [R, G, B]"),
) -> dict:
    """Post-process volume effects."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"vfx_postprocess {action}"]
        if effect_type:
            cmd_parts.append(f"type={effect_type}")
        if intensity is not None:
            cmd_parts.append(f"intensity={intensity}")
        if radius is not None:
            cmd_parts.append(f"radius={radius}")
        if color_tint:
            cmd_parts.append(f"color={','.join(str(v) for v in color_tint)}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("vfx_postprocess failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def vfx_lighting(
    action: str = Field(description="Action: spawn, remove, configure, preset, flicker, pulse"),
    light_type: Optional[str] = Field(default=None, description="Light type: point, spot, rect, sky, atmosphere"),
    location: Optional[list[float]] = Field(default=None, description="Location [X, Y, Z]"),
    color: Optional[list[float]] = Field(default=None, description="RGB color [0-1]"),
    intensity: Optional[float] = Field(default=None, description="Light intensity"),
    radius: Optional[float] = Field(default=None, description="Light radius"),
    flicker_speed: Optional[float] = Field(default=None, description="Flicker speed"),
) -> dict:
    """VFX dynamic lighting system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"vfx_lighting {action}"]
        if light_type:
            cmd_parts.append(f"type={light_type}")
        if location:
            cmd_parts.append(f"loc={','.join(str(v) for v in location)}")
        if color:
            cmd_parts.append(f"color={','.join(str(v) for v in color)}")
        if intensity is not None:
            cmd_parts.append(f"intensity={intensity}")
        if radius is not None:
            cmd_parts.append(f"radius={radius}")
        if flicker_speed is not None:
            cmd_parts.append(f"flicker={flicker_speed}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("vfx_lighting failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def vfx_fog(
    action: str = Field(description="Action: enable, disable, configure, density, color, animate"),
    fog_type: Optional[str] = Field(default=None, description="Fog type: height, volumetric, exponential, distance"),
    density: Optional[float] = Field(default=None, description="Fog density"),
    color: Optional[list[float]] = Field(default=None, description="Fog color [R, G, B]"),
    start_distance: Optional[float] = Field(default=None, description="Fog start distance"),
    height_falloff: Optional[float] = Field(default=None, description="Height fog falloff"),
) -> dict:
    """Atmospheric fog and haze system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"vfx_fog {action}"]
        if fog_type:
            cmd_parts.append(f"type={fog_type}")
        if density is not None:
            cmd_parts.append(f"density={density}")
        if color:
            cmd_parts.append(f"color={','.join(str(v) for v in color)}")
        if start_distance is not None:
            cmd_parts.append(f"start_dist={start_distance}")
        if height_falloff is not None:
            cmd_parts.append(f"height_falloff={height_falloff}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("vfx_fog failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def vfx_weather(
    action: str = Field(description="Action: start, stop, configure, transition, preset"),
    weather_type: Optional[str] = Field(default=None, description="Weather: rain, snow, storm, fog, clear, sandstorm, ash_fall"),
    intensity: Optional[float] = Field(default=None, description="Weather intensity 0.0-1.0"),
    transition_time: Optional[float] = Field(default=None, description="Transition duration in seconds"),
    wind_speed: Optional[float] = Field(default=None, description="Wind speed"),
    wind_direction: Optional[list[float]] = Field(default=None, description="Wind direction [X, Y, Z]"),
    thunder: Optional[bool] = Field(default=None, description="Enable thunder/lightning"),
) -> dict:
    """Dynamic weather system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"vfx_weather {action}"]
        if weather_type:
            cmd_parts.append(f"type={weather_type}")
        if intensity is not None:
            cmd_parts.append(f"intensity={intensity}")
        if transition_time is not None:
            cmd_parts.append(f"transition={transition_time}")
        if wind_speed is not None:
            cmd_parts.append(f"wind_speed={wind_speed}")
        if wind_direction:
            cmd_parts.append(f"wind_dir={','.join(str(v) for v in wind_direction)}")
        if thunder is not None:
            cmd_parts.append(f"thunder={'true' if thunder else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("vfx_weather failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def vfx_decal(
    action: str = Field(description="Action: spawn, remove, configure, project, fade"),
    decal_name: Optional[str] = Field(default=None, description="Decal material name"),
    location: Optional[list[float]] = Field(default=None, description="Location [X, Y, Z]"),
    rotation: Optional[list[float]] = Field(default=None, description="Rotation [Pitch, Yaw, Roll]"),
    size: Optional[list[float]] = Field(default=None, description="Decal size [X, Y, Z]"),
    fade_time: Optional[float] = Field(default=None, description="Fade duration in seconds"),
    projected: Optional[bool] = Field(default=None, description="Project onto surfaces"),
) -> dict:
    """Decal projection and effects."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"vfx_decal {action}"]
        if decal_name:
            cmd_parts.append(f"decal={decal_name}")
        if location:
            cmd_parts.append(f"loc={','.join(str(v) for v in location)}")
        if rotation:
            cmd_parts.append(f"rot={','.join(str(v) for v in rotation)}")
        if size:
            cmd_parts.append(f"size={','.join(str(v) for v in size)}")
        if fade_time is not None:
            cmd_parts.append(f"fade={fade_time}")
        if projected is not None:
            cmd_parts.append(f"projected={'true' if projected else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("vfx_decal failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def vfx_niagara(
    action: str = Field(description="Action: spawn, stop, configure, parameter, preset"),
    system_name: Optional[str] = Field(default=None, description="Niagara system name"),
    location: Optional[list[float]] = Field(default=None, description="Location [X, Y, Z]"),
    scale: Optional[float] = Field(default=None, description="System scale"),
    parameter_name: Optional[str] = Field(default=None, description="Parameter to set"),
    parameter_value: Optional[str] = Field(default=None, description="Parameter value"),
    auto_activate: Optional[bool] = Field(default=None, description="Auto-activate on spawn"),
) -> dict:
    """Niagara particle system control."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"vfx_niagara {action}"]
        if system_name:
            cmd_parts.append(f"system={system_name}")
        if location:
            cmd_parts.append(f"loc={','.join(str(v) for v in location)}")
        if scale is not None:
            cmd_parts.append(f"scale={scale}")
        if parameter_name:
            cmd_parts.append(f"param={parameter_name}")
        if parameter_value:
            cmd_parts.append(f"val={parameter_value}")
        if auto_activate is not None:
            cmd_parts.append(f"auto_activate={'true' if auto_activate else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("vfx_niagara failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def vfx_lumen(
    action: str = Field(description="Action: configure, quality, gi, reflection, probe"),
    quality: Optional[str] = Field(default=None, description="Quality: low, medium, high, epic, cinematic"),
    gi_method: Optional[str] = Field(default=None, description="GI method: software, hardware"),
    reflection_method: Optional[str] = Field(default=None, description="Reflection method: software, hardware, both"),
    final_gather: Optional[bool] = Field(default=None, description="Enable final gather"),
    scene_detail: Optional[float] = Field(default=None, description="Scene detail scale"),
    probe_resolution: Optional[int] = Field(default=None, description="Probe resolution"),
) -> dict:
    """Lumen global illumination settings."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"vfx_lumen {action}"]
        if quality:
            cmd_parts.append(f"quality={quality}")
        if gi_method:
            cmd_parts.append(f"gi={gi_method}")
        if reflection_method:
            cmd_parts.append(f"reflection={reflection_method}")
        if final_gather is not None:
            cmd_parts.append(f"final_gather={'true' if final_gather else 'false'}")
        if scene_detail is not None:
            cmd_parts.append(f"scene_detail={scene_detail}")
        if probe_resolution is not None:
            cmd_parts.append(f"probe_res={probe_resolution}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("vfx_lumen failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def vfx_nanite(
    action: str = Field(description="Action: enable, disable, configure, stats, fallback"),
    target_actor: Optional[str] = Field(default=None, description="Target actor"),
    enabled: Optional[bool] = Field(default=None, description="Enable Nanite for mesh"),
    fallback_relative_error: Optional[float] = Field(default=None, description="Fallback relative error"),
    max_pixels_per_edge: Optional[int] = Field(default=None, description="Max pixels per edge"),
    show_nanite: Optional[bool] = Field(default=None, description="Show Nanite debug view"),
) -> dict:
    """Nanite virtualized geometry settings."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"vfx_nanite {action}"]
        if target_actor:
            cmd_parts.append(f"target={target_actor}")
        if enabled is not None:
            cmd_parts.append(f"enabled={'true' if enabled else 'false'}")
        if fallback_relative_error is not None:
            cmd_parts.append(f"fallback_error={fallback_relative_error}")
        if max_pixels_per_edge is not None:
            cmd_parts.append(f"max_pixels={max_pixels_per_edge}")
        if show_nanite is not None:
            cmd_parts.append(f"debug={'true' if show_nanite else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("vfx_nanite failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ---------------------------------------------------------------------------
# UI/UX (7)
# ---------------------------------------------------------------------------

@mcp.tool()
async def ui_menu(
    action: str = Field(description="Action: show, hide, configure, navigate, theme"),
    menu_name: Optional[str] = Field(default=None, description="Menu widget name"),
    menu_type: Optional[str] = Field(default=None, description="Menu type: main, pause, settings, credits, debug"),
    visible: Optional[bool] = Field(default=None, description="Menu visibility"),
    theme: Optional[str] = Field(default=None, description="UI theme"),
) -> dict:
    """Main menu and UI screen management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"ui_menu {action}"]
        if menu_name:
            cmd_parts.append(f"menu={menu_name}")
        if menu_type:
            cmd_parts.append(f"type={menu_type}")
        if visible is not None:
            cmd_parts.append(f"visible={'true' if visible else 'false'}")
        if theme:
            cmd_parts.append(f"theme={theme}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("ui_menu failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def ui_hud_custom(
    action: str = Field(description="Action: show, hide, configure, add_element, remove_element"),
    element_name: Optional[str] = Field(default=None, description="HUD element name"),
    element_type: Optional[str] = Field(default=None, description="Element type: health_bar, ammo_counter, minimap, crosshair, compass"),
    position: Optional[list[float]] = Field(default=None, description="Position [X, Y]"),
    size: Optional[list[float]] = Field(default=None, description="Size [Width, Height]"),
    opacity: Optional[float] = Field(default=None, description="Opacity 0.0-1.0"),
) -> dict:
    """Custom HUD element management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"ui_hud {action}"]
        if element_name:
            cmd_parts.append(f"element={element_name}")
        if element_type:
            cmd_parts.append(f"type={element_type}")
        if position:
            cmd_parts.append(f"pos={','.join(str(v) for v in position)}")
        if size:
            cmd_parts.append(f"size={','.join(str(v) for v in size)}")
        if opacity is not None:
            cmd_parts.append(f"opacity={opacity}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("ui_hud_custom failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def ui_tooltip(
    action: str = Field(description="Action: show, hide, configure, bind, unbind"),
    target_actor: Optional[str] = Field(default=None, description="Actor to show tooltip for"),
    text: Optional[str] = Field(default=None, description="Tooltip text content"),
    position: Optional[list[float]] = Field(default=None, description="Screen position [X, Y]"),
    style: Optional[str] = Field(default=None, description="Tooltip style: default, dark, light, minimap"),
    auto_hide_delay: Optional[float] = Field(default=None, description="Auto-hide delay in seconds"),
) -> dict:
    """Tooltip display system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"ui_tooltip {action}"]
        if target_actor:
            cmd_parts.append(f"target={target_actor}")
        if text:
            cmd_parts.append(f"text={text}")
        if position:
            cmd_parts.append(f"pos={','.join(str(v) for v in position)}")
        if style:
            cmd_parts.append(f"style={style}")
        if auto_hide_delay is not None:
            cmd_parts.append(f"auto_hide={auto_hide_delay}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("ui_tooltip failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def ui_notification(
    action: str = Field(description="Action: show, dismiss, queue, configure, preset"),
    text: Optional[str] = Field(default=None, description="Notification text"),
    notification_type: Optional[str] = Field(default=None, description="Type: info, warning, error, success, achievement, quest"),
    duration: Optional[float] = Field(default=None, description="Display duration in seconds"),
    position: Optional[str] = Field(default=None, description="Screen position: top, center, bottom"),
    icon: Optional[str] = Field(default=None, description="Icon identifier"),
    sound: Optional[bool] = Field(default=None, description="Play notification sound"),
) -> dict:
    """In-game notification system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"ui_notification {action}"]
        if text:
            cmd_parts.append(f"text={text}")
        if notification_type:
            cmd_parts.append(f"type={notification_type}")
        if duration is not None:
            cmd_parts.append(f"duration={duration}")
        if position:
            cmd_parts.append(f"position={position}")
        if icon:
            cmd_parts.append(f"icon={icon}")
        if sound is not None:
            cmd_parts.append(f"sound={'true' if sound else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("ui_notification failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def ui_loading(
    action: str = Field(description="Action: show, hide, configure, progress, tip"),
    loading_type: Optional[str] = Field(default=None, description="Type: full_screen, transition, overlay, async"),
    progress: Optional[float] = Field(default=None, description="Loading progress 0.0-1.0"),
    tip_text: Optional[str] = Field(default=None, description="Loading screen tip text"),
    background_image: Optional[str] = Field(default=None, description="Background image asset path"),
    animate: Optional[bool] = Field(default=None, description="Animate loading indicator"),
) -> dict:
    """Loading screen management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"ui_loading {action}"]
        if loading_type:
            cmd_parts.append(f"type={loading_type}")
        if progress is not None:
            cmd_parts.append(f"progress={progress}")
        if tip_text:
            cmd_parts.append(f"tip={tip_text}")
        if background_image:
            cmd_parts.append(f"bg={background_image}")
        if animate is not None:
            cmd_parts.append(f"animate={'true' if animate else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("ui_loading failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def ui_inventory_screen(
    action: str = Field(description="Action: open, close, configure, sort, filter, select"),
    player_id: Optional[str] = Field(default=None, description="Player ID"),
    sort_by: Optional[str] = Field(default=None, description="Sort by: name, type, weight, value, rarity"),
    filter_type: Optional[str] = Field(default=None, description="Filter: all, weapons, armor, consumables, quest"),
    selected_slot: Optional[int] = Field(default=None, description="Selected inventory slot index"),
    show_grid: Optional[bool] = Field(default=None, description="Use grid layout"),
) -> dict:
    """Inventory screen UI management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"ui_inventory {action}"]
        if player_id:
            cmd_parts.append(f"player={player_id}")
        if sort_by:
            cmd_parts.append(f"sort={sort_by}")
        if filter_type:
            cmd_parts.append(f"filter={filter_type}")
        if selected_slot is not None:
            cmd_parts.append(f"slot={selected_slot}")
        if show_grid is not None:
            cmd_parts.append(f"grid={'true' if show_grid else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("ui_inventory_screen failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def ui_dialogue_box(
    action: str = Field(description="Action: show, hide, configure, select_option, next, portrait"),
    speaker_name: Optional[str] = Field(default=None, description="Speaker name"),
    dialogue_text: Optional[str] = Field(default=None, description="Dialogue text"),
    options: Optional[list[str]] = Field(default=None, description="Dialogue options"),
    selected_option: Optional[int] = Field(default=None, description="Selected option index"),
    portrait: Optional[str] = Field(default=None, description="Speaker portrait asset"),
    typewriter_speed: Optional[float] = Field(default=None, description="Text typewriter speed"),
) -> dict:
    """Dialogue box and conversation UI."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"ui_dialogue {action}"]
        if speaker_name:
            cmd_parts.append(f"speaker={speaker_name}")
        if dialogue_text:
            cmd_parts.append(f"text={dialogue_text}")
        if options:
            cmd_parts.append(f"options={'|'.join(options)}")
        if selected_option is not None:
            cmd_parts.append(f"selected={selected_option}")
        if portrait:
            cmd_parts.append(f"portrait={portrait}")
        if typewriter_speed is not None:
            cmd_parts.append(f"type_speed={typewriter_speed}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("ui_dialogue_box failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ---------------------------------------------------------------------------
# Platform (4)
# ---------------------------------------------------------------------------

@mcp.tool()
async def platform_input(
    action: str = Field(description="Action: rebind, reset, get_bindings, test, deadzone"),
    action_name: Optional[str] = Field(default=None, description="Input action to rebind"),
    key: Optional[str] = Field(default=None, description="New key binding"),
    platform: Optional[str] = Field(default=None, description="Target platform: keyboard, gamepad, touch"),
    deadzone: Optional[float] = Field(default=None, description="Joystick deadzone 0.0-1.0"),
    invert_y: Optional[bool] = Field(default=None, description="Invert Y axis"),
) -> dict:
    """Input binding and platform configuration."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"platform_input {action}"]
        if action_name:
            cmd_parts.append(f"action={action_name}")
        if key:
            cmd_parts.append(f"key={key}")
        if platform:
            cmd_parts.append(f"platform={platform}")
        if deadzone is not None:
            cmd_parts.append(f"deadzone={deadzone}")
        if invert_y is not None:
            cmd_parts.append(f"invert_y={'true' if invert_y else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("platform_input failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def platform_perf(
    action: str = Field(description="Action: profile, report, benchmark, throttle, optimize"),
    target_fps: Optional[int] = Field(default=None, description="Target FPS"),
    resolution_scale: Optional[float] = Field(default=None, description="Resolution scale 0.5-2.0"),
    quality_level: Optional[str] = Field(default=None, description="Quality level: low, medium, high, epic, cinematic"),
    ray_tracing: Optional[bool] = Field(default=None, description="Enable ray tracing"),
    dlss: Optional[bool] = Field(default=None, description="Enable DLSS"),
    fsr: Optional[bool] = Field(default=None, description="Enable FSR"),
) -> dict:
    """Platform performance profiling and optimization."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"platform_perf {action}"]
        if target_fps is not None:
            cmd_parts.append(f"target_fps={target_fps}")
        if resolution_scale is not None:
            cmd_parts.append(f"res_scale={resolution_scale}")
        if quality_level:
            cmd_parts.append(f"quality={quality_level}")
        if ray_tracing is not None:
            cmd_parts.append(f"rt={'true' if ray_tracing else 'false'}")
        if dlss is not None:
            cmd_parts.append(f"dlss={'true' if dlss else 'false'}")
        if fsr is not None:
            cmd_parts.append(f"fsr={'true' if fsr else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("platform_perf failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def platform_resolve(
    action: str = Field(description="Action: set, auto, check, list, quality"),
    platform: Optional[str] = Field(default=None, description="Platform: pc, ps5, xbox_series_x, switch, mobile"),
    resolution: Optional[list[int]] = Field(default=None, description="Resolution [Width, Height]"),
    frame_rate: Optional[int] = Field(default=None, description="Frame rate cap"),
    quality_preset: Optional[str] = Field(default=None, description="Quality preset"),
) -> dict:
    """Platform resolution and quality management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"platform_resolve {action}"]
        if platform:
            cmd_parts.append(f"platform={platform}")
        if resolution:
            cmd_parts.append(f"res={resolution[0]}x{resolution[1]}")
        if frame_rate is not None:
            cmd_parts.append(f"fps={frame_rate}")
        if quality_preset:
            cmd_parts.append(f"preset={quality_preset}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("platform_resolve failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def platform_quality(
    action: str = Field(description="Action: set, get, profile, auto, list"),
    setting_name: Optional[str] = Field(default=None, description="Quality setting name"),
    value: Optional[str] = Field(default=None, description="Setting value"),
    scope: Optional[str] = Field(default=None, description="Scope: global, local, profile"),
    auto_detect: Optional[bool] = Field(default=None, description="Auto-detect best settings"),
) -> dict:
    """Platform quality settings management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"platform_quality {action}"]
        if setting_name:
            cmd_parts.append(f"setting={setting_name}")
        if value:
            cmd_parts.append(f"value={value}")
        if scope:
            cmd_parts.append(f"scope={scope}")
        if auto_detect is not None:
            cmd_parts.append(f"auto_detect={'true' if auto_detect else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("platform_quality failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ---------------------------------------------------------------------------
# Build (5)
# ---------------------------------------------------------------------------

@mcp.tool()
async def build_cook(
    action: str = Field(description="Action: start, status, cancel, configure, log"),
    platform: Optional[str] = Field(default=None, description="Target platform: win64, linux, android, ios, ps5, xbox"),
    configuration: Optional[str] = Field(default=None, description="Configuration: debug, development, shipping"),
    map_list: Optional[list[str]] = Field(default=None, description="Maps to cook"),
    compressed: Optional[bool] = Field(default=None, description="Compress cooked content"),
) -> dict:
    """Cook build process management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"build_cook {action}"]
        if platform:
            cmd_parts.append(f"platform={platform}")
        if configuration:
            cmd_parts.append(f"config={configuration}")
        if map_list:
            cmd_parts.append(f"maps={','.join(map_list)}")
        if compressed is not None:
            cmd_parts.append(f"compressed={'true' if compressed else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("build_cook failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def build_package(
    action: str = Field(description="Action: create, upload, download, configure, list"),
    package_name: Optional[str] = Field(default=None, description="Package name"),
    platform: Optional[str] = Field(default=None, description="Target platform"),
    version: Optional[str] = Field(default=None, description="Package version"),
    output_dir: Optional[str] = Field(default=None, description="Output directory"),
    include_debug: Optional[bool] = Field(default=None, description="Include debug symbols"),
) -> dict:
    """Package build and distribution."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"build_package {action}"]
        if package_name:
            cmd_parts.append(f"name={package_name}")
        if platform:
            cmd_parts.append(f"platform={platform}")
        if version:
            cmd_parts.append(f"version={version}")
        if output_dir:
            cmd_parts.append(f"output={output_dir}")
        if include_debug is not None:
            cmd_parts.append(f"debug={'true' if include_debug else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("build_package failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def build_shader(
    action: str = Field(description="Action: compile, status, clean, quality, platform"),
    shader_type: Optional[str] = Field(default=None, description="Shader type: material, compute, vertex, pixel"),
    quality: Optional[str] = Field(default=None, description="Quality: low, medium, high, epic"),
    platform: Optional[str] = Field(default=None, description="Target platform"),
    parallel: Optional[bool] = Field(default=None, description="Use parallel compilation"),
    cache: Optional[bool] = Field(default=None, description="Enable shader caching"),
) -> dict:
    """Shader compilation management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"build_shader {action}"]
        if shader_type:
            cmd_parts.append(f"shader={shader_type}")
        if quality:
            cmd_parts.append(f"quality={quality}")
        if platform:
            cmd_parts.append(f"platform={platform}")
        if parallel is not None:
            cmd_parts.append(f"parallel={'true' if parallel else 'false'}")
        if cache is not None:
            cmd_parts.append(f"cache={'true' if cache else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("build_shader failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def build_cooktime(
    action: str = Field(description="Action: start, status, estimate, cancel, report"),
    platform: Optional[str] = Field(default=None, description="Target platform"),
    configuration: Optional[str] = Field(default=None, description="Build configuration"),
    full_build: Optional[bool] = Field(default=None, description="Full cook vs incremental"),
    map_only: Optional[list[str]] = Field(default=None, description="Cook only specific maps"),
) -> dict:
    """Cook time tracking and optimization."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"build_cooktime {action}"]
        if platform:
            cmd_parts.append(f"platform={platform}")
        if configuration:
            cmd_parts.append(f"config={configuration}")
        if full_build is not None:
            cmd_parts.append(f"full={'true' if full_build else 'false'}")
        if map_only:
            cmd_parts.append(f"maps={','.join(map_only)}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("build_cooktime failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def build_asset(
    action: str = Field(description="Action: import, export, validate, check, migrate"),
    asset_path: Optional[str] = Field(default=None, description="Asset path in content browser"),
    asset_type: Optional[str] = Field(default=None, description="Asset type: texture, mesh, animation, audio, blueprint"),
    validate: Optional[bool] = Field(default=None, description="Run validation checks"),
    export_format: Optional[str] = Field(default=None, description="Export format"),
    output_path: Optional[str] = Field(default=None, description="Output path"),
) -> dict:
    """Asset build pipeline management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"build_asset {action}"]
        if asset_path:
            cmd_parts.append(f"asset={asset_path}")
        if asset_type:
            cmd_parts.append(f"type={asset_type}")
        if validate is not None:
            cmd_parts.append(f"validate={'true' if validate else 'false'}")
        if export_format:
            cmd_parts.append(f"format={export_format}")
        if output_path:
            cmd_parts.append(f"output={output_path}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("build_asset failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ---------------------------------------------------------------------------
# Test/QA (6)
# ---------------------------------------------------------------------------

@mcp.tool()
async def test_unit(
    action: str = Field(description="Action: run, list, report, coverage, filter"),
    test_name: Optional[str] = Field(default=None, description="Specific test name"),
    test_suite: Optional[str] = Field(default=None, description="Test suite to run"),
    coverage_threshold: Optional[int] = Field(default=None, description="Minimum coverage %"),
    verbose: Optional[bool] = Field(default=None, description="Verbose output"),
) -> dict:
    """Unit test runner and management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"test_unit {action}"]
        if test_name:
            cmd_parts.append(f"test={test_name}")
        if test_suite:
            cmd_parts.append(f"suite={test_suite}")
        if coverage_threshold is not None:
            cmd_parts.append(f"threshold={coverage_threshold}")
        if verbose is not None:
            cmd_parts.append(f"verbose={'true' if verbose else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("test_unit failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def test_functional(
    action: str = Field(description="Action: run, list, report, record, replay"),
    test_name: Optional[str] = Field(default=None, description="Functional test name"),
    scenario: Optional[str] = Field(default=None, description="Test scenario"),
    auto_retry: Optional[bool] = Field(default=None, description="Auto-retry on failure"),
    screenshot_on_fail: Optional[bool] = Field(default=None, description="Capture screenshot on failure"),
    timeout: Optional[int] = Field(default=None, description="Test timeout in seconds"),
) -> dict:
    """Functional and integration test system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"test_functional {action}"]
        if test_name:
            cmd_parts.append(f"test={test_name}")
        if scenario:
            cmd_parts.append(f"scenario={scenario}")
        if auto_retry is not None:
            cmd_parts.append(f"auto_retry={'true' if auto_retry else 'false'}")
        if screenshot_on_fail is not None:
            cmd_parts.append(f"screenshot_fail={'true' if screenshot_on_fail else 'false'}")
        if timeout is not None:
            cmd_parts.append(f"timeout={timeout}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("test_functional failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def test_perf(
    action: str = Field(description="Action: run, benchmark, report, compare, baseline"),
    test_name: Optional[str] = Field(default=None, description="Performance test name"),
    duration: Optional[int] = Field(default=None, description="Test duration in seconds"),
    metrics: Optional[list[str]] = Field(default=None, description="Metrics to capture: fps, frame_time, memory, draw_calls, gpu_time"),
    compare_baseline: Optional[str] = Field(default=None, description="Baseline to compare against"),
    warmup: Optional[int] = Field(default=None, description="Warmup time in seconds"),
) -> dict:
    """Performance testing and benchmarking."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"test_perf {action}"]
        if test_name:
            cmd_parts.append(f"test={test_name}")
        if duration is not None:
            cmd_parts.append(f"duration={duration}")
        if metrics:
            cmd_parts.append(f"metrics={','.join(metrics)}")
        if compare_baseline:
            cmd_parts.append(f"baseline={compare_baseline}")
        if warmup is not None:
            cmd_parts.append(f"warmup={warmup}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("test_perf failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def test_coverage(
    action: str = Field(description="Action: run, report, threshold, exclude, include"),
    module: Optional[str] = Field(default=None, description="Module to measure"),
    threshold: Optional[int] = Field(default=None, description="Minimum coverage %"),
    include: Optional[list[str]] = Field(default=None, description="File patterns to include"),
    exclude: Optional[list[str]] = Field(default=None, description="File patterns to exclude"),
    output_format: Optional[str] = Field(default=None, description="Output format: html, json, xml"),
) -> dict:
    """Test coverage analysis."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"test_coverage {action}"]
        if module:
            cmd_parts.append(f"module={module}")
        if threshold is not None:
            cmd_parts.append(f"threshold={threshold}")
        if include:
            cmd_parts.append(f"include={','.join(include)}")
        if exclude:
            cmd_parts.append(f"exclude={','.join(exclude)}")
        if output_format:
            cmd_parts.append(f"format={output_format}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("test_coverage failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def test_automation(
    action: str = Field(description="Action: run, schedule, queue, cancel, status"),
    test_suite: Optional[str] = Field(default=None, description="Test suite to automate"),
    schedule: Optional[str] = Field(default=None, description="Schedule: on_commit, nightly, weekly, manual"),
    parallel: Optional[bool] = Field(default=None, description="Run tests in parallel"),
    max_workers: Optional[int] = Field(default=None, description="Max parallel workers"),
    notify_on_failure: Optional[bool] = Field(default=None, description="Send notification on failure"),
) -> dict:
    """Test automation and scheduling."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"test_automation {action}"]
        if test_suite:
            cmd_parts.append(f"suite={test_suite}")
        if schedule:
            cmd_parts.append(f"schedule={schedule}")
        if parallel is not None:
            cmd_parts.append(f"parallel={'true' if parallel else 'false'}")
        if max_workers is not None:
            cmd_parts.append(f"workers={max_workers}")
        if notify_on_failure is not None:
            cmd_parts.append(f"notify={'true' if notify_on_failure else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("test_automation failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def test_report(
    action: str = Field(description="Action: generate, list, export, send, history"),
    report_name: Optional[str] = Field(default=None, description="Report name"),
    report_type: Optional[str] = Field(default=None, description="Report type: summary, detailed, regression, trend"),
    output_format: Optional[str] = Field(default=None, description="Output format: html, pdf, json, markdown"),
    date_range: Optional[list[str]] = Field(default=None, description="Date range [start, end]"),
    include_flaky: Optional[bool] = Field(default=None, description="Include flaky tests"),
) -> dict:
    """Test report generation and management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"test_report {action}"]
        if report_name:
            cmd_parts.append(f"name={report_name}")
        if report_type:
            cmd_parts.append(f"type={report_type}")
        if output_format:
            cmd_parts.append(f"format={output_format}")
        if date_range:
            cmd_parts.append(f"range={','.join(date_range)}")
        if include_flaky is not None:
            cmd_parts.append(f"flaky={'true' if include_flaky else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("test_report failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ---------------------------------------------------------------------------
# Save (4)
# ---------------------------------------------------------------------------

@mcp.tool()
async def save_auto(
    action: str = Field(description="Action: enable, disable, configure, trigger, status"),
    interval: Optional[int] = Field(default=None, description="Auto-save interval in seconds"),
    max_slots: Optional[int] = Field(default=None, description="Maximum auto-save slots"),
    notify: Optional[bool] = Field(default=None, description="Show notification on save"),
    compress: Optional[bool] = Field(default=None, description="Compress save data"),
    backup: Optional[bool] = Field(default=None, description="Keep backup of previous save"),
) -> dict:
    """Auto-save system management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"save_auto {action}"]
        if interval is not None:
            cmd_parts.append(f"interval={interval}")
        if max_slots is not None:
            cmd_parts.append(f"max_slots={max_slots}")
        if notify is not None:
            cmd_parts.append(f"notify={'true' if notify else 'false'}")
        if compress is not None:
            cmd_parts.append(f"compress={'true' if compress else 'false'}")
        if backup is not None:
            cmd_parts.append(f"backup={'true' if backup else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("save_auto failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def save_slot(
    action: str = Field(description="Action: save, load, delete, list, preview"),
    slot_index: Optional[int] = Field(default=None, description="Save slot index"),
    slot_name: Optional[str] = Field(default=None, description="Slot display name"),
    player_id: Optional[str] = Field(default=None, description="Player ID"),
    overwrite: Optional[bool] = Field(default=None, description="Allow overwrite existing slot"),
    include_screenshot: Optional[bool] = Field(default=None, description="Save screenshot with slot"),
) -> dict:
    """Manual save slot management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"save_slot {action}"]
        if slot_index is not None:
            cmd_parts.append(f"slot={slot_index}")
        if slot_name:
            cmd_parts.append(f"name={slot_name}")
        if player_id:
            cmd_parts.append(f"player={player_id}")
        if overwrite is not None:
            cmd_parts.append(f"overwrite={'true' if overwrite else 'false'}")
        if include_screenshot is not None:
            cmd_parts.append(f"screenshot={'true' if include_screenshot else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("save_slot failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def save_cloud(
    action: str = Field(description="Action: upload, download, sync, configure, status"),
    player_id: Optional[str] = Field(default=None, description="Player ID"),
    cloud_slot: Optional[int] = Field(default=None, description="Cloud save slot"),
    conflict_resolution: Optional[str] = Field(default=None, description="Conflict resolution: local, cloud, newest, ask"),
    auto_sync: Optional[bool] = Field(default=None, description="Enable auto-sync"),
    encryption: Optional[bool] = Field(default=None, description="Enable save encryption"),
) -> dict:
    """Cloud save synchronization."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"save_cloud {action}"]
        if player_id:
            cmd_parts.append(f"player={player_id}")
        if cloud_slot is not None:
            cmd_parts.append(f"cloud_slot={cloud_slot}")
        if conflict_resolution:
            cmd_parts.append(f"conflict={conflict_resolution}")
        if auto_sync is not None:
            cmd_parts.append(f"auto_sync={'true' if auto_sync else 'false'}")
        if encryption is not None:
            cmd_parts.append(f"encrypt={'true' if encryption else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("save_cloud failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def save_version(
    action: str = Field(description="Action: create, restore, list, compare, migrate"),
    version_name: Optional[str] = Field(default=None, description="Version label"),
    description: Optional[str] = Field(default=None, description="Version description"),
    auto_tag: Optional[bool] = Field(default=None, description="Auto-tag with game state"),
    migration_path: Optional[str] = Field(default=None, description="Migration path for save data"),
    validate: Optional[bool] = Field(default=None, description="Validate save integrity"),
) -> dict:
    """Save versioning and migration."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"save_version {action}"]
        if version_name:
            cmd_parts.append(f"version={version_name}")
        if description:
            cmd_parts.append(f"desc={description}")
        if auto_tag is not None:
            cmd_parts.append(f"auto_tag={'true' if auto_tag else 'false'}")
        if migration_path:
            cmd_parts.append(f"migration={migration_path}")
        if validate is not None:
            cmd_parts.append(f"validate={'true' if validate else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("save_version failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ---------------------------------------------------------------------------
# Social/Networking (6)
# ---------------------------------------------------------------------------

@mcp.tool()
async def net_replicate(
    action: str = Field(description="Action: start, stop, configure, priority, bandwidth"),
    target_actor: Optional[str] = Field(default=None, description="Actor to replicate"),
    replicate: Optional[bool] = Field(default=None, description="Enable replication"),
    replication_mode: Optional[str] = Field(default=None, description="Mode: full, simulated, autonomous"),
    priority: Optional[float] = Field(default=None, description="Replication priority"),
    bandwidth: Optional[int] = Field(default=None, description="Max bandwidth bytes/s"),
) -> dict:
    """Network replication management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"net_replicate {action}"]
        if target_actor:
            cmd_parts.append(f"target={target_actor}")
        if replicate is not None:
            cmd_parts.append(f"replicate={'true' if replicate else 'false'}")
        if replication_mode:
            cmd_parts.append(f"mode={replication_mode}")
        if priority is not None:
            cmd_parts.append(f"priority={priority}")
        if bandwidth is not None:
            cmd_parts.append(f"bandwidth={bandwidth}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("net_replicate failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def net_session(
    action: str = Field(description="Action: create, join, leave, list, configure, destroy"),
    session_name: Optional[str] = Field(default=None, description="Session name"),
    max_players: Optional[int] = Field(default=None, description="Max players"),
    session_type: Optional[str] = Field(default=None, description="Type: public, private, friends, dedicated"),
    region: Optional[str] = Field(default=None, description="Server region"),
    password: Optional[str] = Field(default=None, description="Session password"),
) -> dict:
    """Online session management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"net_session {action}"]
        if session_name:
            cmd_parts.append(f"session={session_name}")
        if max_players is not None:
            cmd_parts.append(f"max_players={max_players}")
        if session_type:
            cmd_parts.append(f"type={session_type}")
        if region:
            cmd_parts.append(f"region={region}")
        if password:
            cmd_parts.append(f"password={password}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("net_session failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def net_chat(
    action: str = Field(description="Action: send, history, configure, mute, emote"),
    channel: Optional[str] = Field(default=None, description="Chat channel: global, team, party, whisper, system"),
    message: Optional[str] = Field(default=None, description="Chat message"),
    target_player: Optional[str] = Field(default=None, description="Target player for whisper"),
    emote: Optional[str] = Field(default=None, description="Chat emote"),
    mute_duration: Optional[int] = Field(default=None, description="Mute duration in seconds"),
) -> dict:
    """In-game chat system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"net_chat {action}"]
        if channel:
            cmd_parts.append(f"channel={channel}")
        if message:
            cmd_parts.append(f"msg={message}")
        if target_player:
            cmd_parts.append(f"target={target_player}")
        if emote:
            cmd_parts.append(f"emote={emote}")
        if mute_duration is not None:
            cmd_parts.append(f"mute_duration={mute_duration}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("net_chat failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def net_lobby(
    action: str = Field(description="Action: create, join, leave, list, configure, ready"),
    lobby_name: Optional[str] = Field(default=None, description="Lobby name"),
    max_players: Optional[int] = Field(default=None, description="Max players"),
    lobby_type: Optional[str] = Field(default=None, description="Type: ranked, casual, custom, tournament"),
    region: Optional[str] = Field(default=None, description="Server region"),
    password: Optional[str] = Field(default=None, description="Lobby password"),
    auto_start: Optional[bool] = Field(default=None, description="Auto-start when full"),
) -> dict:
    """Multiplayer lobby management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"net_lobby {action}"]
        if lobby_name:
            cmd_parts.append(f"lobby={lobby_name}")
        if max_players is not None:
            cmd_parts.append(f"max_players={max_players}")
        if lobby_type:
            cmd_parts.append(f"type={lobby_type}")
        if region:
            cmd_parts.append(f"region={region}")
        if password:
            cmd_parts.append(f"password={password}")
        if auto_start is not None:
            cmd_parts.append(f"auto_start={'true' if auto_start else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("net_lobby failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def net_match(
    action: str = Field(description="Action: find, join, leave, status, configure"),
    matchmaking_type: Optional[str] = Field(default=None, description="Type: ranked, casual, custom, tournament"),
    skill_rating: Optional[int] = Field(default=None, description="Player skill rating"),
    max_wait: Optional[int] = Field(default=None, description="Max wait time in seconds"),
    region: Optional[str] = Field(default=None, description="Preferred region"),
    ping_limit: Optional[int] = Field(default=None, description="Max acceptable ping"),
    party_size: Optional[int] = Field(default=None, description="Party size"),
) -> dict:
    """Matchmaking system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"net_match {action}"]
        if matchmaking_type:
            cmd_parts.append(f"type={matchmaking_type}")
        if skill_rating is not None:
            cmd_parts.append(f"skill={skill_rating}")
        if max_wait is not None:
            cmd_parts.append(f"max_wait={max_wait}")
        if region:
            cmd_parts.append(f"region={region}")
        if ping_limit is not None:
            cmd_parts.append(f"ping={ping_limit}")
        if party_size is not None:
            cmd_parts.append(f"party={party_size}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("net_match failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def net_leaderboard(
    action: str = Field(description="Action: submit, get, list, rank, configure"),
    board_name: Optional[str] = Field(default=None, description="Leaderboard name"),
    player_id: Optional[str] = Field(default=None, description="Player ID"),
    score: Optional[int] = Field(default=None, description="Score to submit"),
    stat_name: Optional[str] = Field(default=None, description="Stat to track"),
    time_range: Optional[str] = Field(default=None, description="Time range: daily, weekly, monthly, all_time"),
    page: Optional[int] = Field(default=None, description="Page number"),
) -> dict:
    """Leaderboard system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"net_leaderboard {action}"]
        if board_name:
            cmd_parts.append(f"board={board_name}")
        if player_id:
            cmd_parts.append(f"player={player_id}")
        if score is not None:
            cmd_parts.append(f"score={score}")
        if stat_name:
            cmd_parts.append(f"stat={stat_name}")
        if time_range:
            cmd_parts.append(f"range={time_range}")
        if page is not None:
            cmd_parts.append(f"page={page}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("net_leaderboard failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ---------------------------------------------------------------------------
# Plugin Core (8)
# ---------------------------------------------------------------------------

@mcp.tool()
async def plugin_settings(
    action: str = Field(description="Action: get, set, list, reset, export"),
    plugin_name: Optional[str] = Field(default=None, description="Plugin name"),
    setting_key: Optional[str] = Field(default=None, description="Setting key"),
    setting_value: Optional[str] = Field(default=None, description="Setting value"),
    category: Optional[str] = Field(default=None, description="Settings category"),
) -> dict:
    """Plugin settings management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"plugin_settings {action}"]
        if plugin_name:
            cmd_parts.append(f"plugin={plugin_name}")
        if setting_key:
            cmd_parts.append(f"key={setting_key}")
        if setting_value:
            cmd_parts.append(f"value={setting_value}")
        if category:
            cmd_parts.append(f"category={category}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("plugin_settings failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def plugin_logs(
    action: str = Field(description="Action: read, clear, filter, export, tail"),
    plugin_name: Optional[str] = Field(default=None, description="Plugin name"),
    log_level: Optional[str] = Field(default=None, description="Log level: debug, info, warning, error, fatal"),
    max_lines: Optional[int] = Field(default=None, description="Max lines to read"),
    search: Optional[str] = Field(default=None, description="Search pattern"),
    since: Optional[str] = Field(default=None, description="Show logs since timestamp"),
) -> dict:
    """Plugin log management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"plugin_logs {action}"]
        if plugin_name:
            cmd_parts.append(f"plugin={plugin_name}")
        if log_level:
            cmd_parts.append(f"level={log_level}")
        if max_lines is not None:
            cmd_parts.append(f"max_lines={max_lines}")
        if search:
            cmd_parts.append(f"search={search}")
        if since:
            cmd_parts.append(f"since={since}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("plugin_logs failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def plugin_analytics(
    action: str = Field(description="Action: track, report, export, configure, flush"),
    event_name: Optional[str] = Field(default=None, description="Event name to track"),
    event_data: Optional[dict] = Field(default=None, description="Event data payload"),
    category: Optional[str] = Field(default=None, description="Analytics category"),
    anonymize: Optional[bool] = Field(default=None, description="Anonymize user data"),
    endpoint: Optional[str] = Field(default=None, description="Analytics endpoint URL"),
) -> dict:
    """Plugin analytics tracking."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"plugin_analytics {action}"]
        if event_name:
            cmd_parts.append(f"event={event_name}")
        if event_data:
            cmd_parts.append(f"data={json.dumps(event_data)}")
        if category:
            cmd_parts.append(f"category={category}")
        if anonymize is not None:
            cmd_parts.append(f"anonymize={'true' if anonymize else 'false'}")
        if endpoint:
            cmd_parts.append(f"endpoint={endpoint}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("plugin_analytics failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def plugin_telemetry(
    action: str = Field(description="Action: start, stop, configure, report, flush"),
    plugin_name: Optional[str] = Field(default=None, description="Plugin name"),
    metrics: Optional[list[str]] = Field(default=None, description="Metrics to collect: fps, memory, network, input"),
    sample_rate: Optional[float] = Field(default=None, description="Sampling rate 0.0-1.0"),
    endpoint: Optional[str] = Field(default=None, description="Telemetry endpoint"),
    privacy_mode: Optional[bool] = Field(default=None, description="Enable privacy-compliant mode"),
) -> dict:
    """Plugin telemetry collection."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"plugin_telemetry {action}"]
        if plugin_name:
            cmd_parts.append(f"plugin={plugin_name}")
        if metrics:
            cmd_parts.append(f"metrics={','.join(metrics)}")
        if sample_rate is not None:
            cmd_parts.append(f"sample_rate={sample_rate}")
        if endpoint:
            cmd_parts.append(f"endpoint={endpoint}")
        if privacy_mode is not None:
            cmd_parts.append(f"privacy={'true' if privacy_mode else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("plugin_telemetry failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def plugin_error(
    action: str = Field(description="Action: report, list, clear, configure, suppress"),
    plugin_name: Optional[str] = Field(default=None, description="Plugin name"),
    error_code: Optional[str] = Field(default=None, description="Error code"),
    message: Optional[str] = Field(default=None, description="Error message"),
    severity: Optional[str] = Field(default=None, description="Severity: low, medium, high, critical"),
    stack_trace: Optional[str] = Field(default=None, description="Stack trace"),
) -> dict:
    """Plugin error handling and reporting."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"plugin_error {action}"]
        if plugin_name:
            cmd_parts.append(f"plugin={plugin_name}")
        if error_code:
            cmd_parts.append(f"code={error_code}")
        if message:
            cmd_parts.append(f"msg={message}")
        if severity:
            cmd_parts.append(f"severity={severity}")
        if stack_trace:
            cmd_parts.append(f"stack={stack_trace}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("plugin_error failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def plugin_recovery(
    action: str = Field(description="Action: checkpoint, restore, verify, auto_recover, status"),
    plugin_name: Optional[str] = Field(default=None, description="Plugin name"),
    checkpoint_id: Optional[str] = Field(default=None, description="Checkpoint ID to restore"),
    auto_recover: Optional[bool] = Field(default=None, description="Enable auto-recovery on crash"),
    verify_integrity: Optional[bool] = Field(default=None, description="Verify checkpoint integrity"),
    max_checkpoints: Optional[int] = Field(default=None, description="Max checkpoints to keep"),
) -> dict:
    """Plugin crash recovery system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"plugin_recovery {action}"]
        if plugin_name:
            cmd_parts.append(f"plugin={plugin_name}")
        if checkpoint_id:
            cmd_parts.append(f"checkpoint={checkpoint_id}")
        if auto_recover is not None:
            cmd_parts.append(f"auto_recover={'true' if auto_recover else 'false'}")
        if verify_integrity is not None:
            cmd_parts.append(f"verify={'true' if verify_integrity else 'false'}")
        if max_checkpoints is not None:
            cmd_parts.append(f"max_checkpoints={max_checkpoints}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("plugin_recovery failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def plugin_update(
    action: str = Field(description="Action: check, install, rollback, list, configure"),
    plugin_name: Optional[str] = Field(default=None, description="Plugin name"),
    version: Optional[str] = Field(default=None, description="Target version"),
    auto_update: Optional[bool] = Field(default=None, description="Enable auto-updates"),
    channel: Optional[str] = Field(default=None, description="Update channel: stable, beta, dev"),
    force: Optional[bool] = Field(default=None, description="Force update even if same version"),
) -> dict:
    """Plugin update management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"plugin_update {action}"]
        if plugin_name:
            cmd_parts.append(f"plugin={plugin_name}")
        if version:
            cmd_parts.append(f"version={version}")
        if auto_update is not None:
            cmd_parts.append(f"auto_update={'true' if auto_update else 'false'}")
        if channel:
            cmd_parts.append(f"channel={channel}")
        if force is not None:
            cmd_parts.append(f"force={'true' if force else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("plugin_update failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def plugin_config(
    action: str = Field(description="Action: get, set, list, validate, export, import"),
    plugin_name: Optional[str] = Field(default=None, description="Plugin name"),
    config_key: Optional[str] = Field(default=None, description="Config key"),
    config_value: Optional[str] = Field(default=None, description="Config value"),
    config_type: Optional[str] = Field(default=None, description="Value type: string, int, float, bool, json"),
    validate: Optional[bool] = Field(default=None, description="Validate config"),
    export_path: Optional[str] = Field(default=None, description="Export path"),
) -> dict:
    """Plugin configuration management."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"plugin_config {action}"]
        if plugin_name:
            cmd_parts.append(f"plugin={plugin_name}")
        if config_key:
            cmd_parts.append(f"key={config_key}")
        if config_value:
            cmd_parts.append(f"value={config_value}")
        if config_type:
            cmd_parts.append(f"type={config_type}")
        if validate is not None:
            cmd_parts.append(f"validate={'true' if validate else 'false'}")
        if export_path:
            cmd_parts.append(f"export={export_path}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("plugin_config failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ---------------------------------------------------------------------------
# Unique Horror (7)
# ---------------------------------------------------------------------------

@mcp.tool()
async def unique_ai_spawn(
    action: str = Field(description="Action: spawn, despawn, configure, behavior, target"),
    entity_type: Optional[str] = Field(default=None, description="AI entity type"),
    behavior: Optional[str] = Field(default=None, description="Behavior: patrol, chase, stalk, hide, ambush"),
    location: Optional[list[float]] = Field(default=None, description="Spawn location [X, Y, Z]"),
    awareness_radius: Optional[float] = Field(default=None, description="Awareness radius"),
    speed: Optional[float] = Field(default=None, description="Movement speed"),
    entity_id: Optional[str] = Field(default=None, description="Unique entity identifier"),
) -> dict:
    """Horror AI entity spawning and behavior."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"unique_ai_spawn {action}"]
        if entity_type:
            cmd_parts.append(f"entity={entity_type}")
        if behavior:
            cmd_parts.append(f"behavior={behavior}")
        if location:
            cmd_parts.append(f"loc={','.join(str(v) for v in location)}")
        if awareness_radius is not None:
            cmd_parts.append(f"awareness={awareness_radius}")
        if speed is not None:
            cmd_parts.append(f"speed={speed}")
        if entity_id:
            cmd_parts.append(f"id={entity_id}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("unique_ai_spawn failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def unique_horror_event(
    action: str = Field(description="Action: trigger, schedule, configure, cancel, chain"),
    event_type: Optional[str] = Field(default=None, description="Event type: ambient, scripted, random, timed"),
    event_id: Optional[str] = Field(default=None, description="Event identifier"),
    location: Optional[list[float]] = Field(default=None, description="Event location [X, Y, Z]"),
    intensity: Optional[float] = Field(default=None, description="Event intensity 0.0-1.0"),
    duration: Optional[float] = Field(default=None, description="Event duration in seconds"),
    cooldown: Optional[float] = Field(default=None, description="Cooldown before retrigger"),
) -> dict:
    """Horror event triggering and scripting."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"unique_horror_event {action}"]
        if event_type:
            cmd_parts.append(f"type={event_type}")
        if event_id:
            cmd_parts.append(f"id={event_id}")
        if location:
            cmd_parts.append(f"loc={','.join(str(v) for v in location)}")
        if intensity is not None:
            cmd_parts.append(f"intensity={intensity}")
        if duration is not None:
            cmd_parts.append(f"duration={duration}")
        if cooldown is not None:
            cmd_parts.append(f"cooldown={cooldown}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("unique_horror_event failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def unique_fear_aura(
    action: str = Field(description="Action: enable, disable, configure, pulse, layer"),
    source: Optional[str] = Field(default=None, description="Fear source actor"),
    radius: Optional[float] = Field(default=None, description="Fear aura radius"),
    intensity: Optional[float] = Field(default=None, description="Fear intensity 0.0-1.0"),
    fear_type: Optional[str] = Field(default=None, description="Fear type: ambient, paranoia, dread, terror"),
    decay_rate: Optional[float] = Field(default=None, description="Fear decay rate"),
    layer: Optional[int] = Field(default=None, description="Fear layer for stacking"),
) -> dict:
    """Fear aura proximity system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"unique_fear_aura {action}"]
        if source:
            cmd_parts.append(f"source={source}")
        if radius is not None:
            cmd_parts.append(f"radius={radius}")
        if intensity is not None:
            cmd_parts.append(f"intensity={intensity}")
        if fear_type:
            cmd_parts.append(f"feartype={fear_type}")
        if decay_rate is not None:
            cmd_parts.append(f"decay={decay_rate}")
        if layer is not None:
            cmd_parts.append(f"layer={layer}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("unique_fear_aura failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def unique_sanity(
    action: str = Field(description="Action: get, set, drain, recover, configure, threshold"),
    target: Optional[str] = Field(default=None, description="Target player"),
    amount: Optional[float] = Field(default=None, description="Sanity amount 0.0-100.0"),
    drain_rate: Optional[float] = Field(default=None, description="Sanity drain rate per second"),
    recovery_rate: Optional[float] = Field(default=None, description="Sanity recovery rate per second"),
    threshold_low: Optional[float] = Field(default=None, description="Low sanity threshold for effects"),
    threshold_crit: Optional[float] = Field(default=None, description="Critical sanity threshold"),
) -> dict:
    """Sanity meter system for horror gameplay."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"unique_sanity {action}"]
        if target:
            cmd_parts.append(f"target={target}")
        if amount is not None:
            cmd_parts.append(f"amount={amount}")
        if drain_rate is not None:
            cmd_parts.append(f"drain={drain_rate}")
        if recovery_rate is not None:
            cmd_parts.append(f"recover={recovery_rate}")
        if threshold_low is not None:
            cmd_parts.append(f"thresh_low={threshold_low}")
        if threshold_crit is not None:
            cmd_parts.append(f"thresh_crit={threshold_crit}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("unique_sanity failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def unique_jumpscare_zone(
    action: str = Field(description="Action: place, remove, configure, trigger, cooldown"),
    location: Optional[list[float]] = Field(default=None, description="Zone center [X, Y, Z]"),
    radius: Optional[float] = Field(default=None, description="Trigger radius"),
    scare_type: Optional[str] = Field(default=None, description="Scare type: visual, audio, combined, hallucination"),
    intensity: Optional[float] = Field(default=None, description="Scare intensity 0.0-1.0"),
    cooldown: Optional[float] = Field(default=None, description="Cooldown between scares"),
    zone_id: Optional[str] = Field(default=None, description="Zone identifier"),
) -> dict:
    """Jump scare trigger zone placement."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"unique_jumpscare_zone {action}"]
        if location:
            cmd_parts.append(f"loc={','.join(str(v) for v in location)}")
        if radius is not None:
            cmd_parts.append(f"radius={radius}")
        if scare_type:
            cmd_parts.append(f"type={scare_type}")
        if intensity is not None:
            cmd_parts.append(f"intensity={intensity}")
        if cooldown is not None:
            cmd_parts.append(f"cooldown={cooldown}")
        if zone_id:
            cmd_parts.append(f"id={zone_id}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("unique_jumpscare_zone failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def unique_darkness(
    action: str = Field(description="Action: enable, disable, configure, flicker, pulse"),
    target_area: Optional[str] = Field(default=None, description="Target area or volume"),
    darkness_level: Optional[float] = Field(default=None, description="Darkness level 0.0-1.0"),
    light_damping: Optional[float] = Field(default=None, description="Light source damping factor"),
    flicker_speed: Optional[float] = Field(default=None, description="Light flicker speed"),
    pulse_intensity: Optional[float] = Field(default=None, description="Darkness pulse intensity"),
    affect_player: Optional[bool] = Field(default=None, description="Affect player vision"),
) -> dict:
    """Dynamic darkness and light manipulation system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"unique_darkness {action}"]
        if target_area:
            cmd_parts.append(f"area={target_area}")
        if darkness_level is not None:
            cmd_parts.append(f"level={darkness_level}")
        if light_damping is not None:
            cmd_parts.append(f"damping={light_damping}")
        if flicker_speed is not None:
            cmd_parts.append(f"flicker={flicker_speed}")
        if pulse_intensity is not None:
            cmd_parts.append(f"pulse={pulse_intensity}")
        if affect_player is not None:
            cmd_parts.append(f"affect_player={'true' if affect_player else 'false'}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("unique_darkness failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


@mcp.tool()
async def unique_sound_trigger(
    action: str = Field(description="Action: place, remove, configure, trigger, layer"),
    location: Optional[list[float]] = Field(default=None, description="Trigger location [X, Y, Z]"),
    radius: Optional[float] = Field(default=None, description="Trigger radius"),
    sound_type: Optional[str] = Field(default=None, description="Sound type: whisper, scream, ambient, footstep, creak, music"),
    volume: Optional[float] = Field(default=None, description="Volume 0.0-1.0"),
    spatial: Optional[bool] = Field(default=None, description="Enable spatial audio"),
    trigger_id: Optional[str] = Field(default=None, description="Trigger identifier"),
    layer: Optional[int] = Field(default=None, description="Audio layer"),
) -> dict:
    """Spatial horror sound trigger system."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"unique_sound_trigger {action}"]
        if location:
            cmd_parts.append(f"loc={','.join(str(v) for v in location)}")
        if radius is not None:
            cmd_parts.append(f"radius={radius}")
        if sound_type:
            cmd_parts.append(f"type={sound_type}")
        if volume is not None:
            cmd_parts.append(f"volume={volume}")
        if spatial is not None:
            cmd_parts.append(f"spatial={'true' if spatial else 'false'}")
        if trigger_id:
            cmd_parts.append(f"id={trigger_id}")
        if layer is not None:
            cmd_parts.append(f"layer={layer}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("unique_sound_trigger failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ---------------------------------------------------------------------------
# Texture (1)
# ---------------------------------------------------------------------------

@mcp.tool()
async def texture_scout(
    action: str = Field(description="Action: scan, audit, report, optimize, batch"),
    scan_path: Optional[str] = Field(default=None, description="Path to scan for textures"),
    resolution_limit: Optional[int] = Field(default=None, description="Max resolution threshold"),
    format: Optional[str] = Field(default=None, description="Texture format: png, tga, jpg, exr, hdr"),
    format_check: Optional[bool] = Field(default=None, description="Check format compliance"),
    size_check: Optional[bool] = Field(default=None, description="Check texture size limits"),
    mip_check: Optional[bool] = Field(default=None, description="Check mip chain"),
    compress_check: Optional[bool] = Field(default=None, description="Check compression settings"),
    report_format: Optional[str] = Field(default=None, description="Report format: text, json, csv"),
) -> dict:
    """Texture audit and optimization scout."""
    global ue5_client
    if not ue5_client or not ue5_client.is_connected:
        return ToolResponse(success=False, error="UE5 not connected").model_dump()
    try:
        cmd_parts = [f"texture_scout {action}"]
        if scan_path:
            cmd_parts.append(f"path={scan_path}")
        if resolution_limit is not None:
            cmd_parts.append(f"res_limit={resolution_limit}")
        if format:
            cmd_parts.append(f"format={format}")
        if format_check is not None:
            cmd_parts.append(f"format_check={'true' if format_check else 'false'}")
        if size_check is not None:
            cmd_parts.append(f"size_check={'true' if size_check else 'false'}")
        if mip_check is not None:
            cmd_parts.append(f"mip_check={'true' if mip_check else 'false'}")
        if compress_check is not None:
            cmd_parts.append(f"compress_check={'true' if compress_check else 'false'}")
        if report_format:
            cmd_parts.append(f"report={report_format}")
        result = await ue5_client.send_command({"type": "console_command", "command": " ".join(cmd_parts)})
        return ToolResponse(success=True, data=result).model_dump()
    except Exception as e:
        logger.error("texture_scout failed: %s", e)
        return ToolResponse(success=False, error=str(e)).model_dump()


# ============================================================================
# LIFECYCLE MANAGEMENT
# ============================================================================


async def initialize_ue5_client():
    """Initialize and connect the UE5 HTTP client."""
    global ue5_client
    try:
        ue5_client = UE5Client(
            host=config["ue5_host"],
            port=config["ue5_port"],
            auto_reconnect=config["auto_reconnect"],
        )
        await ue5_client.connect()
        logger.info("Connected to UE5 Editor at http://%s:%d", config["ue5_host"], config["ue5_port"])
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
