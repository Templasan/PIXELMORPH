# Entregas da Sprint 2 (05/10 – 08/11/2026)

Branch `sprint-2` (no GitHub até `b6f1c24`), 363 commits desde `main`. Status: ✅ entregue e testado em celular real · 🟡 entregue, teste parcial · ⏸️ adiado/decisão pendente.

## Sprint 2 — histórias planejadas

| História | O que foi entregue | Status |
|---|---|---|
| **US-01 Central de projetos** | Grade de projetos com miniatura, data e tipo; filtros Todos/Fotos/Vídeos/Rascunhos; busca; agrupamento por mês; propriedades e metadados (RF-037); lembrete com prazo e prioridade (RF-070, aviso dentro do app) | ✅ (lembrete sem notificação do sistema 🟡) |
| **US-10 Composição gráfica** | Texto com fonte, cor, sombra, contorno e animação (RF-008); formas vetoriais (RF-044); memes (RF-046); colagens com layouts, borda, espaçamento e sombra (RF-011) | ✅ |
| **US-12 Comparação, guias e atalhos** | Antes/depois com divisor (RF-019); guias magnéticas (RF-067); gestos de desfazer/refazer/exportar (RF-076) | ✅ (gestos de 2/3 dedos 🟡) |
| **US-16 Transições e montagem** | Transições com duração e prévia (RF-032); dividir, unir e reordenar clipes (RF-058) | ✅ |
| **US-17 Velocidade** | Câmera lenta, aceleração e rampa suave (RF-049); time-lapse a partir de fotos (RF-023) | ✅ |
| **US-30 Exportação** | JPEG, PNG, WebP, HEIC (RF-057); GIF animado (RF-061); presets de redes sociais (RF-017); compressão inteligente (RNF-013); 1 min Full HD em 39 s no Poco (RNF-011) | ✅ (RNF-011 não atingido no A11: 211 s) |
| **US-33 Captura e trilha de áudio** | Vídeo com som gravado na câmera e medidor de microfone (RF-018); trilha de fundo (RF-036) | ✅ |

## Base técnica refeita nesta sprint

- **Editores de foto e vídeo novos (web dentro do app)**, ambos com **camadas** (opacidade, 8 mesclagens, recorte na camada de baixo, travar, reordenar).
- **Editor de vídeo**: motor próprio com WebCodecs, cópias leves para prévia (540/720/1080p), prévia em tempo real com 3 camadas, áudio sem estalos, exportação nativa (Media3).
- **Qualidade da prévia** automática por celular + seletor (Alta/Média/Baixa) nos dois editores.
- **Correções de perda de dados**: mídia salva fora do cache, histórico grande gravado em partes, miniatura como arquivo.

## Sprint 3 — adiantado nesta sprint

| História | Entregue | Status |
|---|---|---|
| US-02 Presets e edição em lote | Salvar preset (RF-014), aplicar em várias fotos (RF-015) | ✅ |
| US-06 Máscaras | Pincel (RF-007), por cor (RF-038), foco seletivo (RF-045), linear e radial (RF-072) | ✅ |
| US-07 Retoque e distorção | Clonagem (RF-022), liquify (RF-026) | ✅ |
| US-13 Fotos estereoscópicas | Visualização 3D (RF-071) | 🟡 (falta testar com foto estéreo real) |
| US-18 Estabilização por sensores | Gravação dos sensores e estabilização no editor (RF-009) | 🟡 (calibração no celular) |
| US-19 Vídeo 360° | Campo de visão e inclinação (RF-021) | 🟡 (falta testar com vídeo 360 real) |
| US-20 Picture-in-picture | Vídeo sobre vídeo em nova faixa (RF-065) | ✅ |
| US-22 Captura assistida | Temporizador (RF-039) e stop-motion (RF-043) | ✅ |
| US-24 Recorte e remoção | Recorte com troca de fundo (RF-004), remover objeto (RF-055) | ✅ |
| US-25 Retrato e rosto | Desfoque de fundo (RF-012), rostos (RF-016), olhos vermelhos e pele (RF-025), tudo no aparelho (RNF-004) | ✅ |
| US-26 Sugestões | Paleta (RF-010), cena (RF-034), corte (RF-042) | ✅ |
| US-27 Filtros artísticos | Aquarela, óleo, carvão (RF-050) | ✅ |
| US-28 Panorama | Alinhamento automático (RF-062) | ✅ |
| US-29 Automação de vídeo | Miniatura animada (RF-030), legendas por fala offline (RF-069) | ✅ |
| US-31 Fluxos profissionais | PSD (RF-040), espaços de cor (RF-051), impressão (RF-073) | ✅ (PSD lento: > 2 min em 50 MP) |
| US-32 Marca d'água e QR | Marca d'água salva (RF-020), QR code (RF-066) | ✅ |
| US-36 Galeria e tutoriais | Amostras com tutorial interativo (RF-056) | ✅ |
| US-21 Filtro ao vivo na câmera | Filtro como camada colorida; processamento real fica possível com a nova câmera | ⏸️ |
| US-23 Realidade aumentada | Só demonstração visual; o critério exige detectar superfície (ARCore) | ⏸️ |
| US-34 Colaboração / US-35 Comunidade | — | ⏸️ decisão pendente |

## Câmera nova (últimos dias)

- Biblioteca trocada (expo-camera → VisionCamera): troca Foto↔Vídeo sem reiniciar, foco ao tocar real, captura em 0,24 s (antes 0,64–0,77 s).
- Redesign aprovado: tela cheia sem barras do sistema, controles simétricos e centralizados, flash/temporizador/grade/zoom, painel de filtros, vídeo com tempo e pausa, stop-motion com quadro anterior transparente.
- Prévia 3:4 igual à foto e resolução igual à câmera do sistema (20 MP frontal).

## Desempenho (Poco, foto de 50 MP)

| | Antes | Agora |
|---|---|---|
| Aplicar ajustes | 11,3 s | 0,19 s |
| Exportar JPEG (foto 1080×2400) | 2,7–5,8 s | 1,4–1,9 s |
| Exportar PNG / HEIC (mesma foto) | 6,6–15 s | 2,1–2,4 s |
| Remover objeto | tela congelada 0,93 s | tela livre (máx. 92 ms) |
| Abrir painel | 50–110 ms de engasgo | 20–39 ms |
| Câmera: abrir / capturar | 0,87 s / 0,7 s | 0,3 s / 0,24 s |
| Edição ao vivo | — | 8 ms por quadro (120 Hz) |

Detalhes: `docs/relatorio-desempenho-2026-11-07.md`. Pendências técnicas: `docs/fila-desempenho.md`. Roteiro da apresentação: `docs/roteiro-sprint-review.md`.

## Pendente para fechar a Sprint 2

- RNF-001: verificação de e-mail por código (combinado para o fim).
- Critérios ainda sem teste formal em celular (parte das Sprints 1 e 2).
- Ensaiar o roteiro com a câmera nova.
