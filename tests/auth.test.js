const request = require('supertest');
const express = require('express');
const { router: authRouter, initialize } = require('../src/routes/auth');
const winston = require('winston');

// Mock winston logger
jest.mock('winston', () => ({
    createLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }),
    format: {
        combine: jest.fn(),
        timestamp: jest.fn(),
        json: jest.fn(),
        simple: jest.fn()
    },
    transports: {
        File: jest.fn(),
        Console: jest.fn()
    }
}));

describe('Auth Routes', () => {
    let app;
    let mockClient;
    let mockClientManager;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Mock WhatsApp client
        mockClient = {
            getState: jest.fn().mockResolvedValue('CONNECTED'),
            info: {
                me: 'test-user',
                pushname: 'Test User',
                wid: '1234567890@c.us',
                platform: 'test'
            }
        };

        // Updated mock client manager
        mockClientManager = {
            getConnectionStatus: jest.fn().mockReturnValue({
                authenticated: false,
                initialized: false,
                qrDisplayed: false
            }),
            getCurrentQR: jest.fn().mockReturnValue('mock-qr-code'),
            initialize: jest.fn().mockResolvedValue({
                status: 'QR_READY',
                qr: 'mock-qr-data'
            })
        };

        initialize(mockClient, 'test-auth-key', mockClientManager);
        app.use('/auth', authRouter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('GET /auth/status should return current status', async () => {
        const response = await request(app)
            .get('/auth/status');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            authenticated: false,
            initialized: false,
            qrDisplayed: false,
            state: 'DISCONNECTED',
            timestamp: expect.any(Number)
        });
    });

    test('GET /auth/account should return account info', async () => {
        const response = await request(app)
            .get('/auth/account');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            me: 'test-user',
            pushname: 'Test User',
            wid: '1234567890@c.us',
            platform: 'test'
        });
    });
}); 