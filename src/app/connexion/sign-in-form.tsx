"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { Button, Field, Input } from "@/components/ui";
import { IconMusic } from "@/components/ui/icons";

type Step = "email" | "code" | "motdepasse";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("suivant") ?? "/aujourdhui";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const configured = supabaseConfigured();

  /*
   * Un lien de connexion peut échouer côté serveur : le message revient alors
   * dans l'URL. Sans traduction, l'utilisateur retombe sur le formulaire sans
   * la moindre explication. Les deux causes courantes méritent une consigne
   * concrète plutôt que le texte brut de Supabase.
   */
  const linkError = params.get("erreur");
  const linkErrorMessage = (() => {
    if (!linkError) return null;
    if (/code verifier|different browser|different device/i.test(linkError)) {
      return (
        "Ce lien a été demandé depuis un autre appareil ou un autre navigateur. " +
        "Demandez-en un nouveau ici même, ou saisissez le code à 6 chiffres reçu par e-mail."
      );
    }
    if (/expired|invalid|lien_invalide/i.test(linkError)) {
      return "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.";
    }
    return `La connexion a échoué : ${linkError}`;
  })();

  /**
   * Les erreurs de Supabase reviennent en anglais et sans piste d'action.
   * On les traduit et on oriente vers la solution, la limite d'envoi étant
   * vite atteinte sur le plan gratuit.
   */
  function translateAuthError(message: string): string {
    if (/rate limit|too many requests/i.test(message)) {
      return (
        "Trop d'e-mails demandés en peu de temps : Supabase bloque les envois pendant " +
        "un moment. Connectez-vous plutôt avec un mot de passe, ou réessayez dans une heure."
      );
    }
    if (/only request this after (\d+) seconds?/i.test(message)) {
      const seconds = message.match(/after (\d+) seconds?/i)?.[1] ?? "quelques";
      return `Un e-mail vient d'être envoyé. Patientez ${seconds} secondes avant d'en redemander un.`;
    }
    if (/signups? not allowed|signup is disabled/i.test(message)) {
      return (
        "Les inscriptions sont désactivées sur ce projet. Créez le compte depuis le tableau " +
        "de bord Supabase (Authentication → Users), puis connectez-vous avec un mot de passe."
      );
    }
    if (/invalid email|unable to validate email/i.test(message)) {
      return "Cette adresse e-mail ne semble pas valide.";
    }
    if (/error sending|smtp/i.test(message)) {
      return "L'e-mail n'a pas pu être envoyé. Connectez-vous avec un mot de passe en attendant.";
    }
    return message;
  }

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // L'origine du navigateur est toujours la bonne : localhost en
      // développement, le domaine de production, ou l'URL d'un déploiement de
      // prévisualisation. Une variable d'environnement figée se tromperait dès
      // qu'on change d'environnement.
      const { error: otpError } = await getSupabase().auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?suivant=${encodeURIComponent(nextPath)}`,
        },
      });
      if (otpError) throw otpError;
      setSent(true);
      setStep("code");
    } catch (e) {
      setError(translateAuthError(e instanceof Error ? e.message : "Envoi impossible"));
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

  /*
   * Connexion par mot de passe.
   *
   * Elle ne dépend d'aucun e-mail ni d'aucune URL de redirection : c'est la
   * voie la plus sûre depuis un téléphone, où les liens de connexion se
   * heurtent facilement à la configuration du projet.
   */
  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: passwordError } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (passwordError) throw passwordError;
      router.replace(nextPath);
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Connexion impossible";
      setError(
        /invalid login credentials/i.test(message)
          ? "Adresse e-mail ou mot de passe incorrect. Si vous n'avez pas encore défini de mot de passe, connectez-vous par e-mail puis faites-le dans Paramètres → Compte."
          : /email not confirmed/i.test(message)
            ? "Cette adresse n'est pas encore confirmée. Connectez-vous une première fois par e-mail."
            : message,
      );
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
          {linkErrorMessage ? (
            <p className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-[13px] leading-relaxed text-warn">
              {linkErrorMessage}
            </p>
          ) : null}
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
          {error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-[13px] leading-relaxed text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
            Recevoir le lien de connexion
          </Button>
          <p className="text-center text-[12px] leading-relaxed text-faint">
            Un lien de connexion vous est envoyé par e-mail. Ouvrez-le sur cet appareil.
          </p>
          <button
            type="button"
            className="w-full border-t border-line pt-3 text-center text-[13px] text-muted hover:text-ink"
            onClick={() => {
              setStep("motdepasse");
              setError(null);
            }}
          >
            Se connecter avec un mot de passe
          </button>
        </form>
      ) : step === "motdepasse" ? (
        <form onSubmit={signInWithPassword} className="card space-y-4 p-5">
          {linkErrorMessage ? (
            <p className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-[13px] leading-relaxed text-warn">
              {linkErrorMessage}
            </p>
          ) : null}
          <Field label="Adresse e-mail" htmlFor="email-mdp">
            <Input
              id="email-mdp"
              type="email"
              required
              autoComplete="email"
              autoFocus
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Mot de passe" htmlFor="motdepasse">
            <Input
              id="motdepasse"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error ? <p className="text-[13px] leading-relaxed text-danger">{error}</p> : null}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={busy}
            disabled={!email.trim() || password.length === 0}
          >
            Se connecter
          </Button>
          <button
            type="button"
            className="w-full border-t border-line pt-3 text-center text-[13px] text-muted hover:text-ink"
            onClick={() => {
              setStep("email");
              setError(null);
            }}
          >
            Recevoir plutôt un lien par e-mail
          </button>
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
