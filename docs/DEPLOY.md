# Colocar o Encorpei Cardio no ar

Passo a passo literal. Não precisa saber programar — precisa clicar nos lugares certos.

---

## Parte 1 — Enviar o código para o GitHub

Já existe um repositório criado:
`https://github.com/carlaobh20/Encorpei-Saude-Ultimaversao`

Na pasta do projeto existe o arquivo **`SUBIR-PARA-O-GITHUB.bat`**.

1. Abra a pasta `C:\MEUS PROJETOS\Saude-Cardio`.
2. Dê **dois cliques** em `SUBIR-PARA-O-GITHUB.bat`.
3. Se abrir uma janela do navegador pedindo login do GitHub, entre e clique em **Authorize**.
4. Espere aparecer "Pronto. O código está no GitHub."

Se disser que o **Git não está instalado**: baixe em `https://git-scm.com/download/win`,
instale com as opções padrão (só ir clicando em *Next*), feche a janela preta e rode o
arquivo de novo.

Se o envio falhar dizendo que o repositório já tem arquivos, digite na mesma janela:

```
git push -u origin main --force
```

---

## Parte 2 — Criar o banco no Supabase

O app roda em **modo demonstração** sem banco nenhum — dá para ver todas as telas.
Para funcionar de verdade (login, dados salvos), precisa do banco.

1. Entre em `https://supabase.com` e clique em **New project**.
2. Nome: `encorpei-cardio`. Região: **South America (São Paulo)**. Guarde a senha do banco.
3. Espere terminar de criar (uns 2 minutos).
4. No menu da esquerda, clique em **SQL Editor** → **New query**.
5. Abra o arquivo `supabase/migrations/20260909000000_cardio_baseline.sql` no Bloco de Notas,
   **copie tudo**, cole no SQL Editor e clique em **Run**.
6. Repita com o arquivo `supabase/migrations/20260910000000_engajamento.sql`.
   **A ordem importa**: primeiro o baseline, depois o engajamento.
7. No menu da esquerda, vá em **Project Settings** → **API** e anote:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public** (uma chave longa)

---

## Parte 3 — Publicar na Vercel

1. Entre em `https://vercel.com` e faça login **com a conta do GitHub**.
2. Clique em **Add New** → **Project**.
3. Encontre `Encorpei-Saude-Ultimaversao` na lista e clique em **Import**.
4. A Vercel reconhece o Vite sozinho. Não mexa em *Build Command* nem em *Output Directory*.
5. Antes de clicar em Deploy, abra **Environment Variables** e adicione:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | a Project URL do Supabase |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | a chave **anon public** |
   | `VITE_APP_VERSION` | `1.0.0` |

6. Clique em **Deploy** e espere (~2 minutos).
7. A Vercel te dá um endereço tipo `encorpei-saude-ultimaversao.vercel.app`.

---

## Parte 4 — Ajustar o Supabase para o endereço novo

1. No Supabase, vá em **Authentication** → **URL Configuration**.
2. Em **Site URL**, coloque o endereço da Vercel (`https://...vercel.app`).
3. Em **Redirect URLs**, adicione o mesmo endereço com `/auth` no final e também `/reset-password`.

Sem isso, o e-mail de confirmação de cadastro leva o usuário para o lugar errado.

---

## Parte 5 — Fechar a segurança (antes de qualquer paciente real)

No arquivo `vercel.json`, a linha de segurança (`Content-Security-Policy`) está com
`https://*.supabase.co`, que aceita qualquer projeto Supabase. Depois que o projeto real
existir, troque os dois `*` pelo endereço do seu projeto — fica mais restrito e mais seguro.

---

## O que dá para testar sem nada configurado

Abra o endereço da Vercel e clique em **Ver demonstração** na página inicial:

- **Como médico** → cai no painel com 6 pacientes fictícios, fila de risco, alertas.
- **Como paciente** → cai no app do Antônio, com a Idade do Coração caindo de 79 para 74,
  a curva de capacidade subindo e os remédios do dia.

Nada é salvo no modo demonstração — é seguro mostrar para qualquer pessoa.
