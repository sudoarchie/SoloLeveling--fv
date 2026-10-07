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

  // IMPORTANT: do not run code between createServerClient and
  // supabase.auth.getUser(). This refreshes the session if expired.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Redirect unauthenticated users away from protected routes
  // (the root dashboard at / is protected too)
  if (!user && !isPublicRoute(request)) {
    const url = request.nextUrl.clone()
    url.pathname = '/signin'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && isPublicRoute(request)) {
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
