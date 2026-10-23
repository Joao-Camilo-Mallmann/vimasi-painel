"""Ingestão dos catálogos APC (gaxetas/raspadores 2022 + retentores 2021)
e cruzamento com as listas AGEL 2025.

Uso (rodar da raiz do projeto):
    python -I scripts/ingest_catalogos.py

Saídas:
    src/data/catalogo_apc.csv       dataset facetado (mm, 4 casas)
    docs/catalogos/divergencias.md  relatório de divergências / cruzamentos

Regras:
- Fonte da verdade para peças em polegada = código da REFERÊNCIA (pol × 25,4, exato,
  milésimos arredondados para 1/64").
- Das listas só código e descrição são cruzados (UN e % IPI são descartados).
- Mesmo código nos dois catálogos: o de gaxetas prevalece.
"""

import argparse
import csv
import io
import re
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
CATALOGO_PDF = ROOT / "docs/catalogos/gaxetas-raspadores/catalogo-gaxetas-raspadores-2022.pdf"
RETENTORES_PDF = ROOT / "docs/catalogos/retentores/catalogo-retentores-2021.pdf"
LISTAS_PDF = [
    ROOT / "docs/catalogos/listas/lista-gaxetas-raspadores-2025.pdf",
    ROOT / "docs/catalogos/listas/lista-retentores-2025.pdf",
]
OUT_CSV = ROOT / "src/data/catalogo_apc.csv"
OUT_REPORT = ROOT / "docs/catalogos/divergencias.md"
LEGACY_DIR = ROOT / "src/data"

TOL_DIVERGENCIA = 0.05  # mm

# ---------------------------------------------------------------------------
# Manifesto (transcrito do índice do catálogo 2022, páginas PDF 12-16;
# página impressa = página PDF - 16)
# ficha = (pressao_psi | None, temp_min, temp_max, velocidade_m_s)
# ---------------------------------------------------------------------------
PU_HID = (-30, 100)
PM_TEMP = (-45, 135)

HASTE, EMBOLO, AMORTECIMENTO = "haste", "embolo", "amortecimento"
EIXO = "eixo"  # retentores (eixo rotativo)

CAT_GAXETAS, CAT_RETENTORES, CAT_LISTA = "gaxetas-2022", "retentores-2021", "lista-2025"

# (linha, modelo) -> aplicações
# O índice agrupa por haste/êmbolo, mas os desenhos de montagem mandam:
# B, AG 2 e AG 7 aparecem instalados na haste E no êmbolo (págs. 17, 24, 27, 37-44).
APLICACOES = {
    # gaxetas hidráulicas — haste e êmbolo (dois desenhos na página)
    **{("gaxeta", m): [HASTE, EMBOLO] for m in ["B", "AG 2", "AG 7"]},
    # gaxetas hidráulicas — haste
    **{("gaxeta", m): [HASTE] for m in [
        "AG 1", "AG 4 (BS)", "AG 5", "AG 11", "AG 12", "AG 13",
        "AG 14", "AG 16", "AG 17", "AG 19", "AG 20", "AG 21", "AG 22", "AG 23"]},
    # gaxetas hidráulicas — êmbolo
    **{("gaxeta", m): [EMBOLO] for m in [
        "AG 3", "AG 6", "AG 8", "AG 10", "AG 15", "AG 18", "AG 24", "STD"]},
    # raspadores trabalham sempre na haste
    **{("raspador", m): [HASTE] for m in [
        "D", "6D/66D", "900D", "K", "RP-25", "DG", "E", "GA", "GAE", "GAG",
        "AGK1", "GA1", "AGK2", "RP-27", "RP-28"]},
    # linha pneumática — aplicação pelo desenho de cada página (62-65)
    ("pneumatica", "AG 3"): [EMBOLO],         # série Mini ISO
    ("pneumatica", "AG 6"): [EMBOLO],         # série CWU
    ("pneumatica", "AG 7"): [HASTE, EMBOLO],
    ("pneumatica", "AG 24"): [EMBOLO],
    ("pneumatica", "AG 25"): [HASTE],         # guarnição composta (vedação + raspador na haste)
    ("pneumatica", "KDG"): [HASTE],           # raspador série Mini ISO (EL-xxxx)
    ("pneumatica", "RP-08"): [AMORTECIMENTO], # guarnição de amortecimento
    ("pneumatica", "RP-25"): [HASTE],         # raspador série compacta
    ("pneumatica", "Z"): [EMBOLO],            # guarnição de borracha de êmbolo
}

# Material quando a tabela não tem coluna MATERIAL nem é Polymax.
# Raspadores de lábio (D…E) têm a mesma faixa -30/+100 °C das gaxetas PU.
MATERIAL_PADRAO = {
    **{("gaxeta", m): "PU" for (li, m) in APLICACOES if li == "gaxeta"},
    **{("raspador", m): "PU" for m in ["D", "6D/66D", "900D", "K", "RP-25", "DG", "E"]},
    ("pneumatica", "Z"): "Borracha",  # pág. 65: "GUARNIÇÃO DE BORRACHA - TIPO Z"
}

# (linha, modelo, polymax) -> ficha
FICHA = {
    # gaxetas haste PU
    ("gaxeta", "B", False): (4000, *PU_HID, 0.5),
    ("gaxeta", "AG 1", False): (6000, *PU_HID, 1),
    ("gaxeta", "AG 2", False): (6000, *PU_HID, 0.5),
    ("gaxeta", "AG 4 (BS)", False): (6000, *PU_HID, 0.5),
    ("gaxeta", "AG 5", False): (6000, *PU_HID, 0.5),
    ("gaxeta", "AG 7", False): (4000, *PU_HID, 0.5),
    ("gaxeta", "AG 11", False): (7000, *PU_HID, 0.5),
    ("gaxeta", "AG 12", False): (7000, *PU_HID, 0.5),
    ("gaxeta", "AG 13", False): (7000, *PU_HID, 0.5),
    ("gaxeta", "AG 14", False): (7000, *PU_HID, 0.5),
    ("gaxeta", "AG 16", False): (6000, *PU_HID, 1),
    ("gaxeta", "AG 17", False): (7000, *PU_HID, 1),
    ("gaxeta", "AG 19", False): (6000, *PU_HID, 0.5),
    ("gaxeta", "AG 20", False): (7000, *PU_HID, 1),
    ("gaxeta", "AG 21", False): (3000, *PU_HID, 1),
    ("gaxeta", "AG 22", False): (7000, *PU_HID, 1),
    # gaxetas êmbolo PU
    ("gaxeta", "AG 3", False): (5000, *PU_HID, 0.5),
    ("gaxeta", "AG 6", False): (5000, *PU_HID, 0.5),
    ("gaxeta", "AG 8", False): (7000, *PU_HID, 1),
    ("gaxeta", "AG 10", False): (7000, *PU_HID, 1),
    ("gaxeta", "AG 15", False): (7000, *PU_HID, 1),
    ("gaxeta", "AG 18", False): (7000, *PU_HID, 1),
    ("gaxeta", "AG 24", False): (5000, *PU_HID, 0.5),
    ("gaxeta", "STD", False): (5000, *PU_HID, 0.5),
    # gaxetas Polymax
    ("gaxeta", "B", True): (8000, *PM_TEMP, 0.5),
    ("gaxeta", "AG 1", True): (6000, *PM_TEMP, 1),
    ("gaxeta", "AG 2", True): (6000, *PM_TEMP, 0.5),
    ("gaxeta", "AG 4 (BS)", True): (7000, *PM_TEMP, 0.5),
    ("gaxeta", "AG 5", True): (6000, *PM_TEMP, 0.5),
    ("gaxeta", "AG 7", True): (4000, *PM_TEMP, 0.5),
    ("gaxeta", "AG 13", True): (7000, *PM_TEMP, 0.5),
    ("gaxeta", "AG 14", True): (7000, *PM_TEMP, 0.5),
    ("gaxeta", "AG 16", True): (6000, *PM_TEMP, 1),
    ("gaxeta", "AG 23", True): (7000, *PM_TEMP, 1),
    ("gaxeta", "STD", True): (7000, *PM_TEMP, 0.5),
    # raspadores
    **{("raspador", m, False): (None, *PU_HID, 4) for m in ["D", "6D/66D", "900D", "K", "RP-25", "DG", "E"]},
    **{("raspador", m, False): (None, *PU_HID, 1) for m in ["GA", "GAE", "GAG", "AGK1", "GA1", "AGK2"]},
    ("raspador", "D", True): (None, *PM_TEMP, 4),
    ("raspador", "RP-25", True): (None, *PU_HID, 4),
    ("raspador", "RP-27", True): (None, *PU_HID, 4),
    ("raspador", "RP-28", True): (None, *PU_HID, 4),
    # pneumática
    ("pneumatica", "AG 3", False): (8000, *PM_TEMP, 0.5),
    ("pneumatica", "AG 6", False): (6000, *PM_TEMP, 1),
    ("pneumatica", "AG 7", False): (6000, *PM_TEMP, 0.5),
    ("pneumatica", "AG 24", False): (7000, *PM_TEMP, 0.5),
    ("pneumatica", "AG 25", False): (6000, *PM_TEMP, 0.5),
    ("pneumatica", "KDG", False): (4000, *PM_TEMP, 0.5),
    ("pneumatica", "RP-08", False): (7000, *PM_TEMP, 0.5),
    ("pneumatica", "RP-25", False): (7000, *PM_TEMP, 0.5),
    ("pneumatica", "Z", False): (7000, *PM_TEMP, 0.5),
}

