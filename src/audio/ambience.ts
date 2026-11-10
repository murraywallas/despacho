/**
 * The background hum: looping noise filtered down to a low rumble that slowly swells, made with Web Audio on
 * Howler's context and routed through its master gain, so mute and volume apply to it too.
 */
import { AMBIENCE } from './mix'

export interface Ambience {
  setOn: (on: boolean) => void
}

/** Noise for the loop. Plain random noise has no drift, so the loop joins without a click worth hearing. */
function noiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * AMBIENCE.loopSec), context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
  return buffer
}

export function createAmbience(context: AudioContext, output: AudioNode): Ambience {
  let source: AudioBufferSourceNode | null = null
  let swell: OscillatorNode | null = null
  const gain = context.createGain()
  gain.gain.value = 0
  gain.connect(output)

  const start = () => {
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = AMBIENCE.lowpassHz
    filter.connect(gain)

    source = context.createBufferSource()
    source.buffer = noiseBuffer(context)
    source.loop = true
    source.connect(filter)
    source.start()

    // The swell nudges the level up and down around its value.
    swell = context.createOscillator()
    swell.frequency.value = AMBIENCE.swellHz
    const depth = context.createGain()
    depth.gain.value = AMBIENCE.level * AMBIENCE.swellDepth
    swell.connect(depth)
    depth.connect(gain.gain)
    swell.start()
  }

  return {
    setOn: (on) => {
      if (on && !source) start()
      const now = context.currentTime
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(gain.gain.value, now)
      gain.gain.linearRampToValueAtTime(on ? AMBIENCE.level : 0, now + AMBIENCE.fadeSec)
    },
  }
}
