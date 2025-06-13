require('dotenv').config();

module.exports = {
    botToken: process.env.BOT_TOKEN,
    // Добавьте здесь другие настройки
    logging: {
        enabled: true,
        level: 'info'
    },
    // Настройки для фильтрации заявок
    joinRequests: {
        autoApprove: true,
        // Можно добавить дополнительные правила
        rules: {
            minAccountAge: 0, // в днях
            requireUsername: false
        }
    },
    // Настройки администраторов
    admins: {
        // ID администраторов (добавьте свой ID)
        ids: [process.env.ADMIN_ID], // Ваш Telegram ID
        // ID владельца канала (добавьте ID канала)
        channelOwnerId: process.env.CHANNEL_OWNER_ID
    }
}; 