const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const express = require('express');
const app = express();

console.log('BOT_TOKEN:', config.botToken);
console.log('WEBHOOK_URL:', process.env.WEBHOOK_URL);

// Проверяем наличие токена
if (!config.botToken) {
    console.log('Нет BOT_TOKEN!');
    process.exit(1);
}

// Создаем Express приложение
app.use(express.json());

// Получаем URL из переменных окружения Render
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!WEBHOOK_URL) {
    console.log('Нет WEBHOOK_URL!');
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
            max_connections: 1
        });
    })
    .then(() => {
        return bot.getWebHookInfo();
    })
    .catch((error) => {
        console.log('Ошибка при настройке webhook:', error);
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
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express сервер запущен на порту ${PORT}`);
});

server.on('error', (error) => {
    console.log('Ошибка при запуске сервера:', error);
});

console.log('Бот запущен и готов принимать заявки!');

// Обработка завершения работы
process.on('SIGTERM', () => {
    console.log('Бот выключается (SIGTERM)');
    server.close(() => {
        process.exit(0);
    });
});

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
    console.log('Произошла необработанная ошибка:', error);
});

process.on('unhandledRejection', (error) => {
    console.log('Произошёл необработанный отказ в промисе:', error);
});

// Обработка заявки на вступление
bot.on('chat_join_request', async (msg) => {
    const { chat, from } = msg;
    try {
        await bot.approveChatJoinRequest(chat.id, from.id);

        // Получаем список админов
        const admins = await bot.getChatAdministrators(chat.id);

        // Формируем текст уведомления
        const text = `✅ Новый участник @${from.username || from.first_name} вступил в канал "${chat.title}"`;

        // Отправляем уведомление каждому админу (кроме бота)
        for (const admin of admins) {
            if (!admin.user.is_bot) {
                await bot.sendMessage(admin.user.id, text);
            }
        }
    } catch (error) {
        console.log('Ошибка при одобрении заявки или отправке уведомления:', error);
    }
});

process.on('exit', (code) => {
    console.log('Процесс завершён с кодом:', code);
});