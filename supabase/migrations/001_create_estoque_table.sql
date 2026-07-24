-- Migration: 001_create_estoque_table
-- Descrição: Cria a tabela de estoque centralizado e configura RLS
-- Projeto: Vimasi Painel
-- Data: 2026-07-24

-- ============================================
-- 1. TABELA: estoque
-- Armazena os códigos de peças aprovadas/em estoque.
-- Substitui o antigo sistema baseado em localStorage.
-- ============================================

create table if not exists public.estoque (
  codigo     text primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table  public.estoque            is 'Peças aprovadas/em estoque — gerenciado pelos administradores do painel.';
comment on column public.estoque.codigo     is 'Código identificador único da peça (mesmo valor exibido no painel de busca).';
comment on column public.estoque.created_at is 'Data/hora UTC em que a peça foi marcada como em estoque.';

-- ============================================
-- 2. ROW LEVEL SECURITY (RLS)
-- Apenas usuários autenticados (admins) podem
-- ler, inserir ou remover registros.
-- Requisições anônimas são bloqueadas.
-- ============================================

alter table public.estoque enable row level security;

-- Política única para todas as operações (SELECT, INSERT, UPDATE, DELETE)
create policy "Acesso exclusivo para administradores autenticados"
  on public.estoque
  for all
  to authenticated
  using (true)
  with check (true);
