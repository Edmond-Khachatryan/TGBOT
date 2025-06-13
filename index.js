const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const Logger = require('./logger');
const stats = require('./stats');

const bot = new TelegramBot(config.botToken, { polling: true });

Logger.success('Бот запущен и готов к работе!');

// Функция проверки прав доступа
function isAdmin(userId) {
    return config.admins.ids.includes(userId.toString()) || 
           userId.toString() === config.admins.channelOwnerId;
}

// Обработка команды /stats
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Проверка прав доступа
    if (!isAdmin(userId)) {
        try {
            await bot.sendMessage(chatId, '⛔ У вас нет прав для просмотра статистики.');
            Logger.warn(`Попытка доступа к статистике от неавторизованного пользователя ${userId}`);
            return;
        } catch (error) {
            Logger.error(`Ошибка при отправке сообщения: ${error.message}`);
            return;
        }
    }

    const statsData = stats.getStats();
    
    let message = '📊 *Статистика одобренных заявок*\n\n';
    message += `Всего одобрено: ${statsData.total}\n`;
    message += `Сегодня: ${statsData.today}\n`;
    message += `За неделю: ${statsData.thisWeek}\n`;
    message += `За месяц: ${statsData.thisMonth}\n\n`;
    
    message += '*Топ пользователей:*\n';
    statsData.topUsers.forEach((user, index) => {
        message += `${index + 1}. @${user.username}: ${user.count}\n`;
    });
    
    message += '\n*Статистика за последние 7 дней:*\n';
    Object.entries(statsData.dailyStats).forEach(([date, count]) => {
        message += `${date}: ${count}\n`;
    });

    try {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
        Logger.error(`Ошибка при отправке статистики: ${error.message}`);
    }
});

bot.on('chat_join_request', async (msg) => {
    const { chat, from } = msg;

    try {
        // Проверка правил вступления
        if (config.joinRequests.rules.requireUsername && !from.username) {
            Logger.warn(`Отклонена заявка от ${from.first_name} - отсутствует username`);
            return;
        }

        // Автоматическое одобрение
        if (config.joinRequests.autoApprove) {
            await bot.approveChatJoinRequest(chat.id, from.id);
            const username = from.username || from.first_name;
            stats.addApprovedRequest(username, chat.title);
            Logger.success(`Одобрена заявка от @${username} в ${chat.title}`);
        }
    } catch (error) {
        Logger.error(`Ошибка при обработке заявки: ${error.message}`);
    }
});

// Обработка ошибок
process.on('uncaughtException', (error) => {
    Logger.error(`Необработанная ошибка: ${error.message}`);
});

process.on('unhandledRejection', (error) => {
    Logger.error(`Необработанное отклонение: ${error.message}`);
});