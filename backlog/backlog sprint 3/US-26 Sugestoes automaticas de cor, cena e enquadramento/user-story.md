# US-26 — Sugestões automáticas de cor, cena e enquadramento

**Épico:** EP-05 — IA e Automação

> Como usuário, quero receber sugestões automáticas de paleta de cores, filtros por tipo de cena e enquadramento, entregues rapidamente, para obter bons resultados sem conhecimento técnico de edição.

## Critérios de Aceite (com requisito de origem)

• A paleta de cores dominantes é extraída automaticamente, com sugestões de combinações harmônicas. [RF-010]
• O conteúdo da imagem é classificado por cena (paisagem, retrato, comida, animais, urbano), com sugestão automática de filtros e ajustes. [RF-034]
• A composição da foto é analisada e sugestões de corte são apresentadas com base em regras de composição (terços, proporção áurea, linhas de convergência). [RF-042]
• A recomendação de filtros é processada e exibida em menos de 500 ms em dispositivos medianos. [RNF-012]

## Requisitos Funcionais (RF)

- [RF-010](RF-010.md) — Paleta de cores dominantes e sugestões harmônicas
- [RF-034](RF-034.md) — Reconhecimento de cena para sugestão de ajustes
- [RF-042](RF-042.md) — Sugestão de enquadramento por composição

## Requisitos Não Funcionais (RNF)

- [RNF-012](RNF-012.md) — Latência da recomendação de filtros

## Observação do mapeamento Sprint 3

_User Story que não aparecia na sua quebra técnica original (S1-XXX) nem nos sprints 1/2 —_
_incluída na sprint 3 por ser uma das 21 User Stories da planilha ainda sem sprint atribuído._
