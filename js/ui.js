/**
 * Controlador de Interfaz (DOM y Charts)
 */
class UIController {
    constructor() {
        this.charts = {};
        this.initCharts();

        // Elementos DOM
        this.elements = {
            landingScreen: document.getElementById('landing-screen'),
            dashboardScreen: document.getElementById('dashboard-screen'),
            focusScore: document.getElementById('val-focus-score'),
            focusGauge: document.getElementById('focus-gauge-fill'),
            fatigueVal: document.getElementById('val-fatigue'),
            blinkRateVal: document.getElementById('val-blinks'),
            postureVal: document.getElementById('val-posture'),
            postureBar: document.getElementById('bar-posture'),
            distractionsVal: document.getElementById('val-distractions'),
            recText: document.getElementById('rec-text'),
            timerDisplay: document.getElementById('pomodoro-display'),
            sessionClock: document.getElementById('session-timer'),
            toast: document.getElementById('notification-toast'),
            toastMsg: document.getElementById('notif-message'),
            historyModal: document.getElementById('history-modal'),
            historyList: document.getElementById('history-list'),
            privateOverlay: document.getElementById('private-mode-overlay'),
            alertDistraction: document.getElementById('alert-distraction'),
            alertNoFace: document.getElementById('alert-no-face'),
            alertSleep: document.getElementById('alert-sleep')
        };

        this.audioCtx = null;
        this.alarmOsc = null;
    }

    initAudio() {
        if (this.audioCtx) return;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    startAlarm() {
        if (!this.audioCtx || this.alarmOsc) return;

        this.alarmOsc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        this.alarmOsc.type = 'sawtooth'; // Sonido agresivo para despertar
        this.alarmOsc.frequency.setValueAtTime(880, this.audioCtx.currentTime); // Nota La5

        // Efecto de pitido intermitente (beeping)
        gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);

        this.alarmOsc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        this.alarmOsc.start();
    }

    stopAlarm() {
        if (this.alarmOsc) {
            this.alarmOsc.stop();
            this.alarmOsc.disconnect();
            this.alarmOsc = null;
        }
    }

    setVisionAlert(type, show) {
        if (type === 'distraction') {
            this.elements.alertDistraction.style.display = show ? 'block' : 'none';
        } else if (type === 'no-face') {
            this.elements.alertNoFace.style.display = show ? 'block' : 'none';
        } else if (type === 'sleep') {
            this.elements.alertSleep.style.display = show ? 'block' : 'none';
            if (show) this.startAlarm();
            else this.stopAlarm();
        }
    }

    initCharts() {
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { display: false },
                x: { display: false }
            },
            plugins: { legend: { display: false } },
            elements: {
                line: { tension: 0.4, borderWidth: 2, borderColor: '#00f2ff' },
                point: { radius: 0 }
            },
            animation: false
        };

        this.charts.focus = new Chart(document.getElementById('focus-chart'), {
            type: 'line',
            data: { labels: Array(30).fill(''), datasets: [{ data: Array(30).fill(0), borderColor: '#00f2ff', fill: true, backgroundColor: 'rgba(0, 242, 255, 0.1)' }] },
            options: chartOptions
        });

        this.charts.blink = new Chart(document.getElementById('blink-chart'), {
            type: 'bar',
            data: { labels: Array(10).fill(''), datasets: [{ data: Array(10).fill(0), backgroundColor: '#8b5cf6' }] },
            options: chartOptions
        });

        this.charts.pose = new Chart(document.getElementById('pose-chart'), {
            type: 'line',
            data: {
                labels: Array(30).fill(''),
                datasets: [
                    { data: Array(30).fill(0), borderColor: '#00f2ff' },
                    { data: Array(30).fill(0), borderColor: '#8b5cf6' }
                ]
            },
            options: chartOptions
        });
    }

    updateDashboard(metrics, faceData) {
        // Métricas de texto
        this.elements.focusScore.textContent = metrics.focusScore;
        this.elements.fatigueVal.textContent = metrics.fatigueIndex;
        this.elements.blinkRateVal.textContent = metrics.blinkRate;
        this.elements.postureVal.textContent = `${metrics.postureStability}%`;
        this.elements.distractionsVal.innerHTML = `${metrics.cumulativeDistractionTime}<span style="font-size: 0.7rem; color: var(--text-muted);">s</span>`;

        // Gauge de Focus
        const offset = 282.7 - (metrics.focusScore / 100 * 282.7);
        this.elements.focusGauge.style.strokeDashoffset = offset;

        // Barra de postura
        this.elements.postureBar.style.width = `${metrics.postureStability}%`;
        this.elements.postureBar.style.backgroundColor = metrics.postureStability < 70 ? 'var(--warning)' : 'var(--accent-primary)';

        // Actualizar gráficas
        this.updateChartData(this.charts.focus, metrics.focusScore);
        this.updateChartData(this.charts.pose, faceData.pose.pitch, 0);
        this.updateChartData(this.charts.pose, faceData.pose.yaw, 1);

        // Blink chart
        if (Math.random() > 0.95) this.updateChartData(this.charts.blink, metrics.blinkRate);
    }

    updateChartData(chart, newValue, datasetIndex = 0) {
        chart.data.datasets[datasetIndex].data.push(newValue);
        chart.data.datasets[datasetIndex].data.shift();
        chart.update('none');
    }

    showScreen(screenId) {
        this.elements.landingScreen.classList.remove('active');
        this.elements.dashboardScreen.classList.remove('active');
        document.getElementById(screenId).classList.add('active');
    }

    showToast(message, type = 'info') {
        this.elements.toastMsg.textContent = message;
        this.elements.toast.style.display = 'block';
        this.elements.toast.style.borderLeftColor = type === 'warning' ? 'var(--warning)' : 'var(--accent-primary)';

        setTimeout(() => {
            if (this.elements.toast) this.elements.toast.style.display = 'none';
        }, 3000);
    }

    updateTimer(formattedTime) {
        this.elements.timerDisplay.textContent = formattedTime;
    }

    updateSessionClock(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        this.elements.sessionClock.textContent =
            `SESIÓN: ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    updateRecommendations(text) {
        this.elements.recText.textContent = text;
    }

    setPrivateMode(isActive) {
        this.elements.privateOverlay.style.display = isActive ? 'flex' : 'none';
    }

    renderHistory(history) {
        if (!history || history.length === 0) {
            this.elements.historyList.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--text-muted);">No hay sesiones guardadas.</p>';
            return;
        }

        this.elements.historyList.innerHTML = history.reverse().map(s => `
            <div class="history-item">
                <div>
                    <div style="font-weight:bold; color: var(--accent-primary);">${s.subject}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">${new Date(s.timestamp).toLocaleDateString()} ${new Date(s.timestamp).toLocaleTimeString()}</div>
                </div>
                <div style="text-align:right;">
                    <div class="font-mono" style="font-size: 1.2rem;">${s.avgFocus}%</div>
                    <div style="font-size: 0.6rem; color: var(--text-muted);">ENFOQUE</div>
                </div>
                <div style="text-align:right;">
                    <div class="font-mono">${s.durationMinutes}m</div>
                    <div style="font-size: 0.6rem; color: var(--text-muted);">DURACIÓN</div>
                </div>
            </div>
        `).join('');
    }

    toggleHistory(show) {
        this.elements.historyModal.style.display = show ? 'flex' : 'none';
    }
}
