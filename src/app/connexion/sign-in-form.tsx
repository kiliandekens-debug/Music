"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { Button, Field, Input } from "@/components/ui";
import { IconMusic } from "@/components/ui/icons";

type Step = "email" | "code";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("suivant") ?? "/aujourdhui";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const configured = supabaseConfigured();

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? window.location.origin;
      const { error: otpError } = await getSupabase().auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback?suivant=${encodeURIComponent(nextPath)}`,
        },
      });
      if (otpError) throw otpError;
      setSent(true);
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await getSupabase().auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (verifyError) throw verifyError;
      router.replace(nextPath);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Code invalide");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-accent">
          <IconMusic size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-muted">{APP_TAGLINE}</p>
        </div>
      </div>

      {!configured ? (
        <div className="card space-y-3 p-5 text-sm leading-relaxed text-ink-soft">
          <p className="font-medium text-ink">Configuration requise</p>
          <p className="text-muted">
            Créez un fichier <code className="text-accent-ink">.env.local</code> à partir de{" "}
            <code className="text-accent-ink">.env.example</code>, puis renseignez l&apos;URL et la
            clé anonyme de votre projet Supabase. Relancez ensuite le serveur.
          </p>
        </div>
      ) : step === "email" ? (
        <form onSubmit={sendLink} className="card space-y-4 p-5">
          <Field label="Adresse e-mail" htmlFor="email">
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
            Recevoir le lien de connexion
          </Button>
          <p className="text-center text-[12px] leading-relaxed text-faint">
            Un lien de connexion vous est envoyé par e-mail. Aucun mot de passe à retenir.
          </p>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="card space-y-4 p-5">
          {sent ? (
            <p className="rounded-lg border border-ok/25 bg-ok/10 px-3 py-2.5 text-[13px] text-ok">
              Lien envoyé à {email}. Ouvrez-le sur cet appareil, ou saisissez le code reçu.
            </p>
          ) : null}
          <Field
            label="Code reçu par e-mail"
            hint="Uniquement si votre modèle d'e-mail contient un code à 6 chiffres."
            htmlFor="code"
          >
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={busy}
            disabled={code.trim().length < 6}
          >
            Se connecter
          </Button>
          <button
            type="button"
            className="w-full text-center text-[13px] text-muted hover:text-ink"
            onClick={() => {
              setStep("email");
              setError(null);
            }}
          >
            Utiliser une autre adresse
          </button>
        </form>
      )}
    </div>
  );
}
