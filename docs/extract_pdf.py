"""
Extract all product data from 'PRECO PECAS DIVERSAS.pdf' and generate 
per-category CSV files with properly parsed dimensions.
"""
import fitz
import re
import csv
import os

PDF_PATH = "PRECO PECAS DIVERSAS.pdf"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data")

# ----- Step 1: Extract raw text from PDF -----
doc = fitz.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), PDF_PATH))

all_text = ""
for page in doc:
    all_text += page.get_text() + "\n"

# ----- Step 2: Parse products grouped by category -----
# Each product block follows this pattern (repeating):
#   <Código>
#   <Descrição>
#   <Preço>
#   <IPI>
#   PC
#
# Categories are marked by:
#   <CATEGORY NAME>
#   Linha:

lines = all_text.split("\n")

# State machine
categories = {}
current_category = None
i = 0

while i < len(lines):
    line = lines[i].strip()
    
    # Detect category header: line followed by "Linha:"
    if i + 1 < len(lines) and lines[i + 1].strip() == "Linha:":
        # Skip header lines (they repeat on each page)
        if line not in ("Descrição", "Código", "UN", "Preço Unitário R$", "% IPI", ""):
            if not line.startswith("AGEL"):
                current_category = line
                if current_category not in categories:
                    categories[current_category] = []
                i += 2  # Skip "Linha:"
                continue
    
    # Skip known header/footer lines
    if line in ("Descrição", "Código", "UN", "Preço Unitário R$", "% IPI", "Linha:", "PC", ""):
        i += 1
        continue
    if line.startswith("AGEL "):
        i += 1
        continue
    if line.startswith("LISTA DE PREÇOS"):
        i += 1
        continue
    
    # Skip page numbers (just a number on its own, 1-3 digits)
    if re.match(r'^\d{1,3}$', line) and current_category:
        # Could be a page number OR a product code. 
        # If next line is a description (contains letters), it's a product code.
        if i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            if next_line and any(c.isalpha() for c in next_line) and not next_line.startswith("AGEL") and next_line not in ("PC", "Descrição", "Código", "UN", "Preço Unitário R$", "% IPI", "Linha:"):
                # It's a product code, continue parsing below
                pass
            else:
                i += 1
                continue
        else:
            i += 1
            continue
    
    # Try to parse a product entry: Code, Description, Price, IPI%, UN
    if current_category:
        # A product code is typically alphanumeric
        code = line
        
        # Next line should be description
        if i + 1 < len(lines):
            desc = lines[i + 1].strip()
            # Skip if desc looks like a header
            if desc in ("Descrição", "Código", "UN", "Preço Unitário R$", "% IPI", "", "Linha:", "PC") or desc.startswith("AGEL") or desc.startswith("LISTA DE"):
                i += 1
                continue
            
            # Next should be price
            if i + 2 < len(lines):
                price_str = lines[i + 2].strip()
                # Price format: "1.234,567" or "1,234"
                if re.match(r'^[\d.,]+$', price_str):
                    categories[current_category].append({
                        "Codigo": code,
                        "Descricao": desc,
                    })
                    i += 5  # Skip code, desc, price, ipi, "PC"
                    continue
        
    i += 1

# ----- Step 3: Parse dimensions from descriptions -----
def parse_dimensions(desc, category):
    """Extract numeric dimensions from a description string based on category."""
    # Common pattern: "NAME  D1 X D2 X D3" or "NAME D1 X D2 X D3 (V= D4 MM)"
    
    # Extract all numbers with decimals separated by X
    nums = re.findall(r'([\d]+[,.][\d]+)', desc)
    nums = [float(n.replace(',', '.')) for n in nums]
    
    # Also try integer dimensions
    if not nums:
        nums_raw = re.findall(r'X\s*(\d+)', desc)
        nums = [float(n) for n in nums_raw]
    
    # Extract V= value if present (Chevron gap)
    v_match = re.search(r'V\s*=\s*([\d,]+)', desc)
    v_val = float(v_match.group(1).replace(',', '.')) if v_match else None
    
    return nums, v_val


