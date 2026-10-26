package expo.modules.respirarecorder

import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

/**
 * Escreve quadros AAC-LC brutos com cabeçalho ADTS. Cada quadro é decodificável de forma
 * independente, então um arquivo interrompido por falha continua reproduzível até o último
 * quadro completo — diferente de um .m4a, que depende do índice escrito no fechamento.
 */
internal class AdtsWriter(val file: File, private val sampleRate: Int, private val channels: Int) {
  private val fos = FileOutputStream(file, false)
  private val out = BufferedOutputStream(fos, 64 * 1024)
  private val freqIndex = sampleRateIndex(sampleRate)
  var framesWritten: Long = 0 // quadros AAC (1024 amostras cada)
    private set
  var bytesWritten: Long = 0
    private set
  private var lastSyncMs = System.currentTimeMillis()

  fun writeFrame(payload: ByteArray, offset: Int, length: Int) {
    val frameLen = length + 7
    val h = ByteArray(7)
    val profile = 2 // AAC LC
    h[0] = 0xFF.toByte()
    h[1] = 0xF1.toByte() // MPEG-4, layer 0, sem CRC
    h[2] = (((profile - 1) shl 6) or (freqIndex shl 2) or (channels shr 2)).toByte()
    h[3] = (((channels and 3) shl 6) or (frameLen shr 11)).toByte()
    h[4] = ((frameLen and 0x7FF) shr 3).toByte()
    h[5] = (((frameLen and 7) shl 5) or 0x1F).toByte()
    h[6] = 0xFC.toByte()
    out.write(h)
    out.write(payload, offset, length)
    framesWritten += 1
    bytesWritten += frameLen
    val now = System.currentTimeMillis()
    if (now - lastSyncMs >= 5_000) {
      // Persistência progressiva: no pior caso perdem-se ~5 s do segmento atual.
      out.flush()
      try { fos.fd.sync() } catch (_: Exception) {}
      lastSyncMs = now
    }
  }

  val durationMs: Long get() = framesWritten * 1024L * 1000L / sampleRate

  fun close() {
    try {
      out.flush()
      fos.fd.sync()
    } catch (_: Exception) {}
    try { out.close() } catch (_: Exception) {}
  }

  companion object {
    private val RATES = intArrayOf(96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350)

    fun sampleRateIndex(rate: Int): Int {
      val i = RATES.indexOf(rate)
      require(i >= 0) { "Taxa de amostragem sem índice ADTS: $rate" }
      return i
    }

    /**
     * Conta quadros ADTS completos de um arquivo (usado na recuperação após falha).
     * Retorna duração em ms e bytes válidos; um quadro final truncado é ignorado.
     */
    fun probe(file: File): Pair<Long, Long>? {
      if (!file.exists()) return null
      val data = FileInputStream(file).use { it.readBytes() }
      var pos = 0
      var frames = 0L
      var rate = 0
      while (pos + 7 <= data.size) {
        val b0 = data[pos].toInt() and 0xFF
        val b1 = data[pos + 1].toInt() and 0xF0
        if (b0 != 0xFF || b1 != 0xF0) break
        val idx = (data[pos + 2].toInt() shr 2) and 0x0F
        if (idx >= RATES.size) break
        rate = RATES[idx]
        val len = ((data[pos + 3].toInt() and 0x03) shl 11) or
          ((data[pos + 4].toInt() and 0xFF) shl 3) or
          ((data[pos + 5].toInt() and 0xE0) shr 5)
        if (len < 7 || pos + len > data.size) break
        frames += 1
        pos += len
      }
      if (rate == 0) return Pair(0L, 0L)
      return Pair(frames * 1024L * 1000L / rate, pos.toLong())
    }
  }
}
