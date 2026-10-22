---
name: qa-completo
description: Roda a verificação completa do RESPIRA Sono (testes, banco, tipos, bundle) e relata o resultado. Use antes de qualquer entrega, merge ou build para loja.
allowed-tools: Bash(npm test*) Bash(npm run test:db*) Bash(npm run typecheck*) Bash(npx tsc*) Bash(CI=1 npx expo export*)
---

Use o subagente `qa-engineer` para executar a verificação completa:

1. `npm test`
2. `npm run test:db`
3. `npm run typecheck`
4. `CI=1 npx expo export --platform android --platform ios --output-dir /tmp/respira-export`

Depois:
- Se houve mudança de código sem teste correspondente, peça ao `qa-engineer` para escrever o teste.
- Liste as pendências que só podem ser verificadas em aparelho físico (ver `docs/TESTE-NOTURNO.md`), sem marcar nenhuma como aprovada.

Entregue o relatório no formato definido pelo `qa-engineer`.
