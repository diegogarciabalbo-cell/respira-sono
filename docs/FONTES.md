# Fontes consultadas

Registro de consulta: 21/10/2026. Fontes comerciais descrevem concorrentes e não comprovam a eficácia deste app. Resultados de estudos não são transferidos para este software.

## Consultadas nesta entrega

| Fonte | O que confirmamos | Limitações |
|---|---|---|
| [Expo Audio — documentação](https://docs.expo.dev/versions/latest/sdk/audio/) (versão recomendada ~58.0.10) | `enableBackgroundRecording` + `allowsBackgroundRecording`; Android usa FGS com notificação; iOS usa modo de fundo `audio`; presets gravam um arquivo `.m4a`; diretório `cache` pode ser limpo pelo sistema; gravação para ao desconectar fone/Bluetooth | Motivou o gravador nativo próprio (ver ARQUITETURA) |
| [Android — restrições de FGS em segundo plano](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start) | FGS de microfone precisa ser iniciado com atividade visível; Android 14+ lança `SecurityException` se criado em segundo plano | — |
| [Anvisa — SaMD: perguntas e respostas](https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2022/software-como-dispositivo-medico-perguntas-e-respostas) | Referência à RDC 657/2022 | A página não trouxe vigência, critérios nem classificação; precisa ler a RDC e o documento de P&R |
| [YAMNet — class map](https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv), [README](https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/README.md), [LICENSE](https://raw.githubusercontent.com/tensorflow/models/master/LICENSE) | Classe 38 "Snoring"; 16 kHz mono; 521 classes; Apache 2.0 | Desempenho da classe ronco em quarto não publicado; página do GitHub bloqueada a robôs (lemos os arquivos brutos) |

## Indicadas no briefing e não relidas nesta entrega
Citadas no app/documentação apenas como referências; **ler os originais antes de adaptar qualquer conteúdo clínico**:
- Ieto et al., 2015 — https://pubmed.ncbi.nlm.nih.gov/25950418/
- Guimarães et al., 2009 — https://pubmed.ncbi.nlm.nih.gov/19234106/
- Revisão Cochrane, 2020 — https://www.cochrane.org/evidence/CD013449_myofunctional-therapy-oropharyngeal-mouth-and-throat-exercises-people-obstructive-sleep-apnoea
- AASM, 2025 — https://aasm.org/wp-content/uploads/2025/04/apps-devices-sleep-apnea-risk-health-advisory.pdf
- AASM, 2017 — https://pmc.ncbi.nlm.nih.gov/articles/PMC5337595/
- Agência FAPESP — https://agencia.fapesp.br/scientists-prove-effectiveness-of-mouth-exercises-to-combat-snoring/21880
- Apple — AVAudioSession `.record` — https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/record
- ANPD — perguntas frequentes — https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes
- Concorrentes: SnoreLab, SnoreGym, Sleep Cycle, Snorefox, SleepUp (links no briefing).

Os nomes de pesquisadores (Ieto, Kayamori, Lorenzi-Filho, Guimarães) aparecem apenas como autores de referências, nunca como parceiros, revisores ou endossantes.
