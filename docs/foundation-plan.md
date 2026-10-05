# Plano de Restauração da Fundação — PixelMorph

Status: proposta · Branch: `sprint-2` · Data: 2026-10-05

Objetivo: fazer a arquitetura declarada virar a arquitetura real, eliminar a causa estrutural do lag e das regressões, e **fechar a Sprint 2** no processo — sem adicionar features fora do backlog.

---

## 1. Diagnóstico

O app funciona, mas a arquitetura descrita nos docs não é a que roda.

| Evidência | Consequência |
|---|---|
| `CompositionRoot` instancia 7 módulos; as telas só usam `projects` | ~900 linhas de ports/adapters/bootstrap (`ai`, `audio`, `camera`, `export`, `video-editor`) nunca chamadas — na maioria stubs `// TODO: FFmpeg`, dependência que nem está no `package.json`. Tudo carregado no boot |
| `VideoEditorScreen` 2197 linhas / ~40 hooks · `PhotoEditorScreen` 2101 / ~55 · `ProjectsScreen` 1134 · `CameraScreen` 1072 | A camada de aplicação real vive dentro das telas: estado, regras, persistência e chamadas nativas no mesmo componente → mexer em uma parte quebra outra |
| `activeTool` (gaveta aberta) é estado da `PhotoEditorScreen`; cada gaveta é montada do zero ao abrir | Abrir gaveta re-renderiza 2100 linhas + o canvas Skia na thread JS → lag ao abrir gavetas |
| `SideDrawer` chama `getStorageUsage()` a cada abertura, que carrega na memória todo o conteúdo de `project:*`, `layers:*`, `history:*` e varre o cache | Lag no menu lateral, cresce com o nº de projetos |
| `docs/` afirma "FFmpeg ✅ COMPLETED"; `SCREEN-REFACTORING-PATTERN.md` manda as telas usarem o esqueleto | Docs mentem → pessoas e agentes constroem sobre algo que não existe |
| Prettier configurado mas não aplicado; sem `.gitattributes` | Qualquer `eslint --fix` reformata ~40 arquivos e gera diffs de fim de linha que escondem as mudanças reais |
| Sem CI | Nada impede commit que quebra `tsc`/`jest` |

**O que já está certo e serve de modelo**
- Módulo `projects`: domain/application/ports/infrastructure reais, com testes.
- `timeStore.ts`: store externo com `useSyncExternalStore`; só quem desenha o tempo se inscreve — já eliminou o re-render do editor a cada tick. É o padrão a generalizar.
- Funções puras de domínio (`timeline`, `speedRamp`, `transitions`, `homography`, `CollageMath`…) com testes.
- `ProjectPersistenceDTO` já tem `version`.
- `Slider` no UI thread com throttle e proteção contra eco; `DebouncedSaver` com retry e flush em background.

### 1.1 Core (o eixo)
Core ≈ 2900 linhas; crítico ≈ 900 (`history`, `reliability`, `Slider`, `ports`). Lido integralmente. Qualidade geral boa, com fragilidades reais:

| # | Gravidade | Onde | Problema | Correção |
|---|---|---|---|---|
| C1 | Alta | `usePersistedHistory` | `load().then(...)` sem `catch`: falha de leitura deixa `ready=false` para sempre → editor travado naquele projeto | `.catch` → sessão nova + log |
| C2 | Alta | `ErrorLogger` | Teto de 5 MB num único valor do AsyncStorage; no Android, ler valor > ~2 MB tende a falhar (`CursorWindow`) → log trava e `getStorageUsage` rejeita (Armazenamento e menu lateral quebram). `rotateToFit` é O(n²); `log()` concorrentes perdem entradas | Teto ~256 KB, rotação por contagem, escrita serializada em fila |
| C3 | Média (lag) | `getStorageUsage` | Carrega todo o conteúdo dos projetos para medir tamanho, a cada abertura do menu | Cache invalidado em salvar/apagar; `SideDrawer` com `catch` |
| C4 | Baixa | `HistoryStore` | Histórico ilimitado (RF-027) regravado inteiro a cada save; hoje só ajustes numéricos (~100 B/op) | Medir em uso; se preciso, persistir em blocos. Não cortar — RF-027 exige ilimitado |
| C5 | Arquitetura | `core/ports` | Importa `@modules/photo-editor/domain` (core depende de módulo); `LoggerPort`/`StoragePort`/`RepositoryPort` sem uso | Mover 3 portas para `photo-editor/ports`; apagar genéricas |
| C6 | Arquitetura | `core/ui/ExportSheet.tsx` | 818 linhas de feature (US-30) no core | Mover para o módulo/tela de export |

