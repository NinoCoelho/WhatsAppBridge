const request = require('supertest');
const express = require('express');
const { Client } = require('whatsapp-web.js');
const chatsRoutes = require('../../src/routes/chats');
const messagesRoutes = require('../../src/routes/messages');
const { getTestAuthKey } = require('../helpers');

describe('Chats Routes', () => {
    let app;
    let client;
    let authKey;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        client = new Client();
        authKey = getTestAuthKey();

        // Add authentication middleware
        app.use((req, res, next) => {
            const providedKey = req.headers.authorization?.split(' ')[1];
            if (!providedKey || providedKey !== authKey) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            next();
        });

        // Mock client methods
        const mockChat = {
            id: { _serialized: 'mock_chat_id' },
            name: 'Mock Chat',
            isGroup: false,
            timestamp: Date.now(),
            unreadCount: 0,
            pinned: false,
            muteExpiration: null,
            isReadOnly: false,
            isMuted: false,
            lastMessage: {
                body: 'Last message',
                timestamp: Date.now()
            },
            fetchMessages: jest.fn().mockResolvedValue([{
                id: { _serialized: 'mock_message_id' },
                body: 'Test message',
                timestamp: Date.now(),
                from: 'sender@c.us',
                to: 'recipient@c.us',
                hasMedia: false,
                type: 'chat',
                isForwarded: false,
                forwardingScore: 0,
                isStatus: false,
                isStarred: false,
                broadcast: false,
                fromMe: false,
                hasQuotedMsg: false,
                vCards: [],
                mentionedIds: [],
                links: []
            }]),
            sendMessage: jest.fn().mockResolvedValue({
                id: { _serialized: 'mock_sent_message_id' },
                body: 'Test self message',
                timestamp: Date.now(),
                from: 'me@c.us',
                to: 'me@c.us',
                hasMedia: false,
                type: 'chat',
                fromMe: true
            })
        };

        // Mock client methods
        client.getChats = jest.fn().mockResolvedValue([mockChat]);
        client.getChatById = jest.fn().mockResolvedValue(mockChat);
        client.sendMessage = jest.fn().mockResolvedValue({
            id: { _serialized: 'mock_sent_message_id' },
            timestamp: Date.now(),
            from: 'me@c.us',
            to: 'me@c.us',
            body: 'Test self message',
            hasMedia: false,
            type: 'chat',
            fromMe: true
        });
        client.getMessageById = jest.fn().mockResolvedValue({
            id: { _serialized: 'mock_sent_message_id' },
            body: 'Test self message',
            timestamp: Date.now(),
            from: 'me@c.us',
            to: 'me@c.us',
            hasMedia: false,
            type: 'chat',
            fromMe: true,
            reply: jest.fn().mockResolvedValue({
                id: { _serialized: 'mock_reply_id' },
                timestamp: Date.now(),
                status: 'sent'
            })
        });
        client.info = {
            wid: { _serialized: 'me@c.us' }
        };

        // Initialize and mount routes
        chatsRoutes.initialize(client);
        messagesRoutes.initialize(client);
        app.use('/chats', chatsRoutes.router);
        app.use('/messages', messagesRoutes.router);
    });

    describe('GET /chats', () => {
        it('should return list of chats', async () => {
            const response = await request(app)
                .get('/chats')
                .set('Authorization', `Bearer ${authKey}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body[0]).toHaveProperty('id', 'mock_chat_id');
            expect(response.body[0]).toHaveProperty('name', 'Mock Chat');
            expect(response.body[0]).toHaveProperty('isGroup', false);
            expect(response.body[0]).toHaveProperty('unreadCount', 0);
            expect(response.body[0]).toHaveProperty('lastMessage');
        });

        it('should return unauthorized without valid auth key', async () => {
            const response = await request(app)
                .get('/chats')
                .set('Authorization', 'Bearer invalid_key');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });

    describe('GET /chats/:chatId', () => {
        it('should return chat details', async () => {
            const response = await request(app)
                .get('/chats/mock_chat_id')
                .set('Authorization', `Bearer ${authKey}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('id', 'mock_chat_id');
            expect(response.body).toHaveProperty('name', 'Mock Chat');
            expect(response.body).toHaveProperty('isGroup', false);
            expect(response.body).toHaveProperty('unreadCount', 0);
        });

        it('should return unauthorized without valid auth key', async () => {
            const response = await request(app)
                .get('/chats/mock_chat_id')
                .set('Authorization', 'Bearer invalid_key');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });

    describe('GET /chats/:chatId/messages', () => {
        it('should return chat messages', async () => {
            const response = await request(app)
                .get('/chats/mock_chat_id/messages')
                .set('Authorization', `Bearer ${authKey}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body[0]).toHaveProperty('id', 'mock_message_id');
            expect(response.body[0]).toHaveProperty('body', 'Test message');
        });

        it('should return unauthorized without valid auth key', async () => {
            const response = await request(app)
                .get('/chats/mock_chat_id/messages')
                .set('Authorization', 'Bearer invalid_key');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });

    describe('Self Chat Tests', () => {
        it('should send a message to self and reply to it', async () => {
            // First, get self chat
            const selfChatResponse = await request(app)
                .get('/chats/me@c.us')
                .set('Authorization', `Bearer ${authKey}`);

            expect(selfChatResponse.status).toBe(200);
            expect(selfChatResponse.body).toHaveProperty('id', 'mock_chat_id');

            // Send a message to self
            const sendResponse = await request(app)
                .post('/messages')
                .set('Authorization', `Bearer ${authKey}`)
                .send({
                    chatId: 'me@c.us',
                    message: 'Test self message'
                });

            expect(sendResponse.status).toBe(200);
            expect(sendResponse.body).toHaveProperty('messageId', 'mock_sent_message_id');
            expect(sendResponse.body).toHaveProperty('status', 'sent');

            // Get the sent message
            const messagesResponse = await request(app)
                .get('/chats/me@c.us/messages')
                .set('Authorization', `Bearer ${authKey}`);

            expect(messagesResponse.status).toBe(200);
            expect(Array.isArray(messagesResponse.body)).toBe(true);
            expect(messagesResponse.body[0]).toHaveProperty('id', 'mock_message_id');

            // Reply to the sent message
            const replyResponse = await request(app)
                .post('/messages/mock_sent_message_id/reply')
                .set('Authorization', `Bearer ${authKey}`)
                .send({
                    message: 'Reply to self message'
                });

            expect(replyResponse.status).toBe(200);
            expect(replyResponse.body).toHaveProperty('messageId');
            expect(replyResponse.body).toHaveProperty('status', 'sent');
        });
    });
}); 