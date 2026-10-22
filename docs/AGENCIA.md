# A agência: agentes do Claude Code para o RESPIRA Sono

Os agentes ficam em `.claude/agents/` e os fluxos (comandos `/`) em `.claude/skills/`. Abra o projeto no Claude Code e eles são carregados automaticamente. Você pode pedir em linguagem natural ("revise os textos da loja em espanhol") ou chamar um agente pelo nome ("use o qa-engineer para…").

## Equipe

| Agente | Papel | Pode editar? | Quando entra |
|---|---|---|---|
| `qa-engineer` | Roda e escreve testes; acompanha o teste noturno | Sim | Depois de toda mudança de código (automático) |
| `native-mobile-engineer` | Kotlin/Swift do gravador, builds, bateria, Bluetooth, interrupções | Sim | Builds e bugs nativos |
| `clinical-safety-reviewer` | Barra alegações clínicas, promessas e linguagem de medo | **Não** (só parecer) | Antes de qualquer texto voltado ao usuário (automático) |
| `regulatory-privacy-officer` | Requisitos por país e por loja, LGPD/GDPR/PIPL, com fonte e data | Só documentos | Novo país, nova coleta de dados, módulo clínico, release |
| `exercise-content-editor` | Rascunhos de exercício, pacote do revisor, fluxo editorial | Sim | Conteúdo clínico |
| `localization-specialist` | i18n pt/en/es/zh, glossário, textos de loja | Sim | Novo idioma ou tela |
| `aso-release-manager` | Fichas, capturas, declarações, TestFlight/teste fechado, EAS | Sim (não envia sozinho) | Releases |
| `organic-growth-marketer` | SEO, conteúdo, vídeo curto, parcerias, indicação | Sim (`marketing/`) | Planejamento orgânico |
| `paid-media-manager` | Search Ads, App Campaigns, Meta, TikTok, medição sem dado de saúde | Sim (`marketing/paid/`) | Depois dos critérios da fase 1 |

## Fluxos prontos

| Comando | O que faz |
|---|---|
| `/qa-completo` | Testes, banco, tipos e bundle, com relatório |
| `/revisar-texto <arquivo ou texto>` | Parecer de segurança clínica (e regulatório por mercado, se for o caso) |
| `/preparar-release <android\|ios\|all> <interno\|beta\|producao>` | QA → segurança → regulatório → checklist de loja. Não envia nada sem a sua confirmação |
| `/lancar-idioma <idioma>` | Migra a próxima tela, atualiza a loja, revisa e lista o que precisa de nativo |
| `/planejar-campanha <canal> <país> <objetivo>` | Plano orgânico ou pago com regras de saúde e medição |
| `/revisar-exercicios <preparar\|registrar-devolutiva>` | Pacote do revisor e registro da devolutiva real |

## Regras da casa (valem para todos)
1. Texto voltado ao usuário só fica pronto depois do parecer do `clinical-safety-reviewer`.
2. Mudança em dados pessoais passa pelo `regulatory-privacy-officer`.
3. Nada é marcado como testado em aparelho, revisado por nativo ou aprovado por profissional sem evidência de uma pessoa real.
4. Envio para loja, publicação de anúncio e gasto de dinheiro: sempre com a sua confirmação explícita.

## O que os agentes não substituem
Fonoaudiólogo e médico do sono (conteúdo e responsabilidade técnica), consultor regulatório (Anvisa/FDA/MDR), advogado de proteção de dados, tradutor nativo com experiência em saúde e pessoas reais testando nos aparelhos.
