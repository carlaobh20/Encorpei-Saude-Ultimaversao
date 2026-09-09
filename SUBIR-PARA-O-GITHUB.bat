@echo off
chcp 65001 >nul
setlocal

echo.
echo  ============================================
echo   ENCORPEI CARDIO - enviar para o GitHub
echo  ============================================
echo.

cd /d "%~dp0"

git --version >nul 2>&1
if errorlevel 1 (
  echo  [X] O Git nao esta instalado neste computador.
  echo.
  echo      Baixe em: https://git-scm.com/download/win
  echo      Instale com as opcoes padrao, feche esta janela
  echo      e rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)

if not exist ".git" (
  echo  [1/6] Preparando o repositorio local...
  git init >nul
) else (
  echo  [1/6] Repositorio local ja existe, seguindo...
)

echo  [2/6] Definindo a branch principal como main...
git branch -M main >nul 2>&1

echo  [3/6] Apontando para o GitHub...
git remote remove origin >nul 2>&1
git remote add origin https://github.com/carlaobh20/Encorpei-Saude-Ultimaversao.git

echo  [4/6] Selecionando os arquivos...
git add -A

echo  [5/6] Gravando a versao...
git commit -m "Encorpei Cardio - app do paciente, painel do cardiologista e camada de engajamento" >nul 2>&1
if errorlevel 1 (
  echo        Nada novo para gravar - seguindo para o envio.
)

echo  [6/6] Enviando para o GitHub...
echo.
echo        Se abrir uma janela do navegador pedindo login,
echo        entre com a sua conta do GitHub e autorize.
echo.
git push -u origin main
if errorlevel 1 (
  echo.
  echo  [X] O envio falhou.
  echo.
  echo      Causa mais comum: o repositorio ja tem algum arquivo
  echo      ^(README criado pelo GitHub^). Nesse caso rode:
  echo.
  echo          git push -u origin main --force
  echo.
  echo      Copie a linha acima, cole aqui e aperte Enter.
  echo.
  pause
  exit /b 1
)

echo.
echo  ============================================
echo   Pronto. O codigo esta no GitHub.
echo   https://github.com/carlaobh20/Encorpei-Saude-Ultimaversao
echo  ============================================
echo.
pause
