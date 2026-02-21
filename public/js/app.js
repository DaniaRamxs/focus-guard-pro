/**
 * Orquestador principal de FocusGuard Pro
 */

// ─── Estado global de sesión ───────────────────────────────────────────────
let isPrivateMode = false;
let sessionSeconds = 0;
let sessionInterval = null;
let wasSleeping = false;       // fuera del callback para evitar bug de `this`
let currentSubject = '';

let ui = null;
let metrics = null;
let pomodoro = null;
let faceAnalyzer = null;

// ─── Canvas ────────────────────────────────────────────────────────────────
const canvasEl = document.getElementById('overlay-canvas');
const canvasCtx = canvasEl?.getContext('2d');

/**
 * Sincroniza las dimensiones del buffer del canvas con el stream de vídeo.
 * Sin esto el canvas usa 300×150 por defecto y la malla se distorsiona.
 */
function syncCanvas() {
    const video = document.getElementById('camera-view');
    if (canvasEl && video && video.videoWidth > 0) {
        if (canvasEl.width !== video.videoWidth) canvasEl.width = video.videoWidth;
        if (canvasEl.height !== video.videoHeight) canvasEl.height = video.videoHeight;
    }
}

function drawResults(results) {
    if (!canvasCtx || isPrivateMode) return;
    syncCanvas();
    canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    if (!results.multiFaceLandmarks) return;
    const lm = results.multiFaceLandmarks[0];

    drawConnectors(canvasCtx, lm, FACEMESH_TESSELATION,
        { color: 'rgba(0,242,255,0.07)', lineWidth: 0.5 });
    drawConnectors(canvasCtx, lm, FACEMESH_LEFT_EYE,
        { color: '#00f2ff', lineWidth: 1.2 });
    drawConnectors(canvasCtx, lm, FACEMESH_RIGHT_EYE,
        { color: '#00f2ff', lineWidth: 1.2 });
    drawConnectors(canvasCtx, lm, FACEMESH_LEFT_IRIS,
        { color: '#8b5cf6', lineWidth: 1.5 });
    drawConnectors(canvasCtx, lm, FACEMESH_RIGHT_IRIS,
        { color: '#8b5cf6', lineWidth: 1.5 });
}

function drawEmptyOverlay() {
    if (!canvasCtx || isPrivateMode) return;
    syncCanvas();
    canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
}

// ─── Guardar y terminar sesión ─────────────────────────────────────────────
function stopSession() {
    faceAnalyzer?.stop();
    pomodoro?.reset();
    clearInterval(sessionInterval);
    ui?.stopAlarm();
    ui?.closeAudio();

    // Solo guarda si la sesión duró más de 30 segundos
    if (sessionSeconds > 30 && metrics) {
        Storage.saveSession({
            subject: currentSubject,
            avgFocus: metrics.currentMetrics.focusScore,
            durationSeconds: sessionSeconds,
            durationMinutes: Math.round(sessionSeconds / 60),
            distractionSeconds: metrics.currentMetrics.cumulativeDistractionTime
        });
        ui?.showToast('Sesión guardada correctamente.');
    }

    // Resetear estado sin recargar la página
    sessionSeconds = 0;
    isPrivateMode = false;
    wasSleeping = false;
    currentSubject = '';
    metrics?.reset();

    // Resetear checkbox de modo privado
    const checkbox = document.getElementById('private-mode-checkbox');
    if (checkbox) checkbox.checked = false;

    ui?.showScreen('landing-screen');
}

// ─── Recomendaciones IA ────────────────────────────────────────────────────
let lastAlertTime = 0;
function updateAIRecommendation(m) {
    if (isPrivateMode || !ui) return;

    let rec = 'Rendimiento óptimo. Mantén el ritmo.';

    if (m.isSleeping) {
        rec = '¡Alerta! Signos de sueño detectados. Levántate un momento.';
    } else if (m.focusScore < 40) {
        rec = 'Concentración muy baja. Respira profundo y retoma el tema.';
    } else if (m.focusScore < 65) {
        rec = 'Tu enfoque está bajando. Cierra pestañas innecesarias.';
    } else if (m.fatigueIndex > 70) {
        rec = 'Fatiga acumulada detectada. Hidrátate y estira los ojos.';
    } else if (m.postureStability < 50) {
        rec = 'Postura comprometida. Endereza la espalda y sube el monitor.';
    } else if (m.cumulativeDistractionTime > 60) {
        rec = `${m.cumulativeDistractionTime}s de distracción acumulada. Considera el modo Pomodoro.`;
    }

    ui.updateRecommendations(rec);

    // Alertas toast con cooldown para no saturar
    const now = Date.now();
    if (now - lastAlertTime > CONFIG.UI.ALERT_COOLDOWN) {
        if (m.isDistracted && !m.isSleeping) {
            ui.showToast('¡Mantén el enfoque en la pantalla!', 'warning');
            lastAlertTime = now;
        } else if (m.fatigueIndex > 80) {
            ui.showToast('Nivel de fatiga alto. Considera un descanso.', 'warning');
            lastAlertTime = now;
        }
    }
}