### 1.2 Relação com a Sprint 2
A Sprint 2 está semi-implementada dentro das telas instáveis. Esta restauração **é** o caminho para fechá-la.

| Tela / módulo | Histórias da Sprint 2 |
|---|---|
| Editor de vídeo | US-16 transições e multiclipes · US-17 velocidade · US-30 exportação · US-33 áudio |
| Editor de foto | US-10 composição (colagem, texto, vetores) · US-12 comparação, guias e atalhos |
| Projetos | US-01 central de projetos |

- **Critérios de aceite viram testes de caracterização.** Antes de extrair uma tela, os critérios `[RF-xxx]` das histórias dela viram testes (lógica) e roteiro 📱 (device). A tela sai extraída e a história sai verificada.
- **O que está pela metade é completado na camada nova**, não na tela velha. Entrada: `backlog/SPRINT_2_STATUS.md`.
- Ao fim de cada fase de tela, `SPRINT_2_STATUS.md` é atualizado com o que ficou verificado no device.

---

## 2. Arquitetura alvo

Hexagonal **onde há fronteira real**, telas modularizadas por cima.

```
src/core/
  state/           createStore + useStore (primitiva única de estado fora do React)
  history/ i18n/ reliability/ theme/ ui/   (shared kernel — sem feature)

src/modules/<editor>/
  domain/          funções puras e tipos — sem React, Expo, Skia
  application/     store do editor + use cases (as regras que hoje estão nas telas)
  ports/           só para o que é externo de verdade
  infrastructure/  adapters reais (módulo nativo de export, Skia, FileSystem, expo-camera)
  index.ts         API pública do módulo

src/app/screens/<editor>/
  <Editor>Screen.tsx   ~150 linhas: layout + montagem do store
  componentes pequenos; cada um lê do store só o pedaço que usa (seletor)
```

Regras:
1. **Porta só com adapter real.** Sem implementação, sem porta.
2. **Estado do editor fora do React** via `core/state` (generalização do `timeStore`). Sem dependência nova — React já tem `useSyncExternalStore`. Zustand só se isso não bastar.
3. **Tela não contém regra.** Tela chama ação do store / use case; regra vive em `application/` ou `domain/`, testável.
4. **Fronteiras verificadas pelo ESLint**, não por disciplina (§5.2).
5. **Módulos sob demanda**: `CompositionRoot` só com o que é usado, getters lazy; telas já usam `lazy()` no `RootNavigator`.
6. **Persistência versionada**: mudou formato salvo → sobe `version` + migração + teste com JSON real da versão anterior.

---

## 3. Modelo de execução

Dois níveis.

| Papel | Responsabilidade |
|---|---|
| **Opus** | Escreve a spec de cada passo, revisa o diff, faz o commit, atualiza docs. **Implementa diretamente os passos críticos** (§3.1) |
| **Haiku** | Implementa passos mecânicos e bem delimitados, roda `tsc`/`eslint`/`jest`, testa no emulador `Pixel_7`, reporta |

### 3.1 Escalonamento para qualidade maior
Um ponto é **crítico** quando um erro ali causa perda de dado, trava o app, se espalha para muitos lugares ou é difícil de detectar em teste:
- persistência e migração de formato salvo (`projects`, `layers`, `history`, presets);
- concorrência / ordem assíncrona (debounce, flush, filas, corridas de load);
- a primitiva `core/state` e qualquer coisa em `core/` com > 5 importadores;
- ponte com módulo nativo (`pixelmorph-video-export`), Skia/worklets no caminho quente de render;
- regras de fronteira do lint e configuração de CI.

Regras:
- **Opus pode, a qualquer momento, ler e editar diretamente** qualquer ponto que julgue crítico — inclusive no meio de um passo delegado, assumindo-o.
- **Haiku, ao perceber um ponto crítico não previsto na spec**, para de editar aquele trecho, não improvisa, e reporta: arquivo, linha, o risco, e o que pretendia fazer. Opus decide: assume, ajusta a spec, ou libera.
- Passos marcados 🔒 neste plano são feitos pelo Opus desde o início.

