# Pendências Sprint 1 → Sprint 2 (Não-US)

Tarefas técnicas incompletas da Sprint 1, reclassificadas como itens não-US para priorizar na próxima sprint.

## De RNF

| Item | Origem | O quê | Por quê |
|---|---|---|---|
| **NUS-001** | RNF-001 | Implementar Login + 2FA | Requer backend que não existe; decisão de escopo |
| **NUS-002** | RNF-002 | Implementar HTTPS na sincronização | Requer backend |
| **NUS-003** | RNF-009 | Validar 4K 15 min em aparelho real (release build) | Sprint 1 mediu no emulador; 72% quadros janky, falta confirmar em hardware real |
| **NUS-004** | RNF-011 | Medir 1 min Full HD em gama média | Sprint 1 só testou 9 s em 720p; falta validação de tempo em aparelho real |
| **NUS-005** | RNF-016 | Traduzir editor de foto/vídeo, câmera e demais telas para EN/ES | Sprint 1 só fez telas principais |

## De User Stories incompletas

| Item | Origem | O quê | Por quê |
|---|---|---|---|
| **NUS-010** | US-01 | Sistema de notificação do sistema (não no-app banner) | `expo-notifications` não integrado; Sprint 1 tem só banner |
| **NUS-011** | US-03 | Ativar envio de logs (HTTPS + backend) | Bloqueado por RNF-002 |
| **NUS-012** | US-11 | Decodificação real de RAW (não stub) | TODO em `rawImport.ts`; Sprint 1 deixou placeholder |
| **NUS-013** | US-14 | Exportação de faixas IMG/TXT/A1 junto com vídeo | Sprint 1 exporta só V1; primeira faixa de vídeo vai pro arquivo |
| **NUS-014** | US-15 | Remover objetos do vídeo (não implementado) | TODO em `VideoEditorScreen.tsx`; Sprint 1 deixou placeholder |
| **NUS-015** | US-30 | Exportação HEIC (foto) | TODO em `exportMath.ts`; Android API < 34 não suporta, falta solução |
| **NUS-016** | US-30 | Medir export de 1 min Full HD em aparelho real | Relacionado a RNF-011; usar como validação |

---

**Prioridades sugeridas:**
1. **Bloqueadores:** NUS-002 (HTTPS → RNF-002, NUS-011)
2. **Validação crítica:** NUS-003, NUS-004 (RNF-009/011 em hardware real)
3. **Funcionalidade:** NUS-013 (exportação multifaixa), NUS-012 (RAW real)
