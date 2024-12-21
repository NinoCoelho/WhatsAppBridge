const express = require('express');
const { Client } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');
const { getOrCreateAuthKey } = require('./utils/auth');
const { LocalAuth } = require('whatsapp-web.js');

// Load environment variables
require('dotenv').config();

// Get or create persistent authentication key
const authKey = getOrCreateAuthKey();
logger.info('='.repeat(80));
logger.info('Using authentication key (save this for API access):');
logger.info(authKey);
logger.info('='.repeat(80));

// Initialize Express app
const app = express();
app.use(express.json());

// Initialize WhatsApp client with session support
const client = new Client({
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: true,
        executablePath: process.env.CHROME_PATH || undefined
    },
    authStrategy: new LocalAuth({
        clientId: 'whatsapp-bridge',
        dataPath: './whatsapp-sessions'
    }),
    restartOnAuthFail: true,
    qrMaxRetries: 5,
    authTimeoutMs: 60000,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 10000
});

// Add more detailed logging for state changes
client.on('change_state', state => {
    logger.info(`Client state changed to: ${state}`);
    if (state === 'CONNECTED') {
        isAuthenticated = true;
        isInitialized = true;
        qrDisplayed = false;
    }
});

client.on('loading_screen', (percent, message) => {
    logger.info(`Loading screen: ${percent}% - ${message}`);
});

client.on('authenticated', (session) => {
    logger.info('Client authenticated with session');
    isAuthenticated = true;
    qrDisplayed = false;
});

client.on('ready', () => {
    logger.info('Client is ready and fully authenticated');
    isAuthenticated = true;
    isInitialized = true;
    qrDisplayed = false;
});

// Authentication middleware
const authenticateRequest = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== authKey) {
        return res.status(401).json({ error: 'Unauthorized - Bearer token required' });
    }
    next();
};

// WhatsApp client event handlers
let currentQR = null;
let qrDisplayed = false;
let isAuthenticated = false;
let isInitialized = false;
let initializationRetries = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 10000;

const initializeClient = async () => {
    if (initializationRetries >= MAX_RETRIES) {
        logger.error('Max initialization retries reached. Please check your configuration.');
        return null;
    }

    try {
        // Check if client exists and has a browser instance
        const hasExistingInstance = client && client.pupBrowser;
        
        if (hasExistingInstance) {
            logger.info('Destroying existing client instance');
            try {
                await client.destroy();
            } catch (err) {
                logger.error('Error destroying existing client:', err);
            }
            isInitialized = false;
            isAuthenticated = false;
            currentQR = null;
        }

        initializationRetries++;
        logger.info(`Attempting to initialize WhatsApp client (attempt ${initializationRetries}/${MAX_RETRIES})`);
        
        // Reset state
        currentQR = null;
        qrDisplayed = false;
        isAuthenticated = false;
        isInitialized = false;

        // Set up event handlers
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Initialization timed out'));
            }, 120000);

            const qrHandler = async (qr) => {
                try {
                    logger.info('New QR code received');
                    currentQR = qr;
                    qrDisplayed = true;
                    resolve(qr);
                } catch (err) {
                    reject(err);
                }
            };

            const readyHandler = () => {
                logger.info('Client is ready (from initialization)');
                clearTimeout(timeout);
                isAuthenticated = true;
                isInitialized = true;
                qrDisplayed = false;
                resolve(null);
            };

            const errorHandler = (err) => {
                logger.error('Initialization error:', err);
                clearTimeout(timeout);
                reject(err);
            };

            // Add event listeners
            client.once('qr', qrHandler);
            client.once('ready', readyHandler);
            client.once('auth_failure', errorHandler);

            // Start initialization
            logger.info('Starting client initialization...');
            client.initialize().catch(errorHandler);
        });
    } catch (err) {
        logger.error('Error during initialization:', err);
        throw err;
    }
};

// Disconnection handler
client.on('disconnected', async (reason) => {
    logger.warn('Client disconnected:', reason);
    currentQR = null;
    qrDisplayed = false;
    isAuthenticated = false;
    isInitialized = false;

    if (initializationRetries < MAX_RETRIES) {
        logger.info('Attempting to reconnect...');
        setTimeout(async () => {
            try {
                await initializeClient();
            } catch (err) {
                logger.error('Reconnection failed:', err);
            }
        }, RETRY_DELAY);
    }
});

// Get current QR code
const getCurrentQR = () => currentQR;

// Get connection status
const getConnectionStatus = () => ({
    authenticated: isAuthenticated,
    initialized: isInitialized,
    qrDisplayed: qrDisplayed
});

