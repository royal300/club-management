import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ClubMark, Clubhouse } from "@/components/illustrations";
import { LoginForm, LoginFormFallback } from "@/components/auth/login-form";
import { getSessionUser } from "@/server/auth";
import { getClubSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Sign in" };

async function RedirectIfSignedIn() {
  if (await getSessionUser()) redirect("/dashboard");
  return null;
}

export default async function LoginPage() {
  const club = await getClubSettings();
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <section className="paper-grain relative flex flex-col justify-between overflow-hidden bg-felt px-6 py-8 text-paper sm:px-10 lg:px-14 lg:py-12">
        <Link href="/" className="flex items-center gap-2.5 text-paper/90 hover:text-paper">
          <ClubMark className="size-8" />
          <span className="font-display text-xl">{club.club_name}</span>
        </Link>
        <div className="relative mx-auto my-8 w-full max-w-md lg:my-0">
          <div className="absolute inset-x-6 bottom-6 top-1/3 rounded-full bg-brass/25 blur-3xl" />
          <Clubhouse className="login-clubhouse relative w-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.35)]" />
        </div>
        <div className="space-y-3">
          <h1 className="font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.92] tracking-tight text-balance">
            The doors are <em className="font-display-wonk text-brass-soft">open</em>.
          </h1>
          <p className="max-w-md text-paper/70">{club.club_tagline}</p>
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Members&rsquo; desk</p>
          <h2 className="mb-8 font-display text-4xl tracking-tight">Sign in to the ledger</h2>
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
          <p className="mt-8 text-sm text-muted-foreground">
            Accounts are created by the club admin. Forgot your password? Ask an admin to reset it.
          </p>
        </div>
      </section>
    </main>
  );
}
