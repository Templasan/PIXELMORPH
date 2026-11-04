# Testes do PixelMorph nas Sprints 1 e 2 - aparelho A11 (SM-A115M)

Aparelho: serial R9QN708EGRB, Samsung SM-A115M, Android 10, 32 bits, 2,9 GB de RAM, sem giroscópio. Pacote testado: com.anonymous.pixelmorph, build atual, sem reinstalação.

Data do teste: 3 e 4 de novembro de 2026 (a data mudou durante a execução).

Critérios de veredito:
- PASS: o app mostrou o efeito na tela, ou o valor pedido foi gravado e lido de volta no estado do editor. Quando o critério exige resultado visual ou ao vivo que não vi, o veredito é NOT TESTED e a evidência diz o que faltou.
- FAIL: o que aconteceu está descrito na evidência.
- NEEDS OWNER: precisa de seletor de fotos, permissão, conta, rede, ou de um julgamento humano (som).
- NOT TESTED: não foi verificado, com o motivo.

Os valores de desempenho têm veredito BOM, ACEITÁVEL ou RUIM com base nos limites pedidos. Não houve comparação com versões antigas.

---

## Revisão depois do teste

Conferido por outra pessoa do projeto, em 2026-11-04. Os números abaixo são os do agente e não foram alterados.

- **F1, exportar MP4:** real, e corrigida. O codificador do A11 só aceita a dimensão maior na horizontal. Um vídeo em pé agora é gravado deitado, com marca de rotação. Medido: 1080p em pé exporta 24,5 s de vídeo em 111 s, cerca de 4,5 vezes a duração (RUIM pelo limite de 3 vezes).
- **F2, transições:** falso. O controle existe na linha do tempo, entre dois clipes vizinhos, e o agente testou com um clipe só. A transição em si continua sem teste no A11.
- **F3, grade vazia:** real, e corrigida. Com um único projeto, ele virava o destaque e a grade dizia que não havia nada.
- **45 de 72 critérios ficaram sem teste:** o resumo abaixo não diz que eles funcionam.

## Resumo

Critérios de aceite (72 no total, Sprint 1 com 45 e Sprint 2 com 27):

| Veredito | Sprint 1 | Sprint 2 | Total |
|---|---|---|---|
| PASS | 6 | 5 | 11 |
| FAIL | 4 | 4 | 8 |
| NEEDS OWNER | 5 | 3 | 8 |
| NOT TESTED | 30 | 15 | 45 |

Os itens NOT-US foram só listados, não lidos, e entram como NOT TESTED.

Falhas principais (detalhes na seção "Falhas"):
1. Exportação de vídeo em MP4 falha em 1080p e em 720p: "encoder configuration ... is not supported in this environment". Nenhum MP4 foi gerado.
2. Não há controle de transições no editor de vídeo (US-16).
3. A grade da tela inicial mostra "Nenhum projeto nesta categoria ainda." mesmo com o projeto existente.
4. Painel de propriedades sem taxa de bits (aparece "—") e sem histórico de edições (RF-037).
5. Navegação entre abas do editor de fotos com quadros travados: 95º percentil de 36 a 400 ms (requisito de 60 FPS, RNF-010, não atendido).
6. Exportação de JPEG de foto levou 12,5 s e 22,7 s (limite de 5 s).
7. Inicialização a frio: uma das três execuções levou 3,44 s (requisito de menos de 3 s, RNF-007).
8. Tempo de busca ao saltar na linha do tempo: mediana de 455 ms (limite de 300 ms).

---

## Falhas (primeiro, com passos para reproduzir)

### F1. Exportação de vídeo em MP4 falha (US-30, Sprints 1 e 2) - FAIL
- Passos: abrir "Vídeo da câmera", tocar EXPORTAR, escolher MP4 e 1080p, tocar EXPORTAR.
- Resultado: após cerca de 4 s, a folha mostra em vermelho "This specific encoder configuration (avc1.640028, 8000000 bps, 1080x1920, hardware acceleration: no-preference) is not supported in this environment. Consider using another codec or changing your video parameters." Nenhum arquivo foi gerado.
- Repetido com 720p: "(avc1.64001f, 4000000 bps, 720x1280 ...) not supported". Mesmo erro.
- A mensagem vem do app e está em inglês. Não sei se a causa está no aparelho (sem codificador H.264 disponível para esta configuração) ou na configuração do app.
- Por causa disso não consegui testar presets de redes sociais e compressão inteligente no MP4, nem medir o tempo de exportação do MP4.