TIPO_POR_LINHA = {"gaxeta": "Gaxeta", "raspador": "Raspador", "pneumatica": "Gaxeta"}
LINHA_LABEL = {"gaxeta": "Hidráulica", "raspador": "Hidráulica", "pneumatica": "Pneumática"}


def linha_da_pagina(pagina):
    if pagina <= 46:
        return "gaxeta"
    if pagina <= 61:
        return "raspador"
    return "pneumatica"


def tipo_do_modelo(linha, modelo):
    # Na linha pneumática há raspadores (RP-25, KDG) e guarnições
    if linha == "pneumatica" and modelo in ("RP-25", "KDG"):
        return "Raspador"
    return TIPO_POR_LINHA[linha]


# Padrão de código esperado por modelo
CODE_PATTERN = {"STD": "std8", "B": "b11", "AG 4 (BS)": "b11", "D": "d4"}

DATA_PAGES = list(range(17, 66))  # tolerâncias de usinagem ficam nas págs. 9-10
REPARO_PAGES = [66, 67]
POLYMAX_PAGES = set(range(37, 47)) | {60, 61}

# ---------------------------------------------------------------------------
# Conversões
# ---------------------------------------------------------------------------
MM_POR_POL = Fraction(254, 10)


def snap64(pol):
    """Arredonda polegadas para o 1/64 mais próximo (Fraction)."""
    return Fraction(round(Fraction(pol) * 64), 64)


def milesimos_para_mm(txt):
    """Milésimos de polegada -> mm. Códigos truncados (187 = 3/16) são arredondados para 1/64";
    valores que não estão perto de uma fração (ex.: 788 = 20 mm) são convertidos direto."""
    pol = Fraction(int(txt), 1000)
    alvo = snap64(pol)
    if abs(pol - alvo) * 64 <= Fraction(2, 10):
        pol = alvo
    return float(pol * MM_POR_POL)


FRAC_RE = re.compile(r"^(?:(\d+)[\s.](\d+)/(\d+)|(\d+)/(\d+)|(\d+))$")


def parse_pol(txt):
    """'1 13/16', '1.1/2', '3/16', '2' -> mm (float) ou None."""
    t = txt.strip().replace('"', "")
    m = FRAC_RE.match(t)
    if not m:
        return None
    if m.group(1):
        v = Fraction(int(m.group(1))) + Fraction(int(m.group(2)), int(m.group(3)))
    elif m.group(4):
        v = Fraction(int(m.group(4)), int(m.group(5)))
    else:
        v = Fraction(int(m.group(6)))
    return float(v * MM_POR_POL)


def parse_mm(txt):
    t = txt.strip().replace(" ", "")
    if not re.match(r"^\d+([.,]\d+)?$", t):
        return None
    return float(t.replace(",", "."))


def parse_valor(txt, unidade):
    """Valor impresso: vírgula/ponto decimal = mm; fração/inteiro em tabela pol = pol."""
    t = txt.strip()
    if not t or t in {"---", "—", "-"}:
        return None
    if "," in t:
        return parse_mm(t)
    if "/" in t:
        return parse_pol(t)
    if unidade == "pol":
        return parse_pol(t)
    return parse_mm(t)


def decode_ref(ref, pattern):
    """Retorna dict com Interno/Externo/Altura (mm) decodificados do código, ou None."""
    if not ref or not pattern:
        return None
    r = re.sub(r"(BS)?(PM)?$", "", ref.replace(" ", ""))
    if pattern == "std8":
        m = re.fullmatch(r"(\d{3})(\d{5})", r)
        if m:
            s, i = milesimos_para_mm(m.group(1)), milesimos_para_mm(m.group(2))
            return {"Interno": i, "Externo": i + 2 * s, "Altura": s}
    elif pattern == "b11":
        m = re.fullmatch(r"(\d{3})(\d{5})(\d{3})", r)
        if m:
            s, i, h = (milesimos_para_mm(g) for g in m.groups())
            return {"Interno": i, "Externo": i + 2 * s, "Altura": h}
    elif pattern == "d4":
        m = re.fullmatch(r"D-(\d{4})", r)
        if m:
            return {"Interno": milesimos_para_mm(m.group(1))}
    return None


# ---------------------------------------------------------------------------
# Extração por coordenadas
# ---------------------------------------------------------------------------
def agrupar_linhas(words, tol=2.5):
    linhas = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        for ln in linhas:
            if abs(ln["top"] - w["top"]) <= tol:
                ln["words"].append(w)
                break
        else:
            linhas.append({"top": w["top"], "words": [w]})
    for ln in linhas:
        ln["words"].sort(key=lambda w: w["x0"])
        ln["text"] = " ".join(w["text"] for w in ln["words"])
    return sorted(linhas, key=lambda l: l["top"])


def normalizar_modelo(titulo):
    t = titulo.upper().strip()
    t = re.sub(r"^TIPO\s+", "", t)
    if re.match(r"^AG\s*-?\s*\d", t):
        resto = re.sub(r"^AG\s*-?\s*", "", t)
        return "AG " + resto.strip()
    return t.replace(" ", "")


HEADER_COLS = [
    ("agel", lambda s: s == "AGEL"),
    ("ref", lambda s: s.startswith("REFER")),
    ("material", lambda s: s == "MATERIAL"),
    ("int", lambda s: s.endswith("INT.")),  # "INT." ou "ØINT."
    ("ext", lambda s: s.endswith("EXT.")),
    ("h", lambda s: s in {"H", "h"}),
    ("d1", lambda s: s.endswith("D1")),
    ("l1", lambda s: s == "L1"),
    ("l2", lambda s: s == "L2"),
    ("r", lambda s: s == "R"),
    ("f", lambda s: s == "f"),
    ("g", lambda s: s == "G"),
]


def colunas_do_header(ln, x_min, x_max):
    cols = []
    for w in ln["words"]:
        if not (x_min <= w["x0"] < x_max):
            continue
        for nome, test in HEADER_COLS:
            if test(w["text"]):
                cols.append((nome, (w["x0"] + w["x1"]) / 2))
                break
    cols.sort(key=lambda c: c[1])
    return cols


def atribuir(words, cols):
    """Atribui palavras à coluna cujo centro está mais próximo."""
    out = {}
    for w in words:
        cx = (w["x0"] + w["x1"]) / 2
        nome = min(cols, key=lambda c: abs(c[1] - cx))[0]
        out.setdefault(nome, []).append(w["text"])
    return out


def juntar_agel(partes):
    return "".join(partes) if partes else ""


def juntar_ref(partes):
    s = " ".join(partes)
    s = re.sub(r"\s+(PM|BS)$", r"\1", s)
    return s.strip()


