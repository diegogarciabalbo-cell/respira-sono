# Roteiro do teste noturno em aparelhos físicos

**Status: PENDENTE.** Nenhum dos casos abaixo foi executado. Emuladores e testes acelerados não comprovam o requisito de gravação noturna.

## Aparelhos mínimos
- Android 14 ou 15 de fabricante com economia de bateria agressiva (ex.: Samsung, Xiaomi, Motorola).
- Android 10–13 (outra marca).
- iPhone com iOS 17 ou 18 (e, se possível, um com iOS 16.4).

## Preparação (para cada aparelho)
1. Instalar o development build (README).
2. Anotar: modelo, versão do SO, versão do app, preset de qualidade, bateria inicial, espaço livre, carregando ou não.
3. Concluir onboarding e o Teste de microfone; ouvir o resultado.

## Caso 1 — Noite completa (principal)
1. Às ~23 h, telefone na mesa de cabeceira, "Começar a gravar", bloquear a tela.
2. Não abrir o app durante a noite.
3. Às ~07–09 h (8–10 h depois), abrir e "Encerrar gravação".
4. Registrar no resumo: duração da sessão, áudio capturado, cobertura, nº e motivos das lacunas, bateria início→fim, tamanho em disco (Ajustes do sistema → Apps → RESPIRA Sono → Armazenamento).
5. Ouvir 5 trechos (início, 2 h, 4 h, 6 h, final) e conferir se são reproduzíveis e coerentes com o horário.

**Critérios de aceite propostos:** cobertura ≥ 99% sem interrupções externas; nenhuma lacuna sem motivo registrado; todos os segmentos reproduzíveis; armazenamento dentro de ±20% da estimativa (~15 MB/h no padrão); consumo de bateria registrado (sem meta fixada antes da medição).

## Casos de robustez (sessões curtas de 20–30 min)
| # | Ação durante a gravação | Esperado |
|---|---|---|
| 2 | Bloquear/desbloquear a tela várias vezes | Sem lacunas |
| 3 | Receber e atender uma ligação | Lacuna "silenciado pelo sistema"/"interrupção" durante a ligação; retomada depois |
| 4 | Alarme do relógio toca | Lacuna (se o sistema interromper) com motivo; retomada |
| 5 | Conectar e desconectar fone Bluetooth | Evento de mudança de rota; no iOS, lacuna curta por reconfiguração |
| 6 | Encher o armazenamento até < 150 MB livres | Parada segura "pouco espaço", áudio anterior preservado |
| 7 | Revogar a permissão de microfone nos ajustes | Sessão encerrada; ao reabrir, mostra o que foi salvo |
| 8 | Ativar modo de economia de bateria | Registrar se o sistema encerra o app (fabricante) |
| 9 | Forçar encerramento do app (deslizar nos recentes / "Forçar parada") | Ao reabrir: aviso "gravação interrompida"; trechos salvos disponíveis; período posterior como lacuna "App encerrado"; Android perde ≤ ~5 s, iOS ≤ segmento em curso |
| 10 | Reiniciar o telefone durante a gravação | Igual ao caso 9 |
| 11 | Iniciar gravação, ir para outro app por 1 h | Gravação continua |
| 12 | Notificação "Encerrar" (Android) | Sessão encerrada normalmente |

## Planilha de resultados (preencher)

| Data | Aparelho / SO | Caso | Duração | Capturado | Cobertura | Lacunas (motivos) | Bateria | MB/h | Reprodução OK | Observações |
|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | |

Registre falhas como falhas. Não marque o requisito como atendido sem pelo menos 3 noites completas por plataforma.
