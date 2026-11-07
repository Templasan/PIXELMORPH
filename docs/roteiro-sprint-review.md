# Roteiro da Sprint Review — Sprint 2 (+ itens adiantados da Sprint 3)

Ordem pensada para uma demonstração contínua de ~25 min no celular, sem voltar atrás:
projetos → câmera → editor de foto → montagens → editor de vídeo → exportação.

Como usar: rode a rota inteira antes da apresentação. Em cada passo marque `[x]` se funcionou
ou escreva o erro na coluna **Anotações**. Os nomes entre aspas são os textos dos botões no app.
Itens com **(S3)** são da Sprint 3, adiantados.

## Preparação (antes de começar)

- [ ] Build mais nova instalada (`sprint-2`, commit `0da2841` ou depois).
- [ ] Na galeria: 2 fotos boas (uma com rosto, uma paisagem), 3 fotos parecidas para panorama,
      2 clipes curtos (10–30 s, um com fala), 1 música.
- [ ] Um projeto de foto e um de vídeo já criados (backup se a importação demorar ao vivo).
- [ ] Modelo de legendas já baixado (o primeiro "Baixar e gerar" faz download).
- [ ] Celular carregado, modo não perturbe, brilho alto, tela gravando como plano B.

---

## 1. Central de projetos — US-01 (~2 min)

| # | Ação | O que mostrar / esperado | OK | Anotações |
|---|---|---|---|---|
| 1.1 | Abrir o app | Abre rápido (RNF-007) na grade de projetos com miniatura, data e tipo (RF-001) | [ ] | |
| 1.2 | Visão em lista → tocar na linha do projeto (segurar abre seleção com "Apagar") | Dimensões, formato, tamanho e histórico (RF-037) | [ ] | |
| 1.3 | Criar um "Lembrete" com prazo (DD/MM/AAAA, com barras) e prioridade. Android pode pedir permissão de notificação: aceitar antes da apresentação | Aviso de projeto não finalizado (RF-070) | [ ] | |
| 1.4 | Trocar o idioma nas configurações e voltar | Textos mudam (RNF-016) | [ ] | |
| 1.5 | Girar o celular / mostrar em outra tela | Layout se ajusta (RNF-015) | [ ] | |

## 2. Câmera e captura — US-22 (S3), US-33 (~3 min)

| # | Ação | O que mostrar / esperado | OK | Anotações |
|---|---|---|---|---|
| 2.1 | Câmera → temporizador (3 s ou 10 s) → foto | Contagem regressiva e foto vira projeto (RF-039) | [ ] | |
| 2.2 | Câmera → stop-motion: 4–5 quadros | Vídeo stop-motion montado (RF-043) | [ ] | |
| 2.3 | Gravar vídeo curto falando | Vídeo com áudio gravado junto (RF-018) | [ ] | |

## 3. Editor de foto (~8 min)

Abrir a foto com rosto. Mostrar o chip "Prévia: … (auto)" e explicar que o editor trabalha numa cópia leve e exporta do original.

### 3a. Básico e produtividade — US-12

| # | Ação | O que mostrar / esperado | OK | Anotações |
|---|---|---|---|---|
| 3.1 | "Ajustes": arrastar Exposição, Temperatura, Saturação | Prévia acompanha o dedo, sem travar | [ ] | |
| 3.2 | Botão "<>" (comparar) e arrastar o divisor | Antes/depois lado a lado (RF-019) | [ ] | |
| 3.3 | Desfazer / refazer (botões e gesto de 2 e 3 dedos) | Atalhos (RF-076) | [ ] | |

### 3b. Composição — US-10

| # | Ação | O que mostrar / esperado | OK | Anotações |
|---|---|---|---|---|
| 3.4 | "Elementos" (deslize a barra de painéis para a esquerda) → "Texto" → digitar, fechar teclado → cor, chips "Sombra" e "Contorno" → "ADICIONAR AO CANVAS" | Texto estilizado (RF-008) | [ ] | |
| 3.5 | Arrastar o texto para o centro | Guia magnética aparece e encaixa (RF-067) | [ ] | |
| 3.6 | "Nova forma": seta vermelha | Forma vetorial com cor certa (RF-044) — conferir que não sai branca | [ ] | |
| 3.7 | "CRIAR MEME": "Texto de cima" / "Texto de baixo"; adesivo fica em "Adesivos" | Meme (RF-046) | [ ] | |
| 3.8 | "Camadas": reordenar, opacidade, ocultar | Multicamadas | [ ] | |

### 3c. Ajustes locais e retoque — US-06, US-07, US-24, US-25 (S3)

