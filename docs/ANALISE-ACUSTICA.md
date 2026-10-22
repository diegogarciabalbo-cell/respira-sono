# Análise acústica

## Camadas

| Camada | O que faz | Estado |
|---|---|---|
| **A. Captura** | Grava, segmenta, registra lacunas | Implementada (nativo) |
| **B. Qualidade do sinal e atividade sonora** | Nível por segundo em dBFS, silêncio digital, saturação, ruído de fundo, segundos acima do ruído de fundo, trechos para ouvir, linha do tempo | Implementada (`src/domain/signal.ts`, `signal-activity@0.1.0`) |
| **C. Classificação experimental de sons** | Estimar trechos com som de ronco | **Não implementada.** O app exibe "Análise automática de ronco ainda indisponível." |
| **D. Avaliação clínica** | Qualquer inferência sobre apneia | Fora do escopo; exige estudo clínico e enquadramento regulatório |

### Camada B — o que ela é e não é
- Escala **dBFS** (relativa ao máximo digital do microfone). Não é dB SPL calibrado; aparelhos e posições diferentes não são comparáveis.
- "Atividade sonora" = segundos com nível ≥ ruído de fundo (percentil 20 da própria noite) + 10 dB. Inclui fala, ventilador, TV, animais e outra pessoa. **Não é contagem de ronco.**
- Segundos de silêncio digital (≤ −100 dBFS: microfone mudo/bloqueado) saem do denominador.
- O denominador de qualquer percentual é o **tempo analisável**, excluindo lacunas e trechos inutilizáveis. Duração gravada ≠ tempo de sono.
- Nenhuma métrica é convertida em evento respiratório. Silêncio nunca vira "parada respiratória".

## Modelo candidato para a camada C: YAMNet

Pesquisado em 21/10/2026:

| Item | Informação | Fonte |
|---|---|---|
| Origem | Google, `tensorflow/models/research/audioset/yamnet` | README do repositório |
| Licença | Apache 2.0 (repositório `tensorflow/models`) | LICENSE do repositório |
| Treino | AudioSet (rótulos fracos de vídeos do YouTube) | README / página no Kaggle |
| Classes | 521 (das 527 do AudioSet). Inclui **38 Snoring**, 36 Breathing, 37 Wheeze, 39 Gasp, 42 Cough, 0 Speech | `yamnet_class_map.csv` |
| Entrada | 16 kHz mono; log-mel 64 bandas (125–7500 Hz), janelas de 25 ms / passo 10 ms; quadros de 0,96 s com 50% de sobreposição | README |
| Tamanho | ~3,7 M pesos; ~69,2 M multiplicações por quadro de 0,96 s | README |
| Desempenho publicado | No conjunto de avaliação do AudioSet (521 classes): d′ balanceado 2,318; mAP 0,306 | README |

**Não verificado:** desempenho específico da classe "Snoring" em gravações noturnas de celular; disponibilidade e licença de uma versão TFLite/ONNX atual; consumo em aparelho. A documentação também alerta incompatibilidade com Keras 3 no fluxo TensorFlow.

### Plano de implementação (quando houver validação)
1. Pré-processamento local: o preset padrão já grava 16 kHz mono (sem reamostragem).
2. Inferência local, em lote, **depois** do fim da noite e com o telefone carregando (evita consumo durante o sono). Biblioteca candidata: runtime TFLite/LiteRT ou ONNX Runtime via módulo nativo — a confirmar.
3. Saída por quadro: pontuação da classe Snoring; agregação em minutos estimados **somente sobre tempo analisável**.
4. Rótulo obrigatório: "experimental"; versão do modelo e do pós-processamento registradas em `acoustic_results` (`analyzer`, `analyzer_version`, `status='experimental'`).
5. Incerteza explícita: "pode incluir ronco de outra pessoa ou sons do ambiente".
6. A pontuação do modelo nunca é exibida como probabilidade de doença.

### Riscos conhecidos
- Rótulos do AudioSet são fracos e de outro domínio (vídeos), não de quartos à noite.
- Ventilador, ar-condicionado, TV, fala, animais e **outra pessoa roncando** podem gerar falsos positivos; com um telefone só, pode ser impossível saber quem roncou.
- Microfones e processamento (AGC, supressão de ruído) variam por aparelho.

## Plano de validação acústica (antes de exibir qualquer número)
1. Coleta com consentimento específico de pesquisa (desligado por padrão no app), aparelhos e quartos variados.
2. Anotação por avaliadores treinados (ronco do usuário, ronco de outra pessoa, fala, ventilador/AC, TV, animais, silêncio), com dupla anotação em parte da amostra e concordância medida.
3. Separação treino/teste **por participante** (sem trechos da mesma pessoa nos dois lados).
4. Métricas por classe e por condição (aparelho, ruído de fundo, distância): sensibilidade, especificidade, falsos positivos por hora, erro na estimativa de minutos.
5. Publicar limitações e não anunciar precisão ou generalização sem esses resultados.

Validação clínica (apneia) é outro trabalho: estudo prospectivo com equipe especializada, referência clínica apropriada (ex.: polissonografia), amostra justificada, subgrupos e aprovação ética/regulatória.
