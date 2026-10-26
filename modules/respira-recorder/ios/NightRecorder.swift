import AVFoundation
import Foundation
import QuartzCore
import UIKit

/// Gravador noturno para iOS.
///
/// - AVAudioSession `.record` + modo `.measurement` (reduz processamento automático do sinal).
/// - Requer `UIBackgroundModes: audio` no Info.plist; a gravação começa com o app em primeiro plano
///   e continua com a tela bloqueada enquanto o sistema mantiver a sessão de áudio ativa.
/// - Captura por AVAudioEngine (tap na entrada), converte para mono na taxa configurada e grava
///   segmentos AAC (.m4a) de duração fixa. A rotação é feita por contagem de amostras, sem lacuna
///   entre segmentos consecutivos.
/// - Interrupções (ligação, alarme, Siri), mudança de entrada e reset dos serviços de mídia fecham
///   o segmento atual e são registradas como lacunas no diário. Nada é preenchido com silêncio.
/// - Um segmento .m4a só é finalizado ao fechar; se o processo for encerrado à força, o segmento
///   em curso pode se perder (limitado à duração do segmento). Isso é detectado na recuperação.
final class NightRecorder {
  struct Config {
    let sessionId: String
    let dir: URL
    let sampleRate: Double
    let bitRate: Int
    let segmentSeconds: Double
    let minFreeBytes: Int64
    let maxDurationMs: Double
  }

  typealias Emit = (String, [String: Any?]) -> Void