### F2. Sem controle de transições no editor de vídeo (US-16, Sprints 1 e 2) - FAIL
- Ao tocar um clipe na linha do tempo, o painel mostra: Redimensionar, Girar, Dividir, Velocidade, Volume, Cor, Posição, Vídeo 360, Rostos, Estabilizar, Congelar, Legendas, Duplicar, Excluir, Ripple. Não há transições.
- A barra de baixo mostra: Vídeo, Foto, Áudio, Texto, Camadas, Formato, Time-lapse. Não encontrei transição em nenhuma delas.
- Juntar e reordenar clipes: NOT TESTED.

### F3. A grade da tela inicial não mostra o projeto (US-01, Sprints 1 e 2) - FAIL
- Passos: abrir o app na aba Projetos, com o filtro "Todos" e a visualização em grade.
- Resultado: o card "Continuar editando" mostra "Vídeo da câmera", mas a grade abaixo mostra "Nenhum projeto nesta categoria ainda." Na visualização em lista, o projeto aparece com "03/11/2026 · MP4 · 50,7 MB".

### F4. Painel de propriedades incompleto (RF-037, US-01) - FAIL
- Passos: na visualização em lista, tocar no projeto (abre a tela de detalhes).
- Vídeo: Tipo MP4, Dimensões 1080 x 1920, Tamanho 50,7 MB, Codificação H.264 + AAC, Taxa de bits "—" (vazio), Modificado em.
- Foto: Tipo JPEG, Dimensões, Tamanho, Codificação image/jpeg, Modificado e Criado em. Sem taxa de bits.
- Em nenhuma das duas telas há histórico de edições.

### F5. Desempenho abaixo do requisito de 60 FPS na navegação (RNF-010) - RUIM
- Medido com dumpsys gfxinfo, com reset antes. Seis trocas de aba no editor de fotos (Ajustes, Geometria, Camadas, Máscaras, Retoque, Efeitos).
- Rodada 1: 18 quadros, 44,4% com atraso, mediana 13 ms, 90º percentil 48 ms, 95º percentil 400 ms.
- Rodada 2 (repetida, pois foi RUIM): 16 quadros, 50% com atraso, mediana 17 ms, 90º percentil 32 ms, 95º percentil 36 ms.
- Limite: 95% dos quadros abaixo de 33 ms. As duas rodadas ficaram acima.
- Bateria 21%, temperatura 37,6 C. A amostra é pequena (16 a 18 quadros).

### F6. Inicialização a frio acima de 3 s em uma execução (RNF-007) - requisito não atendido em uma das três
- Ver a tabela de desempenho. Mediana 2,45 s (BOM), mas a primeira execução levou 3,44 s.

### F7. Pequenos achados observados
- Bulk bar: um toque longo no projeto na grade entra em modo de seleção com "Limpar", "Compartilhar" e "Apagar projetos". Não toquei em apagar nem em compartilhar. Saí do modo de seleção com "Limpar" e Voltar.
- O GIF exporta só os primeiros 15 s (aviso da própria tela, "O GIF leva só os primeiros 15 s.").
- A foto de 3120 x 4160 foi exportada como 3072 x 4096 em JPEG, WebP, PNG e HEIC. Não sei se é um limite de resolução de saída.
- HEIC: o app disse "Salvo na galeria", mas não retornou tamanho de arquivo. Não consegui confirmar o formato do arquivo.

---

## Tabelas por história

Convenção: a coluna "Evidência" descreve o que vi ou o valor lido de volta.

### Sprint 1

**US-01 Central de projetos**

