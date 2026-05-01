import { supabase } from './lib/supabase-client'
import { sha256 } from './lib/hash'

type RssItem = {
  title: string
  link: string
  pubDate: string
  guid: string
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = []
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
  for (const block of blocks) {
    const body = block[1]
    const get = (tag: string) =>
      decodeXml((body.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] || '').trim())
    const title = get('title')
    const link = get('link')
    const pubDate = get('pubDate')
    const guid = get('guid') || link
    if (title && link) {
      items.push({ title, link, pubDate, guid })
    }
  }
  return items
}

async function main(): Promise<void> {
  const { data: source, error: sourceError } = await supabase
    .from('monitoring_sources')
    .select('id,url,content_hash')
    .eq('source_type', 'uscis_rss')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (sourceError) throw sourceError
  if (!source) {
    console.log('No active uscis_rss source found; nothing to monitor.')
    return
  }

  const response = await fetch(source.url, { headers: { Accept: 'application/rss+xml, application/xml' } })
  if (!response.ok) {
    throw new Error(`USCIS RSS fetch failed: ${response.status}`)
  }
  const xml = await response.text()
  const items = parseRssItems(xml)
  if (!items.length) {
    console.log('USCIS RSS contains no items.')
    return
  }

  const feedHash = sha256(items.slice(0, 20).map((i) => `${i.guid}|${i.title}|${i.pubDate}`).join('\n'))
  if (feedHash !== source.content_hash) {
    const { error: updateErr } = await supabase
      .from('monitoring_sources')
      .update({ content_hash: feedHash, last_checked_at: new Date().toISOString(), last_changed_at: new Date().toISOString() })
      .eq('id', source.id)
    if (updateErr) throw updateErr
  } else {
    await supabase.from('monitoring_sources').update({ last_checked_at: new Date().toISOString() }).eq('id', source.id)
  }

  const links = items.map((i) => i.link)
  const { data: existingAlerts, error: existingErr } = await supabase
    .from('monitoring_alerts')
    .select('source_url')
    .in('source_url', links)
    .eq('alert_type', 'new_item')

  if (existingErr) throw existingErr
  const seen = new Set(((existingAlerts || []) as Array<{ source_url: string | null }>).map((a) => a.source_url))

  const fresh = items.filter((i) => !seen.has(i.link))
  for (const item of fresh) {
    const { error } = await supabase.from('monitoring_alerts').insert({
      source_id: source.id,
      alert_type: 'new_item',
      severity: 'info',
      title: item.title,
      description: `USCIS RSS item published: ${item.pubDate || 'date unknown'}`,
      source_url: item.link,
    })
    if (error) throw error
  }

  console.log(`USCIS monitor done. New items inserted: ${fresh.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
