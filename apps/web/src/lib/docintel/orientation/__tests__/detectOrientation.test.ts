/**
 * detectOrientation.test.ts — content-based orientation detector (grid compare).
 * Pure/deterministic: position→correction mapping, grid geometry, and fail-open contract
 * (a failed/awol Gemini call ⇒ original buffer, applied 0, never throws). No live Gemini.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import sharp from 'sharp'
import {
  positionToCorrectionCw,
  buildOrientationGrid,
  orientToUpright,
  detectUprightCw,
  isContentOrientEnabled,
  foldOrientationVotes,
  orientVoteRuns,
  detectUprightCwVoted,
  orientationSettled,
  isOrient180CheckEnabled,
  build180Grid,
  confirmUprightVs180,
} from '../detectOrientation'
import { PRIMARY_READER } from '../../modelMatrix'

afterEach(() => { vi.restoreAllMocks() })

/** A small valid test image (red 200x300 portrait) as a JPEG buffer. */
async function testImage(): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 300, channels: 3, background: '#cc0000' } }).jpeg().toBuffer()
}

describe('positionToCorrectionCw', () => {
  it('maps each grid position to its rotation', () => {
    expect(positionToCorrectionCw('top-left')).toBe(0)
    expect(positionToCorrectionCw('top-right')).toBe(90)
    expect(positionToCorrectionCw('bottom-left')).toBe(180)
    expect(positionToCorrectionCw('bottom-right')).toBe(270)
  })
  it('tolerates case/whitespace', () => {
    expect(positionToCorrectionCw('  TOP-RIGHT ')).toBe(90)
  })
  it('returns null for anything unrecognized', () => {
    expect(positionToCorrectionCw('middle')).toBeNull()
    expect(positionToCorrectionCw(undefined)).toBeNull()
    expect(positionToCorrectionCw(90)).toBeNull()
    expect(positionToCorrectionCw(null)).toBeNull()
  })
})

describe('buildOrientationGrid', () => {
  it('produces a valid square JPEG of the expected size', async () => {
    const grid = await buildOrientationGrid(await testImage(), 480, 10)
    const meta = await sharp(grid).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.width).toBe(480 * 2 + 10 * 3) // 990
    expect(meta.height).toBe(990)
  })
})

describe('orientToUpright — fail-open', () => {
  it('detection failure (fetch throws) ⇒ original buffer, applied 0, detected false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    const buf = await testImage()
    const out = await orientToUpright(buf, 'key', PRIMARY_READER)
    expect(out.applied).toBe(0)
    expect(out.detected).toBe(false)
    expect(out.buffer).toBe(buf) // unchanged reference
  })

  it('model picks top-right (90°) ⇒ buffer rotated, applied 90, detected true', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"pos":"top-right"}' }] } }] }),
    })))
    const buf = await testImage() // 200x300 portrait
    const out = await orientToUpright(buf, 'key', PRIMARY_READER)
    expect(out.applied).toBe(90)
    expect(out.detected).toBe(true)
    const meta = await sharp(out.buffer).metadata()
    expect(meta.width).toBe(300) // dimensions swapped by the 90° rotation
    expect(meta.height).toBe(200)
  })

  it('model says top-left (0°) ⇒ no rotation, detected true', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"pos":"top-left"}' }] } }] }),
    })))
    const buf = await testImage()
    const out = await orientToUpright(buf, 'key', PRIMARY_READER)
    expect(out.applied).toBe(0)
    expect(out.detected).toBe(true)
    expect(out.buffer).toBe(buf)
  })

  it('HTTP error ⇒ detectUprightCw null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })))
    expect(await detectUprightCw(await testImage(), 'key', 'm')).toBeNull()
  })
})

