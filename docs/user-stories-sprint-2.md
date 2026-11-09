# User stories — Sprint 2 e adiantadas da Sprint 3

Texto das histórias, critérios de aceite e requisitos, tirado de `backlog/`. Não descreve o que foi entregue (isso está em `docs/entregas-sprint-2.md`).

## Sprint 2 (planejadas)

### US-01 — Central de projetos

> Como usuário do PixelMorph, quero acessar uma tela inicial com meus projetos organizados em grade, metadados detalhados e lembretes de pendências, para gerenciar meu trabalho de forma rápida e segura em qualquer dispositivo.

**Critérios de aceite**

- A tela principal exibe todos os projetos em grade, com miniatura automática, data de modificação e tipo de mídia. [RF-001]
- O painel de propriedades mostra dimensões, taxa de bits, codificação e histórico de edições de cada mídia. [RF-037]
- Notificações lembram o usuário de projetos pendentes, com prazo e prioridade configuráveis. [RF-070]
- A conta é opcional: o app e os projetos locais funcionam sem ela; recursos que usam a conta ou a nuvem exigem login por e-mail/senha ou Google, com e-mail de verificação na criação da conta. [RNF-001]
- Toda sincronização de projetos com o servidor usa HTTPS com certificado válido. [RNF-002]
- O app inicializa em menos de 3 segundos em dispositivos Android 9 ou superior. [RNF-007]
- A instalação inicial ocupa no máximo 200 MB, com recursos extras baixados sob demanda. [RNF-014]
- A tela se adapta corretamente a resoluções entre 480x800 e 1440x3120 pixels. [RNF-015]
- A interface está disponível em português, inglês e espanhol, com novos idiomas carregáveis dinamicamente. [RNF-016]

**Requisitos**

- RF-001 — Grade de projetos recentes
- RF-037 — Relatório de metadados da mídia
- RF-070 — Notificações de projetos não finalizados
- RNF-001 — Autenticação de conta com e-mail e verificação
- RNF-002 — Comunicação exclusivamente por canal seguro
- RNF-007 — Tempo de inicialização
- RNF-014 — Espaço de instalação
- RNF-015 — Suporte a faixa de resoluções de tela
- RNF-016 — Suporte a múltiplos idiomas

### US-10 — Composição gráfica: colagens, textos e elementos vetoriais

> Como usuário, quero montar colagens, adicionar textos animados, formas vetoriais e memes sobre minhas fotos e vídeos, para criar composições gráficas completas.

**Critérios de aceite**

- É possível criar colagens com layouts predefinidos ou personalizados, ajustando bordas, sombras e espaçamento. [RF-011]
- Setas, círculos e formas geométricas podem ser inseridas com cor e espessura personalizáveis. [RF-044]
- É possível montar memes com texto superior/inferior, fontes padrão e stickers. [RF-046]
- Textos podem ser sobrepostos com múltiplas fontes, cores, sombras, contornos e animações de entrada/saída com temporização ajustável. [RF-008]

**Requisitos**

- RF-011 — Colagens de fotos
- RF-044 — Sobreposição de gráficos vetoriais
- RF-046 — Criação de memes
- RF-008 — Texto sobreposto com estilos e animações

### US-12 — Comparação, guias e atalhos de produtividade

> Como editor de fotos, quero comparar antes/depois, contar com guias de alinhamento automáticas e usar atalhos rápidos, para editar com mais precisão e velocidade.

**Critérios de aceite**

- A imagem original e a editada podem ser comparadas lado a lado com divisor deslizante. [RF-019]
- Guias de alinhamento surgem automaticamente ao arrastar elementos, ajudando a centralizar e distribuir objetos. [RF-067]
- Atalhos rápidos permitem desfazer, refazer, salvar e trocar ferramentas sem passar por menus. [RF-076]

**Requisitos**

- RF-019 — Comparação lado a lado (antes e depois)
- RF-067 — Guias de alinhamento magnético
- RF-076 — Atalhos de teclado virtual

### US-16 — Transições e montagem de múltiplos clipes

> Como editor de vídeos, quero aplicar transições entre cenas e unir múltiplos clipes em um só vídeo, para montar um vídeo final coeso a partir de gravações separadas.

**Critérios de aceite**

- Transições como desvanecimento, deslize, zoom e wipe podem ser aplicadas com duração ajustável e pré-visualização ao vivo. [RF-032]
- Vários clipes podem ser reordenados por arrasto e unidos em um único vídeo, com transições personalizadas entre eles. [RF-058]

**Requisitos**

- RF-032 — Transições entre cenas
- RF-058 — União de múltiplos clipes

