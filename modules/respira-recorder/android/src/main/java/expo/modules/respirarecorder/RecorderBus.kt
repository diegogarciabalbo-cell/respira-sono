package expo.modules.respirarecorder

import android.os.Bundle

/** Ponte em processo entre o serviço de gravação e o módulo Expo (eventos para o JS). */
internal object RecorderBus {
  interface Listener {
    fun onEvent(name: String, body: Bundle)
  }

  @Volatile var listener: Listener? = null

  @Volatile var state: String = "idle" // idle | starting | recording | interrupted | stopping
  @Volatile var sessionId: String? = null
  @Volatile var sessionDir: String? = null
  @Volatile var startedAtMs: Long = 0
  @Volatile var capturedMs: Long = 0
  @Volatile var segmentIndex: Int = -1
  @Volatile var lastDbfs: Float = -120f

  fun emit(name: String, body: Bundle) {
    try { listener?.onEvent(name, body) } catch (_: Exception) {}
  }

  fun emitError(code: String, message: String) {
    val b = Bundle()
    b.putString("code", code)
    b.putString("message", message)
    emit("onError", b)
  }

  fun statusBundle(): Bundle {
    val b = Bundle()
    b.putString("state", state)
    b.putString("sessionId", sessionId)
    b.putString("sessionDir", sessionDir)
    b.putDouble("startedAtMs", startedAtMs.toDouble())
    b.putDouble("capturedMs", capturedMs.toDouble())
    b.putInt("segmentIndex", segmentIndex)
    b.putDouble("levelDbfs", lastDbfs.toDouble())
    return b
  }
}
