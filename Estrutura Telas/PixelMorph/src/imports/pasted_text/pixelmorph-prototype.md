Construa um protótipo navegável de um aplicativo mobile chamado PixelMorph, um editor profissional de foto e vídeo para Android. Viewport de 390x844. Toda a interface em português do Brasil.

═══════════ SISTEMA VISUAL ═══════════

Tema escuro único, sem modo claro. Referência estética: Adobe Photoshop CC 2015 e Sony Vegas Pro — flat design de 2015, com a densidade de uma ferramenta profissional.

Tokens de cor:
  barra    #252525   barra superior, painéis, gavetas
  painel   #2F2F2F   cartões, campos, painéis secundários
  canvas   #1A1A1A   fundo geral e área de canvas
  faixa    #1F1F1F   faixas técnicas, fundo de histograma e de curvas
  linha    #3C3C3C   divisórias e bordas
  texto    #E4E4E4
  texto2   #8E8E8E
  acento   #3A8FDE   cor única de destaque
  perigo   #D25252
  ok       #5FB98F
  alerta   #D2A05E

Regras rígidas:
- Raio de canto máximo 2px. Nenhum botão pill, nenhum cartão arredondado.
- Zero gradiente, zero blur, zero glassmorphism. Nenhuma sombra, exceto elevação sutil sob a barra superior.
- Botão primário: retângulo chapado #3A8FDE com texto escuro. Secundário: transparente com borda 1px #3C3C3C.
- Ícones: contorno monocromático de 2px em #B0B0B0, virando #3A8FDE quando ativos. Sem ícones preenchidos, sem emoji.
- Tipografia Roboto nos tamanhos 20 / 16 / 14 / 13 / 12 / 10.
- Todo valor numérico — dimensões, tempos, dB, porcentagens, códigos hex — em fonte monoespaçada.
- Espaçamento denso em grade de 8px.
- Slider: trilho de 2px, alça quadrada de 12px, marca central quando bipolar, valor numérico alinhado à direita do rótulo.
- Interruptor no estilo Material 2015: trilho fino com alça circular.
- Item de barra de ferramentas: ícone de 24px acima, rótulo de 10px abaixo.

═══════════ ARQUITETURA ═══════════

Sete telas. Gavetas, painéis e folhas são ESTADO dentro da tela, não rotas separadas: abrir a gaveta "Ajustes" não navega para lugar nenhum, apenas expande um painel inferior sobre o mesmo canvas.

  1. Login, com etapa de verificação em duas etapas
  2. Projetos — o hub, com gaveta de navegação lateral
  3. Câmera
  4. Editor de foto
  5. Editor de vídeo
  6. Exportação — folha modal sobre qualquer um dos editores
  7. Comunidade

Navegação por gaveta lateral acionada por ícone de hambúrguer, contendo Projetos, Câmera, Comunidade, Tutoriais, Presets, Armazenamento, Conta e preferências, Ajuda. Dentro de cada tela, abas de texto no topo. NÃO use bottom navigation: é anacrônico para o visual de 2015.

═══════════ TELA 1 · LOGIN ═══════════

Logotipo "PixelMorph" e a assinatura "Editor de foto e vídeo". Campos de e-mail e senha com rótulo em maiúsculas de 11px acima. Link "Esqueci minha senha". Botão "Entrar" de largura total. Divisor com "ou". Botão secundário "Criar conta". No rodapé, seletor de idioma "PT · EN · ES".
Ao entrar, mostra a etapa de verificação em duas etapas: ícone de escudo, seis caixas quadradas de 48px para o código, contador "Reenviar código em 00:42", botão "Verificar" e link "Usar app autenticador". As caixas de código devem aceitar digitação e avançar o foco sozinhas.

═══════════ TELA 2 · PROJETOS ═══════════

