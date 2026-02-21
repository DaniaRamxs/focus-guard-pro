/**
 * Gestor del temporizador Pomodoro Adaptativo
 */
class PomodoroTimer {
    constructor(onTick, onComplete) {
        this.onTick = onTick;
        this.onComplete = onComplete;

        this.workDuration = 25 * 60;   // guardado para reset y ciclos
        this.breakDuration = 5 * 60;
        this.timeLeft = this.workDuration;
        this.isActive = false;
        this.interval = null;
        this.mode = 'WORK';
    }

    start(minutes) {
        clearInterval(this.interval);
        this.workDuration = minutes * 60;
        // Descanso = 1/5 del tiempo de trabajo, mínimo 5 min (regla Pomodoro)
        this.breakDuration = Math.max(5, Math.round(minutes / 5)) * 60;
        this.timeLeft = this.workDuration;
        this.isActive = true;
        this.mode = 'WORK';
        this.run();
    }

    startBreak() {
        clearInterval(this.interval);
        this.timeLeft = this.breakDuration;
        this.isActive = true;
        this.mode = 'BREAK';
        this.run();
    }

    toggle() {
        this.isActive = !this.isActive;
        if (!this.isActive) {
            clearInterval(this.interval);
        } else {
            this.run();
        }
    }

    /**
     * Salta el bloque actual y dispara onComplete para cambiar de modo
     */
    skip() {
        clearInterval(this.interval);
        this.isActive = false;
        this.onComplete(this.mode);
    }

    /**
     * Reinicia el bloque actual sin cambiar de modo
     */
    reset() {
        clearInterval(this.interval);
        this.isActive = false;
        this.timeLeft = this.mode === 'WORK' ? this.workDuration : this.breakDuration;
        this.onTick(this.timeLeft, this.mode);
    }

    run() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
            if (this.timeLeft > 0) {
                this.timeLeft--;
                this.onTick(this.timeLeft, this.mode);
            } else {
                this.isActive = false;
                clearInterval(this.interval);
                this.onComplete(this.mode);
            }
        }, 1000);
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
}
