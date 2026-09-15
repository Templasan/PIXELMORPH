# US-03 — Continuidade e proteção do trabalho

**Épico:** EP-01 — Projetos e Organização

> Como usuário, quero que meu histórico de edição seja ilimitado e que meu trabalho seja salvo e recuperado automaticamente mesmo após falhas, para nunca perder uma edição em andamento.

## Critérios de Aceite (com requisito de origem)

• Desfazer/refazer funciona sem limite de quantidade e é preservado entre sessões, até a exclusão do projeto. [RF-027]
• Rascunhos são salvos automaticamente a cada alteração significativa, sem interromper perceptivelmente o fluxo de edição. [RNF-005]
• Backups automáticos em pasta segura e verificação de integridade permitem recuperar projetos corrompidos. [RNF-006]
• Erros são registrados localmente (limite de 5 MB, com rotação) e enviados anonimamente ao desenvolvedor, sem interromper a experiência do usuário. [RNF-017]

## Requisitos Funcionais (RF)

- [RF-027](RF-027.md) — Histórico infinito de desfazer e refazer

## Requisitos Não Funcionais (RNF)

- [RNF-005](RNF-005.md) — Salvamento automático de rascunhos
- [RNF-006](RNF-006.md) — Recuperação de projetos corrompidos
- [RNF-017](RNF-017.md) — Registro e envio de logs de erro

## Tarefas técnicas da Sprint 1 relacionadas

_Pastas técnicas que existiam antes de colapsar por User Story:_

- S1-003 Storage
- S1-005 History
- S1-050 Save
- S1-051 Load
