import { NextRequest, NextResponse } from 'next/server';

const PORTAL_PASSWORD = process.env.PORTAL_PASSWORD;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect the portal pages and mutation APIs
  const isPortalPage = pathname.startsWith('/queue') || pathname.startsWith('/schedule');
  // GET /api/publish is the cron trigger — exempt from auth
  const isCronEndpoint = pathname === '/api/publish' && req.method === 'GET';
  if (isCronEndpoint) return NextResponse.next();

  const isMutationAPI = pathname.startsWith('/api/approve') ||
    pathname.startsWith('/api/video-approve') ||
    pathname.startsWith('/api/render') ||
    pathname.startsWith('/api/generate') ||
    pathname.startsWith('/api/schedule') ||
    pathname.startsWith('/api/publish');

  if (!PORTAL_PASSWORD) return NextResponse.next(); // no password set = dev mode

  if (isPortalPage || isMutationAPI) {
    // Check session cookie
    const auth = req.cookies.get('portal_auth')?.value;
    if (auth === PORTAL_PASSWORD) return NextResponse.next();

    // For API calls, check Authorization header
    if (isMutationAPI) {
      const header = req.headers.get('authorization');
      if (header === `Bearer ${PORTAL_PASSWORD}`) return NextResponse.next();
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Redirect to login for page requests
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/queue/:path*', '/schedule/:path*', '/api/approve/:path*', '/api/video-approve/:path*', '/api/render/:path*', '/api/generate/:path*', '/api/schedule/:path*', '/api/publish/:path*'],
};
