const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

const AUTH_KEY_FILE = '.auth_key';

function generateAuthKey() {
    return crypto.randomBytes(32).toString('hex');
}

function getOrCreateAuthKey() {
    try {
        // Try to read existing auth key
        if (fs.existsSync(AUTH_KEY_FILE)) {
            const key = fs.readFileSync(AUTH_KEY_FILE, 'utf8').trim();
            if (key) {
                logger.info('Using existing authentication key');
                return key;
            }
        }

        // Generate new auth key
        const newKey = generateAuthKey();
        fs.writeFileSync(AUTH_KEY_FILE, newKey);
        logger.info('Generated new authentication key');
        return newKey;
    } catch (error) {
        logger.error('Error managing authentication key:', error);
        throw error;
    }
}

module.exports = {
    getOrCreateAuthKey,
    generateAuthKey
}; 