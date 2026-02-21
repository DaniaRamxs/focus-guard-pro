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
     * Calcula el Eye Aspect Ratio (EAR)
     */
    static calculateEAR(landmarks, eyeIndices) {
        const p = eyeIndices.map(i => landmarks[i]);

        // Distancias verticales
        const d_v1 = this.dist(p[1], p[5]);
        const d_v2 = this.dist(p[2], p[4]);

        // Distancia horizontal
        const d_h = this.dist(p[0], p[3]);

        return (d_v1 + d_v2) / (2.0 * d_h);
    }

    /**
     * Estima Head Pose (Simplificado)
     */
    static estimateHeadPose(landmarks) {
        const nose = landmarks[CONFIG.LANDMARKS.NOSE_TIP];
        const chin = landmarks[CONFIG.LANDMARKS.CHIN];
        const leftEye = landmarks[CONFIG.LANDMARKS.LEFT_EYE_INNER];
        const rightEye = landmarks[CONFIG.LANDMARKS.RIGHT_EYE_INNER];
        const forehead = landmarks[CONFIG.LANDMARKS.FOREHEAD];

        // Pitch: Basado en la distancia proporcional nariz-barba vs nariz-frente
        const upperDist = this.dist(nose, forehead);
        const lowerDist = this.dist(nose, chin);
        const pitch = (upperDist / (upperDist + lowerDist) - 0.5) * 180;

        // Yaw: Basado en la desviación horizontal de la nariz respecto al centro de los ojos
        const eyeCenter = {
            x: (leftEye.x + rightEye.x) / 2,
            y: (leftEye.y + rightEye.y) / 2
        };
        const yaw = (nose.x - eyeCenter.x) * 180;

        // Roll: Ángulo entre los ojos
        const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

        return { pitch, yaw, roll };
    }

    /**
     * Calcula posición de iris relativo al ojo (Gaze)
     */
    static estimateGaze(landmarks, eyeIndices, irisIndices) {
        const eyeP = eyeIndices.map(i => landmarks[i]);
        const irisP = irisIndices.map(i => landmarks[i]);

        const irisCenter = irisP[0];
        const eyeCenter = {
            x: (eyeP[0].x + eyeP[3].x) / 2,
            y: (eyeP[1].y + eyeP[5].y) / 2
        };

        return {
            x: (irisCenter.x - eyeCenter.x) / (eyeP[3].x - eyeP[0].x),
            y: (irisCenter.y - eyeCenter.y) / (eyeP[5].y - eyeP[1].y)
        };
    }

    static dist(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
    }
}