  static func recordingsRoot() -> URL {
    let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    var root = docs.appendingPathComponent("recordings", isDirectory: true)
    if !FileManager.default.fileExists(atPath: root.path) {
      try? FileManager.default.createDirectory(
        at: root, withIntermediateDirectories: true,
        attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
    }
    // Áudio do quarto não vai para backup do iCloud por padrão.
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try? root.setResourceValues(values)
    return root
  }

  static func freeBytes() -> Int64 {
    let url = URL(fileURLWithPath: NSHomeDirectory())
    if let v = try? url.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey]),
       let cap = v.volumeAvailableCapacityForImportantUsage {
      return cap
    }
    return -1
  }

  static func batteryPercent() -> Int {
    UIDevice.current.isBatteryMonitoringEnabled = true
    let level = UIDevice.current.batteryLevel
    return level < 0 ? -1 : Int((level * 100).rounded())
  }

  private let cfg: Config
  private let emit: Emit
  private let lock = NSLock()
  private var engine = AVAudioEngine()
  private let targetFormat: AVAudioFormat
  private var converter: AVAudioConverter?
  private let journal: JournalWriter
  private var meter: FloatLevelMeter
  private var observers: [NSObjectProtocol] = []

  private var file: AVAudioFile?
  private var segIdx = -1
  private var segStartAt: Double = 0
  private var segFrames: AVAudioFramePosition = 0
  private var segBytesName = ""
  private var totalFrames: Int64 = 0
  private var chainAnchorHost: Double = 0
  private var chainAnchorFrames: Int64 = 0
  private var startHost: Double = 0
  private var lastStatusEmit: Double = 0
  private var converterErrorLogged = false

  private(set) var state = "idle"
  private(set) var capturedMs: Double = 0
  private(set) var startedAtMs: Double = 0
  private(set) var lastDbfs: Float = -120
  var segmentIndex: Int { segIdx }
  var sessionId: String { cfg.sessionId }
  var sessionDir: String { cfg.dir.path }

  init(config: Config, emit: @escaping Emit) throws {
    self.cfg = config
    self.emit = emit
    guard let fmt = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: config.sampleRate, channels: 1, interleaved: false) else {
      throw NSError(domain: "RespiraRecorder", code: 1, userInfo: [NSLocalizedDescriptionKey: "Formato inválido"])
    }
    self.targetFormat = fmt
    try FileManager.default.createDirectory(
      at: config.dir, withIntermediateDirectories: true,
      attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
    self.journal = JournalWriter(url: config.dir.appendingPathComponent("journal.jsonl"))
    self.meter = FloatLevelMeter(sampleRate: Int(config.sampleRate))
  }

  // MARK: - Ciclo de vida

  func start() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.record, mode: .measurement, options: [])
    try session.setActive(true)
    state = "starting"
    startedAtMs = Date().timeIntervalSince1970 * 1000
    startHost = CACurrentMediaTime()
    journal.append("session_start", [
      "sessionId": cfg.sessionId,
      "platform": "ios",
      "osVersion": UIDevice.current.systemVersion,
      "device": UIDevice.current.model,
      "sampleRate": cfg.sampleRate,
      "channels": 1,
      "bitRate": cfg.bitRate,
      "codec": "aac-lc",
      "container": "m4a",
      "segmentSeconds": cfg.segmentSeconds,
      "battery": NightRecorder.batteryPercent(),
      "freeBytes": NightRecorder.freeBytes(),
      "input": currentInputName(),
    ])
    addObservers()
    do {
      try startEngine()
    } catch {
      journal.append("error", ["code": "engine_start_failed", "message": error.localizedDescription])
      finish(reason: "mic_unavailable")
      throw error
    }
    lock.lock(); state = "recording"; lock.unlock()
    emitStatus()
  }

  func stop(reason: String) {
    lock.lock()
    if state == "idle" || state == "stopping" { lock.unlock(); return }
    state = "stopping"
    lock.unlock()
    finish(reason: reason)
  }

  private func finish(reason: String) {
    engine.inputNode.removeTap(onBus: 0)
    engine.stop()
    lock.lock()
    closeSegment()
    lock.unlock()
    removeObservers()
    journal.append("session_stop", ["reason": reason, "battery": NightRecorder.batteryPercent()])
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    lock.lock(); state = "idle"; lock.unlock()
    emit("onStopped", ["sessionId": cfg.sessionId, "reason": reason])
  }

  private func startEngine() throws {
    let input = engine.inputNode
    let inFormat = input.outputFormat(forBus: 0)
    guard inFormat.sampleRate > 0, inFormat.channelCount > 0 else {
      throw NSError(domain: "RespiraRecorder", code: 2, userInfo: [NSLocalizedDescriptionKey: "Nenhuma entrada de áudio disponível"])
    }
    converter = AVAudioConverter(from: inFormat, to: targetFormat)
    input.removeTap(onBus: 0)
    input.installTap(onBus: 0, bufferSize: 4096, format: inFormat) { [weak self] buffer, _ in
      self?.handle(buffer)
    }
    engine.prepare()
    try engine.start()
  }

  // MARK: - Captura

  private func handle(_ buffer: AVAudioPCMBuffer) {
    lock.lock()
    defer { lock.unlock() }
    guard state == "recording", let converter = converter else { return }

    let ratio = targetFormat.sampleRate / buffer.format.sampleRate
    let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 64
    guard let out = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: capacity) else { return }
    var provided = false
    var err: NSError?
    let status = converter.convert(to: out, error: &err) { _, outStatus in
      if provided {
        outStatus.pointee = .noDataNow
        return nil
      }
      provided = true
      outStatus.pointee = .haveData
      return buffer
    }
    if status == .error {
      if !converterErrorLogged {
        converterErrorLogged = true
        journal.append("error", ["code": "convert_failed", "message": err?.localizedDescription ?? ""])
      }
      return
    }
    guard out.frameLength > 0 else { return }

    let sr = targetFormat.sampleRate
    let nowMs = Date().timeIntervalSince1970 * 1000
    let nowHost = CACurrentMediaTime()
    if file == nil {
      let startAt = nowMs - Double(out.frameLength) / sr * 1000
      guard openSegment(startAt: startAt) else { return }
      chainAnchorHost = nowHost - Double(out.frameLength) / sr
      chainAnchorFrames = totalFrames
    }

    meter.add(out)
    lastDbfs = meter.lastSecondDbfs

    let segMax = AVAudioFramePosition(cfg.segmentSeconds * sr)
    var offset: AVAudioFrameCount = 0
    while offset < out.frameLength {
      guard let f = file else { break }
      let room = AVAudioFrameCount(max(segMax - segFrames, 0))
      let n = min(room, out.frameLength - offset)
      if n == 0 { rotate(sr: sr); continue }
      let slice: AVAudioPCMBuffer = (offset == 0 && n == out.frameLength) ? out : copySlice(out, offset: offset, count: n)
      do {
        try f.write(from: slice)
      } catch {
        journal.append("error", ["code": "write_failed", "message": error.localizedDescription])
        DispatchQueue.main.async { [weak self] in self?.stop(reason: "write_failed") }
        return
      }
      segFrames += AVAudioFramePosition(n)
      totalFrames += Int64(n)
      offset += n
      if segFrames >= segMax { rotate(sr: sr) }
    }

    // Deriva: relógio de amostras atrasado em relação ao relógio do sistema = áudio perdido.
    let hostElapsedMs = (nowHost - chainAnchorHost) * 1000
    let sampleElapsedMs = Double(totalFrames - chainAnchorFrames) / sr * 1000
    if hostElapsedMs - sampleElapsedMs > 1500 {
      closeSegment()
      journal.append("capture_drift", ["lostMs": hostElapsedMs - sampleElapsedMs])
      chainAnchorHost = nowHost
      chainAnchorFrames = totalFrames
    }

    if (nowHost - startHost) * 1000 >= cfg.maxDurationMs {
      DispatchQueue.main.async { [weak self] in self?.stop(reason: "max_duration") }
    }
    if nowHost - lastStatusEmit >= 1 {
      lastStatusEmit = nowHost
      let snapshot = statusSnapshotLocked()
      DispatchQueue.main.async { [weak self] in self?.emit("onStatus", snapshot) }
    }
  }

  private func rotate(sr: Double) {
    let nextStart = segStartAt + Double(segFrames) / sr * 1000
    closeSegment()
    if NightRecorder.freeBytes() >= 0 && NightRecorder.freeBytes() < cfg.minFreeBytes {
      journal.append("error", ["code": "low_storage", "message": "Pouco espaço livre"])
      DispatchQueue.main.async { [weak self] in self?.stop(reason: "low_storage") }
      return
    }
    _ = openSegment(startAt: nextStart)
  }

  private func copySlice(_ src: AVAudioPCMBuffer, offset: AVAudioFrameCount, count: AVAudioFrameCount) -> AVAudioPCMBuffer {
    let dst = AVAudioPCMBuffer(pcmFormat: src.format, frameCapacity: count)!
    dst.frameLength = count
    if let s = src.floatChannelData, let d = dst.floatChannelData {
      d[0].update(from: s[0].advanced(by: Int(offset)), count: Int(count))
    }
    return dst
  }

  @discardableResult
  private func openSegment(startAt: Double) -> Bool {
    segIdx += 1
    let name = String(format: "seg_%04d.m4a", segIdx)
    let url = cfg.dir.appendingPathComponent(name)
    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: cfg.sampleRate,
      AVNumberOfChannelsKey: 1,
      AVEncoderBitRateKey: cfg.bitRate,
    ]
    do {
      file = try AVAudioFile(forWriting: url, settings: settings, commonFormat: .pcmFormatFloat32, interleaved: false)
      try? FileManager.default.setAttributes(
        [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.path)
    } catch {
      journal.append("error", ["code": "segment_open_failed", "message": error.localizedDescription])
      file = nil
      return false
    }
    segBytesName = name
    segStartAt = startAt
    segFrames = 0
    journal.append("segment_open", ["idx": segIdx, "file": name, "startAt": startAt])
    return true
  }

  /// Chamar com `lock` adquirido.
  private func closeSegment() {
    guard file != nil else { return }
    file = nil // libera o AVAudioFile, que finaliza o contêiner .m4a
    let sr = targetFormat.sampleRate
    let durationMs = Double(segFrames) / sr * 1000
    let url = cfg.dir.appendingPathComponent(segBytesName)
    let attrs = try? FileManager.default.attributesOfItem(atPath: url.path)
    let bytes = (attrs?[.size] as? NSNumber)?.int64Value ?? 0
    let stats = meter.drain()
    journal.append("segment_close", [
      "idx": segIdx,
      "file": segBytesName,
      "startAt": segStartAt,
      "durationMs": durationMs,
      "bytes": bytes,
      "sampleRate": sr,
      "clippedRatio": stats.clippedRatio,
      "zeroRatio": stats.zeroRatio,
      "levels": stats.levels,
    ])
    capturedMs += durationMs
    let idx = segIdx
    let path = url.path
    DispatchQueue.main.async { [weak self] in
      self?.emit("onSegment", ["idx": idx, "file": path, "durationMs": durationMs])
    }
    segFrames = 0
  }

  // MARK: - Interrupções e rotas

  private func addObservers() {
    let nc = NotificationCenter.default
    let session = AVAudioSession.sharedInstance()
    observers.append(nc.addObserver(forName: AVAudioSession.interruptionNotification, object: session, queue: .main) { [weak self] note in
      self?.onInterruption(note)
    })
    observers.append(nc.addObserver(forName: AVAudioSession.routeChangeNotification, object: session, queue: .main) { [weak self] note in
      guard let self = self else { return }
      let raw = (note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt) ?? 0
      self.journal.append("route_change", ["reasonCode": raw, "input": self.currentInputName()])
    })
    observers.append(nc.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main) { [weak self] _ in
      self?.restartAfter(reason: "input_config_change")
    })
    observers.append(nc.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: session, queue: .main) { [weak self] _ in
      self?.rebuildAfterMediaReset()
    })
  }

  private func removeObservers() {
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    observers.removeAll()
  }

  private func onInterruption(_ note: Notification) {
    guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
    switch type {
    case .began:
      lock.lock()
      guard state == "recording" else { lock.unlock(); return }
      closeSegment()
      state = "interrupted"
      lock.unlock()
      journal.append("interruption_begin", ["reason": "audio_session_interruption"])
      emitStatus()
    case .ended:
      resume(reason: "audio_session_interruption", attempt: 0)
    @unknown default:
      break
    }
  }

  private func resume(reason: String, attempt: Int) {
    lock.lock()
    let current = state
    lock.unlock()
    guard current == "interrupted" else { return }
    do {
      try AVAudioSession.sharedInstance().setActive(true)
      if !engine.isRunning {
        try startEngine()
      }
      lock.lock(); state = "recording"; lock.unlock()
      journal.append("interruption_end", ["reason": reason])
      emitStatus()
    } catch {
      if attempt < 5 {
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
          self?.resume(reason: reason, attempt: attempt + 1)
        }
      } else {
        journal.append("error", ["code": "resume_failed", "message": error.localizedDescription])
        // Mantém a lacuna aberta; a sessão termina quando o usuário encerrar.
      }
    }
  }

  private func restartAfter(reason: String) {
    lock.lock()
    guard state == "recording" || state == "interrupted" else { lock.unlock(); return }
    closeSegment()
    state = "interrupted"
    lock.unlock()
    journal.append("interruption_begin", ["reason": reason])
    resume(reason: reason, attempt: 0)
  }

  private func rebuildAfterMediaReset() {
    lock.lock()
    guard state == "recording" || state == "interrupted" else { lock.unlock(); return }
    closeSegment()
    state = "interrupted"
    lock.unlock()
    journal.append("interruption_begin", ["reason": "media_services_reset"])
    removeObservers()
    engine = AVAudioEngine()
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.record, mode: .measurement, options: [])
    } catch {}
    addObservers()
    resume(reason: "media_services_reset", attempt: 0)
  }

  private func currentInputName() -> String {
    guard let port = AVAudioSession.sharedInstance().currentRoute.inputs.first else { return "none" }
    switch port.portType {
    case .builtInMic: return "builtin_mic"
    case .bluetoothHFP: return "bluetooth"
    case .headsetMic: return "wired_headset"
    case .usbAudio: return "usb"
    default: return port.portType.rawValue
    }
  }

  // MARK: - Estado

  private func statusSnapshotLocked() -> [String: Any?] {
    return [
      "state": state,
      "sessionId": cfg.sessionId,
      "sessionDir": cfg.dir.path,
      "startedAtMs": startedAtMs,
      "capturedMs": capturedMs + Double(segFrames) / targetFormat.sampleRate * 1000,
      "segmentIndex": segIdx,
      "levelDbfs": Double(lastDbfs),
    ]
  }

  func statusSnapshot() -> [String: Any?] {
    lock.lock(); defer { lock.unlock() }
    return statusSnapshotLocked()
  }

  private func emitStatus() {
    emit("onStatus", statusSnapshot())
  }
}

