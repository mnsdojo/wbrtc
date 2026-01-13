import type { ServerWebSocket } from "bun";
import { join } from "path";

/**
 * P2P Swift Server v5.0
 * Combined signaling server + static file serving
 */

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = join(import.meta.dir, "../client");

// MIME types for static files
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// WebSocket client management
const clients = new Map<ServerWebSocket, { id: number; role?: "polite" | "impolite" }>();
let nextId = 1;

console.log(`🚀 P2P Swift Server v5.0 Starting on port ${PORT}...`);

Bun.serve({
  port: PORT,
  
  async fetch(req, server) {
    const url = new URL(req.url);
    
    // WebSocket upgrade for /ws path
    if (url.pathname === "/ws") {
      if (server.upgrade(req)) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    
    // Serve static files
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const fullPath = join(PUBLIC_DIR, filePath);
    
    try {
      const file = Bun.file(fullPath);
      if (await file.exists()) {
        const ext = filePath.substring(filePath.lastIndexOf("."));
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        return new Response(file, {
          headers: { "Content-Type": contentType }
        });
      }
    } catch {
      // File not found, fall through
    }
    
    return new Response("Not Found", { status: 404 });
  },
  
  websocket: {
    open(ws) {
      if (clients.size >= 2) {
        ws.send(JSON.stringify({ type: "error", message: "Server is full (max 2 clients)" }));
        ws.close();
        return;
      }

      const id = nextId++;
      clients.set(ws, { id });
      console.log(`👤 Client joined: ID ${id} (Total: ${clients.size})`);

      if (clients.size === 2) {
        console.log("🔗 Pairing clients and assigning roles...");
        const entries = Array.from(clients.entries());
        const [client1, client2] = entries;
        
        if (client1 && client2) {
          client1[1].role = "impolite";
          client2[1].role = "polite";

          entries.forEach(([socket, info]) => {
            socket.send(JSON.stringify({
              type: "init",
              id: info.id,
              role: info.role
            }));
          });
        }
      }
    },
    
    message(ws, message) {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "ping") return;

        for (const [client] of clients) {
          if (client !== ws) {
            client.send(message);
          }
        }
      } catch (err) {
        console.error("❌ Message relay error:", err);
      }
    },
    
    close(ws) {
      const info = clients.get(ws);
      clients.delete(ws);
      console.log(`👋 Client left: ID ${info?.id} (Remaining: ${clients.size})`);

      if (clients.size === 0) nextId = 1;

      for (const [client] of clients) {
        client.send(JSON.stringify({ type: "reset" }));
      }
    }
  }
});

console.log(`✅ Server ready at http://localhost:${PORT}`);
console.log(`📁 Serving static files from: ${PUBLIC_DIR}`);
