# Configuração do Banco de Dados — Supabase (Vimasi Painel)

Guia completo para configurar o Supabase para o projeto **Vimasi Painel**, incluindo credenciais, migração do banco e criação de usuários administradores.

---

## 1. Credenciais (`.env`)

No painel do Supabase, acesse **Project Settings > API** e copie as chaves:

| Variável | Onde encontrar | Formato |
|---|---|---|
| `VITE_SUPABASE_URL` | Project URL | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Project API keys → **`anon` `public`** | `eyJhbGci...` (JWT longo) |

Cole no arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> ⚠️ **NUNCA** use a chave `service_role` / `secret` (que começa com `sb_secret_`). Ela dá acesso total ao banco e não pode ser exposta no navegador.

---

## 2. Migração do Banco de Dados

O arquivo de migração está em:

📄 [`supabase/migrations/001_create_estoque_table.sql`](supabase/migrations/001_create_estoque_table.sql)

### Como executar:

1. Acesse o painel do Supabase.
2. Vá em **SQL Editor** (ícone de terminal `>_` no menu lateral).
3. Clique em **New query**.
4. Copie e cole o conteúdo completo do arquivo de migração.
5. Clique em **Run**.

### O que a migração cria:

| Recurso | Descrição |
|---|---|
| Tabela `public.estoque` | Armazena os códigos das peças aprovadas/em estoque |
| Coluna `codigo` (PK) | Código identificador único da peça (text) |
| Coluna `created_at` | Timestamp UTC de quando foi adicionado |
| RLS habilitado | Row Level Security ativado na tabela |
| Política de acesso | Apenas usuários autenticados podem ler/inserir/deletar |

---

## 3. Criar Usuário Administrador

Como o sistema **não tem cadastro público** (por design), os usuários precisam ser criados manualmente:

1. No painel do Supabase, vá em **Authentication > Users**.
2. Clique em **Add user > Create user**.
3. Preencha:
   - **Email:** e-mail do administrador
   - **Password:** senha de acesso
   - **Auto Confirm User:** ✅ marque para ativar imediatamente (sem confirmação por e-mail)
4. Clique em **Create User**.

---

## 4. Deploy (Variáveis de Ambiente)

Se estiver fazendo deploy em plataformas como **Vercel**, **Netlify** ou **GitHub Pages**, configure as variáveis de ambiente no painel da plataforma:

- `VITE_SUPABASE_URL` → URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` → Chave anon/public

---

## Estrutura de Arquivos

```
supabase/
└── migrations/
    └── 001_create_estoque_table.sql   ← Tabela estoque + RLS
.env                                    ← Credenciais (não commitado)
.env.example                            ← Template público
```