def extrair_catalogo(pdf_path, problemas):
    rows = []
    with pdfplumber.open(pdf_path) as pdf:
        for pagina in DATA_PAGES:
            page = pdf.pages[pagina - 1]
            words = page.extract_words(extra_attrs=["size"])
            linhas = agrupar_linhas(words)
            meio = page.width / 2
            titulos = [l for l in linhas if any(w["size"] >= 18 for w in l["words"]) and l["top"] < 780]
            subtitulos = [l for l in linhas if any(11.5 <= w["size"] < 18 for w in l["words"])]
            medidas = [l for l in linhas if l["words"][0]["text"] == "Medidas"]
            headers = [l for l in linhas if any(w["text"] == "AGEL" for w in l["words"])]
            fronteiras = sorted({l["top"] for l in titulos + medidas + headers} | {790.0})

            linha_cat = linha_da_pagina(pagina)
            for hdr in headers:
                # Pode haver títulos empilhados (ex.: pág. 64: AG 25 em cima, KDG embaixo)
                tit = max((t for t in titulos if t["top"] < hdr["top"]), key=lambda t: t["top"], default=None)
                if tit is None:
                    problemas["nao_extraidas"].append((pagina, "cabeçalho sem título", hdr["text"]))
                    continue
                modelo = normalizar_modelo(" ".join(w["text"] for w in tit["words"] if w["size"] >= 18))
                subs = " ".join(l["text"] for l in subtitulos if tit["top"] < l["top"] < hdr["top"]).upper()
                polymax_regiao = "POLYMAX" in subs or pagina in POLYMAX_PAGES
                med = max((m for m in medidas if m["top"] < hdr["top"]), key=lambda m: m["top"], default=None)
                unidade_tab = "pol" if med and "Polegadas" in med["text"] and "Milim" not in med["text"] else "mm"
                if med and "Polegadas/Milim" in med["text"]:
                    unidade_tab = "misto"
                fim = min(f for f in fronteiras if f > hdr["top"] + 1)
                # o cabeçalho pode quebrar em duas linhas (ex.: "H" um pouco abaixo)
                hdr_words = [w for w in words if hdr["top"] - 3 <= w["top"] <= hdr["top"] + 12 and w["size"] < 9]
                hdr_full = {"words": sorted(hdr_words, key=lambda w: w["x0"])}
                corpo_ini = max(w["bottom"] for w in hdr_words)

                n_agel = sum(1 for w in hdr_full["words"] if w["text"] == "AGEL")
                halves = [(0, meio), (meio, page.width)] if n_agel > 1 else [(0, page.width)]
                for x_min, x_max in halves:
                    cols = colunas_do_header(hdr_full, x_min, x_max)
                    if not any(c[0] == "agel" for c in cols):
                        continue
                    corpo = [w for w in words if corpo_ini < w["top"] < fim - 1 and x_min <= w["x0"] < x_max]
                    for ln in agrupar_linhas(corpo):
                        cel = atribuir(ln["words"], cols)
                        agel = juntar_agel(cel.get("agel", []))
                        ref = juntar_ref(cel.get("ref", []))
                        if ref in {"---", "—"}:
                            ref = ""
                        if (not agel and not ref) or not re.search(r"\d", ln["text"]):
                            continue  # linha vazia ou rótulo de desenho ("H")
                        if not re.match(r"^[A-Z]{0,3}\d", agel or ref):
                            problemas["nao_extraidas"].append((pagina, modelo, ln["text"]))
                            continue
                        unidade = "pol" if unidade_tab == "misto" else unidade_tab  # misto: vírgula = mm, resto = pol
                        impresso = {
                            "Interno": parse_valor(" ".join(cel.get("int", [])), unidade),
                            "Externo": parse_valor(" ".join(cel.get("ext", [])), unidade),
                            "Altura": parse_valor(" ".join(cel.get("h", [])), unidade),
                        }
                        extras = {k: " ".join(cel[k]) for k in ("d1", "l1", "l2", "r", "f", "g") if k in cel}
                        material_linha = " ".join(cel.get("material", [])).upper()
                        polymax = polymax_regiao or agel.endswith("PM") or ref.endswith("PM")
                        rows.append({
                            "pagina": pagina, "linha": linha_cat, "modelo": modelo, "polymax": polymax,
                            "agel": agel, "ref": ref, "impresso": impresso, "extras": extras,
                            "material_linha": material_linha, "raw": ln["text"],
                            "unidade": "pol" if unidade_tab == "pol" or (unidade_tab == "misto" and "," not in ln["text"]) else "mm",
                        })
        rows += extrair_reparos(pdf, problemas)
    return rows


def extrair_reparos(pdf, problemas):
    rows = []
    for pagina in REPARO_PAGES:
        page = pdf.pages[pagina - 1]
        linhas = agrupar_linhas(page.extract_words())
        for ln in linhas:
            ws = ln["words"]
            if not ws or ws[0]["x0"] > 60 or not re.match(r"^[A-Z0-9]+-[A-Z0-9]+", ws[0]["text"]):
                continue
            codigo = ws[0]["text"]
            desc = " ".join(w["text"] for w in ws[1:] if w["x0"] < 450)
            nums = [w["text"] for w in ws if w["x0"] >= 450]
            dims = [parse_mm(n) for n in nums]
            impresso = {"Interno": None, "Externo": None, "Altura": None}
            if len(dims) == 3:
                impresso = dict(zip(["Interno", "Externo", "Altura"], dims))
            rows.append({
                "pagina": pagina, "linha": "reparo", "modelo": "Kit de reparo" if "REPARO" in desc else "Componente",
                "polymax": False, "agel": codigo, "ref": "", "impresso": impresso, "extras": {},
                "material_linha": "", "raw": ln["text"], "unidade": "mm", "descricao": desc,
            })
    return rows


# ---------------------------------------------------------------------------
# Catálogo de retentores (ref. 2021)
# Págs. 10-76: uma seção por perfil (título 22 pt + descrição 10 pt + tabela).
# Págs. 84-111: índice "REFERÊNCIA AGEL" com todos os códigos (fonte primária).
# ---------------------------------------------------------------------------
RET_PERFIL_PAGES = range(10, 77)
RET_INDICE_PAGES = range(84, 112)

RET_HEADER_COLS = [
    ("codigo", lambda s: s == "CÓDIGO"),
    ("ref", lambda s: s == "REF"),
    ("mod", lambda s: s == "MOD."),
    ("int", lambda s: s.startswith("INT")),
    ("ext", lambda s: s.startswith("EXT")),
    ("h", lambda s: s in {"H", "H1"}),
    ("mat", lambda s: s == "MAT"),
    ("ori", lambda s: s == "ORI"),
]

# Legenda da pág. 6
ORIENTACAO = {"LI": "Liso", "H": "Horário", "AH": "Anti-horário", "BI": "Bidirecional"}


def colunas_retentor(hdr, x_min, x_max):
    ws = [w for w in hdr if x_min <= w["x0"] < x_max]
    cols = []
    for i, w in enumerate(ws):
        for nome, test in RET_HEADER_COLS:
            if test(w["text"]):
                x1 = w["x1"]
                if w["text"] == "H1":  # "H1 / H2": centro do grupo
                    x1 = next((v["x1"] for v in ws[i:] if v["text"] == "H2"), x1)
                cols.append((nome, (w["x0"] + x1) / 2))
                break
    return sorted(cols, key=lambda c: c[1])


def parse_h(txt):
    """'9,50' -> (None, 9.5); '5,0/7,0' -> (5.0, 7.0)."""
    t = txt.replace(" ", "")
    if "/" in t:
        a, b = t.split("/", 1)
        return parse_mm(a), parse_mm(b)
    return None, parse_mm(t)


