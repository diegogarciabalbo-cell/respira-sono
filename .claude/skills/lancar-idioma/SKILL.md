---
name: lancar-idioma
description: Fluxo para avançar a localização de um idioma (pt-BR, en, es, zh-Hans) no app e na loja.
argument-hint: [en|es|zh-Hans|nova-variante]
---

Avance a localização para: $ARGUMENTS

1. `localization-specialist`: migre a próxima tela ainda com texto fixo para `src/i18n` (uma por vez), atualize os quatro dicionários e rode `npm test`.
2. Atualize os textos de loja do idioma em `store/listings.json` e as permissões do iOS em `locales/ios/`.
3. `clinical-safety-reviewer`: revise tudo o que mudou nesse idioma.
4. `regulatory-privacy-officer`: liste o que muda no mercado principal desse idioma (aviso, número de emergência, proteção de dados, loja).
5. Liste o que precisa de revisor nativo humano e de revisão clínica no idioma. Nada muda para `native_reviewed` sem essa pessoa.
