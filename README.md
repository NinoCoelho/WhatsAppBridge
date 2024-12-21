# WhatsApp Bridge

Private WhatsApp Web API Bridge for automated messaging and interactions.

## Features

- WhatsApp Web client integration with session persistence
- RESTful API endpoints for:
  - Message handling (send, reply, react, delete)
  - Chat management
  - Webhook subscriptions
  - Media handling
- Secure authentication with API keys
- Rate limiting and CORS protection
- Swagger API documentation

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Chrome/Chromium browser
- WhatsApp account

## Installation

1. Clone the repository:
```bash
git clone [your-repository-url]
cd whatsapp-bridge
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```env
# Server Configuration
PORT=3000        # Port to run the server on
HOST=localhost   # Host to bind the server to
LOG_LEVEL=info   # Logging level (debug, info, warn, error)
```

The application will automatically handle other configurations like Chrome detection and session management.

## Usage

1. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

2. Initialize WhatsApp client:
- Visit `http://localhost:3000/init/[your-auth-key]`
- Scan the QR code with WhatsApp
- The server will maintain the session for future use

## Docker

### Building and Running with Docker

1. Build the Docker image:
```bash
docker build -t whatsapp-bridge .
```

2. Run the container:

#### Linux/macOS:
```bash
docker run -d \
  --name whatsapp-bridge \
  -p 3000:3000 \
  -v $(pwd)/whatsapp-sessions:/usr/src/app/whatsapp-sessions \
  -v $(pwd)/logs:/usr/src/app/logs \
  -e PORT=3000 \
  -e LOG_LEVEL=info \
  whatsapp-bridge
```

#### Windows (PowerShell):
```powershell
docker run -d `
  --name whatsapp-bridge `
  -p 3000:3000 `
  --add-host=host.docker.internal:host-gateway `
  -v ${PWD}/whatsapp-sessions:/usr/src/app/whatsapp-sessions `
  -v ${PWD}/logs:/usr/src/app/logs `
  -e PORT=3000 `
  -e LOG_LEVEL=info `
  whatsapp-bridge
```

The container will:
- Map port 3000 to your host machine (accessible via localhost:3000)
- Enable host machine access for webhooks
- Persist WhatsApp sessions and logs in local directories
- Run with necessary Chrome dependencies included

> **Note**: If port 3000 is already in use on your host machine, you can map to a different port using `-p <host-port>:3000` (e.g., `-p 3001:3000`).

### Webhook Configuration

When setting up webhooks, use these URL formats:
- Linux/macOS: `http://localhost:PORT/webhook`
- Windows: `http://host.docker.internal:PORT/webhook`
- External services: Use full URL (e.g., `https://api.example.com/webhook`)

Example webhook configuration:
```bash
# Linux/macOS local webhook
curl -X POST http://localhost:3000/subscriptions \
  -H "Authorization: Bearer YOUR_AUTH_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:8080/webhook",
    "events": ["message", "message_ack"],
    "secret": "your_webhook_secret"
  }'

# Windows local webhook
curl -X POST http://localhost:3000/subscriptions `
  -H "Authorization: Bearer YOUR_AUTH_KEY" `
  -H "Content-Type: application/json" `
  -d '{
    "url": "http://host.docker.internal:8080/webhook",
    "events": ["message", "message_ack"],
    "secret": "your_webhook_secret"
  }'
