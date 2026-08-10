import { Suspense } from "react";
import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Connexion" };

export default function ConnexionPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
