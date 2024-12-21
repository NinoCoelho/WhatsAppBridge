const request = require('supertest');
const express = require('express');
const { Client } = require('whatsapp-web.js');
const authRoutes = require('../../src/routes/auth');
const { getTestAuthKey } = require('../helpers');

describe('Auth Routes', () => {
    let app;
    let client;
    let authKey;
    let mockStatus = {
        authenticated: false,
        initialized: false
    };

    beforeEach(() => {
        app = express();
        app.use(express.json());
        client = new Client();
        authKey = getTestAuthKey();

        // Reset mock state
        mockStatus = {
            authenticated: false,
            initialized: false
        };

        // Add authentication middleware
        app.use((req, res, next) => {
            const providedKey = req.headers.authorization?.split(' ')[1];
            if (!providedKey || providedKey !== authKey) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            next();
        });

        // Mock client manager
        const clientManager = {
            getConnectionStatus: () => ({ 
                ...mockStatus,
                state: 'DISCONNECTED',
                timestamp: expect.any(Number)
            }),
            initialize: jest.fn().mockImplementation(async () => {
                if (mockStatus.authenticated) {
                    return null;
                }
                mockStatus.initialized = true;
                return {
                    status: 'QR_READY',
                    qr: 'data:image/png;base64,mockQRCode'
                };
            }),
            getCurrentQR: jest.fn().mockReturnValue('data:image/png;base64,mockQRCode')
        };

        authRoutes.initialize(client, authKey, clientManager);
        app.use('/auth', authRoutes.router);
    });

    describe('GET /auth/status', () => {
        it('should return current connection status', async () => {
            const response = await request(app)
                .get('/auth/status')
                .set('Authorization', `Bearer ${authKey}`);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                authenticated: false,
                initialized: false,
                state: expect.any(String),
                timestamp: expect.any(Number)
            });
        });

        it('should return unauthorized without valid auth key', async () => {
            const response = await request(app)
                .get('/auth/status')
                .set('Authorization', 'Bearer invalid_key');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });

    describe('POST /auth/initialize', () => {
        it('should initialize client and return QR code', async () => {
            const response = await request(app)
                .post('/auth/initialize')
                .set('Authorization', `Bearer ${authKey}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'QR_READY');
            expect(response.body).toHaveProperty('qr');
            expect(response.body.qr).toMatch(/^data:image\/png;base64,/);
        });

        it('should return error if already authenticated', async () => {
            mockStatus.authenticated = true;

            const response = await request(app)
                .post('/auth/initialize')
                .set('Authorization', `Bearer ${authKey}`);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'WhatsApp client is already authenticated');
        });

        it('should handle initialization errors', async () => {
            const clientManager = {
                getConnectionStatus: () => ({ ...mockStatus }),
                initialize: jest.fn().mockRejectedValue(new Error('Initialization failed'))
            };

            authRoutes.initialize(client, authKey, clientManager);

            const response = await request(app)
                .post('/auth/initialize')
                .set('Authorization', `Bearer ${authKey}`);

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error', 'Failed to initialize WhatsApp client');
            expect(response.body).toHaveProperty('details', 'Initialization failed');
        });
    });

    describe('GET /auth/key', () => {
        it('should return API authentication key', async () => {
            const response = await request(app)
                .get('/auth/key')
                .set('Authorization', `Bearer ${authKey}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('key', authKey);
        });

        it('should return unauthorized without valid auth key', async () => {
            const response = await request(app)
                .get('/auth/key')
                .set('Authorization', 'Bearer invalid_key');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error', 'Unauthorized');
        });
    });
}); 