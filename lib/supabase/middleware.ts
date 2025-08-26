import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { env } from '../env';

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({
            request,
          });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get session ID for anonymous users and pass it to Supabase
  if (!user) {
    const sessionCookie = request.cookies.get('tersa_session');
    if (sessionCookie) {
      // Set session ID in Supabase client headers for RLS policies
      supabaseResponse.headers.set('x-session-id', sessionCookie.value);
    }
  }

  const publicPaths = [
    '/',
    '/pricing',
    '/home',
    '/privacy', 
    '/terms',
    '/acceptable-use',
    '/welcome', // Allow anonymous canvas access
    '/tutorial', // Allow anonymous tutorial access
  ];

  const isProjectPath = request.nextUrl.pathname.startsWith('/projects/');
  const isWelcomePath = request.nextUrl.pathname === '/welcome';

  // For welcome page, ensure session exists
  if (isWelcomePath && !user) {
    // Check if anonymous session exists
    const sessionCookie = request.cookies.get('tersa_session');
    if (!sessionCookie) {
      // Initialize session via API route first
      const url = request.nextUrl.clone();
      url.pathname = '/api/session';
      url.searchParams.set('redirect', '/welcome');
      return NextResponse.redirect(url);
    }
  }

  if (
    !user &&
    !publicPaths.includes(request.nextUrl.pathname) &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/api') &&
    !isProjectPath // Allow anonymous access to projects
  ) {
    // No user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
};
