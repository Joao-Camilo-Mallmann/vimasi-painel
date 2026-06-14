# Vimasi Painel - AI Agent Guidelines

Esta é a especificação de regras e comportamentos para assistentes de IA que operam no projeto `vimasi-painel`.

## Diretrizes Gerais

1. **Design System & Estética Visual:**
   - Siga estritamente as regras definidas em [.agents/DESIGN.md](file:///home/joao/projects/vimasi-painel/.agents/DESIGN.md).
   - O projeto adota uma estética *Industrial Premium*, combinando um dark canvas com detalhes em Gold (`#e4c7aa`) e Red (`#e53935`).
   - Evite introduzir cores flat ou fora da paleta corporativa.
   
2. **Componentização & Customização:**
   - Badges de tipos de peças na tabela (ex: ZW, ZO) possuem cores fixas específicas para garantir contraste e rápida identificação visual no painel.
   - Qualquer novo tipo de peça adicionado dinamicamente ao CSV receberá uma cor gerada de forma determinística (via HSL hash) para manter a harmonia visual sem exigir intervenção manual de código.

3. **Performance & Frameworks:**
   - O projeto utiliza React com Tailwind CSS.
   - Não use classes dinâmicas interpoladas do Tailwind que possam falhar no build (ex: `text-${color}-400`). Em vez disso, utilize estilos inline computados para variações dinâmicas complexas ou mapeamentos pré-definidos.
