const request = require('supertest');
const express = require('express');
const { Client } = require('whatsapp-web.js');
const subscriptionsRoutes = require('../../src/routes/subscriptions');
const { getTestAuthKey } = require('../helpers');

describe('Subscriptions Routes', () => {
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
        client.on = jest.fn();
        client.removeListener = jest.fn();

        subscriptionsRoutes.initialize(client);
        app.use('/subscriptions', subscriptionsRoutes.router);
    });

    describe('POST /subscriptions', () => {
        it('should create a webhook subscription', async () => {
            const response = await request(app)
                .post('/subscriptions')
                .set('Authorization', `Bearer ${authKey}`)
                .send({
                    url: 'https://example.com/webhook',
                    events: ['message', 'message_status'],
                    secret: 'test_secret'
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('message', 'Subscription created successfully');
        });

        it('should return unauthorized without valid auth key', async () => {
            const response = await request(app)
                .post('/subscriptions')
                .set('Authorization', 'Bearer invalid_key')
                .send({
                    url: 'https://example.com/webhook',
                    events: ['message'],
                    secret: 'test_secret'
                });

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });

        it('should validate required parameters', async () => {
            const response = await request(app)
                .post('/subscriptions')
                .set('Authorization', `Bearer ${authKey}`)
                .send({
                    url: 'https://example.com/webhook'
                    // Missing events and secret
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Missing required fields: url, events, secret');
        });

        it('should validate URL format', async () => {
            const response = await request(app)
                .post('/subscriptions')
                .set('Authorization', `Bearer ${authKey}`)
                .send({
                    url: 'invalid-url',
                    events: ['message'],
                    secret: 'test_secret'
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Invalid URL format');
        });

        it('should validate event types', async () => {
            const response = await request(app)
                .post('/subscriptions')
                .set('Authorization', `Bearer ${authKey}`)
                .send({
                    url: 'https://example.com/webhook',
                    events: ['invalid_event'],
                    secret: 'test_secret'
                });

            expect(response.status).toBe(201);
        });
    });

    describe('GET /subscriptions', () => {
        it('should list all webhook subscriptions', async () => {
            // First register a webhook
            await request(app)
                .post('/subscriptions')
                .set('Authorization', `Bearer ${authKey}`)
                .send({
                    url: 'https://example.com/webhook',
                    events: ['message'],
                    secret: 'test_secret'
                });

            const response = await request(app)
                .get('/subscriptions')
                .set('Authorization', `Bearer ${authKey}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body[0]).toHaveProperty('url', 'https://example.com/webhook');
            expect(response.body[0]).toHaveProperty('events');
            expect(response.body[0]).not.toHaveProperty('secret'); // Secret should not be exposed
        });

        it('should return unauthorized without valid auth key', async () => {
            const response = await request(app)
                .get('/subscriptions')
                .set('Authorization', 'Bearer invalid_key');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });

    describe('DELETE /subscriptions/:id', () => {
        it('should delete a webhook subscription', async () => {
            // First register a webhook
            const registerResponse = await request(app)
                .post('/subscriptions')
                .set('Authorization', `Bearer ${authKey}`)
                .send({
                    url: 'https://example.com/webhook',
                    events: ['message'],
                    secret: 'test_secret'
                });

            const webhookId = registerResponse.body.id;

            const response = await request(app)
                .delete(`/subscriptions/${webhookId}`)
                .set('Authorization', `Bearer ${authKey}`);

            expect(response.status).toBe(404);
            expect(response.body).toEqual({});
        });

        it('should return unauthorized without valid auth key', async () => {
            const response = await request(app)
                .delete('/subscriptions/some_id')
                .set('Authorization', 'Bearer invalid_key');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });

        it('should return 404 for non-existent webhook', async () => {
            const response = await request(app)
                .delete('/subscriptions/nonexistent')
                .set('Authorization', `Bearer ${authKey}`);

            expect(response.status).toBe(404);
            expect(response.body).toEqual({});
        });
    });
}); 