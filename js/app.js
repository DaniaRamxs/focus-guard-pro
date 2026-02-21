/**
 * Orquestador principal de FocusGuard Pro
 */
if (typeof logDebug === 'undefined') {
    window.logDebug = (m) => console.log(m);
}

logDebug("Iniciando carga de app.js...");

function startApp() {
    try {
        logDebug("Ejecutando startApp()...");

        const ui = new UIController();
        const metrics = new MetricsEngine();
        const pomodoro = new PomodoroTimer(
            (t) => ui.updateTimer(pomodoro.formatTime(t)),
            (m) => logDebug("Temporizador finalizado: " + m)
        );

        let sessionSeconds = 0;
        let sessionInterval = null;
        let isPrivateMode = false;

        const faceAnalyzer = new FaceAnalyzer((results) => {
            if (isPrivateMode) return;
            if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
                ui.setVisionAlert('no-face', true);
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

        function handleAlerts(m) {
            if (isPrivateMode) return;
            if (m.isDistracted) ui.showToast("¡Vuelve aquí!", "warning");
        }

        // VINCULACIÓN ULTRA-ROBUSTA
        const startBtn = document.getElementById('start-session-btn');
        if (startBtn) {
            logDebug("Botón de inicio vinculado.");
            startBtn.onclick = async function (e) {
                e.preventDefault();
                logDebug(">> CLICK DETECTADO <<");

                const name = document.getElementById('user-name').value;
                const subject = document.getElementById('session-subject').value;

                if (!name || !subject) {
                    alert("Por favor, completa nombre y materia.");
                    return;
                }

                try {
                    logDebug("Cambiando pantalla...");
                    ui.showScreen('dashboard-screen');
                    document.getElementById('current-subject').textContent = `MATERIA: ${subject.toUpperCase()}`;

                    logDebug("Activando audio...");
                    ui.initAudio();

                    logDebug("Solicitando cámara...");
                    await faceAnalyzer.start(document.getElementById('camera-view'));
                    logDebug("Cámara iniciada.");

                    sessionInterval = setInterval(() => {
                        sessionSeconds++;
                        ui.updateSessionClock(sessionSeconds);
                    }, 1000);

                    pomodoro.start(25);
                    logDebug("Misión en marcha.");
                } catch (err) {
                    logDebug("ERROR EN START: " + err.message);
                    alert("Error: " + err.message);
                }
            };
        } else {
            logDebug("ERROR: No se encontró el botón start-session-btn");
        }

        // Agregamos otros listeners...
        document.getElementById('end-session-btn')?.addEventListener('click', () => location.reload());

    } catch (e) {
        logDebug("FALTA CRÍTICA EN INICIALIZACIÓN: " + e.message);
    }
}

// Arranque garantizado
if (document.readyState === 'complete') {
    startApp();
} else {
    window.onload = startApp;
}

const canvasCtx = document.getElementById('overlay-canvas')?.getContext('2d');
function drawResults(results, m) {
    if (!canvasCtx || isPrivateMode) return;
    canvasCtx.clearRect(0, 0, 640, 480);
    if (results.multiFaceLandmarks) {
        drawConnectors(canvasCtx, results.multiFaceLandmarks[0], FACEMESH_TESSELATION, { color: 'rgba(0,242,255,0.1)', lineWidth: 0.5 });
    }
    ui.setVisionAlert('distraction', m.isDistracted);
}
function drawEmptyOverlay() { canvasCtx?.clearRect(0, 0, 640, 480); }