### 3.2 Contrato de cada spec para o Haiku
- Escopo: lista fechada de arquivos e o que muda; o que **não** tocar.
- Proibido: `eslint --fix .` / `prettier` global, renomear/refatorar fora do escopo, `git commit`.
- Lint só nos arquivos tocados: `npx eslint <arquivos>`.
- Verificação: `npx tsc --noEmit`, `npx eslint <arquivos>`, `npx jest` — falha pré-existente é reportada com prova (`git stash`), não corrigida.
- 📱 quando marcado: roteiro explícito, screenshots em `%TEMP%/claude/<fase>/`, `adb logcat -d` filtrado por `FATAL|ReactNativeJS.*Error`.
- Relatório: arquivos alterados, resultados, roteiro do device, pontos críticos encontrados, `git status --short`.

### 3.3 Revisão do Opus antes de cada commit
- Diff contém só o escopo (`git diff --stat` conferido).
- Nada morto deixado para trás (barrels, rotas, imports).
- Sem mock em produção (`agent-rules.md`).
- Comportamento preservado: teste de caracterização passando + 📱 quando aplicável.
- Um commit por passo, mensagem com o quê e por quê.

---

## 4. Fases

📱 = teste no emulador · 🔒 = Opus implementa · demais = Haiku com spec

### Fase 0 — Higiene e linha de base
| Passo | Quem | Justificativa |
|---|---|---|
| 0.1 `.gitattributes` (`* text=auto eol=lf`) + renormalizar | Haiku | Acaba com diffs fantasmas de CRLF/LF |
| 0.2 Commit único "format: apply prettier" em `src/` e `tests/` | Haiku | Depois disso `eslint --fix` não gera ruído; diffs de refatoração legíveis |
| 0.3 Corrigir erro de lint pré-existente em `metro.config.js` | Haiku | `eslint` limpo para servir de portão |
| 0.4 `.gitignore`: `logcat.txt`, `monkey_logs.txt`, `modules/*/android/.gradle/` | Haiku | Lixo local fora do `git status` |
| 0.5 CI GitHub Actions: `tsc`, `eslint`, `jest` em push/PR | 🔒 | Rede de segurança; ninguém mergeia código que não compila |
| 0.6 📱 Script de medição `scripts/perf/` (adb): tempo para abrir cada editor, abrir gaveta, frames janky (`dumpsys gfxinfo`) ao arrastar slider/timeline. **Sempre build release** | Haiku (spec 🔒) | Sem número antes/depois não se prova que o lag sumiu; debug exagera o lag |
| 0.7 📱 Medição base registrada neste arquivo (§7) | Haiku | Linha de base |

### Fase 1 — Remover o que é falso
| Passo | Quem | Justificativa |
|---|---|---|
| 1.1 Apagar bootstrap/ports/adapters não usados de `ai`, `audio`, `camera`, `export`, `video-editor`, mantendo funções puras usadas pelas telas (`encodeImage`, `coverFitRect`, `resizeImageCover`, `formatTimecode`…). Inclui as 2 exclusões já em stage (`src/infrastructure/config.ts`, `RemoteVideoEncoderAdapter.ts`) | Haiku | Código que finge existir e carrega no boot |
| 1.2 `CompositionRoot` só com o que é usado | Haiku | Boot leve, verdade explícita |
| 1.3 Apagar spike (`PhotoEditorSpikeScreen`, `photo-editor/spike/`, rota, botão em Account, fallback "demo photo" da `PhotoEditorScreen`) e `removeDemoProjects` | Haiku | Protótipo + caminho com dado mock em produção |
| 1.4 Docs: apagar `BACKEND-FFMPEG-SPEC.md`, `FFMPEG-INTEGRATION-GUIDE.md`, `NEXT-PHASES-ROADMAP.md`, `SCREEN-REFACTORING-PATTERN.md`, `ARCHITECTURE.md` (raiz, duplicado); reescrever `docs/architecture.md` e `docs/modules.md` conforme §2 | 🔒 | Docs são a fonte da verdade (`AGENTS.md`) |
| 1.5 📱 Smoke: abrir cada tela, editor de foto e vídeo, exportar | Haiku | Nada real foi junto |

