# US-25 — Efeitos de retrato e correção facial automática

**Épico:** EP-05 — IA e Automação

> Como usuário, quero que o app detecte rostos e profundidade de cena para aplicar efeitos de retrato e corrigir imperfeições automaticamente, com todo o processamento feito localmente no dispositivo para preservar minha privacidade.

## Critérios de Aceite (com requisito de origem)

• Filtros que reagem à cena, como desfoque de fundo baseado em profundidade, podem ser aplicados. [RF-012]
• Múltiplos rostos são detectados individualmente, permitindo ajustar suavização de pele, realce de olhos e tom por rosto. [RF-016]
• Olhos vermelhos e imperfeições de pele são detectados e corrigidos automaticamente. [RF-025]
• Toda a detecção facial e correção de imperfeições ocorre localmente no dispositivo, sem envio de imagens a servidores. [RNF-004]

## Requisitos Funcionais (RF)

- [RF-012](RF-012.md) — Filtros dinâmicos por conteúdo da cena
- [RF-016](RF-016.md) — Detecção facial com efeitos por rosto
- [RF-025](RF-025.md) — Correção de olhos vermelhos e imperfeições de pele

## Requisitos Não Funcionais (RNF)

- [RNF-004](RNF-004.md) — Processamento local de dados biométricos

## Observação do mapeamento Sprint 3

_User Story que não aparecia na sua quebra técnica original (S1-XXX) nem nos sprints 1/2 —_
_incluída na sprint 3 por ser uma das 21 User Stories da planilha ainda sem sprint atribuído._