def tabela_retentor(words, hdr_top, fim, meio, pagina, perfil, problemas):
    """Linhas da tabela cujo cabeçalho ("CÓDIGO …") está em hdr_top, nas duas metades da página."""
    hdr = sorted((w for w in words if abs(w["top"] - hdr_top) <= 3), key=lambda w: w["x0"])
    corpo_ini = max(w["bottom"] for w in hdr)
    out = []
    for x_min, x_max in ((0, meio), (meio, float("inf"))):
        cols = colunas_retentor(hdr, x_min, x_max)
        if not any(c[0] == "codigo" for c in cols):
            continue
        corpo = [w for w in words if corpo_ini < w["top"] < fim and x_min <= w["x0"] < x_max and w["size"] < 9]
        for ln in agrupar_linhas(corpo):
            cel = {k: " ".join(v).strip() for k, v in atribuir(ln["words"], cols).items()}
            codigo = cel.get("codigo", "").replace(" ", "")
            if not codigo or not re.search(r"\d", ln["text"]):
                continue
            h1, h2 = parse_h(cel.get("h", ""))
            ext_txt = cel.get("ext", "")
            r = {
                "codigo": codigo, "ref": "" if cel.get("ref", "---") in {"---", "—"} else cel.get("ref", ""),
                "mod": cel.get("mod") or perfil, "int": parse_mm(cel.get("int", "")),
                # ØEXT escalonado ("110,0/154,0"): vale o primeiro (alojamento); o texto vai para Extras
                "ext": parse_mm(ext_txt.split("/")[0]), "ext_txt": ext_txt if "/" in ext_txt else "",
                "h1": h1, "h2": h2, "h_txt": cel.get("h", ""),
                "mat": cel.get("mat", ""), "ori": cel.get("ori", ""), "pagina": pagina, "raw": ln["text"],
            }
            if not re.match(r"^[A-Z]{0,3}\d", codigo) or None in (r["int"], r["ext"], r["h2"]) or not r["mod"]:
                problemas["nao_extraidas"].append((f"R{pagina}", perfil or "índice", ln["text"]))
                continue
            out.append(r)
    return out


def extrair_retentores(pdf_path, problemas):
    """Retorna (perfis, linhas das páginas de perfil, linhas do índice)."""
    perfis, pag_rows, indice = {}, [], []
    with pdfplumber.open(pdf_path) as pdf:
        for pagina in [*RET_PERFIL_PAGES, *RET_INDICE_PAGES]:
            page = pdf.pages[pagina - 1]
            words = page.extract_words(extra_attrs=["size"])
            meio = page.width / 2
            rodape = min((w["top"] for w in words if w["text"] in ("LEGENDA", "VIDE")), default=page.height)
            headers = sorted({w["top"] for w in words if w["text"] == "CÓDIGO"})
            if pagina in RET_INDICE_PAGES:
                for t in headers:
                    indice += tabela_retentor(words, t, rodape, meio, pagina, None, problemas)
                continue
            titulos = sorted((w for w in words if w["size"] >= 20), key=lambda w: w["top"])
            for i, tit in enumerate(titulos):
                prox = titulos[i + 1]["top"] if i + 1 < len(titulos) else rodape
                perfil = tit["text"]
                desc = []
                for ln in agrupar_linhas([w for w in words if 9 <= w["size"] < 12 and tit["top"] < w["top"] < prox]):
                    if ln["text"].startswith("MEDIDAS"):
                        break
                    desc.append(ln["text"])
                perfis.setdefault(perfil, {"descricao": " ".join(desc), "pagina": pagina})
                for t in (h for h in headers if tit["top"] < h < prox):
                    pag_rows += tabela_retentor(words, t, prox, meio, pagina, perfil, problemas)
    return perfis, pag_rows, indice


def perfil_base(perfil, perfis):
    """Perfil com página própria a que a variante pertence, ou None.
    Variantes: número (AGGK1, BRXE3, GGGX-1) e material (F = FPM, S = MVQ, P = PTFE: BRGF, BAS, GRP)."""
    if perfil in perfis:
        return perfil
    base = re.sub(r"-?\d+$", "", perfil)
    while base not in perfis and len(base) > 1 and base[-1] in "FSP":
        base = base[:-1]
    return base if base in perfis else None


def tipo_retentor(perfil, perfis):
    """Tipo pela descrição da página do perfil-base. Retorna (tipo, base)."""
    base = perfil_base(perfil, perfis)
    if base:
        return ("Raspador" if perfis[base]["descricao"].startswith("RASPADOR") else "Retentor"), base
    # sem página: GA/GR… são raspadores; o resto, retentor
    return ("Raspador" if re.match(r"^G[AR]", perfil) else "Retentor"), None


def linha_csv_retentor(r, tipo, modelo):
    extras = {}
    if modelo != r["mod"]:
        extras["Variante"] = r["mod"]
    if r["ext_txt"]:
        extras["ØEXT"] = r["ext_txt"]
    if r["h1"] is not None:
        extras["H1/H2"] = r["h_txt"]
    if r["ori"]:
        extras["Orientação do lábio"] = ORIENTACAO.get(r["ori"], r["ori"])
    raspador = tipo == "Raspador"
    return {
        "Codigo": r["codigo"], "Referencia": r["ref"], "Tipo": tipo, "Modelo": modelo, "Material": r["mat"],
        "Aplicacao": HASTE if raspador else EIXO, "Linha": "Hidráulica" if raspador else "Retentores",
        "Interno": r4(r["int"]), "Externo": r4(r["ext"]), "Altura": r4(r["h2"]), "UnidadeNominal": "mm",
        "PressaoPsi": "", "TempMin": "", "TempMax": "", "VelocidadeMs": "",
        "Extras": "|".join(f"{k}={v}" for k, v in extras.items()), "Descricao": "", "NaLista": "",
        "Fonte": "pdf", "Catalogo": CAT_RETENTORES, "Pagina": r["pagina"],
    }


def montar_retentores(perfis, pag_rows, indice, problemas):
    """Índice = fonte primária; páginas de perfil conferem o índice e completam o que faltar."""
    por_pag = {}
    for r in pag_rows:
        por_pag.setdefault(r["codigo"], []).append(r)
    no_indice = {r["codigo"] for r in indice}
    so_pagina = [r for r in pag_rows if r["codigo"] not in no_indice]
    problemas["ret_so_pagina"] = [(r["pagina"], r["mod"], r["codigo"]) for r in so_pagina]
    problemas["ret_so_indice"] = [(r["pagina"], r["mod"], r["codigo"]) for r in indice if r["codigo"] not in por_pag]

    saida = []
    for r in indice + so_pagina:
        paginas = por_pag.get(r["codigo"], [])
        for p in paginas:
            if p is r:
                continue
            for campo in ("int", "ext", "h1", "h2"):
                a, b = r[campo], p[campo]
                if (a is None) != (b is None) or (a is not None and abs(a - b) > TOL_DIVERGENCIA):
                    problemas["ret_indice_vs_pagina"].append((r["codigo"], campo, r[campo], p[campo], r["pagina"], p["pagina"]))
            for campo in ("mat", "ori"):
                if r[campo] != p[campo]:
                    problemas["ret_indice_vs_pagina"].append((r["codigo"], campo, r[campo], p[campo], r["pagina"], p["pagina"]))
            # BRGF no índice e na página do BRG é esperado (variante de material)
            if p["mod"] != r["mod"] and perfil_base(r["mod"], perfis) != p["mod"]:
                problemas["ret_indice_vs_pagina"].append((r["codigo"], "mod", r["mod"], p["mod"], r["pagina"], p["pagina"]))
        # Perfil = o da página onde o código aparece (o catálogo agrupa as variantes no perfil-base)
        modelo = paginas[0]["mod"] if paginas else perfil_base(r["mod"], perfis) or r["mod"]
        tipo, base = tipo_retentor(modelo, perfis)
        if base is None:
            problemas["ret_tipo_inferido"].add((r["mod"], tipo))
        linha = linha_csv_retentor(r, tipo, modelo)
        if paginas:  # a página do perfil (com desenho) é mais útil que a do índice
            linha["Pagina"] = paginas[0]["pagina"]
        saida.append(linha)
    return saida


