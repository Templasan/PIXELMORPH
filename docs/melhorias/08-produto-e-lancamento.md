# 08 Produto e lançamento (opcional)

Data de referência: 03/11/2026. Publicar na Google Play **não foi decidido**. Este arquivo é só checklist e roteiro. Nada foi rodado, nenhum repositório foi alterado.

## 1. Checklist Google Play

| Requisito | O que a fonte oficial diz | O que achei no repo | Situação |
|---|---|---|---|
| Target API | Apps novos e atualizações devem mirar Android 16 (API 36). Prazo: 31/08/2026, já passado. Fonte: https://support.google.com/googleplay/android-developer/answer/11926878 | `targetSdkVersion` vem de `rootProject.ext` (android/app/build.gradle:94). Valor não encontrado em android/build.gradle | Não encontrado: conferir o valor real no `rootProject.ext` |
| 16 KB de página | Apps com target Android 15 (API 35) ou mais devem suportar 16 KB em 64 bits. Atualizações sem suporte não podem ser lançadas a partir de 01/02/2027. Fonte: https://developer.android.com/guide/practices/page-sizes | `expo.useLegacyPackaging` padrão `false` (android/app/build.gradle:126). Versão do AGP, NDK e presença de `.so` não encontradas | A medir: APK Analyzer e `check_elf_alignment` no APK de release |
| Fotos e vídeos | `READ_MEDIA_IMAGES` e `READ_MEDIA_VIDEO` só se o seletor do sistema não atender a função principal, com declaração no Play Console. Picker customizado não basta. Fonte: https://support.google.com/googleplay/android-developer/answer/14115180 | AndroidManifest.xml linhas 9 a 11 declaram as duas permissões, mais `READ_MEDIA_VISUAL_USER_SELECTED` | Risco: editor não é gerenciador de galeria. Usar Photo Picker se possível. Não confirmei se o app usa o seletor |
| Áudio e outras | Política de foto e vídeo não cita áudio: não encontrado | `READ_MEDIA_AUDIO`, `RECORD_AUDIO`, `CAMERA`, `SYSTEM_ALERT_WINDOW` no manifesto | A conferir. Melhorias §3 já sugere bloquear `SYSTEM_ALERT_WINDOW` |
| Data safety | Formulário obrigatório, e política de privacidade obrigatória mesmo se não houver coleta. Fonte: https://support.google.com/googleplay/android-developer/answer/10787469 | Política de privacidade no repo: não encontrado | Pendente |
| Exclusão de conta | Se o app tem conta: exclusão dentro do app e link web de exclusão, ambos declarados no Data safety. Fonte: https://support.google.com/googleplay/android-developer/answer/13327111 | App tem login Supabase (docs/melhorias §3). Tela de exclusão: não encontrado | Pendente, obrigatório se publicar com conta |
| Teste fechado (conta pessoal nova) | Teste fechado com pelo menos 12 testers, inscritos continuamente por 14 dias, antes de pedir acesso à produção. Fonte: https://support.google.com/googleplay/android-developer/answer/14151465 | Não se aplica ao código | Planejar 12 pessoas por 14 dias antes de publicar |

Informação extra: `minSdkVersion` 26 em app.json:38. A fonte acima não trata disso.

## 2. Roteiro de demo (5 minutos, para o painel)

Base: só o que está registrado como verificado em `multilayer-editors-state.md` (emulador) e no que está em `docs/melhorias-2026-11-03.md`. Presets e Tutoriais ficam de fora.

Verificado no emulador: migração de faixas antigas, reprodução em tempo real, 4 vídeos ao mesmo tempo sem atraso, exportação da pilha, rotação livre pelo knob por toque.
Conferido só no navegador (não no Android): recorte de clipe, alinhamento e blend.

Antes do painel:
- Usar um projeto de teste, não o seu.
- Não colocar texto em V1 por baixo de vídeo em V2. Bug 4 da melhorias ainda não corrigido.
- Não fazer mais de 200 ajustes (perda de ajustes, bug 1).
- Esperar 1 segundo depois da última edição antes de sair do editor (salvamento de 400 ms).
- Testar no emulador a arrastada de clipe entre faixas: não está registrada como verificada no Android.

Roteiro:
1. (0:00 a 0:45) Tela de projetos. Mostrar o trabalho recente. Confirmar antes que a rolagem está corrigida (o dono ainda não confirmou).
2. (0:45 a 1:30) Abrir o editor de vídeo com dois clipes. Mostrar as faixas V1 e V2 e a migração de faixas antigas.
3. (1:30 a 2:30) Tocar a linha do tempo com quatro vídeos em camadas. Dizer que a reprodução ficou fluida no emulador.
4. (2:30 a 3:30) Girar uma camada pelo knob, por toque.
5. (3:30 a 4:30) Exportar a pilha de camadas e mostrar o arquivo resultante.
6. (4:30 a 5:00) Dizer o que ainda não está pronto: fotos em camadas no Android, blend em clipe, e os bugs da revisão de 03/11 em correção.

## 3. Não verificado

Não confirmei: targetSdk real, versão do AGP e NDK, presença de `.so` no APK, política de privacidade, tela de exclusão de conta, e se o app usa o seletor de fotos do sistema.
