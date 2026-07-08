# Glitch Code + UE5 MCP Server

MCP (Model Context Protocol) server for integrating Glitch Code with Unreal Engine 5 Editor.

## Features

### UE5 Tools
- **spawn_actor** - Spawn actors in the level with custom class, location, rotation, and scale
- **list_actors** - List all actors with optional class/name filtering
- **edit_blueprint** - Modify Blueprint graphs by adding/modifying nodes and connections
- **compile_blueprint** - Compile Blueprint assets
- **screenshot** - Capture viewport screenshots at custom resolution
- **run_console_command** - Execute UE5 console commands

### Glitch Code Tools
- **bash** - Execute shell commands
- **read_file** - Read file contents with offset/limit
- **write_file** - Write or append to files
- **edit_file** - String replacement in files
- **grep_search** - Regex content search across files
- **glob_search** - Find files by glob pattern

## Prerequisites

- Python 3.10+
- Unreal Engine 5 with WebSocket plugin enabled
- UE5 Editor running on `localhost:9877`

## Setup

### 1. Install Dependencies

```bash
cd glitch-code/unreal/mcp-server
pip install -r requirements.txt
```

### 2. Configure UE5 WebSocket

In your UE5 project, enable the WebSocket plugin:
1. Edit → Plugins
2. Search for "WebSocket"
3. Enable the plugin
4. Restart the editor

Or add to your `DefaultEngine.ini`:
```ini
[WebSockets]
Enabled=true
Port=9877
```

### 3. Configure MCP Server

Edit `config.json` to match your setup:

```json
{
  "ue5_host": "localhost",
  "ue5_port": 9877,
  "glitch_code_path": "glitch",
  "auto_reconnect": true
}
```

### 4. Start the Server

```bash
python server.py
```

The server will start and attempt to connect to UE5 Editor. UE5 tools will be unavailable if the editor is not running.

## Usage

### With MiMoCode

Add to your MCP settings:

```json
{
  "mcpServers": {
    "glitch-ue5": {
      "command": "python",
      "args": ["C:/Users/ErCuM/CascadeProjects/glitch-code/unreal/mcp-server/server.py"]
    }
  }
}
```

### Direct Tool Calls

```python
# Spawn an actor
await spawn_actor(
    actor_class="StaticMeshActor",
    name="MyCube",
    location=[100, 200, 0],
    static_mesh="/Game/Meshes/Cube"
)

# Run a console command
await run_console_command("stat fps")

# Read a file
await read_file("C:/path/to/file.py", offset=0, limit=100)
```

## Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   MCP Server    │◄──────────────────►│   UE5 Editor    │
│  (server.py)    │      :9877         │  (WS Plugin)    │
└────────┬────────┘                    └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Glitch Code    │
│  (File Tools)   │
└─────────────────┘
```

## Error Handling

- Automatic reconnection to UE5 (configurable)
- Command timeout protection (30s default)
- Graceful shutdown on SIGINT/SIGTERM
- Logging to `mcp_server.log`

## Logging

Logs are written to both stderr and `mcp_server.log`. Set log level in `server.py`:

```python
logging.basicConfig(level=logging.DEBUG)  # For verbose output
```
