/**
 * Motor de análisis de Face Mesh y Visión Directa
 */
class FaceAnalyzer {
    constructor(onResults) {
        this.faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        this.faceMesh.setOptions(CONFIG.FACE_MESH_OPTIONS);
        this.faceMesh.onResults(onResults);

        this.camera = null;
    }

    async start(videoElement) {
        this.camera = new Camera(videoElement, {
            onFrame: async () => {
                await this.faceMesh.send({ image: videoElement });
            },
            width: 640,
            height: 480
        });
        return this.camera.start();
    }

    stop() {
        if (this.camera) this.camera.stop();
    }

    /**
     * Eye Aspect Ratio (EAR)
     * Fórmula: EAR = (||p1-p5|| + ||p2-p4||) / (2 × ||p0-p3||)
     * Umbral de parpadeo: EAR < 0.18 indica ojo cerrado
     */
    static calculateEAR(landmarks, eyeIndices) {
        const p = eyeIndices.map(i => landmarks[i]);
        const d_v1 = this.dist(p[1], p[5]);
        const d_v2 = this.dist(p[2], p[4]);
        const d_h = this.dist(p[0], p[3]);

        // Guard: si el ojo no es visible d_h puede ser ~0
        if (d_h < 0.001) return 0;

        return (d_v1 + d_v2) / (2.0 * d_h);
    }

    /**
     * Head Pose simplificado — produce pitch, yaw y roll en grados aprox.
     */
    static estimateHeadPose(landmarks) {
        const nose = landmarks[CONFIG.LANDMARKS.NOSE_TIP];
        const chin = landmarks[CONFIG.LANDMARKS.CHIN];
        const leftEye = landmarks[CONFIG.LANDMARKS.LEFT_EYE_INNER];
        const rightEye = landmarks[CONFIG.LANDMARKS.RIGHT_EYE_INNER];
        const forehead = landmarks[CONFIG.LANDMARKS.FOREHEAD];

        const upperDist = this.dist(nose, forehead);
        const lowerDist = this.dist(nose, chin);
        // Clampear a ±30° para evitar valores extremos en condiciones de borde
        const pitch = Math.max(-30, Math.min(30,
            (upperDist / (upperDist + lowerDist) - 0.5) * 120
        ));

        const eyeCenter = { x: (leftEye.x + rightEye.x) / 2 };
        const yaw = Math.max(-45, Math.min(45,
            (nose.x - eyeCenter.x) * 180
        ));

        const roll = Math.atan2(
            rightEye.y - leftEye.y,
            rightEye.x - leftEye.x
        ) * (180 / Math.PI);

        return { pitch, yaw, roll };
    }

    /**
     * Gaze estimation — posición normalizada del iris dentro del ojo
     * Retorna {x, y} en rango aprox. [-0.5, 0.5]; 0 = mirando al frente
     */
    static estimateGaze(landmarks, eyeIndices, irisIndices) {
        const eyeP = eyeIndices.map(i => landmarks[i]);
        const irisP = irisIndices.map(i => landmarks[i]);

        const irisCenter = irisP[0];
        const eyeCenter = {
            x: (eyeP[0].x + eyeP[3].x) / 2,
            y: (eyeP[1].y + eyeP[5].y) / 2
        };

        const eyeWidth = eyeP[3].x - eyeP[0].x;
        const eyeHeight = eyeP[5].y - eyeP[1].y;

        // Guard: división por cero cuando el ojo no es visible
        if (Math.abs(eyeWidth) < 0.001 || Math.abs(eyeHeight) < 0.001) {
            return { x: 0, y: 0 };
        }

        return {
            x: (irisCenter.x - eyeCenter.x) / eyeWidth,
            y: (irisCenter.y - eyeCenter.y) / eyeHeight
        };
    }

    static dist(p1, p2) {
        return Math.sqrt(
            Math.pow(p1.x - p2.x, 2) +
            Math.pow(p1.y - p2.y, 2) +
            Math.pow((p1.z || 0) - (p2.z || 0), 2)
        );
    }
}
