import os
import yaml
import glob
from collections import defaultdict
import numpy as np

def audit_dataset(data_yaml_path):
    print("=" * 60)
    print(f"AUDITING DATASET CONFIG: {data_yaml_path}")
    print("=" * 60)
    
    if not os.path.exists(data_yaml_path):
        print(f"Error: {data_yaml_path} does not exist.")
        return None
        
    with open(data_yaml_path, 'r') as f:
        data_config = yaml.safe_load(f)
        
    names = data_config.get('names', {})
    if isinstance(names, list):
        names = {i: n for i, n in enumerate(names)}
    
    nc = len(names)
    print(f"Dataset has {nc} registered classes:")
    for cid, name in names.items():
        print(f"  Class {cid}: {name}")
        
    # Find splits
    path_root = data_config.get('path', '')
    train_dir = data_config.get('train', '')
    val_dir = data_config.get('val', '')
    test_dir = data_config.get('test', '')
    
    splits = {'train': train_dir, 'val': val_dir, 'test': test_dir}
    class_counts = defaultdict(int)
    image_with_class = defaultdict(set)
    total_images_in_splits = {}
    
    box_issues = []
    total_boxes = 0
    
    for split_name, split_path in splits.items():
        if not split_path:
            print(f"Warning: {split_name} split path is not defined.")
            continue
            
        # Resolve path
        full_path = split_path
        if path_root and not os.path.isabs(split_path):
            full_path = os.path.join(path_root, split_path)
            
        if not os.path.exists(full_path):
            # Check if relative to yaml path
            yaml_dir = os.path.dirname(data_yaml_path)
            full_path = os.path.join(yaml_dir, path_root, split_path)
            
        print(f"\nScanning split '{split_name}' at: {full_path}")
        
        # Search for text label files
        # Convert images subpath to labels subpath
        label_dir = full_path.replace('images', 'labels')
        if not os.path.exists(label_dir):
            # Try sibling folder labels
            parent_dir = os.path.dirname(full_path)
            label_dir = os.path.join(parent_dir, 'labels')
            
        if not os.path.exists(label_dir):
            print(f"Warning: Labels folder '{label_dir}' not found for images split.")
            continue
            
        label_files = glob.glob(os.path.join(label_dir, "*.txt"))
        total_images_in_splits[split_name] = len(label_files)
        print(f"  Found {len(label_files)} label files.")
        
        # Spot check box coordinates
        for l_file in label_files:
            img_name = os.path.splitext(os.path.basename(l_file))[0]
            with open(l_file, 'r') as lf:
                lines = lf.readlines()
                
            for line_idx, line in enumerate(lines):
                parts = line.strip().split()
                if not parts:
                    continue
                try:
                    cls_id = int(parts[0])
                    coords = [float(x) for x in parts[1:5]]
                    
                    class_counts[cls_id] += 1
                    image_with_class[cls_id].add((split_name, img_name))
                    total_boxes += 1
                    
                    # Bounding Box Sanity checks (x_center, y_center, width, height normalized)
                    x, y, w, h = coords
                    if x <= 0 or x >= 1 or y <= 0 or y >= 1:
                        box_issues.append((l_file, line_idx, f"Invalid center coordinate (x={x}, y={y})"))
                    if w <= 0 or w >= 1 or h <= 0 or h >= 1:
                        box_issues.append((l_file, line_idx, f"Invalid size dimension (w={w}, h={h})"))
                except Exception as e:
                    box_issues.append((l_file, line_idx, f"Parsing exception: {str(e)}"))
                    
    print("\n" + "-" * 50)
    print("CLASS BALANCE AUDIT SUMMARY:")
    print("-" * 50)
    
    underrepresented_classes = []
    
    for cid, name in names.items():
        count = class_counts[cid]
        img_count = len(image_with_class[cid])
        print(f"Class {cid} ({name}):")
        print(f"  - Total Instances: {count}")
        print(f"  - Total Images: {img_count}")
        
        # Flag if under 150 instances/images
        if img_count < 150:
            underrepresented_classes.append((cid, name, img_count))
            print(f"  => [ALERT] Underrepresented! Has only {img_count} images (target: >= 150).")
            
    print("\n" + "-" * 50)
    print("ANNOTATION QUALITY SPOT-CHECK:")
    print("-" * 50)
    print(f"Total Bounding Boxes Checked: {total_boxes}")
    if box_issues:
        print(f"Found {len(box_issues)} box issues:")
        for issue in box_issues[:15]:
            print(f"  File {os.path.basename(issue[0])} (Line {issue[1]+1}): {issue[2]}")
        if len(box_issues) > 15:
            print(f"  ... and {len(box_issues) - 15} more issues.")
    else:
        print("  [SUCCESS] All bounding box coordinates are correctly normalized and valid.")
        
    return {
        'class_counts': class_counts,
        'image_with_class': image_with_class,
        'underrepresented': underrepresented_classes,
        'box_issues': box_issues
    }

