# RESPIRA Sono (nome provisório)

Aplicativo Android e iOS, em português do Brasil, para adultos que roncam: grava a noite com a tela bloqueada, mostra a qualidade da gravação e as lacunas, permite ouvir os trechos, organiza diário e exercícios e gera um relatório que o usuário decide compartilhar.

**Não é um dispositivo diagnóstico.** Não calcula IAH/AHI, saturação, estágios do sono nem probabilidade de doença, e não monitora emergências. Veja [docs/REGULATORIO.md](docs/REGULATORIO.md).

> A marca "RESPIRA Sono" é provisória. Não verificamos disponibilidade de marca, domínio ou nome nas lojas.

## Estado atual (21/10/2026)

| Item | Situação |
|---|---|
| Gravador nativo (Android FGS de microfone / iOS AVAudioEngine), segmentos, diário de lacunas, recuperação | Código pronto. **Não compilado nem executado em aparelho** neste ambiente (sem Android SDK/Xcode). Ver [docs/STATUS.md](docs/STATUS.md). |
| Banco local, reconciliação, cobertura, lacunas, exclusão, retenção | Pronto e testado (Jest + SQLite). |
| Telas (Hoje, Gravar, Exercícios, Histórico, Perfil, onboarding, resumo, diário, relatório, biblioteca, conteúdo) | Prontas; bundle JS compila para Android e iOS. |
| Análise de ronco | **Indisponível.** O app mostra "Análise automática de ronco ainda indisponível." Ver [docs/ANALISE-ACUSTICA.md](docs/ANALISE-ACUSTICA.md). |
| Exercícios | 6 exercícios em **rascunho** baseados em Ieto et al. (2015), sessão guiada, protocolo do estudo como referência. **Sem dose e sem revisor**: aguardam fonoaudiólogo ([docs/REVISAO-CLINICA.md](docs/REVISAO-CLINICA.md)). |
| Idiomas | Infra pt-BR/en/es/zh-Hans, seletor, permissão do iOS e fichas de loja nos 4 idiomas. Telas internas ainda em português (migração pelo agente de localização). |
| Agência de agentes (Claude Code) | 9 agentes em `.claude/agents/` e 6 fluxos em `.claude/skills/` ([docs/AGENCIA.md](docs/AGENCIA.md)). |
| Supabase (opcional) | Migrações, RLS, flags clínicas no servidor, fluxo editorial; testado em Postgres embutido. Não implantado. |
| Teste de 8–10 h em aparelho físico | **Pendente.** Roteiro em [docs/TESTE-NOTURNO.md](docs/TESTE-NOTURNO.md). |

## Requisitos

- Node 20+ (testado com 22.22) e npm.
- Android: Android Studio (SDK 35+, JDK 17), aparelho físico com Android 8+ (ideal: um Android 14+ e um fabricante com economia de bateria agressiva, ex.: Samsung/Xiaomi).
- iOS: macOS com Xcode atual, CocoaPods, iPhone físico com iOS 16.4+ e conta Apple Developer (gratuita serve para instalar no próprio aparelho).
- A gravação noturna **não funciona no Expo Go nem na web**: ela usa um módulo nativo local (`modules/respira-recorder`). É preciso um *development build*.

Versões fixadas: Expo SDK 58 (`expo ~58.0.17`), React Native 0.88, React 19.3 — veja `package.json` e `package-lock.json`.

## Rodar

```bash
npm install
npm test          # domínio, banco local, i18n e textos de loja (Jest + node:sqlite)
npm run test:db   # migrações Supabase + RLS em Postgres embutido (PGlite)
npm run typecheck
```

### Android (aparelho físico)

1. Ative "Opções do desenvolvedor" e "Depuração USB"; conecte o cabo e aceite a chave.
2. `npx expo run:android --device` (gera `android/` via prebuild e instala o development build).
3. Abra o app, conclua o onboarding, faça o **Teste de microfone** e depois "Começar a gravar".
4. Bloqueie a tela. A notificação "Gravando sua noite" deve ficar fixa, com o botão "Encerrar".

Sem cabo/SDK: `npx eas-cli@latest build --profile development --platform android` (requer conta Expo) e instale o APK.

### iPhone (aparelho físico)

1. `npx expo run:ios --device` (gera `ios/`, roda `pod install`, compila no Xcode).
2. Na primeira vez, configure a assinatura (Team) no Xcode em `ios/RESPIRASono.xcworkspace` e confie no perfil do desenvolvedor no iPhone (Ajustes → Geral → VPN e Gerenciamento de Dispositivos).
3. O Info.plist já inclui `UIBackgroundModes: audio` e a mensagem de microfone.

### Supabase (opcional)

O app funciona 100% local. Para sincronização, conteúdo revisado e flags no servidor:

```bash
cp .env.example .env    # preencha URL e anon key (NUNCA a service_role)
supabase link --project-ref <ref>
supabase db push        # aplica supabase/migrations
```

Todos os módulos clínicos começam **desligados** em todos os ambientes.

## Estrutura

```
modules/respira-recorder/       módulo nativo local (Expo Modules API)
  android/…/NightRecorderService.kt   FGS microfone, AudioRecord → AAC (MediaCodec) → segmentos ADTS
  android/…/AdtsWriter.kt             escrita ADTS + inspeção de arquivos após falha
  ios/NightRecorder.swift             AVAudioSession(.record) + AVAudioEngine → segmentos .m4a
  src/index.ts                        API TypeScript
src/
  app/                rotas (expo-router): (tabs)/index|gravar|exercicios|historico|perfil, onboarding, sessao/[id], …
  domain/             regras puras e testáveis: journal, coverage, signal, guidance, report, content, flags, insights, storage
  db/                 SQLite: schema+migrações, sessões/reconciliação, diário, perfil/consentimentos, exercícios
  services/           banco, arquivos, gravador, Supabase opcional
  content/            catálogo; dados de demonstração identificados
  ui/                 tema (claro/escuro, fonte ajustável) e componentes acessíveis
supabase/migrations/  esquema do servidor, RLS, storage privado
supabase/tests/       testes de RLS e regras em PGlite
tests/                testes Jest
docs/                 arquitetura, regulatório, privacidade, análise acústica, teste noturno, custos, status
```

## Documentação

- [Arquitetura e decisões técnicas](docs/ARQUITETURA.md)
- [O que funciona, o que depende de serviços externos e o que exige validação](docs/STATUS.md)
- [Roteiro do teste noturno em aparelho físico](docs/TESTE-NOTURNO.md)
- [Análise acústica: camadas, modelo candidato e plano de validação](docs/ANALISE-ACUSTICA.md)
- [Enquadramento regulatório (Anvisa) — análise necessária](docs/REGULATORIO.md)
- [Privacidade e LGPD](docs/PRIVACIDADE.md)
- [Estimativa de custos e hipótese comercial](docs/CUSTOS.md)
- [Plano de lançamento, lojas e marketing](docs/GO-TO-MARKET.md)
- [Como colocar à venda (preço, taxas, empresa)](docs/MONETIZACAO.md)
- [Exercícios: o que a pesquisa mundial mostra](docs/EVIDENCIA-EXERCICIOS.md)
- [Agência de agentes do Claude Code](docs/AGENCIA.md)
- [Pacote para revisão clínica dos exercícios](docs/REVISAO-CLINICA.md)
- [Glossário de tradução](docs/GLOSSARIO.md)
- [Fontes consultadas](docs/FONTES.md)
