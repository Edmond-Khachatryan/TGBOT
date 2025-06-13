class Stats {
    constructor() {
        this.stats = {
            totalApproved: 0,
            approvedToday: 0,
            approvedThisWeek: 0,
            approvedThisMonth: 0,
            lastReset: new Date(),
            dailyStats: {},
            userStats: {}
        };
    }

    // Добавление новой одобренной заявки
    addApprovedRequest(username, chatTitle) {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Обновляем общую статистику
        this.stats.totalApproved++;
        this.stats.approvedToday++;
        this.stats.approvedThisWeek++;
        this.stats.approvedThisMonth++;

        // Обновляем статистику по дням
        if (!this.stats.dailyStats[today]) {
            this.stats.dailyStats[today] = 0;
        }
        this.stats.dailyStats[today]++;

        // Обновляем статистику по пользователям
        if (!this.stats.userStats[username]) {
            this.stats.userStats[username] = 0;
        }
        this.stats.userStats[username]++;

        // Проверяем необходимость сброса счетчиков
        this.checkAndResetCounters(now);
    }

    // Проверка и сброс счетчиков
    checkAndResetCounters(now) {
        const lastReset = new Date(this.stats.lastReset);
        
        // Сброс дневного счетчика
        if (now.getDate() !== lastReset.getDate()) {
            this.stats.approvedToday = 0;
        }

        // Сброс недельного счетчика
        if (this.getWeekNumber(now) !== this.getWeekNumber(lastReset)) {
            this.stats.approvedThisWeek = 0;
        }

        // Сброс месячного счетчика
        if (now.getMonth() !== lastReset.getMonth()) {
            this.stats.approvedThisMonth = 0;
        }

        this.stats.lastReset = now;
    }

    // Получение номера недели
    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        return Math.ceil((((date - firstDayOfYear) / 86400000) + firstDayOfYear.getDay() + 1) / 7);
    }

    // Получение статистики
    getStats() {
        return {
            total: this.stats.totalApproved,
            today: this.stats.approvedToday,
            thisWeek: this.stats.approvedThisWeek,
            thisMonth: this.stats.approvedThisMonth,
            topUsers: this.getTopUsers(5),
            dailyStats: this.getLastDaysStats(7)
        };
    }

    // Получение топ пользователей
    getTopUsers(limit = 5) {
        return Object.entries(this.stats.userStats)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([username, count]) => ({ username, count }));
    }

    // Получение статистики за последние дни
    getLastDaysStats(days) {
        const result = {};
        const now = new Date();
        
        for (let i = 0; i < days; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            result[dateStr] = this.stats.dailyStats[dateStr] || 0;
        }

        return result;
    }
}

module.exports = new Stats(); 