from ultralytics import YOLO
import cv2

# Load the official pre-trained YOLOv8n model (n stands for nano, the smallest version)
model = YOLO('yolov8n.pt')

# Path to an image you want to test
# You can use one of your existing images or any other image file
image_path = 'high_risk_crack_1.jpg' 

# Run inference on the image
results = model(image_path)

# The 'results' object contains the detections. We can visualize them.
# This will get the image with bounding boxes drawn on it.
annotated_frame = results[0].plot()

# Display the annotated image in a window
cv2.imshow("YOLOv8 Detection", annotated_frame)
cv2.waitKey(0) # Wait for a key press to close the image
cv2.destroyAllWindows()

print("Detection complete. Check the pop-up window.")