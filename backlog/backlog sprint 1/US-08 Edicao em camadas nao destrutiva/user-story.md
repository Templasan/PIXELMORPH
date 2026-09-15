# US-08 — Edição em camadas não destrutiva

**Épico:** EP-02 — Edição de Foto

> Como editor de fotos, quero trabalhar com camadas separadas e reversíveis, incluindo pintura digital, sem que isso comprometa o desempenho do dispositivo, para editar com liberdade e segurança.

## Critérios de Aceite (com requisito de origem)

• Toda alteração é aplicada como camada distinta e reversível, sem perda da imagem original. [RF-002]
• É possível duplicar camadas, mesclar camadas visíveis e ocultar camadas individuais em interface hierárquica. [RF-052]
• É possível desenhar em camadas separadas com pincéis de diferentes formas/opacidades e suporte a caneta stylus. [RF-033]
• O consumo de RAM não ultrapassa 800 MB durante a edição de fotos de até 24 megapixels, mesmo com múltiplas camadas. [RNF-008]

## Requisitos Funcionais (RF)

- [RF-002](RF-002.md) — Editor de fotos não destrutivo
- [RF-052](RF-052.md) — Gerenciamento de camadas
- [RF-033](RF-033.md) — Pintura digital em camadas

## Requisitos Não Funcionais (RNF)

- [RNF-008](RNF-008.md) — Consumo de memória em edição de fotos

## Tarefas técnicas da Sprint 1 relacionadas

_Pastas técnicas que existiam antes de colapsar por User Story:_

- S1-010 Photo Shell
- S1-011 Renderer
- S1-016 Layers
