const express = require('express');
const router = express.Router();

// Reference to WhatsApp client (will be set from app.js)
let whatsappClient;

// Initialize the router with required dependencies
function initialize(client) {
    whatsappClient = client;
}

// Helper function to get self chat ID
async function getSelfChatId() {
    if (!whatsappClient.info) {
        throw new Error('WhatsApp client not ready');
    }
    return whatsappClient.info.wid._serialized;
}

// List all chats
router.get('/', async (req, res) => {
    try {
        const { unreadOnly = false } = req.query;
        const chats = await whatsappClient.getChats();
        
        let filteredChats = chats;
        if (unreadOnly === 'true') {
            filteredChats = chats.filter(chat => chat.unreadCount > 0);
        }

        res.json(filteredChats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name,
            isGroup: chat.isGroup,
            timestamp: chat.timestamp,
            unreadCount: chat.unreadCount,
            lastMessage: chat.lastMessage ? {
                body: chat.lastMessage.body,
                timestamp: chat.lastMessage.timestamp
            } : null,
            pinned: chat.pinned,
            muteExpiration: chat.muteExpiration,
            isReadOnly: chat.isReadOnly,
            isMuted: chat.isMuted
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get specific chat details
router.get('/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        let targetChatId = chatId;

        // Handle special case for self chat
        if (chatId === 'me' || chatId === 'self') {
            targetChatId = await getSelfChatId();
        }

        const chat = await whatsappClient.getChatById(targetChatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        const response = {
            id: chat.id._serialized,
            name: chat.name,
            isGroup: chat.isGroup,
            timestamp: chat.timestamp,
            unreadCount: chat.unreadCount,
            pinned: chat.pinned,
            muteExpiration: chat.muteExpiration,
            isReadOnly: chat.isReadOnly,
            isMuted: chat.isMuted
        };

        if (chat.isGroup) {
            const groupMetadata = await chat.getMetadata();
            response.groupMetadata = {
                owner: groupMetadata.owner?._serialized,
                participants: groupMetadata.participants.map(p => ({
                    id: p.id._serialized,
                    isAdmin: p.isAdmin,
                    isSuperAdmin: p.isSuperAdmin
                })),
                description: groupMetadata.desc,
                createdAt: groupMetadata.createdAt
            };
        }

        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get messages from a specific chat
router.get('/:chatId/messages', async (req, res) => {
    try {
        const { chatId } = req.params;
        const { limit = 50, fromMe } = req.query;

        let targetChatId = chatId;

        // Handle special case for self chat
        if (chatId === 'me' || chatId === 'self') {
            targetChatId = await getSelfChatId();
        }

        const chat = await whatsappClient.getChatById(targetChatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

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

// Start a new chat
router.post('/new', async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Format phone number to ensure it includes country code
        const formattedPhone = phone.includes('@c.us') ? phone : `${phone}@c.us`;
        const chat = await whatsappClient.getChatById(formattedPhone);

        // Check if the number exists on WhatsApp
        const contact = await whatsappClient.getContactById(formattedPhone);
        if (!contact.exists) {
            return res.status(404).json({ error: 'Phone number not registered on WhatsApp' });
        }

        res.json({
            id: chat.id._serialized,
            name: chat.name,
            exists: contact.exists,
            pushname: contact.pushname,
            number: contact.number
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a group
router.post('/group', async (req, res) => {
    try {
        const { name, participants } = req.body;

        if (!name || !participants || !Array.isArray(participants) || participants.length === 0) {
            return res.status(400).json({ error: 'Group name and at least one participant are required' });
        }

        // Format participant numbers
        const formattedParticipants = participants.map(p => 
            p.includes('@c.us') ? p : `${p}@c.us`
        );

        const group = await whatsappClient.createGroup(name, formattedParticipants);
        res.json({
            id: group.gid._serialized,
            name: group.title,
            owner: group.owner._serialized,
            creation: group.creation
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mute/unmute chat
router.post('/:chatId/mute', async (req, res) => {
    try {
        const { chatId } = req.params;
        const { duration = 8 * 60 * 60 } = req.body; // Default: 8 hours in seconds

        let targetChatId = chatId;

        // Handle special case for self chat
        if (chatId === 'me' || chatId === 'self') {
            targetChatId = await getSelfChatId();
        }

        const chat = await whatsappClient.getChatById(targetChatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        await chat.mute(duration);
        res.json({ message: `Chat muted for ${duration} seconds` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Pin/unpin chat
router.post('/:chatId/pin', async (req, res) => {
    try {
        const { chatId } = req.params;
        const { pin = true } = req.body;

        let targetChatId = chatId;

        // Handle special case for self chat
        if (chatId === 'me' || chatId === 'self') {
            targetChatId = await getSelfChatId();
        }

        const chat = await whatsappClient.getChatById(targetChatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        await chat.pin(pin);
        res.json({ message: `Chat ${pin ? 'pinned' : 'unpinned'} successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark chat as read/unread
router.post('/:chatId/mark', async (req, res) => {
    try {
        const { chatId } = req.params;
        const { read = true } = req.body;

        let targetChatId = chatId;

        // Handle special case for self chat
        if (chatId === 'me' || chatId === 'self') {
            targetChatId = await getSelfChatId();
        }

        const chat = await whatsappClient.getChatById(targetChatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        if (read) {
            await chat.markAsRead();
        } else {
            await chat.markAsUnread();
        }

        res.json({ message: `Chat marked as ${read ? 'read' : 'unread'}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Archive chat
router.post('/:chatId/archive', async (req, res) => {
    try {
        const { chatId } = req.params;
        const { archive = true } = req.body;

        let targetChatId = chatId;

        // Handle special case for self chat
        if (chatId === 'me' || chatId === 'self') {
            targetChatId = await getSelfChatId();
        }

        const chat = await whatsappClient.getChatById(targetChatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        if (archive) {
            await chat.archive();
        } else {
            await chat.unarchive();
        }

        res.json({ message: `Chat ${archive ? 'archived' : 'unarchived'} successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete chat
router.delete('/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;

        let targetChatId = chatId;

        // Handle special case for self chat
        if (chatId === 'me' || chatId === 'self') {
            targetChatId = await getSelfChatId();
        }

        const chat = await whatsappClient.getChatById(targetChatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        await chat.delete();
        res.json({ message: 'Chat deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = { router, initialize }; 