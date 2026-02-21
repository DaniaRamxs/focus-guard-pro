/**
 * Orquestador principal de FocusGuard Pro
 */
if (typeof logDebug === 'undefined') {
    window.logDebug = (m) => console.log(m);
}

logDebug("Cargando app.js v1.2...");

// Estado Global (para evitar errores de scope)
let isPrivateMode = false;
let sessionSeconds = 0;
let sessionInterval = null;
let ui = null;
let metrics = null;
let pomodoro = null;
let faceAnalyzer = null;

function startApp() {
    try {
        logDebug("Iniciando startApp()...");

        ui = new UIController();
        metrics = new MetricsEngine();
        pomodoro = new PomodoroTimer(
            (t) => ui.updateTimer(pomodoro.formatTime(t)),
            (m) => logDebug("Temporizador: " + m)
        );

        faceAnalyzer = new FaceAnalyzer((results) => {
            if (isPrivateMode) return;
            if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
                ui.setVisionAlert('no-face', true);
                drawEmptyOverlay();
                return;
            }
            ui.setVisionAlert('no-face', false);

            const landmarks = results.multiFaceLandmarks[0];
            const currentMetrics = metrics.update(results, {
                ear: (FaceAnalyzer.calculateEAR(landmarks, CONFIG.LANDMARKS.LEFT_EYE) +
                    FaceAnalyzer.calculateEAR(landmarks, CONFIG.LANDMARKS.RIGHT_EYE)) / 2,
                pose: FaceAnalyzer.estimateHeadPose(landmarks),
                gaze: FaceAnalyzer.estimateGaze(landmarks, CONFIG.LANDMARKS.LEFT_EYE, CONFIG.LANDMARKS.LEFT_IRIS)
            });

            drawResults(results, currentMetrics);
            ui.updateDashboard(currentMetrics, {
                ear: currentMetrics.blinkRate,
                pose: FaceAnalyzer.estimateHeadPose(landmarks)
            });
            ui.setVisionAlert('sleep', currentMetrics.isSleeping);
        });

        // VINCULACIÓN DE BOTÓN PRINCIPAL
        const startBtn = document.getElementById('start-session-btn');
        if (startBtn) {
            logDebug("Botón detectado. Asignando onclick...");
            startBtn.onclick = async function (e) {
                e.preventDefault();
                logDebug(">> CLICK RECIBIDO <<");

                const nameInput = document.getElementById('user-name');
                const subjectInput = document.getElementById('session-subject');

                if (!nameInput.value || !subjectInput.value) {
                    alert("⚠️ Por favor, completa tu nombre y la materia.");
                    return;
                }

                try {
                    logDebug("Cambiando a Dashboard...");
                    ui.showScreen('dashboard-screen');

                    const subDisplay = document.getElementById('current-subject');
                    if (subDisplay) subDisplay.textContent = `MATERIA: ${subjectInput.value.toUpperCase()}`;

                    logDebug("Iniciando Cámara/IA...");
                    ui.initAudio();
                    await faceAnalyzer.start(document.getElementById('camera-view'));
                    logDebug("Cámara activa.");

                    sessionInterval = setInterval(() => {
                        sessionSeconds++;
                        ui.updateSessionClock(sessionSeconds);
                    }, 1000);

                    const durationIn = document.getElementById('session-duration');
                    const duration = durationIn ? (parseInt(durationIn.value) || 25) : 25;
                    pomodoro.start(duration);

                    logDebug("Sesión iniciada con éxito.");
                } catch (err) {
                    logDebug("FALLA EN START: " + err.message);
                    alert("ERROR DE CÁMARA:\n" + err.message);
                }
            };
        } else {
            logDebug("ALERTA: No se halló el botón start-session-btn");
        }

        // Listeners secundarios
        const _id = (idx) => document.getElementById(idx);
        _id('end-session-btn')?.addEventListener('click', () => {
            if (confirm("¿Seguro que quieres salir?")) {
                location.reload();
            }
        });

        _id('private-mode-checkbox')?.addEventListener('change', (e) => {
            isPrivateMode = e.target.checked;
            ui.setPrivateMode(isPrivateMode);
            logDebug("Modo Privado: " + isPrivateMode);
        });

        logDebug("Inicialización completa.");

    } catch (e) {
        logDebug("CRASH EN STARTUP: " + e.message);
        console.error(e);
    }
}

// Arranque seguro
if (document.readyState === 'complete') {
    startApp();
} else {
    window.addEventListener('load', startApp);
}

// Funciones de dibujo corregidas
const canvasCtx = document.getElementById('overlay-canvas')?.getContext('2d');
function drawResults(results, m) {
    if (!canvasCtx || isPrivateMode) return;
    canvasCtx.clearRect(0, 0, 640, 480);
    if (results.multiFaceLandmarks) {
        drawConnectors(canvasCtx, results.multiFaceLandmarks[0], FACEMESH_TESSELATION, { color: 'rgba(0,242,255,0.1)', lineWidth: 0.5 });
    }
}
function drawEmptyOverlay() { canvasCtx?.clearRect(0, 0, 640, 480); }
