# Situação da Sprint 2

Verificado em 05/10/2026, em duas frentes:
- **Celular real:** modelo 24095PCADG (arm64, Android 16, tela 1220x2712), build **release** do app. Medições de desempenho e testes de uso.
- **Emulador `Pixel_7`:** build debug, usado nos testes anteriores (transições, exportação).

Legenda: ✅ testado e funciona · 🟡 existe, mas só parte foi testada ou falta algo do critério · ❌ não existe.

Esta versão substitui uma anterior que marcava US-10, US-12 e US-33 como "não implementadas" sem ter olhado o código. Estava errado.

---

## User stories

### US-01 — Central de projetos 🟡
| Critério | Situação |
|---|---|
| RF-001 Grade de projetos com miniatura, data e tipo | ✅ Testado no celular |
| RF-037 Propriedades e histórico | ✅ Painel abre. Projetos antigos (anteriores à correção) mostram dimensões "—" |
| RF-070 Lembretes com prazo e prioridade | 🟡 Só banner dentro do app; sem notificação do sistema |

### US-10 — Composição gráfica 🟡
| Critério | Situação |
|---|---|
| RF-008 Texto com fontes, cores, sombra, contorno e animação | ✅ Testado no celular: texto vermelho com sombra e contorno desenhado na foto. Entrada/saída são controles para vídeo, não exercitados |
| RF-044 Formas (círculo, retângulo, linha, seta) com cor e espessura | 🟡 Seta desenhada e aplicada. A primeira saiu branca mesmo com vermelho escolhido; não consegui reproduzir com segurança, então a cor da forma fica por conferir |
| RF-046 Memes (texto superior/inferior, stickers) | 🟡 Aba existe; não testei de ponta a ponta |
| RF-011 Colagens (layouts, bordas, sombras, espaçamento) | 🟡 Aba e cálculo existem (`composeCollage`); não testei no celular |

### US-12 — Comparação, guias e atalhos 🟡
| Critério | Situação |
|---|---|
| RF-019 Comparar antes/depois com divisor deslizante | ✅ Testado no celular (ORIGINAL | EDITADA) |
| RF-067 Guias de alinhamento magnético | 🟡 Só no ponto de luz (linhas de centro). Texto, formas e adesivos não têm guia |
| RF-076 Atalhos rápidos (desfazer, refazer, salvar, ferramentas) | 🟡 Desfazer/refazer/exportar são botões do cabeçalho. Não há atalhos além disso; a tela Ajuda só lista atalhos |

### US-16 — Transições e montagem ✅
| Critério | Situação |
|---|---|
| RF-032 Transições com duração e prévia | ✅ Fade, deslize, zoom e wipe verificados no arquivo exportado (emulador). No celular: dividir, aplicar desvanecimento e exportar funcionou |
| RF-058 Reordenar e unir vários clipes | ✅ Divisão e união no celular. Reordenar por arrasto sem teste |

### US-17 — Controle de velocidade 🟡
| Critério | Situação |
|---|---|
| RF-049 Velocidade em pontos específicos, com transição suave entre velocidades | 🟡 Velocidade por clipe (0,25x a 4x, controle deslizante) testada no celular. Rampa suave entre velocidades não existe: o ponto específico se obtém dividindo o clipe |
| RF-023 Time-lapse a partir de fotos | ✅ Botão e montagem existem (testado no emulador) |

### US-30 — Exportação ✅/🟡
| Critério | Situação |
|---|---|
| RF-057 JPEG, PNG, WebP e HEIC | 🟡 Sem HEIC (Android abaixo da API 34 não codifica) |
| RF-061 GIF animado | ✅ Funciona; lento (medido só no emulador) |
| RF-017 Presets de redes sociais | ✅ Seis presets; exportação com YouTube Full HD testada no celular |
| RNF-013 Compressão inteligente | ✅ Foto. Vídeo usa bitrate fixo por preset |
| RNF-011 1 min Full HD em até 2 min | ✅ Medido no celular: 10 s em 1920×1080 com transição, **2,7 s** (9,2 MB). Extrapolando, 1 min leva uns 16 s. Falta medir 1 min de verdade e em aparelho de gama média |

### US-33 — Captura e trilha de áudio 🟡
| Critério | Situação |
|---|---|
| RF-018 Gravar áudio na captura, com monitor e ganho | 🟡 A câmera grava com áudio e tem medidor de nível. Não testei no celular e não há controle de ganho nem faixa separada |
| RF-036 Trilha de fundo com volume, fade in/out e sincronização | 🟡 Faixa A1 com volume e fade in/out existe. Não testei importar um áudio. O áudio da faixa A1 não vai para o arquivo exportado |

---

## Requisitos não funcionais ligados à Sprint 2

| RNF | Situação |
|---|---|
| RNF-001 Login + 2FA | ⏸️ Fora do escopo (sem backend); a tela aceita qualquer entrada |
| RNF-002 HTTPS na sincronização | ⏸️ Fora do escopo (sem backend) |
| RNF-007 Inicialização < 3 s | ✅ Celular real, build release: **0,82 a 1,2 s** (3 aberturas a frio) |
| RNF-009 4K de 15 min sem queda | ✅ Celular real, build release: tocar 12 s deu 1142 quadros, **0,18%** lentos, mediana 13 ms; arrastar a régua 10 vezes deu 332 quadros, nenhum lento, mediana 8 ms. Memória em torno de 1 GB |
| RNF-011 1 min Full HD em até 2 min | ✅ Parcial (ver US-30) |
| RNF-014 Instalação ≤ 200 MB | ✅ APK release arm64 de 59 MB |
| RNF-015 Resoluções 480x800 a 1440x3120 | ✅ Testado antes nas duas pontas; o celular real (1220x2712) funciona |
| RNF-016 PT/EN/ES | 🟡 Só nas telas principais |

---

## Resumo

| Situação | US |
|---|---|
| ✅ Completas | US-16 |
| 🟡 Existem, com partes pendentes | US-01, US-10, US-12, US-17, US-30, US-33 |
| ❌ Inexistentes | nenhuma |

## Defeitos e observações achados no celular
- **Fim do vídeo:** ao chegar no último instante, a prévia fica preta em vez de manter o último quadro.
- **Régua da timeline:** os números quebram em duas linhas (`00:0` / `0`) nesta densidade de tela. Os nomes das faixas também (`IM` / `G`).
- **Rótulo de resolução:** vídeo gravado pela câmera do app mostra 1920×1080 mesmo gravado em pé (o seletor da galeria mostra a orientação certa).
- **Build debug no celular:** a tela atrasa e perde toques no editor de foto. No release isso não acontece.
- **Ordem da lista de projetos:** um projeto novo vai para o topo e empurra os outros, o que enganou meus toques; não é defeito.

## Como foi o build release
O build release no Windows falha por causa do caminho longo (limite de 260 caracteres do `ninja`). O atalho de unidade `subst R:` também falha neste projeto, porque o Node resolve `R:` de volta para `C:`. O que funcionou: copiar o projeto para uma pasta curta de verdade (`C:\pm`, sem `.git` nem pastas de build) e rodar `gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a` de lá (3 min 44 s).