describe('foldOrientationVotes (K-vote stabilization)', () => {
  it('strict majority wins (270 in 2 of 3)', () => {
    expect(foldOrientationVotes([270, 270, 0], 3)).toBe(270)
  })
  it('split 0/270 (no strict majority over runs) ⇒ null (do not rotate)', () => {
    expect(foldOrientationVotes([0, 270, null], 3)).toBeNull() // best=1, 1*2 not > 3
  })
  it('nulls do not vote; 2 of 3 real agree ⇒ wins even with a null', () => {
    expect(foldOrientationVotes([90, 90, null], 3)).toBe(90)
  })
  it('5 runs, 3 agree ⇒ wins; 2-2-1 ⇒ null', () => {
    expect(foldOrientationVotes([90, 90, 90, 0, 270], 5)).toBe(90)
    expect(foldOrientationVotes([0, 0, 270, 270, 90], 5)).toBeNull()
  })
})

describe('orientVoteRuns env', () => {
  it('default 3; 1→1; 5→5; garbage→3; 9→clamp 5', () => {
    expect(orientVoteRuns({})).toBe(3)
    expect(orientVoteRuns({ ORIENT_VOTE_RUNS: '1' })).toBe(1)
    expect(orientVoteRuns({ ORIENT_VOTE_RUNS: '5' })).toBe(5)
    expect(orientVoteRuns({ ORIENT_VOTE_RUNS: 'x' })).toBe(3)
    expect(orientVoteRuns({ ORIENT_VOTE_RUNS: '9' })).toBe(5)
  })
})

describe('detectUprightCwVoted (injected sampler)', () => {
  it('votes K times and returns the majority', async () => {
    const seq: Array<0 | 90 | 180 | 270 | null> = [270, 0, 270]
    let i = 0
    const out = await detectUprightCwVoted(Buffer.from('x'), 'k', 'm', { runs: 3, sampler: async () => seq[i++] })
    expect(out).toBe(270)
  })
  it('runs:1 ⇒ single detect verbatim', async () => {
    const out = await detectUprightCwVoted(Buffer.from('x'), 'k', 'm', { runs: 1, sampler: async () => 90 })
    expect(out).toBe(90)
  })
  it('a throwing sample counts as null, not a crash', async () => {
    const seq = [async () => 270 as const, async () => { throw new Error('x') }, async () => 270 as const]
    let i = 0
    const out = await detectUprightCwVoted(Buffer.from('x'), 'k', 'm', { runs: 3, sampler: () => seq[i++]() })
    expect(out).toBe(270)
  })
  it('COST early-exit: first 2 agree ⇒ stops at 2 detects (not 3)', async () => {
    let calls = 0
    const out = await detectUprightCwVoted(Buffer.from('x'), 'k', 'm', { runs: 3, sampler: async () => { calls++; return 270 } })
    expect(out).toBe(270)
    expect(calls).toBe(2)
  })
})

describe('orientationSettled (cost early-exit)', () => {
  it('2 of 3 agree ⇒ settled; 1 of 3 ⇒ not; all-null with 1 left ⇒ settled', () => {
    expect(orientationSettled([270, 270], 3)).toBe(true)
    expect(orientationSettled([270], 3)).toBe(false)
    expect(orientationSettled([null, null], 3)).toBe(true)
  })
})

describe('isContentOrientEnabled', () => {
  it('default ON (Step-5: proven 0/4→2/4 on the EXIF-sideways real doc); only "0" disables', () => {
    expect(isContentOrientEnabled({})).toBe(true)
    expect(isContentOrientEnabled({ CONTENT_ORIENT_ENABLED: '1' })).toBe(true)
    expect(isContentOrientEnabled({ CONTENT_ORIENT_ENABLED: '0' })).toBe(false)
  })
})

describe('isOrient180CheckEnabled — default OFF (byte-identical unless explicitly turned on)', () => {
  it('only "1" enables', () => {
    expect(isOrient180CheckEnabled({})).toBe(false)
    expect(isOrient180CheckEnabled({ ORIENT_180_CHECK: 'true' })).toBe(false)
    expect(isOrient180CheckEnabled({ ORIENT_180_CHECK: '0' })).toBe(false)
    expect(isOrient180CheckEnabled({ ORIENT_180_CHECK: '1' })).toBe(true)
  })
})