// ─── Arranque de la aplicación ─────────────────────────────────────────────
function startApp() {
    ui = new UIController();
    metrics = new MetricsEngine();

    // Pomodoro con ciclo TRABAJO → DESCANSO → TRABAJO automático
    pomodoro = new PomodoroTimer(
        (time, mode) => {
            ui.updateTimer(pomodoro.formatTime(time));
        },
        (completedMode) => {
            if (completedMode === 'WORK') {
                ui.showToast('¡Bloque de trabajo completado! Tómate un descanso.', 'warning');
                pomodoro.startBreak();
                ui.updatePomodoroMode('BREAK');
                const btn = document.getElementById('timer-toggle-btn');
                if (btn) btn.textContent = 'Pausa';
            } else {
                ui.showToast('¡Descanso terminado! Vuelve al trabajo.', 'info');
                pomodoro.start(Math.round(pomodoro.workDuration / 60));
                ui.updatePomodoroMode('WORK');
            }
        }
    );

    // ── Face Analyzer callback ────────────────────────────────────────────
    faceAnalyzer = new FaceAnalyzer((results) => {
        if (isPrivateMode) return;

        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            ui.setVisionAlert('no-face', true);
            ui.setVisionAlert('distraction', false);
            ui.setVisionAlert('sleep', false);
            drawEmptyOverlay();
            return;
        }

        ui.setVisionAlert('no-face', false);
        const landmarks = results.multiFaceLandmarks[0];

        const ear = (
            FaceAnalyzer.calculateEAR(landmarks, CONFIG.LANDMARKS.LEFT_EYE) +
            FaceAnalyzer.calculateEAR(landmarks, CONFIG.LANDMARKS.RIGHT_EYE)
        ) / 2;
        const pose = FaceAnalyzer.estimateHeadPose(landmarks);
        const gaze = FaceAnalyzer.estimateGaze(
            landmarks, CONFIG.LANDMARKS.LEFT_EYE, CONFIG.LANDMARKS.LEFT_IRIS
        );

        const currentMetrics = metrics.update(results, { ear, pose, gaze });

        // Transiciones de estado de sueño
        if (currentMetrics.isSleeping && !wasSleeping) {
            wasSleeping = true;
        } else if (!currentMetrics.isSleeping && wasSleeping) {
            wasSleeping = false;
        }

        drawResults(results);
        ui.updateDashboard(currentMetrics, { ear, pose, gaze });
        ui.setVisionAlert('sleep', currentMetrics.isSleeping);
        ui.setVisionAlert('distraction', currentMetrics.isDistracted && !currentMetrics.isSleeping);
    });

    // ── Botón iniciar sesión ──────────────────────────────────────────────
    const startBtn = document.getElementById('start-session-btn');
    if (startBtn) {
        startBtn.onclick = async function (e) {
            e.preventDefault();
            const nameInput = document.getElementById('user-name');
            const subjectInput = document.getElementById('session-subject');

            if (!nameInput?.value.trim() || !subjectInput?.value) {
                ui.showToast('Completa tu nombre y la materia antes de iniciar.', 'warning');
                return;
            }

            currentSubject = subjectInput.value;

            try {
                ui.showScreen('dashboard-screen');

                const subDisplay = document.getElementById('current-subject');
                if (subDisplay) subDisplay.textContent = `MATERIA: ${currentSubject.toUpperCase()}`;

                ui.initAudio();
                await faceAnalyzer.start(document.getElementById('camera-view'));

                sessionSeconds = 0;
                sessionInterval = setInterval(() => {
                    sessionSeconds++;
                    ui.updateSessionClock(sessionSeconds);
                    updateAIRecommendation(metrics.currentMetrics);
                }, 1000);

                const durationIn = document.getElementById('session-duration');
                const duration = durationIn ? (parseInt(durationIn.value) || 25) : 25;
                pomodoro.start(duration);
                ui.updatePomodoroMode('WORK');

            } catch (err) {
                console.error('Error al iniciar sesión:', err);
                ui.showToast('Error de cámara: ' + err.message, 'warning');
                ui.showScreen('landing-screen');
            }
        };
    }

    // ── Botón finalizar sesión ────────────────────────────────────────────
    document.getElementById('end-session-btn')?.addEventListener('click', () => {
        stopSession();
    });

    // ── Controles Pomodoro ────────────────────────────────────────────────
    document.getElementById('timer-toggle-btn')?.addEventListener('click', () => {
        pomodoro.toggle();
        const btn = document.getElementById('timer-toggle-btn');
        if (btn) btn.textContent = pomodoro.isActive ? 'Pausa' : 'Reanudar';
    });

    document.getElementById('timer-reset-btn')?.addEventListener('click', () => {
        pomodoro.skip();
    });

    // ── Modo privado ──────────────────────────────────────────────────────
    document.getElementById('private-mode-checkbox')?.addEventListener('change', (e) => {
        isPrivateMode = e.target.checked;
        ui.setPrivateMode(isPrivateMode);
        ui.showToast(
            isPrivateMode
                ? 'Modo Privado activado. Análisis pausado.'
                : 'Modo Privado desactivado. Reanudando análisis.'
        );
    });

    // ── Historial ─────────────────────────────────────────────────────────
    document.getElementById('view-history-btn')?.addEventListener('click', () => {
        ui.renderHistory(Storage.getHistory());
        ui.toggleHistory(true);
    });

    document.getElementById('close-history-btn')?.addEventListener('click', () => {
        ui.toggleHistory(false);
    });

    // Cerrar historial al hacer clic en el fondo del overlay
    document.getElementById('history-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) ui.toggleHistory(false);
    });
}

// Arranque seguro
if (document.readyState === 'complete') {
    startApp();
} else {
    window.addEventListener('load', startApp);
}