def juntar_catalogos(gaxetas, retentores, problemas):
    """Mesmo código nos dois catálogos: fica a linha do de gaxetas, com REF, H1/H2 e orientação do de retentores.
    O de gaxetas imprime só "h" (= H1) nos raspadores GA/GAE/GAG; o de retentores imprime H1/H2."""
    idx = {chave(s["Codigo"]): s for s in gaxetas}
    out = list(gaxetas)
    for r in retentores:
        g = idx.get(chave(r["Codigo"]))
        if not g:
            out.append(r)
            continue
        extras_r = dict(e.split("=", 1) for e in r["Extras"].split("|") if e)
        h1 = parse_h(extras_r["H1/H2"])[0] if "H1/H2" in extras_r else None
        comparar = {"Interno": r["Interno"], "Externo": r["Externo"], "Altura": r4(h1) if h1 is not None else r["Altura"]}
        difs = [c for c, v in comparar.items() if g[c] != "" and v != "" and abs(float(g[c]) - float(v)) > TOL_DIVERGENCIA]
        if g["Material"] != r["Material"]:
            difs.append("Material")
        problemas["entre_catalogos"].append((r["Codigo"], f"{g['Tipo']} {g['Modelo']} {g['Material']} p{g['Pagina']}",
                                             f"{r['Tipo']} {r['Modelo']} {r['Material']} p{r['Pagina']}", difs))
        if not g["Referencia"]:
            g["Referencia"] = r["Referencia"]
        herdados = [f"{k}={v}" for k, v in extras_r.items() if k in ("H1/H2", "Orientação do lábio")]
        g["Extras"] = "|".join(filter(None, [g["Extras"], *herdados]))
    return out


# ---------------------------------------------------------------------------
# Listas AGEL 2025 (somente código + descrição; UN e % IPI são descartados)
# ---------------------------------------------------------------------------
def extrair_lista(pdf_path):
    itens = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            linha_lista = ""
            ws_pag = page.extract_words()
            un_x = min((w["x0"] for w in ws_pag if w["text"] == "UN"), default=470) - 5
            for ln in agrupar_linhas(ws_pag, tol=3):
                if ln["text"].startswith("Linha:"):
                    linha_lista = ln["text"].replace("Linha:", "").strip()
                    continue
                ws = ln["words"]
                if not ws or ws[0]["x0"] > 60:
                    continue
                codigo = ws[0]["text"]
                if not re.match(r"^[A-Z0-9][A-Z0-9./-]*$", codigo) or codigo in {"Código", "Código"}:
                    continue
                # descrição = palavras entre o código e a coluna UN (x < ~ 480 na página)
                desc_ws = [w for w in ws[1:] if w["x1"] < un_x]
                desc = " ".join(w["text"] for w in desc_ws).strip()
                if not desc:
                    continue
                itens.append({"codigo": codigo, "descricao": desc, "linha": linha_lista, "arquivo": Path(pdf_path).name})
    return itens


# Par de valores em mm ("5,00/7,00", "13/17,70"): H1/H2 na altura, ØEXT escalonado no externo
_H12 = r"\d+,\d+/\d+(?:,\d+)?|\d+/\d+,\d+"
_NUM = r"(" + _H12 + r"|\d+[ .]\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?)"
DESC_DIM_RE = re.compile(_NUM + r"\s*X\s*" + _NUM + r"\s*X\s*" + _NUM)


def dims_da_descricao(desc):
    d = re.sub(r"\b(AG|RP)\s*-?\s*\d+\b", " ", desc.upper())   # nome do modelo não é medida
    d = re.sub(r"(\d)\s+\.(\d)", r"\1.\2", d)                   # "2 .1/4" -> "2.1/4"
    d = re.sub(r"(\d,\d+)\s+/\s*(\d)", r"\1/\2", d)             # "7,00 / 11,50" -> "7,00/11,50"
    m = DESC_DIM_RE.search(d)
    if not m:
        return None
    grupos = [g.strip() for g in m.groups()]
    mm = any("," in g for g in grupos)
    # "10/15" numa descrição em mm também é par de valores, não fração de polegada
    par = [bool(re.fullmatch(_H12, g)) or (mm and bool(re.fullmatch(r"\d+/\d+", g))) for g in grupos]
    fracao = any("/" in g and not p for g, p in zip(grupos, par))
    vals = []
    for i, (g, eh_par) in enumerate(zip(grupos, par)):
        if eh_par:
            a, b = (float(x.replace(",", ".")) for x in g.split("/"))
            v = b if i == 2 else a  # altura: H2 (total); diâmetro escalonado: o primeiro
        elif "/" in g:
            v = parse_pol(g)
        elif "," in g:
            v = parse_mm(g)
        elif "." in g and re.fullmatch(r"\d+\.\d+", g):
            v = parse_mm(g)
        else:
            # inteiro: decide pelo contexto (frações na mesma descrição => pol)
            v = parse_pol(g) if fracao else parse_mm(g)
        vals.append(v)
    if None in vals:
        return None
    out = dict(zip(["Interno", "Externo", "Altura"], vals))
    if par[2]:
        out["H1"], out["H1/H2"] = float(grupos[2].split("/")[0].replace(",", ".")), grupos[2]
    return out


def chave(c):
    return re.sub(r"[\s\-./]", "", (c or "").upper())


# ---------------------------------------------------------------------------
# Montagem
# ---------------------------------------------------------------------------
def r4(v):
    return "" if v is None else f"{v:.4f}".rstrip("0").rstrip(".")


def montar(rows, problemas):
    saida = []
    for r in rows:
        linha, modelo = r["linha"], r["modelo"]
        if linha == "reparo":
            tipo, aplic, ficha, material = "Reparo pneumático", [], (None, None, None, None), ""
            linha_label = "Pneumática"
        else:
            tipo = tipo_do_modelo(linha, modelo)
            aplic = APLICACOES.get((linha, modelo))
            ficha = FICHA.get((linha, modelo, r["polymax"])) or FICHA.get((linha, modelo, False))
            if aplic is None or ficha is None:
                problemas["sem_manifesto"].add((r["pagina"], linha, modelo, r["polymax"]))
                aplic = aplic or []
                ficha = ficha or (None, None, None, None)
            if r["material_linha"]:
                material = "Polymax" if r["material_linha"] == "POLYMAX" else r["material_linha"]
            elif r["polymax"]:
                material = "Polymax"
            else:
                material = MATERIAL_PADRAO.get((linha, modelo), "")
            linha_label = LINHA_LABEL[linha]

        decod = decode_ref(r["ref"], CODE_PATTERN.get(modelo)) if linha in ("gaxeta", "raspador") else None
        final = dict(r["impresso"])
        fonte = "pdf"
        if decod:
            fonte = "codigo"
            for campo, v in decod.items():
                p = r["impresso"].get(campo)
                if p is not None and abs(p - v) > TOL_DIVERGENCIA:
                    problemas["codigo_vs_impresso"].append((r["pagina"], modelo, r["agel"], r["ref"], campo, p, v))
                final[campo] = v
        if not r["agel"]:
            problemas["sem_agel"].append((r["pagina"], modelo, r["ref"]))
        codigo = r["agel"] or r["ref"]
        if all(final.get(k) is None for k in ("Interno", "Externo", "Altura")) and linha != "reparo":
            problemas["nao_extraidas"].append((r["pagina"], modelo, r["raw"]))
            continue

        saida.append({
            "Codigo": codigo,
            "Referencia": r["ref"],
            "Tipo": tipo,
            "Modelo": modelo,
            "Material": material,
            "Aplicacao": ",".join(aplic),
            "Linha": linha_label,
            "Interno": r4(final.get("Interno")),
            "Externo": r4(final.get("Externo")),
            "Altura": r4(final.get("Altura")),
            "UnidadeNominal": r["unidade"],
            "PressaoPsi": ficha[0] if ficha[0] is not None else "",
            "TempMin": ficha[1] if ficha[1] is not None else "",
            "TempMax": ficha[2] if ficha[2] is not None else "",
            "VelocidadeMs": ficha[3] if ficha[3] is not None else "",
            "Extras": "|".join(f"{k.upper()}={v}" for k, v in r["extras"].items()),
            "Descricao": r.get("descricao", ""),
            "NaLista": "",
            "Fonte": fonte,
            "Catalogo": CAT_GAXETAS,
            "Pagina": r["pagina"],
        })
    return saida


