# US-01 — Central de projetos

**Épico:** EP-01 — Projetos e Organização

> Como usuário do PixelMorph, quero acessar uma tela inicial com meus projetos organizados em grade, metadados detalhados e lembretes de pendências, para gerenciar meu trabalho de forma rápida e segura em qualquer dispositivo.

## Critérios de Aceite (com requisito de origem)

• A tela principal exibe todos os projetos em grade, com miniatura automática, data de modificação e tipo de mídia. [RF-001]
• O painel de propriedades mostra dimensões, taxa de bits, codificação e histórico de edições de cada mídia. [RF-037]
• Notificações lembram o usuário de projetos pendentes, com prazo e prioridade configuráveis. [RF-070]
• O acesso à conta e aos projetos salvos exige e-mail/senha e verificação em duas etapas (SMS ou app autenticador). [RNF-001]
• Toda sincronização de projetos com o servidor usa HTTPS com certificado válido. [RNF-002]
• O app inicializa em menos de 3 segundos em dispositivos Android 9 ou superior. [RNF-007]
• A instalação inicial ocupa no máximo 200 MB, com recursos extras baixados sob demanda. [RNF-014]
• A tela se adapta corretamente a resoluções entre 480x800 e 1440x3120 pixels. [RNF-015]
• A interface está disponível em português, inglês e espanhol, com novos idiomas carregáveis dinamicamente. [RNF-016]

## Requisitos Funcionais (RF)

- [RF-001](RF-001.md) — Grade de projetos recentes
- [RF-037](RF-037.md) — Relatório de metadados da mídia
- [RF-070](RF-070.md) — Notificações de projetos não finalizados

## Requisitos Não Funcionais (RNF)

- [RNF-001](RNF-001.md) — Autenticação de conta com verificação em duas etapas
- [RNF-002](RNF-002.md) — Comunicação exclusivamente por canal seguro
- [RNF-007](RNF-007.md) — Tempo de inicialização
- [RNF-014](RNF-014.md) — Espaço de instalação
- [RNF-015](RNF-015.md) — Suporte a faixa de resoluções de tela
- [RNF-016](RNF-016.md) — Suporte a múltiplos idiomas

## Observação da planilha de origem

Concentra os requisitos não funcionais transversais de acesso, desempenho e compatibilidade, por serem percebidos pelo usuário a partir da tela inicial/app shell.

## Tarefas técnicas da Sprint 2 relacionadas

- S1-071 Metadata

_Nota: US-03 e US-08 ficaram de fora deste sprint por já terem pasta própria em_
_`backlog sprint 1` (S1-052 Autosave, S1-053 Persistent Undo/Redo -> US-03; S1-017 Layer UI -> US-08)._