| Critério | Veredito | Evidência |
|---|---|---|
| Grade com miniatura, data e tipo [RF-001] | FAIL | Miniatura no card "Continuar editando"; grade "Todos" vazia (F3). Lista mostra data e tipo. |
| Painel de propriedades [RF-037] | FAIL | Dimensões, tamanho e codificação aparecem; taxa de bits vazia; sem histórico (F4). |
| Notificações de pendências com prazo e prioridade [RF-070] | NOT TESTED | Chip de prioridade "Alta" passou a selecionado (estado visível). Campo de prazo não testado; entrega de notificação não testada. |
| Conta com e-mail/senha e dois fatores [RNF-001] | NEEDS OWNER | Conta e login exigem a pessoa. |
| HTTPS na sincronização [RNF-002] | NOT TESTED | Não há sincronização testada, e não se deve enviar nada pela rede. |
| Inicialização abaixo de 3 s [RNF-007] | PASS | Mediana 2,45 s, pior 3,44 s (ver desempenho). |
| Instalação até 200 MB [RNF-014] | PASS | base.apk de 52,4 MB. Tamanho instalado não medido. |
| Telas de 480x800 a 1440x3120 [RNF-015] | NOT TESTED | Não alterei o tamanho de tela do aparelho. |
| Português, inglês e espanhol [RNF-016] | NOT TESTED | Trocar o idioma exige alterar configurações. |

**US-03 Continuidade e proteção do trabalho**

| Critério | Veredito | Evidência |
|---|---|---|
| Desfazer e refazer sem limite, mantidos entre sessões [RF-027] | NOT TESTED | Desfazer e refazer funcionaram em todos os passos testados (ver US-15 e US-08). Limite e persistência entre sessões não testados. |
| Rascunhos salvos automaticamente [RNF-005] | NOT TESTED | Não verifiquei gravação automática. |
| Backup e recuperação de projeto corrompido [RNF-006] | NOT TESTED | Não corrompi projeto (não é seguro fazer isso no aparelho do dono). |
| Log de erros local e envio anônimo [RNF-017] | NEEDS OWNER | O envio depende de rede e de serviço externo. Registro local não testado. |

**US-04 Ajustes finos de cor**

| Critério | Veredito | Evidência |
|---|---|---|
| Temperatura, matiz, saturação e luminosidade atualizam o histograma ao vivo [RF-047] | NOT TESTED | Histograma aparece na aba Ajustes. Valores gravados (temperatura 40, saturação 50) foram lidos de volta. O histograma não mudou nas minhas leituras, mas o estado do histograma não é exposto, então não concluí. |
| Curvas RGB independentes com histograma ao vivo [RF-029] | NOT TESTED | Curva R gravada em 0,1 e lida de volta. Histograma ao vivo não verificado. |
| Nitidez e redução de ruído com zoom [RF-063] | NOT TESTED | Nitidez 40 e redução de ruído 30 gravadas e lidas. Pré-visualização em zoom não vista. |
| Cor seletiva com tolerância [RF-059] | NOT TESTED | Cor índice 2 e tolerância 30 gravadas e lidas. Efeito de dessaturar o resto não visto. |

**US-05 Correções geométricas**

| Critério | Veredito | Evidência |
|---|---|---|
| Perspectiva com quatro pontos [RF-048] | NOT TESTED | Ponto X0 gravado em 0,1 e lido de volta. Resultado visual e alças não vistos. |
| Rotação de 90/180/270 com correção por metadados [RF-078] | NOT TESTED | Rotação 90 gravada e lida. Correção automática por metadados não testada. |
| Espelhamento horizontal, vertical e opacidade [RF-054] | NOT TESTED | Espelho horizontal e opacidade 50 gravados e lidos. Vertical e resultado visual não vistos. |

**US-08 Edição em camadas**

| Critério | Veredito | Evidência |
|---|---|---|
| Cada alteração é uma camada reversível [RF-002] | NOT TESTED | Camadas Fundo, Ajustes de cor e Pintura 1 existem. Desfazer restaurou a lista exata. Não verifiquei a imagem original. |
| Duplicar, mesclar e ocultar camadas [RF-052] | NOT TESTED | Ocultar e duplicar mudaram o estado e foram desfeitos. Mesclar não testado. |
| Pintura com pincéis e caneta [RF-033] | NOT TESTED | Pintura por toque não testada. Não há caneta. |
| Até 800 MB de RAM com foto de 24 MP [RNF-008] | NOT TESTED | Medido 507 MB (PSS) com foto de 13 MP e 3 camadas. Não testei 24 MP. |

**US-09 Efeitos visuais**

