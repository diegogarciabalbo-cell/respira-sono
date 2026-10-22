# Plano de lançamento, lojas e marketing

> Plano de trabalho preparado em 21/10/2026. Fatos sobre lojas e regras têm fonte e data no fim. Tudo o que é regulatório ou jurídico precisa ser confirmado por profissional antes de cada país. Orçamentos são hipóteses, não cotações.

## 1. Tese
Mercado com concorrentes fortes (SnoreLab, Sleep Cycle, SnoreGym, Snorefox; no Brasil, SleepUp). O app **não** ganha por ter um gravador. Ele ganha se cumprir três coisas, nesta ordem:
1. **Gravação que não falha** (a noite inteira, com lacunas explicadas).
2. **Experiência simples no idioma do usuário**, com privacidade clara (o áudio fica no celular).
3. **Continuidade com profissionais**: relatório útil na consulta e exercícios revisados por fonoaudiólogo.

Público principal: **adultos que roncam e quem divide o quarto com eles**. O parceiro ou a parceira é muitas vezes quem decide procurar uma solução, e é o canal de indicação mais natural.

## 2. Fases e critérios para avançar

| Fase | O quê | Para avançar |
|---|---|---|
| **0. Validação técnica** (agora) | Builds em aparelho, roteiro de `TESTE-NOTURNO.md`, revisão clínica dos exercícios, política de privacidade | ≥ 3 noites completas por plataforma com cobertura ≥ 99% sem interrupção externa; zero perda silenciosa; revisor contratado |
| **1. Beta fechado Brasil** (pt-BR) | 100–300 pessoas: lista de espera + pacientes de 3 a 5 fonoaudiólogos parceiros. Google Play teste fechado e TestFlight | Hipóteses de referência (definir a meta antes de começar): ≥ 50% gravam a 2ª noite; ≥ 25% ainda usam na 4ª semana; noites sem falha ≥ 98%; NPS e entrevistas |
| **2. Lançamento Brasil** | Lojas públicas no Brasil, orgânico forte, testes pagos pequenos (Apple Search Ads) | Custo por usuário retido < valor esperado por usuário; avaliação média ≥ 4,5 |
| **3. Espanhol** (México, Colômbia, Chile, Argentina; Espanha depois) | Textos e conteúdo revisados por nativos; número de emergência por país; análise regulatória por país | Mesmos critérios da fase 2, por país |
| **4. Inglês** (EUA, Reino Unido, Canadá, Austrália) | **Versão de mercado** dos textos de orientação (ver §5), análise FDA/MHRA | Parecer regulatório por país |
| **5. Chinês** | Começar por Taiwan/Hong Kong (exige zh-Hant) ou Singapura/Malásia (zh-Hans). China continental só com parceiro local | Parecer específico; ver §5 |

**Por que não lançar os 4 idiomas ao mesmo tempo:** cada idioma multiplica revisão clínica, revisão regulatória, suporte e conteúdo. Lançar mal num país grande queima a ficha da loja com avaliações ruins. Primeiro prove a retenção em um mercado (o seu), depois copie o que funcionou.

## 3. Como colocar nas lojas

### Contas (fazer já, porque demoram)
- **Apple Developer Program** como **organização** (pede CNPJ e número D-U-N-S; nome jurídico aparece na loja). Conta individual mostra seu nome pessoal.
- **Google Play Console** como **organização** (verificação de identidade da empresa). Contas **pessoais** criadas após 13/11/2023 precisam de **teste fechado com pelo menos 12 testadores, inscritos por 14 dias seguidos**, antes de pedir acesso à produção. A página de ajuda não diz se contas de organização estão isentas. Conte esse prazo no cronograma de qualquer forma.
- Domínio, e-mail de suporte e **política de privacidade em URL pública** (não PDF), exigida pelas duas lojas.
- Verificação de marca "RESPIRA Sono" (INPI e lojas) antes de imprimir qualquer material.

