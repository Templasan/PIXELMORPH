# Funcionalidades faltantes — Sprint 1

Verificação de cada user story da Sprint 1, feita em 04/10/2026 no emulador `Pixel_7` (build debug) e lendo o código.

| US | Tema | Situação | Principal pendência |
|---|---|---|---|
| [US-01](US-01-central-de-projetos.md) | Central de projetos | ⚠️ | Login/2FA só interface, sem i18n, sem HTTPS/sync, metadados vazios em alguns projetos |
| [US-03](US-03-continuidade-e-protecao.md) | Continuidade e proteção | ⚠️ | Backup sem pasta segura, envio de logs vazio, tela Armazenamento com valores fixos |
| [US-04](US-04-ajustes-de-cor-e-tonalidade.md) | Ajustes de cor | ✅ | Cor seletiva sem controle de "dessaturar o resto" |
| [US-05](US-05-correcoes-geometricas.md) | Geometria | ⚠️ | Rotação de vídeo não existe |
| [US-08](US-08-camadas-nao-destrutiva.md) | Camadas | ⚠️ | Duplicar/mesclar só pintura, pincéis sem forma/pressão, contagem de traços não atualiza |
| [US-09](US-09-efeitos-e-overlays.md) | Efeitos e overlays | ⚠️ | Overlay da galeria desativado (mensagem desatualizada) |
| [US-11](US-11-importacao-raw.md) | RAW | ⚠️ | Só usa a prévia JPEG embutida, sem decodificação real |
| [US-14](US-14-timeline-multifaixa.md) | Timeline multifaixa | ⚠️ | Prévia não toca vídeo (miniatura estática) |
| [US-15](US-15-edicao-de-precisao.md) | Edição de precisão | ⚠️ | Remover objetos não existe, sem prévia do quadro |
| [US-16](US-16-transicoes-e-montagem.md) | Transições e montagem | ⚠️ | Não dá para unir/exportar os clipes |
| [US-30](US-30-exportacao.md) | Exportação | ⚠️ | Sem exportação de vídeo, GIF e HEIC |

## Bloqueios que atravessam várias histórias
- **Sem player de vídeo** (US-14, US-15, US-16): só há `expo-video-thumbnails`.
- **Sem codificador de vídeo / FFmpeg** (US-16, US-30): `FFmpegVideoExportAdapter` é um stub.
- **Sem backend** (US-01, US-03): login, 2FA, sincronização HTTPS e envio de logs dependem dele.
- **Sem i18n** (US-01): o app está só em português.
