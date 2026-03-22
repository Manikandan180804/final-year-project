import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# --- Configuration ---
NUM_ROWS = 1000  # Generate 1000 data points (e.g., one per hour)
START_DATE = datetime(2025, 9, 24, 12, 0, 0) # Using current time as a reference
ANOMALY_START_ROW = 800 # Point at which things start to go wrong

# --- Create a timestamp index ---
timestamps = [START_DATE + timedelta(hours=i) for i in range(NUM_ROWS)]

# --- Generate Normal Data ---
# Simulating normal, stable fluctuations
displacement = np.random.normal(loc=2.5, scale=0.5, size=NUM_ROWS)  # in mm
pore_pressure = np.random.normal(loc=15.0, scale=1.0, size=NUM_ROWS) # in kPa
strain = np.random.normal(loc=0.005, scale=0.001, size=NUM_ROWS)

# --- Inject an Anomaly ---
# After row 800, simulate a progressive failure
anomaly_length = NUM_ROWS - ANOMALY_START_ROW
displacement[ANOMALY_START_ROW:] += np.linspace(0, 15, anomaly_length) # Steadily increasing displacement
pore_pressure[ANOMALY_START_ROW:] += np.linspace(0, 8, anomaly_length)  # Pore pressure increases
strain[ANOMALY_START_ROW:] += np.linspace(0, 0.05, anomaly_length)

# --- Create Labels ---
# 0 = Normal, 1 = High Risk
risk_label = np.zeros(NUM_ROWS)
risk_label[ANOMALY_START_ROW:] = 1

# --- Create DataFrame and Save ---
df = pd.DataFrame({
    'timestamp': timestamps,
    'displacement_mm': displacement,
    'pore_pressure_kpa': pore_pressure,
    'strain_micro': strain,
    'risk_label': risk_label
})

# Round the values for realism
df = df.round({'displacement_mm': 2, 'pore_pressure_kpa': 2, 'strain_micro': 5})

# Save to CSV
df.to_csv('mock_sensor_data.csv', index=False)

print("✅ Successfully generated 'mock_sensor_data.csv' with 1000 rows.")
print(df.tail()) # Print the last 5 rows to show the anomaly