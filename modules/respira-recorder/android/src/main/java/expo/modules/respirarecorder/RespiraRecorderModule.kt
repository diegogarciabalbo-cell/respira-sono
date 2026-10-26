package expo.modules.respirarecorder

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.os.StatFs
import android.provider.Settings
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class RespiraRecorderModule : Module() {
  private val ctx: Context
    get() = appContext.reactContext ?: throw CodedException("no_context", "Contexto indisponível", null)

  private fun recordingsRoot(): File = File(ctx.filesDir, "recordings").also { it.mkdirs() }

  override fun definition() = ModuleDefinition {
    Name("RespiraRecorder")

    Events("onStatus", "onSegment", "onStopped", "onError")

    OnCreate {
      RecorderBus.listener = object : RecorderBus.Listener {
        override fun onEvent(name: String, body: Bundle) {
          this@RespiraRecorderModule.sendEvent(name, body)
        }
      }
    }

    OnDestroy {
      RecorderBus.listener = null
    }

    Constant("platformContainer") { "adts" }
    Constant("fileExtension") { "aac" }

    Function("getRecordingsRoot") { recordingsRoot().absolutePath }

    Function("getStatus") { RecorderBus.statusBundle() }

    Function("getFreeDiskBytes") {
      try { StatFs(recordingsRoot().absolutePath).availableBytes.toDouble() } catch (_: Exception) { -1.0 }
    }

    Function("getBatteryPercent") {
      val bm = ctx.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
      bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    }

    // No Android o backup já está desligado (android:allowBackup="false"); nada a fazer.
    Function("excludeFromBackup") { _: String -> true }

    Function("isIgnoringBatteryOptimizations") {
      val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(ctx.packageName)
    }

    AsyncFunction("openBatteryOptimizationSettings") {
      // Abre a lista do sistema; a decisão é do usuário (não pedimos isenção automática).
      val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
    }

    AsyncFunction("start") { sessionId: String, options: Map<String, Any?> ->
      if (ctx.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        throw CodedException("permission_denied", "Permissão de microfone não concedida", null)
      }
      if (RecorderBus.state != "idle") {
        throw CodedException("already_recording", "Já existe uma gravação em andamento", null)
      }
      if (!sessionId.matches(Regex("^[A-Za-z0-9_-]{6,64}$"))) {
        throw CodedException("invalid_session_id", "Identificador de sessão inválido", null)
      }
      val dir = File(recordingsRoot(), sessionId)
      dir.mkdirs()
      val intent = Intent(ctx, NightRecorderService::class.java)
        .setAction(NightRecorderService.ACTION_START)
        .putExtra(NightRecorderService.EXTRA_SESSION_ID, sessionId)
        .putExtra(NightRecorderService.EXTRA_SESSION_DIR, dir.absolutePath)
        .putExtra(NightRecorderService.EXTRA_SAMPLE_RATE, (options["sampleRate"] as? Number)?.toInt() ?: 16000)
        .putExtra(NightRecorderService.EXTRA_BIT_RATE, (options["bitRate"] as? Number)?.toInt() ?: 32000)
        .putExtra(NightRecorderService.EXTRA_SEGMENT_SECONDS, (options["segmentSeconds"] as? Number)?.toInt() ?: 300)
        .putExtra(NightRecorderService.EXTRA_MIN_FREE_BYTES, (options["minFreeBytes"] as? Number)?.toLong() ?: (150L * 1024 * 1024))
        .putExtra(NightRecorderService.EXTRA_MAX_DURATION_MS, (options["maxDurationMs"] as? Number)?.toLong() ?: (12L * 3600 * 1000))
      RecorderBus.state = "starting"
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(intent) else ctx.startService(intent)
      } catch (e: Exception) {
        RecorderBus.state = "idle"
        throw CodedException("fgs_start_failed", "Não foi possível iniciar a gravação: ${e.message}", e)
      }
      dir.absolutePath
    }

    AsyncFunction("stop") { reason: String? ->
      val svc = NightRecorderService.instance
      if (svc != null) {
        svc.requestStop(reason ?: "user")
        true
      } else {
        RecorderBus.state = "idle"
        false
      }
    }

    AsyncFunction("probeSegment") { path: String ->
      val result = AdtsWriter.probe(File(path))
      val b = Bundle()
      if (result == null) {
        b.putBoolean("ok", false)
        b.putDouble("durationMs", 0.0)
        b.putDouble("validBytes", 0.0)
      } else {
        b.putBoolean("ok", result.first > 0)
        b.putDouble("durationMs", result.first.toDouble())
        b.putDouble("validBytes", result.second.toDouble())
      }
      b
    }
  }
}