### Google Play: obrigatórios para este app
1. **Health apps declaration**: todo app precisa preencher. Categoria provável: *Health and fitness → Sleep Management*.
2. **Aviso**: apps de saúde que não são dispositivo médico precisam informar que "não é um dispositivo médico e não diagnostica, trata, cura nem previne doenças" e lembrar o usuário de procurar um profissional. Já está nas fichas e no app; um teste automático garante.
3. **Data safety**: áudio (opcional, no aparelho), dados de saúde autorrelatados, exclusão disponível, criptografia em trânsito.
4. **Foreground service de microfone**: declarar o uso e anexar um vídeo curto do usuário iniciando a gravação, com a notificação visível.
5. Trilhas: interno → fechado (≥ 12 pessoas por 14 dias, se a conta for pessoal) → produção com lançamento gradual.

### App Store: obrigatórios para este app
1. **1.4.1 (médico)**: apps que medem saúde precisam mostrar dados e método de qualquer alegação de precisão, ou são rejeitados. Precisam lembrar o usuário de consultar um médico. Nosso app não faz alegação de precisão; explique isso nas notas para o revisor.
2. **2.5.4 e 2.5.14**: áudio em segundo plano só para a finalidade declarada; consentimento explícito e indicação clara de gravação. Já temos a tela de gravação e o indicador do sistema.
3. **5.1.1 e 5.1.3**: consentimento, retirada fácil, nada de dado de saúde para publicidade e **nada de informação pessoal de saúde no iCloud**. Já corrigido: banco e áudios ficam fora do backup do iCloud.
4. **App Privacy** (rótulos de privacidade) coerentes com o Data safety.
5. TestFlight interno → externo → produção em fases.

### Fichas por idioma
Textos prontos (rascunho) em `store/listings.json`: pt-BR, en-US, es-MX/es-419, zh-Hans, com testes de limite de caracteres e de termos proibidos. Para cada idioma ainda falta: revisão nativa, capturas de tela localizadas (5 telas: gravação com tela bloqueada, resumo da manhã, ouvir trechos, diário, privacidade) e um vídeo de 15 a 30 segundos.

## 4. Marketing

### Orgânico (prioridade nas fases 1 e 2)
| Canal | Ação | Métrica |
|---|---|---|
| ASO | Palavras de categoria: ronco/roncar/gravar ronco. Testes A/B nativos de ícone e capturas | Conversão da ficha |
| Conteúdo/SEO | Site com 10 guias sérios ("por que ronco", "ronco ou apneia: quando procurar médico", "como gravar o ronco", "o que é polissonografia", "exercícios para ronco: o que a pesquisa diz"), com fontes | Visitas orgânicas → instalações (UTM) |
| Vídeo curto | "Ouvi meu ronco pela primeira vez", "quem divide o quarto sabe", mitos e verdades com especialista convidado | Visualizações → visitas à ficha |
| Profissionais | Fonoaudiólogos e médicos do sono usam o relatório na consulta; o app vira ferramenta do consultório | Pacientes ativos por parceiro |
| Indicação | "Convide quem divide o quarto" | Convites → instalações |
| Imprensa | Privacidade e gravação confiável; pesquisa brasileira só como contexto | Menções |

### Pago (só depois dos critérios da fase 1)
1. **Apple Search Ads**: intenção alta, começar com palavras exatas. Teste de 14 dias por país.
2. **Google App Campaigns** (Search, Play, YouTube).
3. **Meta e TikTok**: mensagem de casal, otimizando para instalação e eventos de topo. A Meta classifica anunciantes de saúde e bem-estar e restringe a otimização para eventos de meio e fim de funil e o compartilhamento de parâmetros de URL.

**Regra de medição:** nenhum dado de saúde vai para plataformas de anúncio. Sem pixels nem SDKs de rastreamento no app nesta fase. Medição por AdServices/SKAdNetwork (Apple), Install Referrer (Google), UTM e coortes anônimas no app. A métrica que importa é **custo por pessoa que grava a 2ª noite**, não custo por instalação.

