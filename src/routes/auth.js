const express = require('express');
const router = express.Router();
const qrcode = require('qrcode');
const logger = require('../utils/logger');

// Reference to WhatsApp client and auth key (will be set from app.js)
let whatsappClient;
let authKey;
let clientManager;

// Initialize the router with required dependencies
function initialize(client, key, manager) {
    whatsappClient = client;
    authKey = key;
    clientManager = manager;
}

// Initialize WhatsApp client and get QR code
router.post('/initialize', async (req, res) => {
    logger.info('Initialization request received');
    const status = clientManager.getConnectionStatus();
    
    if (status.authenticated) {
        logger.info('Client already authenticated');
        return res.status(400).json({ error: 'WhatsApp client is already authenticated' });
    }

    try {
        // Start initialization and wait for QR code
        logger.info('Starting client initialization...');
        await clientManager.initialize();
        
        // Get the current QR code
        const qrCodeData = clientManager.getCurrentQR();
        
        if (!qrCodeData) {
            const status = clientManager.getConnectionStatus();
            if (status.authenticated) {
                logger.info('Client authenticated during initialization');
                return res.json({ status: 'AUTHENTICATED' });
            }
            logger.error('No QR code received and client not authenticated');
            return res.status(500).json({ error: 'Failed to get QR code or authenticate' });
        }

        // Generate QR code as data URL with specific options
        logger.info('Converting QR code to data URL');
        const qrDataUrl = await qrcode.toDataURL(qrCodeData, {
            errorCorrectionLevel: 'H',
            margin: 4,
            width: 256,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
        
        logger.info('Sending QR code response');
        res.json({
            status: 'QR_READY',
            qr: qrDataUrl
        });
    } catch (error) {
        logger.error('Initialization error:', error);
        res.status(500).json({ 
            error: 'Failed to initialize WhatsApp client',
            details: error.message
        });
    }
});

// Get current connection status with more details
router.get('/status', async (req, res) => {
    try {
        const connectionStatus = clientManager.getConnectionStatus();
        
        // Only try to get state if client is initialized
        let state = null;
        if (connectionStatus.initialized && whatsappClient) {
            try {
                state = await whatsappClient.getState();
            } catch (stateError) {
                logger.warn('Could not get WhatsApp state:', stateError);
                // Continue without state rather than failing
            }
        }
        
        logger.info(`Status request: ${JSON.stringify({
            ...connectionStatus,
            state,
            timestamp: Date.now()
        })}`);
        
        res.json({
            ...connectionStatus,
            state: state || 'DISCONNECTED',
            timestamp: Date.now()
        });
    } catch (error) {
        logger.error('Error in status endpoint:', error);
        res.status(500).json({ 
            error: 'Failed to get status',
            details: error.message 
        });
    }
});

// Get current QR code if available
router.get('/qrcode', (req, res) => {
    const status = clientManager.getConnectionStatus();
    
    if (status.authenticated) {
        return res.status(400).json({ error: 'WhatsApp client is already authenticated' });
    }

    const qrCode = clientManager.getCurrentQR();
    if (!qrCode) {
        return res.status(404).json({ error: 'No QR code available' });
    }

    qrcode.toDataURL(qrCode, {
        errorCorrectionLevel: 'H',
        margin: 4,
        width: 256,
        color: {
            dark: '#000000',
            light: '#ffffff'
        }
    })
    .then(qrDataUrl => {
        res.json({
            status: 'QR_READY',
            qr: qrDataUrl
        });
    })
    .catch(error => {
        logger.error('Failed to generate QR code data URL:', error);
        res.status(500).json({ error: 'Failed to generate QR code' });
    });
});

// Get API authentication key
router.get('/key', (req, res) => {
    res.json({ key: authKey });
});

// Get connected account information
router.get('/account', async (req, res) => {
    try {
        if (!whatsappClient.info) {
            return res.status(400).json({ error: 'Client not fully initialized' });
        }

        const info = whatsappClient.info;
        res.json({
            me: info.me,
            pushname: info.pushname,
            wid: info.wid,
            platform: info.platform
        });
    } catch (error) {
        logger.error('Error getting account info:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = { router, initialize }; 