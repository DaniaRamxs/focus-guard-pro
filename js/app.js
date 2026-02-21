/**
 * Orquestador principal de FocusGuard Pro
 */
console.log("Script app.js cargado.");

// Publicar para debug en consola si es necesario
window.DEBUG_APP = {
    initialized: false,
    startAttempted: false
};

function startApp() {
    console.log("Iniciando startApp()...");
    window.DEBUG_APP.initialized = true;

    // Alerta de confirmación de carga (Bootstrap)
    // alert("SISTEMA: FocusGuard listo. Si no ves esto al cargar, borra caché.");

    const dependencies = {
        'Chart': typeof Chart !== 'undefined',
        'FaceMesh': typeof FaceMesh !== 'undefined',
        'Camera': typeof Camera !== 'undefined'
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
        (t) => ui.updateTimer(pomodoro.formatTime(t)),
        (m) => console.log("Finalizado:", m)
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
        const currentMetrics = metrics.update(results, {
            ear: (FaceAnalyzer.calculateEAR(results.multiFaceLandmarks[0], CONFIG.LANDMARKS.LEFT_EYE) +
                FaceAnalyzer.calculateEAR(results.multiFaceLandmarks[0], CONFIG.LANDMARKS.RIGHT_EYE)) / 2,
            pose: FaceAnalyzer.estimateHeadPose(results.multiFaceLandmarks[0]),
            gaze: FaceAnalyzer.estimateGaze(results.multiFaceLandmarks[0], CONFIG.LANDMARKS.LEFT_EYE, CONFIG.LANDMARKS.LEFT_IRIS)
        });
        drawResults(results, currentMetrics);
        ui.updateDashboard(currentMetrics, {
            ear: currentMetrics.blinkRate,
            pose: FaceAnalyzer.estimateHeadPose(results.multiFaceLandmarks[0])
        });
        ui.setVisionAlert('sleep', currentMetrics.isSleeping);
        handleAlerts(currentMetrics);
    });

    // --- Vinculación de Eventos ---
    console.log("Binding events...");
    const startBtn = document.getElementById('start-session-btn');
    const setupForm = document.getElementById('session-setup-form');

    if (startBtn) {
        startBtn.onclick = async () => {
            window.DEBUG_APP.startAttempted = true;
            console.log("Click en el botón detectado.");
            alert("PROCEDIENDO: Iniciando cámara y sesión...");

            if (!setupForm.reportValidity()) {
                alert("Completa los datos requeridos.");
                return;
            }

            const name = document.getElementById('user-name').value;
            const subject = document.getElementById('session-subject').value;
            const duration = parseInt(document.getElementById('session-duration').value) || 25;

            ui.showToast(`Iniciando misión para ${name}...`);
            ui.initAudio();

            try {
                ui.showScreen('dashboard-screen');
                document.getElementById('current-subject').textContent = `MATERIA: ${subject.toUpperCase()}`;

                console.log("Llamando a faceAnalyzer.start()...");
                await faceAnalyzer.start(document.getElementById('camera-view'));

                sessionSeconds = 0;
                sessionInterval = setInterval(() => {
                    sessionSeconds++;
                    ui.updateSessionClock(sessionSeconds);
                }, 1000);
                pomodoro.start(duration);
            } catch (err) {
                console.error(err);
                alert("ERROR CRÍTICO: " + err.message);
            }
        };
    } else {
        console.error("Botón 'start-session-btn' no hallado.");
    }

    // Handlers minimalistas
    const ev = (id, e, f) => document.getElementById(id)?.addEventListener(e, f);
    ev('timer-toggle-btn', 'click', () => { pomodoro.toggle(); const btn = document.getElementById('timer-toggle-btn'); if (btn) btn.textContent = pomodoro.isActive ? 'Pausa' : 'Reanudar'; });
    ev('end-session-btn', 'click', () => { if (confirm("¿Terminar?")) stopSession(); });
    ev('private-mode-checkbox', 'change', (e) => { isPrivateMode = e.target.checked; ui.setPrivateMode(isPrivateMode); });
    ev('view-history-btn', 'click', () => { ui.renderHistory(Storage.getHistory()); ui.toggleHistory(true); });
    ev('close-history-btn', 'click', () => ui.toggleHistory(false));

    function stopSession() {
        faceAnalyzer.stop();
        clearInterval(sessionInterval);
        Storage.saveSession({
            subject: document.getElementById('session-subject').value,
            avgFocus: Math.round(metrics.smoothedFocus),
            durationMinutes: Math.round(sessionSeconds / 60)
        });
        location.reload();
    }

    const canvasCtx = document.getElementById('overlay-canvas').getContext('2d');
    function drawResults(results, m) {
        if (isPrivateMode) return;
        const canvas = document.getElementById('overlay-canvas');
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        if (results.multiFaceLandmarks) {
            drawConnectors(canvasCtx, results.multiFaceLandmarks[0], FACEMESH_TESSELATION, { color: 'rgba(0,242,255,0.1)', lineWidth: 0.5 });
        }
        ui.setVisionAlert('distraction', m.isDistracted);
    }
    function drawEmptyOverlay() { canvasCtx.clearRect(0, 0, 640, 480); }
    function handleAlerts(m) { if (m.isDistracted) ui.showToast("¡Vuelve aquí!", "warning"); }
}

// Arranque
if (document.readyState === 'complete') startApp();
else window.addEventListener('load', startApp);
