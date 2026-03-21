#!/usr/bin/env node

import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { URL } from 'url';
import crypto from 'crypto';
import qrcode from 'qrcode-terminal';
import { Client } from 'ssh2';
import { WebSocketServer } from 'ws';

/**
 * Net-Vim Bridge CLI (Node.js version)
 * A pure Node.js implementation of the Net-Vim file system bridge.
 */

const args = process.argv.slice(2);
const port = parseInt(args[0] || '8080', 10);
const rootDir = path.resolve(args[1] || process.cwd());
const key = crypto.randomUUID();
const sshSessions = new Map();
const wss = new WebSocketServer({ noServer: true });

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Bridge-Key');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Authentication
  const authHeader = req.headers['x-bridge-key'];
  if (authHeader !== key) {
    res.writeHead(401, { 'Content-Type': 'text/plain' });
    res.end('Unauthorized (Invalid X-Bridge-Key)');
    return;
  }

  try {
    const parsedUrl = new URL(req.url, `http://localhost:${port}`);
    const relPath = (parsedUrl.searchParams.get('path') || '').replace(/^\/+/, '');
    const fullPath = path.join(rootDir, relPath);

    // Security: Ensure the path is within the root directory
    if (!fullPath.startsWith(rootDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden: Path outside of root directory');
      return;
    }

    if (parsedUrl.pathname === '/ls' && req.method === 'GET') {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const result = entries.map(entry => entry.isDirectory() ? `${entry.name}/` : entry.name);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } 
    else if (parsedUrl.pathname === '/cat' && req.method === 'GET') {
      try {
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Path is a directory');
          return;
        }
        const content = await fs.readFile(fullPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(content);
      } catch (e) {
        if (e.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('File not found');
        } else {
          throw e;
        }
      }
    } 
    else if (parsedUrl.pathname === '/write' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          // Ensure parent directory exists
          const parent = path.dirname(fullPath);
          await fs.mkdir(parent, { recursive: true });

          await fs.writeFile(fullPath, body, 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
        } catch (e) {
          console.error(`Failed to write file ${fullPath}:`, e);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Failed to write file: ${e.message}`);
        }
      });
    } 
    else if (parsedUrl.pathname === '/is_dir' && req.method === 'GET') {
      try {
        const stats = await fs.stat(fullPath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ is_dir: stats.isDirectory() }));
      } catch (e) {
        if (e.code === 'ENOENT') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ is_dir: false }));
        } else {
          throw e;
        }
      }
    } 
    else if (parsedUrl.pathname === '/ssh_connect' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { host, port, username, password, key: privateKey } = JSON.parse(body);
          if (!host) throw new Error("Host is required");

          const sessionId = crypto.randomUUID();
          
          const conn = new Client();
          conn.on('ready', () => {
            sshSessions.set(sessionId, { conn, status: 'connected', buffer: [] });
            // Cleanup on timeout if not upgraded to WS
            setTimeout(() => {
              if (sshSessions.has(sessionId) && !sshSessions.get(sessionId).ws) {
                conn.end();
                sshSessions.delete(sessionId);
              }
            }, 30000); // 30s timeout
          }).on('error', (err) => {
            console.error('SSH Connection Error:', err);
            sshSessions.set(sessionId, { status: 'error', error: err.message });
          }).connect({
            host,
            port: parseInt(port || '22', 10),
            username: username || process.env.USER || 'root',
            privateKey: privateKey,
            password: password,
            readyTimeout: 20000,
          });

          // Wait for connection or error
          let checks = 0;
          const checkInterval = setInterval(() => {
            const session = sshSessions.get(sessionId);
            if (session) {
              if (session.status === 'connected') {
                clearInterval(checkInterval);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ sessionId }));
              } else if (session.status === 'error') {
                clearInterval(checkInterval);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: session.error }));
                sshSessions.delete(sessionId);
              }
            }
            checks++;
            if (checks > 40) { // 4s timeout for initial handshake
               clearInterval(checkInterval);
               res.writeHead(504, { 'Content-Type': 'text/plain' });
               res.end("Gateway Timeout: SSH Handshake took too long");
               if(session && session.conn) session.conn.end();
               else conn.end();
               sshSessions.delete(sessionId);
            }
          }, 100);

        } catch (e) {
          console.error("SSH Connect Error:", e);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    }
    else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  } catch (err) {
    console.error(`Error processing ${req.method} ${req.url}:`, err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Internal Server Error: ${err.message}`);
  }
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://localhost:${port}`).pathname;

  if (pathname === '/ssh_ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      const url = new URL(request.url, `http://localhost:${port}`);
      const sessionId = url.searchParams.get('sessionId');
      
      const session = sshSessions.get(sessionId);
      if (!sessionId || !session || !session.conn) {
        ws.close(1008, 'Invalid Session ID');
        return;
      }
      
      session.ws = ws;
      
      // Setup stream
      session.conn.shell((err, stream) => {
        if (err) {
           ws.close(1011, 'Failed to open shell');
           return;
        }
        
        ws.on('message', (message) => {
          stream.write(message);
        });
        
        stream.on('data', (data) => {
           ws.send(data.toString());
        });
        
        stream.on('close', () => {
           ws.close();
           session.conn.end();
           sshSessions.delete(sessionId);
        });
        
        ws.on('close', () => {
           stream.end();
           session.conn.end();
           sshSessions.delete(sessionId);
        });
      });
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log("\n====================================================");
  console.log(`Bridge server (Node.js) running on http://0.0.0.0:${port}`);
  console.log(`Root Directory: ${rootDir}`);
  console.log(`Bridge Security Key: ${key}`);
  console.log("\nScan to copy the Security Key:");
  qrcode.generate(key, { small: true });
  console.log("\nTo connect from Net-Vim, use command:");
  console.log(`:ed bridge ${port} ${key}`);
  console.log("====================================================\n");
});

let isShuttingDown = false;

const handleExit = (signal) => {
  if (isShuttingDown) {
    console.log(`\nReceived ${signal} again. Exiting immediately...`);
    process.exit(1);
  }
  isShuttingDown = true;
  console.log(`\nReceived ${signal}. Shutting down bridge server...`);
  
  // Set a timeout to force exit if it takes too long
  const forceExitTimeout = setTimeout(() => {
    console.log('Shutdown timed out. Exiting immediately...');
    process.exit(1);
  }, 3000);
  forceExitTimeout.unref();

  server.close(() => {
    clearTimeout(forceExitTimeout);
    console.log('Bridge server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));