describe('build180Grid — pure geometry', () => {
  it('produces a 1x2 grid twice as wide as one cell, with the second cell rotated 180°', async () => {
    const buf = await testImage() // 200x300 portrait
    const grid = await build180Grid(buf, 100, 5)
    const meta = await sharp(grid).metadata()
    expect(meta.width).toBe(100 * 2 + 5 * 3)
    expect(meta.height).toBe(100 + 5 * 2)
  })
})

describe('confirmUprightVs180 — binary 180° confirm (fail-open)', () => {
  it('"left" ⇒ candidate is upright', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"side":"left"}' }] } }] }),
    })))
    expect(await confirmUprightVs180(await testImage(), 'key', PRIMARY_READER)).toBe('candidate')
  })

  it('"right" ⇒ candidate needs the extra 180°', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"side":"right"}' }] } }] }),
    })))
    expect(await confirmUprightVs180(await testImage(), 'key', PRIMARY_READER)).toBe('flipped')
  })

  it('HTTP error / unparseable / network failure ⇒ null (never throws)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })))
    expect(await confirmUprightVs180(await testImage(), 'key', PRIMARY_READER)).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    expect(await confirmUprightVs180(await testImage(), 'key', PRIMARY_READER)).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"side":"sideways"}' }] } }] }),
    })))
    expect(await confirmUprightVs180(await testImage(), 'key', PRIMARY_READER)).toBeNull()
  })
})

describe('orientToUpright — ORIENT_180_CHECK integration (default OFF ⇒ byte-identical)', () => {
  afterEach(() => { delete process.env.ORIENT_180_CHECK; delete process.env.ORIENT_VOTE_RUNS })

  it('flag OFF (default): no second call is made even if a confirm-style response would be returned', async () => {
    process.env.ORIENT_VOTE_RUNS = '1'
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url)
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"pos":"top-left"}' }] } }] }) }
    }))
    const out = await orientToUpright(await testImage(), 'key', PRIMARY_READER)
    expect(out.detected).toBe(true)
    expect(out.disambiguated180).toBeUndefined()
    expect(calls.length).toBe(1) // ONLY the 4-cell vote — no 180 confirm call when the flag is off
  })

  it('flag ON, confirm says "flipped" ⇒ applies an extra 180°, disambiguated180=true', async () => {
    process.env.ORIENT_180_CHECK = '1'
    process.env.ORIENT_VOTE_RUNS = '1'
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"pos":"top-left"}' }] } }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"side":"right"}' }] } }] }) }))
    const out = await orientToUpright(await testImage(), 'key', PRIMARY_READER)
    expect(out.applied).toBe(180)
    expect(out.detected).toBe(true)
    expect(out.disambiguated180).toBe(true)
  })

  it('flag ON, confirm says "left" (candidate correct) ⇒ no extra rotation, disambiguated180 unset', async () => {
    process.env.ORIENT_180_CHECK = '1'
    process.env.ORIENT_VOTE_RUNS = '1'
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"pos":"top-left"}' }] } }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"side":"left"}' }] } }] }) }))
    const out = await orientToUpright(await testImage(), 'key', PRIMARY_READER)
    expect(out.applied).toBe(0)
    expect(out.detected).toBe(true)
    expect(out.disambiguated180).toBeUndefined()
  })

  it('flag ON, confirm undecidable ⇒ detected=false (honest uncertainty, never a silent guess)', async () => {
    process.env.ORIENT_180_CHECK = '1'
    process.env.ORIENT_VOTE_RUNS = '1'
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"pos":"top-left"}' }] } }] }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) }))
    const out = await orientToUpright(await testImage(), 'key', PRIMARY_READER)
    expect(out.detected).toBe(false)
  })

  it('4-cell vote itself undecidable ⇒ no 180-confirm call is attempted', async () => {
    process.env.ORIENT_180_CHECK = '1'
    process.env.ORIENT_VOTE_RUNS = '1'
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url)
      return { ok: false, status: 500, json: async () => ({}) }
    }))
    const out = await orientToUpright(await testImage(), 'key', PRIMARY_READER)
    expect(out.detected).toBe(false)
    expect(calls.length).toBe(1) // fails before reaching the confirm stage
  })
})
