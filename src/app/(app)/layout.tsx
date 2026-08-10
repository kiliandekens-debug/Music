import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DataProvider } from "@/lib/store/data";
import { AppShell } from "@/components/layout/app-shell";
import type { Profile } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <DataProvider
      userId={user.id}
      userEmail={user.email ?? null}
      initialProfile={(profile as Profile | null) ?? null}
    >
      <AppShell>{children}</AppShell>
    </DataProvider>
  );
}