### US-17 — Controle de velocidade: câmera lenta, aceleração e time-lapse

> Como editor de vídeos, quero alterar a velocidade de reprodução de trechos e gerar time-lapses a partir de sequências de fotos, para criar efeitos dinâmicos de tempo no meu vídeo.

**Critérios de aceite**

- A velocidade de reprodução pode ser alterada em pontos específicos, com transições suaves entre velocidades. [RF-049]
- Uma sequência de fotos pode virar um vídeo time-lapse, com controle de velocidade, transições e trilha sonora. [RF-023]

**Requisitos**

- RF-049 — Câmera lenta e aceleração de trechos
- RF-023 — Time-lapse a partir de sequência de fotos

### US-30 — Exportação em múltiplos formatos e otimização de tamanho

> Como usuário, quero exportar minhas fotos e vídeos em diferentes formatos e presets, com arquivos otimizados e exportação rápida, para compartilhar meu conteúdo com qualidade e agilidade.

**Critérios de aceite**

- Fotos podem ser exportadas em JPEG, PNG, WebP e HEIC, com controle de qualidade e compressão por formato. [RF-057]
- Vídeos podem ser exportados como GIF animado, com controle de taxa de quadros e número de cores. [RF-061]
- Vídeos podem ser exportados com presets por rede social, ajustando resolução, taxa de bits e compressão automaticamente. [RF-017]
- O tamanho do arquivo exportado é reduzido com perda mínima de qualidade, ajustando a compressão à complexidade da cena. [RNF-013]
- A exportação de um vídeo de 1 minuto em Full HD leva no máximo 2 minutos em dispositivos mid-range. [RNF-011]

**Requisitos**

- RF-057 — Exportação de imagens em múltiplos formatos
- RF-061 — Exportação em GIF animado
- RF-017 — Exportação de vídeo com presets de redes sociais
- RNF-013 — Compressão inteligente de arquivos
- RNF-011 — Tempo de exportação de vídeo

### US-33 — Captura e trilha de áudio no vídeo

> Como criador de vídeos, quero gravar áudio durante a captura e adicionar trilhas de fundo com controle de volume e fades, para dar acabamento sonoro completo ao meu vídeo.

**Critérios de aceite**

- O áudio é gravado em faixa separada durante a captura de vídeo, com monitoramento em tempo real e ajuste de ganho. [RF-018]
- Trilhas de áudio de fundo podem ser adicionadas com ajuste de volume, fade in/out e sincronização com os cortes da linha do tempo. [RF-036]

**Requisitos**

- RF-018 — Gravação de áudio durante a captura de vídeo
- RF-036 — Trilha de áudio de fundo

## Sprint 3 (adiantadas nesta sprint)

### US-02 — Presets e edição em lote

> Como editor, quero salvar combinações de ajustes como presets reutilizáveis e aplicar o mesmo conjunto de ajustes a várias fotos de uma vez, para agilizar meu fluxo de trabalho em projetos com muitas mídias.

**Critérios de aceite**

- É possível nomear e salvar um preset a partir dos ajustes aplicados a uma mídia, reutilizável em outras mídias com um toque. [RF-014]
- É possível selecionar duas ou mais fotos e aplicar o mesmo conjunto de ajustes, filtros e redimensionamento simultaneamente, com progresso exibido em tempo real. [RF-015]

**Requisitos**

- RF-014 — Presets personalizados de edição
- RF-015 — Edição em lote

### US-06 — Máscaras e seleção localizada

> Como editor de fotos, quero criar máscaras e seleções localizadas por pincel, cor, foco ou gradiente, para aplicar ajustes apenas nas áreas que desejo.

**Critérios de aceite**

- É possível pintar uma máscara sobre qualquer área da imagem e aplicar ajustes de brilho, contraste ou saturação só ali. [RF-007]
- É possível criar máscaras selecionando um tom de cor e ajustando a tolerância. [RF-038]
- É possível tocar em um ponto da imagem para defini-lo como foco, desfocando o restante gradualmente. [RF-045]
- É possível aplicar gradientes lineares ou radiais com controle de ângulo e posição central. [RF-072]

**Requisitos**

- RF-007 — Pincéis de máscara com ajustes localizados
- RF-038 — Máscara por seleção de cor
- RF-045 — Foco seletivo
- RF-072 — Filtros de gradiente linear e radial

### US-07 — Retoque e distorção

> Como editor de fotos, quero clonar texturas e distorcer áreas da imagem com o dedo, para retocar ou transformar formas de maneira criativa.

**Critérios de aceite**