Barra superior com hambúrguer, título "Projetos", ícones de busca e ordenação. Abas "TODOS · FOTOS · VÍDEOS · RASCUNHOS" que filtram a grade de verdade.
Cartão de lembrete com faixa laranja à esquerda: "3 projetos pendentes", subtexto "Ensaio Praia vence em 2 dias · Prioridade alta".
Grade de 2 colunas com cartões de projeto: miniatura 1:1, nome, e uma linha com data e tipo. Cartões de vídeo mostram ícone de play e duração sobre a miniatura.
Botão de ação flutuante circular azul que abre a Câmera.
Estados desta tela:
- Gaveta de navegação aberta, ocupando 80% da largura, com véu escuro à direita, cabeçalho de perfil, lista de destinos e barra de armazenamento "4,2 GB de 10 GB usados" no rodapé.
- Folha de propriedades da mídia, aberta ao tocar no ícone de informação de um cartão: abas "PROPRIEDADES · HISTÓRICO" e uma lista de pares rótulo-valor com dimensões, tamanho, formato, espaço de cor, taxa de bits, codificação, ISO, abertura e data de modificação, seguida do histórico de edições com hora e ação.
- Modo de seleção múltipla, ativado por toque longo: barra superior contextual "4 selecionados", cartões com borda azul e marca de seleção, e folha inferior "Aplicar em lote" com chips de preset, caixas de seleção de ajustes e uma barra de progresso que anima ao aplicar.
- Tela de conta e preferências, aberta pela gaveta: seções de conta, idioma, salvamento e backup, diagnóstico e armazenamento, com interruptores funcionais.

═══════════ TELA 3 · CÂMERA ═══════════

Pré-visualização em tela cheia com controles sobrepostos. Barra superior translúcida com flash, proporção, grade e inverter câmera, e um distintivo "60 FPS" em verde.
Carrossel horizontal de filtros com miniaturas de 56px: Original, Vívido, Retrô 400, Frio, Sépia, P&B, Cine — trocar o filtro deve mudar visivelmente a pré-visualização. Slider de intensidade abaixo.
Controles inferiores: miniatura da última captura, obturador circular branco de 72px, e seletor de modo rolável "FOTO · VÍDEO · TEMPORIZADOR · STOP-MOTION · AR" que troca o modo de verdade.
Modo temporizador: contagem regressiva grande sobre a pré-visualização.
Modo stop-motion: grade de quadros capturados numerados, onion skin do quadro anterior, slider "Taxa de reprodução 6 fps", obturador vermelho.
Modo AR: malha de pontos sobre uma superfície detectada, objeto 3D ancorado com alças, biblioteca de modelos e botões Mover, Girar, Escalar.

═══════════ TELA 4 · EDITOR DE FOTO ═══════════

O layout mais importante do app. Barra superior com voltar, nome do arquivo e ponto de "não salvo", ícones de desfazer, refazer e comparar, e botão "Exportar".
Faixa técnica logo abaixo, em fonte monoespaçada: "6000 × 4000 · Adobe RGB · 14 bits" à esquerda e "RAM 412 MB" à direita.
Canvas central com a foto e barra de zoom.
Barra de ferramentas inferior, rolável, com nove itens: Ajustes, Geometria, Máscaras, Retoque, Camadas, Efeitos, Elementos, IA, Presets. Tocar em um item abre a gaveta correspondente e marca o item em azul; tocar de novo fecha.

