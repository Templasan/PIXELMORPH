# US-01 — Central de projetos: situação

Verificado em 04/10/2026 no emulador `Pixel_7` e lendo o código. Atualizado depois das correções do mesmo dia.

## Resumo

| Critério | Status |
|---|---|
| RF-001 Grade de projetos | ✅ Funciona |
| RF-037 Propriedades e histórico | ✅ Funciona (projetos novos) |
| RF-070 Lembretes com prazo e prioridade | ✅ Funciona (banner dentro do app) |
| RNF-001 Login + 2FA | ⏸️ Fora do escopo por decisão (precisa de backend) |
| RNF-002 HTTPS na sincronização | ⏸️ Fora do escopo por decisão (precisa de backend) |
| RNF-007 Inicialização < 3 s | ✅ ~0,7 s em build release |
| RNF-014 Instalação ≤ 200 MB | ✅ APK release x86_64 de 57,9 MB |
| RNF-015 Resoluções 480x800 a 1440x3120 | ✅ Testado nas duas pontas |
| RNF-016 PT/EN/ES | ⚠️ Parcial (telas principais) |

## O que foi feito
- **RF-037:** câmera e importação RAW agora gravam tamanho do arquivo e dimensões (`probeFileMetadata` em `src/modules/device-media`). A importação da galeria já gravava.
- **RNF-016:** mecanismo de tradução em `src/core/i18n` (o texto em português é a chave; cada idioma é um arquivo carregado só quando escolhido). Seletor de idioma real na tela Conta e na tela de Login, com a escolha salva e restaurada ao abrir o app. Traduzidas: Projetos (inclusive o painel de propriedades), menu lateral, Conta, Login e Armazenamento. Testado no emulador: inglês e persistência após fechar e reabrir.
- **RNF-007 / RNF-014:** medidos com um build release. O build falhava no Windows por caminho acima de 260 caracteres (ninja). Para compilar é preciso mapear uma unidade curta, por exemplo `subst R: C:\Users\templ\Desktop\Facul\TristezaParaMobile` e rodar o Gradle em `R:\PIXELMORPH\android` (o projeto não pode ficar na raiz da unidade: o autolinking do Expo não acha o `package.json`).
- **RNF-015:** a tela de Projetos se adapta em 480x800 e 1440x3120.

## Pendências
- **Idiomas nas demais telas: marcado com `TODO(i18n)` em `src/core/i18n/i18n.ts`.** Faltam o editor de foto e de vídeo (a maior parte do texto), câmera, Comunidade, Tutoriais, Presets, Ajuda, Cadastro, conversor RAW e as duas telas de exportação. Cada uma precisa de `t('…')` nos textos e das chaves em `locales/en.ts` e `es.ts`. Decisão do usuário: pular esta etapa por enquanto.
- **Projetos antigos:** os projetos criados antes da correção (por exemplo os "Ensaio Praia 04" CR3) continuam com dimensões, tamanho e taxa de bits em "—". Só vale para projetos criados dali em diante. Taxa de bits de vídeo gravado pela câmera continua vazia, pois a câmera não informa a duração.
- **Datas** continuam no formato dd/mm/aaaa em todos os idiomas.
- **RNF-001 / RNF-002:** a interface de login e 2FA existe, mas aceita qualquer entrada (`LoginScreen.tsx` tem `TODO`). Depende de decisão sobre backend (conta local com TOTP, ou API própria).
- **RNF-007 / RNF-014:** medidos só no emulador `Pixel_7` e só no ABI x86_64. Falta confirmar em aparelho Android 9 real e com os 4 ABIs.
- **RF-070:** não existe notificação do sistema (só banner no app), pois `expo-notifications` não está no projeto.
