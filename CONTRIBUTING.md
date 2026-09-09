# Encorpei Saúde

## Rodar localmente

```bash
bun install          # instala dependências (determinístico via bun.lock)
bun run dev          # dev server em http://localhost:5173
```

## Scripts de qualidade

| Script | O que faz |
|---|---|
| `bun run lint` | ESLint com tolerância de 50 warnings |
| `bun run lint:ci` | ESLint zero-tolerance (usado no CI) |
| `bun run typecheck` | `tsc --noEmit` — verifica tipos sem emitir |
| `bun run test` | Vitest — roda todos os testes |
| `bun run build` | Build de produção via Vite |
| `bun run ci` | Roda typecheck + lint + test em sequência |

## Pipeline CI (GitHub Actions)

Arquivo: `.github/workflows/ci.yml`

Roda automaticamente em todo **push para main** e em **pull requests** para main.

Etapas: `install → lint → typecheck → test → build`

- Usa `bun install --frozen-lockfile` para instalação determinística
- Cancela runs anteriores do mesmo branch (concurrency)
- Timeout de 10 minutos
