/**
 * /admin/manual-review — pending translation review queue
 * Server component. Protected by ADMIN_SECRET middleware.
 * English-only (staff interface).
 */

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import Link from 'next/link'

interface QueueRow {
  id: string
  created_at: string
  doc_type: string
  source_lang: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  status: string
  expires_at: string
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'background:#fef3c7;color:#92400e',
  in_review:  'background:#dbeafe;color:#1e40af',
  completed:  'background:#d1fae5;color:#065f46',
  cancelled:  'background:#f1f5f9;color:#64748b',
}

export default async function ManualReviewListPage() {
  const supabase = createAdminSupabaseClient()

  const { data: rows, error } = await supabase
    .from('manual_review_queue')
    .select('id,created_at,doc_type,source_lang,contact_name,contact_email,contact_phone,status,expires_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return (
      <main style={{ fontFamily: 'system-ui', padding: '24px', color: '#dc2626' }}>
        <h1>Error loading queue</h1>
        <pre>{error.message}</pre>
      </main>
    )
  }

  const pending   = rows?.filter(r => r.status === 'pending')   ?? []
  const inReview  = rows?.filter(r => r.status === 'in_review') ?? []
  const completed = rows?.filter(r => r.status === 'completed') ?? []

  function Row({ r }: { r: QueueRow }) {
    const created = new Date(r.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })
    const expires = new Date(r.expires_at).toLocaleDateString('en-US')
    const statusStyle = STATUS_COLORS[r.status] ?? ''
    return (
      <tr>
        <td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>
          <Link
            href={`/admin/manual-review/${r.id}`}
            style={{ color: '#2563eb', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}
          >
            {r.doc_type}
          </Link>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{r.id.slice(0, 8)}</div>
        </td>
        <td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontSize: '14px' }}>
          {r.source_lang.toUpperCase()}
        </td>
        <td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>
          <div>{r.contact_name ?? '—'}</div>
          <div style={{ color: '#64748b', fontSize: '12px' }}>{r.contact_email ?? '—'}</div>
        </td>
        <td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b' }}>
          {created}
        </td>
        <td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b' }}>
          {expires}
        </td>
        <td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, ...Object.fromEntries(statusStyle.split(';').filter(Boolean).map(s => s.split(':').map(x => x.trim()) as [string, string])) }}>
            {r.status}
          </span>
        </td>
        <td style={{ padding: '12px 8px', borderBottom: '1px solid #e2e8f0' }}>
          <Link
            href={`/admin/manual-review/${r.id}`}
            style={{ display: 'inline-block', padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: '6px', fontSize: '14px', textDecoration: 'none', fontWeight: 600 }}
          >
            Review →
          </Link>
        </td>
      </tr>
    )
  }

  const sections: { label: string; items: QueueRow[]; accent: string }[] = [
    { label: `Pending (${pending.length})`,     items: pending,   accent: '#dc2626' },
    { label: `In Review (${inReview.length})`,  items: inReview,  accent: '#2563eb' },
    { label: `Completed (${completed.length})`, items: completed, accent: '#059669' },
  ]

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
          Translation Review Queue
        </h1>
        <span style={{ fontSize: '13px', color: '#94a3b8' }}>
          {rows?.length ?? 0} total · Messenginfo Staff
        </span>
      </div>

      {sections.map(({ label, items, accent }) =>
        items.length === 0 ? null : (
          <section key={label} style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: accent, marginBottom: '12px', borderBottom: `2px solid ${accent}`, paddingBottom: '6px' }}>
              {label}
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Document', 'Lang', 'Contact', 'Received', 'Expires', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '8px', textAlign: 'left', fontSize: '12px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(r => <Row key={r.id} r={r} />)}
                </tbody>
              </table>
            </div>
          </section>
        )
      )}

      {(rows?.length ?? 0) === 0 && (
        <p style={{ color: '#64748b', textAlign: 'center', padding: '48px 0' }}>
          No cases in queue. 🎉
        </p>
      )}
    </main>
  )
}
