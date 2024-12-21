const fs = require('fs');
const path = require('path');

const AUTH_FILE = path.join(process.cwd(), '.auth_key');

function getTestAuthKey() {
    try {
        if (fs.existsSync(AUTH_FILE)) {
            return fs.readFileSync(AUTH_FILE, 'utf8').trim();
        }
        throw new Error('.auth_key file not found. Please ensure it exists before running tests.');
    } catch (error) {
        console.error('Failed to load auth key:', error);
        throw error;
    }
}

module.exports = {
    getTestAuthKey
}; 