def duplicados(saida, problemas):
    """Mesmo código em duas tabelas do mesmo catálogo."""
    vistos = {}
    for s in saida:
        vistos.setdefault(s["Codigo"], []).append(s)
    for cod, lst in vistos.items():
        if len(lst) > 1:
            problemas["duplicados_catalogo"].append(
                (cod, [f"{x['Modelo']}/{x['Material'] or '—'} p{x['Pagina']} ({x['Catalogo']})" for x in lst]))


def cruzar_listas(saida, itens, perfis, problemas):
    """Marca NaLista, completa a descrição e inclui o que só existe na lista."""
    idx = {}
    for s in saida:
        idx.setdefault(chave(s["Codigo"]), s)
        # Referência só no catálogo de gaxetas: é o código Tipo B/STD (no de retentores é a REF de mercado)
        if s["Referencia"] and s["Catalogo"] == CAT_GAXETAS:
            idx.setdefault(chave(s["Referencia"]), s)
    casados, novos = set(), {}
    for it in itens:
        s = idx.get(chave(it["codigo"]))
        if not s:
            if chave(it["codigo"]) not in novos:  # a lista repete códigos entre linhas (ex.: POLYMAX)
                problemas["lista_sem_catalogo"].append(it)
                novos[chave(it["codigo"])] = item_da_lista(it, perfis)
            continue
        casados.add(id(s))
        s["NaLista"] = "S"
        if not s["Descricao"]:
            s["Descricao"] = it["descricao"]
        d = dims_da_descricao(it["descricao"])
        if d:
            for campo in ("Interno", "Externo", "Altura"):
                v = d[campo]
                cat = s[campo]
                # H1/H2 na lista: o catálogo de gaxetas imprime só H1, o de retentores usa H2
                alvos = [v, d["H1"]] if campo == "Altura" and "H1" in d else [v]
                if cat != "" and all(abs(float(cat) - x) > TOL_DIVERGENCIA for x in alvos):
                    problemas["lista_vs_catalogo"].append((it["codigo"], s["Codigo"], it["descricao"], campo, float(cat), v))
    problemas["catalogo_sem_lista"] = [s for s in saida if id(s) not in casados]
    return saida + [n for n in novos.values() if n]


RET_MATERIAIS = {"HNBR", "NBR", "FPM", "VITON", "MVQ", "ACM", "PTFE", "TEFLON", "PU"}
RET_MAT_RE = re.compile(r"\b(HNBR|NBR|FPM|VITON|MVQ|ACM|PTFE|TEFLON|PU)(?:\s*/\s*(HNBR|NBR|FPM|VITON|PU|INOX))?\b")
RET_NAO_PERFIL = RET_MATERIAIS | {"REF", "PC", "C", "FUROS", "AZUL", "PT", "INOX", "X", "RETENTOR", "RET", "HASTE", "VALVULA"}


def retentor_da_lista(it, perfis):
    """Retentor que só existe na lista: perfil e material pela descrição."""
    desc = it["descricao"].upper()
    m = DESC_DIM_RE.search(re.sub(r"(\d)\s+\.(\d)", r"\1.\2", desc))
    cauda = desc[m.end():] if m else desc
    perfil = next((t for t in re.findall(r"\b[A-Z]{1,6}\d?\b", cauda) if t not in RET_NAO_PERFIL), "")
    if not perfil and m:  # "RETENTOR K7 35,00 X …": perfil antes das medidas
        perfil = next((t for t in re.findall(r"\b[A-Z]{1,6}\d?\b", desc[:m.start()]) if t not in RET_NAO_PERFIL), "")
    mat = RET_MAT_RE.search(cauda)
    material = ""
    if mat:
        material = "/".join(x.replace("VITON", "FPM").replace("TEFLON", "PTFE") for x in mat.groups() if x)
    ref = re.search(r"REF\.?\s*(\d{5})", desc)
    modelo = perfil_base(perfil, perfis) or perfil
    tipo = tipo_retentor(modelo, perfis)[0] if modelo else "Retentor"
    dims = dims_da_descricao(desc) or {}
    extras = {}
    if modelo != perfil:
        extras["Variante"] = perfil
    if "H1/H2" in dims:
        extras["H1/H2"] = dims["H1/H2"]
    return {
        "Codigo": it["codigo"], "Referencia": ref.group(1) if ref else "", "Tipo": tipo, "Modelo": modelo,
        "Material": material, "Aplicacao": HASTE if tipo == "Raspador" else EIXO,
        "Linha": "Hidráulica" if tipo == "Raspador" else "Retentores",
        "Interno": r4(dims.get("Interno")), "Externo": r4(dims.get("Externo")), "Altura": r4(dims.get("Altura")),
        "UnidadeNominal": "mm", "PressaoPsi": "", "TempMin": "", "TempMax": "", "VelocidadeMs": "",
        "Extras": "|".join(f"{k}={v}" for k, v in extras.items()), "Descricao": it["descricao"], "NaLista": "S",
        "Fonte": "lista2025", "Catalogo": CAT_LISTA, "Pagina": "",
    }


def item_da_lista(it, perfis):
    """Produto que existe só na lista 2025: facetas pela descrição, medidas pelo código ou descrição."""
    desc, cod = it["descricao"].upper(), it["codigo"].upper()
    if it["linha"] == "RETENTORES" or desc.startswith(("RETENTOR", "RET.", "RET,")):
        return retentor_da_lista(it, perfis)
    pneumatica = it["linha"] == "PNEUMÁTICA"
    if desc.startswith(("GAX", "CONJUNTO GAX")):
        tipo, linha = "Gaxeta", "pneumatica" if pneumatica else "gaxeta"
    elif desc.startswith(("RASP", "RAPADOR")):
        tipo, linha = "Raspador", "pneumatica" if pneumatica else "raspador"
    elif desc.startswith("REPARO") and pneumatica:
        tipo, linha = "Reparo pneumático", None
    elif desc.startswith("ALICATE"):
        tipo, linha = "Ferramenta", None
    else:
        tipo, linha = "Outros", None

    modelo = ""
    if m := re.search(r"\bAG\s*-?\s*(\d+)", desc):
        modelo = f"AG {m.group(1)}"
    elif m := re.search(r"\bTIPO\s+([A-Z0-9/-]+)", desc):
        modelo = m.group(1)
    elif m := re.search(r"\b(RP-\d+)", desc):
        modelo = m.group(1)
    elif re.search(r"\bSTD\b", desc):
        modelo = "STD"
    # Perfil pelo código só quando o padrão é exclusivo no catálogo.
    # "6" + SSS IIIII HHH sem sufixo é B ou STD: fica em branco (relatório).
    elif re.search(r"BS(PMX?)?$", cod):
        modelo = "AG 4 (BS)"
    elif linha == "raspador" and re.match(r"66?D-\d{4}", cod):
        modelo = "6D/66D"
    elif linha == "raspador" and re.match(r"D-\d{4}", cod):
        modelo = "D"
    codigo_limpo = re.sub(r"(BS)?(PMX?)?$", "", cod.replace("-", ""))
    pattern = None
    if linha in ("gaxeta", "raspador") and re.fullmatch(r"\d{8}", codigo_limpo):
        pattern, modelo = "std8", modelo or "STD"
    elif linha in ("gaxeta", "raspador") and re.fullmatch(r"\d{11}", codigo_limpo):
        pattern, modelo = "b11", modelo or "B"
    if modelo == "AG 4":
        modelo = "AG 4 (BS)"
    if linha == "pneumatica":
        tipo = tipo_do_modelo(linha, modelo)

    polymax = it["linha"] == "POLYMAX" or "POLYMAX" in desc or bool(re.search(r"PMX?$", cod))
    if polymax:
        material = "Polymax"
    elif it["linha"] == "GAXETAS GSK" or "GSK" in desc:
        material = "GSK"
    elif m := re.search(r"\b(PU|NBR|MVQ|VITON|FKM)\b", desc):
        material = m.group(1)
    else:
        material = MATERIAL_PADRAO.get((linha, modelo), "") if linha else ""

    dims = (decode_ref(codigo_limpo, pattern) if pattern else None) or dims_da_descricao(desc) or {}
    if "H1" in dims:  # como no catálogo de gaxetas: Altura = H1
        dims["Altura"] = dims["H1"]
    aplic = APLICACOES.get((linha, modelo), []) if linha else []
    ficha = (FICHA.get((linha, modelo, polymax)) or FICHA.get((linha, modelo, False))) if linha else None
    ficha = ficha or (None, None, None, None)
    return {
        "Codigo": it["codigo"], "Referencia": "", "Tipo": tipo, "Modelo": modelo, "Material": material,
        "Aplicacao": ",".join(aplic),
        "Linha": "Pneumática" if pneumatica else "Hidráulica" if linha else "",
        "Interno": r4(dims.get("Interno")), "Externo": r4(dims.get("Externo")), "Altura": r4(dims.get("Altura")),
        "UnidadeNominal": "pol" if "/" in desc else "mm",
        "PressaoPsi": ficha[0] if ficha[0] is not None else "", "TempMin": ficha[1] if ficha[1] is not None else "",
        "TempMax": ficha[2] if ficha[2] is not None else "", "VelocidadeMs": ficha[3] if ficha[3] is not None else "",
        "Extras": f"H1/H2={dims['H1/H2']}" if "H1/H2" in dims else "", "Descricao": it["descricao"], "NaLista": "S",
        "Fonte": "codigo" if pattern and dims else "lista2025", "Catalogo": CAT_LISTA, "Pagina": "",
    }


