import * as SQLite from 'expo-sqlite';
import { DbLike, migrate } from '../db/schema';
import { RespiraRecorder } from '../native/recorder';

let dbPromise: Promise<DbLike> | null = null;

/**
 * Banco local no armazenamento privado do app. No iOS, o arquivo herda a proteção
 * padrão do app; gravações usam "completeUntilFirstUserAuthentication" para que
 * a escrita continue com a tela bloqueada.
 */
export function getDb(): Promise<DbLike> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('respira.db');
      await db.execAsync('PRAGMA journal_mode = WAL;');
      // Diário e sintomas são dados de saúde: fora do backup do iCloud (Apple 5.1.3(ii)).
      try {
        if (RespiraRecorder && typeof SQLite.defaultDatabaseDirectory === 'string') {
          RespiraRecorder.excludeFromBackup(SQLite.defaultDatabaseDirectory);
        }
      } catch {
        // Sem o módulo nativo (Expo Go/web) não há o que fazer.
      }
      const adapter: DbLike = {
        execAsync: (sql) => db.execAsync(sql),
        runAsync: (sql, ...params) => db.runAsync(sql, ...(params as SQLite.SQLiteBindValue[])),
        getAllAsync: (sql, ...params) => db.getAllAsync(sql, ...(params as SQLite.SQLiteBindValue[])),
        getFirstAsync: (sql, ...params) => db.getFirstAsync(sql, ...(params as SQLite.SQLiteBindValue[])),
        withTransactionAsync: (fn) => db.withTransactionAsync(fn),
      };
      await migrate(adapter);
      return adapter;
    })();
  }
  return dbPromise;
}
