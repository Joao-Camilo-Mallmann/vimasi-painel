"""Extrai a lista AGEL de anéis O-ring (REF. 01/2025) para um CSV SEM PREÇO.

Uso (rodar da raiz do projeto, só quando a lista mudar):
    python -I scripts/extrair_lista_oring.py [caminho-do-pdf]

Entrada:
    docs/catalogos/precos/lista-oring-2025-01.pdf   (tem preço: pasta fora do git)
Saída:
    docs/catalogos/listas/lista-oring-2025.csv      (versionado; Codigo;DI;W;Serie;Material;Pagina)

Regras:
- Só Código, D.I. e W são lidos. Preço e Qtd Min são descartados (preço nunca entra no git).
- Série e Material vêm do manifesto de páginas abaixo, conferido contra o título de cada página.
- Kit O-rings (pág. 3) e Backup (págs. 44-46) ficam de fora.
- D.I. = Ø interno; W = altura e seção (mm). O ØEXT é calculado na ingestão (D.I. + 2·W).
"""

import csv
import io
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "docs/catalogos/precos/lista-oring-2025-01.pdf"
OUT = ROOT / "docs/catalogos/listas/lista-oring-2025.csv"

STANDARD, MILIMETRICO = "Standard", "Milimétrico"

# (1ª pág., última pág., série, material, linhas esperadas) — páginas do PDF, transcrito do índice (pág. 1)
SECOES = [
    (4, 7, STANDARD, "Nitrílica Dureza 70", 342),
    (8, 11, STANDARD, "Nitrílica Dureza 90", 321),
    (12, 15, STANDARD, "FPM marrom", 325),
    (16, 16, STANDARD, "FPM preto", 63),
    (17, 17, STANDARD, "FPM verde", 41),
    (18, 19, STANDARD, "EPDM", 142),
    (20, 23, STANDARD, "Silicone Dureza 70", 311),
    (24, 32, MILIMETRICO, "Nitrílica Dureza 70", 804),
    (33, 34, MILIMETRICO, "Nitrílica Dureza 90", 185),
    (35, 37, MILIMETRICO, "FPM marrom", 212),
    (38, 38, MILIMETRICO, "FPM preto", 86),
    (39, 40, MILIMETRICO, "FPM verde", 111),
    (41, 42, MILIMETRICO, "EPDM", 96),
    (43, 43, MILIMETRICO, "Silicone", 84),
]

CODIGO_RE = re.compile(r"^[A-Z]?\d{4,5}$")
MEDIDA_RE = re.compile(r"^\d{1,3}(\.\d{3})*,\d+$")
TOPO_TABELA = 65   # abaixo do cabeçalho "Codigo D.I. W Preço"
TOL_LINHA = 2.0    # palavras da mesma linha (o preço fica meio passo acima/abaixo e cai fora)
MARGEM_BLOCO = 25  # o código começa um pouco antes do "Codigo" do cabeçalho
LARGURA_CODIGO = 30


def sem_acento(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def confere_titulo(titulo, serie, material, pagina):
    """O título da página tem de bater com o manifesto (aceita o erro de digitação "FTP")."""
    t = sem_acento(titulo).replace("ftp", "fpm")
    esperado = [sem_acento(serie)[:6]] + [p for p in sem_acento(material).split() if p != "dureza"]
    faltam = [p for p in esperado if p not in t]
    if faltam:
        sys.exit(f"pág. {pagina}: título {titulo!r} não bate com {serie} / {material} (faltou {faltam})")


def mm(txt):
    return float(txt.replace(".", "").replace(",", "."))


def extrair_pagina(page, pagina, serie, material):
    # as células vêm preenchidas com espaços que se sobrepõem aos dígitos e partem o número ("1" + ",27")
    words = page.filter(lambda o: o.get("text") != " ").extract_words()
    titulo = " ".join(w["text"] for w in sorted(words, key=lambda w: (round(w["top"]), w["x0"]))
                      if w["top"] < 50)
    confere_titulo(titulo, serie, material, pagina)
    blocos = sorted(w["x0"] for w in words if w["text"] == "Codigo")
    if not blocos:
        sys.exit(f"pág. {pagina}: cabeçalho 'Codigo' não encontrado")
    corpo = [w for w in words if w["top"] >= TOPO_TABELA]
    linhas = []
    for i, x_cod in enumerate(blocos):
        ini = x_cod - MARGEM_BLOCO
        fim = blocos[i + 1] - MARGEM_BLOCO if i + 1 < len(blocos) else float("inf")
        codigos = [w for w in corpo if ini <= w["x0"] < x_cod + LARGURA_CODIGO and CODIGO_RE.match(w["text"])]
        for c in sorted(codigos, key=lambda w: w["top"]):
            resto = sorted((w for w in corpo if c["x0"] < w["x0"] < fim and abs(w["top"] - c["top"]) <= TOL_LINHA),
                           key=lambda w: w["x0"])
            if len(resto) < 2 or not all(MEDIDA_RE.match(w["text"]) for w in resto[:2]):
                sys.exit(f"pág. {pagina}: código {c['text']} sem D.I./W legíveis: {[w['text'] for w in resto]}")
            linhas.append({"Codigo": c["text"], "DI": mm(resto[0]["text"]), "W": mm(resto[1]["text"]),
                           "Serie": serie, "Material": material, "Pagina": pagina})
    return linhas


def num(v):
    return f"{v:.4f}".rstrip("0").rstrip(".")


def main():
    pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else PDF
    if not pdf_path.exists():
        sys.exit(f"PDF não encontrado: {pdf_path}\nCopie a lista de O-rings (com preço) para docs/catalogos/precos/.")
    saida = []
    with pdfplumber.open(pdf_path) as pdf:
        for ini, fim, serie, material, esperado in SECOES:
            secao = [l for p in range(ini, fim + 1) for l in extrair_pagina(pdf.pages[p - 1], p, serie, material)]
            if len(secao) != esperado:
                sys.exit(f"{serie} em {material}: {len(secao)} linhas, esperado {esperado}")
            if any(l["DI"] <= 0 or l["W"] <= 0 for l in secao):
                sys.exit(f"{serie} em {material}: medida zerada")
            saida += secao

    repetidos = [c for c, n in Counter(l["Codigo"] for l in saida).items() if n > 1]
    if repetidos:
        sys.exit(f"códigos repetidos: {repetidos[:20]}")

    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=["Codigo", "DI", "W", "Serie", "Material", "Pagina"],
                       delimiter=";", lineterminator="\n")
    w.writeheader()
    w.writerows({**l, "DI": num(l["DI"]), "W": num(l["W"])} for l in saida)
    OUT.write_text(buf.getvalue(), encoding="utf-8")

    print(f"{len(saida)} anéis -> {OUT.relative_to(ROOT).as_posix()}")
    for (serie, material), n in Counter((l["Serie"], l["Material"]) for l in saida).items():
        print(f"  {serie:<12} {material:<20} {n}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
