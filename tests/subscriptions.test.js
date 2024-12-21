const request = require('supertest');
const express = require('express');
const { router: subscriptionRouter, initialize } = require('../src/routes/subscriptions');

describe('Subscription Routes', () => {
    let app;
    let mockClient;
    const TEST_AUTH_KEY = 'test-auth-key';

    // Add authentication middleware
    const authenticateRequest = (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== TEST_AUTH_KEY) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
    };

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Mock WhatsApp client
        mockClient = {
            on: jest.fn()
        };

        initialize(mockClient);
        app.use('/subscriptions', authenticateRequest, subscriptionRouter);
    });

    test('POST /subscriptions should create new subscription', async () => {
        const response = await request(app)
            .post('/subscriptions')
            .set('Authorization', `Bearer ${TEST_AUTH_KEY}`)
            .send({
                url: 'http://localhost:3001/webhook',
                events: ['message_create'],
                secret: 'test-secret'
            });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
            message: 'Subscription created successfully'
        });
    });

    test('should reject requests with missing parameters', async () => {
        const response = await request(app)
            .post('/subscriptions')
            .set('Authorization', `Bearer ${TEST_AUTH_KEY}`)
            .send({});

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'Missing required fields: url, events, secret'
        });
    });

    test('should reject invalid URL format', async () => {
        const response = await request(app)
            .post('/subscriptions')
            .set('Authorization', `Bearer ${TEST_AUTH_KEY}`)
            .send({
                url: 'invalid-url',
                events: ['message_create'],
                secret: 'test-secret'
            });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: 'Invalid URL format'
        });
    });

    test('DELETE /subscriptions should remove subscription', async () => {
        // First create a subscription
        await request(app)
            .post('/subscriptions')
            .set('Authorization', `Bearer ${TEST_AUTH_KEY}`)
            .send({
                url: 'http://localhost:3001/webhook',
                events: ['message_create'],
                secret: 'test-secret'
            });

        const response = await request(app)
            .delete('/subscriptions')
            .set('Authorization', `Bearer ${TEST_AUTH_KEY}`)
            .send({
                url: 'http://localhost:3001/webhook'
            });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            message: 'Subscription removed successfully'
        });
    });

    test('GET /subscriptions should list all subscriptions', async () => {
        // First create a subscription
        await request(app)
            .post('/subscriptions')
            .set('Authorization', `Bearer ${TEST_AUTH_KEY}`)
            .send({
                url: 'http://localhost:3001/webhook',
                events: ['message_create'],
                secret: 'test-secret'
            });

        const response = await request(app)
            .get('/subscriptions')
            .set('Authorization', `Bearer ${TEST_AUTH_KEY}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([
            {
                url: 'http://localhost:3001/webhook',
                events: ['message_create']
            }
        ]);
    });

    test('should reject requests without authentication', async () => {
        const response = await request(app)
            .get('/subscriptions');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            error: 'Unauthorized'
        });
    });
}); 