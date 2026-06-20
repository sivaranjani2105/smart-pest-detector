import os
import yaml
import numpy as np
import cv2

def generate_synthetic_dataset():
    print("=" * 60)
    print("GENERATING SYNTHETIC YOLOv11 PEST DATASET FOR TESTING")
    print("=" * 60)
    
    dataset_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))
    print(f"Creating dataset directories under: {dataset_dir}")
    
    # 1. Define class names
    classes = [
        "Locust (Schistocerca gregaria)",
        "Fall Armyworm (Spodoptera frugiperda)",
        "Aphids (Aphis gossypii)",
        "Red Spider Mites (Tetranychus urticae)",
        "Honeybee (Apis mellifera)",
        "Ladybug (Coccinellidae)",
        "Parasitic Wasp (Trichogramma)",
        "Human"
    ]
    
    # 2. Write data.yaml
    data_yaml = {
        "path": dataset_dir,
        "train": "images/train",
        "val": "images/val",
        "test": "images/test",
        "names": {i: name for i, name in enumerate(classes)}
    }
    
    os.makedirs(dataset_dir, exist_ok=True)
    yaml_path = os.path.join(dataset_dir, "data.yaml")
    with open(yaml_path, "w") as f:
        yaml.safe_dump(data_yaml, f, default_flow_style=False)
    print(f"Saved dataset config: {yaml_path}")
    
    splits = {
        "train": 6,
        "val": 2,
        "test": 2
    }
    
    # Image dimension
    img_size = 128
    
    # Create empty mock image (black background)
    dummy_img = np.zeros((img_size, img_size, 3), dtype=np.uint8)
    # Add a simple shape to simulate content
    cv2.putText(dummy_img, "AI Pest Scanner Mock Frame", (50, 480), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 3)
    
    for split_name, count in splits.items():
        img_dir = os.path.join(dataset_dir, "images", split_name)
        lbl_dir = os.path.join(dataset_dir, "labels", split_name)
        os.makedirs(img_dir, exist_ok=True)
        os.makedirs(lbl_dir, exist_ok=True)
        
        print(f"Generating {count} mock samples for split: {split_name}")
        
        for i in range(count):
            img_filename = f"pest_sample_{split_name}_{i:03d}.jpg"
            lbl_filename = f"pest_sample_{split_name}_{i:03d}.txt"
            
            img_path = os.path.join(img_dir, img_filename)
            lbl_path = os.path.join(lbl_dir, lbl_filename)
            
            # Save dummy image
            cv2.imwrite(img_path, dummy_img)
            
            # Generate dummy labels
            # To simulate class imbalance, let's weight class assignments:
            # Locust (0) and Armyworm (1) get lots of instances (> 150 total)
            # Honeybee (4) and ladybug (5) get very few instances (< 150) to test audit alerts
            rand = np.random.rand()
            if rand < 0.35:
                class_id = 0  # Locust
            elif rand < 0.65:
                class_id = 1  # Armyworm
            elif rand < 0.75:
                class_id = 2  # Aphid
            elif rand < 0.85:
                class_id = 3  # Red Spider Mite
            elif rand < 0.90:
                class_id = 7  # Human
            else:
                class_id = np.random.randint(4, 7)  # Rarest beneficial insects (4, 5, 6)
                
            # Random normalized coordinates [x_center, y_center, width, height]
            x_center = round(np.random.uniform(0.2, 0.8), 4)
            y_center = round(np.random.uniform(0.2, 0.8), 4)
            width = round(np.random.uniform(0.1, 0.3), 4)
            height = round(np.random.uniform(0.1, 0.3), 4)
            
            with open(lbl_path, "w") as lf:
                lf.write(f"{class_id} {x_center} {y_center} {width} {height}\n")
                
                # Add secondary mock detection in 20% of images
                if np.random.rand() < 0.2:
                    sec_class_id = np.random.randint(0, 8)
                    sec_x = round(np.random.uniform(0.2, 0.8), 4)
                    sec_y = round(np.random.uniform(0.2, 0.8), 4)
                    sec_w = round(np.random.uniform(0.1, 0.2), 4)
                    sec_h = round(np.random.uniform(0.1, 0.2), 4)
                    lf.write(f"{sec_class_id} {sec_x} {sec_y} {sec_w} {sec_h}\n")
                    
    print("\n[SUCCESS] Mock agricultural dataset fully initialized.")

if __name__ == "__main__":
    generate_synthetic_dataset()