def stratify_and_split_dataset(raw_dir, output_dir, train_ratio=0.7, val_ratio=0.2, test_ratio=0.1):
    """
    Splits data stratified by class, ensuring rare classes are represented in val/test.
    """
    print("\n" + "=" * 60)
    print(f"STRATIFIED DATA SPLIT PIPELINE ({train_ratio*100}% / {val_ratio*100}% / {test_ratio*100}%)")
    print("=" * 60)
    
    raw_images_dir = os.path.join(raw_dir, "images")
    raw_labels_dir = os.path.join(raw_dir, "labels")
    
    if not os.path.exists(raw_images_dir) or not os.path.exists(raw_labels_dir):
        print(f"Error: Raw folders images/labels not found under {raw_dir}")
        return
        
    image_files = glob.glob(os.path.join(raw_images_dir, "*.*"))
    label_files = glob.glob(os.path.join(raw_labels_dir, "*.txt"))
    
    print(f"Found {len(image_files)} raw images and {len(label_files)} raw annotation files.")
    
    # Map image stem -> classes inside
    image_classes = defaultdict(list)
    for l_path in label_files:
        stem = os.path.splitext(os.path.basename(l_path))[0]
        with open(l_path, 'r') as f:
            for line in f:
                parts = line.strip().split()
                if parts:
                    image_classes[stem].append(int(parts[0]))
                    
    # Group images by class frequencies for stratification
    class_frequencies = defaultdict(int)
    for stem, classes in image_classes.items():
        for c in classes:
            class_frequencies[c] += 1
            
    # Assign each image primary category based on rarest class inside it
    img_primary_class = {}
    for stem, classes in image_classes.items():
        if not classes:
            img_primary_class[stem] = -1
        else:
            sorted_classes = sorted(classes, key=lambda x: class_frequencies[x])
            img_primary_class[stem] = sorted_classes[0]
            
    class_groups = defaultdict(list)
    for stem, prim_cls in img_primary_class.items():
        class_groups[prim_cls].append(stem)
        
    splits = {'train': [], 'val': [], 'test': []}
    for prim_cls, stems in class_groups.items():
        np.random.shuffle(stems)
        n = len(stems)
        n_train = int(n * train_ratio)
        n_val = int(n * val_ratio)
        
        splits['train'].extend(stems[:n_train])
        splits['val'].extend(stems[n_train:n_train + n_val])
        splits['test'].extend(stems[n_train + n_val:])
        
    # Copy files
    import shutil
    for split_name, stems in splits.items():
        split_img_dir = os.path.join(output_dir, "images", split_name)
        split_lbl_dir = os.path.join(output_dir, "labels", split_name)
        os.makedirs(split_img_dir, exist_ok=True)
        os.makedirs(split_lbl_dir, exist_ok=True)
        
        print(f"Copying {len(stems)} files to {split_name} split...")
        for stem in stems:
            src_lbl = os.path.join(raw_labels_dir, f"{stem}.txt")
            if os.path.exists(src_lbl):
                shutil.copy2(src_lbl, os.path.join(split_lbl_dir, f"{stem}.txt"))
                
            for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.PNG']:
                src_img = os.path.join(raw_images_dir, f"{stem}{ext}")
                if os.path.exists(src_img):
                    shutil.copy2(src_img, os.path.join(split_img_dir, f"{stem}{ext}"))
                    break

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python audit_dataset.py <data_yaml_path> [or --split <raw_dir> <output_dir>]")
    elif sys.argv[1] == "--split":
        if len(sys.argv) < 4:
            print("Usage: python audit_dataset.py --split <raw_dir> <output_dir>")
        else:
            stratify_and_split_dataset(sys.argv[2], sys.argv[3])
    else:
        audit_dataset(sys.argv[1])
