# Pacote para revisão clínica dos exercícios

Destinatário: fonoaudiólogo(a) com atuação em sono (motricidade orofacial), com médico do sono quando necessário.
Preparado em 21/10/2026 pela equipe de produto. **Nada aqui foi revisado por profissional de saúde.**

## O que está no app hoje
Seis exercícios em **rascunho** (`src/content/demoExercises.ts`), visíveis só em modo de demonstração e com o aviso "Rascunho baseado em pesquisa publicada, ainda NÃO revisado". Não têm dose, revisor nem contraindicações. O protocolo do estudo aparece como "Como foi feito no estudo", sem virar meta de repetições.

Origem: grupo de terapia de **Ieto V et al. Effects of Oropharyngeal Exercises on Snoring: A Randomized Trial. Chest. 2015;148(3):683-691. doi:10.1378/chest.14-2953** (NCT01636856). 39 adultos com ronco primário ou apneia leve a moderada; 3 meses; comparador: tiras dilatadoras nasais + exercícios respiratórios. O resumo relata redução do índice de ronco medido por polissonografia no grupo de terapia.

**Fonte das descrições: secundária** (MDedge e Healio, 2015). Não tivemos acesso ao texto completo. Precisa conferir no artigo original.

| # | Rascunho no app | Descrição na fonte secundária | Protocolo citado |
|---|---|---|---|
| 1 | Ponta da língua no céu da boca, deslizando para trás | "Push tip of tongue against hard palate and slide tongue backward" | 20× |
| 2 | Língua inteira "grudada" no céu da boca | "Suck entire tongue up against palate" | 20× |
| 3 | Fundo da língua para baixo, ponta nos dentes de baixo | "Force back of tongue against floor of mouth while touching tip of tongue to bottom incisors" | 20× |
| 4 | Elevar o palato mole falando "A" | "Elevation soft palate and uvula while intermittently saying 'A'" | 20× |
| 5 | Dedo dentro da bochecha, empurrando para fora | "Place finger in mouth while pressing buccinator muscle outward" | 10× cada lado |
| 6 | Mastigar e engolir dos dois lados nas refeições | "Chew and deglutinate on both sides of mouth whenever eating", evitando contração perioral | durante as refeições |

**Divergência a resolver:** uma fonte descreve "eight minutes … performed three times a day"; outra, "about 8 minutes" diários.

A reportagem da Agência FAPESP diz que os seis exercícios foram escolhidos de um conjunto maior, usado num estudo de 2009, e que devem ser "prescribed and supervised by a specialist in orofacial motricity", com progressão de repetições e dificuldade. Na apneia grave, o tratamento é outro.

## Catálogo adicional (não incluído no app)
Guimarães KC et al., 2009 (apneia moderada; PubMed 19234106), segundo a tabela de características da revisão Cochrane: palato mole (vogal oral intermitente e contínua), língua (escovar superfícies, deslizar, pressionar contra palato e assoalho), face (pressão labial, sucção, elevação alternada dos cantos da boca), respiração e fala (inspiração nasal forçada e expiração oral com vogais; **inflar balão**), deglutição e mastigação. Treinamento com fonoaudiólogo e sessão supervisionada semanal.

> O briefing do produto proíbe exercícios forçados e apneia voluntária como soluções automáticas. Exercícios como o do balão só entram se o revisor indicar, com cuidados.

## Evidência (para os textos do app)
Revisão Cochrane (2020): 9 ECRs, 347 participantes. Em adultos, a terapia miofuncional comparada com terapia simulada **provavelmente reduz a sonolência diurna** e pode melhorar a qualidade do sono. O efeito sobre a frequência do ronco é muito incerto. Certeza moderada a muito baixa; estudos curtos (2 a 4 meses); poucos participantes; maioria homens; eventos adversos não relatados.

## O que precisamos do revisor
Para cada exercício:
1. Aprovar, reescrever ou retirar o nome e as instruções em linguagem leiga.
2. Público indicado e **contraindicações** (ex.: disfunção temporomandibular dolorosa, cirurgia oral recente, disfagia: avaliar).
3. **Dose**: repetições, séries, tempo, vezes por dia, dias por semana. E progressão por semana.
4. Cuidados e motivos para interromper (hoje há textos genéricos provisórios).
5. Necessidade de vídeo ou animação (original ou licenciada) e roteiro.
6. Referências adicionais.

Para o programa:
7. Duração (o estudo usou 3 meses), frequência e critérios de reavaliação.
8. Triagem antes de começar: quando encaminhar ao médico (apneia grave, sintomas, uso de CPAP).
9. Texto de desconforto e quando parar (o app registra desconforto de 0 a 10 e alerta a partir de 5; o limiar precisa ser validado).

Para o processo:
10. Nome completo, registro profissional (CRFa / CRM + RQE) e documento para verificação da credencial.
11. Termo de responsabilidade técnica pelo conteúdo e contrato de revisão.
12. Autorização explícita **se** o nome do revisor for exibido no app. Os autores dos estudos não são revisores nem parceiros do app.

Depois da revisão, o conteúdo entra no servidor como nova versão (`exercise_versions`): rascunho → em revisão → publicado pelo revisor verificado. O banco impede publicação sem revisor verificado e bloqueia edição de conteúdo publicado.

## Levantamento ampliado
Ver `docs/EVIDENCIA-EXERCICIOS.md` (25/10/2026): revisões sistemáticas de terapia miofuncional, AirwayGym, canto, didgeridoo, treino inspiratório e treino de língua, críticas publicadas e achados sobre adesão.
