import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import joblib

# --- 1. Load the Data ---
print("Loading data...")
df = pd.read_csv('mock_sensor_data.csv')

# --- 2. Prepare the Data ---
# We want to predict 'risk_label' (our y) from the sensor readings (our X)
features = ['displacement_mm', 'pore_pressure_kpa', 'strain_micro']
target = 'risk_label'

X = df[features]
y = df[target]

# Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

print("Data prepared. Training model...")

# --- 3. Train the Random Forest Model ---
# Initialize the classifier
# n_estimators=100 means it uses 100 "decision trees"
# random_state=42 ensures we get the same result every time we run it
model = RandomForestClassifier(n_estimators=100, random_state=42)

# Train the model on our training data
model.fit(X_train, y_train)

print("Model training complete.")

# --- 4. Evaluate the Model (Optional, but good practice) ---
predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)
print(f"Model Accuracy on Test Data: {accuracy * 100:.2f}%")

# --- 5. Save the Trained Model ---
# This is the most important step!
# We save the trained model to a file named 'risk_model.joblib'
joblib.dump(model, 'risk_model.joblib')

print("✅ Model has been saved successfully as 'risk_model.joblib'")