# Instruções para o agente: servidor de mídia no notebook

Objetivo: deixar o `media-server/` do PixelMorph rodando no notebook do dono, exposto por HTTPS com o ngrok, para o app sincronizar fotos e vídeos entre celulares. Leia `media-server/README.md` antes de começar.

## Regras (não quebrar)

- **Nunca** escreva senha, token do ngrok, chave `service_role` ou o e-mail do dono em arquivo versionado, em log ou em mensagem de commit. Eles ficam só em variáveis de ambiente ou num arquivo `.env.local` que está no `.gitignore`.
- **Nunca** crie conta (ngrok, Supabase, GitHub). Se faltar conta ou login, pare e peça ao dono que entre sozinho.
- **Não mude configurações do Windows** (energia, firewall, inicialização) sem o dono confirmar cada uma.
- Não use `ALLOW_ANY_CONFIRMED_USER=1`. O servidor sempre começa com `ALLOWED_EMAILS`, porque qualquer pessoa pode se cadastrar no Supabase e o ngrok expõe o servidor à internet.
- Só a chave **publishable** do Supabase é usada aqui.
- Não altere o código do app nem do servidor. Se algo parecer exigir mudança, relate ao dono.
- Responda ao dono em português.

## 1. Pré-requisitos (verifique e reporte o que faltar)

- Git e Node.js 22 ou mais novo (`node -v`). O servidor não tem dependências: **não precisa de `npm install`**.
- ngrok instalado (`ngrok version`). Se não estiver, diga ao dono para instalar pelo site oficial ou pela loja do Windows, e pare até ele confirmar.
- Conta ngrok com o authtoken já configurado (`ngrok config check`). Se não estiver, peça ao dono para rodar `ngrok config add-authtoken <token dele>` no próprio terminal.

## 2. Clonar o projeto

```bash
git clone https://github.com/Templasan/PIXELMORPH.git
cd PIXELMORPH
git switch main
```

Só a pasta `media-server/` é usada neste notebook.

## 3. Dados do servidor

Pergunte ao dono:

1. O **e-mail da conta** que pode usar o servidor (vai em `ALLOWED_EMAILS`; vários separados por vírgula).
2. Em qual pasta guardar os arquivos (`DATA_DIR`) e quanto espaço livre existe no disco. Sugira uma pasta fora do repositório, por exemplo `C:\pixelmorph-data`.

Valores públicos que o servidor precisa (estão em `src/core/infrastructure/config.ts`, campos `supabaseUrl` e `supabaseKey`):

- `SUPABASE_URL`
- `SUPABASE_KEY` (a chave publishable, que começa com `sb_publishable_`)

Defina também um limite por usuário compatível com o disco: `MAX_USER_BYTES` (em bytes; o padrão é 20 GiB).

## 4. Iniciar e testar localmente

No PowerShell, na pasta `media-server`:

```powershell
$env:ALLOWED_EMAILS = "<e-mail do dono>"
$env:SUPABASE_URL   = "<supabaseUrl do config.ts>"
$env:SUPABASE_KEY   = "<supabaseKey do config.ts>"
$env:DATA_DIR       = "C:\pixelmorph-data"
$env:MAX_USER_BYTES = "<bytes>"
npm test
npm start
```

- `npm test` deve passar.
- Em outro terminal: `curl http://127.0.0.1:3000/health` deve responder com sucesso.
- O servidor escuta só em `127.0.0.1`. Isso é o esperado: o ngrok conecta por localhost, então não é preciso mudar nada nem abrir o firewall.

## 5. Expor com o ngrok

Peça ao dono o **domínio fixo** gratuito dele (painel do ngrok, em Domains). Com ele o endereço não muda ao reiniciar, e não é preciso recompilar o APK.

```bash
ngrok http --url=<dominio-fixo>.ngrok-free.app 3000
```

Se o dono não tiver domínio fixo, use `ngrok http 3000` e avise que o endereço muda a cada reinício.

Teste de fora do notebook, por exemplo no navegador do celular dele, em dados móveis:

```bash
curl https://<dominio>/health
curl -i https://<dominio>/files/x/y        # sem login: deve dar 401, nunca 200
```

## 6. Deixar "no esquema"

Depois de funcionar, proponha ao dono (e só faça o que ele aprovar):

1. Um script `iniciar-servidor.ps1` **fora do repositório** (por exemplo na área de trabalho) que define as variáveis, inicia o `npm start` e o `ngrok` em duas janelas. As variáveis ficam no script local, nunca no git.
2. Impedir que o Windows suspenda com o notebook na tomada e não fazer nada ao fechar a tampa. Diga o caminho nas configurações, e quem altera é o dono.
3. Um lembrete para copiar a pasta `DATA_DIR` de vez em quando (não há backup automático).

## 7. O que reportar no final

- Versões de Node e ngrok.
- Se `npm test` passou.
- O endereço HTTPS final e se ele é fixo.
- O resultado do teste de fora (`/health` com 200 e `/files` sem login com 401).
- O que o dono ainda precisa fazer.

## Lado do app (não faça no notebook)

Para o celular usar o servidor, o APK precisa ser compilado com `EXPO_PUBLIC_MEDIA_SERVER_URL=https://<dominio>`. Isso é feito no computador de desenvolvimento, depois que o endereço existir. Sem essa variável o app aponta para `http://localhost:3000`.

## Limites conhecidos

- Não há limite de tempo nas conexões do app: com internet muito lenta a sincronização pode ficar "enviando" por minutos.
- Sem upload retomável: um vídeo grande que cair no meio recomeça do zero.
- Um erro do ngrok com o notebook desligado pode aparecer no app como "N arquivos não enviados" em vez de "servidor desligado".
