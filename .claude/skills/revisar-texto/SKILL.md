---
name: revisar-texto
description: Revisão de segurança clínica e de alegações para qualquer texto voltado ao usuário (tela, loja, anúncio, post, landing page). Passe o caminho do arquivo ou cole o texto.
argument-hint: [arquivo ou texto]
---

Revise o seguinte conteúdo com o subagente `clinical-safety-reviewer`:

$ARGUMENTS

Regras:
- Se for um caminho, leia o arquivo inteiro. Se for um diretório, revise os textos voltados ao usuário que estão nele.
- Se o texto for para um mercado específico (EUA, UE, China…), peça também a opinião do `regulatory-privacy-officer` sobre as alegações permitidas nesse mercado.
- Devolva o parecer (APROVADO / APROVADO COM AJUSTES / REPROVADO) com o texto alternativo sugerido para cada problema.
- Não aplique as mudanças sem confirmação, a menos que a pessoa tenha pedido.
