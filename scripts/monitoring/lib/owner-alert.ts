// Owner alert from a cron/script context — POSTs directly to the Telegram owner
// webhook (no Next.js import chain). Dry-run (logs) when the webhook is unset.
export async function sendOwnerAlert(text: string, metadata: Record<string, unknown> = {}): Promise<void> {
  const url = process.env.TELEGRAM_OWNER_WEBHOOK_URL
  if (!url) {
    console.log('[owner-alert dry-run]', text, JSON.stringify(metadata))
    return
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, metadata }),
    })
    if (!res.ok) console.error('[owner-alert] http', res.status)
  } catch (e) {
    console.error('[owner-alert] failed', String(e))
  }
}
