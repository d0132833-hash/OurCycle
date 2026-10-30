import { NextRequest, NextResponse } from 'next/server'
import { signSessionEdge, verifySessionEdge, type SessionPayload } from '@/lib/session-edge'

const SESSION_COOKIE = 'oc_session'
const TTL = 60 * 60 * 24 * 30
const PUBLIC_PAGE = /^\/(login|setup|offline)(\/|$)/
const PUBLIC_API = /^\/api\/auth\/(setup|login)\/?$/

function devSecret(): string {
  return process.env.SESSION_SECRET || (process.env.NODE_ENV !== 'production' ? 'our-cycle-dev-only-secret-change-me' : '')
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const secret = devSecret()
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const payload: SessionPayload | null = secret && token ? await verifySessionEdge(token, secret) : null

  let res: NextResponse

  if (!payload && !PUBLIC_PAGE.test(pathname) && !PUBLIC_API.test(pathname)) {
    if (pathname.startsWith('/api/')) {
      res = NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    } else {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      res = NextResponse.redirect(url)
    }
  } else {
    // /login and /setup are epoch-aware server pages: they bounce
    // fully-valid sessions to / and show the form for stale ones,
    // so a cookie from before a vault rotation can never loop here.
    res = NextResponse.next()
  }

  // Privacy: no search-engine indexing anywhere (header + meta + robots.txt)
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')

  // 30-day sliding refresh: re-issue the cookie when it is older than 7 days
  if (payload && secret && Math.floor(Date.now() / 1000) - payload.iat > 7 * 86400) {
    const now = Math.floor(Date.now() / 1000)
    const fresh = await signSessionEdge({ ...payload, iat: now, exp: now + TTL }, secret)
    res.cookies.set(SESSION_COOKIE, fresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: TTL,
    })
  }

  return res
}

export default proxy

export const config = {
  // everything except immutable assets; data routes stay guarded
  matcher: [
    '/((?!_next/static|_next/image|icons/|sw.js|manifest.webmanifest|robots.txt|sitemap.xml|favicon.ico|apple-touch-icon.png).*)',
  ],
}
