package expo.modules.respirarecorder

import kotlin.math.log10
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Estatísticas de sinal por segundo, em dBFS (escala digital relativa, NÃO é dB SPL calibrado).
 * Serve para qualidade do sinal e detecção de atividade sonora; não identifica ronco.
 */
internal class LevelMeter(private val sampleRate: Int) {
  private var sumSq = 0.0
  private var count = 0
  private var peak = 0
  private val perSecond = ArrayList<Float>()

  var totalSamples = 0L; private set
  var clippedSamples = 0L; private set
  var zeroSamples = 0L; private set
  var lastSecondDbfs: Float = -120f; private set

  fun add(buf: ShortArray, n: Int) {
    for (i in 0 until n) {
      val s = buf[i].toInt()
      val a = if (s < 0) -s else s
      if (a >= 32767) clippedSamples++
      if (s == 0) zeroSamples++
      if (a > peak) peak = a
      sumSq += (s.toDouble() * s.toDouble())
      count++
      totalSamples++
      if (count >= sampleRate) flushSecond()
    }
  }

  private fun flushSecond() {
    val rms = sqrt(sumSq / max(count, 1))
    val db = if (rms <= 0.0) -120.0 else 20.0 * log10(rms / 32768.0)
    lastSecondDbfs = db.toFloat().coerceAtLeast(-120f)
    perSecond.add(lastSecondDbfs)
    sumSq = 0.0; count = 0; peak = 0
  }

  /** Retorna e zera os valores por segundo acumulados para o segmento atual. */
  fun drainSeconds(): FloatArray {
    val out = perSecond.toFloatArray()
    perSecond.clear()
    return out
  }

  fun resetCounters() {
    totalSamples = 0; clippedSamples = 0; zeroSamples = 0
  }
}
