<div align="center">
  <img src="public/logo.png" alt="Vimasi Logo" width="280" />

  <h1>Vimasi Painel</h1>
  <p><strong>Motor de busca dimensional de vedações industriais</strong></p>
  <p>Busque em +6.000 peças de 20 categorias com filtragem precisa por dimensões e tolerâncias.</p>

  <a href="https://painel.vimasi-vedacoes.com/">🔗 painel.vimasi-vedacoes.com</a>

  <br/><br/>

  ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
  ![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
  ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
</div>

---

![Vimasi Painel](docs/print-home.png)

---

## ✨ Funcionalidades

| Feature | Descrição |
|---|---|
| 🔍 **Busca Dimensional Global** | Cruze dimensões (diâmetro, altura, espessura) em todas as 20 categorias simultaneamente |
| 📐 **Tolerância Dinâmica** | Margens de ±0.2mm, ±0.5mm etc. para localizar peças equivalentes ou substitutas |
| 🧩 **Formulário Adaptativo** | Campos se ajustam ao tipo selecionado (O-Ring → Ø + espessura; ZW → Alt. Base, etc.) |
| 📊 **Tabela Inteligente** | Colunas se reorganizam para mostrar apenas as dimensões pertinentes ao tipo visualizado |
| 📋 **Cópia Rápida** | Botão "QUERO" copia o código da peça para a área de transferência com feedback visual |
| 📱 **Totalmente Responsivo** | Do mobile a monitores ultrawide no formato Dashboard |

---

## 🛠️ Stack

| Camada | Tecnologia |
|---|---|
| UI Framework | [React 19](https://react.dev/) |
| Build Tool | [Vite 8](https://vitejs.dev/) |
| Estilização | [Tailwind CSS v4](https://tailwindcss.com/) |
| Ícones | [Lucide React](https://lucide.dev/) |
| Parse CSV | [PapaParse](https://www.papaparse.com/) |
| Linguagem | JavaScript ESM |

---

## 🚀 Como Rodar Localmente

> Requer **Node.js 18+** e **npm**.

**1. Clone e instale as dependências:**
```bash
git clone <repo-url>
cd vimasi-painel
npm install
```

**2. Inicie o servidor de desenvolvimento:**
```bash
npm run dev
# → http://localhost:5173
```

---

## ☁️ Deploy

O projeto está configurado para deploy automático via **GitHub Actions → GitHub Pages**.

1. Faça push para o repositório no GitHub.
2. Vá em **Settings → Pages → Source → GitHub Actions**.
3. Aguarde ~1 minuto. O workflow em `.github/workflows/deploy.yml` faz o deploy automaticamente.

> 🔗 Produção: [https://painel.vimasi-vedacoes.com/](https://painel.vimasi-vedacoes.com/)

---

<div align="center">
  <sub>Desenvolvido para <strong>Vimasi Vedações Industriais</strong></sub>
</div>
