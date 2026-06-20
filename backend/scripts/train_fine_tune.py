import os
from ultralytics import YOLO

def fine_tune_model(data_yaml_path, checkpoint_path='yolo11n.pt', epochs=30, batch_size=16, freeze_layers=10, lr0=0.001):
    """
    Fine-tunes a YOLO model on a merged dataset with class-safe parameters
    to prevent catastrophic forgetting of existing pest classes.
    
    Parameters:
    - data_yaml_path: Path to the merged data.yaml config file.
    - checkpoint_path: Checkpoint model path to start transfer learning from.
    - epochs: Number of training epochs.
    - batch_size: Size of training batch.
    - freeze_layers: Number of early layers to freeze in the network backbone.
    - lr0: Initial learning rate (kept low for fine-tuning).
    """
    print("=" * 60)
    print("YOLO FINE-TUNING PIPELINE")
    print("=" * 60)
    print(f"Loading model checkpoint: {checkpoint_path}")
    model = YOLO(checkpoint_path)
    
    # Setup directories
    project_dir = 'runs/detect'
    name_dir = 'fine_tune_pest'
    
    print(f"Starting training on dataset config: {data_yaml_path}")
    print(f"Hyperparameters: epochs={epochs}, batch={batch_size}, freeze={freeze_layers}, lr0={lr0}")
    
    # Run fine-tuning
    model.train(
        data=data_yaml_path,
        epochs=epochs,
        batch=batch_size,
        freeze=freeze_layers, # Freezes backbone layers to preserve features
        lr0=lr0,              # Lower learning rate than default (0.01) to adapt gently
        lrf=0.01,             # Final learning rate ratio
        project=project_dir,
        name=name_dir,
        exist_ok=True,
        save=True,
        val=True,             # Validate during training
        device=0              # Use GPU (device 0) if available, otherwise CPU
    )
    
    print("\nTraining completed. Validating on original classes list...")
    # Validate the resulting model
    metrics = model.val(data=data_yaml_path, split='val')
    print(f"Validation mAP50: {metrics.results_dict.get('metrics/mAP50(B)', 0.0):.4f}")
    print(f"Validation mAP50-95: {metrics.results_dict.get('metrics/mAP50-95(B)', 0.0):.4f}")
    
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python train_fine_tune.py <merged_data_yaml> [checkpoint_model_pt] [epochs] [freeze_layers]")
    else:
        yaml_path = sys.argv[1]
        ckpt = sys.argv[2] if len(sys.argv) > 2 else 'yolo11n.pt'
        eps = int(sys.argv[3]) if len(sys.argv) > 3 else 30
        frz = int(sys.argv[4]) if len(sys.argv) > 4 else 10
        fine_tune_model(yaml_path, checkpoint_path=ckpt, epochs=eps, freeze_layers=frz)
