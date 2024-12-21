const request = require('supertest');
const express = require('express');
const { Client } = require('whatsapp-web.js');
const messagesRoutes = require('../../src/routes/messages');
const { getTestAuthKey } = require('../helpers');

describe('Messages Routes', () => {
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
        client.sendMessage = jest.fn().mockResolvedValue({
            id: { _serialized: 'mock_message_id' },
            timestamp: Date.now(),
            from: 'sender@c.us',
            to: 'recipient@c.us'
        });

        client.getMessageById = jest.fn().mockResolvedValue({
            id: { _serialized: 'mock_message_id' },
            body: 'Test message',
            timestamp: Date.now(),
            from: 'sender@c.us',
            to: 'recipient@c.us'
        });

        messagesRoutes.initialize(client);
        app.use('/messages', messagesRoutes.router);
    });

    describe('POST /messages', () => {
        it('should send a text message', async () => {
            const response = await request(app)
                .post('/messages')
                .set('Authorization', `Bearer ${authKey}`)
                .send({
                    chatId: 'mock_chat_id',
                    message: 'Test message'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('messageId');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('status', 'sent');
        });

        it('should return unauthorized without valid auth key', async () => {
            const response = await request(app)
                .post('/messages')
                .set('Authorization', 'Bearer invalid_key')
                .send({
                    chatId: 'mock_chat_id',
                    message: 'Test message'
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });

    describe('GET /messages', () => {
        it('should get messages from a chat', async () => {
            const chat = {
                fetchMessages: jest.fn().mockResolvedValue([{
                    id: { _serialized: 'mock_message_id' },
                    body: 'Test message',
                    timestamp: Date.now(),
                    from: 'sender@c.us',
                    to: 'recipient@c.us'
                }])
            };
            client.getChatById = jest.fn().mockResolvedValue(chat);

            const response = await request(app)
                .get('/messages')
                .query({ chatId: 'mock_chat_id' })
                .set('Authorization', `Bearer ${authKey}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body[0]).toHaveProperty('id');
            expect(response.body[0]).toHaveProperty('body');
        });

        it('should return unauthorized without valid auth key', async () => {
            const response = await request(app)
                .get('/messages')
                .query({ chatId: 'mock_chat_id' })
                .set('Authorization', 'Bearer invalid_key');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });

    describe('POST /messages/:messageId/react', () => {
        it('should react to a message', async () => {
            // Mock the message object with react method
            client.getMessageById = jest.fn().mockResolvedValue({
                id: { _serialized: 'mock_message_id' },
                react: jest.fn().mockResolvedValue(true)
            });

            const response = await request(app)
                .post('/messages/mock_message_id/react')
                .set('Authorization', `Bearer ${authKey}`)
                .send({ reaction: '👍' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Reaction added successfully');
        });

        it('should return unauthorized without valid auth key', async () => {
            const response = await request(app)
                .post('/messages/mock_message_id/react')
                .set('Authorization', 'Bearer invalid_key')
                .send({ reaction: '👍' });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });

    describe('POST /messages/:messageId/reply', () => {
        it('should reply to a message', async () => {
            // Mock the message object with reply method
            client.getMessageById = jest.fn().mockResolvedValue({
                id: { _serialized: 'mock_message_id' },
                reply: jest.fn().mockResolvedValue({
                    id: { _serialized: 'mock_reply_id' },
                    timestamp: Date.now()
                })
            });

            const response = await request(app)
                .post('/messages/mock_message_id/reply')
                .set('Authorization', `Bearer ${authKey}`)
                .send({ message: 'Test reply' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('messageId');
            expect(response.body).toHaveProperty('timestamp');
        });

        it('should return unauthorized without valid auth key', async () => {
            const response = await request(app)
                .post('/messages/mock_message_id/reply')
                .set('Authorization', 'Bearer invalid_key')
                .send({ message: 'Test reply' });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });
}); 