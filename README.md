# FocusGuard Pro 🛡️

**Analítica de Visión Avanzada para Estudiantes de Alto Rendimiento.**

FocusGuard Pro es una aplicación web de vanguardia diseñada para ayudar a los estudiantes universitarios a maximizar su productividad mediante el monitoreo en tiempo real de su enfoque, fatiga y postura. Utilizando tecnología de visión artificial directamente en el navegador, la aplicación proporciona métricas precisas y alertas preventivas para optimizar las sesiones de estudio.

## ✨ Características Principales

-   🌍 **Localización Total**: Interfaz completamente en español para una experiencia fluida.
-   📱 **Diseño Responsive**: Panel de control optimizado para computadoras, tablets y dispositivos móviles.
-   👁️ **Análisis de Visión Pro**:
    -   **Focus Score**: Un puntaje dinámico (0-100) basado en tu nivel de atención.
    -   **Detección de Sueño**: Sistema crítico que lanza una alerta visual y sonora si tus ojos permanecen cerrados por más de 2 segundos.
    -   **Índice de Fatiga**: Monitoreo de la tasa de parpadeo para identificar el agotamiento.
    -   **Estabilidad de Postura**: Alertas si tu posición de estudio es deficiente.
-   🕒 **Gestión de Tiempo**:
    -   **Temporizador Pomodoro**: Integrado directamente en el flujo de trabajo.
    -   **Contador de Distracciones**: Rastrea el tiempo total acumulado que pasas fuera de la pantalla.
-   🔒 **Privacidad Garantizada**: Todo el procesamiento de video ocurre localmente en tu navegador. Incluye un **Modo Privado** para pausar la cámara instantáneamente.
-   📊 **Historial de Sesiones**: Consulta tus materias, duraciones y puntuaciones de enfoque pasadas.

## 🚀 Tecnologías Utilizadas

-   **Core**: HTML5, CSS3 dinámico, Vanilla JavaScript (ES6+).
-   **IA / Visión**: [MediaPipe Face Mesh](https://google.github.io/mediapipe/solutions/face_mesh) para tracking facial de alta fidelidad (478 puntos, incluyendo iris).
-   **Gráficos**: [Chart.js](https://www.chartjs.org/) para visualización de tendencias en tiempo real.
-   **Audio**: Web Audio API para síntesis de alarmas sin dependencias externas.
-   **Iconos**: [Lucide Icons](https://lucide.dev/).

## 🛠️ Instalación y Uso

1.  **Clona el repositorio**:
    ```bash
    git clone https://github.com/DaniaRamxs/focus-guard-pro.git
    cd focus-guard-pro
    ```

2.  **Inicia la aplicación**:
    FocusGuard Pro no requiere un servidor complejo debido a su arquitectura pura. Puedes usar cualquier servidor estático:
    ```bash
    npx serve
    # o simplemente usa la extensión Live Server en VS Code
    ```

3.  **Configuración de Sesión**:
    Ingresa tu nombre, materia y tiempo de estudio para comenzar el monitoreo.

## 🛡️ Privacidad y Seguridad

Tu privacidad es nuestra prioridad. FocusGuard Pro:
-   **No** almacena video ni imágenes en ningún servidor.
-   **No** requiere de una base de datos externa (usa `localStorage`).
-   El procesamiento de MediaPipe se realiza enteramente en el cliente (tu CPU/GPU local).

---
*Desarrollado con ❤️ para mejorar el aprendizaje académico.*
