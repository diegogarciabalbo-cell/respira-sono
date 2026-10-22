---
name: revisar-exercicios
description: Prepara ou atualiza o pacote de revisão clínica dos exercícios e registra a devolutiva de um revisor real.
argument-hint: [preparar|registrar-devolutiva]
disable-model-invocation: true
---

Ação: $ARGUMENTS

Use o subagente `exercise-content-editor`.

- **preparar**: atualize `docs/REVISAO-CLINICA.md` a partir de `src/content/demoExercises.ts`, conferindo as fontes. Marque claramente o que vem de fonte secundária e as divergências.
- **registrar-devolutiva**: peça à pessoa o documento do revisor (nome, registro profissional, data, autorização de exibição do nome). Sem esse documento, não registre revisor. Com ele, crie uma nova versão do conteúdo com a dose e os cuidados definidos pelo revisor e explique como publicar pelo fluxo do servidor.

Ao final, passe as mudanças pelo `clinical-safety-reviewer` e rode `npm test`.