def ler_legado():
    """Mapeia códigos das CSVs antigas para detectar sobreposição com o APC."""
    leg = {}
    for f in sorted(LEGACY_DIR.glob("data_*.csv")):
        with open(f, encoding="utf-8") as fh:
            linhas = [l for l in fh if not l.startswith("#")]
        for row in csv.DictReader(linhas, delimiter=";"):
            c = (row.get("Codigo") or "").strip()
            if c:
                leg.setdefault(chave(c), []).append((f.name, c, row))
    return leg


def ler_anterior():
    """CSV versionado no último commit (para o relatório de mudanças); vazio fora do git."""
    try:
        txt = subprocess.run(["git", "show", f"HEAD:{OUT_CSV.relative_to(ROOT).as_posix()}"], cwd=ROOT,
                             capture_output=True, text=True, encoding="utf-8", check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        return []
    return list(csv.DictReader(io.StringIO(txt), delimiter=";"))


CAMPOS = ["Codigo", "Referencia", "Tipo", "Modelo", "Material", "Aplicacao", "Linha", "Interno", "Externo",
          "Altura", "UnidadeNominal", "PressaoPsi", "TempMin", "TempMax", "VelocidadeMs", "Extras",
          "Descricao", "NaLista", "Fonte", "Catalogo", "Pagina"]


def escrever_csv(saida):
    saida.sort(key=lambda s: (s["Tipo"], s["Linha"], s["Modelo"], s["Material"], s["Fonte"],
                              float(s["Interno"] or 0), float(s["Externo"] or 0), float(s["Altura"] or 0), s["Codigo"]))
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=CAMPOS, delimiter=";", lineterminator="\n")
    w.writeheader()
    w.writerows(saida)
    OUT_CSV.write_text(buf.getvalue(), encoding="utf-8")


def fmt(v):
    return f"{v:.2f}".replace(".", ",")


def fmt_opt(v):
    return "—" if v is None else fmt(v) if isinstance(v, float) else str(v)


def mudancas(anterior, saida):
    """Códigos que entraram/saíram e medidas/facetas que mudaram em relação ao CSV anterior."""
    ant = {chave(r["Codigo"]): r for r in anterior}
    nov = {chave(s["Codigo"]): s for s in saida}
    sairam = [ant[k] for k in ant if k not in nov]
    entraram = [nov[k] for k in nov if k not in ant]
    mudou = []
    for k in ant.keys() & nov.keys():
        a, n = ant[k], nov[k]
        for campo in ("Tipo", "Modelo", "Material", "Aplicacao", "Interno", "Externo", "Altura"):
            va, vn = str(a.get(campo, "")), str(n.get(campo, ""))
            try:
                if abs(float(va) - float(vn)) <= TOL_DIVERGENCIA:
                    continue
            except ValueError:
                pass
            if va != vn:
                mudou.append((n["Codigo"], campo, va or "—", vn or "—"))
    return sairam, entraram, mudou


