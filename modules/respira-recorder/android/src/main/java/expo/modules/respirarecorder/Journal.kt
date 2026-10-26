package expo.modules.respirarecorder

import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * Diário append-only da sessão (JSON Lines). É a fonte de verdade para reconstruir
 * a noite, inclusive após encerramento forçado do processo: cada linha é gravada
 * e sincronizada no disco (fsync) antes de seguir.
 */
internal class Journal(private val file: File) {
  @Synchronized
  fun append(type: String, fields: Map<String, Any?> = emptyMap()) {
    val obj = JSONObject()
    obj.put("t", type)
    obj.put("at", System.currentTimeMillis())
    for ((k, v) in fields) {
      when (v) {
        null -> obj.put(k, JSONObject.NULL)
        is FloatArray -> obj.put(k, org.json.JSONArray(v.map { Math.round(it * 10f) / 10.0 }))
        else -> obj.put(k, v)
      }
    }
    try {
      FileOutputStream(file, true).use { out ->
        out.write((obj.toString() + "\n").toByteArray(Charsets.UTF_8))
        out.flush()
        out.fd.sync()
      }
    } catch (e: Exception) {
      RecorderBus.emitError("journal_write_failed", e.message ?: "unknown")
    }
  }
}
