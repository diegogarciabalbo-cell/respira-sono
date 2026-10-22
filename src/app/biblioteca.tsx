import React from 'react';
import { Linking, Pressable } from 'react-native';
import { Card, DemoBanner, H1, H2, P, Screen, Small } from '../ui/components';
import { useTheme } from '../ui/theme';

/**
 * Biblioteca educativa. Os textos abaixo são informativos gerais, escritos pela equipe de produto,
 * e estão marcados como pendentes de revisão clínica.
 */
const ARTICLES: { title: string; body: string[]; refs?: { label: string; url: string }[] }[] = [
  {
    title: 'Ronco e apneia não são a mesma coisa',
    body: [
      'Ronco é o som produzido pela vibração das vias aéreas durante o sono. Muitas pessoas roncam sem ter apneia.',
      'Apneia obstrutiva do sono envolve pausas ou reduções da respiração. O diagnóstico depende de avaliação profissional e de exames adequados, como polissonografia ou teste domiciliar indicado pelo médico.',
      'Uma gravação de áudio no celular não confirma nem exclui apneia. Menos ronco também não significa, por si só, que a apneia foi resolvida.',
    ],
    refs: [{ label: 'AASM (2017) — diretriz de diagnóstico', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5337595/' }],
  },
  {
    title: 'Quando procurar avaliação',
    body: [
      'Vale conversar com um médico se alguém observou pausas na sua respiração, se você acorda engasgado com frequência ou se sente muito sono durante o dia — principalmente ao dirigir.',
      'Em caso de dificuldade intensa para respirar, procure atendimento imediato (SAMU 192).',
    ],
  },
  {
    title: 'Apps e dispositivos de avaliação de risco',
    body: [
      'Sociedades médicas alertam que aplicativos e dispositivos de consumo têm limitações para avaliar apneia e não substituem a avaliação clínica.',
    ],
    refs: [{ label: 'AASM (2025) — alerta sobre apps e dispositivos', url: 'https://aasm.org/wp-content/uploads/2025/04/apps-devices-sleep-apnea-risk-health-advisory.pdf' }],
  },
  {
    title: 'O que diz a pesquisa sobre exercícios orofaríngeos',
    body: [
      'Estudos brasileiros avaliaram exercícios orofaríngeos em adultos com ronco e com apneia, com resultados promissores em grupos pequenos e acompanhamento especializado.',
      'Uma revisão Cochrane (2020) encontrou benefícios possíveis, mas com limitações relevantes na evidência. Os resultados desses estudos não comprovam a eficácia deste aplicativo.',
    ],
    refs: [
      { label: 'Ieto et al. (2015)', url: 'https://pubmed.ncbi.nlm.nih.gov/25950418/' },
      { label: 'Guimarães et al. (2009)', url: 'https://pubmed.ncbi.nlm.nih.gov/19234106/' },
      { label: 'Revisão Cochrane (2020)', url: 'https://www.cochrane.org/evidence/CD013449_myofunctional-therapy-oropharyngeal-mouth-and-throat-exercises-people-obstructive-sleep-apnoea' },
    ],
  },
  {
    title: 'Como gravar bem',
    body: [
      'Deixe o telefone estável na mesa de cabeceira, com o microfone livre, de preferência carregando. Não o coloque sob travesseiros ou cobertores.',
      'Para comparar noites, use o mesmo aparelho e a mesma posição. Ventilador, ar-condicionado, TV e outras pessoas também aparecem na gravação.',
    ],
  },
];

export default function Biblioteca() {
  const t = useTheme();
  return (
    <Screen>
      <H1>Biblioteca</H1>
      <DemoBanner text="Textos informativos provisórios, pendentes de revisão clínica. Não substituem orientação profissional." />
      {ARTICLES.map((a) => (
        <Card key={a.title}>
          <H2>{a.title}</H2>
          {a.body.map((p, i) => <P key={i}>{p}</P>)}
          {a.refs?.map((r) => (
            <Pressable key={r.url} accessibilityRole="link" onPress={() => Linking.openURL(r.url)}>
              <Small color={t.primary}>{r.label}</Small>
            </Pressable>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
