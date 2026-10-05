import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = ["/login", "/cadastro", "/recuperar-senha", "/redefinir-senha"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: any) {
        cookiesToSet.forEach(({ name, value }: any) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }: any) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isPublic = publicPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!data?.claims && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (data?.claims && isPublic && request.nextUrl.pathname !== "/redefinir-senha") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
