# Encorpei Pulseira 0.4.0

O Android instala pelo arquivo desta release. O iPhone não tem arquivo pronto: quem tem um Mac assina o projeto e instala no aparelho.

O app é outra entrada da mesma conta do site. Depois de entrar, a barra de baixo abre Hoje, Evolução, Registrar, Meu médico e Pulseira. Dá para criar a conta, confirmar o e-mail, entrar, recuperar a senha, registrar pressão, peso, como se sente, batimentos, oxigenação e glicemia, escrever para o médico, gravar os batimentos da pulseira e importar um CSV com sono, oxigenação, passos, calorias e pressão. Sono, oxigenação, passos e pressão da pulseira não chegam por Bluetooth: entram pelo arquivo.

## Android

O arquivo `pulseira-android-v0.4.0-debug.apk` é um APK de depuração. A assinatura é a chave de debug, porque ainda não existe chave de release. O celular precisa de Android 8 ou mais novo, com Bluetooth de baixa energia.

1. Baixe o APK desta release no celular, ou passe o arquivo para ele.
2. Abra o APK. Se o sistema pedir permissão para instalar apps desconhecidos, permita só para o app que baixou o arquivo (Chrome, Arquivos ou o gerenciador que você usou).
3. Confirme a instalação. O nome na gaveta é **Encorpei Pulseira**.
4. Na primeira abertura, aceite Bluetooth e, se o sistema pedir, as notificações. A notificação mantém a pulseira ligada com a tela fechada.
5. Crie a conta ou entre com o e-mail e a senha do site. Para achar a pulseira, toque em **Conectar aparelho** e deixe-a perto do celular.

Se o e-mail de confirmação ou de nova senha não abrir o app, copie o link e cole no campo de e-mail da tela de entrada.

Fechar a tela não corta o Bluetooth. Encerrar o app à força, ou reiniciar o celular, desliga a pulseira. Abra de novo e conecte outra vez.

## iPhone, pelo Mac

Este guia é para quem tem um Mac e vai assinar o app com a própria conta Apple. Não é um arquivo da App Store e não há IPA nesta release. O simulador do Xcode não fala com a pulseira: use um iPhone de verdade, com iOS 17 ou mais novo.

A pasta precisa chegar inteira no Mac, com `Pulseira.xcodeproj` e a pasta `Pulseira` lado a lado.

### 1. Abrir o projeto

1. Instale o Xcode pela App Store, se ainda não tiver, e abra-o uma vez para aceitar a licença.
2. Dê dois cliques em `Pulseira.xcodeproj`.
3. Se o Xcode pedir para atualizar o projeto, aceite.

### 2. Entrar com o Apple ID

1. No Xcode, abra **Settings…** (ou **Preferences…**) e vá em **Accounts**.
2. Clique em **+** e escolha **Apple ID**.
3. Entre com o e-mail e a senha da conta Apple. Uma conta gratuita serve para instalar no próprio iPhone.

### 3. Escolher o time de assinatura

1. No painel da esquerda, clique no projeto **Pulseira** (o ícone azul).
2. Em **TARGETS**, selecione **Pulseira**.
3. Abra a aba **Signing & Capabilities**.
4. Marque **Automatically manage signing**.
5. Em **Team**, escolha o seu nome (Personal Team).

Se o Xcode disser que o identificador `saude.encorpei.pulseira` não pode ser registrado, mude só o **Bundle Identifier** para um texto único seu, por exemplo `saude.encorpei.pulseira.seunome`. Não mude mais nada nessa tela.

### 4. Preparar o iPhone

1. Ligue o iPhone e conecte-o ao Mac com o cabo. Desbloqueie a tela.
2. Se o iPhone perguntar se confia neste computador, toque em **Confiar** e digite o código.
3. No iPhone, abra **Ajustes → Privacidade e Segurança → Modo de desenvolvedor** e ligue. Se pedir, reinicie o aparelho e confirme.
4. No Xcode, na barra de cima, ao lado do botão de play, escolha o seu iPhone. Não escolha um simulador.

### 5. Compilar e instalar

1. No menu, **Product → Run** (ou ⌘R).
2. Espere o Xcode terminar. O app abre no iPhone com o nome **Encorpei Pulseira**.
3. Na primeira abertura, o iPhone pode bloquear o app. Vá em **Ajustes → Geral → VPN e gerenciamento do dispositivo**, toque no seu e-mail de desenvolvedor e escolha **Confiar**.
4. Abra o app de novo e permita o Bluetooth quando ele pedir.

Para gerar um arquivo no Mac, use **Product → Archive**. Quando o Organizer abrir, **Distribute App → Debugging** (ou Development) e exporte. Esse arquivo ainda precisa da sua assinatura e do aparelho registrado. Para o dia a dia, **Run** já instala.

Fechar a tela não derruba o Bluetooth, desde que o app não seja encerrado à força. Conta Apple gratuita: a instalação vale cerca de 7 dias. Depois disso, conecte o iPhone de novo e dê **Run** outra vez. Reiniciar o iPhone, ou apagar o app da lista de apps recentes, desliga a conexão. Abra o app e toque em conectar de novo.
