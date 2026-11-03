# IA no aparelho: licenças dos modelos candidatos

Data da consulta: 2026-11-03. Fonte: páginas oficiais do modelo ou repositório. Onde a página não diz, está escrito "não encontrado". "Unclear" = a página nomeia a licença, mas não diz se o uso comercial é permitido e o arquivo de licença não foi lido.

| Modelo | Licença | Uso comercial | Tamanho | Fonte |
|---|---|---|---|---|
| RMBG-1.4 | bria-rmbg-1.4; página diz "Creative Commons ... non-commercial" | no (uso comercial exige acordo com a BRIA) | 44,1 M params (F32) | https://huggingface.co/briaai/RMBG-1.4 |
| RMBG-2.0 | CC BY-NC 4.0 | no (uso comercial exige acordo com a BRIA) | 0,2 B params | https://huggingface.co/briaai/RMBG-2.0 |
| LaMa | Apache 2.0 (texto do LICENSE do repositório) | yes (a licença concede uso e redistribuição sem royalties; pesos não verificados) | não encontrado | https://github.com/advimman/lama |
| MI-GAN | MIT (página do repositório); LICENSE-WEIGHTS citado, não lido | unclear | não encontrado | https://github.com/Picsart-AI-Research/MI-GAN |
| MobileSAM | Apache-2.0 (página; LICENSE não lido) | unclear | 9,66 M params (pipeline); tamanho em MB não encontrado | https://github.com/ChaoningZhang/MobileSAM |
| Whisper | MIT License (página) | unclear | tamanho em MB não encontrado; seis tamanhos listados | https://github.com/openai/whisper |
| whisper.cpp | MIT (página; LICENSE não lido) | unclear | tiny 75 MiB; large 2,9 GiB (tabela de memória) | https://github.com/ggml-org/whisper.cpp |
| MediaPipe Selfie Multiclass (256x256) | não encontrado | não encontrado | não encontrado | https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter |
| ML Kit Subject Segmentation | não encontrado (página só diz API beta sem SLA) | não encontrado | não encontrado | https://developers.google.com/ml-kit/vision/subject-segmentation |

Google Play services para ML Kit Subject Segmentation: não encontrado. A página diz que o processamento é on-device e não exige rede, mas não cita Play services.

## Recomendação

1. Não usar RMBG-1.4 nem RMBG-2.0 em app comercial sem acordo com a BRIA: a licença é não comercial.
2. LaMa (Apache 2.0) é o candidato mais claro para remoção de objetos; antes de publicar, confirmar a licença dos pesos.
3. Whisper e whisper.cpp (MIT), MobileSAM (Apache-2.0) e MI-GAN (MIT) são candidatos plausíveis, mas a permissão comercial precisa ser confirmada nos arquivos LICENSE. MediaPipe e ML Kit só entram após ler os termos oficiais, que a página consultada não traz.

## Limites desta consulta

Não foram lidos os arquivos LICENSE de MI-GAN, MobileSAM, Whisper e whisper.cpp, nem o LICENSE-WEIGHTS do MI-GAN. Não é parecer jurídico.
