# Privacidade e proteção de dados (LGPD)

> Rascunho técnico para orientar a revisão jurídica. Não substitui política de privacidade nem RIPD revisados por profissional. Orientações da ANPD devem ser conferidas na data do lançamento.

## Princípios implementados
- **Local por padrão:** áudio, diário e perfil ficam no aparelho (armazenamento privado do app). Nada é enviado sem consentimento específico de sincronização e sem o módulo ligado no servidor.
- **Noites completas não vão para a nuvem por padrão.** O storage remoto (`session-clips`) existe apenas para trechos que o usuário escolher enviar.
- **Proteção:** iOS — arquivos com `completeUntilFirstUserAuthentication` (compatível com gravação de tela bloqueada) e excluídos do backup do iCloud; Android — armazenamento interno privado e `allowBackup=false`. Chaves de sessão do Supabase no armazenamento seguro (`expo-secure-store`). Comunicação com o servidor via HTTPS.
- **Sem transcrição, sem identificação por voz, sem treino de modelos por padrão**, sem anúncios e sem rastreadores.
- **Consentimentos separados e versionados:** termos, microfone, ciência de outras pessoas no quarto, sincronização, compartilhamento, pesquisa. Revogação registrada.
- **Minimização:** sem medidas corporais nem localização (permissões de localização bloqueadas no manifest Android). Faixa etária em vez de data de nascimento. Sintomas opcionais.
- **Outras pessoas no quarto:** o onboarding exige a confirmação de que o usuário avisará quem dorme no mesmo ambiente.
- **Acesso de terceiros:** profissional só lê o que o paciente concedeu (escopo, prazo, revogável); editor/revisor de conteúdo não tem acesso a dados de usuários (testado). Trilha de auditoria sem áudio, sintomas ou tokens.
- **Direitos do titular:** exportar dados (JSON), apagar uma noite, apagar só o áudio, apagar tudo do aparelho; exclusão de conta remove dados do servidor em cascata.

## Tratamentos, finalidade e base legal (proposta para revisão)

| Tratamento | Dados | Finalidade | Base legal candidata (LGPD) | Observação |
|---|---|---|---|---|
| Gravação e análise local | Áudio do quarto (pode conter voz de terceiros) | Registrar a noite para o próprio usuário | Dado pessoal sensível (saúde): consentimento específico e destacado (art. 11, I) | Confirmar enquadramento do áudio como dado de saúde |
| Diário e sintomas | Autorrelato de saúde | Organizar informações e próximos passos | Art. 11, I | |
| Sincronização | Resumos, diário, metadados | Backup e acesso multi-aparelho | Art. 11, I (consentimento específico `cloud_sync`) | Operador: Supabase — contrato e transferência internacional a avaliar |
| Compartilhamento com profissional | Escopo escolhido | Acompanhamento profissional | Art. 11, I (consentimento `sharing`) | |
| Pesquisa | Trechos anotados | Validação acústica | Consentimento específico; avaliar art. 11, II, c (órgão de pesquisa) e aprovação ética | Desligado por padrão |
| Auditoria e segurança | IDs, ações, horários | Segurança e prestação de contas | Avaliar legítimo interesse/obrigação legal (dado não sensível) | Sem conteúdo de saúde |

Um aceite genérico **não** cobre todos esses usos.

## Retenção e exclusão (verificável)
- **Aparelho:** áudio apagado após o prazo escolhido (7/30/90 dias ou até o usuário apagar) ao abrir o app; resumo mantido até exclusão. "Apagar tudo" remove banco e arquivos imediatamente.
- **Servidor:** exclusão de conta apaga dados em cascata no banco principal. **Backups do provedor podem reter cópias até o fim da janela de retenção de backup do plano contratado**; o prazo exato deve ser confirmado com o provedor e informado ao usuário (`deletion_requests.backup_purge_expected_by`). Não prometemos exclusão instantânea de backups.

## Pendências
RIPD, política de privacidade e termos em linguagem simples, contrato com operadores, avaliação de transferência internacional, encarregado (DPO), procedimento de incidentes, revisão das orientações vigentes da ANPD.
