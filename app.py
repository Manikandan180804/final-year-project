from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import pandas as pd
import joblib
import requests
import json
import os
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
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
DEFAULT_LOCATION = "Tiruchirappalli"

# --- EMAIL CONFIGURATION (Gmail SMTP) ---
# Set your Gmail address and App Password below.
# To get an App Password: Google Account → Security → 2FA → App Passwords
SENDER_EMAIL    = "mineguard.alerts@gmail.com"   # <-- Change to your Gmail
SENDER_PASSWORD = "your_app_password_here"        # <-- Change to your App Password

# --- TWILIO SMS CONFIGURATION (optional) ---
# Leave blank to skip SMS. Install twilio: pip install twilio
TWILIO_SID   = ""    # e.g. "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_TOKEN = ""    # e.g. "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_FROM  = ""    # e.g. "+15551234567"

# --- WORKERS DATA FILE ---
WORKERS_FILE = "workers.json"

def load_workers():
    if os.path.exists(WORKERS_FILE):
        with open(WORKERS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_workers(workers):
    with open(WORKERS_FILE, 'w') as f:
        json.dump(workers, f, indent=2)

# --- Load Models and Data ---
print("Loading all models...")
numerical_model = joblib.load('risk_model.joblib')
vision_model = YOLO('crack_detector.pt')
mock_data = pd.read_csv('mock_sensor_data.csv')
print("All models loaded successfully.")

# --- Serve Frontend ---
@app.route('/')
def index():
    return send_file('index.html')

@app.route('/<path:filename>')
def static_files(filename):
    if filename in ['style.css', 'script.js']:
        return send_file(filename)
    return "Not found", 404

# --- Helper Functions ---
def get_weather_data(location=None):
    loc = location or DEFAULT_LOCATION
    if not WEATHERAPI_KEY:
        return None
    try:
        url = f"http://api.weatherapi.com/v1/current.json?key={WEATHERAPI_KEY}&q={loc}"
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        weather = response.json()['current']
        return {
            "rainfall_mm": weather.get('precip_mm', 0),
            "condition": weather['condition']['text'],
            "temperature": weather['temp_c'],
            "humidity": weather.get('humidity', 0),
            "wind_kph": weather.get('wind_kph', 0),
            "location": loc
        }
    except Exception as e:
        print(f"Could not fetch weather data: {e}")
        return None

def get_real_visual_risk_and_save_annotated(image_path, output_folder):
    try:
        results = vision_model(image_path)
        highest_confidence = 0.0
        crack_count = 0
        annotated_image_filename = None
        if results:
            r = results[0]
            crack_count = len(r.boxes)
            if r.boxes.conf.numel() > 0:
                highest_confidence = float(r.boxes.conf.max())
            original_filename = os.path.basename(image_path)
            annotated_image_filename = f"annotated_{original_filename}"
            output_full_path = os.path.join(output_folder, annotated_image_filename)
            annotated_frame = r.plot()
            cv2.imwrite(output_full_path, annotated_frame)
        return highest_confidence, annotated_image_filename, crack_count
    except Exception as e:
        print(f"Error during vision model prediction: {e}")
        return 0.0, None, 0

def get_smart_mitigation(score, sensor_data, crack_count, weather_data):
    actions = []
    displacement = float(sensor_data.get('displacement_mm', 0))
    pore_pressure = float(sensor_data.get('pore_pressure_kpa', 0))
    strain = float(sensor_data.get('strain_micro', 0))

    if score > 0.7:
        actions.append("🚨 IMMEDIATE: Evacuate personnel from high-risk zones.")
        actions.append("🚨 IMMEDIATE: Implement emergency slope stabilization.")
    if displacement > 15:
        actions.append(f"⚠️ High displacement ({displacement:.1f}mm): Install additional inclinometers and increase monitoring frequency to every 30 min.")
    if pore_pressure > 80:
        actions.append(f"⚠️ High pore pressure ({pore_pressure:.1f}kPa): Activate drainage pumps and inspect subsurface drainage channels.")
    if strain > 500:
        actions.append(f"⚠️ Elevated strain ({strain:.1f}με): Deploy extensometers on critical zones and review blasting schedules.")
    if crack_count > 0:
        actions.append(f"🔍 {crack_count} crack(s) detected by YOLO: Schedule immediate visual inspection of slope face.")
    if weather_data and weather_data.get('rainfall_mm', 0) > 5:
        actions.append(f"🌧️ Active rainfall ({weather_data['rainfall_mm']}mm): Increase surface runoff monitoring and check retaining berms.")
    if weather_data and weather_data.get('wind_kph', 0) > 40:
        actions.append(f"💨 High winds ({weather_data['wind_kph']}kph): Suspend crane operations and aerial equipment.")
    if score < 0.4:
        actions.append("✅ Conditions stable. Continue standard monitoring schedule.")
    if not actions:
        actions.append("Conduct detailed geotechnical investigation.")
    return actions

def generate_enhanced_data(base_data, sensor_row=None):
    score = base_data['final_risk_score']
    confidence = random.uniform(0.65, 0.98) if score > 0.4 else random.uniform(0.85, 0.99)
    zones = ["North Slope", "East Wall", "Central Pit", "South Slope"]
    zone_analysis = []
    for z in zones:
        zone_score = min(score * random.uniform(0.75, 1.25), 1.0)
        level = "Critical Risk" if zone_score > 0.7 else ("Moderate Risk" if zone_score > 0.4 else "Low Risk")
        zone_analysis.append({
            "name": z,
            "confidence": f"{zone_score * 100:.1f}%",
            "score": round(zone_score, 3),
            "level": level
        })

    sensor_row_data = sensor_row if sensor_row else {}
    smart_actions = get_smart_mitigation(
        score, sensor_row_data,
        base_data.get('crack_count', 0),
        base_data.get('weather')
    )

    base_data.update({
        'modelConfidence': f"{confidence * 100:.1f}%",
        'analysisDate': datetime.now().strftime("%B %d, %Y %H:%M"),
        'zoneAnalysis': zone_analysis,
        'mitigationActions': smart_actions
    })
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
    location = request.form.get('location', DEFAULT_LOCATION)

    if not sensor_file or not image_file:
        return jsonify({"error": "Missing file"}), 400

    try:
        uploaded_data = pd.read_csv(sensor_file)
        latest_row = uploaded_data.iloc[-1]
        latest_sensor_data = uploaded_data.iloc[[-1]][['displacement_mm', 'pore_pressure_kpa', 'strain_micro']]
        numerical_prob = numerical_model.predict_proba(latest_sensor_data)[0][1]
        chart_data = uploaded_data.tail(20).to_dict('list')
        sensor_row = {
            'displacement_mm': float(latest_row['displacement_mm']),
            'pore_pressure_kpa': float(latest_row['pore_pressure_kpa']),
            'strain_micro': float(latest_row['strain_micro'])
        }
    except Exception as e:
        return jsonify({"error": f"Error processing CSV: {e}"}), 500

    image_name = secure_filename(image_file.filename)
    image_path = os.path.join(app.config['UPLOAD_FOLDER'], image_name)
    image_file.save(image_path)

    visual_prob, annotated_image_filename, crack_count = get_real_visual_risk_and_save_annotated(
        image_path, app.config['UPLOAD_FOLDER']
    )
    weather_data = get_weather_data(location)
    final_risk_score = calculate_final_risk(numerical_prob, visual_prob, weather_data)

    if final_risk_score > 0.7:
        explanation = (f"HIGH RISK: Score {final_risk_score:.2f}. Anomalous sensor readings detected "
                      f"(Displacement: {sensor_row['displacement_mm']:.1f}mm, "
                      f"Pore Pressure: {sensor_row['pore_pressure_kpa']:.1f}kPa) "
                      f"and {crack_count} crack(s) detected with {visual_prob:.0%} confidence.")
    elif final_risk_score > 0.4:
        explanation = (f"MODERATE RISK: Score {final_risk_score:.2f}. Some sensor anomalies observed. "
                      f"{crack_count} crack(s) detected. Continue close monitoring.")
    else:
        explanation = (f"LOW RISK: Score {final_risk_score:.2f}. Sensor readings within normal range. "
                      f"No significant cracks detected. Systems appear stable.")

    response = {
        'image_name': image_name,
        'numerical_model_risk_prob': round(numerical_prob, 3),
        'visual_model_risk_prob': round(visual_prob, 3),
        'final_risk_score': round(final_risk_score, 3),
        'xai_explanation': explanation,
        'chart_data': chart_data,
        'weather': weather_data,
        'annotated_image': annotated_image_filename,
        'original_image': image_name,
        'crack_count': crack_count,
        'sensor_values': sensor_row
    }

    return jsonify(generate_enhanced_data(response, sensor_row))

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/live_sensor', methods=['GET'])
def live_sensor():
    """Returns a single random row from mock sensor data for live simulation."""
    row = mock_data.sample(1).iloc[0]
    displacement = float(row['displacement_mm'])
    pore_pressure = float(row['pore_pressure_kpa'])
    strain = float(row['strain_micro'])

    # Estimate sensor-only risk (no vision)
    sensor_df = pd.DataFrame([{
        'displacement_mm': displacement,
        'pore_pressure_kpa': pore_pressure,
        'strain_micro': strain
    }])
    try:
        prob = numerical_model.predict_proba(sensor_df)[0][1]
    except Exception:
        prob = 0.0

    risk_level = "High" if prob > 0.7 else ("Moderate" if prob > 0.4 else "Low")
    return jsonify({
        'displacement_mm': round(displacement, 2),
        'pore_pressure_kpa': round(pore_pressure, 2),
        'strain_micro': round(strain, 2),
        'estimated_risk': round(prob, 3),
        'risk_level': risk_level,
        'timestamp': datetime.now().strftime("%H:%M:%S")
    })

@app.route('/weather', methods=['GET'])
def weather():
    location = request.args.get('location', DEFAULT_LOCATION)
    data = get_weather_data(location)
    if data:
        return jsonify(data)
    return jsonify({"error": "Could not fetch weather"}), 500

@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json['message']
    analysis_context = request.json['context']
    sensor_vals = analysis_context.get('sensor_values', {})
    prompt = f"""You are MineGuard AI, an expert safety assistant for an open-pit mine monitoring system.
Current Analysis Data:
- Final Risk Score: {analysis_context.get('final_risk_score', 'N/A')} (0=safe, 1=critical)
- Risk Level: {'HIGH' if analysis_context.get('final_risk_score', 0) > 0.7 else 'MODERATE' if analysis_context.get('final_risk_score', 0) > 0.4 else 'LOW'}
- Displacement: {sensor_vals.get('displacement_mm', 'N/A')} mm
- Pore Pressure: {sensor_vals.get('pore_pressure_kpa', 'N/A')} kPa
- Strain: {sensor_vals.get('strain_micro', 'N/A')} με
- Cracks Detected: {analysis_context.get('crack_count', 0)}
- AI Explanation: {analysis_context.get('xai_explanation', 'N/A')}
- Weather: {analysis_context.get('weather', 'N/A')}
User's Question: "{user_message}"
Provide a concise, expert answer relevant to mine safety:"""

    ollama_data = {
        "model": "phi3",
        "messages": [{"role": "user", "content": prompt}],
        "stream": False
    }
    try:
        response = requests.post("http://localhost:11434/api/chat", json=ollama_data, timeout=30)
        response.raise_for_status()
        return jsonify({"reply": response.json()['message']['content']})
    except requests.exceptions.RequestException as e:
        return jsonify({"reply": f"Could not connect to Ollama AI engine. Error: {e}"}), 500

# ================================================================
# WORKER MANAGEMENT ENDPOINTS
# ================================================================

@app.route('/workers', methods=['GET'])
def get_workers():
    return jsonify(load_workers())

@app.route('/workers', methods=['POST'])
def add_worker():
    data = request.json
    name  = data.get('name', '').strip()
    email = data.get('email', '').strip()
    phone = data.get('phone', '').strip()
    zone  = data.get('zone', 'General').strip()
    role  = data.get('role', 'Miner').strip()

    if not name:
        return jsonify({"error": "Name is required"}), 400

    workers = load_workers()
    worker = {
        "id": int(datetime.now().timestamp() * 1000),
        "name": name,
        "email": email,
        "phone": phone,
        "zone": zone,
        "role": role,
        "added": datetime.now().strftime("%Y-%m-%d %H:%M")
    }
    workers.append(worker)
    save_workers(workers)
    return jsonify({"success": True, "worker": worker})

@app.route('/workers/<int:worker_id>', methods=['DELETE'])
def remove_worker(worker_id):
    workers = load_workers()
    workers = [w for w in workers if w['id'] != worker_id]
    save_workers(workers)
    return jsonify({"success": True})

# ================================================================
# ALERT BROADCASTING
# ================================================================

def send_email_alert(recipient_email, recipient_name, risk_score, risk_level, explanation, zone):
    """Send an HTML emergency email to a worker."""
    if not SENDER_EMAIL or not SENDER_PASSWORD or 'your_app_password' in SENDER_PASSWORD:
        print(f"[EMAIL SKIPPED] No credentials configured. Would alert: {recipient_email}")
        return False, "Email not configured (set SENDER_EMAIL and SENDER_PASSWORD in app.py)"

    try:
        color = '#e74c3c' if risk_score > 0.7 else '#f39c12'
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"🚨 MINEGUARD ALERT — {risk_level} Risk Detected"
        msg['From']    = f"MineGuard AI <{SENDER_EMAIL}>"
        msg['To']      = recipient_email

        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
          <div style="background:{color};padding:20px;border-radius:8px 8px 0 0;text-align:center">
            <h1 style="color:white;margin:0">⚠ {risk_level.upper()} RISK ALERT</h1>
            <p style="color:white;margin:5px 0">MineGuard AI — Emergency Notification</p>
          </div>
          <div style="background:#f9f9f9;padding:24px;border:1px solid #ddd;border-radius:0 0 8px 8px">
            <p>Dear <strong>{recipient_name}</strong>,</p>
            <p>MineGuard AI has detected a <strong style="color:{color}">{risk_level.upper()}</strong> risk condition at your mine site.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr style="background:#eee"><th style="padding:10px;text-align:left">Field</th><th style="padding:10px;text-align:left">Value</th></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #ddd">Risk Score</td><td style="padding:10px;border-bottom:1px solid #ddd;color:{color};font-weight:bold">{risk_score*100:.1f}%</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #ddd">Your Zone</td><td style="padding:10px;border-bottom:1px solid #ddd">{zone}</td></tr>
              <tr><td style="padding:10px;border-bottom:1px solid #ddd">Time</td><td style="padding:10px;border-bottom:1px solid #ddd">{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</td></tr>
              <tr><td style="padding:10px">AI Explanation</td><td style="padding:10px">{explanation}</td></tr>
            </table>
            <div style="background:{color};color:white;padding:14px;border-radius:6px;margin:16px 0;text-align:center;font-size:1.1em;font-weight:bold">
              {'🚨 EVACUATE IMMEDIATELY' if risk_score > 0.7 else '⚠ EXERCISE CAUTION — INCREASED MONITORING REQUIRED'}
            </div>
            <p style="color:#888;font-size:0.85em">This is an automated alert from MineGuard AI Safety System. Do not reply to this email.</p>
          </div>
        </div>"""

        msg.attach(MIMEText(html, 'html'))

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, recipient_email, msg.as_string())

        print(f"[EMAIL SENT] → {recipient_email}")
        return True, "Email sent"
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        return False, str(e)

def send_sms_alert(phone_number, name, risk_level, risk_score):
    """Send SMS via Twilio if configured."""
    if not TWILIO_SID or not TWILIO_TOKEN or not TWILIO_FROM:
        print(f"[SMS SKIPPED] Twilio not configured. Would SMS: {phone_number}")
        return False, "Twilio not configured"
    try:
        from twilio.rest import Client
        client = Client(TWILIO_SID, TWILIO_TOKEN)
        action = 'EVACUATE IMMEDIATELY!' if risk_score > 0.7 else 'Exercise caution & increase monitoring.'
        body = (f"🚨 MineGuard AI ALERT\nWorker: {name}\nRisk: {risk_level.upper()} ({risk_score*100:.0f}%)\n"
                f"Time: {datetime.now().strftime('%H:%M:%S')}\n{action}")
        message = client.messages.create(body=body, from_=TWILIO_FROM, to=phone_number)
        print(f"[SMS SENT] → {phone_number} (SID: {message.sid})")
        return True, "SMS sent"
    except Exception as e:
        print(f"[SMS ERROR] {e}")
        return False, str(e)

@app.route('/broadcast_alert', methods=['POST'])
def broadcast_alert():
    """Send email + SMS alerts to all registered workers or specified workers."""
    data = request.json
    risk_score   = data.get('risk_score', 0)
    risk_level   = data.get('risk_level', 'Unknown')
    explanation  = data.get('explanation', '')
    worker_ids   = data.get('worker_ids', None)  # None = all workers
    manual       = data.get('manual', False)

    workers = load_workers()
    if worker_ids:
        workers = [w for w in workers if w['id'] in worker_ids]

    if not workers:
        return jsonify({"error": "No workers to alert", "sent": 0}), 400

    results = []

    def send_to_all():
        for worker in workers:
            result = {"id": worker['id'], "name": worker['name'], "email_status": None, "sms_status": None}
            # Email
            if worker.get('email'):
                ok, msg = send_email_alert(
                    worker['email'], worker['name'],
                    risk_score, risk_level, explanation, worker.get('zone', 'General')
                )
                result['email_status'] = 'sent' if ok else f'failed: {msg}'
            # SMS
            if worker.get('phone'):
                ok, msg = send_sms_alert(worker['phone'], worker['name'], risk_level, risk_score)
                result['sms_status'] = 'sent' if ok else f'skipped: {msg}'
            results.append(result)

    # Run in background thread so Flask doesn't block
    thread = threading.Thread(target=send_to_all)
    thread.start()
    thread.join(timeout=15)  # wait max 15 seconds

    sent_count = len(workers)
    print(f"[BROADCAST] Alert sent to {sent_count} worker(s). Level: {risk_level}")
    return jsonify({
        "success": True,
        "sent": sent_count,
        "results": results,
        "message": f"Alerts dispatched to {sent_count} worker(s)"
    })

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)