- A ferramenta de clonagem copia texturas de uma área para outra com mesclagem suave e pincel de tamanho ajustável. [RF-022]
- A distorção liquify permite empurrar, puxar ou girar áreas da imagem em tempo real, com intensidade e tamanho de pincel ajustáveis. [RF-026]

**Requisitos**

- RF-022 — Ferramenta de clonagem
- RF-026 — Distorção liquify

### US-13 — Visualização 3D de fotos estereoscópicas

> Como usuário com fotos estereoscópicas, quero visualizar um efeito de profundidade que reage ao movimento do dispositivo, para uma experiência de visualização em 3D.

**Critérios de aceite**

- O app detecta fotos estereoscópicas importadas e cria efeito de profundidade que responde ao movimento do dispositivo (giroscópio), podendo ser pausado ou desativado. [RF-071]

**Requisitos**

- RF-071 — Visualização 3D de fotos estereoscópicas

### US-18 — Estabilização de vídeo por sensores

> Como criador de vídeos, quero que tremores da gravação sejam corrigidos automaticamente usando os sensores do dispositivo, para obter vídeos mais estáveis sem esforço manual.

**Critérios de aceite**

- A estabilização usa dados de giroscópio e acelerômetro capturados durante a gravação, processados em segundo plano, podendo ser aplicada ou removida após a gravação. [RF-009]

**Requisitos**

- RF-009 — Estabilização de vídeo por sensores

### US-19 — Edição de vídeo em 360 graus

> Como criador de conteúdo 360°, quero ajustar orientação e recortar ângulos específicos de um vídeo 360, para exportar clipes tradicionais a partir de gravações imersivas.

**Critérios de aceite**

- É possível ajustar a orientação do vídeo 360, recortar ângulos específicos como um clipe convencional e exportar preservando a projeção equirretangular quando aplicável. [RF-021]

**Requisitos**

- RF-021 — Edição de vídeo em 360 graus

### US-20 — Picture-in-picture

> Como editor de vídeos, quero sobrepor um vídeo menor dentro de outro, para criar composições com duas fontes de vídeo simultâneas.

**Critérios de aceite**

- O vídeo secundário pode ser posicionado e redimensionado livremente sobre o principal, com ajuste de borda. [RF-065]

**Requisitos**

- RF-065 — Picture-in-picture

### US-22 — Captura assistida: temporizador e stop-motion

> Como usuário, quero capturar fotos e vídeos com temporizador ou em sequência de quadros para stop-motion, para ter mais controle sobre o momento da captura.

**Critérios de aceite**

- É possível configurar um temporizador com contagem regressiva visual, usando câmera frontal ou traseira. [RF-039]
- É possível capturar quadros individuais em sequência (exibidos em grade) e ajustar a taxa de reprodução para montar vídeos em stop-motion. [RF-043]

**Requisitos**

- RF-039 — Captura com cronômetro e contagem regressiva
- RF-043 — Criação de vídeos em stop-motion

### US-24 — Recorte e remoção inteligente de elementos

> Como usuário, quero que o app identifique e remova automaticamente objetos ou fundos indesejados da minha foto, para agilizar composições sem recorte manual.

**Critérios de aceite**

- O objeto principal da foto é identificado automaticamente, permitindo remover ou substituir o fundo com um toque. [RF-004]
- Um objeto indesejado pode ser circulado e removido, com preenchimento automático baseado nas texturas vizinhas. [RF-055]

**Requisitos**

- RF-004 — Recorte inteligente com troca de fundo
- RF-055 — Remoção de objetos com preenchimento automático

### US-25 — Efeitos de retrato e correção facial automática

> Como usuário, quero que o app detecte rostos e profundidade de cena para aplicar efeitos de retrato e corrigir imperfeições automaticamente, com todo o processamento feito localmente no dispositivo para preservar minha privacidade.

**Critérios de aceite**

- Filtros que reagem à cena, como desfoque de fundo baseado em profundidade, podem ser aplicados. [RF-012]
- Múltiplos rostos são detectados individualmente, permitindo ajustar suavização de pele, realce de olhos e tom por rosto. [RF-016]
- Olhos vermelhos e imperfeições de pele são detectados e corrigidos automaticamente. [RF-025]
- Toda a detecção facial e correção de imperfeições ocorre localmente no dispositivo, sem envio de imagens a servidores. [RNF-004]

**Requisitos**

- RF-012 — Filtros dinâmicos por conteúdo da cena
- RF-016 — Detecção facial com efeitos por rosto
- RF-025 — Correção de olhos vermelhos e imperfeições de pele
- RNF-004 — Processamento local de dados biométricos

