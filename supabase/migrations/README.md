# Migrations — Supabase

Cada arquivo aqui é uma migração versionada do schema, em ordem cronológica.

## Convenção de nome
```
AAAAMMDDHHMMSS_descricao_curta.sql
```
Ex.: `20260524000000_profiles_rls.sql`

## Regras
- **Nunca** edite uma migration já aplicada em produção. Crie uma nova.
- Uma migration = uma mudança lógica de schema.
- Aplicar via SQL Editor do Supabase **na ordem** dos nomes de arquivo.

## Arquivos
- `20260101000000_baseline_schema.sql` — schema base (consolidado do histórico anterior).
- `20260524000000_profiles_rls.sql` — RLS policies da tabela `profiles`.
