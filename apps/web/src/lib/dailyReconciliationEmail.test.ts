import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { sendDailyReconciliationDigest } from '../../../../scripts/monitoring/lib/daily-reconciliation-email'

describe('sendDailyReconciliationDigest', () => {
  it('keeps both live caller policies explicit in code and workflow', () => {
    const repoRoot = resolve(process.cwd(), '../..')
    const federalSource = readFileSync(
      resolve(repoRoot, 'scripts/monitoring/build-digest-email.ts'),
      'utf8',
    )
    const reconciliationSource = readFileSync(
      resolve(repoRoot, 'scripts/monitoring/lib/daily-reconciliation-email.ts'),
      'utf8',
    )
    const reconciliationWorkflow = readFileSync(
      resolve(repoRoot, '.github/workflows/daily-reconciliation.yml'),
      'utf8',
    )

    expect(federalSource).toContain("sendDigest(html, subject, { strict: false })")
    expect(reconciliationSource).toContain("deliver(html, subject, { strict: true })")
    expect(reconciliationWorkflow).toMatch(/EMAIL_STRICT:\s*'1'/)
  })

  it('forces strict delivery and logs sent only after provider success', async () => {
    const deliver = vi.fn().mockResolvedValue({ status: 'sent', strict: true })
    const log = vi.fn()

    await expect(
      sendDailyReconciliationDigest('<p>private</p>', 'Private subject', 3, deliver, log),
    ).resolves.toEqual({ status: 'sent', strict: true })

    expect(deliver).toHaveBeenCalledWith('<p>private</p>', 'Private subject', { strict: true })
    expect(log).toHaveBeenCalledTimes(1)
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      event: 'daily_reconciliation_digest',
      overdue_count: 3,
      delivery_status: 'sent',
      strict: true,
    })
  })

  it('fails closed and never claims sent when delivery degrades', async () => {
    const deliver = vi.fn().mockResolvedValue({
      status: 'degraded',
      reason: 'provider_error',
      httpStatus: 401,
      strict: false,
    })
    const log = vi.fn()

    await expect(
      sendDailyReconciliationDigest('<p>private</p>', 'Private subject', 2, deliver, log),
    ).rejects.toThrow('Daily reconciliation digest not sent: provider_error')
    expect(log).not.toHaveBeenCalled()
  })

  it('does not copy digest content or subject into its success log', async () => {
    const deliver = vi.fn().mockResolvedValue({ status: 'sent', strict: true })
    const log = vi.fn()

    await sendDailyReconciliationDigest(
      '<p>private ticket content</p>',
      'Private paid-failure subject',
      1,
      deliver,
      log,
    )

    const output = log.mock.calls.flat().join(' ')
    expect(output).not.toContain('private ticket content')
    expect(output).not.toContain('Private paid-failure subject')
  })
})
