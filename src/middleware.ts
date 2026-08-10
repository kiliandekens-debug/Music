import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/connexion", "/auth"];

/**
 * Rafraîchit la session Supabase à chaque requête et protège les pages de
 * l'application. Si la configuration Supabase est absente, on laisse passer
 * la requête : l'écran de connexion affichera alors les instructions.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/connexion";
    redirect.searchParams.set("suivant", path);
    return NextResponse.redirect(redirect);
  }

  if (user && path === "/connexion") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/aujourdhui";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf les fichiers statiques, l'icône, le manifeste
     * et le service worker.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
