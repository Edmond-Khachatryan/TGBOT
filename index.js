const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const express = require('express');
const app = express();

// Проверяем наличие токена
if (!config.botToken) {
    process.exit(1);
}

// Создаем Express приложение
app.use(express.json());

// Получаем URL из переменных окружения Render
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!WEBHOOK_URL) {
    process.exit(1);
}

// Инициализируем бота
const bot = new TelegramBot(config.botToken);

// Настраиваем webhook
const webhookUrl = `${WEBHOOK_URL}/bot${config.botToken}`;
bot.deleteWebHook()
    .then(() => {
        return bot.setWebHook(webhookUrl, {
            drop_pending_updates: true,
            allowed_updates: ['message', 'chat_join_request'],
            max_connections: 1,
            ip_address: WEBHOOK_URL.replace('https://', '').split('/')[0]
        });
    })
    .then(() => {
        return bot.getWebHookInfo();
    })
    .catch((error) => {
        process.exit(1);
    });

// Обработка webhook запросов
app.post(`/bot${config.botToken}`, (req, res) => {
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
const server = app.listen(PORT, '0.0.0.0');

// Добавляем обработку ошибок при запуске сервера
server.on('error', (error) => {
    process.exit(1);
});

// Обработка завершения работы
process.on('SIGTERM', () => {
    server.close(() => {
        process.exit(0);
    });
});

// Обработка необработанных ошибок
process.on('uncaughtException', () => {
});

process.on('unhandledRejection', () => {
});

// Оставляю только обработчик chat_join_request
bot.on('chat_join_request', async (msg) => {
    const { chat, from } = msg;
    try {
        await bot.approveChatJoinRequest(chat.id, from.id);
    } catch (error) {
    }
});