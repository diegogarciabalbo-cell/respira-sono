# Arquitetura e decisões técnicas

## Visão geral

```
┌──────────────── App React Native (Expo SDK 58, TypeScript) ────────────────┐
│ UI (expo-router)   Hoje · Gravar · Exercícios · Histórico · Perfil         │
│        │                                                                    │
│ Estado (AppContext) ── flags (servidor) ── preferências ── consentimentos   │
│        │                                                                    │
│ Serviços: recorder · files · database · remote(Supabase opcional)          │
│        │                     │                                              │
│ Domínio puro: journal → coverage → signal → report / guidance / content    │
│        │                                                                    │
│ SQLite local (expo-sqlite)  ·  Arquivos privados do app (áudio + diário)    │
└────────┼────────────────────────────────────────────────────────────────────┘
         │ Expo Modules API
┌────────▼──────────── modules/respira-recorder (nativo) ─────────────────────┐
│ Android: Foreground Service tipo "microphone" + AudioRecord + MediaCodec AAC │
│ iOS: AVAudioSession(.record, .measurement) + AVAudioEngine + AVAudioFile    │
│ Ambos: segmentos de 5 min · journal.jsonl append-only (fsync) · eventos     │
└─────────────────────────────────────────────────────────────────────────────┘
```

Serviços desacoplados: **captura** (nativo), **reconstrução/cobertura** (`src/domain/journal.ts`, `coverage.ts`), **análise de sinal** (`signal.ts`), **relatórios** (`report.ts`), **orientação** (`guidance.ts`, sem acesso a dados acústicos) e **conteúdo** (`content.ts`).

## Decisões

### 1. React Native + Expo com development build (não PWA)
Uma PWA não mantém o microfone com a tela bloqueada de forma confiável. Expo com prebuild (CNG) dá acesso a código nativo próprio mantendo o fluxo Expo. `android/` e `ios/` são gerados e não versionados.

### 2. Gravador nativo próprio em vez de `expo-audio` para a noite
A documentação do `expo-audio` (SDK 58, consultada em 21/10/2026) suporta gravação em segundo plano (`enableBackgroundRecording` + `allowsBackgroundRecording`), mas grava **um único arquivo** por sessão (`.m4a`), finalizado apenas no `stop()`. Em um encerramento forçado, um `.m4a` sem o índice final pode ficar irrecuperável, perdendo a noite inteira. Requisitos de persistência progressiva, blocos recuperáveis, medição de lacunas e tratamento de interrupções exigiram controle no código nativo. `expo-audio` continua sendo usado para **reprodução** e **permissão** (com `enableBackgroundRecording: false` para não declarar um segundo serviço).

### 3. Formato de áudio
| | Android | iOS |
|---|---|---|
| Codec | AAC-LC, mono | AAC-LC, mono |
| Taxa / bits | 16 kHz / 32 kbps (padrão), 44,1 kHz / 64 kbps (alta) | idem |
| Contêiner | **ADTS (.aac)** — cada quadro é independente: um arquivo interrompido é reproduzível até o último quadro completo | **.m4a** — finalizado ao fechar o segmento |
| Segmento | 5 min | 5 min |
| Perda máxima em falha | ~5 s (fsync a cada 5 s) | até o segmento em curso (≤ 5 min) |

Justificativa: 16 kHz mono preserva a faixa até 8 kHz (respiração e ronco audíveis), coincide com a entrada de classificadores sonoros comuns (ex.: YAMNet usa 16 kHz mono) e ocupa ~15 MB/h (~120 MB por noite de 8 h). AAC é reproduzível nativamente nos dois sistemas. No iOS o `.m4a` foi escolhido por compatibilidade do `AVAudioFile`; a perda máxima é limitada pelo tamanho do segmento e fica registrada como lacuna "Trecho perdido após encerramento inesperado".

