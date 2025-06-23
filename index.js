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

// === Новое минималистичное меню ===

const infoText = 'Этот бот автоматически принимает заявки на вступление в канал/группу.\n\nЕсли вы хотите добавить больше функций или заказать индивидуального Telegram-бота — свяжитесь с создателем.';
const infoTextHy = 'Այս բոտը ավտոմատ կերպով ընդունում է խմբի կամ ալիքի միանալու հայտերը։\n\nԵթե ցանկանում եք ավելացնել ֆունկցիոնալ կամ պատվիրել անհատական Telegram-բոտ — կապվեք ստեղծողի հետ։';

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['ℹ️ Информация', '🌐 Перевод', '📝 Заказать']
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    'Добро пожаловать! Используйте меню ниже для взаимодействия с ботом.',
    mainMenu
  );
});

bot.on('message', (msg) => {
  const text = msg.text;
  if (text === 'ℹ️ Информация') {
    bot.sendMessage(msg.chat.id, infoText);
  } else if (text === '🌐 Перевод') {
    bot.sendMessage(msg.chat.id, infoTextHy);
  } else if (text === '📝 Заказать') {
    bot.sendInvoice(
      msg.chat.id,
      'Заказ Telegram-бота',
      'Оплата за автоматического Telegram-бота для приёма заявок',
      'order_payload_001', // payload для проверки платежа
      config.paymentProviderToken,
      'USD', // Валюта
      [
        {
          label: 'Telegram-бот',
          amount: 1000 // 10.00 USD (в центах)
        }
      ],
      {
        need_name: true,
        need_email: true
      }
    );
  }
});

// Обработка pre_checkout_query и успешного платежа
bot.on('pre_checkout_query', (query) => {
  bot.answerPreCheckoutQuery(query.id, true);
});

bot.on('successful_payment', (msg) => {
  bot.sendMessage(
    msg.chat.id,
    'Спасибо за оплату! Мы свяжемся с вами для уточнения деталей заказа.'
  );
});