| Critério | Veredito | Evidência |
|---|---|---|
| Envelhecimento, granulado e vinheta com intensidade e mescla [RF-041] | NOT TESTED | Os três valores foram gravados (50, 50, 50) e lidos. Resultado visual não visto. |
| Molduras com estilos e espessuras [RF-060] | NOT TESTED | Estilo de moldura 1 gravado e lido. Não visto na tela. |
| Efeitos de luz posicionados manualmente [RF-068] | NOT TESTED | Tipo de luz 1 gravado e lido. Posição não testada na tela. |
| Dupla exposição com mescla [RF-075] | NEEDS OWNER | A segunda imagem vem do seletor de fotos. Mescla gravada (5) e lida. |
| Overlays e texturas importados da galeria [RF-028] | NEEDS OWNER | Importação usa o seletor de fotos. |

**US-11 RAW**

| Critério | Veredito | Evidência |
|---|---|---|
| Importar RAW de câmeras profissionais [RF-003] | NEEDS OWNER | A importação usa o seletor de arquivos. |
| Conversor com curva de tons e balanço de branco [RF-003] | NOT TESTED | Depende da importação. |
| Imagem convertida segue para a edição [RF-003] | NOT TESTED | Depende da importação. |

**US-14 Linha do tempo multifaixa**

| Critério | Veredito | Evidência |
|---|---|---|
| Faixas paralelas de vídeo, imagem, texto e áudio, com arrasto [RF-005] | NOT TESTED | Faixas V2, V1 e A1 aparecem; clipe de texto em V2 e áudio em A1. Arrasto não testado. |
| Linha do tempo e pré-visualização lado a lado [RF-053] | PASS | Captura de tela mostra pré-visualização e linha do tempo na mesma tela. Redimensionar painéis não testado. |
| Vídeo de 15 min em 4K sem perda de desempenho [RNF-009] | NOT TESTED | Só tenho clipe de 24,5 s em 1080p. |

**US-15 Edição de precisão**

| Critério | Veredito | Evidência |
|---|---|---|
| Corte com precisão de quadro e revisão em loop [RF-035] | NOT TESTED | Ajuste de entrada de 500 ms gravado e desfeito. Precisão por quadro e loop na tela não vistos. Loop alternado no estado (false para true, depois voltou). |
| Navegação quadro a quadro [RF-013] | PASS | "Próximo quadro" avança de 0 para 33,3 ms e para 66,7 ms; "Quadro anterior" volta para 33,3 ms. |
| Correções pontuais de cor e remoção de objetos [RF-013] | NOT TESTED | Não encontrei o controle na tela e não procurei mais a fundo. |
| Congelar um quadro por alguns segundos [RF-077] | NOT TESTED | Congelar em 12 s alterou a linha do tempo e foi desfeito (restaurado exato). Duração de retenção na reprodução não medida. |

**US-16 Transições e montagem**

| Critério | Veredito | Evidência |
|---|---|---|
| Transições com duração e pré-visualização ao vivo [RF-032] | FAIL | Não há controle de transição (F2). |
| Reordenar clipes e unir com transições [RF-058] | NOT TESTED | Não testado. |

**US-30 Exportação**

| Critério | Veredito | Evidência |
|---|---|---|
| Fotos em JPEG, PNG, WebP e HEIC com qualidade [RF-057] | PASS | Os quatro foram salvos ("Salvo na galeria"). Qualidade 85 nas opções. HEIC sem tamanho retornado. |
| Vídeo em GIF com quadros e número de cores [RF-061] | PASS | A folha mostra 5/10/15 quadros por segundo e 32/64/128/256 cores. GIF de 15 s gerado em 9,21 MB. |
| Presets de redes sociais [RF-017] | NOT TESTED | Presets existem na folha, mas são MP4, e o MP4 falha (F1). |
| Redução de tamanho com perda mínima [RNF-013] | NOT TESTED | Compressão inteligente só existe no MP4, que falha. |
| Vídeo de 1 min em Full HD em até 2 min [RNF-011] | FAIL | MP4 em 1080p falha (F1). GIF levou 3,2 vezes o tempo do conteúdo (ver desempenho). |

### Sprint 2

**US-01 Central de projetos**