### Fase 2 — Fundação e reforço do core
| Passo | Quem | Justificativa |
|---|---|---|
| 2.1 C1: `catch` no load do histórico | 🔒 | Editor travado = perda de acesso ao projeto |
| 2.2 C2: `ErrorLogger` com teto ~256 KB, rotação por contagem, fila de escrita | 🔒 | Concorrência + limite de storage |
| 2.3 C3: `getStorageUsage` com cache invalidado; `SideDrawer` com `catch` | Haiku (spec 🔒) | Lag do menu lateral |
| 2.4 `core/state/createStore` + `useStore(store, selector)` + testes; `timeStore` migra para ele | 🔒 | Primitiva que todos os editores vão usar |
| 2.5 C5: mover portas de presets para `photo-editor/ports`, repositórios para `photo-editor/infrastructure`; apagar portas genéricas e `src/infrastructure/` | Haiku | Core não depende de módulo |
| 2.6 Regras de fronteira no ESLint (§5.2) | 🔒 | Arquitetura não se degrada de novo |
| 2.7 Error boundary por editor, logando no `ErrorLogger` e com flush do `DebouncedSaver` | Haiku (spec 🔒) | Erro numa gaveta não derruba a tela nem perde edição |

### Fase 3 — Editor de vídeo (US-16, US-17, US-30, US-33)
Cada item um commit.
1. 📱 Medir: abrir editor, arrastar timeline, tocar.
2. Testes de caracterização a partir dos critérios de US-16/17/30/33 + comportamento que vai mudar de lugar.
3. Mover puros para `video-editor/domain/`: `Track`, `timeline`, `speedRamp`, `transitions`, `exportPlan`, `gifPlan`, `frameMath`, `freezeFrame`, `loopRange`, `orientation`, `audio`, `spherical/`.
4. 🔒 `videoEditorStore` em `application/` (tracks, seleção, playhead via `timeStore`, ferramenta ativa, histórico).
5. `timeStore` e `gifExporter` saem de `app/screens/video-editor/` para `application/`.
6. 🔒 `VideoExportPort` + adapter do módulo nativo `pixelmorph-video-export`.
7. C6: `ExportSheet` sai do core para o módulo/tela de export.
8. Quebrar `VideoEditorScreen` (Preview, Timeline, Toolbar, ClipInspector, ExportSheet), cada um assinando só seu pedaço.
9. Completar o que estiver pela metade nas histórias (conforme `SPRINT_2_STATUS.md`) na camada nova.
10. 📱 Roteiro: 2+ clipes com transição, rampa de velocidade, trilha A1 com ganho, congelar quadro, exportar MP4 e GIF. Medir de novo.
11. Atualizar `SPRINT_2_STATUS.md` e §7.

### Fase 4 — Editor de foto (US-10, US-12; lag das gavetas)
1. 📱 Medir: abrir editor, abrir cada gaveta, arrastar slider.
2. Testes de caracterização: US-10/US-12 + ajustes, camadas, histórico, salvar.
3. Mover puros para `photo-editor/domain/` (color, geometry, effects, layers, collage, panorama).
4. 🔒 `photoEditorStore`: `activeTool`, ajustes, camadas, seleção, integração com histórico.
5. Gavetas leem do store por seletor; `activeTool` sai da tela → abrir gaveta não toca no canvas.
6. 🔒 Canvas (`PhotoLayer`, `PaintLayers`) assina só o que desenha.
7. Use cases reais para ações hoje inline (salvar, exportar, aplicar preset); ports só para Skia/FileSystem/export.
8. Quebrar `PhotoEditorScreen` (TopBar, Canvas, ToolBar, DrawerHost, gavetas).
9. Apagar use cases antigos sem uso.
10. Completar US-10/US-12 na camada nova.
11. 📱 Roteiro: colagem, texto, vetor, comparar antes/depois, guias, atalhos, desfazer/refazer, fechar e reabrir projeto. Medir de novo.
12. Atualizar `SPRINT_2_STATUS.md` e §7.

### Fase 5 — Projetos (US-01) e Câmera
1. Projetos: modularizar a tela (lista, filtros, sheet de info, lembrete); caracterização de US-01.
2. Câmera: porta de captura com adapter `expo-camera`; gravação/AR fora da tela.
3. 📱 Roteiro: criar, filtrar, arquivar, apagar projeto; capturar foto e vídeo → abre no editor certo.

### Fase 6 — Fechamento
- `docs/architecture.md`, `docs/modules.md`, `FILETREE.txt` finais.
- Tabela antes/depois de performance (§7).
- `SPRINT_2_STATUS.md` final.
- Este plano marcado como concluído.

---

## 5. Extras

### 5.1 Medir em release
Debug roda JS sem otimização e com ferramentas de dev; lag em debug não prova nada. Medições sempre com `npx expo run:android --variant release`.

