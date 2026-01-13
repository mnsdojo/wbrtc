# P2P Swift

> ⚡ Fast, direct, and secure browser-to-browser file transfers using WebRTC

P2P Swift enables direct file transfers between two browsers without uploading to a server. Files are transferred peer-to-peer using WebRTC data channels.

## Features

- 🚀 **Direct P2P Transfer** - No server upload, files go directly between browsers
- 🔒 **End-to-End Encrypted** - WebRTC provides encryption by default
- 📦 **No File Size Limit** - Transfer files of any size
- 🌐 **Works in Browser** - No installation required
- ⚡ **Built with Bun** - Ultra-fast server runtime

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.0 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/mnsdojo/wbrtc.git
cd wbrtc/server

# Install dependencies
bun install
```

### Development

```bash
# Run with hot reload
bun run dev
```

### Production

```bash
# Start the server
bun run start
```

The app will be available at `http://localhost:3000`

## Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run start` | Start production server |
| `bun run build` | Build for production |
| `bun run typecheck` | Run TypeScript type checking |

## Deployment

### Railway

```bash
railway login
railway init
railway up
```

### Other Platforms

The server can be deployed to any platform that supports Bun or Node.js:
- Render
- Fly.io
- DigitalOcean App Platform
- Vercel (with Bun runtime)

Set the `PORT` environment variable if required by your platform.

## How It Works

1. Two clients connect to the signaling server
2. Server assigns roles (polite/impolite) for WebRTC negotiation
3. Clients establish a direct P2P connection via WebRTC
4. Files are transferred directly between browsers

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Signaling**: WebSocket
- **P2P**: WebRTC Data Channels
- **Frontend**: Vanilla JS, CSS

## License

MIT
