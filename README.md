# wbrtc

Send files directly between browsers. No upload, no cloud storage, just peer-to-peer.

Built with Bun + WebRTC.

## What is this?

A simple file transfer app that connects two browsers and lets them send files directly to each other. The server only handles the initial "handshake" (signaling) - after that, data flows directly between peers.

## Run it locally

```bash
cd server
bun install
bun run dev
```

Open `http://localhost:3000` in two browser tabs. That's it.

## Deploy

Push to GitHub, connect to Render, done. There's a `Dockerfile` and `render.yaml` ready to go.

Or run it anywhere that supports Docker:

```bash
docker build -t wbrtc .
docker run -p 3000:3000 wbrtc
```

## Scripts

```bash
bun run dev      # dev server with hot reload
bun run start    # production
bun run build    # compile to dist/
```

## How it works

1. Two clients connect to the signaling server via WebSocket
2. Server pairs them and assigns WebRTC roles
3. Clients establish a direct P2P connection
4. Files transfer browser-to-browser, server doesn't see them

## Stack

- Bun (server runtime)
- WebSocket (signaling)
- WebRTC Data Channels (file transfer)
- Vanilla JS frontend
