import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,oklch(0.92_0.06_225),transparent_45%),radial-gradient(circle_at_90%_0%,oklch(0.96_0.03_70),transparent_30%)]" />
      <section className="animate-fade-up w-full max-w-md space-y-5 rounded-3xl border border-border/60 bg-background/80 p-6 shadow-sm backdrop-blur sm:p-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            Sales Gen
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Admin Login
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to manage clients and export activity.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
