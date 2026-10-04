# US-03 — Continuidade e proteção do trabalho: situação

Verificado em 04/10/2026 no emulador `Pixel_7` e lendo o código. Atualizado depois das correções do mesmo dia.

## Resumo

| Critério | Status |
|---|---|
| RF-027 Desfazer/refazer ilimitado e persistente | ✅ Funciona (agora com teste automatizado) |
| RNF-005 Rascunhos salvos automaticamente | ✅ Funciona |
| RNF-006 Backups e recuperação de corrompidos | ✅ Funciona |
| RNF-017 Log local (5 MB) e envio anônimo | ⚠️ Pronto no app; falta o endpoint |

## O que foi feito
- **RNF-006:**
  - Cada backup agora tem uma segunda cópia em arquivo na pasta privada do app (`files/backups/<id>.json`, `backupFiles.ts`), fora do AsyncStorage. Confirmado no emulador: o arquivo aparece ao editar um projeto.
  - Um projeto corrompido se restaura sozinho ao ser aberto (antes só pela verificação manual). A restauração tenta primeiro o backup do AsyncStorage e depois o arquivo.
  - O toggle "Backup automático" agora funciona e é salvo. O "Último backup" mostra a data real.
  - Testes: `LocalProjectRepository.test.ts` cobre restauração automática, projeto sem backup, preferência desligada, backup em arquivo e exclusão.
- **RNF-017:**
  - `ErrorLogger.reportPending` envia por HTTPS os erros ainda não enviados para `EXPO_PUBLIC_ERROR_REPORT_URL`, só com o consentimento do usuário. Os dados são anônimos: sem id de usuário ou aparelho, e caminhos `file://` são apagados. Falha de rede deixa os erros na fila.
  - O app tenta enviar ao abrir e quando o usuário liga o toggle. O toggle é salvo.
  - Testes: `ErrorLogger.test.ts` cobre a rotação em 5 MB, o envio, a anonimização, o consentimento e a falha de rede.
- **Tela Armazenamento e menu lateral:** os valores agora são reais (projetos, histórico de edições, cache, backups, registros de erro, espaço livre do aparelho). "Limpar" cache e registros funcionam. Os dados inventados (2,8 GB, 410 MB, "Recursos extras" e a lista "Recursos sob demanda") foram removidos.
- **RF-027:** `HistoryStore.test.ts` prova 5.000 operações desfeitas e refeitas e a recuperação do histórico entre sessões.

## Pendências
- **RNF-017:** nenhum erro sai do aparelho enquanto `EXPO_PUBLIC_ERROR_REPORT_URL` não apontar para um endpoint HTTPS real. O repositório não tem backend.
- **RNF-006:** a restauração automática foi testada só em Jest. No emulador conferi a criação do arquivo de backup, mas não corrompi um projeto de verdade.
- **Arquivos de mídia:** o backup cobre os dados do projeto (JSON). As fotos e vídeos em si continuam onde o usuário os importou ou onde a câmera os gravou.
- **Criar a versão de backup de projetos antigos:** projetos que não foram editados desde esta correção só ganham o backup em arquivo na próxima edição.
