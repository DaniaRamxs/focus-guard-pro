/**
 * Motor de cálculo de métricas de rendimiento
 */
class MetricsEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.history = {
            focus: [],
            fatigue: [],
            blinks: [],
            pose: []
        };

        this.currentMetrics = {
            focusScore: 100,
            fatigueIndex: 0,
            blinkRate: 0,
            postureStability: 100,
            isDistracted: false,
            cumulativeDistractionTime: 0,
            isSleeping: false
        };

        this.blinkCounter = 0;
        this.lastBlinkTime = 0;
        this.eyesClosedDuration = 0;
        this.blinkHistory = []; // Timestamps of blinks in the last minute

        this.smoothedFocus = 100;
        this.distractionTime = 0;
        this.lastProcessedTime = Date.now();
        this.totalDistractionTime = 0;
    }

    /**
     * Procesa nuevos resultados de visión
     */
    update(results, faceData) {
        const now = Date.now();
        const deltaTime = (now - this.lastProcessedTime) / 1000;
        this.lastProcessedTime = now;

        const { ear, pose, gaze } = faceData;

        // 1. Detección de Parpadeos y Sueño
        this.processBlinks(ear, now);

        if (ear < CONFIG.THRESHOLDS.EAR_SLEEP) {
            this.eyesClosedDuration += deltaTime;
        } else {
            this.eyesClosedDuration = 0;
        }

        const isSleeping = this.eyesClosedDuration >= CONFIG.THRESHOLDS.SLEEP_DURATION;

        // 2. Cálculo de Distracción
        const isCurrentlyDistracted = this.checkDistraction(pose, gaze);
        if (isCurrentlyDistracted) {
            this.distractionTime += deltaTime;
            this.totalDistractionTime += deltaTime;
        } else {
            this.distractionTime = Math.max(0, this.distractionTime - deltaTime * 0.5);
        }

        // 3. Score de Postura
        const postureScore = this.calculatePostureScore(pose);

        // 4. Índice de Fatiga
        const fatigueIdx = this.calculateFatigueIndex(now);

        // 5. Focus Score Final (Modelo v1)
        const gazeScore = isCurrentlyDistracted ? 0 : 1;
        const distractionPenalty = Math.min(this.distractionTime / 5.0, 1.0); // Penalización máx a los 5s

        const rawScore = (
            (CONFIG.WEIGHTS.GAZE * gazeScore) +
            (CONFIG.WEIGHTS.POSTURE * (postureScore / 100)) -
            (CONFIG.WEIGHTS.DISTRACTION * distractionPenalty) -
            (CONFIG.WEIGHTS.FATIGUE * (fatigueIdx / 100))
        ) * 100;

        // Suavizado exponencial
        this.smoothedFocus = (CONFIG.UI.FOCUS_SMOOTHING * rawScore) +
            ((1 - CONFIG.UI.FOCUS_SMOOTHING) * this.smoothedFocus);

        this.currentMetrics = {
            focusScore: Math.round(Math.max(0, Math.min(100, this.smoothedFocus))),
            fatigueIndex: Math.round(fatigueIdx),
            blinkRate: this.blinkHistory.length,
            postureStability: Math.round(postureScore),
            isDistracted: isCurrentlyDistracted || distractionPenalty > 0.5,
            cumulativeDistractionTime: Math.round(this.totalDistractionTime),
            isSleeping: isSleeping
        };

        return this.currentMetrics;
    }

    processBlinks(ear, now) {
        if (ear < CONFIG.THRESHOLDS.EAR_BLINK) {
            if (this.lastBlinkTime === 0) this.lastBlinkTime = now;
        } else if (this.lastBlinkTime !== 0) {
            const duration = now - this.lastBlinkTime;
            if (duration >= CONFIG.THRESHOLDS.BLINK_DURATION_MIN && duration <= CONFIG.THRESHOLDS.BLINK_DURATION_MAX) {
                this.blinkCounter++;
                this.blinkHistory.push(now);
            }
            this.lastBlinkTime = 0;
        }

        // Limpiar historial de parpadeos de más de 1 minuto
        this.blinkHistory = this.blinkHistory.filter(t => now - t < 60000);
    }

    checkDistraction(pose, gaze) {
        const yawDistracted = Math.abs(pose.yaw) > CONFIG.THRESHOLDS.YAW_DISTRACTION;
        const pitchDistracted = pose.pitch > CONFIG.THRESHOLDS.PITCH_DISTRACTION_DOWN ||
            pose.pitch < -CONFIG.THRESHOLDS.PITCH_DISTRACTION_UP;
        const gazeDistracted = Math.abs(gaze.x) > CONFIG.THRESHOLDS.GAZE_OFFSET;

        return yawDistracted || pitchDistracted || gazeDistracted;
    }

    calculatePostureScore(pose) {
        // Estabilidad basada en la desviación de los ángulos ideales (0,0,0)
        const deviation = (Math.abs(pose.pitch) + Math.abs(pose.yaw) + Math.abs(pose.roll)) / 3;
        return Math.max(0, 100 - (deviation * 2));
    }

    calculateFatigueIndex(now) {
        // Fatiga basada en:
        // 1. Frecuencia de parpadeo (ideal ~16/min)
        const blinkRate = this.blinkHistory.length;
        const blinkFatigue = Math.abs(blinkRate - 16) / 16 * 50;

        // 2. Duración de "micro-sueños" (EAR bajo por tiempo prolongado)
        // (Simplificado para este MVP)

        return Math.min(100, blinkFatigue);
    }
}
