import os
import yaml
import glob

def merge_yolo_datasets(base_yaml_path, new_yaml_path, output_yaml_path, new_labels_dir=None):
    """
    Merges classes from new_yaml_path into base_yaml_path.
    Preserves original class indices of base_yaml_path.
    Appends new classes and optionally updates new label txt file class IDs.
    """
    print(f"Loading base dataset configurations from {base_yaml_path}...")
    with open(base_yaml_path, 'r') as f:
        base_data = yaml.safe_load(f)
        
    print(f"Loading new dataset configurations from {new_yaml_path}...")
    with open(new_yaml_path, 'r') as f:
        new_data = yaml.safe_load(f)
        
    base_names = base_data.get('names', {})
    new_names = new_data.get('names', {})
    
    # Standardize dictionary mapping (YOLO can have list of strings or dict of index->string)
    if isinstance(base_names, list):
        base_names = {i: name for i, name in enumerate(base_names)}
    if isinstance(new_names, list):
        new_names = {i: name for i, name in enumerate(new_names)}
        
    # Build inverted index mapping for base names
    base_inv = {name: idx for idx, name in base_names.items()}
    
    merged_names = base_names.copy()
    next_idx = max(base_names.keys()) + 1 if base_names else 0
    
    # Class ID mapping from new dataset ID -> merged dataset ID
    id_mapping = {}
    new_classes_added = 0
    
    for new_idx, name in new_names.items():
        if name in base_inv:
            # Class already exists, map new ID to the existing base ID
            id_mapping[new_idx] = base_inv[name]
        else:
            # New class, assign next available index
            merged_names[next_idx] = name
            id_mapping[new_idx] = next_idx
            base_inv[name] = next_idx
            next_idx += 1
            new_classes_added += 1
            
    print(f"Merged classes complete. Added {new_classes_added} new classes.")
    
    # Create output YAML config
    merged_data = base_data.copy()
    # Sort names by index for clean rendering
    merged_data['names'] = {int(k): v for k, v in sorted(merged_names.items())}
    # Update paths to merged data paths if specified, otherwise keep base
    merged_data['nc'] = len(merged_names)
    
    with open(output_yaml_path, 'w') as f:
        yaml.safe_dump(merged_data, f, default_flow_style=False)
    print(f"Saved merged dataset configuration to {output_yaml_path}\n")
    
    # If a path to the new labels directory is provided, rewrite class IDs
    if new_labels_dir and os.path.exists(new_labels_dir):
        print(f"Updating class IDs in labels directory: {new_labels_dir}...")
        label_files = glob.glob(os.path.join(new_labels_dir, "**", "*.txt"), recursive=True)
        updated_count = 0
        
        for filepath in label_files:
            if not os.path.isfile(filepath):
                continue
            
            with open(filepath, 'r') as f:
                lines = f.readlines()
                
            new_lines = []
            file_modified = False
            for line in lines:
                parts = line.strip().split()
                if not parts:
                    continue
                try:
                    old_class_id = int(parts[0])
                    if old_class_id in id_mapping:
                        new_class_id = id_mapping[old_class_id]
                        if old_class_id != new_class_id:
                            parts[0] = str(new_class_id)
                            file_modified = True
                    new_lines.append(" ".join(parts) + "\n")
                except ValueError:
                    # Keep unparseable lines as is
                    new_lines.append(line)
                    
            if file_modified:
                with open(filepath, 'w') as f:
                    f.writelines(new_lines)
                updated_count += 1
                
        print(f"Updated class mappings in {updated_count} annotation files.")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 4:
        print("Usage: python merge_datasets.py <base_yaml> <new_yaml> <output_yaml> [new_labels_directory]")
    else:
        labels_dir = sys.argv[4] if len(sys.argv) > 4 else None
        merge_yolo_datasets(sys.argv[1], sys.argv[2], sys.argv[3], labels_dir)
