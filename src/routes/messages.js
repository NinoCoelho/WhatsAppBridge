const express = require('express');
const router = express.Router();
const { MessageMedia } = require('whatsapp-web.js');
const logger = require('../utils/logger');

// Reference to WhatsApp client (will be set from app.js)
let whatsappClient;

// Initialize the router with required dependencies
function initialize(client) {
    whatsappClient = client;
}

// Send a new message
router.post('/', async (req, res) => {
    try {
        const { chatId, message, mediaUrl, options } = req.body;

        if (!chatId || (!message && !mediaUrl)) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        let result;
        if (mediaUrl) {
            try {
                // Handle media message
                const media = await MessageMedia.fromUrl(mediaUrl);
                result = await whatsappClient.sendMessage(chatId, media, {
                    caption: message, // Optional caption for media
                    sendMediaAsDocument: options?.sendAsDocument || false,
                    sendAudioAsVoice: options?.sendAsVoice || false,
                    ...options
                });
            } catch (error) {
                return res.status(400).json({ error: 'Failed to load media from URL' });
            }
        } else {
            // Handle text message with optional formatting
            result = await whatsappClient.sendMessage(chatId, message, options);
        }

        res.json({
            messageId: result.id._serialized,
            timestamp: result.timestamp,
            status: 'sent',
            from: result.from,
            to: result.to
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get messages from a chat
router.get('/', async (req, res) => {
    try {
        const { chatId, limit = 50, fromMe } = req.query;

        if (!chatId) {
            return res.status(400).json({ error: 'Chat ID is required' });
        }

        const chat = await whatsappClient.getChatById(chatId);
        const messages = await chat.fetchMessages({
            limit: parseInt(limit),
            fromMe: fromMe === 'true'
        });

        res.json(messages.map(msg => ({
            id: msg.id._serialized,
            body: msg.body,
            timestamp: msg.timestamp,
            from: msg.from,
            to: msg.to,
            hasMedia: msg.hasMedia,
            type: msg.type,
            isForwarded: msg.isForwarded,
            forwardingScore: msg.forwardingScore,
            isStatus: msg.isStatus,
            isStarred: msg.isStarred,
            broadcast: msg.broadcast,
            fromMe: msg.fromMe,
            hasQuotedMsg: msg.hasQuotedMsg,
            vCards: msg.vCards,
            mentionedIds: msg.mentionedIds,
            links: msg.links
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reply to a message
router.post('/:messageId/reply', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { message, mediaUrl } = req.body;

        if (!message && !mediaUrl) {
            return res.status(400).json({ error: 'Message or media URL is required' });
        }

        const quotedMessage = await whatsappClient.getMessageById(messageId);
        if (!quotedMessage) {
            return res.status(404).json({ error: 'Quoted message not found' });
        }

        let content = message;
        let options = { quotedMessageId: messageId };

        if (mediaUrl) {
            try {
                content = await MessageMedia.fromUrl(mediaUrl);
                options.caption = message;
            } catch (error) {
                return res.status(400).json({ error: 'Failed to load media from URL' });
            }
        }

        const result = await quotedMessage.reply(content, undefined, options);

        res.json({
            messageId: result.id._serialized,
            timestamp: result.timestamp,
            status: 'sent'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Star/unstar a message
router.post('/:messageId/star', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { star = true } = req.body;

        const message = await whatsappClient.getMessageById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        await message.star(star);
        res.json({ message: `Message ${star ? 'starred' : 'unstarred'} successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a message
router.delete('/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { everyone = false } = req.query;

        const message = await whatsappClient.getMessageById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        await message.delete(everyone);
        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// React to a message
router.post('/:messageId/react', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { reaction } = req.body;

        if (!reaction) {
            return res.status(400).json({ error: 'Reaction emoji is required' });
        }

        const message = await whatsappClient.getMessageById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        await message.react(reaction);
        res.json({ message: 'Reaction added successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reply to a message
router.post('/reply', async (req, res) => {
    const { messageId, body } = req.body;

    if (!messageId || !body) {
        return res.status(400).json({ 
            error: 'Missing required fields: messageId, body' 
        });
    }

    try {
        // Get the message by ID
        const message = await whatsappClient.getMessageById(messageId);
        if (!message) {
            return res.status(404).json({ 
                error: 'Message not found' 
            });
        }

        // Send the reply
        const reply = await message.reply(body);
        
        logger.info(`Reply sent to message ${messageId}`);
        
        res.json({
            success: true,
            messageId: reply.id,
            timestamp: reply.timestamp,
            from: reply.from,
            to: reply.to
        });

    } catch (error) {
        logger.error('Failed to send reply:', error);
        res.status(500).json({ 
            error: 'Failed to send reply',
            details: error.message 
        });
    }
});

// Quote reply to a message
router.post('/quote', async (req, res) => {
    const { messageId, body } = req.body;

    if (!messageId || !body) {
        return res.status(400).json({ 
            error: 'Missing required fields: messageId, body' 
        });
    }

    try {
        // Get the message by ID
        const message = await whatsappClient.getMessageById(messageId);
        if (!message) {
            return res.status(404).json({ 
                error: 'Message not found' 
            });
        }

        // Send the reply with quote
        const chat = await message.getChat();
        const reply = await chat.sendMessage(body, {
            quotedMessageId: messageId
        });
        
        logger.info(`Quote reply sent to message ${messageId}`);
        
        res.json({
            success: true,
            messageId: reply.id,
            timestamp: reply.timestamp,
            from: reply.from,
            to: reply.to,
            quotedMessageId: messageId
        });

    } catch (error) {
        logger.error('Failed to send quote reply:', error);
        res.status(500).json({ 
            error: 'Failed to send quote reply',
            details: error.message 
        });
    }
});

// Add this endpoint to download message media
router.get('/:messageId/media', async (req, res) => {
    try {
        const { messageId } = req.params;
        
        const message = await whatsappClient.getMessageById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (!message.hasMedia) {
            return res.status(400).json({ error: 'Message has no media attachment' });
        }

        const media = await message.downloadMedia();
        if (!media) {
            return res.status(404).json({ error: 'Media not found or expired' });
        }

        // Set appropriate headers based on media type
        res.setHeader('Content-Type', media.mimetype);
        res.setHeader('Content-Disposition', `attachment; filename="${media.filename || 'attachment'}`);
        
        // Convert base64 to buffer and send
        const buffer = Buffer.from(media.data, 'base64');
        res.send(buffer);

    } catch (error) {
        logger.error('Failed to download media:', error);
        res.status(500).json({ 
            error: 'Failed to download media',
            details: error.message 
        });
    }
});

module.exports = { router, initialize }; 