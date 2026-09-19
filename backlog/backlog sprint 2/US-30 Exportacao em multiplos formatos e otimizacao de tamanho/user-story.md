# US-30 — Exportação em múltiplos formatos e otimização de tamanho

**Épico:** EP-06 — Exportação

> Como usuário, quero exportar minhas fotos e vídeos em diferentes formatos e presets, com arquivos otimizados e exportação rápida, para compartilhar meu conteúdo com qualidade e agilidade.

## Critérios de Aceite (com requisito de origem)

• Fotos podem ser exportadas em JPEG, PNG, WebP e HEIC, com controle de qualidade e compressão por formato. [RF-057]
• Vídeos podem ser exportados como GIF animado, com controle de taxa de quadros e número de cores. [RF-061]
• Vídeos podem ser exportados com presets por rede social, ajustando resolução, taxa de bits e compressão automaticamente. [RF-017]
• O tamanho do arquivo exportado é reduzido com perda mínima de qualidade, ajustando a compressão à complexidade da cena. [RNF-013]
• A exportação de um vídeo de 1 minuto em Full HD leva no máximo 2 minutos em dispositivos mid-range. [RNF-011]

## Requisitos Funcionais (RF)

- [RF-057](RF-057.md) — Exportação de imagens em múltiplos formatos
- [RF-061](RF-061.md) — Exportação em GIF animado
- [RF-017](RF-017.md) — Exportação de vídeo com presets de redes sociais

## Requisitos Não Funcionais (RNF)

- [RNF-013](RNF-013.md) — Compressão inteligente de arquivos
- [RNF-011](RNF-011.md) — Tempo de exportação de vídeo

## Tarefas técnicas da Sprint 2 relacionadas

- S1-062 Export Progress

_Nota: US-03 e US-08 ficaram de fora deste sprint por já terem pasta própria em_
_`backlog sprint 1` (S1-052 Autosave, S1-053 Persistent Undo/Redo -> US-03; S1-017 Layer UI -> US-08)._
