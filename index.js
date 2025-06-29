const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const express = require('express');
const app = express();
const fs = require('fs');
const USERS_FILE = './users.json';
const ADMIN_ID = 734296259; // замените на ваш Telegram user_id
const ALLOWED_CHATS_FILE = './allowed_chats.json';

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

// Удаляем MongoDB и используем обычный массив для allowedChats
let allowedChats = [-1002698711606]; // основной канал всегда разрешён

bot.onText(/\/allow (.+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const chatId = parseInt(match[1]);
  if (!allowedChats.includes(chatId)) {
    allowedChats.push(chatId);
  }
  bot.sendMessage(msg.chat.id, `✅ Разрешено для чата ${chatId}`, {});
});

bot.onText(/\/disallow (.+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const chatId = parseInt(match[1]);
  allowedChats = allowedChats.filter(id => id !== chatId);
  bot.sendMessage(msg.chat.id, `❌ Запрещено для чата ${chatId}`, {});
});

bot.onText(/\/list/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  bot.sendMessage(msg.chat.id, `Список разрешённых чатов:\n${allowedChats.join('\n')}`, {});
});

// Обработка заявки на вступление
bot.on('chat_join_request', async (msg) => {
    const { chat, from } = msg;
    if (!allowedChats.includes(chat.id)) {
        // Не разрешено — ничего не делаем
        return;
    }
    try {
        // Сначала одобряем заявку
        await bot.approveChatJoinRequest(chat.id, from.id);
        // Затем отправляем рекламное сообщение (если получится)
        await bot.sendMessage(
            from.id,
            '👋 Привет! Спасибо за вступление! Подпишитесь на нашего Telegram-бота и обязательно напишите /start в чате с ним: @helper_zapros_bot\n\nЭто поможет вам получать важные уведомления.'
        ).catch(e => {
            if (
                e.response &&
                e.response.body &&
                e.response.body.description &&
                (
                    e.response.body.description.includes("can't initiate conversation") ||
                    e.response.body.description.includes("bot was blocked by the user")
                )
            ) {
                console.log(`Бот не может написать пользователю ${from.id} — он не начинал диалог с ботом или заблокировал бота.`);
            } else {
                console.log('Ошибка при отправке рекламного сообщения:', e);
            }
        });
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

const infoText = '🤖 <b>АвтоБот для Telegram</b>\n\nЭтот бот <b>автоматически принимает заявки</b> на вступление в канал или группу.\n\n✨ <b>Возможности:</b>\n• Мгновенное одобрение заявок\n• Уведомления администраторам\n• Работа 24/7 без вашего участия\n\n💡 <i>Хотите больше функций или индивидуального Telegram-бота?</i>\nСвяжитесь с создателем!';
const infoTextHy = '🤖 <b>Telegram-ի ավտոմատ բոտ</b>\n\nԱյս բոտը <b>ավտոմատ կերպով ընդունում է</b> խմբի կամ ալիքի միանալու հայտերը։\n\n✨ <b>Հնարավորություններ՝</b>\n• Հայտերի ակնթարթային հաստատում\n• Ծանուցումներ ադմիններին\n• Աշխատում է 24/7\n\n💡 <i>Ցանկանու՞մ եք ավելացնել ֆունկցիոնալ կամ պատվիրել անհատական բոտ։</i>\nԿապվեք ստեղծողի հետ։';
const infoTextEn = '🤖 <b>AutoBot for Telegram</b>\n\nThis bot <b>automatically approves join requests</b> to your channel or group.\n\n✨ <b>Features:</b>\n• Instant join approval\n• Admin notifications\n• 24/7 operation, no manual work needed\n\n💡 <i>Want more features or a custom Telegram bot?</i>\nContact the creator!';

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['ℹ️ Информация', '🇦🇲 ARM', '🇺🇸 US', '📝 Заказать']
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};

// Функция для проверки, является ли чат приватным
function isPrivateChat(chat) {
  return chat.type === 'private';
}

bot.onText(/\/start/, (msg) => {
  const options = isPrivateChat(msg.chat) ? mainMenu : {};
  bot.sendMessage(
    msg.chat.id,
    'Добро пожаловать! Используйте меню ниже для взаимодействия с ботом.',
    options
  );
});

bot.on('message', (msg) => {
  if (!isPrivateChat(msg.chat)) return;
  addUser(msg.from.id);
  
  const text = msg.text;
  if (text === 'ℹ️ Информация') {
    bot.sendMessage(msg.chat.id, infoText, { parse_mode: 'HTML' });
  } else if (text === '🇦🇲 ARM') {
    bot.sendMessage(msg.chat.id, infoTextHy, { parse_mode: 'HTML' });
  } else if (text === '🇺🇸 US') {
    bot.sendMessage(msg.chat.id, infoTextEn, { parse_mode: 'HTML' });
  } else if (text === '📝 Заказать') {
    bot.sendMessage(
      msg.chat.id,
      'Для заказа или расширения функционала бота свяжитесь с создателем:\nTelegram: @edmondkhach\nEmail: edmond2001@mail.ru'
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
    'Спасибо за оплату! Мы свяжемся с вами для уточнения деталей заказа.',
    {}
  );
});

function addUser(userId) {
  let users = [];
  if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  }
  if (!users.includes(userId)) {
    users.push(userId);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users));
  }
}

function getUsers() {
  if (fs.existsSync(USERS_FILE)) {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  }
  return [];
}

bot.onText(/\/users/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  const users = getUsers();
  bot.sendMessage(msg.chat.id, `👥 В боте всего пользователей: ${users.length}\n\nID пользователей:\n${users.join(', ')}`, {});
});