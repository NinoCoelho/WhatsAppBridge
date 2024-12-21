const request = require('supertest');
const express = require('express');
const { Client } = require('whatsapp-web.js');
const messageRoutes = require('../src/routes/messages');
const { getTestAuthKey } = require('./helpers');

describe('Message Routes', () => {
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

        messageRoutes.initialize(client);
        app.use('/', messageRoutes.router);  // Mount at root path
    });

    it('should send a text message', async () => {
        const response = await request(app)
            .post('/')  // Updated to use root path
            .set('Authorization', `Bearer ${authKey}`)  // Add auth header
            .send({
                chatId: 'mock_chat_id',
                message: 'Test message'
            });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('messageId');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('status', 'sent');
    });

    // Add other tests...
}); 