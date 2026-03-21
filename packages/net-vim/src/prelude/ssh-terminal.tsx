
// @ts-nocheck
export default {
  metadata: {
    name: "ssh-terminal",
    description: "SSH Terminal access for Net-Vim"
  },
  setup: async (api: any) => {
    api.log("SSH Terminal plugin loading...");

    let activeTerm: any = null;
    let currentSSH: any = null;

    const getColor = (color: number | string) => {
      // Basic ANSI colors
      if (typeof color === 'string') return color;
      const colors = [
        '#000000', '#cd0000', '#00cd00', '#cdcd00', '#0000ee', '#cd00cd', '#00cdcd', '#e5e5e5',
        '#7f7f7f', '#ff0000', '#00ff00', '#ffff00', '#5c5cff', '#ff00ff', '#00ffff', '#ffffff'
      ];
      return colors[color] || '#ffffff';
    };

    api.registerLineRenderer({
      name: 'ssh-terminal-renderer',
      priority: 30,
      render: ({ lineIndex, currentFilePath }: any) => {
        const path = typeof currentFilePath === 'function' ? currentFilePath() : currentFilePath;
        if (!path || !path.startsWith('term://')) return null;

        const idx = typeof lineIndex === 'function' ? lineIndex() : lineIndex;
        if (!activeTerm) return null;

        const line = activeTerm.buffer.active.getLine(idx);
        if (!line) return null;

        const tokens = [];
        let currentText = "";
        let currentColor = null;
        let currentBg = null;

        for (let i = 0; i < line.length; i++) {
          const cell = line.getCell(i);
          if (!cell) continue;

          const char = cell.getChars();
          const fg = cell.getFgColor();
          const bg = cell.getBgColor();
          
          const fgColor = getColor(fg);
          const bgColor = bg === -1 ? undefined : getColor(bg);

          if (fgColor !== currentColor || bgColor !== currentBg) {
            if (currentText) {
              tokens.push({ x: i - currentText.length, content: currentText, color: currentColor, bg_color: currentBg });
            }
            currentText = char || " ";
            currentColor = fgColor;
            currentBg = bgColor;
          } else {
            currentText += char || " ";
          }
        }
        if (currentText) {
          tokens.push({ x: line.length - currentText.length, content: currentText, color: currentColor, bg_color: currentBg });
        }

        return tokens.map(t => (
          <tui-text x={t.x} y={0} content={t.content} color={t.color} bg_color={t.bg_color} />
        ));
      }
    });

    api.registerCommand("ssh", async (args: string[]) => {
      const host = args[0];
      const port = args[1] || "22";
      
      if (!host) {
        api.log("Usage: :ssh <host> [port]");
        return;
      }

      api.log(`Connecting to ${host}:${port}...`);
      
      // Load xterm.js
      if (!activeTerm) {
        try {
          const { Terminal } = await import("https://esm.sh/@xterm/xterm");
          activeTerm = new Terminal({
            cols: 80,
            rows: 24
          });
          activeTerm.onTitleChange((title: string) => {
            api.log("Terminal Title: " + title);
          });
        } catch (err) {
          api.log("Failed to load xterm.js: " + err.message);
          return;
        }
      }

      // Read keys
      const fs = api.getFS();
      let privateKey = null;
      try {
        privateKey = await fs.readFile(".ssh/id_rsa");
        if (!privateKey) privateKey = await fs.readFile(".ssh/id_ed25519");
      } catch (e) {}

      // Create a virtual buffer
      const termPath = `term://${host}`;
      api.executeCommand(`e ${termPath}`);
      
      // Mock Terminal content for now
      activeTerm.write(`Connecting to ${host}:${port}...\r\n`);
      if (privateKey) {
        activeTerm.write("Found SSH key in .ssh/\r\n");
      }

      // Update Vim buffer to match xterm.js
      const updateBuffer = () => {
        const buffer = [];
        for (let i = 0; i < activeTerm.rows; i++) {
          const line = activeTerm.buffer.active.getLine(i);
          buffer.push(line ? line.translateToString() : "");
        }
        api.setBuffer(buffer);
        // Sync cursor
        const { cursorX, cursorY } = activeTerm.buffer.active;
        api.setCursor(cursorX, cursorY);
      };

      activeTerm.onData((data: string) => {
        // Send data to SSH connection (to be implemented)
        // if (ws && ws.readyState === WebSocket.OPEN) {
        //   ws.send(data);
        // }
      });

      // Dummy output loop to show it's working
      activeTerm.write("\r\n\x1b[32mSSH Terminal Mock\x1b[0m\r\n");
      activeTerm.write("Type characters in \x1b[1mInsert Mode\x1b[0m to interact.\r\n");
      activeTerm.write("Press \x1b[1mEscape\x1b[0m to return to Normal Mode.\r\n");
      activeTerm.write("$ ");
      
      updateBuffer();

      let lastMode = api.getMode();

      // Intercept keys
      const keyHandler = (data: any) => {
        const path = api.getCurrentFilePath();
        if (path && path.startsWith('term://')) {
          if (api.getMode() === 'Insert') {
            let termKey = data.key;
            if (termKey === 'Enter') termKey = '\r';
            else if (termKey === 'Backspace') termKey = '\x7f';
            else if (termKey === 'Tab') termKey = '\t';
            else if (termKey === 'ArrowUp') termKey = '\x1b[A';
            else if (termKey === 'ArrowDown') termKey = '\x1b[B';
            else if (termKey === 'ArrowRight') termKey = '\x1b[C';
            else if (termKey === 'ArrowLeft') termKey = '\x1b[D';
            else if (termKey.length > 1 && !data.ctrl) return; // Ignore other special keys
            
            if (data.ctrl) {
              const code = termKey.toLowerCase().charCodeAt(0) - 96;
              if (code >= 1 && code <= 26) {
                termKey = String.fromCharCode(code);
              }
            }

            activeTerm.write(termKey);
            // We'll update the buffer on the next tick to avoid race conditions with Vim's own insertion
            setTimeout(updateBuffer, 0);
          }
        }
      };

      api.on("KeyDown", keyHandler);
      
      // Setup SSH connection via bridge if available
      const currentFS = api.getFS();
      const bridgeUrl = currentFS.baseUrl || `http://localhost:8080`;
      const bridgeKey = currentFS.apiKey;

      try {
        const headers: any = { 'Content-Type': 'application/json' };
        if (bridgeKey) headers['X-Bridge-Key'] = bridgeKey;

        const response = await fetch(`${bridgeUrl}/ssh_connect`, {
          method: 'POST',
          body: JSON.stringify({ host, port, key: privateKey }),
          headers
        });
        
        if (response.ok) {
           const { sessionId } = await response.json();
           api.log(`SSH session established: ${sessionId}`);
           
           // Start WebSocket for SSH data
           const wsUrl = bridgeUrl.replace(/^http/, 'ws');
           const ws = new WebSocket(`${wsUrl}/ssh_ws?sessionId=${sessionId}`);
           ws.onmessage = (msg) => {
             activeTerm.write(msg.data);
             updateBuffer();
           };
           
           activeTerm.onData((data: string) => {
             ws.send(data);
           });
        } else {
           api.log("SSH Bridge connection failed. Running in offline mock mode.");
        }
      } catch (err) {
        api.log("SSH Bridge not found. Running in offline mock mode.");
      }
    });
  }
};