**Orçamento de teste (hipótese):** R$ 1.500 a R$ 3.000 por canal e país, por 14 dias, com critério de parada definido antes. Não escale antes de ter retenção.

## 5. Mercados e idiomas: o que muda

| Mercado | Ponto crítico | Implicação no produto |
|---|---|---|
| **Brasil** | RDC Anvisa 657/2022 (software como dispositivo médico) e LGPD | Módulos clínicos desligados até haver análise; consentimentos separados (já feito) |
| **EUA** | Orientação de bem-estar da FDA atualizada em 06/01/2026: citar doenças específicas, limiares clínicos, orientação de tratamento ou equivalência clínica pode tirar o produto da política de bem-estar. Mensagens de "procure um profissional" são aceitas se não citarem a doença nem chamarem o resultado de anormal | **Precisa de versão de mercado** das regras de orientação e da biblioteca. Hoje o texto cita apneia. Isso é uma mudança de produto, a decidir com o regulatório |
| **UE/Reino Unido** | Se houver finalidade médica, MDR 2017/745 (o Google Play exige dados do dispositivo); GDPR | Começar só como registro e bem-estar, sem módulo de triagem |
| **América Latina (es)** | Regulador e lei de dados por país (ex.: COFEPRIS no México) | Análise por país; número de emergência local |
| **China continental** | App filing/ICP no MIIT exigido pela App Store, na prática com entidade ou publicador local; Google Play indisponível (lojas Android locais, cada uma com regras); PIPL; enquadramento NMPA incerto | **Não lançar nesta fase.** Para falantes de mandarim: Taiwan/Hong Kong (criar zh-Hant) ou Singapura/Malásia (zh-Hans) |

## 6. Hipótese comercial (sem cobrança agora)
Gratuito para sempre: gravação, reprodução, segurança, exportação e exclusão. Assinatura (hipótese): histórico longo e comparações, programa revisado com progressão, relatórios detalhados, compartilhamento remoto. Canal B2B2C com clínicas. Validar a disposição a pagar com entrevistas no beta antes de construir.

## 7. Próximas 6 semanas (proposta)
| Semana | Engenharia/QA | Clínico/Regulatório | Marketing |
|---|---|---|---|
| 1 | Build Android + iOS em aparelho; corrigir o que aparecer | Contratar fonoaudiólogo revisor; consultor regulatório | Contas Apple/Google (organização), domínio, política de privacidade |
| 2 | 3 noites por plataforma (`TESTE-NOTURNO.md`) | Revisão dos 6 exercícios | Página de lista de espera + 3 primeiros guias |
| 3 | Correções; publicar no teste fechado | Parecer Brasil | Recrutar 3–5 fonoaudiólogos parceiros |
| 4 | Beta fechado (≥ 12 testadores por 14 dias) | Textos do app revisados | Vídeos curtos; convite para o beta |
| 5–6 | Métricas do beta; entrevistas | Exercícios publicados pelo fluxo do servidor | Decidir fase 2 com os critérios |

## Fontes (consultadas em 21/10/2026)
- Google Play: [Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291) · [Política de apps de saúde](https://support.google.com/googleplay/android-developer/answer/13996823) · [Teste fechado para contas pessoais novas](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- Apple: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) (1.4.1, 2.5.4, 2.5.14, 5.1.1, 5.1.3)
- FDA, bem-estar (jan/2026): [análise da ArentFox Schiff](https://www.afslaw.com/perspectives/alerts/fda-issues-updated-guidance-low-risk-general-wellness-devices-and-clinical)
- China, app filing: [Linklaters, mai/2024](https://techinsights.linklaters.com/post/102j72l/china-the-new-app-filing-regime-keeps-mobile-apps-under-tight-scrutiny)
- Meta, restrições de saúde e bem-estar: [Search Engine Land, mar/2025](https://searchengineland.com/meta-ads-restrictions-health-wellness-campaigns-453094)
- Exercícios e evidência: ver `docs/REVISAO-CLINICA.md`
