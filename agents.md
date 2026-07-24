# Vimasi Painel - AI Agent Guidelines

Esta é a especificação de regras e comportamentos para assistentes de IA que operam no projeto `vimasi-painel`.

## Diretrizes Gerais


**USE /GRILL-ME nos propmt caso seja mais adequado para o contexto.**

1. **Design System & Estética Visual:**
   - Siga estritamente as regras definidas em [.agents/DESIGN.md](file:///home/joao/projects/vimasi-painel/.agents/DESIGN.md).
   - O projeto adota uma estética *Industrial Premium*, combinando um dark canvas com detalhes em Gold (`#e4c7aa`) e Red (`#e53935`).
   - Evite introduzir cores flat ou fora da paleta corporativa.
   
2. **Componentização & Customização:**
   - Badges de tipos de peças na tabela (ex: ZW, ZO, ORING, CHEVRON) possuem cores fixas específicas para garantir contraste e rápida identificação visual no painel. As cores devem ser lidas da configuração central em `src/config/categories.js`.
   - Evitar geração de cores dinâmicas para manter a consistência visual; usar a paleta predefinida no `categories.js` para as 20 categorias existentes.

3. **Performance & Frameworks:**
   - O projeto utiliza React com Tailwind CSS.
   - Não use classes dinâmicas interpoladas do Tailwind que possam falhar no build (ex: `text-${color}-400`). Em vez disso, utilize estilos inline computados para variações dinâmicas complexas ou mapeamentos pré-definidos.
- Colunas 'Altura' e 'AlturaTotal' dos CSVs foram unificadas no sistema (adotando 'Altura'), mantendo a 'AlturaBase' separada para peças de conjunto.

4. **Integracao Supabase MCP:**
   - Servidor MCP do Supabase configurado via [.mcp.json](file:///home/joao/projects/vimasi-painel/.mcp.json) (`https://mcp.supabase.com/mcp`).
