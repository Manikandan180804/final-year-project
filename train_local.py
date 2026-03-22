import torch
from ultralytics import YOLO
from roboflow import Roboflow

if __name__ == '__main__':
    print("--- Script Started ---")

    if torch.cuda.is_available():
        device = torch.device("cuda:0")
        print("--- NVIDIA GPU is available. Setting device to CUDA. ---")
    else:
        device = torch.device("cpu")
        print("--- NVIDIA GPU not available. Using CPU. ---")
        exit("Error: No CUDA GPU detected. Please fix the environment setup.")

    try:
        print("Step 1: Connecting to Roboflow and downloading dataset...")
        rf = Roboflow(api_key="Bzh006Eqt6t7xnYwZclf")
        project = rf.workspace("track-lable").project("mine-crack-datasets-7htds")
        version = project.version(1)
        dataset = version.download("yolov8")
        print("--- Dataset downloaded successfully. ---")

        print("Step 2: Loading the pre-trained YOLOv8 model...")
        model = YOLO('yolov8n.pt')
        model.to(device)
        print("--- YOLOv8 model loaded successfully. ---")

        print("Step 3: Starting the training process with memory optimization...")
        # Reduce batch size to 2 and image size to 416 to fit in 6GB VRAM
        results = model.train(data=f'{dataset.location}/data.yaml', epochs=100, imgsz=416, device=0, batch=2)
        print("--- Training process finished. ---")

    except Exception as e:
        print(f"AN ERROR OCCURRED: {e}")

    print("--- Script Finished ---")