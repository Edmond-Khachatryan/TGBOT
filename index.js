const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
// const Logger = require('./logger');
// const stats = require('./stats');
const express = require('express');
const app = express();

// // Добавляем логирование при старте
// Logger.log('Starting bot initialization...');
// Logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
// Logger.log(`Port: ${process.env.PORT || 3000}`);
// Logger.log(`Webhook URL: ${process.env.WEBHOOK_URL || 'not set'}`);

// Проверяем наличие токена
if (!config.botToken) {
    // Logger.error('BOT_TOKEN is not set in environment variables');
    process.exit(1);
}

// Создаем Express приложение
app.use(express.json());

// Получаем URL из переменных окружения Render
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!WEBHOOK_URL) {
    // Logger.error('WEBHOOK_URL environment variable is not set');
    process.exit(1);
}

// Инициализируем бота
const bot = new TelegramBot(config.botToken);

// Настраиваем webhook
const webhookUrl = `${WEBHOOK_URL}/bot${config.botToken}`;
// Logger.log(`Setting webhook to: ${webhookUrl}`);

// Отключаем все существующие webhook'и и polling
bot.deleteWebHook()
    .then(() => {
        // Logger.log('Existing webhook removed');
        return bot.setWebHook(webhookUrl, {
            drop_pending_updates: true,
            allowed_updates: ['message', 'chat_join_request'],
            max_connections: 1,
            ip_address: WEBHOOK_URL.replace('https://', '').split('/')[0]
        });
    })
    .then(() => {
        // Logger.success('Webhook successfully set');
        return bot.getWebHookInfo();
    })
    .then((info) => {
        // Logger.log('Webhook info:', info);
    })
    .catch((error) => {
        // Logger.error(`Failed to set webhook: ${error.message}`);
        process.exit(1);
    });

// Обработка webhook запросов
app.post(`/bot${config.botToken}`, (req, res) => {
    // Logger.log('Received webhook request');
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Добавляем health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        webhook_url: WEBHOOK_URL
    });
});

// Запускаем Express сервер
const server = app.listen(PORT, '0.0.0.0', () => {
    // Logger.success(`Сервер успешно запущен на порту ${PORT}`);
    // Logger.log(`Сервер доступен по адресу: http://0.0.0.0:${PORT}`);
    // Logger.log(`Health check endpoint: http://0.0.0.0:${PORT}/health`);
});

// Добавляем обработку ошибок при запуске сервера
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        // Logger.error(`Порт ${PORT} уже используется. Пожалуйста, выберите другой порт.`);
    } else {
        // Logger.error(`Ошибка при запуске сервера: ${error.message}`);
    }
    process.exit(1);
});

// Обработка завершения работы
process.on('SIGTERM', () => {
    // Logger.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        // Logger.log('HTTP server closed');
        process.exit(0);
    });
});

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
    // Logger.error(`Uncaught Exception: ${error.message}`);
    // Logger.error(error.stack);
});

process.on('unhandledRejection', (error) => {
    // Logger.error(`Unhandled Rejection: ${error.message}`);
    // Logger.error(error.stack);
});

// Оставляю только обработчик chat_join_request
bot.on('chat_join_request', async (msg) => {
    // Logger.log(`Received join request from ${msg.from.id}`);
    const { chat, from } = msg;

    try {
        await bot.approveChatJoinRequest(chat.id, from.id);
        // Logger.success(`Одобрена заявка от @${from.username || from.first_name} в ${chat.title}`);
    } catch (error) {
        // Logger.error(`Ошибка при обработке заявки: ${error.message}`);
    }
});