Gavetas (painel inferior de ~45% da altura, com abas internas):
- AJUSTES — abas Básico, Curvas, Detalhe, Cor seletiva. Básico tem histograma RGB ao vivo e sliders de Temperatura, Matiz, Saturação, Luminosidade, Vibração e Exposição, com o de Temperatura em trilho degradê azul-laranja. Curvas tem um editor quadrado com grade, histograma ao fundo, curva em S com pontos de controle arrastáveis e botões de canal RGB, R, G e B.
- GEOMETRIA — quatro pontos de perspectiva arrastáveis sobre a imagem, sliders Vertical e Horizontal, botões de rotação 90/180/270 e Auto EXIF, espelhamento horizontal e vertical, e um cartão de sugestão de corte pela regra dos terços.
- MÁSCARAS — abas Pincel, Cor, Foco, Gradiente. Sobreposição vermelha semitransparente na área mascarada, cursor circular de pincel, sliders de Tamanho, Dureza, Fluxo e Tolerância, sliders de ajuste dentro da máscara, e uma fileira de miniaturas de máscaras com ícone de olho.
- RETOQUE — abas Clonagem e Liquify. Círculos de origem e destino ligados por linha tracejada, sliders de pincel.
- CAMADAS — painel LATERAL direito de 280px, não inferior. Lista hierárquica com olho, miniatura, nome e tipo, grupo expansível, camada bloqueada, camada oculta em cinza, e no rodapé slider de opacidade e seletor de modo de mesclagem. Os olhos devem alternar a visibilidade de verdade.
- EFEITOS — abas Retrô, Molduras, Iluminação, Dupla exposição, Overlays. Grade de miniaturas de efeito, sliders de intensidade e mesclagem, seletor de modo de mesclagem, e área de importar overlay.
- ELEMENTOS — abas Texto, Formas, Adesivos, Meme, Colagem. Texto selecionado no canvas com alças e guias de alinhamento magenta que aparecem quando o elemento se aproxima do centro. Amostras de fonte, círculos de cor, chips de animação e sliders de tempo de entrada e saída. A aba Colagem mostra layouts predefinidos em miniatura.
- IA — distintivo verde "No dispositivo" ao lado do título. Abas Recorte, Retrato, Sugestões, Artístico. Barra de resultado com tempo de processamento, botões grandes de Remover fundo, Substituir fundo, Remover objeto e Preencher área, chip de cena detectada com filtros sugeridos, e paleta dominante com cinco cores e seus códigos hex.
- PRESETS — lista de presets salvos e opção de salvar os ajustes atuais como novo preset.

Modo de comparação, acionado pelo ícone de comparar: divisor vertical arrastável sobre a imagem, com "ORIGINAL" à esquerda e "EDITADA" à direita, e histórico de versões em miniaturas.

═══════════ TELA 5 · EDITOR DE VÍDEO ═══════════

Dois painéis verticais separados por uma barra divisória arrastável.
Painel superior: pré-visualização 16:9, tempo corrente "00:02:14:08" e duração em fonte monoespaçada, transporte com início, quadro anterior, reproduzir, quadro seguinte e fim, e distintivo "4K · 30 fps".
Painel inferior: linha do tempo com régua de tempo, cursor de reprodução vermelho arrastável, e cinco faixas de 48px — V2 e V1 de vídeo, TXT de texto, A1 e A2 de áudio com forma de onda verde. Cada faixa tem cabeçalho fixo de 72px com ícone, nome e botões de olho e cadeado. Clipes com cantos retos e nome truncado, arrastáveis para reordenar.
Barra de ferramentas na base: selecionar, cortar, dividir, ripple, zoom, e slider de zoom da linha do tempo.
Estados:
- Clipe selecionado: borda azul, alças de aparo nas extremidades com rótulos de tempo, e segmento hachurado de congelamento de quadro. Painel com abas Aparar, Quadro e Correção, navegação quadro a quadro e interruptor "Revisar em loop".
- Transições: bloco entre dois clipes, biblioteca de doze transições em miniatura, sliders de duração e suavização, e faixa de reordenação de clipes.
- Velocidade: curva de velocidade desenhada sobre o clipe com pontos de controle, trecho lento em azul e acelerado em laranja, chips de 0,25x a 4x, e cartão de time-lapse a partir de fotos.
- Áudio: faixas expandidas para 72px, alças de fade nas pontas, medidor de nível L/R com escala de -60 a 0 dB, sliders de volume, ganho e fades, e lista de trilhas de fundo.
- IA: legendas geradas automaticamente em lista editável com intervalos de tempo, e miniaturas animadas em GIF.
- Avançado: picture-in-picture redimensionável sobre a pré-visualização, controles de vídeo 360 com orientação e campo de visão, e estabilização por giroscópio com barra de processamento.