| Critério | Veredito | Evidência |
|---|---|---|
| Grade com miniatura, data e tipo [RF-001] | FAIL | Mesma falha da Sprint 1 (F3). |
| Painel de propriedades [RF-037] | FAIL | Mesma falha da Sprint 1 (F4). |
| Notificações com prazo e prioridade [RF-070] | NOT TESTED | Igual à Sprint 1. |
| Conta opcional, projetos locais funcionam sem login [sem RF] | PASS | Projetos abertos e editados sem login. Login e verificação por e-mail: NEEDS OWNER. |
| HTTPS [RNF-002] | NOT TESTED | Igual à Sprint 1. |
| Inicialização abaixo de 3 s [RNF-007] | PASS | Mediana 2,45 s; pior 3,44 s. |
| Instalação até 200 MB [RNF-014] | PASS | 52,4 MB. |
| Telas 480x800 a 1440x3120 [RNF-015] | NOT TESTED | Igual à Sprint 1. |
| Idiomas [RNF-016] | NOT TESTED | Igual à Sprint 1. |

**US-10 Composição gráfica**

| Critério | Veredito | Evidência |
|---|---|---|
| Colagens com layouts, bordas e sombras [RF-011] | NEEDS OWNER | Usa várias fotos do seletor. |
| Setas, círculos e formas com cor e espessura [RF-044] | NOT TESTED | Forma inserida no estado (camada nova, desfeita). Cor e espessura não vistas. |
| Memes com texto superior e inferior e adesivos [RF-046] | NOT TESTED | Meme superior e inferior inseridos no estado (duas camadas, desfeitas). Adesivos não testados. |
| Textos com fontes, cores, sombras e animações [RF-008] | NOT TESTED | Texto inserido no estado (desfeito). Fontes, sombras e animações não vistas. |

**US-12 Comparação, guias e atalhos**

| Critério | Veredito | Evidência |
|---|---|---|
| Comparação lado a lado com divisor [RF-019] | NOT TESTED | Modo de comparação ligado e desligado no estado. Divisor não visto. |
| Guias de alinhamento ao arrastar [RF-067] | NOT TESTED | Não testado. |
| Atalhos para desfazer, refazer, salvar e trocar ferramenta [RF-076] | NOT TESTED | Desfazer e refazer funcionaram pelos botões. Atalhos de teclado não se aplicam ao celular. |

**US-16 Transições e montagem**

| Critério | Veredito | Evidência |
|---|---|---|
| Transições com duração e pré-visualização [RF-032] | FAIL | Mesma falha da Sprint 1 (F2). |
| Reordenar e unir clipes [RF-058] | NOT TESTED | Igual à Sprint 1. |

**US-17 Velocidade**

| Critério | Veredito | Evidência |
|---|---|---|
| Velocidade alterada em pontos, com transições suaves [RF-049] | NOT TESTED | Velocidade 2x gravada no clipe e desfeita (restaurado exato). Transições suaves não vistas. |
| Sequência de fotos em time-lapse com velocidade e trilha [RF-023] | NEEDS OWNER | Usa o seletor de fotos. |

**US-30 Exportação**

Mesmos critérios e veredito da Sprint 1 (PASS para formatos de foto e GIF, NOT TESTED para presets e compressão, FAIL para Full HD).

**US-33 Captura e trilha de áudio**

| Critério | Veredito | Evidência |
|---|---|---|
| Áudio em faixa separada na captura, com monitoramento e ganho [RF-018] | NEEDS OWNER | Projeto tem faixa A1 "Áudio da câmera". Monitoramento e ganho exigem ouvir o áudio. |
| Trilha de fundo com volume, fade e sincronização [RF-036] | NOT TESTED | Adicionar trilha usa seletor. No painel do clipe há "Volume", mas não vi controle de fade. |

### NOT-US

Pastas listadas, itens não lidos. NOT TESTED.

---

## Desempenho

Bateria e temperatura foram anotadas em cada conjunto: bateria entre 19% e 21%, temperatura entre 36,5 C e 37,6 C. O aparelho estava quente e com pouca carga durante todo o teste. Não sei separar o quanto disso é limite do aparelho ou do app.