### 5.2 Fronteiras no ESLint (`no-restricted-imports`, sem dependência nova)
- `src/modules/X/**` não importa `src/modules/Y/**` exceto via `@modules/y` (index público).
- `**/domain/**` não importa `react`, `react-native`, `expo-*`, `@shopify/react-native-skia`.
- `src/app/**` não importa `@modules/x/infrastructure/**` nem `@modules/x/application/**` internos — só o `index.ts`.
- `src/core/**` não importa `@modules/**`.

### 5.3 Testes de caracterização antes de mover
Prender o comportamento atual antes de mexer. Ficam em `tests/` ou ao lado do arquivo puro; nunca importam arquivo com Skia (split Skia/Jest do `AGENTS.md`).

### 5.4 Persistência protegida
Toda mudança de formato salvo sobe `version` do DTO e ganha migração + teste com um JSON real da versão anterior. Projetos já salvos nos celulares não podem quebrar.

### 5.5 Error boundary por editor
Ver 2.7.

### 5.6 CI como portão
Ver 0.5.

---

## 6. Fora do escopo e riscos

Fora do escopo: features fora do backlog da Sprint 2; reconstruir `ai`/`audio` (voltam quando uma história pedir); backend, FFmpeg, IA remota.

| Risco | Mitigação |
|---|---|
| Refatoração muda comportamento sem perceber | Caracterização (5.3) + 📱 por fase |
| Projetos salvos quebram | 5.4, migrações 🔒 |
| Haiku sai do escopo (já aconteceu: `eslint --fix` global) | Contrato da spec (3.2) + Fase 0 elimina ruído + revisão (3.3) |
| Haiku julga errado um ponto delicado | Escalonamento (3.1): para e reporta; Opus assume |
| Fase longa trava a Sprint 2 | Cada fase de tela fecha as histórias daquela tela; vídeo primeiro (4 das 7) |

---

## 7. Medições

| Métrica (release, Pixel_7) | Antes | Depois |
|---|---|---|
| Cold start (ms) | 647 | |
| Abrir editor de foto — janky % / p90 ms | 60 / 133 | |
| Abrir/fechar gaveta Ajustes ×5 — janky % / p90 ms | **66,7 / 40** | |
| Arrastar slider ×5 — janky % / p90 ms | 9,3 / 28 | |
| Abrir editor de vídeo — janky % / p90 ms | 28,6 / 150 | |
| Arrastar régua da timeline ×5 — janky % / p90 ms | 20,6 / 42 | |
| Abrir/fechar menu lateral ×5 — janky % / p99 ms | 13,2 / 300 | |

Linha de base: build release de `c00f7e5` (antes de qualquer refatoração), emulador Pixel_7 x86_64, mediana de 3 execuções, `node scripts/perf/measure.mjs --label baseline`. Números de emulador servem para comparar antes/depois na mesma máquina, não como valor absoluto de celular.

---

## 8. Log de execução

Registro do que foi feito, em ordem. Cada linha = um commit (ou um passo sem commit, quando indicado).

