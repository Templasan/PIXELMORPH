# Situação da Sprint 2

Verificado em 05/10/2026, em duas frentes:
- **Celular real:** modelo 24095PCADG (arm64, Android 16, tela 1220x2712), build **release** do app. Medições de desempenho e testes de uso.
- **Emulador `Pixel_7`:** build debug, usado nos testes anteriores (transições, exportação).

Legenda: ✅ testado e funciona · 🟡 existe, mas só parte foi testada ou falta algo do critério · ❌ não existe.

Esta versão substitui uma anterior que marcava US-10, US-12 e US-33 como "não implementadas" sem ter olhado o código. Estava errado.

## Restauração da fundação (05/10/2026, branch `sprint-2`)

Detalhes, medições e commits em [`docs/foundation-plan.md`](../docs/foundation-plan.md) §8. Verificado em build **release** no emulador `Pixel_7`.

**Defeitos de perda de dado corrigidos**
- **Mídia no cache:** câmera, stop-motion, galeria, RAW, colagem, panorama e clipes/áudio/time-lapse adicionados no editor de vídeo guardavam no projeto o caminho do *cache*, que o Android e o botão "Limpar cache" apagam. Agora cada projeto tem sua cópia em `documents/media/<projeto>/`; um reparo único copia o que ainda existia. Testado: foto da câmera e clipe da galeria continuam abrindo depois de "Limpar cache". Arquivos que já tinham sido apagados antes da correção não voltam.
- **Miniatura em base64:** o export de foto gravava a imagem inteira dentro do registro do projeto (risco de passar do limite de ~2 MB do Android e o projeto ficar ilegível). Agora é arquivo.
- **Histórico grande:** o histórico do vídeo (que guarda a timeline inteira a cada edição) passaria do mesmo limite em sessões longas; agora é gravado em partes. Testado: editar → fechar o app à força → reabrir mantém a edição e o desfazer.
- **Log de erros** (RNF-017): mesmos 5 MB, agora em segmentos de 256 KB.

**Outros defeitos corrigidos**
- Editor travado em "carregando" se a leitura do histórico falhasse.
- Sliders de PiP não entravam no desfazer; sliders de 360° podiam não registrar a mudança.
- Playhead da régua desalinhado do playhead das faixas.
- Histórico do projeto ficava ocupando espaço depois de apagar o projeto.

**Desempenho** (emulador, release; comparar só antes/depois)
- Inicialização a frio 647 → 564 ms.
- Arrastar a timeline: quadros lentos 20,6 → 10 %, p99 113 → 69 ms.
- Abrir/fechar gaveta de Ajustes: p99 73 → 42 ms (o histograma era recalculado a cada render da tela).

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
| RF-067 Guias de alinhamento magnético | 🟡 Texto, formas e adesivos encaixam no centro e nos outros elementos, com linha de guia (testes de unidade; falta ver no celular) |
| RF-076 Atalhos rápidos (desfazer, refazer, salvar, ferramentas) | 🟡 Gestos no canvas: 2 dedos desfaz, 3 dedos refaz, duplo toque de 2 dedos exporta, duplo toque de 3 dedos troca de ferramenta. Teclado físico não (React Native não entrega as teclas sem módulo nativo). Falta testar no celular; pode conflitar com pintura/comparação |

### US-16 — Transições e montagem ✅
| Critério | Situação |
|---|---|
| RF-032 Transições com duração e prévia | ✅ Fade, deslize, zoom e wipe verificados no arquivo exportado (emulador). No celular: dividir, aplicar desvanecimento e exportar funcionou |
| RF-058 Reordenar e unir vários clipes | ✅ Divisão e união no celular. Reordenar por arrasto sem teste |

### US-17 — Controle de velocidade 🟡
| Critério | Situação |
|---|---|
| RF-049 Velocidade em pontos específicos, com transição suave entre velocidades | 🟡 Velocidade por clipe testada no celular. Botão "Suavizar fim até 1x" divide o fim do clipe em 4 degraus (1,5 s); só desacelera até 1x. Não testado no celular |
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
| RF-018 Gravar áudio na captura, com monitor e ganho | 🟡 A câmera grava com áudio e tem medidor de nível. Ganho de entrada real é impossível com `expo-camera`/`expo-audio` (a câmera toma o microfone). Alternativa feita: volume 0–100% por clipe de vídeo na aba Áudio, na prévia e no mp4 (controle visto no celular; áudio não ouvido) |
| RF-036 Trilha de fundo com volume, fade in/out e sincronização | 🟡 Faixa A1 com volume e fade in/out, e agora misturada no mp4 (plano com teste, Kotlin compila). Não testei importar um áudio nem ouvir o resultado |

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

## Defeitos achados no celular (corrigidos depois)
- **Fim do vídeo preto:** corrigido; visto no celular, a prévia mantém a imagem no último instante.
- **Régua e nomes das faixas quebrando:** corrigido; visto no celular (00:00, 00:02, 00:04… em uma linha).
- **Rótulo 1920×1080 em vídeo gravado em pé:** corrigido na câmera (guarda 1080×1920); testado só por unidade, vale gravar um vídeo novo para ver.
- **Cor da forma:** a seta saiu branca com vermelho escolhido. Não achei a causa; foi adicionada uma proteção (mudanças no formulário de Formas se aplicam à forma selecionada). Falta refazer o teste no celular.

## Observações
- **Build debug no celular:** a tela atrasa e perde toques no editor de foto. No release isso não acontece.
- **Ordem da lista de projetos:** um projeto novo vai para o topo e empurra os outros.

## Como foi o build release
O build release no Windows falha por causa do caminho longo (limite de 260 caracteres do `ninja`). O atalho de unidade `subst R:` também falha neste projeto, porque o Node resolve `R:` de volta para `C:`. O que funcionou: copiar o projeto para uma pasta curta de verdade (`C:\pm`, sem `.git` nem pastas de build) e rodar `gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a` de lá (3 min 44 s).
