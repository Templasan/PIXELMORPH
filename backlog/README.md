# PixelMorph — Backlog, Roadmap e Instalação

Aplicativo Android de edição de fotos e vídeos (React Native + Expo SDK 56). Este documento reúne o **backlog do produto**, o **backlog da Sprint 1**, o **roadmap** e o **tutorial de instalação**.

## Sumário

1. [Instalação e execução (compilar o APK)](#1-instalação-e-execução-compilar-o-apk)
2. [Backlog do produto](#2-backlog-do-produto)
3. [Backlog da Sprint 1](#3-backlog-da-sprint-1)
4. [Roadmap](#4-roadmap)
5. [Estrutura desta pasta](#5-estrutura-desta-pasta)

---

## 1. Instalação e execução (compilar o APK)

> **Importante:** o app **não roda no Expo Go**. Ele usa o Expo SDK 56 e um módulo nativo próprio (`modules/pixelmorph-video-export`, exportação de vídeo com Media3). É preciso **compilar um APK** e instalá-lo no celular.

### 1.1 Pré-requisitos

| Ferramenta | Versão | Observação |
|---|---|---|
| Node.js | 22.x (`.nvmrc` = 22.19.0) | Já foi compilado com Node 24 também |
| JDK | 17 | Defina `JAVA_HOME` |
| Android Studio | recente | Traz o SDK Manager |
| Android SDK Platform | 36 | `compileSdk` do projeto |
| Build-Tools | 36.0.0 | |
| NDK | 27.1.12297006 | O Gradle instala sozinho se as licenças estiverem aceitas |
| CMake | 3.22.1 | Idem |
| Platform-Tools (`adb`) | latest | Para instalar pelo USB |

Variáveis de ambiente (exemplo para Windows/PowerShell):

```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
setx JAVA_HOME "C:\Program Files\Java\jdk-17"
# adicione ao PATH: %ANDROID_HOME%\platform-tools
```

### 1.2 Instalar as dependências

```bash
npm install
```

### 1.3 Preparar o celular

1. Ative as **Opções do desenvolvedor** (toque 7 vezes no número da versão).
2. Ative a **Depuração USB**. Em Xiaomi/POCO, ative também **Instalar via USB** e **Depuração USB (configurações de segurança)**.
3. Plugue o cabo em modo **Transferência de arquivos** e aceite o aviso de RSA ("Sempre permitir").
4. Confirme que o celular aparece:

```bash
adb devices
```

Deve listar o aparelho como `device` (não `unauthorized`). Se aparecer `(no serial number)`, rode `adb kill-server` e tente de novo.

### 1.4 Compilar o APK (release)

```bash
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a   # Windows: .\gradlew.bat ...
```

- `arm64-v8a` compila só para celulares modernos de 64 bits (a maioria atual) e deixa a build bem mais rápida. Para outros aparelhos, remova o parâmetro.
- A **primeira build é lenta** (baixa Gradle, SDK, NDK e dependências, mais de 1,5 GB). As seguintes levam poucos minutos.
- O APK fica em `android/app/build/outputs/apk/release/app-release.apk` (cerca de 59 MB). O JavaScript já vai embutido, então o app **funciona sem o Metro e sem internet**.
- O release é assinado com a chave de debug do projeto: serve para testes e apresentação, **não para a Play Store**.

Alternativa em um comando (compila e instala no celular conectado):

```bash
npx expo run:android --variant release
```

### 1.5 Instalar e abrir

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell monkey -p com.anonymous.pixelmorph -c android.intent.category.LAUNCHER 1
```

Para instalar em outro celular, copie o `.apk` (cabo, Drive, WhatsApp) e abra no aparelho, permitindo "instalar de fontes desconhecidas".

### 1.6 Problemas comuns

| Sintoma | Solução |
|---|---|
| `adb devices` mostra `unauthorized` | Aceite o aviso de depuração USB no celular; se não aparecer, revogue as autorizações nas Opções do desenvolvedor e replugue |
| Erro de "caminho longo" (limite de 260 caracteres no `ninja`, Windows) | Copie o projeto para uma pasta curta (ex.: `C:\pm`, sem `.git`) e compile de lá |
| Falha ao baixar dependências | Rede instável: rode o Gradle de novo, ele retoma do cache |
| Versão incompatível ao abrir no Expo Go | Esperado: use o APK compilado, não o Expo Go |

### 1.7 Opcional: espelhar a tela do celular no PC

Use o [scrcpy](https://github.com/Genymobile/scrcpy) (`scrcpy --max-size 1280 --max-fps 30 --stay-awake`). Para mostrar numa TV, ligue o PC por HDMI e use Win+P (Duplicar) com o scrcpy em tela cheia (Ctrl+F).

### 1.8 Testes automatizados

```bash
npx tsc --noEmit   # tipos (ignore 2 avisos em node_modules/react-native-view-shot)
npx jest           # testes unitários e de integração
```

---

## 2. Backlog do produto

**36 User Stories** em 8 épicos, distribuídas em 3 sprints. As pastas `backlog sprint 1`, `backlog sprint 2` e `backlog sprint 3` guardam cada US com seus requisitos (RF = funcional, RNF = não funcional).

### 2.1 Épicos

| Épico | Nome | US |
|---|---|---|
| EP-01 | Projetos e Organização | 3 |
| EP-02 | Edição de Foto | 10 |
| EP-03 | Edição de Vídeo | 7 |
| EP-04 | Câmera e Captura | 3 |
| EP-05 | IA e Automação | 6 |
| EP-06 | Exportação | 3 |
| EP-07 | Áudio | 1 |
| EP-08 | Colaboração e Comunidade | 3 |

### 2.2 Todas as User Stories

| US | Título | Épico | Sprint | RFs | RNFs |
|---|---|---|---|---|---|
| US-01 | Central de projetos | EP-01 Projetos e Organização | S1 + S2 | RF-001, RF-037, RF-070 | RNF-001, RNF-002, RNF-007, RNF-014, RNF-015, RNF-016 |
| US-02 | Presets e edição em lote | EP-01 Projetos e Organização | S3 | RF-014, RF-015 | — |
| US-03 | Continuidade e proteção do trabalho | EP-01 Projetos e Organização | S1 | RF-027 | RNF-005, RNF-006, RNF-017 |
| US-04 | Ajustes finos de cor e tonalidade | EP-02 Edição de Foto | S1 | RF-047, RF-029, RF-063, RF-059 | — |
| US-05 | Correções geométricas e orientação | EP-02 Edição de Foto | S1 | RF-048, RF-078, RF-054 | — |
| US-06 | Máscaras e seleção localizada | EP-02 Edição de Foto | S3 | RF-007, RF-038, RF-045, RF-072 | — |
| US-07 | Retoque e distorção | EP-02 Edição de Foto | S3 | RF-022, RF-026 | — |
| US-08 | Edição em camadas não destrutiva | EP-02 Edição de Foto | S1 | RF-002, RF-052, RF-033 | RNF-008 |
| US-09 | Efeitos visuais e overlays decorativos | EP-02 Edição de Foto | S1 | RF-041, RF-060, RF-068, RF-075, RF-028 | — |
| US-10 | Composição gráfica: colagens, textos e elementos vetoriais | EP-02 Edição de Foto | S2 | RF-011, RF-044, RF-046, RF-008 | — |
| US-11 | Importação e conversão de arquivos RAW | EP-02 Edição de Foto | S1 | RF-003 | — |
| US-12 | Comparação, guias e atalhos de produtividade | EP-02 Edição de Foto | S2 | RF-019, RF-067, RF-076 | — |
| US-13 | Visualização 3D de fotos estereoscópicas | EP-02 Edição de Foto | S3 | RF-071 | — |
| US-14 | Linha do tempo multifaixa com tela dividida | EP-03 Edição de Vídeo | S1 | RF-005, RF-053 | RNF-009 |
| US-15 | Edição de precisão: corte, navegação e congelamento de quadro | EP-03 Edição de Vídeo | S1 | RF-035, RF-013, RF-077 | — |
| US-16 | Transições e montagem de múltiplos clipes | EP-03 Edição de Vídeo | S1 + S2 | RF-032, RF-058 | — |
| US-17 | Controle de velocidade: câmera lenta, aceleração e time-lapse | EP-03 Edição de Vídeo | S2 | RF-049, RF-023 | — |
| US-18 | Estabilização de vídeo por sensores | EP-03 Edição de Vídeo | S3 | RF-009 | — |
| US-19 | Edição de vídeo em 360 graus | EP-03 Edição de Vídeo | S3 | RF-021 | — |
| US-20 | Picture-in-picture | EP-03 Edição de Vídeo | S3 | RF-065 | — |
| US-21 | Filtros em tempo real na pré-visualização da câmera | EP-04 Câmera e Captura | S3 | RF-006, RF-079 | RNF-010 |
| US-22 | Captura assistida: temporizador e stop-motion | EP-04 Câmera e Captura | S3 | RF-039, RF-043 | — |
| US-23 | Sobreposição em realidade aumentada | EP-04 Câmera e Captura | S3 | RF-024 | — |
| US-24 | Recorte e remoção inteligente de elementos | EP-05 IA e Automação | S3 | RF-004, RF-055 | — |
| US-25 | Efeitos de retrato e correção facial automática | EP-05 IA e Automação | S3 | RF-012, RF-016, RF-025 | RNF-004 |
| US-26 | Sugestões automáticas de cor, cena e enquadramento | EP-05 IA e Automação | S3 | RF-010, RF-034, RF-042 | RNF-012 |
| US-27 | Filtros artísticos por IA | EP-05 IA e Automação | S3 | RF-050 | — |
| US-28 | Alinhamento automático para panorama | EP-05 IA e Automação | S3 | RF-062 | — |
| US-29 | Automação de vídeo: miniaturas e legendas por IA | EP-05 IA e Automação | S3 | RF-030, RF-069 | — |
| US-30 | Exportação em múltiplos formatos e otimização de tamanho | EP-06 Exportação | S1 + S2 | RF-057, RF-061, RF-017 | RNF-013, RNF-011 |
| US-31 | Exportação para fluxos profissionais: PSD, impressão e gerenciamento de cor | EP-06 Exportação | S3 | RF-040, RF-073, RF-051 | — |
| US-32 | Marca d'água e QR code personalizados | EP-06 Exportação | S3 | RF-020, RF-066 | — |
| US-33 | Captura e trilha de áudio no vídeo | EP-07 Áudio | S2 | RF-018, RF-036 | — |
| US-34 | Edição colaborativa remota em tempo real | EP-08 Colaboração e Comunidade | S3 | RF-031 | RNF-002 |
| US-35 | Feedback e anotações da comunidade | EP-08 Colaboração e Comunidade | S3 | RF-074, RF-064 | RNF-003 |
| US-36 | Galeria de amostras e tutoriais interativos | EP-08 Colaboração e Comunidade | S3 | RF-056 | — |

> US-01, US-16 e US-30 aparecem nas Sprints 1 e 2: parte dos critérios foi entregue na Sprint 1 e o restante na Sprint 2.

Itens técnicos que não pertencem a uma US (pendências de requisitos não funcionais e de US incompletas) estão em [`not-us/README.md`](not-us/README.md).

---

## 3. Backlog da Sprint 1

**Situação: ✅ Completa.** Fundação do app, edição de foto e base da edição de vídeo.

| US | Título | RFs | RNFs | Item migrado para não-US |
|---|---|---|---|---|
| US-01 | Central de projetos | RF-001, RF-037, RF-070 | RNF-001, RNF-002, RNF-007, RNF-014, RNF-015, RNF-016 | NUS-010 notificação do sistema (hoje só banner) |
| US-03 | Continuidade e proteção do trabalho | RF-027 | RNF-005, RNF-006, RNF-017 | NUS-011 envio de logs (depende de backend/HTTPS) |
| US-04 | Ajustes finos de cor e tonalidade | RF-047, RF-029, RF-063, RF-059 | — | — |
| US-05 | Correções geométricas e orientação | RF-048, RF-078, RF-054 | — | — |
| US-08 | Edição em camadas não destrutiva | RF-002, RF-052, RF-033 | RNF-008 | — |
| US-09 | Efeitos visuais e overlays decorativos | RF-041, RF-060, RF-068, RF-075, RF-028 | — | — |
| US-11 | Importação e conversão de arquivos RAW | RF-003 | — | NUS-012 decodificação real de RAW |
| US-14 | Linha do tempo multifaixa com tela dividida | RF-005, RF-053 | RNF-009 | NUS-013 exportar faixas IMG/TXT/A1 junto com o vídeo |
| US-15 | Edição de precisão: corte, navegação e congelamento de quadro | RF-035, RF-013, RF-077 | — | NUS-014 remover objetos do vídeo |
| US-16 | Transições e montagem de múltiplos clipes | RF-032, RF-058 | — | — |
| US-30 | Exportação em múltiplos formatos e otimização de tamanho | RF-057, RF-061, RF-017 | RNF-013, RNF-011 | NUS-015 exportação HEIC; NUS-016 medir 1 min Full HD em gama média |

**Itens remanescentes da Sprint 1** (não bloqueiam a conclusão; reclassificados como itens não-US em [`not-us/`](not-us/README.md)):

- **NUS-001 / NUS-002:** Login com 2FA e HTTPS na sincronização. Exigem backend, que não existe. Fora do escopo.
- **NUS-004:** medir exportação de 1 min em Full HD em aparelho de gama média.
- **NUS-005:** traduzir o editor de foto/vídeo e a câmera para EN/ES (hoje só as telas principais).
- **NUS-010 a NUS-016:** itens listados na coluna de pendências acima.

---

## 4. Roadmap

| Sprint | Tema | User Stories | Situação |
|---|---|---|---|
| **Sprint 1** | Fundação: projetos, ajustes de foto, camadas, linha do tempo e exportação | US-01, US-03, US-04, US-05, US-08, US-09, US-11, US-14, US-15, US-16, US-30 | ✅ **Completa** (itens técnicos remanescentes migrados para não-US, seção 3) |
| **Sprint 2** | Composição, guias, velocidade, áudio e exportação multiformato | US-01, US-10, US-12, US-16, US-17, US-30, US-33 | Em fechamento: US-16 completa, as demais parciais (ver `SPRINT_2_STATUS.md`) |
| **Sprint 3** | Máscaras, retoque, câmera avançada, IA, exportação profissional e colaboração | 21 US (tabela abaixo) | Planejada. Algumas já têm implementação inicial no código; conferir antes de dar como concluídas |

### 4.1 Sprint 2 — situação

| US | Título | Situação |
|---|---|---|
| US-01 | Central de projetos | 🟡 Parcial |
| US-10 | Composição gráfica: colagens, textos e elementos vetoriais | 🟡 Parcial |
| US-12 | Comparação, guias e atalhos de produtividade | 🟡 Parcial |
| US-16 | Transições e montagem de múltiplos clipes | ✅ Completa |
| US-17 | Controle de velocidade: câmera lenta, aceleração e time-lapse | 🟡 Parcial |
| US-30 | Exportação em múltiplos formatos e otimização de tamanho | 🟡 Parcial |
| US-33 | Captura e trilha de áudio no vídeo | 🟡 Parcial |

Verificado em 05/10/2026 em celular real (arm64, Android 16, build release). Detalhes critério a critério em [`SPRINT_2_STATUS.md`](SPRINT_2_STATUS.md).

Resultados de desempenho medidos no celular: inicialização a frio entre **0,82 e 1,2 s** (meta: menos de 3 s), instalação de **59 MB** (meta: até 200 MB) e exportação de 10 s em Full HD com transição em **2,7 s**.

### 4.2 Sprint 3 — escopo planejado

| US | Título | Épico |
|---|---|---|
| US-02 | Presets e edição em lote | EP-01 Projetos e Organização |
| US-06 | Máscaras e seleção localizada | EP-02 Edição de Foto |
| US-07 | Retoque e distorção | EP-02 Edição de Foto |
| US-13 | Visualização 3D de fotos estereoscópicas | EP-02 Edição de Foto |
| US-18 | Estabilização de vídeo por sensores | EP-03 Edição de Vídeo |
| US-19 | Edição de vídeo em 360 graus | EP-03 Edição de Vídeo |
| US-20 | Picture-in-picture | EP-03 Edição de Vídeo |
| US-21 | Filtros em tempo real na pré-visualização da câmera | EP-04 Câmera e Captura |
| US-22 | Captura assistida: temporizador e stop-motion | EP-04 Câmera e Captura |
| US-23 | Sobreposição em realidade aumentada | EP-04 Câmera e Captura |
| US-24 | Recorte e remoção inteligente de elementos | EP-05 IA e Automação |
| US-25 | Efeitos de retrato e correção facial automática | EP-05 IA e Automação |
| US-26 | Sugestões automáticas de cor, cena e enquadramento | EP-05 IA e Automação |
| US-27 | Filtros artísticos por IA | EP-05 IA e Automação |
| US-28 | Alinhamento automático para panorama | EP-05 IA e Automação |
| US-29 | Automação de vídeo: miniaturas e legendas por IA | EP-05 IA e Automação |
| US-31 | Exportação para fluxos profissionais: PSD, impressão e gerenciamento de cor | EP-06 Exportação |
| US-32 | Marca d'água e QR code personalizados | EP-06 Exportação |
| US-34 | Edição colaborativa remota em tempo real | EP-08 Colaboração e Comunidade |
| US-35 | Feedback e anotações da comunidade | EP-08 Colaboração e Comunidade |
| US-36 | Galeria de amostras e tutoriais interativos | EP-08 Colaboração e Comunidade |

### 4.3 Próximos passos sugeridos

1. Fechar as pendências parciais da Sprint 2 (testar no celular as formas, colagens, memes, atalhos por gesto e mixagem de áudio).
2. Resolver os bloqueadores não-US: backend para login/HTTPS (NUS-001, NUS-002), RAW real (NUS-012) e exportação multifaixa (NUS-013).
3. Traduzir as telas restantes (NUS-005).
4. Medir exportação de 1 min em aparelho de gama média (NUS-004).
5. Iniciar a Sprint 3, começando por máscaras e retoque (US-06, US-07), que reaproveitam a base de camadas.

---

## 5. Estrutura desta pasta

```text
backlog/
├── README.md                 # este documento
├── SPRINT_2_STATUS.md        # situação verificada da Sprint 2
├── not-us/                   # pendências técnicas fora de User Stories
├── backlog sprint 1/         # US da Sprint 1 (user-story.md + RF/RNF)
├── backlog sprint 2/         # US da Sprint 2
└── backlog sprint 3/         # US da Sprint 3
```
