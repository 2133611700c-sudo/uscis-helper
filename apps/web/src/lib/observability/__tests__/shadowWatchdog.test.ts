/**
 * shadowWatchdog — deterministic aggregator over PII-free shadow markers + strict-flag
 * DeepSeek verdict (aggregate-only input; key ≠ permission). FICTIONAL log lines.
 */
import { describe, it, expect, vi } from 'vitest'
import { aggregateShadowLogs, deepseekWatchdogVerdict, isDeepseekWatchdogEnabled } from '../shadowWatchdog'

const LOG = [
  '[decision_shadow] {"doc_type_id":"ua_international_passport","fields":8,"diffs":0,"diff_keys":[],"unresolved_match":true}',
  '[decision_shadow] {"doc_type_id":"ua_birth_certificate","fields":12,"diffs":2,"diff_keys":["dob","sex"],"unresolved_match":false}',
  '[tps_one_arbitration_shadow] {"doc_type_hint":"i94","legacy_fields":6,"shadow_fields":6,"missing_in_shadow":[],"added_in_shadow":[],"value_diff_keys":["last_entry_date"],"review_loosened_keys":[],"review_tightened_keys":["family_name"]}',
  '[tps_one_arbitration_shadow] {"doc_type_hint":"ead","legacy_fields":5,"shadow_fields":4,"missing_in_shadow":["ead_category_on_card"],"added_in_shadow":[],"value_diff_keys":[],"review_loosened_keys":["a_number"],"review_tightened_keys":[]}',
  '[deepseek_brain_contribution] {"doc_type_hint":"i94","rule_fields":4,"brain_validated":3,"brain_added":2,"brain_added_keys":["place_of_last_entry","given_name"],"brain_skipped":1}',
  '[ADR018] fallback_model_used {"doc_type_id":"ua_international_passport","model":"gpt-4.1","primary":"gemini-2.5-pro","fields":8}',
  '[recognize_retry_on_empty] {"product":"translation","doc_type_id":"ua_military_id"}',
  '[gates_as_readers_shadow] {"doc_type_id":"ua_birth_certificate","fields":12,"legacy_unresolved":3,"engine_unresolved":2,"unresolved_diff_keys":["dob"],"release_diff_keys":[],"engine_loosened_keys":["dob"],"engine_tightened_keys":[],"match":false}',
  '[normalize_collapse_shadow] {"doc_type_hint":"passport","fields":5,"signals":5,"value_diff_keys":["family_name"],"reject_diff_keys":[],"match":false}',
  '[handwriting_ensemble_shadow] {"doc_type_id":"ua_military_id","fields_compared":3,"agree_exact":["family_name"],"agree_fold":[],"disagree":["given_name"],"llm_only":["patronymic"],"htr_only":[],"both_empty":[]}',
  'random unrelated line that must be ignored {"secret":"never-forwarded"}',
].join('\n')

describe('aggregateShadowLogs — deterministic, PII-free by construction', () => {
  const agg = aggregateShadowLogs(LOG)

  it('parses exactly the known markers, ignores everything else', () => {
    expect(agg.markers_parsed).toBe(10)
  })

  it('handwriting ensemble: informational reader-complementarity stats', () => {
    expect(agg.handwriting_ensemble).toMatchObject({
      docs: 1,
      fields_compared: 3,
      agree_total: 1,
      disagree_total: 1,
      llm_only_total: 1,
      htr_only_total: 0,
      both_empty_total: 0,
    })
    expect(agg.handwriting_ensemble.agreement_rate).toBeCloseTo(1 / 3)
    expect(agg.handwriting_ensemble.disagreement_rate).toBeCloseTo(1 / 3)
    expect(agg.handwriting_ensemble.asymmetry_rate).toBeCloseTo(1 / 3)
  })

  it('normalize_collapse shadow: any mismatch blocks the Phase-8 flip', () => {
    expect(agg.normalize_collapse_shadow).toMatchObject({ docs: 1, value_diff_total: 1, mismatched_docs: 1 })
    expect(agg.flags.normalize_flip_blocked).toBe(true)
  })

  it('gates_as_readers shadow: loosening blocks the Phase-1b flip', () => {
    expect(agg.gates_shadow).toMatchObject({
      docs: 1, unresolved_diff_total: 1, engine_loosened_total: 1, engine_tightened_total: 0, mismatched_docs: 1,
    })
    expect(agg.flags.gates_flip_blocked).toBe(true)
  })

  it('decision_shadow aggregate + flip verdict', () => {
    expect(agg.decision_shadow).toMatchObject({ docs: 2, fields: 20, diffs: 2, unresolved_mismatches: 1 })
    expect(agg.decision_shadow.diff_keys).toEqual({ dob: 1, sex: 1 })
    expect(agg.flags.decision_flip_blocked).toBe(true)
  })

  it('one_arbitration aggregate: loosened/missing block the flip; tightened does not', () => {
    expect(agg.one_arbitration_shadow).toMatchObject({
      docs: 2, missing_in_shadow_total: 1, review_loosened_total: 1, review_tightened_total: 1, value_diff_total: 1,
    })
    expect(agg.one_arbitration_shadow.offending_doc_types).toEqual(['ead'])
    expect(agg.flags.arbitration_flip_blocked).toBe(true)
  })

  it('deepseek contribution + fallback models + retry counter', () => {
    expect(agg.deepseek_contribution.brain_added_total).toBe(2)
    expect(agg.fallback_model_reads.by_model['gpt-4.1']).toBe(1)
    expect(agg.retry_on_empty_fired).toBe(1)
  })

  it('clean logs → flips NOT blocked', () => {
    const clean = aggregateShadowLogs('[decision_shadow] {"fields":8,"diffs":0,"diff_keys":[],"unresolved_match":true}')
    expect(clean.flags.decision_flip_blocked).toBe(false)
    expect(clean.flags.arbitration_flip_blocked).toBe(false)
  })
})

describe('deepseekWatchdogVerdict — strict flag, aggregate-only, fail-open', () => {
  const agg = aggregateShadowLogs(LOG)

  it("flag absent/'true' → null without calling (key ≠ permission)", async () => {
    const f = vi.fn()
    expect(await deepseekWatchdogVerdict(agg, f as never, { DEEPSEEK_API_KEY: 'k' })).toBeNull()
    expect(await deepseekWatchdogVerdict(agg, f as never, { DEEPSEEK_API_KEY: 'k', DEEPSEEK_WATCHDOG: 'true' })).toBeNull()
    expect(f).not.toHaveBeenCalled()
    expect(isDeepseekWatchdogEnabled({ DEEPSEEK_WATCHDOG: '1' })).toBe(true)
  })

  it("flag '1' + key → sends ONLY the aggregate JSON (no raw log lines)", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'verdict: flip blocked' } }] }),
    })
    const v = await deepseekWatchdogVerdict(agg, f as never, { DEEPSEEK_WATCHDOG: '1', DEEPSEEK_API_KEY: 'k' })
    expect(v).toBe('verdict: flip blocked')
    const body = (f.mock.calls[0][1] as { body: string }).body
    expect(body).not.toContain('never-forwarded')      // unknown lines never forwarded
    expect(body).toContain('missing_in_shadow_total')  // aggregate only
  })

  it('provider error → null (deterministic aggregate stays the truth)', async () => {
    const f = vi.fn().mockRejectedValue(new Error('down'))
    expect(await deepseekWatchdogVerdict(agg, f as never, { DEEPSEEK_WATCHDOG: '1', DEEPSEEK_API_KEY: 'k' })).toBeNull()
  })
})
