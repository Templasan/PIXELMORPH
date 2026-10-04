# US-09 — Efeitos visuais e overlays decorativos: o que falta

Verificação feita em 04/10/2026 no emulador `Pixel_7` (build debug) e lendo o código (`EffectsDrawer.tsx`).

## Resumo

| Critério | Status |
|---|---|
| RF-041 Retrô: envelhecimento, granulado, vinheta com intensidade e mesclagem | ✅ Funciona |
| RF-060 Molduras e bordas em estilos e espessuras | ✅ Existe (não testado ao vivo) |
| RF-068 Iluminação posicionável manualmente | ✅ Existe (não testado ao vivo) |
| RF-075 Dupla exposição com blend modes e transparência | ✅ Existe (não testado ao vivo) |
| RF-028 Overlays do repositório interno ou da galeria | ⚠️ Parcial (só repositório interno) |

## O que vi funcionando
- Drawer Efeitos com 5 abas: Retrô, Molduras, Iluminação, Dupla exposição e Overlays.
- Em Retrô, subi Envelhecimento, Granulado e Vinheta de 0 para 64. A foto ficou sépia, com grão e bordas escurecidas, e cada efeito tem "Intensidade" e "Mesclagem".
- Molduras têm slider de espessura (e de raio no estilo arredondado). Iluminação tem intensidade e posição (`LightPositionHandle`). Dupla exposição tem lista de modos de mesclagem e opacidade. Os controles existem no código, mas não os usei no emulador.

## Pendências
- **Overlay da galeria do dispositivo está desativado.** A aba Overlays mostra a linha "Galeria do dispositivo" com a legenda "Requer o módulo de acesso à galeria, ainda não instalado neste build." Só que `expo-image-picker` e `expo-media-library` já estão no `package.json`, e a tela de Projetos já importa da galeria (`pickFromGallery`). A mensagem está desatualizada e a função pode ser ligada.
- **Os overlays do "repositório interno" são texturas geradas por código** (`OVERLAY_TEXTURE_NAMES`), e não imagens de luz, poeira ou desgaste. Não há como baixar ou adicionar novas.
- **Dupla exposição só aceita imagem de outro projeto do app** ("Escolher imagem do projeto"). Não aceita uma foto direto da galeria.
- **Não testado ao vivo:** molduras, iluminação posicionável e dupla exposição. Vale uma passada no emulador.
