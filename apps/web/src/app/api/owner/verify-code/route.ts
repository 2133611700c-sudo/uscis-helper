import { NextRequest, NextResponse } from 'next/server'
import { verifyCode, setOwnerSessionCookie } from '@/lib/ownerAccess'

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()
    if (!email || !code || typeof email !== 'string' || typeof code !== 'string') {
      return NextResponse.json({ error: 'Email and code required' }, { status: 400 })
    }

    if (!verifyCode(email, code)) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
    }

    await setOwnerSessionCookie(email)
    console.log(`[owner] Session created (no PII logged)`)

    return NextResponse.json({ ok: true, message: 'Owner session active. Valid for 24 hours.' })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
