package expo.modules.respirarecorder

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioRecordingConfiguration
import android.media.AudioRouting
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaRecorder
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.Process
import android.os.StatFs
import android.os.SystemClock
import java.io.File
import java.util.Locale

/**
 * Serviço em primeiro plano do tipo "microphone".
 *
 * - Precisa ser iniciado com o app visível (toque do usuário). Android 14+ lança SecurityException
 *   se um FGS de microfone for criado a partir do segundo plano.
 * - Captura PCM 16-bit mono por AudioRecord numa thread nativa (sem temporizadores JS),
 *   codifica AAC-LC via MediaCodec e grava segmentos ADTS de duração fixa, sem lacuna entre
 *   segmentos consecutivos (rotação feita no fluxo de quadros codificados).
 * - Toda lacuna (silenciamento pelo sistema, deriva de captura, falha) é registrada no diário;
 *   o tempo ausente nunca é preenchido com silêncio.
 * - START_NOT_STICKY: se o sistema ou o usuário encerrar o processo, não reiniciamos sozinhos.
 */
class NightRecorderService : Service() {

  companion object {
    const val ACTION_START = "app.respirasono.recorder.START"
    const val ACTION_STOP = "app.respirasono.recorder.STOP"
    const val EXTRA_SESSION_ID = "sessionId"
    const val EXTRA_SESSION_DIR = "sessionDir"
    const val EXTRA_SAMPLE_RATE = "sampleRate"
    const val EXTRA_BIT_RATE = "bitRate"
    const val EXTRA_SEGMENT_SECONDS = "segmentSeconds"
    const val EXTRA_MIN_FREE_BYTES = "minFreeBytes"
    const val EXTRA_MAX_DURATION_MS = "maxDurationMs"
    const val EXTRA_STOP_REASON = "stopReason"
    private const val CHANNEL_ID = "respira_night_recording"
    private const val NOTIFICATION_ID = 4107
    private const val DRIFT_TOLERANCE_MS = 1500L

    @Volatile var instance: NightRecorderService? = null
  }

