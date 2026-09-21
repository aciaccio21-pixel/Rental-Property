import { redirect } from "next/navigation";
import { Building2, LockKeyhole } from "lucide-react";

import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getSession()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border bg-white p-7 shadow-[0_24px_70px_rgba(23,63,95,.14)] sm:p-9">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[#f0b84b] text-[#173f5f]">
            <Building2 className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-[-.025em] text-[#173f5f]">Rental Steward</h1>
            <p className="text-sm text-muted-foreground">Private property dashboard</p>
          </div>
        </div>

        <div className="my-7 flex items-center gap-3 rounded-2xl bg-[#eef4f8] p-4 text-[#173f5f]">
          <LockKeyhole className="size-5 shrink-0" />
          <p className="text-sm font-medium">Sign in to view financial and tenant information.</p>
        </div>

        <form action="/api/auth/login" method="post" className="space-y-4">
          <label className="block space-y-2 text-sm font-semibold text-[#25384a]">
            Username
            <input name="username" autoComplete="username" required className="h-11 w-full rounded-xl border bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-[#d89b22]" />
          </label>
          <label className="block space-y-2 text-sm font-semibold text-[#25384a]">
            Password
            <input name="password" type="password" autoComplete="current-password" required className="h-11 w-full rounded-xl border bg-white px-3 font-normal outline-none focus:ring-2 focus:ring-[#d89b22]" />
          </label>
          {error ? (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              The username or password was incorrect.
            </p>
          ) : null}
          <button className="h-11 w-full rounded-xl bg-[#173f5f] font-semibold text-white transition hover:bg-[#102f47]">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
