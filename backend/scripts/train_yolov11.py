import os
import torch

# PyTorch 2.6 weights_only monkeypatch to support loading YOLO models
original_load = torch.load
def patched_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return original_load(*args, **kwargs)
torch.load = patched_load

from ultralytics import YOLO

def train_yolov11(data_yaml_path, epochs=150, imgsz=960, batch=16, patience=20):
    print("=" * 60)
    print("ULTRALYTICS YOLOv11 RIGOROUS TRAINING PIPELINE")
    print("=" * 60)
    
    # 1. Device check
    device = 0 if torch.cuda.is_available() else 'cpu'
    print(f"CUDA Available: {torch.cuda.is_available()}")
    print(f"Selected Device: {device}")
    
    # 2. Load model (using yolo11m.pt pretrained weights for transfer learning)
    model_name = "yolo11m.pt"
    print(f"Loading pretrained model for transfer learning: {model_name}")
    model = YOLO(model_name)
    
    # Setup directories
    project_dir = 'runs/detect'
    run_name = 'rigorous_training'
    
    # 3. Start training with exact user-requested configuration parameters
    print(f"Beginning training on dataset: {data_yaml_path}")
    print(f"Configurations:\n  Epochs: {epochs}\n  Image size: {imgsz}\n  Batch size: {batch}\n  Patience: {patience}\n  Optimizer: AdamW\n  Initial LR: 0.001\n  Cosine LR Scheduler: True")
    
    model.train(
        data=data_yaml_path,
        model=model_name,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        patience=patience,
        device=device,
        optimizer='AdamW',
        lr0=0.001,
        cos_lr=True,
        # Augmentations for agriculture/overlap cases:
        mosaic=1.0,
        mixup=0.1,
        # Color jitter kept moderate to preserve species color characteristics:
        hsv_h=0.015,
        hsv_s=0.6,
        hsv_v=0.3,
        # Spatial augmentations:
        degrees=10,
        translate=0.1,
        scale=0.4,
        fliplr=0.5,
        # Saving and project paths:
        project=project_dir,
        name=run_name,
        exist_ok=True,
        save=True,
        val=True
    )
    print("\nTraining run finished successfully.")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python train_yolov11.py <data_yaml_path> [epochs] [imgsz] [batch]")
    else:
        yaml_path = sys.argv[1]
        eps = int(sys.argv[2]) if len(sys.argv) > 2 else 150
        sz = int(sys.argv[3]) if len(sys.argv) > 3 else 960
        bt = int(sys.argv[4]) if len(sys.argv) > 4 else 16
        train_yolov11(yaml_path, epochs=eps, imgsz=sz, batch=bt)
