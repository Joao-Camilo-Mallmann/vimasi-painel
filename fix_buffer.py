import re

with open('src/data/data_buffer_seals.csv', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = [lines[0]]
for line in lines[1:]:
    line = line.strip()
    if not line:
        continue
    
    parts = line.split(';')
    code = parts[0]
    
    # Check if dimensions are missing or misplaced
    match = re.search(r'(\d+,\d+|\d+)\s*[xX]\s*(\d+,\d+|\d+)\s*[xX]\s*(\d+,\d+|\d+)', code)
    if match and (len(parts) <= 3 or not parts[3] or parts[3].strip() == '' or "CJTO. PTFE" in code or "VTCJTO" in code):
        interno = match.group(1).replace(',', '.')
        externo = match.group(2).replace(',', '.')
        altura = match.group(3).replace(',', '.')
        
        # Clean the code string
        if "VTCJTO" in code:
            # extract CR...VT
            m_code = re.search(r'(CR[A-Z0-9-]+VT)', code)
            if m_code:
                code = m_code.group(1)
            else:
                code = code.split('CJTO')[0]
        elif "CJTO. PTFE ESP.C/BZE.E ORING" in code:
            # short version
            code = code.replace("CJTO. PTFE ESP.C/BZE.E ORING", "CJTO. PTFE")
            code = re.sub(r'\s+', ' ', code).strip()
            
        new_line = f"{code};BUFFER;{interno};{externo};{altura}"
        new_lines.append(new_line + "\n")
    else:
        if "CR090001000050C-VT" in code:
            new_lines.append("CR090001000050C-VT;BUFFER;90.0;100.0;4.2\n") # fixed previous mistake if any
        else:
            new_lines.append(line + "\n")

with open('src/data/data_buffer_seals.csv', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Fixed data_buffer_seals.csv again")
