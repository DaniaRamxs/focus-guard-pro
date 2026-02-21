/**
 * Manejo de persistencia local para FocusGuard Pro
 */
const Storage = {
    /**
     * Guarda una sesión finalizada en el historial
     */
    saveSession(sessionData) {
        const history = this.getHistory();
        history.push({
            ...sessionData,
            timestamp: new Date().toISOString(),
            id: Date.now().toString()
        });
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(history));
    },

    /**
     * Obtiene todo el historial de sesiones
     */
    getHistory() {
        const data = localStorage.getItem(CONFIG.STORAGE_KEY);
        try {
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Error parsing history", e);
            return [];
        }
    },

    /**
     * Obtiene estadísticas agregadas
     */
    getStats() {
        const history = this.getHistory();
        if (history.length === 0) return null;

        const totalFocus = history.reduce((acc, s) => acc + s.avgFocus, 0);
        const totalDuration = history.reduce((acc, s) => acc + s.durationMinutes, 0);

        return {
            avgFocus: Math.round(totalFocus / history.length),
            totalDurationHours: Math.round(totalDuration / 60 * 10) / 10,
            sessionCount: history.length,
            lastSession: history[history.length - 1]
        };
    },

    /**
     * Limpia el historial (opcional)
     */
    clearHistory() {
        localStorage.removeItem(CONFIG.STORAGE_KEY);
    }
};
