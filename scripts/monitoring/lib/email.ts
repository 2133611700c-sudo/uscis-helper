export async function sendDigest(html: string, subject: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY
    const to = process.env.CONTACT_EMAIL_DESTINATION || '2133611700uscis@gmail.com'

  if (!apiKey) {
        console.log('=== EMAIL (dry run, RESEND_API_KEY not set) ===')
        console.log('To:', to)
        console.log('Subject:', subject)
        console.log(html)
        return
  }

  const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
        },
        body: JSON.stringify({
                from: 'monitor@messenginfo.com',
                to,
                subject,
                html,
        }),
  })

  if (!response.ok) {
        const body = await response.text().catch(() => '<unreadable>')
        const msg = `Email failed: ${response.status} ${response.statusText} — ${body}`
        // EMAIL_STRICT=1 restores the old hard-fail. Default (2026-07-10): degrade gracefully.
        // The monitoring itself already ran; a dead/invalid RESEND key should NOT turn the whole
        // job RED. Log the digest to the run output (content preserved) + a loud ::warning:: so the
        // broken key stays visible on every run. Real delivery resumes once a valid key is set.
        if (process.env.EMAIL_STRICT === '1') {
                throw new Error(msg)
        }
        console.log(`::warning::${msg} — digest delivery DEGRADED (set a valid RESEND_API_KEY to re-enable). Digest logged below instead:`)
        console.log('To:', to)
        console.log('Subject:', subject)
        console.log(html)
        return
  }
}
