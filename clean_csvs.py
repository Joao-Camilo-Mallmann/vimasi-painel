"""Clean CSV files by removing empty-dimension rows."""
import os

DATA_DIR = r"C:\Users\jcami\OneDrive\Documentos\Codes\vimasi-painel\src\data"

def get_dim_cols(header):
    """Get indices of dimension columns (not Codigo, not Tipo)."""
    skip = {"Codigo", "Tipo"}
    return [i for i, h in enumerate(header) if h not in skip]

def clean_file(filepath, extra_filter=None):
    """Remove rows with all-empty dims. Returns (orig, removed, codes_removed)."""
    with open(filepath, "r", encoding="utf-8-sig") as f:
        lines = f.readlines()
    
    # Parse header
    header_line = lines[0]
    header = header_line.strip().split(";")
    dim_cols = get_dim_cols(header)
    
    kept = [header_line]
    removed_codes = []
    
    for line in lines[1:]:
        stripped = line.strip()
        if not stripped:
            continue
        fields = stripped.split(";")
        code = fields[0] if fields else "?"
        
        # Check if all dimension columns are empty
        all_empty = all(
            (i >= len(fields) or not fields[i].strip())
            for i in dim_cols
        )
        
        # Check extra filter
        extra_remove = extra_filter and extra_filter(fields, header)
        
        if all_empty or extra_remove:
            removed_codes.append(code)
        else:
            kept.append(line)
    
    # Write back
    with open(filepath, "w", encoding="utf-8") as f:
        f.writelines(kept)
        # Ensure trailing newline
        if kept and not kept[-1].endswith("\n"):
            f.write("\n")
    
    orig_count = len(lines) - 1  # minus header, but including blank lines
    data_lines = sum(1 for l in lines[1:] if l.strip())
    return data_lines, len(removed_codes), removed_codes

def main():
    summary = []
    skip = {"data_backup.csv"}
    
    files = sorted(f for f in os.listdir(DATA_DIR)
                   if f.startswith("data_") and f.endswith(".csv") and f not in skip)
    
    for fname in files:
        filepath = os.path.join(DATA_DIR, fname)
        
        extra = None
        if fname == "data_gaxeta_chevron.csv":
            extra = lambda fields, header: fields[0].strip().endswith("-A")
        
        orig, removed, codes = clean_file(filepath, extra_filter=extra)
        summary.append((fname, orig, removed, codes))
        
        if removed > 0:
            print(f"  {fname}: {orig} -> {orig - removed} rows ({removed} removed)")
            if removed <= 20:
                print(f"    Codes: {', '.join(codes)}")
            else:
                print(f"    Codes (first 10): {', '.join(codes[:10])}... +{removed-10} more")
        else:
            print(f"  {fname}: {orig} rows (clean)")
    
    total = sum(s[2] for s in summary)
    print(f"\nTotal removed: {total}")
    
    # --- ANEL GUIA suspicious check ---
    print("\n--- ANEL GUIA SUSPICIOUS ROWS ---")
    guia_path = os.path.join(DATA_DIR, "data_anel_guia.csv")
    with open(guia_path, "r", encoding="utf-8-sig") as f:
        guia_lines = f.readlines()
    
    header = guia_lines[0].strip().split(";")
    suspicious = []
    for line in guia_lines[1:]:
        s = line.strip()
        if not s:
            continue
        fields = s.split(";")
        code = fields[0]
        ext = fields[2].strip() if len(fields) > 2 else ""
        int_ = fields[3].strip() if len(fields) > 3 else ""
        alt = fields[4].strip() if len(fields) > 4 else ""
        filled = sum(1 for v in [ext, int_, alt] if v)
        
        if filled == 1:
            val = ext or int_ or alt
            try:
                n = float(val)
                if n < 10:
                    suspicious.append(f"  {code}: Ext={ext} Int={int_} Alt={alt} (1 dim <10)")
            except ValueError:
                pass
        elif filled == 2 and not alt:
            try:
                ev = float(ext) if ext else 0
                iv = float(int_) if int_ else 0
                if ev < 10 and iv < 10:
                    suspicious.append(f"  {code}: Ext={ext} Int={int_} Alt={alt} (2 dims <10, no Alt)")
            except ValueError:
                pass
    
    print(f"Found {len(suspicious)} suspicious rows:")
    for s in suspicious[:30]:
        print(s)
    if len(suspicious) > 30:
        print(f"  ... +{len(suspicious)-30} more")

if __name__ == "__main__":
    main()