```

### Environment Variables in Docker

- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS protection
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `NODE_ENV`: Environment (production, development)
- `NODE_PATH`: Node.js path
- `NODE_TLS_REJECT_UNAUTHORIZED`: TLS rejection policy (0, 1)
- `NODE_VERSION`: Node.js version
- `NODE_WORKER_CPU_COUNT`: Number of CPU cores
- `NODE_WORKER_ID`: Worker ID
- `NODE_WORKER_START_TIME`: Worker start time
- `NODE_WORKING_DIR`: Working directory
- `NODE_OPTIONS`: Node.js options
- `NODE_REDIRECT_LOGGING`: Redirect logging to file (true, false)
- `NODE_REDIRECT_STDOUT`: Redirect stdout to file (true, false)
- `NODE_REDIRECT_STDERR`: Redirect stderr to file (true, false)
- `NODE_REDIRECT_STDOUT_LEVEL`: Redirect stdout level (debug, info, warn, error)
- `NODE_REDIRECT_STDERR_LEVEL`: Redirect stderr level (debug, info, warn, error)
- `NODE_REDIRECT_STDOUT_FILE`: Redirect stdout to file
- `NODE_REDIRECT_STDERR_FILE`: Redirect stderr to file
- `NODE_REDIRECT_STDOUT_FILE_LEVEL`: Redirect stdout to file level (debug, info, warn, error)
- `NODE_REDIRECT_STDERR_FILE_LEVEL`: Redirect stderr to file level (debug, info, warn, error)
- `NODE_REDIRECT_STDOUT_FILE_MAX_SIZE`: Redirect stdout to file max size
- `NODE_REDIRECT_STDERR_FILE_MAX_SIZE`: Redirect stderr to file max size
- `NODE_REDIRECT_STDOUT_FILE_MAX_FILES`: Redirect stdout to file max files
- `NODE_REDIRECT_STDERR_FILE_MAX_FILES`: Redirect stderr to file max files
- `NODE_REDIRECT_STDOUT_FILE_MAX_SIZE_MB`: Redirect stdout to file max size in MB
- `NODE_REDIRECT_STDERR_FILE_MAX_SIZE_MB`: Redirect stderr to file max size in MB
- `NODE_REDIRECT_STDOUT_FILE_MAX_FILES_MB`: Redirect stdout to file max files in MB
- `NODE_REDIRECT_STDERR_FILE_MAX_FILES_MB`: Redirect stderr to file max files in MB
- `NODE_REDIRECT_STDOUT_FILE_MAX_SIZE_KB`: Redirect stdout to file max size in KB
- `NODE_REDIRECT_STDERR_FILE_MAX_SIZE_KB`: Redirect stderr to file max size in KB
- `NODE_REDIRECT_STDOUT_FILE_MAX_FILES_KB`: Redirect stdout to file max files in KB
- `NODE_REDIRECT_STDERR_FILE_MAX_FILES_KB`: Redirect stderr to file max files in KB
- `NODE_REDIRECT_STDOUT_FILE_MAX_SIZE_B`: Redirect stdout to file max size in bytes
- `NODE_REDIRECT_STDERR_FILE_MAX_SIZE_B`: Redirect stderr to file max size in bytes
- `NODE_REDIRECT_STDOUT_FILE_MAX_FILES_B`: Redirect stdout to file max files in bytes
- `NODE_REDIRECT_STDERR_FILE_MAX_FILES_B`: Redirect stderr to file max files in bytes

## API Documentation

Access the Swagger documentation at:
```
http://localhost:3000/api-docs
```

### Core Endpoints

#### Authentication
- `GET /auth/status` - Check connection status
- `POST /auth/initialize` - Initialize new session

#### Messages
- `POST /messages` - Send message
- `GET /messages` - Get chat messages
- `POST /messages/:messageId/reply` - Reply to message
- `POST /messages/:messageId/react` - React to message
- `DELETE /messages/:messageId` - Delete message
- `GET /messages/:messageId/media` - Download media

#### Chats
- `GET /chats` - List all chats
- `GET /chats/:chatId` - Get chat details
- `GET /chats/:chatId/messages` - Get chat messages

#### Webhooks
- `POST /subscriptions` - Create webhook subscription
- `GET /subscriptions` - List subscriptions
- `DELETE /subscriptions/:id` - Remove subscription

## Security

- All endpoints require authentication via Bearer token
- Rate limiting: 100 requests per 15 minutes
- CORS protection with configurable origins
- Session data stored securely
- No sensitive data exposed in responses

## Development

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run in development mode
npm run dev
```

## License

Private and Confidential. All rights reserved. 