// Direct initialization endpoint with QR code display
app.get('/init/:key', async (req, res) => {
    const providedKey = req.params.key;
    
    if (providedKey !== authKey) {
        return res.status(401).json({ error: 'Invalid authentication key' });
    }

    try {
        // Check if client is already authenticated and ready
        const hasExistingInstance = client && client.pupBrowser;
        if (isAuthenticated && hasExistingInstance) {
            logger.info('Client is already authenticated and ready');
            return res.json({ status: 'authenticated' });
        }

        // If client is already initialized but not authenticated, destroy it
        if (hasExistingInstance) {
            logger.info('Destroying existing client instance before reinitializing');
            try {
                await client.destroy();
            } catch (err) {
                logger.error('Error destroying existing client:', err);
            }
            isInitialized = false;
            isAuthenticated = false;
            currentQR = null;
        }

        // Initialize client and get QR code
        logger.info('Starting fresh initialization...');
        const qrCode = await initializeClient();
        
        // If no QR code but authenticated, return success
        if (!qrCode && isAuthenticated) {
            logger.info('Client authenticated without QR code');
            return res.json({ status: 'authenticated' });
        }

        // If no QR code and not authenticated, something went wrong
        if (!qrCode) {
            logger.error('Failed to generate QR code and client is not authenticated');
            return res.status(500).json({ error: 'Failed to generate QR code' });
        }

        logger.info('Successfully generated QR code, sending to client');

        // Convert QR code to data URL
        const qrDataUrl = await QRCode.toDataURL(qrCode, {
            errorCorrectionLevel: 'H',
            margin: 4,
            width: 256,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        // Return an HTML page with the QR code
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp QR Code</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background-color: #f0f2f5;
                    }
                    .container {
                        background: white;
                        padding: 2rem;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        text-align: center;
                    }
                    h1 {
                        color: #128C7E;
                        margin-bottom: 1rem;
                    }
                    #qrcode {
                        margin: 2rem 0;
                    }
                    #qrcode img {
                        width: 256px;
                        height: 256px;
                    }
                    #status {
                        margin-top: 1rem;
                        font-weight: bold;
                        color: #666;
                    }
                    .error {
                        color: #dc3545;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>WhatsApp QR Code</h1>
                    <p>Scan this QR code with WhatsApp to connect</p>
                    <div id="qrcode">
                        <img src="${qrDataUrl}" alt="WhatsApp QR Code">
                    </div>
                    <div id="status">Waiting for scan...</div>
                </div>
                <script>
                    let retries = 0;
                    const maxRetries = 30; // 30 seconds timeout

                    function checkStatus() {
                        if (retries >= maxRetries) {
                            document.getElementById('status').innerHTML = '<span class="error">Timeout: Please refresh the page to try again</span>';
                            return;
                        }

                        fetch('/auth/status', {
                            headers: {
                                'Authorization': 'Bearer ${authKey}'
                            }
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.authenticated) {
                                document.getElementById('status').textContent = 'Connected! You can close this window.';
                                document.getElementById('qrcode').style.display = 'none';
                            } else {
                                retries++;
                                setTimeout(checkStatus, 1000);
                            }
                        })
                        .catch(error => {
                            document.getElementById('status').innerHTML = '<span class="error">Error: ' + error.message + '</span>';
                        });
                    }
                    checkStatus();
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        logger.error('Initialization error:', error);
        res.status(500).json({ error: 'Failed to initialize WhatsApp client: ' + error.message });
    }
});

// Load Swagger documentation
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Initialize routes
const authRoutes = require('./routes/auth');
const subscriptionRoutes = require('./routes/subscriptions');
const messageRoutes = require('./routes/messages');
const chatRoutes = require('./routes/chats');

// Initialize route handlers with dependencies
authRoutes.initialize(client, authKey, {
    getConnectionStatus,
    getCurrentQR,
    initialize: initializeClient
});
subscriptionRoutes.initialize(client);
messageRoutes.initialize(client);
chatRoutes.initialize(client);

// Mount routes
app.use('/auth', authRoutes.router);
app.use('/subscriptions', authenticateRequest, subscriptionRoutes.router);
app.use('/messages', authenticateRequest, messageRoutes.router);
app.use('/chats', authenticateRequest, chatRoutes.router);

// Add this after initializing the client but before starting the server
const attemptAutoInitialization = async () => {
    try {
        logger.info('Attempting auto-initialization...');
        const result = await initializeClient();
        
        if (!result) {
            // No QR code was generated and client is authenticated
            logger.info('WhatsApp client auto-initialized successfully with existing session');
        } else {
            // QR code was generated, meaning no existing session
            logger.info('No existing session found. Waiting for manual authentication...');
            // Clean up the initialization attempt since we'll wait for manual auth
            if (client && client.pupBrowser) {
                await client.destroy();
            }
            isInitialized = false;
            isAuthenticated = false;
            currentQR = null;
        }
    } catch (error) {
        logger.error('Auto-initialization failed:', error);
        logger.info('Waiting for manual authentication...');
    }
};

// Modify the server startup section
const startServer = async () => {
    // Try auto-initialization first
    await attemptAutoInitialization();
    
    // Then start the server
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
        const host = process.env.HOST || 'localhost';
        logger.info(`Server is running on port ${PORT}`);
        logger.info('='.repeat(80));
        if (!isAuthenticated) {
            logger.info('To initialize WhatsApp, visit:');
            logger.info(`http://${host}:${PORT}/init/${authKey}`);
        } else {
            logger.info('WhatsApp client is authenticated and ready');
        }
        logger.info('='.repeat(80));
    });
    
    return server;
};

// Start the server and store the reference
let server;
startServer().then(serverInstance => {
    server = serverInstance;
}).catch(error => {
    logger.error('Failed to start server:', error);
    process.exit(1);
});

// Graceful shutdown
const shutdown = async () => {
    logger.info('Shutting down...');
    try {
        // Only attempt to destroy the client if it's initialized
        if (client && client.pupPage) {
            await client.destroy();
        }
        
        if (server) {
            server.close(() => {
                logger.info('Server closed');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Error handling
process.on('unhandledRejection', (error) => {
    logger.error('Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
});

// Status endpoint to check if client is authenticated
app.get('/status', (req, res) => {
    res.json({
        authenticated: isAuthenticated,
        initialized: isInitialized,
        qrDisplayed: qrDisplayed
    });
});