### 4. Segmentação sem lacunas e medição das lacunas reais
A rotação de segmento acontece no fluxo de amostras: o segmento N+1 começa exatamente onde o N termina (relógio de amostras), sem reabrir o microfone. Lacunas reais vêm de:
- **Android:** `AudioRecordingConfiguration.isClientSilenced` (sistema silenciou o app, ex.: ligação) → fecha o segmento, registra `interruption_begin/end`, não grava zeros.
- **iOS:** `AVAudioSession.interruptionNotification`, `AVAudioEngineConfigurationChange` (mudança de entrada/Bluetooth) e `mediaServicesWereReset` → fecha o segmento e tenta retomar.
- **Ambos:** deriva entre relógio de amostras e relógio monotônico (> 1,5 s) → `capture_drift`.
- **Encerramento do processo:** o diário termina sem `session_stop`; na próxima abertura a sessão é reconciliada como "interrompida", segmentos abertos são inspecionados (`probeSegment`) e o período após o último áudio salvo **não** é contado.

Cobertura = união dos intervalos com áudio ÷ janela da sessão. Lacunas menores que 250 ms entre segmentos são tratadas como jitter de relógio (testado).

### 5. Android
- Serviço `NightRecorderService` com `foregroundServiceType="microphone"`, iniciado **apenas por toque do usuário com o app visível** (Android 14+ lança `SecurityException` se um FGS de microfone for criado em segundo plano). `START_NOT_STICKY`: não reiniciamos sozinhos.
- Notificação persistente "Gravando sua noite" com ação "Encerrar".
- `PARTIAL_WAKE_LOCK` limitado à duração máxima (12 h + margem). Captura em thread com prioridade de áudio; nenhum temporizador JavaScript participa da captura.
- `VOICE_RECOGNITION` como fonte preferida (menos AGC/supressão de ruído na maioria dos aparelhos), com fallback para `MIC`.
- Mudança de rota (Bluetooth/fone) registrada; parada por falta de espaço (< 150 MB) registrada.
- A tela "Gravar" indica a otimização de bateria do fabricante, sem pedir isenção automaticamente.

### 6. iOS
- `AVAudioSession` categoria `.record`, modo `.measurement`, `UIBackgroundModes: audio`.
- Arquivos com `FileProtectionType.completeUntilFirstUserAuthentication` (gravação continua com a tela bloqueada após o primeiro desbloqueio) e excluídos do backup do iCloud.
- Interrupções: segmento fechado, estado "interrompida", retomada automática com até 5 tentativas; se não retomar, a lacuna permanece aberta até o usuário encerrar.

### 7. Persistência local
- SQLite (`expo-sqlite`, WAL) com migrações versionadas por `PRAGMA user_version`.
- A **fonte de verdade da gravação é o diário nativo** (`journal.jsonl`), escrito com `fsync` por linha. O banco é reconstruído a partir dele (idempotente), o que torna a recuperação após falha determinística.
- Retenção configurável (7/30/90 dias ou até apagar): apaga o áudio e mantém o resumo; noites marcadas "manter" são preservadas.

### 8. Análise
Camadas separadas (ver `ANALISE-ACUSTICA.md`): A captura · B qualidade/atividade sonora (implementada, não identifica ronco) · C classificação experimental (não implementada; sem números falsos) · D avaliação clínica (fora do escopo).

### 9. Orientação e segurança
`nextSteps()` recebe **somente sintomas relatados** — a assinatura da função impede que um resultado acústico discreto apague uma orientação motivada por sintomas. Regras versionadas e marcadas como provisórias até revisão clínica real.

### 10. Servidor (opcional)
Supabase: autenticação, RLS por proprietário, compartilhamento com profissional por escopo/prazo/revogação, storage privado com signed URLs, flags de módulos aplicadas no banco, fluxo editorial imposto por gatilhos. Detalhes em `supabase/migrations/`.

## Escolhas reversíveis tomadas sem consulta
- Segmento de 5 min e preset 16 kHz/32 kbps (ajustáveis em `src/services/recorder.ts` / `src/domain/storage.ts`).
- Limite de 12 h por sessão.
- Retenção padrão de 30 dias para o áudio.
- Modo de demonstração ligado por padrão em desenvolvimento (sempre identificado).
