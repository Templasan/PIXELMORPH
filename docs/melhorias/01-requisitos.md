# Requisitos da Sprint 2: situação por critério de aceite

Escopo: 7 histórias em `backlog/backlog sprint 2/` (US-01, US-10, US-12, US-16, US-17, US-30, US-33), lidas só no `user-story.md`.
Busca por grep em `photo-editor-web/src`, `video-editor-web/src` e `src/`. Nada foi executado no app.
Legenda: REAL = código de lógica encontrado; PARTIAL = parte existe, o resto não confirmado; FAKE = dado de exemplo ou no-op; MISSING = nenhuma evidência; não verificado = não checado.

| # | Critério (resumo) | RF/RNF | Classe | Evidência (arquivo) | Nota |
|---|---|---|---|---|---|
| 1 | US-01 Grade de projetos com miniatura, data e tipo | RF-001 | PARTIAL | src/app/screens/ProjectsScreen.tsx | Tela existe; miniatura e tipo não verificados |
| 2 | US-01 Painel de metadados (dimensões, bitrate, codec, histórico) | RF-037 | MISSING | busca por bitrate/codec/histórico sem resultado | Nenhum código de metadados encontrado |
| 3 | US-01 Notificação de pendências com prazo e prioridade | RF-070 | PARTIAL | src/app/screens/projects/projectFormat.ts:57 | Prioridade existe; nenhum código de notificação |
| 4 | US-01 Conta opcional; login e-mail/Google; e-mail de verificação | RNF-001 | PARTIAL | src/app/screens/LoginScreen.tsx, SignUpScreen.tsx | Telas existem; Google e verificação não verificados |
| 5 | US-01 Sincronização somente por HTTPS | RNF-002 | não verificado | - | Não checado |
| 6 | US-01 Inicialização em menos de 3 s (Android 9+) | RNF-007 | não verificado | - | Exige medição no aparelho |
| 7 | US-01 Instalação até 200 MB | RNF-014 | não verificado | - | Exige medição do build |
| 8 | US-01 Adaptação a 480x800 a 1440x3120 | RNF-015 | não verificado | - | Exige teste visual |
| 9 | US-01 Interface em pt, en, es com carga dinâmica | RNF-016 | PARTIAL | photo-editor-web/src/locales/en.ts, es.ts | Só o editor de foto; pt e carga dinâmica não verificados |
| 10 | US-10 Colagens com layouts, bordas, sombras, espaçamento | RF-011 | PARTIAL | photo-editor-web/src/domain/collage/CollageMath.ts; engine/compose (session.ts:12) | Layout existe; bordas, sombras e espaçamento não confirmados |
| 11 | US-10 Setas, círculos e formas com cor e espessura | RF-044 | PARTIAL | photo-editor-web/src/application/photoEditorStore.ts:6 (createShapeLayer) | Criação de forma existe; setas e cor/espessura não confirmados |
| 12 | US-10 Memes com texto superior/inferior, fontes, stickers | RF-046 | PARTIAL | photoEditorStore.ts:299 | Meme = duas camadas de texto; stickers não verificados |
| 13 | US-10 Texto com animações de entrada/saída e temporização | RF-008 | MISSING | photo-editor-web/src/domain/layers/Layer.ts:79 | Campos entrada/saída são só metadado; nenhum código os anima |
| 14 | US-12 Comparação antes/depois com divisor deslizante | RF-019 | REAL | photo-editor-web/src/application/session.ts:233-237 | Recorte por compareSplit; UI do divisor não verificada |
| 15 | US-12 Guias de alinhamento automáticas ao arrastar | RF-067 | PARTIAL | photo-editor-web/src/domain/geometry/snapGuides.ts | Cálculo de snap existe; desenho das guias só citado para LightPositionHandle |
| 16 | US-12 Atalhos para desfazer, refazer, salvar, trocar ferramenta | RF-076 | PARTIAL | photo-editor-web/src/ui/App.tsx:49; photoEditorStore.ts:230 | Listener de teclado e próxima ferramenta; demais atalhos não verificados |
| 17 | US-16 Transições fade, slide, zoom, wipe com prévia | RF-032 | PARTIAL | video-editor-web/src/ui/panels/TransitionPanel.tsx | Painel existe; tipos e prévia não verificados |
| 18 | US-16 Reordenar clipes por arrasto e unir com transições | RF-058 | PARTIAL | video-editor-web/src/ui/trackOrder.ts (não rastreado no git) | Ordena trilhas, não clipes; união não verificada |
| 19 | US-17 Velocidade em pontos com transições suaves | RF-049 | PARTIAL | video-editor-web/src/application/videoEditorStore.ts:9 (setClipSpeed) | Velocidade por clipe existe; rampa suave não encontrada |
| 20 | US-17 Time-lapse de fotos com velocidade, transições e trilha | RF-023 | PARTIAL | video-editor-web/src/application/session.ts:224 (addTimelapse); ui/panels/TimelapsePanel.tsx | Geração existe; trilha sonora não verificada |
| 21 | US-30 Fotos em JPEG, PNG, WebP, HEIC com qualidade | RF-057 | REAL | photo-editor-web/src/application/session.ts:37 (ExportFormat) | Formatos listados; HEIC re-codificado no Android (session.ts:36) |
| 22 | US-30 Vídeo em GIF animado com fps e cores | RF-061 | MISSING | busca por gif só acha regex de importação (adapters/dev/mediaPlugin.ts:17) | Nenhum código de exportação GIF |
| 23 | US-30 Presets de redes sociais para vídeo | RF-017 | PARTIAL | photo-editor-web/src/domain/export/exportMath.ts (SOCIAL_PRESETS) | Presets de foto existem; de vídeo não verificados |
| 24 | US-30 Tamanho reduzido ajustado à complexidade da cena | RNF-013 | PARTIAL | session.ts:3 (searchQualityForTargetSize) | Busca qualidade por tamanho alvo, não por complexidade |
| 25 | US-30 Vídeo 1 min Full HD em até 2 min | RNF-011 | não verificado | - | Exige medição no aparelho |
| 26 | US-33 Áudio gravado em faixa separada durante a captura | RF-018 | MISSING | busca por MediaRecorder/gravação sem resultado | Pasta src/app/screens/camera não lida |
| 27 | US-33 Trilha de fundo com volume, fade in/out, sincronia | RF-036 | PARTIAL | video-editor-web/src/domain/audio.ts:20-24 (fadeIn) | Fade in existe; fade out e volume não encontrados |

## Caminho mínimo para fechar a Sprint 2

1. Gravar áudio durante a captura (item 26, RF-018).
2. Exportar vídeo em GIF (item 22, RF-061).
3. Animar entrada/saída do texto na renderização (item 13, RF-008).
4. Criar notificações de projetos pendentes (item 3, RF-070).
5. Criar painel de metadados da mídia (item 2, RF-037).
6. Adicionar fade out e volume à trilha de fundo (item 27).
7. Desenhar as guias de alinhamento ao arrastar elementos (item 15).
8. Medir no aparelho os RNF não verificados (itens 5 a 8 e 25).
