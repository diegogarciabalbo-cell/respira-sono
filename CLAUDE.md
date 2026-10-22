# RESPIRA Sono — instruções para o Claude Code

@AGENTS.md

## O produto em uma frase
App Android/iOS para adultos que roncam: grava a noite com tela bloqueada, mostra qualidade e lacunas, organiza diário e exercícios e gera relatório que o usuário decide compartilhar. **Não diagnostica.**

## Regras invioláveis (valem para código, textos, lojas e marketing)
1. Nada de diagnóstico, IAH/AHI, saturação, estágios do sono, risco ou probabilidade de doença a partir do áudio.
2. Silêncio nunca vira "parada respiratória". Redução de ronco nunca vira "apneia resolvida".
3. Não orientar mudança em CPAP, medicamentos ou aparelhos. Não é monitor de emergência.
4. Orientação de próximos passos vem só de **sintomas relatados** (`src/domain/guidance.ts` não recebe dados acústicos). Não mude isso.
5. Exercícios: nunca inventar dose, revisor ou aprovação. Conteúdo sem revisão real fica `draft` e só aparece em demonstração identificada.
6. Não usar nomes de pesquisadores como parceiros, revisores ou endossantes.
7. Privacidade: áudio local por padrão, consentimentos separados, sem rastreadores de saúde, sem dados de saúde em pixels de anúncio, sem dados de saúde no iCloud.
8. Público: maiores de 18 anos.
9. Não prometer cura, prazos ("em 7 dias") nem precisão não demonstrada.
10. Nunca afirmar que um teste em aparelho passou sem evidência registrada em `docs/TESTE-NOTURNO.md`.

## Comandos
```bash
npm test            # Jest: domínio, banco local, i18n, textos de loja
npm run test:db     # migrações Supabase + RLS (PGlite)
npm run typecheck
npx expo export --platform android --platform ios   # bundle
npx expo run:android --device | npx expo run:ios --device
```
Antes de declarar uma tarefa pronta: `npm test && npm run test:db && npm run typecheck`.

## Mapa
- Nativo: `modules/respira-recorder/` (Kotlin FGS de microfone; Swift AVAudioEngine). `android/` e `ios/` são gerados — não editar.
- Domínio puro e testável: `src/domain/`. Banco local: `src/db/`. Telas: `src/app/`.
- Idiomas: `src/i18n/` (pt-BR é a fonte). Lojas: `store/listings.json`.
- Servidor: `supabase/migrations/` (+ `supabase/tests/`).
- Documentos: `docs/` (STATUS, ARQUITETURA, REGULATORIO, PRIVACIDADE, REVISAO-CLINICA, GO-TO-MARKET, AGENCIA…).

## Agência de agentes
Os especialistas ficam em `.claude/agents/` e os fluxos em `.claude/skills/`. Veja `docs/AGENCIA.md`.
Regra de ouro: **qualquer texto voltado ao usuário (app, loja, anúncio, post) passa pelo `clinical-safety-reviewer` antes de ser considerado pronto**, e qualquer mudança que toque dados pessoais passa pelo `regulatory-privacy-officer`.
