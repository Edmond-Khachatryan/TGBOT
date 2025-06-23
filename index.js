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
        const admins = await bot.getChatAdministrators(chat.id);
        const text = `✅ Новый участник @${from.username || from.first_name} вступил в канал "${chat.title}"`;
        // Уведомление всем админам
        for (const admin of admins) {
            if (!admin.user.is_bot) {
                bot.sendMessage(admin.user.id, text).catch(e => {
                    if (e.response && e.response.body && e.response.body.description &&
                        e.response.body.description.includes("can't initiate conversation")) {
                        console.log(`Бот не может написать пользователю ${admin.user.id} — он не начинал диалог с ботом.`);
                    } else {
                        console.log('Ошибка при отправке уведомления админу:', e);
                    }
                });
            }
        }
        // Уведомление тебе лично
        if (!admins.some(a => a.user.id === 734296259)) {
            bot.sendMessage(734296259, text).catch(e => {
                if (e.response && e.response.body && e.response.body.description &&
                    e.response.body.description.includes("can't initiate conversation")) {
                    console.log('Бот не может написать тебе — ты не начинал диалог с ботом.');
                } else {
                    console.log('Ошибка при отправке уведомления тебе:', e);
                }
            });
        }
    } catch (error) {
        console.log('Ошибка при одобрении заявки или отправке уведомления:', error);
    }
});

process.on('exit', (code) => {
    console.log('Процесс завершён с кодом:', code);
});

const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🛒 Каталог услуг', callback_data: 'catalog' }],
      [{ text: '📝 Оформить заказ', callback_data: 'order' }],
      [{ text: '💬 Контакты', callback_data: 'contact' }],
      [{ text: '💳 Оплата', callback_data: 'payment' }]
    ]
  }
};

const services = [
  { name: 'Услуга', description: 'Этот бот автоматически принимает заявки на вступление в канал/группу.\n\nЕсли вы хотите добавить больше функций или заказать индивидуального Telegram-бота — свяжитесь со мной для обсуждения деталей!', price: '5$' },
];

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    '👋 Добро пожаловать! Я помогу вам выбрать и заказать услугу.\n\nВыберите нужный раздел:',
    mainMenu
  );
});

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;

  if (query.data === 'catalog') {
    let text = '🛒 <b>Каталог услуг</b>\n\n';
    services.forEach((s, i) => {
      text += `• <b>${s.name}</b>\n${s.description}\nЦена: ${s.price}\n\n`;
    });
    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  }

  if (query.data === 'order') {
    bot.sendMessage(
      chatId,
      'Пожалуйста, напишите, какую услугу вы хотите заказать и ваши контактные данные. Мы свяжемся с вами для подтверждения заказа.'
    );
  }

  if (query.data === 'contact') {
    bot.sendMessage(
      chatId,
      'Связаться с нами можно по Telegram: @edmondkhach \n или по email: edmond2001@mail.ru'
    );
  }

  if (query.data === 'payment') {
    bot.sendMessage(
      chatId,
      'Оплатить услугу можно переводом на карту: 4355 0539 2430 9794'
    );
  }

  bot.answerCallbackQuery(query.id);
});