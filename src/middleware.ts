import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const role = token?.role as string;

    // /admin/* requires staff or director
    if (pathname.startsWith('/admin')) {
      if (role !== 'staff' && role !== 'director') {
        return NextResponse.redirect(new URL('/?error=unauthorized', req.url));
      }
    }

    // /tickets requires any authenticated user (student, staff, director)
    // Already enforced by authorized callback below

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Admin routes — must be logged in (role check is in middleware above)
        if (pathname.startsWith('/admin')) return !!token;

        // Tickets — must be logged in (any role)
        if (pathname.startsWith('/tickets')) return !!token;

        // Everything else is public (/, /help/*, /api/chat, /api/search)
        return true;
      },
    },
  },
);

export const config = {
  matcher: ['/admin/:path*', '/tickets/:path*'],
};
