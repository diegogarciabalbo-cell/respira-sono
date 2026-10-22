import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { RecorderStatus, RespiraRecorder } from '../native/recorder';
import { ConsentKind, currentConsents, getPref, getProfile, Profile, setPref } from '../db/profile';
import { DbLike } from '../db/schema';
import { deleteSessionAudio, listSessions, reconcileSession, recoverStaleSessions } from '../db/sessions';
import { ModuleFlag, resolveFlags } from '../domain/flags';
import { QualityPreset, sessionsToPurge } from '../domain/storage';
import { getDb } from '../services/database';
import type { AppLocale } from '../i18n';
import { sessionFiles } from '../services/files';
import { activeSessionId } from '../services/recorder';
import { APP_ENV, fetchServerFlags } from '../services/remote';

export interface Prefs {
  themeMode: 'system' | 'light' | 'dark';
  fontScale: number;
  preset: QualityPreset;
  /** dias para manter o áudio; null = até o usuário apagar */
  retentionDays: number | null;
  demoMode: boolean;
  micTested: boolean;
  phonePosition: string | null;
  language: AppLocale | 'system';
}

const DEFAULT_PREFS: Prefs = {
  themeMode: 'system',
  fontScale: 1,
  preset: 'padrao',
  retentionDays: 30,
  demoMode: true,
  micTested: false,
  phonePosition: 'mesa_cabeceira',
  language: 'system',
};

interface Ctx {
  ready: boolean;
  db: DbLike | null;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => Promise<void>;
  profile: Profile | null;
  reloadProfile: () => Promise<void>;
  consents: Record<ConsentKind, boolean> | null;
  reloadConsents: () => Promise<void>;
  flags: Record<ModuleFlag, boolean>;
  recorder: RecorderStatus | null;
  recoveredIds: string[];
  dismissRecovered: () => void;
  dataVersion: number;
  bump: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DbLike | null>(null);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [consents, setConsents] = useState<Record<ConsentKind, boolean> | null>(null);
  const [serverFlags, setServerFlags] = useState<Partial<Record<ModuleFlag, boolean>> | null>(null);
  const [recorder, setRecorder] = useState<RecorderStatus | null>(RespiraRecorder ? RespiraRecorder.getStatus() : null);
  const [recoveredIds, setRecovered] = useState<string[]>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const dbRef = useRef<DbLike | null>(null);

  const bump = useCallback(() => setDataVersion((v) => v + 1), []);

  const recover = useCallback(async (d: DbLike) => {
    const ids = await recoverStaleSessions(d, sessionFiles, activeSessionId());
    if (ids.length) setRecovered((prev) => [...new Set([...prev, ...ids])]);
    return ids;
  }, []);

  useEffect(() => {
    (async () => {
      const d = await getDb();
      dbRef.current = d;
      const loaded: Prefs = { ...DEFAULT_PREFS, ...(await getPref<Partial<Prefs>>(d, 'prefs', {})) };
      setPrefsState(loaded);
      setProfile(await getProfile(d));
      setConsents(await currentConsents(d));
      await recover(d);
      // Retenção: apaga apenas o áudio de noites antigas (o resumo permanece até o usuário excluir).
      const all = await listSessions(d);
      const purge = sessionsToPurge(
        all.filter((s) => !s.audio_deleted_at && s.status !== 'recording').map((s) => ({ id: s.id, startedAt: s.started_at, endedAt: s.ended_at, keep: !!s.keep })),
        loaded.retentionDays,
        Date.now(),
      );
      for (const id of purge) await deleteSessionAudio(d, sessionFiles, id);
      setDb(d);
      setReady(true);
      setServerFlags(await fetchServerFlags());
    })();
  }, [recover]);

  useEffect(() => {
    if (!RespiraRecorder) return;
    const subs = [
      RespiraRecorder.addListener('onStatus', (s) => setRecorder(s)),
      RespiraRecorder.addListener('onStopped', async (e) => {
        setRecorder(RespiraRecorder!.getStatus());
        const d = dbRef.current;
        if (d && e.sessionId) {
          await reconcileSession(d, sessionFiles, e.sessionId, { isActive: false });
          bump();
        }
      }),
    ];
    const appSub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        setRecorder(RespiraRecorder!.getStatus());
        if (dbRef.current) recover(dbRef.current).then((ids) => ids.length && bump());
      }
    });
    return () => {
      subs.forEach((s) => s.remove());
      appSub.remove();
    };
  }, [bump, recover]);

  const setPrefs = useCallback(async (p: Partial<Prefs>) => {
    setPrefsState((cur) => {
      const next = { ...cur, ...p };
      if (dbRef.current) setPref(dbRef.current, 'prefs', next);
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      db,
      prefs,
      setPrefs,
      profile,
      reloadProfile: async () => { if (dbRef.current) setProfile(await getProfile(dbRef.current)); },
      consents,
      reloadConsents: async () => { if (dbRef.current) setConsents(await currentConsents(dbRef.current)); },
      flags: resolveFlags({ env: APP_ENV, server: serverFlags }),
      recorder,
      recoveredIds,
      dismissRecovered: () => setRecovered([]),
      dataVersion,
      bump,
    }),
    [ready, db, prefs, setPrefs, profile, consents, serverFlags, recorder, recoveredIds, dataVersion, bump],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp fora do AppProvider');
  return c;
}
