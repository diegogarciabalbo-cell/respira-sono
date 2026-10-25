# Como colocar o RESPIRA Sono à venda

Plano de 25/10/2026. Preços e taxas mudam com frequência: confira cada número na fonte antes de decidir. **Não é orientação jurídica, contábil ou tributária.** Converse com um contador e um advogado antes de cobrar.

## 1. Ordem certa (não pule etapas)

| Etapa | O que precisa estar pronto | Por quê |
|---|---|---|
| 1. Grátis no beta | Teste noturno aprovado; beta fechado | Primeiro provar que as pessoas gravam a 2ª noite e continuam usando |
| 2. Empresa e contratos | CNPJ, conta bancária PJ, contratos de apps pagos da Apple e do Google, política de privacidade e termos | Sem isso as lojas não pagam |
| 3. Regulatório | Análise da Anvisa sobre o programa de exercícios **pago** | Cobrar por "programa de exercícios para ronco" reforça a finalidade terapêutica e pode mudar o enquadramento |
| 4. Conteúdo revisado | Exercícios aprovados por fonoaudiólogo, com contrato e responsabilidade técnica | Não se vende rascunho |
| 5. Premium | Assinatura com teste grátis, medindo conversão e cancelamento | Cobrança só depois de 1 a 4 |

## 2. O que fica grátis e o que é pago (proposta)

**Grátis para sempre** (exigência do briefing e boa prática):
- Gravar e ouvir as noites
- Resumo da noite com qualidade e lacunas
- Orientações de segurança e próximos passos
- Diário básico
- Exportar e apagar os dados
- Histórico das últimas 7 noites

**RESPIRA Premium** (hipótese a testar):
- Histórico completo e comparação entre noites e fases
- Programa de exercícios **revisado por profissional**, com progressão, lembretes e acompanhamento da adesão
- Relatório completo em PDF para a consulta, com tendências
- Mais tarde: compartilhamento remoto com o profissional

**Nunca atrás de pagamento:** segurança, exclusão, exportação básica e qualquer coisa ligada a "procure atendimento".

**Linha de marketing:** "Premium = mais acompanhamento e organização". Nunca "Premium = mais saúde" ou medo de doença.

## 3. Preço (hipóteses para testar, não decisão)

Referência de concorrentes na App Store dos EUA (preços em dólar, levantados em setembro de 2026 por um concorrente, então leia com cuidado):

| App | Mensal | Anual |
|---|---|---|
| SnoreLab | US$ 5,99 a 9,99 | US$ 17,99 a 59,99 (há também compra única de US$ 7,99) |
| Snore Control | US$ 4,99 | US$ 15,99 |
| Koala Nap | US$ 6,99 a 9,99 | US$ 29,99 a 39,99 |
| SleepScore | US$ 9,99 | US$ 59,99 |
| ShutEye | US$ 9,99 | US$ 59,99 |

Há também apps de ronco **totalmente gratuitos**: a gravação sozinha não sustenta cobrança. O valor pago tem de estar no acompanhamento e no programa revisado.

**Hipótese para o Brasil** (testar no beta com entrevistas e testes de preço):
- Mensal entre **R$ 14,90 e R$ 24,90**
- Anual entre **R$ 89,90 e R$ 149,90**, em destaque, com cerca de 7 dias grátis
- Um "programa de 12 semanas" como compra única é alternativa a testar (combina com a duração dos estudos e evita a sensação de assinatura eterna)

## 4. Taxas das lojas (o que sobra para você)

**Apple (Brasil):** desde 18/06/2026, por acordo com o CADE, o iOS no Brasil aceita três formas de pagamento:
1. Compra dentro do app pela Apple
2. Processador próprio dentro do app (oferecendo também a opção Apple)
3. Link para pagamento na web

A comissão padrão é de 21%, mais 5% de processamento quando o pagamento é pela Apple. Para quem está no **Programa de Pequenas Empresas** (até US$ 1 milhão por ano) e para assinaturas a partir do 2º ano, a comissão cai para **10%**. Fora do Brasil, quem está no programa paga 15% sobre assinaturas desde o 1º ano. **Entre no Small Business Program assim que a conta for aprovada.**

**Google Play:** assinaturas pagam 15%. A opção com faturamento próprio (10% + taxa do processador) começou em 30/06/2026 nos EUA, Reino Unido e EEE; para a maioria dos outros mercados a previsão é setembro de 2027. Confirme a regra vigente no Brasil antes de decidir.