| Data | Passo | Commit | Resultado / observações |
|---|---|---|---|
| 2026-10-05 | Plano | `c75e127` | Plano aprovado |
| 2026-10-05 | 0.1 `.gitattributes` | `0fa537b` | Índice já estava em LF; nenhum arquivo renormalizado |
| 2026-10-05 | 0.2 Prettier | `f5e33ae` | 13 arquivos reformatados; tsc/jest/eslint sem regressão |
| 2026-10-05 | 2.1 C1 (antecipado) | `daf60d7` | `catch` no load do histórico; falha vira sessão nova + log |
| 2026-10-05 | 2.2 C2 (antecipado) | `fbd95e0` | RNF-017 exige 5 MB → mantido, mas em segmentos de 256 KB; escrita serializada; migração do valor antigo; +3 testes (348 passando) |
| 2026-10-05 | 2.4 `core/state` (antecipado) | `d19349c` | `createStore` + `useStore` + `shallowEqual`; `timeStore` migrado com mesma API; 352 testes. Device: verificar playhead no smoke da Fase 1 |
| 2026-10-05 | 1.4 Docs (antecipado) | `d5b4476` | ADR-005 criado, ADR-004 superado, `architecture.md` reescrito, 5 docs obsoletos removidos. `modules.md` fica para depois da Fase 1 |
| 2026-10-05 | 0.3 tsc/eslint limpos | `54b2012` | `react-native-view-shot` apontado para o `.d.ts` compilado; `__dirname` declarado no metro; `.gitignore` de logs/perf/build nativo |
| 2026-10-05 | 0.5 CI | `c00f7e5` | GitHub Actions: tsc, eslint, jest |
| 2026-10-05 | 0.6 Script de perf | (este commit) | Versão do Haiku tinha coordenadas fixas e lia percentis de GPU no lugar dos de frame → reescrito pelo Opus (escalonamento §3.1). Elementos achados por texto/label reais da UI |
| 2026-10-05 | Build release | — | Falha no caminho do repo: limite de 260 caracteres do Windows no CMake do `safe-area-context`. `subst` não resolve (Node resolve o caminho real). Solução: worktree em `C:\pw` só para builds de medição (`git -C C:/pw checkout --detach <commit>`; `cd C:/pw/android && gradlew assembleRelease -PreactNativeArchitectures=x86_64`). Alternativa definitiva: habilitar `LongPathsEnabled` no Windows (configuração de sistema — decisão do dono da máquina). Existe uma cópia antiga em `C:\pm` (fora do git) que não foi tocada |
| 2026-10-05 | 1.1–1.3 Esqueleto, spike, demo | `54ae436` | 2170 linhas removidas; tsc decidiu o que fica. `photo-editor` tem uso real (`createPhotoEditorModule` em PresetsDrawer, BatchEditSheet, MaskPainterSheet) → fica para Fase 4 |
| 2026-10-05 | 1.3 fallback demo da foto | `9f3f2cf` | Removido o fetch de foto de banco de imagens; todas as entradas passam `projectId`. Tornar o param obrigatório fica para Fase 4 |
| 2026-10-05 | 2.5 Portas de presets | `3cab60b` | `core/ports` → `photo-editor/ports`; repositórios → `photo-editor/infrastructure`; `src/infrastructure` e alias `@infrastructure` removidos |
| 2026-10-05 | Observação | — | Lista de Projetos (release): card no canto inferior direito renderiza fragmentos de outros cards sobrepostos — possível bug de reciclagem/thumbnail. Investigar na Fase 5 |
| 2026-10-05 | **Bug crítico: mídia no cache** | `1738caa` | Achado na medição: projetos de foto abriam vazios (logcat `ENOENT`). Todas as entradas (câmera, stop-motion, galeria, RAW, colagem, panorama) gravavam no projeto o URI do **cache**, que o Android e o botão "Limpar cache" apagam. Corrigido na causa: porta `MediaFileStore` + adapter que copia para `documents/media/<projeto>/` dentro do `AddMediaAsset`; `DeleteProject` apaga a pasta; `PersistProjectMedia` repara projetos antigos uma vez por sessão (arquivos já apagados não voltam). +4 testes (356) |
| 2026-10-05 | 2.6 Fronteiras no ESLint | `0703520` | Regras ativas e testadas com violações de propósito. Achou 2 violações reais: `SideDrawer` → `app/navigation`, `ExportSheet` → `app/screens/photo-editor` (C6) |
| 2026-10-05 | 2.3 C3 | `640f88b` | Menu lateral usa medição de até 60 s (`getStorageUsageCached`); tela de Armazenamento mede na hora |
| 2026-10-05 | 2.7 Error boundary | `ea9e52f` | Cada rota dentro de `ScreenErrorBoundary` (tentar de novo / voltar, log, flush do autosave). Desce para as gavetas nas Fases 3–4 |
| 2026-10-05 | Linha de base de performance | — | Ver §7. Primeira tentativa inválida: projetos de foto apontavam para arquivos apagados (canvas vazio) e o arraste do slider começava na borda da trilha. Corrigido o script e criado projeto de foto válido pela câmera |
| 2026-10-05 | Bug crítico: mídia no cache (parte 2) | `3251306` | No device o vídeo ainda perdia o clipe: a timeline vem do histórico, que guarda `sourceUri`. Clipes/áudio/time-lapse da galeria agora copiados; `UpdateMediaAsset` persiste `workingUri` (pixels "assados"); reparo varre `project:`/`history:`/`layers:`/`editorImages:` e reescreve URIs de cache. **Verificado no emulador (release):** foto da câmera e clipe da galeria continuam abrindo depois de "Limpar cache"; 0 `ENOENT` |
| 2026-10-05 | Observação C4 | — | O histórico do editor de vídeo guarda o array inteiro de faixas em cada operação (`from`/`to`), não só números — cresce rápido. Tratar na Fase 3 (store do vídeo + histórico por diff) |
| 2026-10-05 | Observação | — | `LocalProjectRepository.delete` não remove `history:<id>`; checar se a tela de Projetos remove (importa `LocalHistoryRepository`). Fase 5 |