### US-26 — Sugestões automáticas de cor, cena e enquadramento

> Como usuário, quero receber sugestões automáticas de paleta de cores, filtros por tipo de cena e enquadramento, entregues rapidamente, para obter bons resultados sem conhecimento técnico de edição.

**Critérios de aceite**

- A paleta de cores dominantes é extraída automaticamente, com sugestões de combinações harmônicas. [RF-010]
- O conteúdo da imagem é classificado por cena (paisagem, retrato, comida, animais, urbano), com sugestão automática de filtros e ajustes. [RF-034]
- A composição da foto é analisada e sugestões de corte são apresentadas com base em regras de composição (terços, proporção áurea, linhas de convergência). [RF-042]
- A recomendação de filtros é processada e exibida em menos de 500 ms em dispositivos medianos. [RNF-012]

**Requisitos**

- RF-010 — Paleta de cores dominantes e sugestões harmônicas
- RF-034 — Reconhecimento de cena para sugestão de ajustes
- RF-042 — Sugestão de enquadramento por composição
- RNF-012 — Latência da recomendação de filtros

### US-27 — Filtros artísticos por IA

> Como usuário, quero transformar minhas fotos em estilos artísticos como aquarela, óleo ou desenho a carvão, para criar versões artísticas das minhas imagens com um toque.

**Critérios de aceite**

- Pelo menos os estilos aquarela, óleo e desenho a carvão estão disponíveis, com intensidade ajustável e comparação com a imagem original. [RF-050]

**Requisitos**

- RF-050 — Filtros artísticos por IA

### US-28 — Alinhamento automático para panorama

> Como usuário, quero combinar múltiplas imagens em um panorama automaticamente, para criar fotos panorâmicas sem alinhar manualmente cada imagem.

**Critérios de aceite**

- O app detecta pontos de correspondência entre as imagens e as alinha automaticamente em um único panorama, permitindo correção manual de erros perceptíveis. [RF-062]

**Requisitos**

- RF-062 — Alinhamento automático para panorama

### US-29 — Automação de vídeo: miniaturas e legendas por IA

> Como criador de vídeos, quero que o app gere automaticamente miniaturas animadas e legendas a partir do meu vídeo, para economizar tempo de pós-produção.

**Critérios de aceite**

- Os quadros mais representativos do vídeo são selecionados automaticamente para gerar um GIF curto como miniatura. [RF-030]
- Legendas são geradas automaticamente a partir do áudio do vídeo, com edição manual do texto gerado. [RF-069]

**Requisitos**

- RF-030 — Miniatura animada de vídeo
- RF-069 — Legendas automáticas por reconhecimento de fala

### US-31 — Exportação para fluxos profissionais: PSD, impressão e gerenciamento de cor

> Como usuário avançado, quero exportar projetos preservando camadas, com suporte a alta resolução para impressão e a diferentes espaços de cor, para integrar meu trabalho a fluxos profissionais.

**Critérios de aceite**

- O projeto pode ser exportado em PSD mantendo camadas, ajustes e máscaras. [RF-040]
- É possível exportar com suporte a 300 DPI e simulação de perfil CMYK para impressão. [RF-073]
- É possível escolher entre os espaços de cor sRGB, Adobe RGB e DCI-P3, preservando a fidelidade cromática entre dispositivos. [RF-051]

**Requisitos**

- RF-040 — Exportação de projeto em PSD
- RF-073 — Exportação para impressão em alta resolução
- RF-051 — Gerenciamento de espaços de cor

### US-32 — Marca d'água e QR code personalizados

> Como usuário, quero adicionar marca d'água e QR code personalizados às minhas exportações, para proteger minha autoria e direcionar quem vê a imagem para outros canais.

**Critérios de aceite**

- Marca d'água de texto ou logo pode ser posicionada livremente, com transparência, tamanho e rotação ajustáveis, salvável como preset. [RF-020]
- QR codes com link ou texto podem ser gerados e posicionados sobre a imagem, validados como legíveis antes da exportação. [RF-066]

**Requisitos**

- RF-020 — Marca d'água personalizada
- RF-066 — Geração de QR Code a partir da imagem

### US-36 — Galeria de amostras e tutoriais interativos

> Como novo usuário, quero acessar uma galeria de projetos de exemplo que funcionam como tutoriais interativos, para aprender a usar as ferramentas do app na prática.

**Critérios de aceite**

- A galeria apresenta projetos de exemplo prontos, que guiam o usuário por passos interativos das principais ferramentas, podendo ser interrompida a qualquer momento. [RF-056]

**Requisitos**

- RF-056 — Galeria de amostras e tutoriais interativos
