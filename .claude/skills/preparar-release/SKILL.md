---
name: preparar-release
description: Checklist e preparação de lançamento nas lojas (teste interno, beta ou produção) para Android, iOS ou ambos.
argument-hint: [android|ios|all] [interno|beta|producao]
disable-model-invocation: true
---

Prepare um release do RESPIRA Sono. Plataforma e trilha: $ARGUMENTS

Coordene os especialistas nesta ordem e pare no primeiro bloqueio:

1. `qa-engineer` — verificação completa (/qa-completo). Para beta ou produção, confira em `docs/TESTE-NOTURNO.md` se há noites completas registradas por plataforma. Se não houver, a trilha máxima permitida é "interno".
2. `clinical-safety-reviewer` — revise `store/listings.json` nos idiomas do release e os textos novos do app.
3. `regulatory-privacy-officer` — confirme os países selecionados, a política de privacidade pública e as declarações das lojas (Health apps declaration, Data safety, App Privacy, uso de foreground service de microfone). China continental fica fora sem parecer específico.
4. `aso-release-manager` — monte a checklist final da loja, as notas para o revisor da Apple, as capturas por idioma, a versão (`app.json`) e os comandos EAS.

Não execute `eas submit` nem publique nada. Entregue a checklist com os comandos prontos e espere a confirmação explícita da pessoa responsável.
