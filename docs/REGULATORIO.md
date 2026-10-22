# Enquadramento regulatório — análise necessária (Brasil)

> Este documento **não** é parecer regulatório e não declara classe de risco nem regularização. Ele lista o que precisa ser analisado por profissional de assuntos regulatórios antes da liberação pública de módulos com finalidade médica. Consultado em 21/10/2026.

## Norma de referência
- **RDC Anvisa nº 657/2022** — dispõe sobre a regularização de software como dispositivo médico (SaMD). Página da Anvisa: "Software como Dispositivo Médico: perguntas e respostas" (publicada em 19/10/2022).
- Não conseguimos confirmar nesta pesquisa, pela página consultada: a data de vigência, os critérios detalhados de enquadramento, exemplos de exclusão (ex.: bem-estar) e a relação com as regras de classificação de risco de dispositivos médicos. **Verificar o texto da RDC 657/2022, o documento de perguntas e respostas e as normas vigentes na data do lançamento** (incluindo eventuais atualizações e normas de classificação de risco e de boas práticas).

## Por que a análise é necessária
Rotular o app como "bem-estar" ou incluir um aviso **não** define sozinho o enquadramento. O que importa é a **finalidade pretendida** e as alegações feitas (no app, nas lojas, no marketing, para profissionais).

## Módulos e finalidade

| Módulo | Finalidade nesta versão | Situação técnica |
|---|---|---|
| Gravação, reprodução, qualidade do sinal, diário | Registro e organização de informações autorrelatadas e de áudio | Ativo |
| Educação (biblioteca) | Informação geral, sem individualização | Ativo, textos provisórios |
| Exercícios (`clinical_content`) | Potencialmente terapêutica (terapia miofuncional orofacial) | **Desligado no servidor**; produção exige registro de análise regulatória |
| Triagem individual (`individual_triage`) | Potencialmente de triagem | **Desligado**; produção exige registro de análise regulatória |
| Diagnóstico (`diagnostic`) | Diagnóstica | **Bloqueado em produção** por restrição no banco |
| Classificação de ronco (`snore_classifier`) | Estimativa acústica não diagnóstica (a confirmar na análise) | Desligado; não implementado |

O banco impõe: `diagnostic` nunca habilitado em produção; `clinical_content` e `individual_triage` em produção só com referência a um registro em `regulatory_assessments`.

## Perguntas para a análise
1. As "orientações de próximos passos" baseadas em sintomas configuram triagem individual?
2. O programa de exercícios revisado por fonoaudiólogo, oferecido no app, configura SaMD com finalidade terapêutica?
3. A estimativa de minutos de ronco (se implementada) com linguagem não diagnóstica altera o enquadramento?
4. O relatório enviado a um profissional muda a finalidade?
5. Quais requisitos se aplicam (classe de risco, notificação/registro, boas práticas de fabricação, gestão de risco, validação de software, vigilância pós-mercado, rotulagem, cibersegurança)?
6. Obrigações profissionais: atuação de fonoaudiólogos e médicos (conselhos profissionais), telessaúde, publicidade em saúde.

## Alegações proibidas (independentemente da análise)
Cura, diagnóstico automático, equivalência a polissonografia, "resolve a apneia", resultados em prazos curtos, precisão não demonstrada, uso de nomes de pesquisadores como parceiros ou endossantes sem autorização.
