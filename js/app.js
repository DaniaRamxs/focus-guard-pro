/**
 * Orquestador principal de FocusGuard Pro
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("--- FocusGuard Pro: Entorno de Inicialización ---");

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

        // 1. Extraer datos crudos
        const earL = FaceAnalyzer.calculateEAR(landmarks, CONFIG.LANDMARKS.LEFT_EYE);
        const earR = FaceAnalyzer.calculateEAR(landmarks, CONFIG.LANDMARKS.RIGHT_EYE);
        const ear = (earL + earR) / 2;

        const pose = FaceAnalyzer.estimateHeadPose(landmarks);
        const gaze = FaceAnalyzer.estimateGaze(landmarks, CONFIG.LANDMARKS.LEFT_EYE, CONFIG.LANDMARKS.LEFT_IRIS);

        // 2. Procesar en motor de métricas
        const currentMetrics = metrics.update(results, { ear, pose, gaze });

        // 3. Dibujar visualización
        drawResults(results, currentMetrics);

        // 4. Actualizar UI
        ui.updateDashboard(currentMetrics, { ear, pose, gaze });
        ui.setVisionAlert('sleep', currentMetrics.isSleeping);

        // 5. Alertas inteligentes (Throttled)
        handleAlerts(currentMetrics);
    });

    // --- Vinculación de Eventos ---
    console.log("Binding events...");
    const startBtn = document.getElementById('start-session-btn');
    const setupForm = document.getElementById('session-setup-form');

    if (startBtn && setupForm) {
        console.log("Start button and form found, adding listener.");
        startBtn.addEventListener('click', async () => {
            console.log("--- BOTÓN CLICK DETECTADO ---");
            // alert("Click en el botón"); // Muy intrusivo, pero efectivo si nada funciona

            // Validación manual
            const isValid = setupForm.reportValidity();
            console.log("Form validity:", isValid);

            if (!isValid) {
                console.warn("Validación de formulario fallida.");
                // alert("Por favor, llena todos los campos correctamente.");
                return;
            }

            const nameInput = document.getElementById('user-name');
            const subjectInput = document.getElementById('session-subject');
            const durationInput = document.getElementById('session-duration');

            const name = nameInput.value;
            const subject = subjectInput.value;
            const duration = durationInput ? (parseInt(durationInput.value) || 25) : 25;

            console.log("Datos capturados:", { name, subject, duration });
            ui.showToast(`Iniciando misión para ${name}...`);
            ui.initAudio();

            try {
                console.log("Buscando elemento de video...");
                const videoElement = document.getElementById('camera-view');
                if (!videoElement) {
                    throw new Error("No se encontró el elemento 'camera-view' en el DOM.");
                }

                console.log("Intentando arrancar FaceAnalyzer...");
                // Cambiamos el orden: primero mostramos la pantalla, luego la cámara
                ui.showScreen('dashboard-screen');
                const subElem = document.getElementById('current-subject');
                if (subElem) subElem.textContent = `MATERIA: ${subject.toUpperCase()}`;

                await faceAnalyzer.start(videoElement);
                console.log("FaceAnalyzer arrancó con éxito.");

                sessionStartTime = Date.now();
                sessionSeconds = 0;
                sessionInterval = setInterval(() => {
                    sessionSeconds++;
                    ui.updateSessionClock(sessionSeconds);
                    if (!isPrivateMode) updateAIRecommendation(metrics.currentMetrics);
                }, 1000);

                pomodoro.start(duration);

            } catch (err) {
                console.error("ERROR CRÍTICO EN START:", err);
                ui.showToast("Falla técnica al iniciar.", "warning");
                alert("ERROR AL INICIAR SESIÓN:\n" + err.message + "\n\nTip: Asegúrate de dar permisos de cámara.");
            }
        });
    } else {
        const errorMsg = `Error Crítico: No se halló el botón (${!!startBtn}) o el formulario (${!!setupForm})`;
        console.error(errorMsg);
        alert(errorMsg);
    }

    document.getElementById('timer-toggle-btn').addEventListener('click', () => {
        pomodoro.toggle();
        const btn = document.getElementById('timer-toggle-btn');
        btn.textContent = pomodoro.isActive ? 'Pausa' : 'Reanudar';
    });

    document.getElementById('timer-reset-btn').addEventListener('click', () => {
        if (confirm("¿Saltar al siguiente bloque?")) {
            pomodoro.timeLeft = 0;
        }
    });

    document.getElementById('end-session-btn').addEventListener('click', () => {
        if (confirm("¿Finalizar sesión y guardar estadísticas?")) {
            stopSession();
        }
    });

    document.getElementById('private-mode-checkbox').addEventListener('change', (e) => {
        isPrivateMode = e.target.checked;
        ui.setPrivateMode(isPrivateMode);
        if (isPrivateMode) {
            ui.showToast("Modo Privado activado. Análisis pausado.", "info");
        } else {
            ui.showToast("Modo Privado desactivado. Reanudando análisis.", "info");
        }
    });

    document.getElementById('view-history-btn').addEventListener('click', () => {
        const history = Storage.getHistory();
        ui.renderHistory(history);
        ui.toggleHistory(true);
    });

    document.getElementById('close-history-btn').addEventListener('click', () => {
        ui.toggleHistory(false);
    });

    // --- Utilidades de Dibujo ---

    const canvasCtx = document.getElementById('overlay-canvas').getContext('2d');

    function drawResults(results, metrics) {
        if (isPrivateMode) return;
        const canvas = document.getElementById('overlay-canvas');
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.multiFaceLandmarks) {
            for (const landmarks of results.multiFaceLandmarks) {
                drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION,
                    { color: 'rgba(0, 242, 255, 0.1)', lineWidth: 0.5 });

                drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, { color: '#00f2ff', lineWidth: 1 });
                drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, { color: '#00f2ff', lineWidth: 1 });
                drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_IRIS, { color: '#8b5cf6', lineWidth: 1 });
                drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_IRIS, { color: '#8b5cf6', lineWidth: 1 });
            }
        }

        // Indicador de "Distraído" en el UI
        ui.setVisionAlert('distraction', metrics.isDistracted);

        canvasCtx.restore();
    }

    function drawEmptyOverlay() {
        if (isPrivateMode) return;
        const canvas = document.getElementById('overlay-canvas');
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        // No dibujamos texto aquí, el UI se encarga
    }

    // --- Lógica de Negocio Adicional ---

    let lastAlertTime = 0;
    function handleAlerts(m) {
        if (isPrivateMode) return;
        const now = Date.now();
        if (now - lastAlertTime < CONFIG.UI.ALERT_COOLDOWN) return;

        if (m.isDistracted) {
            ui.showToast("¡Mantén el enfoque en la pantalla!", "warning");
            lastAlertTime = now;
        } else if (m.fatigueIndex > 80) {
            ui.showToast("Nivel de fatiga alto. Considera un descanso corto.", "warning");
            lastAlertTime = now;
        }
    }

    function updateAIRecommendation(m) {
        if (isPrivateMode) return;
        let rec = "Todo en orden. Mantén el ritmo.";
        if (m.focusScore < 60) rec = "Tu concentración está bajando. Intenta respirar profundo.";
        if (m.fatigueIndex > 60) rec = "Detecto fatiga. Hidrátate y estira un poco.";
        if (m.postureStability < 50) rec = "Cuida tu postura. Endereza la espalda.";

        ui.updateRecommendations(rec);
    }

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

        ui.showToast("Sesión guardada correctamente.");
        setTimeout(() => location.reload(), 2000);
    }
});