═══════════ TELA 6 · EXPORTAÇÃO ═══════════

Folha modal cobrindo 85% da altura sobre o editor. Abas "RÁPIDO · PROFISSIONAL · MARCA D'ÁGUA".
Rápido: chips de formato JPEG, PNG, WebP, HEIC, GIF; slider de qualidade que atualiza a estimativa de tamanho em tempo real; chips de tamanho; predefinições de rede social com resolução.
Profissional: cartões PSD e TIFF, caixas de seleção para manter camadas e máscaras, chips de DPI, interruptor de simulação CMYK com aviso em laranja, e botões de rádio para sRGB, Adobe RGB e DCI-P3.
Marca d'água: pré-visualização com marca de texto e QR code sobre a foto, grade de nove posições, sliders de opacidade, tamanho e rotação, campo de link do QR com validação, e opção de salvar como preset.
Ao exportar, mostra progresso e depois o estado concluído com miniatura, tamanho final, resolução, tempo decorrido e ícones de compartilhamento.

═══════════ TELA 7 · COMUNIDADE ═══════════

Abas "EM ALTA · RECENTES · MINHAS EDIÇÕES · REVISÕES". Cartões de publicação com autor, imagem, título, metadados, pontuação em estrelas, contadores de comentários e de anotações vocais. Botão flutuante estendido "Enviar edição".
Detalhe da publicação: imagem, faixa verde de assinatura digital verificável com autor e data, bloco de pontuação com média e número de avaliações, abas de Comentários, Áudio e Ajustes usados, lista de comentários, cartões de anotação vocal com forma de onda e botão de play, e campo de composição no rodapé com ícone de microfone.
Modo colaborativo dentro do editor de foto: avatares sobrepostos na barra superior, cursores remotos nomeados sobre o canvas, faixa de atividade "Marina aplicou Máscara de céu · agora", e cartão de resolução de conflito com as opções "Manter minha" e "Usar de Marina".

═══════════ O QUE PRECISA FUNCIONAR ═══════════

Priorize estas interações acima de qualquer refinamento visual:
1. Toda a navegação entre as sete telas, ida e volta, sem beco sem saída.
2. Gaveta lateral abre e fecha.
3. Abas trocam conteúdo de verdade em todas as telas.
4. Gavetas de ferramenta do editor abrem, fecham e destacam o item ativo na barra inferior.
5. Sliders arrastam e atualizam o número exibido ao lado.
6. Divisor de antes/depois arrasta e revela a imagem original.
7. Olhos das camadas alternam visibilidade.
8. Seleção múltipla em Projetos com contagem correta na barra contextual.
9. Fluxo de exportação até a tela de concluído.
10. Cursor de reprodução da linha do tempo arrasta e atualiza o tempo corrente.

═══════════ DADOS DE EXEMPLO ═══════════

Use conteúdo real, nunca lorem ipsum. Usuário "João Silva". Projetos: "Ensaio Praia 04" RAW, "Viagem Litoral" MP4 4K, "Retrato Marina" PSD, "Feira do Centro" JPEG, "Trilha Serra" MOV, "Logo Cliente" PNG. Fotos de praia ao entardecer, retrato em ambiente externo e estrada costeira. Legendas de vídeo em português coloquial. Comentários da comunidade com crítica técnica concreta, no estilo "O céu ficou ótimo, mas a pele puxou muito para o magenta na sombra."

═══════════ NÃO FAÇA ═══════════

Não use bottom navigation. Não arredonde cantos além de 2px. Não use gradiente, sombra difusa, blur ou transparência decorativa. Não use ícones preenchidos nem emoji. Não use tema claro em nenhuma tela. Não invente uma paleta colorida: o azul #3A8FDE é o único acento do app inteiro. Não crie telas separadas para gavetas e painéis — eles são estado. Não use texto em inglês em nenhum rótulo da interface.