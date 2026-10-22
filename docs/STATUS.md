# O que funciona, o que depende de terceiros e o que ainda exige validação

Data: 21/10/2026. Nada abaixo deve ser lido como "pronto para lançamento".

## Verificado neste ambiente

| Verificação | Resultado |
|---|---|
| `npm test` — 68 testes (reconstrução do diário, cobertura/lacunas, recuperação após falha, sinal, orientação, relatório, fluxo editorial, exercícios em rascunho, flags, banco local, exclusão, consentimentos, retenção, i18n, limites e termos das fichas de loja) | ✅ passa |
| `npm run test:db` — 16 testes das migrações Supabase em Postgres embutido (RLS por proprietário, compartilhamento com escopo/revogação, papéis, flags clínicas, fluxo editorial, storage, cascata na exclusão) | ✅ passa |
| `tsc --noEmit` | ✅ sem erros |
| `expo export` (bundle JS Android + iOS) | ✅ gera os bundles |
| `expo prebuild` — manifest Android (permissões de FGS de microfone) e Info.plist (`UIBackgroundModes: audio`, texto do microfone) | ✅ gerados corretamente; autolinking encontra o módulo nativo |

## NÃO verificado (pendente)

| Item | Por quê | Como verificar |
|---|---|---|
| Compilação do Kotlin e do Swift | Ambiente sem Android SDK, Maven Central e Xcode (acesso bloqueado). Código revisado manualmente contra as APIs do expo-modules-core 58. | `npx expo run:android` / `npx expo run:ios` |
| Gravação real com tela bloqueada, 8–10 h | Requer aparelhos físicos | [TESTE-NOTURNO.md](TESTE-NOTURNO.md) |
| Comportamento em ligações, alarmes, Bluetooth, falta de espaço, revogação de permissão | Requer aparelhos | Casos 3–8 do roteiro |
| Recuperação após encerramento forçado | Lógica testada com diários sintéticos; não em aparelho | Caso 9 do roteiro |
| Consumo de bateria | Requer aparelhos | Medido no roteiro |
| Reprodução de `.aac` (ADTS) no Android pelo expo-audio | ExoPlayer suporta ADTS, mas não testado aqui | Ouvir trechos após o teste |
| Acessibilidade com TalkBack/VoiceOver e fonte do sistema ampliada | Requer aparelhos | Revisão manual |

## Corrigido nesta rodada
- Banco local (diário e sintomas) excluído do backup do iCloud no iOS (Apple 5.1.3(ii)), via `excludeFromBackup` no módulo nativo. Não verificado em aparelho.

## Depende de serviços externos

| Serviço | Uso | Sem ele |
|---|---|---|
| Supabase | Login, sincronização, conteúdo revisado publicado, flags, compartilhamento remoto | App funciona local; módulos clínicos e sincronização ficam desligados |
| EAS (Expo) | Builds na nuvem e envio às lojas | Builds locais com Android Studio/Xcode |
| Apple/Google | Contas de desenvolvedor, revisão das lojas | — |

## Exige revisão ou validação antes de uso público

1. **Conteúdo clínico:** os 6 exercícios em rascunho (baseados em Ieto et al., 2015, descritos por fontes secundárias) precisam de fonoaudiólogo com atuação em sono para instruções, dose, contraindicações e progressão. Textos da biblioteca também. Pacote em `docs/REVISAO-CLINICA.md`.
1b. **Traduções:** en, es e zh-Hans são rascunhos; revisão nativa e clínica por idioma. Telas internas ainda em português.
1c. **Versão de mercado para os EUA:** as orientações citam apneia; a orientação de bem-estar da FDA (jan/2026) pode exigir outro texto. Ver `docs/GO-TO-MARKET.md` §5.
2. **Regras de "próximos passos":** v0.1.0, provisórias; revisão por médico do sono.
3. **Enquadramento regulatório** (Anvisa) — ver [REGULATORIO.md](REGULATORIO.md).
4. **Privacidade/LGPD:** bases legais, política de privacidade, RIPD (relatório de impacto) e revisão jurídica — ver [PRIVACIDADE.md](PRIVACIDADE.md).
5. **Classificador de ronco:** não implementado; exige validação acústica antes de qualquer número — ver [ANALISE-ACUSTICA.md](ANALISE-ACUSTICA.md).
6. **Questionários (ex.: STOP-Bang):** não incluídos. Só após confirmar versão validada em português, licença, população e enquadramento.
7. **Teste com usuários** da hipótese de diferenciação (experiência em português, gravação confiável, adesão, privacidade).
8. **Marca:** "RESPIRA Sono" é provisório e não foi verificado.

## Fora desta entrega (por decisão)
Cobrança, chatbot/LLM, integração com relógios/oxímetros, portal do profissional (há o modelo de dados e RLS), análise de engasgos.
