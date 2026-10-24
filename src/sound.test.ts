// Tests for the sound parameter mappers. Plain numbers only: the Web Audio calls
// themselves need a browser and a user gesture, so they stay untested by design.
import { describe, expect, it } from 'vitest'
import { boingParams, isMuted, setMuted, whooshParams } from './audio/sfx'

describe('boingParams', () => {
  it('lands deeper, longer and louder the harder it falls', () => {
    const soft = boingParams(1)
    const hard = boingParams(6)
    expect(hard.from).toBeLessThan(soft.from)
    expect(hard.to).toBeLessThan(soft.to)
    expect(hard.dur).toBeGreaterThan(soft.dur)
    expect(hard.gain).toBeGreaterThan(soft.gain)
  })

  it('clamps wild impacts to the same extremes', () => {
    expect(boingParams(99)).toEqual(boingParams(6))
    expect(boingParams(-3)).toEqual(boingParams(0))
  })
})

describe('whooshParams', () => {
  it('whistles higher and longer the faster the throw', () => {
    const slow = whooshParams(0.1)
    const fast = whooshParams(1)
    expect(fast.from).toBeGreaterThan(slow.from)
    expect(fast.to).toBeGreaterThan(slow.to)
    expect(fast.dur).toBeGreaterThan(slow.dur)
    expect(fast.gain).toBeGreaterThan(slow.gain)
  })

  it('clamps outside 0..1', () => {
    expect(whooshParams(5)).toEqual(whooshParams(1))
    expect(whooshParams(-1)).toEqual(whooshParams(0))
  })
})

describe('mute flag', () => {
  it('toggles and reports', () => {
    setMuted(true)
    expect(isMuted()).toBe(true)
    setMuted(false)
    expect(isMuted()).toBe(false)
  })
})
