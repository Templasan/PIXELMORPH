# Relatório de desempenho — PixelMorph (até 07/11/2026)

Build medida: `sprint-2` até `0da2841`, release. Medições em celulares reais, nunca no emulador.

| Celular | Perfil | Memória | Qualidade da prévia (automática) |
|---|---|---|---|
| **Poco** (24095PCADG, Android 16, arm64) | intermediário/forte, tela 120 Hz | 8 GB | Alta |
| **Samsung A11** (armeabi-v7a) | fraco | ~3 GB | Baixa |

Como foi medido: toques reais por `adb` (deslizar, pincelar, tocar), quadros e travamentos lidos dentro do editor (`requestAnimationFrame` + `longtask`), perfis de CPU nos piores casos, `ffprobe` nos arquivos exportados, `dumpsys meminfo` para memória.

## Resumo

- **Editar foto é fluido mesmo numa foto de 50 MP**: quadro mediano de 8 ms no Poco (120 Hz), sem travamentos ao deslizar, pincelar, clonar, mascarar ou mover elementos.
- **O editor trabalha numa cópia leve**, não no original: 2048 px (Alta), 1600 px (Média) ou 1080 px (Baixa), conferido no aparelho. O original só é lido para exportar e para "Aplicar e recomeçar".
- **Os gargalos estavam em salvar, aplicar e remover**, e foram reduzidos nesta rodada (tabela abaixo).
- **Vídeo**: tocar 3 camadas começa em menos de 0,5 s nos dois celulares, velocidade estável; exportar 60 s em 1080×1920 leva 39 s no Poco e 211 s no A11.

## Editor de foto — antes e depois desta rodada (Poco, foto de 50 MP, 8160×6120)

| Ação | Antes | Agora | O que mudou |
|---|---|---|---|
| Exportar JPEG | 16,5 s | **12,1 s** | Gravação do arquivo passou de 8,2 s para 2,9 s (`041960b`) |
| "Aplicar e recomeçar" | 21 s | **11,3 s** | Mesma correção de gravação |
| REMOVER (remover objeto) | tela congelada 0,93 s | **travamento máx. 92 ms** | Cálculo em segundo plano, com aviso (`0da2841`) |
| Abrir um painel | engasgo 50–110 ms | **20–39 ms** | Imagem de trabalho não é recriada ao encolher (`0da2841`) |
| Trocar qualidade Média/Baixa | não tinha efeito | **funciona, ~0,76 s** | Escolha passa no endereço da página (`201865e`) |
| Camada de imagem, colagem, panorama | abriam o original inteiro | **abrem cópia leve** | `28d0842` |

## Editor de foto — ferramentas com toque real (Poco)

Foto da câmera do app (3072×4096) e foto de 50 MP; resultados iguais nas duas.

| Ferramenta | Quadro mediano / máx. | Travamento |
|---|---|---|
| Deslizar Ajustes, Efeitos, recorte, perspectiva | 8 / 20–30 ms | nenhum |
| Pincel de máscara, mover texto, camadas | 8 / 20–27 ms | nenhum |
| Clonar | 8 / 12–28 ms | nenhum |
| Liquify | 8 / 20–65 ms | um de 65 ms no 1º arrasto |
| Óleo, Carvão | — | < 45 ms |
| Aquarela | — | 120–220 ms (1ª vez) |
| Comparar antes/depois | — | 192 ms ao ativar |
| Sugestões (abrir) | — | 60–80 ms |
| Girar 90° | — | 140 ms |

| Ação pesada | Tempo |
|---|---|
| Recortar fundo | 2,3–2,7 s |
| Efeito retrato | 2,3 s |
| Remover objeto (resultado) | ~0,9 s, tela livre |
| Reconhecer cena | 0,9 s |
| Panorama de 3 fotos (alinhar + criar) | ~15 s |
| Exportar JPEG/WebP (foto pequena) | 4–5 s |
| Exportar PNG / HEIC (foto pequena) | 14 s |
| Exportar PSD | **> 2 min** (ponto a melhorar) |

## Editor de vídeo — A11 × Poco

| Medida | A11 | Poco |
|---|---|---|
| Importar vídeo de 30 min (466 MB) | 16 s | 6–8 s |
| Cópia de prévia, 1080p de 30 min | 12 min 40 s | 3 min 37 s |
| Cópia de prévia, 4K de 1 min | 244–256 s | 51 s |
| Mostrar o quadro exato (vídeo de câmera, depois da cópia) | 107–154 ms | ~185 ms |
| Mostrar o quadro exato, 4K | 278 ms | 223 ms |
| Arrastar a linha do tempo | 0,1–1,5 ms | 0,4–1,4 ms |
| Tocar 3 camadas: início | 0,31–0,49 s | 0,27–0,45 s |
| Tocar 3 camadas: velocidade | 1,00 | 1,00 |
| Exportar 60 s em 1080×1920 | 211 s | 39 s |
| Exportar 4K de 60 s em 720p | 183 s + cópia | 35 s |

RNF-011 (1 min Full HD em até 2 min): **atendido no Poco (39 s)**, **não atendido no A11 (211 s)**.

No ensaio do roteiro (Poco): dividir 56 ms, mudar velocidade ~0,4 s, texto animado ~0,4 s, procurar rostos ~61 s num clipe de 60 s, baixar o modelo de legendas ~110 s (uma vez só).

## App e memória (Poco)

| Medida | Valor |
|---|---|
| Abrir o app a frio | 1,1 s (miniaturas ~2 s depois) |
| Trocar idioma | 1,3 s |
| Abrir foto de 50 MP pela 1ª vez (importar + cópia leve) | ~19 s (medida aproximada) |
| Reabrir com cópia já feita | ~0,8 s |
| Memória com foto de 50 MP aberta | 550–690 MB |
| Memória depois de ferramentas de IA | até 1,1 GB |

## Variação na exportação (medido depois, 07/11 à tarde)

Com o mesmo código e o Poco frio (CPU ~46 °C), um teste alternado (versão antiga, nova, antiga) deu: foto 1080×2400 JPEG 2,7–3,6 s, PNG 8–13 s, JPEG de 50 MP ~22 s, enquanto o mesmo JPEG de 50 MP tinha levado ~10 s mais cedo. A etapa que varia é gerar o arquivo (`toBlob`), entre 0,9 s e 13,8 s. Causa ainda não encontrada; está na fila (`docs/fila-desempenho.md`, item 11). Os tempos de exportação deste relatório são da fase rápida.

## Pontos ainda abertos

1. **Primeira abertura de foto grande (~19 s)** — a cópia leve leva < 1 s, então o tempo está na importação; ainda não separado.
2. **Exportar PSD > 2 min.**
3. **Memória até 1,1 GB** no editor de foto — risco no A11.
4. **A11 sem as melhorias desta rodada medidas** (foto e exportação).
5. **Compressão inteligente no vídeo** quase não reduziu o arquivo de teste (152,8 → 152,7 MB); clipe de teste muito movimentado, a confirmar com vídeo comum.
6. Pequenos engasgos: Comparar 192 ms, Aquarela na 1ª vez, Sugestões 60–80 ms.

## O que não foi medido

Câmera (temporizador, stop-motion, gravação), estabilização e 360° (sem clipe próprio), rostos e legendas no vídeo (clipes de teste sem rosto e sem fala), música de fundo, foto estéreo, e qualquer medida das ferramentas de foto no A11.
