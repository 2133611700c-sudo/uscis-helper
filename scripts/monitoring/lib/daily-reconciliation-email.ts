import {
  sendDigest,
  type DigestDeliveryOptions,
  type DigestDeliveryResult,
} from './email'

type DigestSender = (
  html: string,
  subject: string,
  options?: DigestDeliveryOptions,
) => Promise<DigestDeliveryResult>

export async function sendDailyReconciliationDigest(
  html: string,
  subject: string,
  overdueCount: number,
  deliver: DigestSender = sendDigest,
  log: (message: string) => void = console.log,
): Promise<DigestDeliveryResult> {
  const delivery = await deliver(html, subject, { strict: true })

  if (delivery.status !== 'sent') {
    throw new Error(`Daily reconciliation digest not sent: ${delivery.reason || 'unknown'}`)
  }

  log(
    JSON.stringify({
      event: 'daily_reconciliation_digest',
      overdue_count: overdueCount,
      delivery_status: delivery.status,
      strict: delivery.strict,
    }),
  )
  return delivery
}
