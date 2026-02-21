/**
 * Orquestador principal de FocusGuard Pro
 */
function startApp() {
    console.log("--- FocusGuard Pro: Entorno de Inicialización ---");
    // alert("SISTEMA: Iniciando aplicación...");

    const dependencies = {
        'Chart.js': typeof Chart !== 'undefined',
        'FaceMesh': typeof FaceMesh !== 'undefined',
        'Camera': typeof Camera !== 'undefined',
        'DrawingUtils': typeof drawConnectors !== 'undefined'
    };

    console.table(dependencies);

    const missing = Object.keys(dependencies).filter(k => !dependencies[k]);
    if (missing.length > 0) {
        const msg = `Error: Las siguientes dependencias no se cargaron: ${missing.join(', ')}`;
        console.error(msg);
        alert(msg);
        return;
    }

    const ui = new UIController();
    const metrics = new MetricsEngine();
    const pomodoro = new PomodoroTimer(
        (time, mode) => {
            ui.updateTimer(pomodoro.formatTime(time));
            if (time === 0) ui.showToast(`¡Tiempo de ${mode === 'WORK' ? 'TRABAJO' : 'DESCANSO'} finalizado!`, 'warning');
        },
        (mode) => {
            console.log("Ciclo completado:", mode);
        }
    );

    let sessionStartTime = null;
    let sessionInterval = null;
    let sessionSeconds = 0;
    let isPrivateMode = false;

    const faceAnalyzer = new FaceAnalyzer((results) => {
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
        const earL = FaceAnalyzer.calculateEAR(landmarks, CONFIG.LANDMARKS.LEFT_EYE);
        const earR = FaceAnalyzer.calculateEAR(landmarks, CONFIG.LANDMARKS.RIGHT_EYE);
        const ear = (earL + earR) / 2;
        const pose = FaceAnalyzer.estimateHeadPose(landmarks);
        const gaze = FaceAnalyzer.estimateGaze(landmarks, CONFIG.LANDMARKS.LEFT_EYE, CONFIG.LANDMARKS.LEFT_IRIS);
        const currentMetrics = metrics.update(results, { ear, pose, gaze });
        drawResults(results, currentMetrics);
        ui.updateDashboard(currentMetrics, { ear, pose, gaze });
        ui.setVisionAlert('sleep', currentMetrics.isSleeping);
        handleAlerts(currentMetrics);
    });

    // --- Vinculación de Eventos ---
    console.log("Binding events...");
    const startBtn = document.getElementById('start-session-btn');
    const setupForm = document.getElementById('session-setup-form');

    if (startBtn && setupForm) {
        console.log("Start button and form found, adding listener.");
        startBtn.onclick = async () => {
            console.log("--- BOTÓN CLICK DETECTADO ---");
            alert("SISTEMA: Click detectado. Procesando...");

            const isValid = setupForm.reportValidity();
            if (!isValid) {
                alert("Por favor, completa tu nombre y selecciona una materia antes de iniciar.");
                return;
            }

            const name = document.getElementById('user-name').value;
            const subject = document.getElementById('session-subject').value;
            const durationInput = document.getElementById('session-duration');
            const duration = durationInput ? (parseInt(durationInput.value) || 25) : 25;

            ui.showToast(`Iniciando misión para ${name}...`);
            ui.initAudio();

            try {
                ui.showScreen('dashboard-screen');
                const subElem = document.getElementById('current-subject');
                if (subElem) subElem.textContent = `MATERIA: ${subject.toUpperCase()}`;

                console.log("Iniciando cámara...");
                await faceAnalyzer.start(document.getElementById('camera-view'));

                sessionStartTime = Date.now();
                sessionSeconds = 0;
                sessionInterval = setInterval(() => {
                    sessionSeconds++;
                    ui.updateSessionClock(sessionSeconds);
                    if (!isPrivateMode) updateAIRecommendation(metrics.currentMetrics);
                }, 1000);

                pomodoro.start(duration);
            } catch (err) {
                console.error("ERROR CRÍTICO:", err);
                alert("ERROR AL INICIAR SESIÓN:\n" + err.message);
            }
        };
    }

    // Resto de listeners... (compactados para brevedad masiva)
    const attach = (id, evt, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(evt, fn); };

    attach('timer-toggle-btn', 'click', () => { pomodoro.toggle(); const btn = document.getElementById('timer-toggle-btn'); if (btn) btn.textContent = pomodoro.isActive ? 'Pausa' : 'Reanudar'; });
    attach('timer-reset-btn', 'click', () => { if (confirm("¿Saltar?")) pomodoro.timeLeft = 0; });
    attach('end-session-btn', 'click', () => { if (confirm("¿Finalizar?")) stopSession(); });
    attach('private-mode-checkbox', 'change', (e) => { isPrivateMode = e.target.checked; ui.setPrivateMode(isPrivateMode); });
    attach('view-history-btn', 'click', () => { const h = Storage.getHistory(); ui.renderHistory(h); ui.toggleHistory(true); });
    attach('close-history-btn', 'click', () => ui.toggleHistory(false));

    function stopSession() {
        faceAnalyzer.stop();
        clearInterval(sessionInterval);
        const finalData = {
            subject: document.getElementById('session-subject').value,
            avgFocus: Math.round(metrics.smoothedFocus),
            durationSeconds: sessionSeconds,
            durationMinutes: Math.round(sessionSeconds / 60),
            distractionSeconds: metrics.currentMetrics.cumulativeDistractionTime
        };
        Storage.saveSession(finalData);
        alert("Sesión guardada. La página se reiniciará.");
        location.reload();
    }

    // Utilidades de dibujo...
    const canvasCtx = document.getElementById('overlay-canvas').getContext('2d');
    function drawResults(results, metrics) {
        if (isPrivateMode) return;
        const canvas = document.getElementById('overlay-canvas');
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        if (results.multiFaceLandmarks) {
            for (const landmarks of results.multiFaceLandmarks) {
                drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, { color: 'rgba(0, 242, 255, 0.1)', lineWidth: 0.5 });
                drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, { color: '#00f2ff', lineWidth: 1 });
                drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, { color: '#00f2ff', lineWidth: 1 });
            }
        }
        ui.setVisionAlert('distraction', metrics.isDistracted);
        canvasCtx.restore();
    }

    function drawEmptyOverlay() {
        const canvas = document.getElementById('overlay-canvas');
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function handleAlerts(m) {
        if (isPrivateMode) return;
        const now = Date.now();
        if (now - lastAlertTime < CONFIG.UI.ALERT_COOLDOWN) return;
        if (m.isDistracted) ui.showToast("¡Concentración!", "warning");
    }
    let lastAlertTime = 0;

    function updateAIRecommendation(m) {
        if (isPrivateMode) return;
        let rec = "Todo en orden.";
        if (m.focusScore < 60) rec = "Baja concentración.";
        ui.updateRecommendations(rec);
    }
}

// Ejecución segura
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
