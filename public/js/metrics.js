/**
 * Motor de cálculo de métricas de rendimiento
 */
class MetricsEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.history = { focus: [], fatigue: [], blinks: [], pose: [] };

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
        this.blinkHistory = [];

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

        // 1. Detección de parpadeo y sueño
        this.processBlinks(ear, now);

        if (ear < CONFIG.THRESHOLDS.EAR_SLEEP) {
            this.eyesClosedDuration += deltaTime;
        } else {
            this.eyesClosedDuration = 0;
        }

        const isSleeping = this.eyesClosedDuration >= CONFIG.THRESHOLDS.SLEEP_DURATION;

        // 2. Distracción
        const isCurrentlyDistracted = this.checkDistraction(pose, gaze);
        if (isCurrentlyDistracted) {
            this.distractionTime += deltaTime;
            this.totalDistractionTime += deltaTime;
        } else {
            this.distractionTime = Math.max(0, this.distractionTime - deltaTime * 0.5);
        }

        // 3. Postura
        const postureScore = this.calculatePostureScore(pose);

        // 4. Fatiga
        const fatigueIdx = this.calculateFatigueIndex();

        // ─────────────────────────────────────────────────────────────
        // 5. Focus Score — Modelo v2 (rango correcto 0–100)
        //
        //  Fórmula:
        //    attentionScore = 0.75 × gazeOk + 0.25 × (postura/100)
        //                     ↑ parte positiva, máx = 1.0
        //
        //    totalPenalty   = 0.60 × penalDistracción + 0.40 × (fatiga/100)
        //                     ↑ penalización acumulada, rango [0,1]
        //
        //    rawScore       = attentionScore × (1 − totalPenalty) × 100
        //
        //  Caso ideal:   1.0 × (1 − 0) × 100 = 100  ✓
        //  Caso mínimo:  0.0 × (1 − 1) × 100 = 0    ✓
        // ─────────────────────────────────────────────────────────────
        const gazeOk = isCurrentlyDistracted ? 0 : 1;
        const distractionPenalty = Math.min(this.distractionTime / 5.0, 1.0);

        const attentionScore = (0.75 * gazeOk) + (0.25 * postureScore / 100);
        const totalPenalty = Math.min(1.0,
            (distractionPenalty * 0.6) + (fatigueIdx / 100 * 0.4)
        );

        const rawScore = attentionScore * (1 - totalPenalty) * 100;

        // Suavizado exponencial para evitar saltos bruscos en la UI
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
            if (duration >= CONFIG.THRESHOLDS.BLINK_DURATION_MIN &&
                duration <= CONFIG.THRESHOLDS.BLINK_DURATION_MAX) {
                this.blinkCounter++;
                this.blinkHistory.push(now);
            }
            this.lastBlinkTime = 0;
        }
        this.blinkHistory = this.blinkHistory.filter(t => now - t < 60000);
    }

    checkDistraction(pose, gaze) {
        const yawDistracted = Math.abs(pose.yaw) > CONFIG.THRESHOLDS.YAW_DISTRACTION;
        const pitchDistracted =
            pose.pitch > CONFIG.THRESHOLDS.PITCH_DISTRACTION_DOWN ||
            pose.pitch < -CONFIG.THRESHOLDS.PITCH_DISTRACTION_UP;
        const gazeDistracted = Math.abs(gaze.x) > CONFIG.THRESHOLDS.GAZE_OFFSET;
        return yawDistracted || pitchDistracted || gazeDistracted;
    }

    calculatePostureScore(pose) {
        const deviation = (Math.abs(pose.pitch) + Math.abs(pose.yaw) + Math.abs(pose.roll)) / 3;
        return Math.max(0, 100 - (deviation * 2));
    }

    calculateFatigueIndex() {
        const blinkRate = this.blinkHistory.length;

        // Factor 1: desviación de tasa normal (~16 parpadeos/min)
        const blinkFatigue = Math.abs(blinkRate - 16) / 16 * 50;

        // Factor 2: ojos cerrados de forma prolongada (microsueños)
        const sleepFatigue = Math.min(50, this.eyesClosedDuration * 10);

        return Math.min(100, blinkFatigue + sleepFatigue);
    }
}
