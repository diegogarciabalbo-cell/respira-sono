import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { exportLocalData, recordConsent, saveProfile, wipeLocalData } from '../../db/profile';
import { audit } from '../../db/sessions';
import { ReportedSymptoms } from '../../domain/guidance';
import { RECORDING_PRESETS } from '../../domain/storage';
import { deleteAllRecordings } from '../../services/files';
import { getSupabase } from '../../services/remote';
import { useApp } from '../../state/AppContext';
import { Button, Card, Choice, H1, H2, P, Scale, Screen, Small, Toggle } from '../../ui/components';
import { DICTIONARIES, SUPPORTED_LOCALES } from '../../i18n';
import { useT } from '../../i18n/useT';

export default function Perfil() {
  const { db, prefs, setPrefs, profile, reloadProfile, consents, reloadConsents, flags, bump } = useApp();
  const router = useRouter();
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const cloudAvailable = !!getSupabase() && flags.cloud_sync;
  const sym = profile?.symptoms ?? {};

  async function updateSymptoms(p: Partial<ReportedSymptoms>) {
    if (!db) return;
    await saveProfile(db, { symptoms: { ...sym, ...p } });
    await reloadProfile();
  }

  async function exportData() {
    if (!db) return;
    const data = await exportLocalData(db);
    const f = new File(Paths.cache, `respira-dados-${Date.now()}.json`);
    f.create({ overwrite: true });
    f.write(JSON.stringify(data, null, 2));
    await audit(db, 'data_exported', null);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'application/json' });
  }

  function confirmWipe() {
    Alert.alert(
      'Apagar todos os dados?',
      'Apaga gravações, diário, perfil e consentimentos deste aparelho. Não é possível desfazer.' +
        (getSupabase() ? ' Dados sincronizados na nuvem precisam ser excluídos pela opção de excluir conta.' : ''),
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar tudo', style: 'destructive',
          onPress: async () => {
            if (!db) return;
            setBusy(true);
            await deleteAllRecordings();
            await wipeLocalData(db);
            await reloadProfile();
            await reloadConsents();
            bump();
            setBusy(false);
            router.replace('/onboarding');
          },
        },
      ],
    );
  }

  const yn = [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }];
  const toYN = (b: boolean | null | undefined) => (b === true ? 'sim' : b === false ? 'nao' : null);

  return (
    <Screen>
      <H1>Perfil e privacidade</H1>

      <Card>
        <H2>Sintomas relatados</H2>
        <Small>Usados apenas para sugerir próximos passos.</Small>
        <Choice label="Pausas na respiração observadas?" value={toYN(sym.observedPauses)} options={yn} onChange={(v) => updateSymptoms({ observedPauses: v === 'sim' })} />
        <Choice label="Acorda engasgado com frequência?" value={toYN(sym.recurrentChoking)} options={yn} onChange={(v) => updateSymptoms({ recurrentChoking: v === 'sim' })} />
        <Choice label="Sono ao dirigir?" value={toYN(sym.drowsyDriving)} options={yn} onChange={(v) => updateSymptoms({ drowsyDriving: v === 'sim' })} />
        <Scale label="Sonolência diurna" value={sym.daytimeSleepiness ?? null} onChange={(n) => updateSymptoms({ daytimeSleepiness: n as ReportedSymptoms['daytimeSleepiness'] })} low="Nenhuma" high="Muita" />
      </Card>

      <Card>
        <H2>Aparência</H2>
        <Choice label="Tema" value={prefs.themeMode} onChange={(v) => setPrefs({ themeMode: v })}
          options={[{ value: 'system', label: 'Do sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Escuro' }]} />
        <Choice
          label={t('language.title')}
          value={prefs.language}
          onChange={(v) => setPrefs({ language: v })}
          options={[{ value: 'system' as const, label: t('language.system') }, ...SUPPORTED_LOCALES.map((l) => ({ value: l, label: DICTIONARIES[l]['meta.languageName'] }))]}
        />
        <Choice label="Tamanho do texto" value={String(prefs.fontScale)} onChange={(v) => setPrefs({ fontScale: Number(v) })}
          options={[{ value: '1', label: 'Padrão' }, { value: '1.15', label: 'Grande' }, { value: '1.3', label: 'Muito grande' }]} />
      </Card>

      <Card>
        <H2>Gravação e armazenamento</H2>
        <Choice label="Qualidade" value={prefs.preset} onChange={(v) => setPrefs({ preset: v })}
          options={Object.entries(RECORDING_PRESETS).map(([k, v]) => ({ value: k as keyof typeof RECORDING_PRESETS, label: v.label }))} />
        <Small>{RECORDING_PRESETS[prefs.preset].rationale}</Small>
        <Choice label="Manter o áudio por" value={prefs.retentionDays == null ? 'sempre' : String(prefs.retentionDays)}
          onChange={(v) => setPrefs({ retentionDays: v === 'sempre' ? null : Number(v) })}
          options={[{ value: '7', label: '7 dias' }, { value: '30', label: '30 dias' }, { value: '90', label: '90 dias' }, { value: 'sempre', label: 'Até eu apagar' }]} />
        <Small>Depois do prazo, o áudio é apagado deste aparelho ao abrir o app; o resumo da noite fica no histórico. Noites marcadas para manter não são apagadas.</Small>
        <Button title="Teste de microfone" kind="secondary" onPress={() => router.push('/teste-microfone')} />
      </Card>

      <Card>
        <H2>Consentimentos</H2>
        <Small>Cada autorização é separada e pode ser revogada.</Small>
        <Toggle label="Microfone" hint="Gerenciado pelo sistema. Altere nos ajustes do aparelho." value={!!consents?.microphone} onChange={() => {}} />
        <Toggle
          label="Sincronizar com a nuvem"
          hint={cloudAvailable ? 'Envia diário e resumos. Noites completas de áudio não são enviadas por padrão.' : 'Indisponível nesta versão.'}
          value={!!consents?.cloud_sync}
          onChange={async (v) => { if (db && cloudAvailable) { await recordConsent(db, 'cloud_sync', v); reloadConsents(); } }}
        />
        <Toggle
          label="Participar de pesquisa (opcional)"
          hint="Desligado por padrão. Nenhum dado é usado para treinar modelos sem esta autorização específica."
          value={!!consents?.research}
          onChange={async (v) => { if (db) { await recordConsent(db, 'research', v); reloadConsents(); } }}
        />
        <Small>Sem anúncios e sem rastreadores baseados em saúde. Não transcrevemos conversas nem identificamos pessoas pela voz.</Small>
      </Card>

      <Card>
        <H2>Seus dados</H2>
        <Button title="Exportar meus dados (JSON)" kind="secondary" onPress={exportData} />
        <Small>Exporta perfil, diário, consentimentos e resumos. Os áudios ficam no aparelho e podem ser ouvidos ou apagados no histórico.</Small>
        <Button title="Apagar todos os dados deste aparelho" kind="danger" loading={busy} onPress={confirmWipe} />
      </Card>

      <Card>
        <H2>Demonstração</H2>
        <Toggle label="Mostrar conteúdo de demonstração" hint="Rascunhos não revisados, sempre identificados." value={prefs.demoMode} onChange={(v) => setPrefs({ demoMode: v })} />
        <Button title="Gerenciar conteúdo (simulação)" kind="ghost" onPress={() => router.push('/conteudo')} />
      </Card>

      <Button title="Sobre o app e seus limites" kind="ghost" onPress={() => router.push('/sobre')} />
      <P muted>RESPIRA Sono (nome provisório) · versão de desenvolvimento</P>
    </Screen>
  );
}
