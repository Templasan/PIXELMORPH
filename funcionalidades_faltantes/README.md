# Funcionalidades faltantes — Sprint 1

Verificação de cada user story da Sprint 1, feita em 04 e 05/10/2026 no emulador `Pixel_7` e lendo o código. Cada arquivo diz o que foi feito e o que falta.

| US | Tema | Situação | O que ainda falta |
|---|---|---|---|
| [US-01](US-01-central-de-projetos.md) | Central de projetos | ⚠️ | Login/2FA e HTTPS (sem backend), idiomas nas demais telas, notificação do sistema |
| [US-03](US-03-continuidade-e-protecao.md) | Continuidade e proteção | ⚠️ | Envio de logs só funciona com um endereço HTTPS configurado |
| [US-04](US-04-ajustes-de-cor-e-tonalidade.md) | Ajustes de cor | ✅ | Cor seletiva só tem 7 cores fixas |
| [US-05](US-05-correcoes-geometricas.md) | Geometria | ✅ | Botão único de espelhamento "ambos" (opcional) |
| [US-08](US-08-camadas-nao-destrutiva.md) | Camadas | ✅ | Caneta (pressão) sem teste em aparelho real |
| [US-09](US-09-efeitos-e-overlays.md) | Efeitos e overlays | ✅ | Overlays "internos" são texturas geradas por código |
| [US-11](US-11-importacao-raw.md) | RAW | ⚠️ | Decodificação real de RAW (TODO) |
| [US-14](US-14-timeline-multifaixa.md) | Timeline multifaixa | ⚠️ | RNF-009 só medido no emulador (queda leve); confirmar em aparelho real |
| [US-15](US-15-edicao-de-precisao.md) | Edição de precisão | ⚠️ | Remover objetos do vídeo (TODO) |
| [US-16](US-16-transicoes-e-montagem.md) | Transições e montagem | ✅ | Reordenar vários clipes sem teste |
| [US-30](US-30-exportacao.md) | Exportação | ⚠️ | HEIC (TODO), GIF lento, medir RNF-011 em aparelho real |

---

## Pendências reclassificadas para Sprint 2

Tarefas incompletas da Sprint 1 foram movidas para [`backlog/not-us/`](../../backlog/not-us/README.md) como itens não-US (NUS-001 a NUS-016), separadas entre:
- **RNF incompletos** (validação de hardware real, backend, idiomas)
- **Funcionalidades parciais** das US atuais (exportação multifaixa, RAW real, etc.)

User Stories permanecem aqui; use `not-us/README.md` para o planejamento da próxima sprint.

## Dependências adicionadas (registradas em `docs/dependencies.md`)
- `expo-video`: player real no editor de vídeo (US-14/15/16).
- Media3 Transformer (módulo local `modules/pixelmorph-video-export`, Android): exportação de vídeo, quadros exatos e transições (US-16/30). O FFmpeg-kit está arquivado e não foi usado.
- `modern-gif`: exportação de GIF animado (US-30).

## Fora do escopo por decisão (com TODO no código)
- **Login, 2FA e HTTPS na sincronização** (US-01): dependem de um backend que o projeto não tem.
- **Idiomas EN/ES nas demais telas** (US-01): `TODO(i18n)` em `src/core/i18n/i18n.ts`.
- **Remover objetos do vídeo** (US-15): `TODO(RF-013)` em `VideoEditorScreen.tsx`.
- **HEIC** (US-30): `TODO(HEIC)` em `exportMath.ts`.
- **Decodificação real de RAW** (US-11): `TODO(RAW)` em `rawImport.ts`.

## Observações de ambiente
- Build release no Windows: o caminho do projeto passa de 260 caracteres. Mapear uma unidade curta (`subst R: C:\Users\templ\Desktop\Facul\TristezaParaMobile`) e rodar o Gradle em `R:\PIXELMORPH\android`. Detalhes em `US-01-central-de-projetos.md`.
- Tudo foi medido no emulador, em x86_64. Falta confirmar em aparelho Android real.
