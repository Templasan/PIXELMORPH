# US-11 — Importação e conversão de arquivos RAW: o que falta

Verificação feita em 04/10/2026 lendo o código (`rawImport.ts`, `RawConverterScreen.tsx`). O fluxo no emulador foi testado em sessão anterior, quando corrigi a prévia preta do conversor.

## Resumo

| Critério | Status |
|---|---|
| Importar arquivos RAW de câmeras profissionais | ⚠️ Parcial |
| Conversor com curva de tons e balanço de branco | ✅ Existe |
| Imagem processada segue para o fluxo normal de edição | ✅ Funciona |

## O que está funcionando
- Há um botão de importar RAW na tela de Projetos (`RawImportSheet`). Reconhece CR3, CR2, NEF, ARW, RAF, RW2 e DNG.
- O conversor (`RawConverterScreen.tsx`) tem Temperatura, Matiz de branco e curva de tons. O botão "APLICAR E ABRIR NO EDITOR" cria o projeto e abre o editor.
- A prévia preta do conversor foi corrigida (faltava o segundo `ImageShader`, o `maskImage`).

## Pendências
- **Decodificação real de RAW: fora do escopo, marcada com `TODO(RAW)` em `rawImport.ts`.** Precisaria de um decodificador nativo (por exemplo LibRaw) embrulhado como módulo Expo. Decisão do usuário: deixar como TODO documentado. Hoje o app usa só a prévia JPEG embutida, e o balanço de branco age sobre um JPEG já processado.
- **Projetos de demonstração.** Os projetos "Ensaio Praia 04" (CR3 e NEF) na grade vêm do `seedDemoProjects.ts`, com a mesma imagem de praia. Não representam um RAW real.
- **Não testei com um arquivo RAW real** (CR3, NEF etc.) importado do aparelho. Falta saber o que acontece quando o arquivo não tem prévia embutida.
