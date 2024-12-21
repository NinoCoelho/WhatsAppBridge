# WhatsApp Bridge

Private WhatsApp Web API Bridge for automated messaging and interactions.

## Features

- WhatsApp Web client integration
- QR code-based authentication
- Session persistence
- RESTful API endpoints for:
  - Sending messages
  - Managing chats
  - Handling subscriptions
  - Authentication status
- Swagger API documentation
- Secure authentication with API keys

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Chrome/Chromium browser
- A WhatsApp account

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd whatsapp-bridge
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
PORT=3000
HOST=localhost
LOG_LEVEL=info
WHATSAPP_CLIENT_ID=whatsapp-bridge
WHATSAPP_SESSION_PATH=./whatsapp-sessions
```

## Usage

1. Start the server:
```bash
npm start
```

2. The server will generate an authentication key and display it in the console. Save this key for API access.

3. Visit the initialization URL shown in the console to scan the WhatsApp QR code:
```
http://localhost:3000/init/[your-auth-key]
```

4. Once authenticated, you can start using the API endpoints.

## API Documentation

The API documentation is available at `/api-docs` when the server is running. Visit:
```
http://localhost:3000/api-docs
```

### Key Endpoints

- `GET /init/:key` - Initialize WhatsApp client and get QR code
- `GET /auth/status` - Check authentication status
- `POST /messages/send` - Send a message
- `GET /chats` - List all chats
- `POST /subscriptions` - Create webhook subscription

## Authentication

All API endpoints (except initialization) require authentication using a Bearer token:

```http
Authorization: Bearer [your-auth-key]
```

## Error Handling

The API uses standard HTTP status codes:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 500: Internal Server Error

Errors are returned in JSON format:
```json
{
    "error": "Error message"
}
```

## Development

For development with auto-reload:
```bash
npm run dev
```

## Security Considerations

- Keep your authentication key secure
- Use HTTPS in production
- Don't share your WhatsApp session data
- Monitor webhook endpoints for security

## License

[Your License]

## Contributing

[Your Contributing Guidelines] 