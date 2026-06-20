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

def evaluate_and_export(model_weights_path, data_yaml_path, imgsz=960):
    print("=" * 60)
    print(f"EVALUATING MODEL: {model_weights_path}")
    print("=" * 60)
    
    if not os.path.exists(model_weights_path):
        print(f"Error: Weights file '{model_weights_path}' not found.")
        return
        
    # 1. Load trained model
    model = YOLO(model_weights_path)
    
    # 2. Run validation on held-out test split
    print(f"Validating against held-out 'test' split from {data_yaml_path}...")
    metrics = model.val(data=data_yaml_path, split="test")
    
    # 3. Report per-class metrics
    print("\n" + "-" * 50)
    print("YOLOv11 EVALUATION METRICS REPORT")
    print("-" * 50)
    print(f"Overall mAP50-95: {metrics.box.map:.4f}")
    print(f"Overall mAP50:    {metrics.box.map50:.4f}")
    print("\nPer-class mAP50-95 counts:")
    
    # Check if maps list is present
    maps = metrics.box.maps
    for cid, name in model.names.items():
        if cid < len(maps):
            print(f"  Class {cid:2d} ({name:30s}): mAP={maps[cid]:.4f}")
        else:
            print(f"  Class {cid:2d} ({name:30s}): mAP=N/A")
            
    print("\nConfusion matrix files saved automatically in run directories.")
    
    # 4. Export formats
    print("\n" + "-" * 50)
    print("EXPORTING MODEL TO ONNX AND TENSORRT (ENGINE)")
    print("-" * 50)
    
    print(f"Exporting to ONNX format (imgsz={imgsz})...")
    onnx_path = model.export(format="onnx", imgsz=imgsz)
    print(f"ONNX export path: {onnx_path}")
    
    # Check for GPU/TensorRT compatibility
    if torch.cuda.is_available():
        print(f"Exporting to TensorRT Engine format (imgsz={imgsz})...")
        try:
            engine_path = model.export(format="engine", imgsz=imgsz)
            print(f"TensorRT Engine export path: {engine_path}")
        except Exception as e:
            print(f"TensorRT Export failed (expected if TensorRT / CUDA drivers are not fully setup on local): {e}")
    else:
        print("CUDA/GPU is not active. Skipping TensorRT engine export (engine export requires GPU context).")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python evaluate_export.py <best_weights_path> <data_yaml_path> [imgsz]")
    else:
        weights = sys.argv[1]
        yaml_path = sys.argv[2]
        sz = int(sys.argv[3]) if len(sys.argv) > 3 else 960
        evaluate_and_export(weights, yaml_path, imgsz=sz)
