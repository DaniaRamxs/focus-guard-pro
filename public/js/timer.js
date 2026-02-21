/**
 * Gestor del temporizador Pomodoro Adaptativo
 */
class PomodoroTimer {
    constructor(onTick, onComplete) {
        this.onTick = onTick;
        this.onComplete = onComplete;

        this.timeLeft = 25 * 60;
        this.isActive = false;
        this.interval = null;
        this.mode = 'WORK'; // WORK, BREAK
    }

    start(minutes) {
        this.timeLeft = minutes * 60;
        this.isActive = true;
        this.mode = 'WORK';
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

    reset() {
        clearInterval(this.interval);
        this.isActive = false;
        this.onTick(this.timeLeft);
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