  @Volatile private var running = false
  @Volatile private var silenced = false
  @Volatile private var stopReason = "user"
  private var worker: Thread? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private val mainHandler = Handler(Looper.getMainLooper())
  private var recordingCallback: AudioManager.AudioRecordingCallback? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        requestStop(intent.getStringExtra(EXTRA_STOP_REASON) ?: "user_notification")
        return START_NOT_STICKY
      }
      ACTION_START -> {
        if (running) return START_NOT_STICKY
        val sessionId = intent.getStringExtra(EXTRA_SESSION_ID) ?: return START_NOT_STICKY
        val sessionDir = intent.getStringExtra(EXTRA_SESSION_DIR) ?: return START_NOT_STICKY
        try {
          val notification = buildNotification()
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
          } else {
            startForeground(NOTIFICATION_ID, notification)
          }
        } catch (e: Exception) {
          // Inclui ForegroundServiceStartNotAllowedException / SecurityException (início em segundo plano).
          RecorderBus.state = "idle"
          RecorderBus.emitError("fgs_start_failed", e.javaClass.simpleName + ": " + (e.message ?: ""))
          stopSelf()
          return START_NOT_STICKY
        }
        instance = this
        running = true
        stopReason = "user"
        val cfg = CaptureConfig(
          sessionId = sessionId,
          dir = File(sessionDir),
          sampleRate = intent.getIntExtra(EXTRA_SAMPLE_RATE, 16000),
          bitRate = intent.getIntExtra(EXTRA_BIT_RATE, 32000),
          segmentMs = intent.getIntExtra(EXTRA_SEGMENT_SECONDS, 300) * 1000L,
          minFreeBytes = intent.getLongExtra(EXTRA_MIN_FREE_BYTES, 150L * 1024 * 1024),
          maxDurationMs = intent.getLongExtra(EXTRA_MAX_DURATION_MS, 12L * 3600 * 1000)
        )
        worker = Thread({ captureLoop(cfg) }, "RespiraCapture").also { it.start() }
      }
    }
    return START_NOT_STICKY
  }

  fun requestStop(reason: String) {
    stopReason = reason
    running = false
    RecorderBus.state = "stopping"
  }

  override fun onDestroy() {
    running = false
    instance = null
    super.onDestroy()
  }

  private data class CaptureConfig(
    val sessionId: String,
    val dir: File,
    val sampleRate: Int,
    val bitRate: Int,
    val segmentMs: Long,
    val minFreeBytes: Long,
    val maxDurationMs: Long
  )

  // ---------------------------------------------------------------------------------------------

  @SuppressLint("MissingPermission")
  private fun createAudioRecord(preferredRate: Int): Pair<AudioRecord, Int>? {
    val rates = linkedSetOf(preferredRate, 16000, 44100, 48000)
    val sources = intArrayOf(MediaRecorder.AudioSource.VOICE_RECOGNITION, MediaRecorder.AudioSource.MIC)
    for (source in sources) {
      for (rate in rates) {
        val min = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        if (min <= 0) continue
        val size = maxOf(min * 4, rate * 2) // >= 1 s de folga no buffer do sistema
        try {
          val rec = AudioRecord(source, rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size)
          if (rec.state == AudioRecord.STATE_INITIALIZED) return Pair(rec, rate)
          rec.release()
        } catch (_: Exception) {}
      }
    }
    return null
  }

  private fun createEncoder(rate: Int, bitRate: Int): MediaCodec {
    val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, rate, 1)
    format.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
    format.setInteger(MediaFormat.KEY_BIT_RATE, bitRate)
    format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16 * 1024)
    val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    codec.start()
    return codec
  }

  private fun captureLoop(cfg: CaptureConfig) {
    Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
    cfg.dir.mkdirs()
    val journal = Journal(File(cfg.dir, "journal.jsonl"))
    RecorderBus.sessionId = cfg.sessionId
    RecorderBus.sessionDir = cfg.dir.absolutePath
    RecorderBus.capturedMs = 0
    RecorderBus.segmentIndex = -1
    RecorderBus.startedAtMs = System.currentTimeMillis()

    val created = createAudioRecord(cfg.sampleRate)
    if (created == null) {
      journal.append("error", mapOf("code" to "mic_unavailable", "message" to "AudioRecord não inicializou"))
      finish(journal, "mic_unavailable", null, null)
      return
    }
    val (record, rate) = created
    val codec: MediaCodec = try {
      createEncoder(rate, cfg.bitRate)
    } catch (e: Exception) {
      journal.append("error", mapOf("code" to "encoder_unavailable", "message" to (e.message ?: "")))
      record.release()
      finish(journal, "encoder_unavailable", null, null)
      return
    }

    journal.append(
      "session_start",
      mapOf(
        "sessionId" to cfg.sessionId,
        "platform" to "android",
        "osVersion" to Build.VERSION.SDK_INT,
        "device" to (Build.MANUFACTURER + " " + Build.MODEL),
        "sampleRate" to rate,
        "channels" to 1,
        "bitRate" to cfg.bitRate,
        "codec" to "aac-lc",
        "container" to "adts",
        "audioSource" to record.audioSource,
        "segmentSeconds" to cfg.segmentMs / 1000,
        "battery" to batteryPercent(),
        "freeBytes" to freeBytes(cfg.dir)
      )
    )

    registerCallbacks(record, journal)
    acquireWakeLock(cfg.maxDurationMs + 10 * 60 * 1000)

    try {
      record.startRecording()
    } catch (e: Exception) {
      journal.append("error", mapOf("code" to "start_recording_failed", "message" to (e.message ?: "")))
    }
    if (record.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
      journal.append("error", mapOf("code" to "mic_busy", "message" to "Microfone indisponível ou em uso"))
      finish(journal, "mic_busy", record, codec)
      return
    }

    RecorderBus.state = "recording"
    emitState()

    val pcm = ShortArray(rate / 10) // leituras de 100 ms
    val pcmBytes = java.nio.ByteBuffer.allocateDirect(pcm.size * 2).order(java.nio.ByteOrder.nativeOrder())
    val info = MediaCodec.BufferInfo()
    val meter = LevelMeter(rate)
    var writer: AdtsWriter? = null
    var segIdx = -1
    var segStartAt = 0L
    var samplesFed = 0L
    var chainAnchorElapsed = 0L // relógio monotônico no início da cadeia contínua atual
    var chainAnchorSamples = 0L
    var wasSilenced = false
    var lastStatusEmit = 0L
    val sessionStartElapsed = SystemClock.elapsedRealtime()
    var outBytes = ByteArray(4096)

    fun openSegment(startAt: Long) {
      segIdx += 1
      val f = File(cfg.dir, String.format(Locale.US, "seg_%04d.aac", segIdx))
      writer = AdtsWriter(f, rate, 1)
      segStartAt = startAt
      RecorderBus.segmentIndex = segIdx
      journal.append("segment_open", mapOf("idx" to segIdx, "file" to f.name, "startAt" to startAt))
    }

    fun closeSegment() {
      val w = writer ?: return
      w.close()
      val total = meter.totalSamples.coerceAtLeast(1)
      val levels = meter.drainSeconds()
      journal.append(
        "segment_close",
        mapOf(
          "idx" to segIdx,
          "file" to w.file.name,
          "startAt" to segStartAt,
          "durationMs" to w.durationMs,
          "bytes" to w.bytesWritten,
          "sampleRate" to rate,
          "clippedRatio" to meter.clippedSamples.toDouble() / total,
          "zeroRatio" to meter.zeroSamples.toDouble() / total,
          "levels" to levels
        )
      )
      meter.resetCounters()
      RecorderBus.capturedMs += w.durationMs
      val b = Bundle()
      b.putInt("idx", segIdx)
      b.putString("file", w.file.absolutePath)
      b.putDouble("durationMs", w.durationMs.toDouble())
      RecorderBus.emit("onSegment", b)
      writer = null
    }

    fun drainEncoder(endOfStream: Boolean) {
      var waits = 0
      while (true) {
        val outIdx = codec.dequeueOutputBuffer(info, if (endOfStream) 10_000 else 0)
        if (outIdx == MediaCodec.INFO_TRY_AGAIN_LATER) {
          if (!endOfStream || ++waits > 200) return // no máximo ~2 s aguardando o fim do fluxo
          continue
        }
        if (outIdx < 0) continue // mudança de formato/buffers
        val isConfig = (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0
        if (!isConfig && info.size > 0) {
          val buf = codec.getOutputBuffer(outIdx)
          if (buf != null) {
            if (outBytes.size < info.size) outBytes = ByteArray(info.size)
            buf.position(info.offset)
            buf.get(outBytes, 0, info.size)
            val w = writer
            if (w != null) {
              w.writeFrame(outBytes, 0, info.size)
              if (w.durationMs >= cfg.segmentMs) {
                // Rotação contínua: o próximo segmento começa onde este termina (relógio de amostras).
                val nextStart = segStartAt + w.durationMs
                closeSegment()
                if (freeBytes(cfg.dir) < cfg.minFreeBytes) {
                  journal.append("error", mapOf("code" to "low_storage", "message" to "Pouco espaço livre"))
                  requestStop("low_storage")
                } else {
                  openSegment(nextStart)
                }
              }
            }
          }
        }
        val eos = (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
        codec.releaseOutputBuffer(outIdx, false)
        if (eos) return
      }
    }

    fun feed(n: Int, eos: Boolean) {
      var offset = 0
      val totalBytes = n * 2
      if (n > 0) {
        pcmBytes.clear()
        pcmBytes.asShortBuffer().put(pcm, 0, n)
        pcmBytes.limit(totalBytes)
      }
      var attempts = 0
      var queuedAny = false
      // Laço "while" (não do-while): garante que a marca de fim de fluxo seja enfileirada
      // mesmo quando não há buffer livre na primeira tentativa.
      while (!queuedAny || offset < totalBytes) {
        val inIdx = codec.dequeueInputBuffer(10_000)
        if (inIdx < 0) {
          drainEncoder(false)
          if (++attempts > 300) throw IllegalStateException("Codificador sem buffers de entrada")
          continue
        }
        val inBuf = codec.getInputBuffer(inIdx) ?: continue
        inBuf.clear()
        val chunk = minOf(inBuf.remaining(), totalBytes - offset)
        if (chunk > 0) {
          pcmBytes.limit(offset + chunk)
          pcmBytes.position(offset)
          inBuf.put(pcmBytes)
        }
        val pts = samplesFed * 1_000_000L / rate
        samplesFed += chunk / 2
        offset += chunk
        val flags = if (eos && offset >= totalBytes) MediaCodec.BUFFER_FLAG_END_OF_STREAM else 0
        codec.queueInputBuffer(inIdx, 0, chunk, pts, flags)
        queuedAny = true
        drainEncoder(false)
      }
    }

    try {
      while (running) {
        val n = record.read(pcm, 0, pcm.size)
        if (n < 0) {
          journal.append("error", mapOf("code" to "read_error", "message" to "AudioRecord.read=$n"))
          stopReason = if (n == AudioRecord.ERROR_DEAD_OBJECT) "mic_lost" else "capture_error"
          break
        }
        if (n == 0) continue
        val nowWall = System.currentTimeMillis()
        val nowElapsed = SystemClock.elapsedRealtime()

        if (nowElapsed - sessionStartElapsed >= cfg.maxDurationMs) {
          stopReason = "max_duration"
          break
        }

        if (silenced) {
          if (!wasSilenced) {
            wasSilenced = true
            // Descarta amostras pendentes no codificador e fecha o segmento: o período silenciado vira lacuna.
            try { codec.flush() } catch (_: Exception) {}
            closeSegment()
            journal.append("interruption_begin", mapOf("reason" to "silenced_by_system"))
            RecorderBus.state = "interrupted"
            emitState()
          }
          continue // não grava zeros no lugar do áudio ausente
        }
        if (wasSilenced) {
          wasSilenced = false
          journal.append("interruption_end", mapOf("reason" to "silenced_by_system"))
          RecorderBus.state = "recording"
          emitState()
        }

        if (writer == null) {
          val startAt = nowWall - (n * 1000L / rate)
          openSegment(startAt)
          chainAnchorElapsed = nowElapsed - (n * 1000L / rate)
          chainAnchorSamples = samplesFed
        }

        meter.add(pcm, n)
        RecorderBus.lastDbfs = meter.lastSecondDbfs
        feed(n, false)

        // Detecção de deriva: se o relógio de amostras atrasar em relação ao relógio monotônico,
        // amostras foram perdidas (ex.: sobrecarga do sistema). Registramos e reancoramos.
        val sampleElapsed = (samplesFed - chainAnchorSamples) * 1000L / rate
        val realElapsed = nowElapsed - chainAnchorElapsed
        if (realElapsed - sampleElapsed > DRIFT_TOLERANCE_MS) {
          drainEncoder(false)
          closeSegment()
          journal.append("capture_drift", mapOf("lostMs" to (realElapsed - sampleElapsed)))
          chainAnchorElapsed = nowElapsed
          chainAnchorSamples = samplesFed
        }

        if (nowElapsed - lastStatusEmit >= 1000) {
          lastStatusEmit = nowElapsed
          emitState()
        }
      }
      // Encerramento seguro: esvazia o codificador e fecha o segmento atual.
      if (writer != null) {
        try {
          feed(0, true)
          drainEncoder(true)
        } catch (_: Exception) {}
        closeSegment()
      }
    } catch (e: Exception) {
      journal.append("error", mapOf("code" to "capture_exception", "message" to (e.message ?: e.javaClass.simpleName)))
      stopReason = "capture_error"
      try { closeSegment() } catch (_: Exception) {}
    }
    finish(journal, stopReason, record, codec)
  }

  private fun finish(journal: Journal, reason: String, record: AudioRecord?, codec: MediaCodec?) {
    try { record?.stop() } catch (_: Exception) {}
    try { record?.release() } catch (_: Exception) {}
    try { codec?.stop() } catch (_: Exception) {}
    try { codec?.release() } catch (_: Exception) {}
    unregisterCallbacks()
    journal.append("session_stop", mapOf("reason" to reason, "battery" to batteryPercent()))
    releaseWakeLock()
    running = false
    RecorderBus.state = "idle"
    val b = Bundle()
    b.putString("sessionId", RecorderBus.sessionId)
    b.putString("reason", reason)
    RecorderBus.emit("onStopped", b)
    mainHandler.post {
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE)
        else @Suppress("DEPRECATION") stopForeground(true)
      } catch (_: Exception) {}
      stopSelf()
    }
  }

  private fun emitState() = RecorderBus.emit("onStatus", RecorderBus.statusBundle())

  // ---------------------------------------------------------------------------------------------

  private fun registerCallbacks(record: AudioRecord, journal: Journal) {
    val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val cb = object : AudioManager.AudioRecordingCallback() {
        override fun onRecordingConfigChanged(configs: MutableList<AudioRecordingConfiguration>) {
          val mine = configs.firstOrNull { it.clientAudioSessionId == record.audioSessionId } ?: return
          silenced = mine.isClientSilenced
        }
      }
      am.registerAudioRecordingCallback(cb, mainHandler)
      recordingCallback = cb
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      record.addOnRoutingChangedListener(AudioRouting.OnRoutingChangedListener { router ->
        val dev = router.routedDevice
        journal.append(
          "route_change",
          mapOf("input" to inputTypeName(dev?.type), "name" to (dev?.productName?.toString() ?: ""))
        )
      }, mainHandler)
    }
  }

  private fun unregisterCallbacks() {
    val cb = recordingCallback ?: return
    try {
      val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
      am.unregisterAudioRecordingCallback(cb)
    } catch (_: Exception) {}
    recordingCallback = null
  }

  private fun inputTypeName(type: Int?): String = when (type) {
    AudioDeviceInfo.TYPE_BUILTIN_MIC -> "builtin_mic"
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "bluetooth"
    AudioDeviceInfo.TYPE_WIRED_HEADSET -> "wired_headset"
    AudioDeviceInfo.TYPE_USB_DEVICE, AudioDeviceInfo.TYPE_USB_HEADSET -> "usb"
    null -> "unknown"
    else -> "type_$type"
  }

  private fun acquireWakeLock(timeoutMs: Long) {
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "RespiraSono:NightRecording").also {
      it.setReferenceCounted(false)
      it.acquire(timeoutMs)
    }
  }

  private fun releaseWakeLock() {
    try { if (wakeLock?.isHeld == true) wakeLock?.release() } catch (_: Exception) {}
    wakeLock = null
  }

  private fun batteryPercent(): Int {
    val bm = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
    return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
  }

  private fun freeBytes(dir: File): Long = try { StatFs(dir.absolutePath).availableBytes } catch (_: Exception) { Long.MAX_VALUE }

  private fun buildNotification(): Notification {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, "Gravação da noite", NotificationManager.IMPORTANCE_LOW)
      channel.description = "Indica que o RESPIRA Sono está gravando o áudio do quarto."
      channel.setShowBadge(false)
      nm.createNotificationChannel(channel)
    }
    val piFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val contentPi = launch?.let { PendingIntent.getActivity(this, 0, it, piFlags) }
    val stopIntent = Intent(this, NightRecorderService::class.java).setAction(ACTION_STOP)
      .putExtra(EXTRA_STOP_REASON, "user_notification")
    val stopPi = PendingIntent.getService(this, 1, stopIntent, piFlags)

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL_ID)
    else @Suppress("DEPRECATION") Notification.Builder(this)
    builder
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentTitle("Gravando sua noite")
      .setContentText("O microfone está ativo. Toque em Encerrar quando acordar.")
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .addAction(Notification.Action.Builder(null as android.graphics.drawable.Icon?, "Encerrar", stopPi).build())
    if (contentPi != null) builder.setContentIntent(contentPi)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
    }
    return builder.build()
  }
}
