const config = require('./config');

class Logger {
    static log(message, type = 'info') {
        if (!config.logging.enabled) return;

        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;

        switch (type.toLowerCase()) {
            case 'error':
                console.error(logMessage);
                break;
            case 'warn':
                console.warn(logMessage);
                break;
            case 'success':
                console.log(`✅ ${logMessage}`);
                break;
            default:
                console.log(logMessage);
        }
    }

    static error(message) {
        this.log(message, 'error');
    }

    static warn(message) {
        this.log(message, 'warn');
    }

    static success(message) {
        this.log(message, 'success');
    }
}

module.exports = Logger; 