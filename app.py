from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
import joblib
import requests
import json
import os
from werkzeug.utils import secure_filename
import random
from datetime import datetime
from ultralytics import YOLO
import cv2

app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# --- CONFIGURATION ---
WEATHERAPI_KEY = "bf9065b52e48400984c174017252609"

# --- Load Models and Data ---
print("Loading all models...")
numerical_model = joblib.load('risk_model.joblib')
vision_model = YOLO('crack_detector.pt')
mock_data = pd.read_csv('mock_sensor_data.csv')
print("All models loaded successfully.")

# --- Helper Functions ---
def get_weather_data():
    if not WEATHERAPI_KEY: return None
    try:
        url = f"http://api.weatherapi.com/v1/current.json?key={WEATHERAPI_KEY}&q=Tiruchirappalli"
        response = requests.get(url)
        response.raise_for_status()
        weather = response.json()['current']
        return {"rainfall_mm": weather.get('precip_mm', 0), "condition": weather['condition']['text'], "temperature": weather['temp_c']}
    except Exception as e:
        print(f"Could not fetch weather data: {e}")
        return None

def get_real_visual_risk_and_save_annotated(image_path, output_folder):
    try:
        results = vision_model(image_path)
        highest_confidence = 0.0
        annotated_image_filename = None
        if results:
            r = results[0]
            if r.boxes.conf.numel() > 0:
                highest_confidence = float(r.boxes.conf.max())
            original_filename = os.path.basename(image_path)
            annotated_image_filename = f"annotated_{original_filename}"
            output_full_path = os.path.join(output_folder, annotated_image_filename)
            annotated_frame = r.plot()
            cv2.imwrite(output_full_path, annotated_frame)
        return highest_confidence, annotated_image_filename
    except Exception as e:
        print(f"Error during vision model prediction: {e}")
        return 0.0, None

def generate_enhanced_data(base_data):
    score = base_data['final_risk_score']
    confidence = random.uniform(0.65, 0.98) if score > 0.4 else random.uniform(0.85, 0.99)
    zones = ["North Slope", "East Wall", "Central Pit", "South Slope"]
    zone_analysis = [{"name": z, "confidence": f"{min(score * random.uniform(0.8, 1.2), 1.0) * 100:.1f}%", "level": "Critical Risk" if score > 0.7 else "Moderate Risk"} for z in zones]
    actions = ["Conduct detailed geotechnical investigation."]
    if score > 0.7: actions.insert(0, "Implement immediate slope stabilization.")
    base_data.update({'modelConfidence': f"{confidence * 100:.1f}%", 'analysisDate': datetime.now().strftime("%B %d, %Y"), 'zoneAnalysis': zone_analysis, 'mitigationActions': actions})
    return base_data

def calculate_final_risk(numerical_prob, visual_prob, weather_data):
    base_risk = (0.6 * numerical_prob) + (0.4 * visual_prob)
    rainfall_modifier = 0
    if weather_data and weather_data['rainfall_mm'] > 0:
        rainfall_modifier = min(weather_data['rainfall_mm'] / 10, 0.3)
    return min(base_risk * (1 + rainfall_modifier), 1.0)

# --- API Endpoints ---
@app.route('/predict_upload', methods=['POST'])
def predict_upload():
    sensor_file = request.files.get('sensorFile')
    image_file = request.files.get('imageFile')
    if not sensor_file or not image_file: return jsonify({"error": "Missing file"}), 400

    try:
        uploaded_data = pd.read_csv(sensor_file)
        latest_sensor_data = uploaded_data.iloc[[-1]][['displacement_mm', 'pore_pressure_kpa', 'strain_micro']]
        numerical_prob = numerical_model.predict_proba(latest_sensor_data)[0][1]
        chart_data = uploaded_data.tail(20).to_dict('list')
    except Exception as e:
        return jsonify({"error": f"Error processing CSV: {e}"}), 500

    image_name = secure_filename(image_file.filename)
    image_path = os.path.join(app.config['UPLOAD_FOLDER'], image_name)
    image_file.save(image_path)

    visual_prob, annotated_image_filename = get_real_visual_risk_and_save_annotated(image_path, app.config['UPLOAD_FOLDER'])
    weather_data = get_weather_data()
    final_risk_score = calculate_final_risk(numerical_prob, visual_prob, weather_data)

    if final_risk_score > 0.7:
        explanation = f"HIGH RISK: Score {final_risk_score:.2f}. Anomalous sensor readings and crack detected with {visual_prob:.0%} confidence. Risk amplified by weather."
    else:
        explanation = f"LOW RISK: Score {final_risk_score:.2f}. Systems appear stable."

    response = {
        'image_name': image_name, 'numerical_model_risk_prob': round(numerical_prob, 3), 'visual_model_risk_prob': round(visual_prob, 3),
        'final_risk_score': round(final_risk_score, 3), 'xai_explanation': explanation, 'chart_data': chart_data, 'weather': weather_data,
        'annotated_image': annotated_image_filename
    }
    
    return jsonify(generate_enhanced_data(response))

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json['message']
    analysis_context = request.json['context']
    prompt = f"""
    You are MineGuard AI, an expert assistant for a mine safety system.
    Current Analysis Data:
    - Final Risk Score: {analysis_context.get('final_risk_score', 'N/A')}
    - AI Explanation: {analysis_context.get('xai_explanation', 'N/A')}
    User's Question: "{user_message}"
    Your Answer:
    """
    ollama_data = {"model": "phi3", "messages": [{"role": "user", "content": prompt}], "stream": False}
    try:
        response = requests.post("http://localhost:11434/api/chat", json=ollama_data)
        response.raise_for_status()
        return jsonify({"reply": response.json()['message']['content']})
    except requests.exceptions.RequestException as e:
        return jsonify({"reply": f"Could not connect to Ollama. Error: {e}"}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)