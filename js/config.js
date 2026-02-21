/**
 * Configuración global y constantes de FocusGuard Pro
 */
const CONFIG = {
    // MediaPipe Face Mesh landmarks indices
    LANDMARKS: {
        LEFT_EYE: [33, 160, 158, 133, 153, 144],
        RIGHT_EYE: [362, 385, 387, 263, 373, 380],
        LEFT_IRIS: [468, 469, 470, 471, 472],
        RIGHT_IRIS: [473, 474, 475, 476, 477],
        NOSE_TIP: 1,
        CHIN: 152,
        LEFT_EYE_INNER: 133,
        RIGHT_EYE_INNER: 362,
        LEFT_EYE_OUTER: 33,
        RIGHT_EYE_OUTER: 263,
        FOREHEAD: 10
    },

    // Umbrales para detección
    THRESHOLDS: {
        EAR_BLINK: 0.18,          // Por debajo de esto se considera ojo cerrado
        BLINK_DURATION_MIN: 100,  // ms para ser considerado parpadeo
        BLINK_DURATION_MAX: 400,  // ms (más de esto es ojo cerrado/fatiga)
        YAW_DISTRACTION: 25,     // grados de giro lateral
        PITCH_DISTRACTION_UP: 20, // grados hacia arriba
        PITCH_DISTRACTION_DOWN: 30, // grados hacia abajo
        GAZE_OFFSET: 0.12,       // Desviación del iris relativa al párpado
        SLEEP_DURATION: 2.0,     // Segundos con ojos cerrados para detectar sueño
        EAR_SLEEP: 0.20          // Umbral de EAR para considerar ojos cerrados (ligeramente superior al parpadeo)
    },

    // Pesos del Focus Score (0 - 1.0)
    WEIGHTS: {
        GAZE: 0.45,
        DISTRACTION: 0.25,
        FATIGUE: 0.15,
        POSTURE: 0.15
    },

    // Configuración de interfaz y suavizado
    UI: {
        CHART_HISTORY_POINTS: 30, // Puntos visibles en gráficas de tiempo real
        FOCUS_SMOOTHING: 0.2,     // Factor alpha para suavizado exponencial (0-1)
        METRIC_UPDATE_MS: 1000,   // Frecuencia de actualización de métricas UI
        ALERT_COOLDOWN: 5000      // Tiempo mínimo entre alertas similares
    },

    // Almacenamiento
    STORAGE_KEY: 'focusguard_history',

    // MediaPipe Vision
    FACE_MESH_OPTIONS: {
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    }
};
