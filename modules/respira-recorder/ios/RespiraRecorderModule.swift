import AVFoundation
import ExpoModulesCore
import UIKit

public class RespiraRecorderModule: Module {
  private var recorder: NightRecorder?

  public func definition() -> ModuleDefinition {
    Name("RespiraRecorder")

    Events("onStatus", "onSegment", "onStopped", "onError")

    Constant("platformContainer") { "m4a" }
    Constant("fileExtension") { "m4a" }

    Function("getRecordingsRoot") { () -> String in
      NightRecorder.recordingsRoot().path
    }

    Function("getStatus") { () -> [String: Any?] in
      if let r = self.recorder, r.state != "idle" {
        return r.statusSnapshot()
      }
      return ["state": "idle", "sessionId": nil, "sessionDir": nil, "startedAtMs": 0, "capturedMs": 0, "segmentIndex": -1, "levelDbfs": -120]
    }

    Function("getFreeDiskBytes") { () -> Double in
      Double(NightRecorder.freeBytes())
    }

    Function("getBatteryPercent") { () -> Int in
      NightRecorder.batteryPercent()
    }

    // App Store Review Guideline 5.1.3(ii): não guardar informação pessoal de saúde no iCloud.
    // Exclui a pasta (ex.: banco SQLite com diário e sintomas) do backup e aplica proteção de arquivo.
    Function("excludeFromBackup") { (path: String) -> Bool in
      var url = URL(fileURLWithPath: path.replacingOccurrences(of: "file://", with: ""))
      guard FileManager.default.fileExists(atPath: url.path) else { return false }
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      do {
        try url.setResourceValues(values)
        try? FileManager.default.setAttributes(
          [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.path)
        return true
      } catch {
        return false
      }
    }

    // Conceito específico do Android; no iOS não há otimização equivalente a configurar.
    Function("isIgnoringBatteryOptimizations") { () -> Bool in true }
    AsyncFunction("openBatteryOptimizationSettings") {}

    AsyncFunction("start") { (sessionId: String, options: [String: Any]) throws -> String in
      if AVAudioSession.sharedInstance().recordPermission != .granted {
        throw Exception(name: "permission_denied", description: "Permissão de microfone não concedida", code: "permission_denied")
      }
      if let r = self.recorder, r.state != "idle" {
        throw Exception(name: "already_recording", description: "Já existe uma gravação em andamento", code: "already_recording")
      }
      guard sessionId.range(of: "^[A-Za-z0-9_-]{6,64}$", options: .regularExpression) != nil else {
        throw Exception(name: "invalid_session_id", description: "Identificador de sessão inválido", code: "invalid_session_id")
      }
      let dir = NightRecorder.recordingsRoot().appendingPathComponent(sessionId, isDirectory: true)
      let cfg = NightRecorder.Config(
        sessionId: sessionId,
        dir: dir,
        sampleRate: (options["sampleRate"] as? NSNumber)?.doubleValue ?? 16000,
        bitRate: (options["bitRate"] as? NSNumber)?.intValue ?? 32000,
        segmentSeconds: (options["segmentSeconds"] as? NSNumber)?.doubleValue ?? 300,
        minFreeBytes: (options["minFreeBytes"] as? NSNumber)?.int64Value ?? 150 * 1024 * 1024,
        maxDurationMs: (options["maxDurationMs"] as? NSNumber)?.doubleValue ?? 12 * 3600 * 1000
      )
      let r = try NightRecorder(config: cfg) { [weak self] name, body in
        self?.sendEvent(name, body)
      }
      self.recorder = r
      do {
        try r.start()
      } catch {
        throw Exception(name: "start_failed", description: "Não foi possível iniciar a gravação: \(error.localizedDescription)", code: "start_failed")
      }
      return dir.path
    }.runOnQueue(.main)

    AsyncFunction("stop") { (reason: String?) -> Bool in
      guard let r = self.recorder, r.state != "idle" else { return false }
      r.stop(reason: reason ?? "user")
      return true
    }.runOnQueue(.main)

    AsyncFunction("probeSegment") { (path: String) -> [String: Any] in
      let url = URL(fileURLWithPath: path)
      do {
        let f = try AVAudioFile(forReading: url)
        let ms = Double(f.length) / f.fileFormat.sampleRate * 1000
        let size = ((try? FileManager.default.attributesOfItem(atPath: path))?[.size] as? NSNumber)?.doubleValue ?? 0
        return ["ok": ms > 0, "durationMs": ms, "validBytes": size]
      } catch {
        // Segmento .m4a não finalizado (encerramento forçado): não é reproduzível.
        return ["ok": false, "durationMs": 0, "validBytes": 0]
      }
    }
  }
}
