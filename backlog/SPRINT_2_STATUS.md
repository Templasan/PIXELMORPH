# Situação da Sprint 2 — Verificação de Funcionalidades

Testado em 05/10/2026 no emulador `Pixel_7` (build dev, x86_64). Análise baseada em:
- Testes do app (editor de vídeo, exportação, timeline)
- Leitura do código (foto, áudio, guias)
- Requisitos do user-story.md de cada US

---

## US-01 — Central de projetos

| RF/RNF | Critério | Status | Notas |
|---|---|---|---|
| **RF-001** | Grade de projetos em miniatura | ✅ | Funciona; thumbnails automáticas com data e tipo |
| **RF-037** | Propriedades e metadados | ✅ | Mostra dimensões, taxa de bits (Sprint 1) |
| **RF-070** | Notificações de pendências | ❌ | Só banner no-app; falta notificação do sistema (expo-notifications não integrado) |
| **RNF-001** | Login + 2FA | ⏸️ | Interface existe, aceita qualquer entrada (fora do escopo, sem backend) |
| **RNF-002** | HTTPS na sincronização | ⏸️ | Fora do escopo, sem backend |
| **RNF-007** | Inicialização < 3 s | ⚠️ | ~35-45 s no emulador com Metro; ~0.7 s em release (Sprint 1 mediu) |
| **RNF-014** | Instalação ≤ 200 MB | ✅ | ~57.9 MB APK release x86_64 (Sprint 1) |
| **RNF-015** | Resoluções 480x800 a 1440x3120 | ✅ | Testado (Sprint 1) |
| **RNF-016** | PT/EN/ES | ⚠️ | Só nas telas principais; faltam editor de foto/vídeo e câmera |

**Resumo US-01:** ⚠️ Parcial (RF-070 não, RNF-001/002 fora de escopo, RNF-007 lento no dev, RNF-016 parcial)

---

## US-10 — Composição gráfica (colagens, textos, vetores)

| RF | Critério | Status | Notas |
|---|---|---|---|
| **RF-011** | Colagens com layouts | ❌ | Não implementado; sem UI no editor de foto |
| **RF-044** | Formas vetoriais (setas, círculos) | ❌ | Não implementado |
| **RF-046** | Criação de memes | ❌ | Não implementado |
| **RF-008** | Texto sobreposto com estilos/animações | ❌ | Não implementado; marcado como TODO em `VideoEditorScreen.tsx` |

**Resumo US-10:** ❌ Não implementada

---

## US-12 — Comparação e guias

| RF | Critério | Status | Notas |
|---|---|---|---|
| **RF-019** | Comparação antes/depois (divisor deslizante) | ❌ | Não implementado |
| **RF-067** | Guias de alinhamento magnético | ❌ | Não implementado |
| **RF-076** | Atalhos de teclado virtual | ❌ | Não implementado |

**Resumo US-12:** ❌ Não implementada

---

## US-16 — Transições e montagem de clipes

| RF | Critério | Status | Notas |
|---|---|---|---|
| **RF-032** | Transições (fade, slide, zoom, wipe) com duração e prévia | ✅ | **Completo na Sprint 1**; testado com vídeo vermelho/azul, cores interpoladas corretamente |
| **RF-058** | Reordenar clipes e unir em um vídeo | ⚠️ | Arrasto funciona; múltiplos clipes exportam com transições (RF-032). Falta testar reordenação no export. |

**Resumo US-16:** ✅ Funciona (transições implementadas; reordenação parcial)

---

## US-17 — Controle de velocidade

| RF | Critério | Status | Notas |
|---|---|---|---|
| **RF-049** | Câmera lenta/aceleração de trechos | ✅ | **Completo na Sprint 1**; seletor de velocidade funciona (0.25x a 4x) |
| **RF-023** | Time-lapse a partir de sequência de fotos | ✅ | **Completo na Sprint 1**; função `buildTimelapseTrack` reutiliza o mesmo modelo Track/Clip |

**Resumo US-17:** ✅ Funciona

---

## US-30 — Exportação em múltiplos formatos

| RF/RNF | Critério | Status | Notas |
|---|---|---|---|
| **RF-057** | Foto em JPEG, PNG, WebP e HEIC | ⚠️ | JPEG ✅, PNG ✅, WebP ✅; HEIC ❌ (Android API < 34, TODO) |
| **RF-061** | Vídeo em GIF animado | ✅ | **Completo na Sprint 1**; testado, 37 frames em 39 s (lento no dev) |
| **RF-017** | Presets de rede social (vídeo) | ✅ | **Completo na Sprint 1**; Instagram, TikTok, YouTube, WhatsApp, etc. |
| **RNF-013** | Compressão inteligente | ✅ | **Completo na Sprint 1** (foto); vídeo usa bitrate fixo por preset |
| **RNF-011** | 1 min Full HD em até 2 min | ⚠️ | Só testado 9 s em 720p (5.1 s no emulador); falta Full HD em aparelho real |

**Resumo US-30:** ⚠️ Funciona (sem HEIC, RNF-011 não validado)

---

## US-33 — Captura e trilha de áudio

| RF | Critério | Status | Notas |
|---|---|---|---|
| **RF-018** | Gravação de áudio durante captura de vídeo | ❌ | Não implementado; câmera não grava áudio separado |
| **RF-036** | Trilha de áudio de fundo (volume, fade, sincronização) | ⚠️ | Seletor de faixa A1 existe; falta UI de importação e controles de volume/fade |

**Resumo US-33:** ❌ Não implementada

---

## Resumo por Status

| Status | Contagem | US |
|---|---|---|
| ✅ **Completo** | 2 | US-16 (parcial), US-17 |
| ⚠️ **Parcial** | 3 | US-01 (falta RF-070, RNF fora de escopo), US-30 (sem HEIC), (US-16 reordenação) |
| ❌ **Não implementado** | 2 | US-10, US-12, US-33 |

---

## Bloqueadores para Sprint 2

1. **US-10, US-12**: Requerem expansão significativa do editor de foto (não começou)
2. **US-33**: Requer captura de áudio no módulo de câmera (não começou)
3. **RNF-001/002** (US-01): Sem backend, decisão de escopo
4. **RF-070** (US-01): Requer `expo-notifications`
