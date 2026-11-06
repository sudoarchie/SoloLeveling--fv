import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function createRouteMatcher(routes: string[]) {
  return (request: NextRequest) => {
    const { pathname } = request.nextUrl
    return routes.some((route) => {
      // Match the route prefix, e.g. '/signin(.*)' matches '/signin' and '/signin/anything'
      const base = route.replace(/\(\.\*\)$/, '')
      return pathname === base || pathname.startsWith(base)
    })
  }
}

const isPublicRoute = createRouteMatcher([
  '/signin',
  '/sign-up',
  '/auth/callback',
  '/auth/confirm',
  '/forgot-password',
  '/reset-password',
])

/**
 * Refreshes the Supabase auth session by refreshing expired tokens,
 * forwarding any updated cookies onto the response, and protecting
 * non-public routes by redirecting unauthenticated users to /signin.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Allow PWA assets and offline fallback to be served without auth interception
  if (
    pathname === '/manifest.json' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/icons/')
  ) {
    return NextResponse.next()
  }

  // The admin API validates its own Bearer key before parsing any request body.
  if (pathname.startsWith("/api/admin/")) return NextResponse.next()

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    // Supabase auth service unreachable (offline)
  }

  // Check if browser has Supabase auth session cookies
  const hasAuthCookies = request.cookies.getAll().some((c) => c.name.includes("-auth-token"))

  // Redirect unauthenticated users away from protected routes
  // If user has auth cookies, allow through even if Supabase is unreachable (offline mode)
  if (!user && !hasAuthCookies && !isPublicRoute(request)) {
    const url = request.nextUrl.clone()
    url.pathname = '/signin'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if ((user || hasAuthCookies) && isPublicRoute(request)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