def get_csv_columns(category):
    """Return column names and description parsing logic for each category."""
    cat_upper = category.upper()
    
    if "CONJUNTO ZO" in cat_upper or "CONJUNTO ZW" in cat_upper:
        return ["Codigo", "Tipo", "Externo", "Interno", "AlturaBase", "AlturaTotal"]
    elif "CONJUNTO BP" in cat_upper:
        return ["Codigo", "Tipo", "Externo", "Interno", "AlturaBase", "AlturaTotal"]
    elif "CONJUNTO 753" in cat_upper:
        return ["Codigo", "Tipo", "Externo", "Interno", "AlturaBase", "AlturaTotal"]
    elif "CONJUNTO DE UHMW" in cat_upper:
        return ["Codigo", "Tipo", "Externo", "Interno", "AlturaBase", "AlturaTotal"]
    elif "ORING" in cat_upper:
        return ["Codigo", "Tipo", "Diametro", "Espessura"]
    elif "CHEVRON" in cat_upper:
        return ["Codigo", "Tipo", "Interno", "Externo", "Altura", "V"]
    elif "ANEL GT" in cat_upper:
        return ["Codigo", "Tipo", "Externo", "Interno", "Altura"]
    elif "ANEL GUIA" in cat_upper:
        return ["Codigo", "Tipo", "Externo", "Interno", "Altura"]
    elif "ANEL TEFLON" in cat_upper:
        return ["Codigo", "Tipo", "Externo", "Interno", "Altura"]
    elif "ANEL UNIT" in cat_upper:
        return ["Codigo", "Tipo", "Externo", "Interno", "Altura"]
    elif "ANÉIS QUAD" in cat_upper or "ANEIS QUAD" in cat_upper:
        return ["Codigo", "Tipo", "Interno", "Externo", "Altura"]
    elif "BACKUP" in cat_upper:
        return ["Codigo", "Tipo", "Interno", "Externo", "Altura"]
    elif "BUFFER" in cat_upper:
        return ["Codigo", "Tipo", "Interno", "Externo", "Altura"]
    elif "CAPPED" in cat_upper:
        return ["Codigo", "Tipo", "Interno", "Externo", "Altura"]
    elif "DUAL RING" in cat_upper:
        return ["Codigo", "Tipo", "Interno", "Externo", "Altura"]
    elif "FITA GUIA" in cat_upper:
        return ["Codigo", "Tipo", "Largura", "Espessura", "Comprimento"]
    elif "V-RING" in cat_upper:
        return ["Codigo", "Tipo", "Interno", "Externo", "Altura"]
    elif "ARRUELAS" in cat_upper or "ARR." in cat_upper:
        return ["Codigo", "Tipo", "Interno", "Externo", "Altura"]
    else:
        return ["Codigo", "Tipo", "Dim1", "Dim2", "Dim3"]


def category_to_tipo(category):
    """Convert category name to a short Tipo code."""
    cat_upper = category.upper()
    mapping = {
        "CONJUNTO ZO": "ZO",
        "CONJUNTO ZW": "ZW",
        "CONJUNTO BP": "BP",
        "CONJUNTO 753": "753",
        "CONJUNTO DE UHMW": "UHMW",
        "ANEL GT": "GT",
        "ANEL GUIA": "GUIA",
        "ANEL TEFLON": "TEFLON",
        "ANEL UNITÁRIO": "ANEL_UNIT",
        "ANÉIS QUAD E ARRUELA BORRACHA": "QUAD",
        "ARR. DE PU MODELO OV": "OV",
        "ARRUELAS STD. PU": "ARR_PU",
        "BACKUP": "BACKUP",
        "BUFFER SEALS": "BUFFER",
        "CAPPEDT-SEAL": "CAPPED",
        "DUAL RING": "DUAL",
        "FITA GUIA PTFE": "FITA",
        "GAXETA CHEVRON": "CHEVRON",
        "ORING DE PU": "ORING",
        "V-RING  (GUARDA PO)": "VRING",
        "V-RING  (GUARDA PÓ)": "VRING",
    }
    for key, val in mapping.items():
        if key in cat_upper or cat_upper in key:
            return val
    return category[:6].upper()


def parse_product_dims(product, category):
    """Parse dimensions from the product description for the given category."""
    desc = product["Descricao"]
    tipo = category_to_tipo(category)
    cols = get_csv_columns(category)
    
    nums, v_val = parse_dimensions(desc, category)
    
    row = {"Codigo": product["Codigo"], "Tipo": tipo}
    
    # Fill dimension columns based on number of extracted values
    dim_cols = [c for c in cols if c not in ("Codigo", "Tipo")]
    
    for j, col in enumerate(dim_cols):
        if col == "V" and v_val is not None:
            row[col] = v_val
        elif j < len(nums):
            row[col] = nums[j]
        else:
            row[col] = ""
    
    return row, cols


def category_to_filename(category):
    """Convert category name to a safe filename."""
    safe = category.lower()
    safe = re.sub(r'[^a-z0-9]+', '_', safe)
    safe = safe.strip('_')
    return f"data_{safe}.csv"


# ----- Step 4: Write CSVs -----
os.makedirs(OUTPUT_DIR, exist_ok=True)

summary = []
for category, products in sorted(categories.items()):
    if not products:
        continue
    
    filename = category_to_filename(category)
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    # Parse all products
    rows = []
    cols = None
    for product in products:
        row, col_names = parse_product_dims(product, category)
        if cols is None:
            cols = col_names
        rows.append(row)
    
    # Write CSV
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=cols, delimiter=';', extrasaction='ignore')
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    
    tipo = category_to_tipo(category)
    summary.append(f"  {tipo:10s} | {len(rows):4d} peças | {filename}")
    print(f"OK: {category} -> {filename} ({len(rows)} items)")

print(f"\n{'='*60}")
print(f"Total: {len(summary)} categorias exportadas")
for s in summary:
    print(s)
