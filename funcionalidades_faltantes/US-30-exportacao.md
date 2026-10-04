# US-30 — Exportação em múltiplos formatos e otimização: o que falta

Verificação feita em 04/10/2026 no emulador `Pixel_7` (tela de exportação do vídeo) e lendo o código (`ExportSheet.tsx`, `src/modules/export`). A exportação de foto foi usada em sessões anteriores.

## Resumo

| Critério | Status |
|---|---|
| RF-057 Foto em JPEG, PNG, WebP e HEIC | ⚠️ Parcial (sem HEIC) |
| RF-061 Vídeo em GIF animado | ❌ Não existe |
| RF-017 Vídeo com presets de redes sociais | ❌ Só para foto |
| RNF-013 Compressão inteligente | ✅ Funciona (só foto) |
| RNF-011 Vídeo de 1 min em Full HD em até 2 min | ❌ Sem exportação de vídeo |

## O que está funcionando
- Exportação de foto em JPEG, PNG e WebP com o codificador do Skia, controle de qualidade e tamanhos predefinidos (`SIZE_PRESETS`).
- "Compressão inteligente" faz uma busca binária real pela menor qualidade que cabe no tamanho alvo (`imageExport.ts`).
- Presets de redes sociais (`SOCIAL_PRESETS`) redimensionam e cortam a foto na resolução da rede.

## Pendências
- **Exportação de vídeo indisponível.** Abri "Trilha Serra" e toquei em EXPORTAR: a tela mostra "Exportação de vídeo indisponível — … exige um codificador nativo (classe FFmpeg) que não está incluído neste build Expo gerenciado". `FFmpegVideoExportAdapter.ts` é um stub (`// TODO: Use FFmpeg to encode and save`). Isso bloqueia RF-017, RF-061, RNF-011 e a união de clipes da US-16.
- **HEIC não é suportado** (`UNSUPPORTED_IMAGE_FORMATS = ['HEIC']` em `exportMath.ts`). Fazer: avaliar um módulo nativo ou deixar o formato claramente fora do escopo.
- **GIF animado não existe** (o tipo `ExportFormat` lista 'gif', mas nada o produz).
- **Presets de rede social só funcionam para foto.** O critério pede presets para vídeo, ajustando resolução, bitrate e compressão.
- **Adapters antigos são stubs:** `ExpoImageExportAdapter` (`// TODO: Use expo-file-system to save`) e `ExpoShareAdapter` (`// TODO: Use expo-sharing`). A exportação de foto usa o caminho próprio de `ExportSheet`, mas esses adapters ficaram sem implementação.
- **RNF-011** não pode ser medido enquanto não houver exportação de vídeo.