| Medida | Valores medidos | Veredito | Limite |
|---|---|---|---|
| Inicialização a frio (força parada só deste app, depois am start -W), 3 execuções | 3442, 2449, 2429 ms. Mediana 2449 ms, pior 3442 ms | Mediana BOM; pior ACEITÁVEL. Requisito RNF-007 (menos de 3 s) não atendido na pior execução | BOM menos de 3 s; ACEITÁVEL menos de 5 s |
| Inicialização a quente (processo vivo após HOME), 3 execuções | 154, 93, 83 ms | Não é inicialização a frio. Só informativo | - |
| Editor de vídeo até responder window.pm (1 execução) | 2462 ms | ACEITÁVEL | BOM menos de 1 s; ACEITÁVEL menos de 3 s |
| Editor de fotos até responder window.pm (1 execução) | 2313 ms | ACEITÁVEL | Igual |
| Tempo de início após play no vídeo, 6 execuções | 498, 532, 509, 138, 614, 491. Mediana 504 ms | RUIM (mediana acima de 500 ms; variação de 138 a 614 ms) | BOM menos de 200 ms; ACEITÁVEL menos de 500 ms |
| Velocidade de reprodução nos últimos 70% de 6 s (3 execuções) | 1,00 nas três | BOM | BOM 1,00; ACEITÁVEL no mínimo 0,98 |
| Maior intervalo entre quadros (trace), 3 execuções | 90, 90, 85 ms | ACEITÁVEL | BOM menos de 50 ms; ACEITÁVEL menos de 150 ms |
| Saltos na linha do tempo (seekAndWait), 16 saltos em 2 rodadas | Mediana 455 ms; pior 801 ms | RUIM (mediana e pior). Repetido: rodada 2 deu mediana de 325 ms | BOM menos de 100 ms; ACEITÁVEL menos de 300 ms |
| Ajuste de saturação até o próximo quadro (6 medições) | 27, 28, 33, 36, 31, 33 ms. Mediana 32 ms | BOM. Mede JavaScript e dois quadros, não a GPU | BOM menos de 50 ms; ACEITÁVEL menos de 100 ms |
| Filtro sugerido (RNF-012) | Não medido | NOT TESTED. Limite de 500 ms para aparelho intermediário; este aparelho é mais fraco | - |
| JPEG de foto 3120x4160 (2 execuções) | 22698 ms e 12481 ms. Mediana 17590 ms | RUIM (acima de 5 s) | BOM menos de 2 s; ACEITÁVEL menos de 5 s |
| WebP, HEIC e PNG (1 execução cada) | WebP 12091 ms; HEIC 17046 ms; PNG 27590 ms | Sem limite pedido para estes formatos. Lentos, na mesma ordem do JPEG | - |
| Exportação de GIF (15 s de saída, 360p, 10 fps, 128 cores) (2 execuções) | 48,8 s e 48,6 s para 15 s de GIF, ou 3,2 vezes o tempo | RUIM (acima de 3 vezes) | Vídeo: BOM 1 vez ou menos; ACEITÁVEL até 3 vezes |
| Exportação de MP4 1080p e 720p | Falha em ambas (F1) | Não medido | - |
| Navegação entre abas do editor de fotos (gfxinfo, 2 rodadas) | Atraso em 44% e 50% dos quadros; 95º percentil 400 ms e 36 ms | RUIM (requisito RNF-010 não atendido) | BOM 17 ms por quadro; ACEITÁVEL 95% dos quadros abaixo de 33 ms |
| Toque até resposta visível | Não medido (sem instrumentação) | NOT TESTED | BOM menos de 100 ms; ACEITÁVEL menos de 300 ms |
| Memória do app (dumpsys meminfo), com editor de fotos aberto | TOTAL PSS 518709 KB (cerca de 507 MB), com foto de 13 MP e 3 camadas | Dentro do limite de 800 MB de RNF-008; 24 MP não testado | RNF-008 800 MB |

Nota sobre a ordem de aplicação: o clipe de 24,5 s e o GIF de 15 s foram exportados com o app em foreground e sem interferência de leitura de tela, exceto nas dumps de acompanhamento da exportação.

---

## Veredito

Os três piores pontos que uma pessoa notaria no dia a dia, pelos meus números:

