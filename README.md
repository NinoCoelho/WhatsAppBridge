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
PORT=3000
HOST=localhost
AUTH_KEY_SECRET=your_secret_key
JWT_SECRET=your_jwt_secret
ALLOWED_ORIGINS=http://localhost:3000
LOG_LEVEL=info
```

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