def escrever_relatorio(saida, problemas, legado, anterior):
    L = ["# Relatório de ingestão — catálogos APC", "",
         "Gerado por `scripts/ingest_catalogos.py`. Não editar à mão.", "",
         "Fontes: catálogo de gaxetas e raspadores ref. 2022 (`gaxetas-2022`), catálogo de retentores "
         "ref. 2021 (`retentores-2021`) e listas AGEL 2025 (`lista-2025`).", ""]
    # contagens
    from collections import Counter
    cont = Counter((s["Tipo"], s["Modelo"], s["Material"] or "—", s["Linha"]) for s in saida)
    por_cat = Counter(s["Catalogo"] for s in saida)
    L += ["## Itens por modelo", "", f"Total: **{len(saida)}** itens "
          f"({', '.join(f'{c}: {n}' for c, n in sorted(por_cat.items()))}).", "",
          "| Tipo | Modelo | Material | Linha | Itens |", "|---|---|---|---|---|"]
    L += [f"| {t} | {m} | {mat} | {li} | {n} |" for (t, m, mat, li), n in sorted(cont.items())]

    sairam, entraram, mudou = mudancas(anterior, saida)
    L += ["", "## Mudanças em relação ao CSV do último commit", "",
          f"- Saíram: **{len(sairam)}** · Entraram: **{len(entraram)}** · Campos alterados: **{len(mudou)}**", ""]
    if sairam:
        L += ["### Saíram", "", "| Código | Tipo | Modelo | Material | Medidas (mm) | Fonte anterior |", "|---|---|---|---|---|---|"]
        L += [f"| `{r['Codigo']}` | {r['Tipo']} | {r['Modelo']} | {r['Material']} | "
              f"{r['Interno'] or '—'} × {r['Externo'] or '—'} × {r['Altura'] or '—'} | {r.get('Fonte', '')} p{r.get('Pagina', '')} |"
              for r in sorted(sairam, key=lambda r: (r["Tipo"], r["Modelo"], r["Codigo"]))]
        L += [""]
    if mudou:
        L += ["### Campos alterados", "", "| Código | Campo | Antes | Agora |", "|---|---|---|---|"]
        L += [f"| `{c}` | {campo} | {a} | {n} |" for c, campo, a, n in sorted(mudou)]
        L += [""]
    if entraram:
        cont_e = Counter((s["Catalogo"], s["Tipo"]) for s in entraram)
        L += ["### Entraram (por catálogo e tipo)", "", "| Catálogo | Tipo | Itens |", "|---|---|---|"]
        L += [f"| {c} | {t} | {n} |" for (c, t), n in sorted(cont_e.items())]

    L += ["", f"## Código da referência × valor impresso (> {fmt(TOL_DIVERGENCIA)} mm)", "",
          "O CSV usa o valor do **código** (fonte da verdade).", ""]
    if problemas["codigo_vs_impresso"]:
        L += ["| Pág. | Modelo | Nº AGEL | Referência | Campo | Impresso (mm) | Código (mm) |", "|---|---|---|---|---|---|---|"]
        L += [f"| {p} | {m} | {a} | {r} | {c} | {fmt(i)} | {fmt(v)} |" for p, m, a, r, c, i, v in problemas["codigo_vs_impresso"]]
    else:
        L += ["Nenhuma divergência."]

    L += ["", "## Linhas sem Nº AGEL (Código = Referência)", ""]
    L += [f"- pág. {p} · {m} · `{r}`" for p, m, r in problemas["sem_agel"]] or ["Nenhuma."]

    L += ["", "## Mesmo código em mais de uma tabela", ""]
    L += [f"- `{c}`: {', '.join(lst)}" for c, lst in problemas["duplicados_catalogo"]] or ["Nenhum."]

    L += ["", "## Retentores: índice × páginas de perfil", "",
          "O CSV usa o **índice** (págs. 84–111). Divergência = mesmo código com valor diferente na página do perfil.", ""]
    if problemas["ret_indice_vs_pagina"]:
        L += ["| Código | Campo | Índice | Página do perfil | Pág. índice | Pág. perfil |", "|---|---|---|---|---|---|"]
        L += [f"| `{c}` | {campo} | {fmt_opt(a)} | {fmt_opt(b)} | {pi} | {pp} |" for c, campo, a, b, pi, pp in problemas["ret_indice_vs_pagina"]]
    else:
        L += ["Nenhuma divergência."]
    L += ["", "### Só nas páginas de perfil (fora do índice; incluídos)", ""]
    L += [f"- pág. {p} · {m} · `{c}`" for p, m, c in problemas["ret_so_pagina"]] or ["Nenhum."]
    L += ["", "### Só no índice (sem página de perfil)", ""]
    L += [f"- pág. {p} · {m} · `{c}`" for p, m, c in problemas["ret_so_indice"]] or ["Nenhum."]
    L += ["", "### Perfis sem página própria (tipo inferido)", "",
          "Variantes de material (sufixo F/S/P) seguem o perfil-base. Estes não têm base com página:", ""]
    L += [f"- {m} → {t}" for m, t in sorted(problemas["ret_tipo_inferido"])] or ["Nenhum."]

    L += ["", "## Mesmo código nos dois catálogos (o de gaxetas prevalece)", ""]
    if problemas["entre_catalogos"]:
        L += ["| Código | Gaxetas 2022 | Retentores 2021 | Divergências |", "|---|---|---|---|"]
        L += [f"| `{c}` | {g} | {r} | {', '.join(d) or '—'} |" for c, g, r, d in problemas["entre_catalogos"]]
    else:
        L += ["Nenhum."]

    L += ["", "## Sobreposição com as CSVs antigas (o APC prevalece no painel)", ""]
    sobre = []
    for s in saida:
        for arq, c, row in legado.get(chave(s["Codigo"]), []):
            sobre.append(f"| `{c}` | {arq} | {s['Tipo']} {s['Modelo']} {s['Material']} |")
    if sobre:
        L += [f"{len(sobre)} códigos.", "", "| Código | CSV antiga | APC |", "|---|---|---|"] + sobre
    else:
        L += ["Nenhuma."]

    L += ["", "## Listas 2025 × catálogos", "",
          "Cruzamento por código (ou Referência Tipo B/STD; hífens ignorados). Só código e descrição são lidos.", ""]
    n_cat = sum(1 for s in saida if s["Catalogo"] != CAT_LISTA)
    L += [f"- Itens dos catálogos encontrados nas listas: **{sum(1 for s in saida if s['NaLista'] and s['Catalogo'] != CAT_LISTA)}** de {n_cat}",
          f"- Itens das listas sem correspondência nos catálogos: **{len(problemas['lista_sem_catalogo'])}**", ""]
    L += ["### Medida da descrição (lista) × catálogo", ""]
    if problemas["lista_vs_catalogo"]:
        L += ["| Código lista | Código catálogo | Descrição | Campo | Catálogo (mm) | Descrição (mm) |", "|---|---|---|---|---|---|"]
        L += [f"| `{a}` | `{b}` | {d} | {c} | {fmt(x)} | {fmt(y)} |" for a, b, d, c, x, y in problemas["lista_vs_catalogo"]]
    else:
        L += ["Nenhuma divergência."]
    L += ["", "### Itens das listas que não estão nos catálogos (incluídos com Catalogo=lista-2025)", ""]
    if problemas["lista_sem_catalogo"]:
        L += ["| Código | Lista | Linha | Descrição |", "|---|---|---|---|"]
        L += [f"| `{i['codigo']}` | {i['arquivo']} | {i['linha']} | {i['descricao']} |" for i in problemas["lista_sem_catalogo"]]
    else:
        L += ["Nenhum."]

    L += ["", "## Modelos sem ficha/aplicação no manifesto", ""]
    L += [f"- pág. {p} · {li} · {m} · polymax={pm}" for p, li, m, pm in sorted(problemas["sem_manifesto"])] or ["Nenhum."]
    L += ["", "## Linhas não extraídas", "", "Página com prefixo R = catálogo de retentores.", ""]
    L += [f"- pág. {p} · {m} · `{raw}`" for p, m, raw in problemas["nao_extraidas"]] or ["Nenhuma."]
    sem_perfil = [s for s in saida if s["Tipo"] in ("Gaxeta", "Raspador", "Retentor") and not s["Modelo"]]
    L += ["", "## Perfil a confirmar", "",
          "Só na lista 2025, sem perfil na descrição nem código exclusivo. Aparecem na busca por medida, não no filtro de Perfil.", ""]
    L += [f"- `{s['Codigo']}` · {s['Descricao']}" for s in sem_perfil] or ["Nenhum."]
    sem_medida = [s for s in saida if s["Tipo"] in ("Gaxeta", "Raspador", "Retentor")
                  and not (s["Interno"] and s["Externo"] and s["Altura"])]
    L += ["", "## Medida incompleta", "", "Aparecem na busca por código, mas não em todas as buscas por medida.", ""]
    L += [f"- `{s['Codigo']}` · {s['Catalogo']} · {s['Descricao'] or s['Modelo']}" for s in sem_medida] or ["Nenhum."]
    L += ["", "## Pendências conhecidas (dados antigos)", "",
          "- `data_conjunto_bp.csv`: colunas Externo/Interno parecem trocadas em parte das linhas.",
          "- Raspadores D, 6D/66D, 900D, K, RP-25, DG e E não têm coluna MATERIAL: PU por inferência (faixa -30/+100 °C).",
          "- Linha pneumática não informa material (exceto Z = borracha); fica em branco.",
          "- Retentores não têm ficha de pressão/temperatura no catálogo.",
          "- Tabela de conversão do Drive: `11 1/2` = 292,10 (não 292,70); `18 1/4` = 463,55; `22` = 558,80; falta `27/32` (21,43)."]
    OUT_REPORT.write_text("\n".join(L) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalogo", default=str(CATALOGO_PDF))
    ap.add_argument("--retentores", default=str(RETENTORES_PDF))
    ap.add_argument("--listas", nargs="*", default=[str(p) for p in LISTAS_PDF])
    a = ap.parse_args()

    problemas = {"codigo_vs_impresso": [], "sem_agel": [], "nao_extraidas": [], "sem_manifesto": set(),
                 "duplicados_catalogo": [], "lista_sem_catalogo": [], "lista_vs_catalogo": [],
                 "catalogo_sem_lista": [], "ret_indice_vs_pagina": [], "ret_so_pagina": [], "ret_so_indice": [],
                 "ret_tipo_inferido": set(), "entre_catalogos": []}
    anterior = ler_anterior()
    gaxetas = montar(extrair_catalogo(a.catalogo, problemas), problemas)
    perfis, pag_rows, indice = extrair_retentores(a.retentores, problemas)
    retentores = montar_retentores(perfis, pag_rows, indice, problemas)
    duplicados(gaxetas, problemas)
    duplicados(retentores, problemas)
    saida = juntar_catalogos(gaxetas, retentores, problemas)
    itens = [it for f in a.listas for it in extrair_lista(f)]
    saida = cruzar_listas(saida, itens, perfis, problemas)
    escrever_csv(saida)
    escrever_relatorio(saida, problemas, ler_legado(), anterior)

    from collections import Counter
    print(f"itens: {len(saida)}")
    for k, n in sorted(Counter((s['Catalogo'], s['Tipo']) for s in saida).items()):
        print(f"  {k[0]:<16} {k[1]:<18} {n}")
    print({k: len(v) for k, v in problemas.items()})
    print(f"listas 2025: {len(itens)} linhas; casados com catálogo: "
          f"{sum(1 for s in saida if s['NaLista'] and s['Catalogo'] != CAT_LISTA)}; "
          f"só na lista: {len(problemas['lista_sem_catalogo'])}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
