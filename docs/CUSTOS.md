# Estimativa de custos e hipótese comercial

> **Estimativas, não cotações.** Os valores de referência abaixo vêm de conhecimento geral sobre planos públicos até meados de 2026 e **não foram pesquisados nem confirmados** nesta entrega. Confirme preços, câmbio e impostos antes de qualquer decisão.

## Premissas
- Áudio fica no aparelho; **nenhuma noite completa vai para o servidor**. Sincronização (opcional) envia apenas resumos, diário e metadados: ~50 KB por usuário por noite.
- Trechos de áudio compartilhados por escolha do usuário: ~5 trechos de 30 s por mês (16 kHz, 32 kbps ≈ 120 KB cada) ≈ 0,6 MB/usuário/mês.
- 25 noites sincronizadas por usuário ativo por mês; banco ≈ 1,5 MB/usuário/ano.
- Análise acústica feita no aparelho (custo de servidor zero).
- Sem LLM/chatbot.
- Câmbio ilustrativo: **US$ 1 = R$ 5,50** (ajuste).

## Custos de infraestrutura (mensais)

| Item | 10 ativos | 100 ativos | 1.000 ativos | Observação |
|---|---|---|---|---|
| Supabase (banco, auth, storage) | plano gratuito provavelmente suficiente para teste | plano pago de entrada (referência ~US$ 25) | plano pago de entrada + eventuais excedentes (referência ~US$ 25–60) | Plano gratuito pode pausar projetos inativos e tem limites; para dados de saúde, avaliar plano com backups, região e contrato adequados |
| Storage de trechos | ~6 MB | ~60 MB | ~600 MB | Irrelevante perto das franquias |
| Builds (EAS) | gratuito (fila) ou builds locais | gratuito/plano de entrada | plano de entrada (referência ~US$ 19–99) | Opcional |
| **Total infra (ordem de grandeza)** | **≈ R$ 0** | **≈ R$ 140–250** | **≈ R$ 250–900** | |

## Custos fixos e de produto (não dependem do nº de usuários)
- Conta Apple Developer (referência US$ 99/ano) e Google Play (referência US$ 25 uma vez).
- **Maiores custos reais:** revisão clínica de conteúdo (fonoaudiólogo e médico do sono), análise regulatória, revisão jurídica/LGPD, produção de vídeos/animações licenciados, validação acústica (coleta e anotação), suporte ao usuário. Esses itens devem ser orçados com os profissionais; não estimamos valores aqui.

## Hipótese de modelo comercial (a testar; cobrança não implementada)
- **Gratuito para sempre:** gravação, reprodução, informações de segurança, orientação de próximos passos, exportação básica e exclusão de dados.
- **Assinatura de acompanhamento (hipótese):** histórico longo e comparações entre noites, programa de exercícios revisado com lembretes e progressão do protocolo, relatórios detalhados para consulta, compartilhamento remoto com profissional.
- **B2B2C (hipótese):** licenças para clínicas/fonoaudiólogos acompanharem pacientes que consentirem.
- **Regras:** sem anúncios, sem venda de dados, sem uso de medo de doença na comunicação; segurança e exclusão nunca atrás de pagamento.
- Validar disposição a pagar com entrevistas e testes antes de construir cobrança.