| # | Ação | O que mostrar / esperado | OK | Anotações |
|---|---|---|---|---|
| 3.9 | "Máscaras" → pincel → pintar o céu → Brilho | Ajuste só na área pintada (RF-007) | [ ] | |
| 3.10 | "Máscaras" → "+ Por cor" → tocar na cor → Tolerância | Máscara por cor (RF-038) | [ ] | |
| 3.11 | "Máscaras" → "+ Linear", "+ Radial", "+ Foco" | Gradientes (RF-072) e foco seletivo (RF-045) | [ ] | |
| 3.12 | "Retoque" → "+ Clonar" → pincelar | Clonagem (RF-022) | [ ] | |
| 3.13 | "Retoque" → "+ Liquify" → arrastar | Deformação (RF-026) | [ ] | |
| 3.14 | "Retoque" → "Remover objeto": pincelar sobre o objeto (sem marca o botão fica cinza) → "REMOVER" | Aviso "Removendo objeto…", objeto some (RF-055) | [ ] | |
| 3.15 | Foto com pessoa: "Recortar fundo" → "Fundo novo" / "Transparente" (~2,5 s) | Recorte inteligente (RF-004) | [ ] | |
| 3.16 | "Efeito retrato" → "Desfoque do fundo" | Retrato (RF-012) | [ ] | |
| 3.17 | Foto com rosto de frente (ensaiar com a foto da apresentação): "Retocar rostos": "Suavizar a pele", "Olhos vermelhos", "Realçar os olhos" | Rosto detectado e corrigido no aparelho (RF-016, RF-025, RNF-004: sem internet) | [ ] | |

### 3d. Inteligência e efeitos — US-26, US-27 (S3)

| # | Ação | O que mostrar / esperado | OK | Anotações |
|---|---|---|---|---|
| 3.18 | "Sugestões": cena reconhecida → "Aplicar ajustes para …" | Reconhecimento de cena (RF-034) | [ ] | |
| 3.19 | "Sugestões": "Paleta da foto" e "Sugestões de corte" | Cores dominantes (RF-010) e enquadramento (RF-042) | [ ] | |
| 3.20 | "Efeitos" → "Filtros artísticos": Aquarela, Óleo, Carvão | Filtros artísticos (RF-050) | [ ] | |
| 3.21 | "Efeitos": Retrô, Vinheta, Granulado | Efeitos clássicos | [ ] | |

### 3e. Presets e lote — US-02 (S3)

| # | Ação | O que mostrar / esperado | OK | Anotações |
|---|---|---|---|---|
| 3.22 | "Presets" → "Salvar ajustes atuais" com nome | Preset salvo (RF-014) | [ ] | |
| 3.23 | "Edição em lote…" → escolher 2 fotos → "Aplicar" | "Aplicando 1 de 2…", as outras fotos recebem o look (RF-015) | [ ] | |

### 3f. Marca e exportação de foto — US-32, US-30, US-31 (S3)

| # | Ação | O que mostrar / esperado | OK | Anotações |
|---|---|---|---|---|
| 3.24 | Selecionar uma camada de texto ou logo ("Logo da galeria") → "Nome da marca" → "SALVAR COMO MARCA" | Marca d'água reutilizável (RF-020) | [ ] | |
| 3.25 | "Elementos" → QR code com um link | QR code na imagem (RF-066) | [ ] | |
| 3.26 | "EXPORTAR" → Formato JPEG/PNG/WebP/HEIC | Formatos (RF-057) | [ ] | |
| 3.27 | "Compressão inteligente" + "Qualidade" | Arquivo menor no alvo (RNF-013) | [ ] | |
| 3.28 | Botão de rede social, ex.: "Instagram Feed 1080×1080" | Preset de rede social (RF-017) | [ ] | |
| 3.29 | "Espaço de cor" Adobe RGB / P3, "Simular impressão CMYK", DPI | Cor e impressão (RF-051, RF-073) | [ ] | |
| 3.30 | Exportar como PSD **numa foto pequena** (numa de 50 MP passou de 2 min) | Abre o "Compartilhar" do Android com o PSD (RF-040); não vai para a galeria | [ ] | |

### 3g. Estéreo — US-13 (S3)

| # | Ação | O que mostrar / esperado | OK | Anotações |
|---|---|---|---|---|
| 3.31 | Preparar antes uma foto estéreo lado a lado → abrir → visualizador 3D | Visualização 3D (RF-071) | [ ] | |

## 4. Montagens de foto — US-10, US-28 (S3) (~2 min)