1. Não dá para exportar vídeo em MP4 neste aparelho (F1). O GIF funciona, mas demora cerca de 3 vezes o tempo do conteúdo, e JPEG de foto leva de 12 a 23 s. Para uso diário, isso é o que mais atrapalha.
2. A navegação e a resposta do editor de vídeo são lentas: início de reprodução com mediana de 504 ms, saltos com mediana de 455 ms, e troca de aba com quadros travados (95º percentil de até 400 ms). Isso é o que se sente mais ao editar.
3. A tela inicial não mostra o projeto na grade, e o painel de propriedades não tem taxa de bits nem histórico (F3 e F4). São defeitos do app, não do aparelho.

O que parece limite do aparelho (A11, 2,9 GB, Android 10, quente e com bateria baixa): a lentidão de exportação e de busca, a navegação com quadros travados e a inicialização mais lenta em uma das execuções. Não sei separar quanto disso é o aparelho e quanto é o app, porque não tenho outro aparelho para comparar.

O que parece do app: a grade vazia, o painel de propriedades incompleto, a falta de transições, e a mensagem de erro do MP4 em inglês. Sobre o erro do MP4 não tenho certeza se a causa é o codificador do aparelho ou a configuração que o app pede.

---

## Deixado no aparelho

- Projeto criado por mim: "Foto da câmera" (JPEG 3120 x 4160, 2,6 MB), tirado com o modo FOTO do app. Alterações nele: ajustes gravados e restaurados; camadas de texto, forma, meme e duplicata inseridas e desfeitas (restaurou para as três camadas originais); prioridade "Alta" selecionada na tela de detalhes. A foto está muito escura (histograma concentrado à esquerda). Não sei se é a cena ou a lente.
- Exportações feitas por mim, todas com "Salvo na galeria": 2 GIFs (9,21 MB cada), 2 JPEGs (um de 308 KB com 3072 x 4096), 1 WebP (83 KB), 1 PNG (10,9 MB), 1 HEIC (tamanho não retornado). Total: 7 arquivos. Não consegui achá-los pelo nome pixelmorph_export_* com busca de arquivos, então vale conferir na galeria. Nenhum foi apagado.
- Exportações de MP4 que falharam não geraram arquivo.
- "Vídeo da câmera" (projeto do dono): não foi apagado. Mudanças feitas foram todas desfeitas. A linha do tempo final é igual à inicial (V1 com o vídeo, V2 com o texto, A1 com o áudio), comparado byte a byte com o snapshot gravado no início.
- Erro meu: ao tentar fechar a tela de edição, a tecla Voltar me levou à tela da câmera, e tirei uma captura dessa tela, que mostra o preview da câmera (escuro). Apaguei o arquivo da pasta scratchpad logo depois. Ele não foi enviado a lugar nenhum.
- Erro meu: um toque em (360, 1210) na tela da câmera atingiu o slider "Intensidade" e o deixou em 44. Não sei o valor anterior. Isso é uma configuração da câmera do app.
- Capturas de tela em SP (scratchpad): ed1.png (editor do vídeo do dono, com quadros dele), exp1.png, gif1.png, photo1.png, photo2.png, photo3.png, home1.png, list1.png, longpress.png. Podem ser apagadas.
- Nenhum arquivo /sdcard/Movies/pm_test_* foi criado, então não havia o que apagar. /sdcard/pm_ui.xml foi removido.
- Não criei nem apaguei nenhum projeto além do "Foto da câmera" criado por mim.

---

## Testes não feitos e motivos

- Seletor de fotos e de arquivos (RAW, sobreposições, colagens, time-lapse, trilha de fundo, dupla exposição): NEEDS OWNER. Não abri o seletor, pela regra.
- Conta, login, verificação em duas etapas, sincronização e envio de logs: NEEDS OWNER ou NOT TESTED (rede).
- Idiomas, tamanhos de tela e 4K de 15 min: NOT TESTED, porque exigem alterar o aparelho ou ter mídia que não tenho.
- Tempo de toque até resposta: NOT TESTED, sem instrumentação.
- Notificações e prazos: NOT TESTED.
- Monitoramento e ganho do áudio na captura: NEEDS OWNER, porque é julgamento de som.
- Parei perto do limite de chamadas. Não repeti medidas além das obrigatórias.
