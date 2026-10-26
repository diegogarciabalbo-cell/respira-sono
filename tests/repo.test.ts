/* Garante que o código nativo do gravador está versionado (sem ele o build sai sem gravador). */
import { execSync } from 'child_process';
import { existsSync } from 'fs';

const NATIVE = [
  'modules/respira-recorder/android/build.gradle',
  'modules/respira-recorder/android/src/main/AndroidManifest.xml',
  'modules/respira-recorder/android/src/main/java/expo/modules/respirarecorder/NightRecorderService.kt',
  'modules/respira-recorder/android/src/main/java/expo/modules/respirarecorder/RespiraRecorderModule.kt',
  'modules/respira-recorder/ios/NightRecorder.swift',
  'modules/respira-recorder/ios/RespiraRecorderModule.swift',
  'modules/respira-recorder/ios/RespiraRecorder.podspec',
];

const hasGit = (() => {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

test('arquivos nativos existem', () => {
  for (const f of NATIVE) expect(existsSync(f)).toBe(true);
});

(hasGit ? test : test.skip)('arquivos nativos não são ignorados pelo git', () => {
  for (const f of NATIVE) {
    let ignored = true;
    try {
      execSync(`git check-ignore -q ${f}`, { stdio: 'ignore' });
    } catch {
      ignored = false; // código de saída 1 = não ignorado
    }
    expect({ f, ignored }).toEqual({ f, ignored: false });
  }
});