**Recomendação inicial:** use a compra dentro do app das duas lojas (mais simples, com reembolso e "restaurar compras" prontos). Avalie o link para a web no Brasil quando houver volume.

**Exemplo ilustrativo** (assinatura anual de R$ 119,90 pela Apple no Brasil, como pequena empresa, e supondo que a comissão reduzida de 10% se soma aos 5% de processamento; confirme no contrato):
- Apple: cerca de R$ 18 (15%)
- Sobra antes de impostos: cerca de R$ 102
- Impostos dependem do regime; o contador calcula.

## 5. Empresa e impostos (para levar ao contador)
- **MEI não serve** para desenvolvimento ou licenciamento de software, segundo contadores consultados. Abrir CNPJ com atividade errada pode cancelar o registro e gerar autuação.
- O caminho mais comum é uma **ME no Simples Nacional** com CNAE de software (ex.: edição ou licenciamento de programas). O anexo e a alíquota dependem do enquadramento e do fator R. **O contador define.**
- As lojas pagam do exterior (Apple e Google): o contador precisa orientar sobre receita de exportação de serviço, câmbio e notas.
- Para a Apple, conta de **organização** precisa do D-U-N-S da empresa. Se você começou como pessoa física, a mudança é feita com a Apple.

## 6. Contratos e regras de consumo
- Termos de uso e de assinatura claros: preço, renovação automática, como cancelar, teste grátis.
- Código de Defesa do Consumidor: direito de arrependimento e informação clara. Os reembolsos de compras dentro do app seguem a política das lojas; o advogado deve confirmar como isso se aplica.
- Política de privacidade pública (URL, não PDF), já prevista em `PRIVACIDADE.md`.
- Nunca usar dado de saúde para preço, oferta ou anúncio.

## 7. Implementação técnica (quando chegar a hora)
- Biblioteca de compras compatível com Expo (ex.: RevenueCat ou similar) para assinaturas nas duas lojas, teste grátis e "restaurar compras".
- Direito de acesso validado no servidor (Supabase), nunca só no aparelho.
- A cobrança não altera nada do que é grátis; testes automatizados garantem isso.
- O agente `aso-release-manager` cuida da configuração nas lojas, e o `regulatory-privacy-officer` revisa termos e dados.

## 8. B2B2C: clínicas e fonoaudiólogos (segunda receita)
- Licença por profissional ou por clínica: painel com os pacientes que **consentiram**, relatórios e prescrição do programa revisado.
- Melhor canal de aquisição (o paciente chega pelo profissional) e reforça a regra "exercício com acompanhamento".
- Exige o portal profissional (modelo de dados e RLS já existem) e contrato com termos de tratamento de dados.

## 9. Metas para decidir o preço
Combine as metas antes de lançar o Premium:
- Teste grátis → pagante: referência a definir
- Cancelamento no 1º mês: referência a definir
- Receita por usuário ativo vs. custo por usuário retido (ver `GO-TO-MARKET.md`)

## Fontes (consultadas em 25/10/2026)
- Apple Brasil: [9to5Mac, 18/06/2026](https://9to5mac.com/2026/06/18/apple-announces-major-app-store-changes-for-brazil-including-alternative-app-marketplaces/) · [Neon Pay](https://www.neonpay.com/blog/apples-brazil-antitrust-settlement-whats-going-to-change-for-mobile-game-developers) · [The Next Web](https://thenextweb.com/news/apple-brazil-cade-sideloading-alternative-app-stores)
- Small Business Program: [Adapty, 2026](https://adapty.io/blog/app-store-small-business-program/)
- Google Play: [Adapty](https://adapty.io/blog/google-play-billing-changes-subscriptions-fees) · [Central de Ajuda do Play](https://support.google.com/googleplay/android-developer/answer/16954621)
- Preços de concorrentes: [Snore Timeline, set/2026 (concorrente)](https://snoretimeline.com/blog/snoring-app-no-subscription) · [Adapty, paywall do SnoreLab](https://adapty.io/paywall-library/snorelab/)
- MEI e software: [Meu Contador Online](https://www.meucontadoronline.com.br/blog/desenvolvedor-de-software-pode-ser-mei/) · [Agilize](https://agilize.com.br/artigos/cnae-ideal-desenvolvedores-ti-2026/)