/// Diário append-only (JSON Lines) com sincronização em disco a cada linha.
final class JournalWriter {
  private let url: URL
  private let queue = DispatchQueue(label: "respira.journal")

  init(url: URL) {
    self.url = url
    if !FileManager.default.fileExists(atPath: url.path) {
      FileManager.default.createFile(
        atPath: url.path, contents: nil,
        attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
    }
  }

  func append(_ type: String, _ fields: [String: Any] = [:]) {
    var obj = fields
    obj["t"] = type
    obj["at"] = Date().timeIntervalSince1970 * 1000
    queue.sync {
      guard JSONSerialization.isValidJSONObject(obj),
            let data = try? JSONSerialization.data(withJSONObject: obj, options: []),
            let handle = try? FileHandle(forWritingTo: url) else { return }
      defer { try? handle.close() }
      _ = try? handle.seekToEnd()
      try? handle.write(contentsOf: data + Data([0x0A]))
      try? handle.synchronize()
    }
  }
}

/// Estatísticas por segundo em dBFS (escala digital relativa; não é dB SPL calibrado).
final class FloatLevelMeter {
  private let sampleRate: Int
  private var sumSq: Double = 0
  private var count = 0
  private var levels: [Double] = []
  private var total: Int64 = 0
  private var clipped: Int64 = 0
  private var zeros: Int64 = 0
  private(set) var lastSecondDbfs: Float = -120

  init(sampleRate: Int) { self.sampleRate = sampleRate }

  func add(_ buf: AVAudioPCMBuffer) {
    guard let ch = buf.floatChannelData?[0] else { return }
    let n = Int(buf.frameLength)
    for i in 0..<n {
      let s = Double(ch[i])
      let a = abs(s)
      if a >= 0.999 { clipped += 1 }
      if s == 0 { zeros += 1 }
      sumSq += s * s
      count += 1
      total += 1
      if count >= sampleRate {
        let rms = (sumSq / Double(count)).squareRoot()
        let db = rms <= 0 ? -120 : max(-120, 20 * log10(rms))
        lastSecondDbfs = Float(db)
        levels.append((db * 10).rounded() / 10)
        sumSq = 0
        count = 0
      }
    }
  }

  func drain() -> (levels: [Double], clippedRatio: Double, zeroRatio: Double) {
    let t = Double(max(total, 1))
    let out = (levels, Double(clipped) / t, Double(zeros) / t)
    levels = []
    total = 0; clipped = 0; zeros = 0
    return out
  }
}
