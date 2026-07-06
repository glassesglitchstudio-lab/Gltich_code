import * as vscode from "vscode"
import * as path from "path"
import { GlitchClient } from "../sdk"

export class ChatProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "glitch.chat"

  private view?: vscode.WebviewView
  private client: GlitchClient
  private sessionId?: string
  private disposables: vscode.Disposable[] = []

  constructor(
    private extensionUri: vscode.Uri,
    client: GlitchClient,
  ) {
    this.client = client
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    }

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview)

    // Handle messages from webview
    this.disposables.push(
      webviewView.webview.onDidReceiveMessage(async (message) => {
        switch (message.type) {
          case "send":
            await this.handleSendMessage(message.content)
            break
          case "newSession":
            await this.handleNewSession()
            break
          case "selectSession":
            await this.handleSelectSession(message.sessionId)
            break
        }
      }),
    )

    // Clean up
    webviewView.onDidDispose(() => {
      this.disposables.forEach((d) => d.dispose())
    })
  }

  private async handleSendMessage(content: string): Promise<void> {
    if (!this.view) return

    // Create session if needed
    if (!this.sessionId) {
      const session = await this.client.createSession()
      this.sessionId = session.id
    }

    // Send message to webview
    this.view.webview.postMessage({ type: "userMessage", content })

    // Stream response
    let response = ""
    try {
      for await (const chunk of this.client.sendMessage(this.sessionId, content)) {
        response += chunk
        this.view.webview.postMessage({ type: "assistantChunk", content: chunk })
      }
      this.view.webview.postMessage({ type: "assistantDone" })
    } catch (error) {
      this.view.webview.postMessage({
        type: "error",
        content: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  private async handleNewSession(): Promise<void> {
    const session = await this.client.createSession()
    this.sessionId = session.id
    this.view?.webview.postMessage({ type: "sessionCreated", sessionId: session.id })
  }

  private async handleSelectSession(sessionId: string): Promise<void> {
    this.sessionId = sessionId
    this.view?.webview.postMessage({ type: "sessionSelected", sessionId })
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "src", "chat", "template.html"),
    )

    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Glitch Chat</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    .header {
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header h3 { font-size: 12px; font-weight: 600; }

    .header-actions { display: flex; gap: 4px; }

    .btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 8px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 11px;
    }
    .btn:hover { background: var(--vscode-button-hoverBackground); }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .message {
      margin-bottom: 12px;
      padding: 8px 12px;
      border-radius: 4px;
      max-width: 90%;
    }

    .user {
      background: var(--vscode-input-background);
      margin-left: auto;
    }

    .assistant {
      background: var(--vscode-editor-background);
    }

    .message-content {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 13px;
      line-height: 1.5;
    }

    .typing {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      font-size: 12px;
    }

    .input-area {
      padding: 8px 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .input-row {
      display: flex;
      gap: 8px;
    }

    .input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 6px 8px;
      border-radius: 2px;
      font-family: inherit;
      font-size: 13px;
      resize: none;
    }
    .input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    .send-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      border-radius: 2px;
      cursor: pointer;
    }
    .send-btn:hover { background: var(--vscode-button-hoverBackground); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="header">
    <h3>Glitch Chat</h3>
    <div class="header-actions">
      <button class="btn" id="newSession">+ New</button>
    </div>
  </div>

  <div class="messages" id="messages">
    <div class="message assistant">
      <div class="message-content">Merhaba! Ben Glitch Code AI. Size nasıl yardımcı olabilirim?</div>
    </div>
  </div>

  <div class="input-area">
    <div class="input-row">
      <textarea class="input" id="input" placeholder="Mesajınızı yazın..." rows="2"></textarea>
      <button class="send-btn" id="sendBtn">Gönder</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    const newSessionBtn = document.getElementById('newSession');

    let currentMessage = null;

    function addMessage(role, content) {
      const div = document.createElement('div');
      div.className = 'message ' + role;
      div.innerHTML = '<div class="message-content">' + escapeHtml(content) + '</div>';
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function sendMessage() {
      const content = inputEl.value.trim();
      if (!content) return;

      addMessage('user', content);
      inputEl.value = '';

      currentMessage = addMessage('assistant', '');
      sendBtn.disabled = true;

      vscode.postMessage({ type: 'send', content });
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    newSessionBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'newSession' });
      messagesEl.innerHTML = '';
      addMessage('assistant', 'Yeni oturum başlatıldı. Size nasıl yardımcı olabilirim?');
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'userMessage':
          // Already handled locally
          break;

        case 'assistantChunk':
          if (currentMessage) {
            const contentEl = currentMessage.querySelector('.message-content');
            contentEl.textContent += msg.content;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
          break;

        case 'assistantDone':
          sendBtn.disabled = false;
          currentMessage = null;
          break;

        case 'error':
          if (currentMessage) {
            const contentEl = currentMessage.querySelector('.message-content');
            contentEl.textContent = 'Hata: ' + msg.content;
            contentEl.style.color = 'var(--vscode-errorForeground)';
          }
          sendBtn.disabled = false;
          currentMessage = null;
          break;

        case 'sessionCreated':
          console.log('Session created:', msg.sessionId);
          break;
      }
    });
  </script>
</body>
</html>`
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose())
  }
}