| # | Ação | O que mostrar / esperado | OK | Anotações |
|---|---|---|---|---|
| 4.1 | "Colagem" → 3–4 fotos → layout, "Borda", "Espaçamento", "Sombra" → "Criar colagem" | Colagem vira projeto novo (RF-011) | [ ] | |
| 4.2 | "Panorama" → 3 fotos → "Alinhar automaticamente" → "Criar panorama" | Alinhamento automático (RF-062) | [ ] | |

## 5. Editor de vídeo (~7 min)

Abrir o projeto de vídeo com 2 clipes.

| # | Ação | O que mostrar / esperado | OK | Anotações |
|---|---|---|---|---|
| 5.1 | Reproduzir, pausar, arrastar a timeline | Prévia fluida, som sem estalo | [ ] | |
| 5.2 | Adicionar o 2º clipe e reordenar arrastando (use clipes curtos: com 2 de 60 s eles não cabem na tela nem no zoom mínimo) | União e ordem de clipes (RF-058) | [ ] | |
| 5.3 | "Dividir" um clipe | Divisão no ponto | [ ] | |
| 5.4 | "Transição" entre clipes → tipo e "Duração" | Transição com prévia (RF-032) | [ ] | |
| 5.5 | Clipe → "Velocidade" 0,5x e 2x → "Aplicar rampa" | Câmera lenta, aceleração e rampa suave (RF-049) | [ ] | |
| 5.6 | "Time-lapse" → "Escolher fotos" → "Segundos por foto" | Time-lapse de fotos (RF-023) | [ ] | |
| 5.7 | Adicionar música de fundo (deixar um áudio na galeria antes) e ajustar volume | Trilha de áudio (RF-036) | [ ] | |
| 5.8 | "Nova faixa" com outro vídeo menor por cima | Picture-in-picture (RF-065, S3) | [ ] | |
| 5.9 | Texto no vídeo com "Animação de entrada/saída" | Texto animado (RF-008) | [ ] | |
| 5.10 | "Estabilizar" num clipe **gravado na câmera do app** (outros clipes mostram "não tem dados de movimento") | Estabilização por sensores (RF-009, S3) | [ ] | |
| 5.11 | Clipe 360° de verdade (preparar antes) → "Campo de visão", "Inclinação" | Edição 360 (RF-021, S3) | [ ] | |
| 5.12 | Clipe com rosto → "Rostos" → "Procurar rostos" (~1 min num clipe de 60 s) → "Suavizar a pele" | Efeito por rosto no vídeo (RF-016, S3) | [ ] | |
| 5.13 | Clipe **com fala** → "Legendas" → "Gerar" (primeira vez baixa o modelo: ~2 min, fazer antes) | Legendas automáticas, offline (RF-069, S3) | [ ] | |
| 5.14 | Chip "Prévia: …" → trocar qualidade | Editor reabre na qualidade escolhida | [ ] | |

## 6. Exportação de vídeo — US-30, US-29 (S3) (~2 min)

| # | Ação | O que mostrar / esperado | OK | Anotações |
|---|---|---|---|---|
| 6.1 | "EXPORTAR" → preset de rede social (ex.: YouTube Full HD) | "Salvo na galeria." (RF-017, RNF-011: 1 min Full HD < 2 min) | [ ] | |
| 6.2 | "Compressão inteligente" ligada | Mostra "Compressão inteligente: X Mbps (Y% do preset)"; reduz mais em cenas paradas (RNF-013) | [ ] | |
| 6.3 | Formato GIF | GIF animado, só os primeiros 15 s (RF-061) | [ ] | |
| 6.4 | "Miniatura com os melhores momentos" | Miniatura animada (RF-030) | [ ] | |
| 6.5 | Abrir o arquivo na galeria | Vídeo toca com som e transições | [ ] | |

## 7. Tutoriais — US-36 (S3) (~1 min)

| # | Ação | O que mostrar / esperado | OK | Anotações |
|---|---|---|---|---|
| 7.1 | "Tutoriais" → abrir uma amostra e seguir o guia | Galeria de amostras com tutorial interativo (RF-056) | [ ] | |

---

## Fora da demonstração (falar, não mostrar)

- **RF-006 / RF-079 filtro ao vivo na câmera (US-21)**, **RF-024 realidade aumentada (US-23)**,
  **US-34 edição colaborativa** e **US-35 comunidade**: Sprint 3, ainda não feitos ou aguardando decisão.
- **RNF-001 login por e-mail com verificação**: a verificação por código fica por último na Sprint 2.
- Números de desempenho para citar (Poco, foto de 50 MP): edição a 60–120 quadros por segundo; exportar 12 s;
  "Aplicar e recomeçar" 11 s; remover objeto sem travar a tela.

## Erros encontrados no ensaio

| Passo | O que aconteceu | Celular | Grave? |
|---|---|---|---|
| | | | |
