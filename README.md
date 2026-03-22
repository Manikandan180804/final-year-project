# MineGuard AI: Mine Safety Monitoring System

MineGuard AI is an advanced safety monitoring system designed to predict and mitigate risks in mining environments. It combines numerical sensor data analysis, computer vision for crack detection, and real-time weather information to provide a comprehensive risk assessment.

## Features

- **Multi-Modal Risk Assessment**: Integrates sensor data (displacement, pore pressure, strain) and visual inspections.
- **Computer Vision**: Uses YOLO (You Only Look Once) to detect cracks in mine structures.
- **Real-Time Weather Integration**: Factors in rainfall and temperature to adjust risk scores.
- **AI-Powered Insights**: Provides detailed explanations for risk levels.
- **Interactive Dashboard**: Visualize sensor trends and annotated structural images.
- **AI Chat Assistant**: Get context-aware answers about the latest safety analysis.

## Tech Stack

- **Backend**: Flask (Python)
- **AI/ML**: YOLOv11 (Vision), joblib (Numerical Models), Ollama (phi3 for Chat)
- **Frontend**: HTML5, CSS3, JavaScript
- **Data Handling**: Pandas, CSV

## Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/[YOUR_USERNAME]/SIH25.git
    cd SIH25
    ```

2.  **Set up a virtual environment**:
    ```bash
    python -m venv env
    source env/bin/activate  # On Windows: env\Scripts\activate
    ```

3.  **Install dependencies**:
    ```bash
    pip install flask flask-cors pandas joblib ultralytics opencv-python requests
    ```

4.  **Run the application**:
    ```bash
    python app.py
    ```

## Usage

- Upload CSV sensor data and structural images via the dashboard.
- View real-time risk scores and automated structural analysis.
- Chat with MineGuard AI for safety recommendations.

## License

MIT License
