const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

let whatsappClient;
let subscriptions = new Map(); // Store subscriptions with their secrets

function initialize(client) {
    whatsappClient = client;
    
    // Add message_create to the events array
    const events = ['message', 'message_create', 'message_ack', 'group_join', 'group_leave', 'group_update'];
    events.forEach(event => {
        whatsappClient.on(event, async (...args) => {
            await notifySubscribers(event, ...args);
        });
    });
}

async function notifySubscribers(event, ...eventData) {
    for (const [url, subscription] of subscriptions.entries()) {
        if (subscription.events.includes(event)) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${subscription.secret}`
                    },
                    body: JSON.stringify({
                        event,
                        data: formatEventData(event, ...eventData)
                    })
                });

                if (!response.ok) {
                    logger.error(`Webhook delivery failed for ${url} with status ${response.status}`);
                }
            } catch (error) {
                logger.error(`Webhook delivery failed for ${url}:`, error);
            }
        }
    }
}

function formatEventData(event, ...args) {
    switch (event) {
        case 'message':
        case 'message_create':  // Add formatter for message_create
            const msg = args[0];
            return {
                id: msg.id,
                body: msg.body,
                from: msg.from,
                to: msg.to,
                timestamp: msg.timestamp,
                type: msg.type,
                hasMedia: msg.hasMedia
            };
        case 'message_ack':
            const [ackMsg, ack] = args;
            return {
                id: ackMsg.id,
                ack: ack,
                timestamp: Date.now()
            };
        // Add other event formatters as needed
        default:
            return args;
    }
}

// Subscribe to events
router.post('/', (req, res) => {
    const { url, events, secret } = req.body;

    if (!url || !events || !secret) {
        return res.status(400).json({ error: 'Missing required fields: url, events, secret' });
    }

    if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: 'Events must be a non-empty array' });
    }

    try {
        new URL(url); // Validate URL format
    } catch (error) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    subscriptions.set(url, { events, secret });
    logger.info(`New subscription registered for ${url} with events: ${events.join(', ')}`);
    res.status(201).json({ message: 'Subscription created successfully' });
});

// List all subscriptions
router.get('/', (req, res) => {
    const subs = Array.from(subscriptions.entries()).map(([url, { events }]) => ({
        url,
        events
    }));
    res.json(subs);
});

// Delete a subscription
router.delete('/', (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    if (subscriptions.delete(url)) {
        logger.info(`Subscription removed for ${url}`);
        res.json({ message: 'Subscription removed successfully' });
    } else {
        res.status(404).json({ error: 'Subscription not found' });
    }
});

module.exports = { router, initialize }; 