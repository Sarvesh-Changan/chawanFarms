"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AuthActionResult } from "@/server/auth/actions";

const adminLoginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  callbackUrl: z.string().optional(),
});

type AdminLoginValues = z.infer<typeof adminLoginSchema>;

type AdminLoginFormProps = {
  adminAction: (input: unknown) => Promise<AuthActionResult>;
  defaultValues?: { callbackUrl?: string };
  isInactivityTimeout?: boolean;
};

export function AdminLoginForm({
  adminAction,
  defaultValues = {},
  isInactivityTimeout = false,
}: AdminLoginFormProps) {
  const [pending, startTransition] = useTransition();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AdminLoginValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      email: "",
      password: "",
      callbackUrl: defaultValues.callbackUrl || "/admin",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerMessage(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await adminAction(values);
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages.at(0);
          if (!message) continue;
          if (field === "email") setError("email", { message });
          if (field === "password") setError("password", { message });
        }
      }
      setServerMessage(result.message ?? null);
      setSuccess(result.ok);
      if (result.ok && result.redirectTo) {
        window.location.assign(result.redirectTo);
      }
    });
  });

  return (
    <main className="bg-cream-50 flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-4">
        {isInactivityTimeout && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm"
          >
            <div className="flex items-center gap-2 font-medium">
              <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path strokeWidth="2" d="M12 6v6l4 2" />
              </svg>
              Session timed out
            </div>
            <p className="mt-1 text-xs text-amber-800">
              You were signed out due to 30 minutes of inactivity. Please sign in again to continue.
            </p>
          </div>
        )}

        <Card className="border-forest-900/10 bg-clay-100/70 shadow-xl">
          <CardHeader className="gap-3 p-6 sm:p-8">
            <div className="flex flex-col items-center gap-3">
              <p className="text-laterite-600 text-xs font-semibold tracking-[0.18em] uppercase">
                Chawan Farms
              </p>
            </div>
            <CardTitle className="font-heading text-center text-2xl text-forest-900 sm:text-3xl">
              Admin Login
            </CardTitle>
            <CardDescription className="text-center">
              Sign in with your staff email and password.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
            {success && serverMessage ? (
              <p className="mb-4 rounded-lg bg-paddy-300/30 p-3 text-sm text-forest-900" role="status">
                {serverMessage}
              </p>
            ) : null}

            {!success && serverMessage ? (
              <p className="mb-4 text-sm text-laterite-600" role="alert">
                {serverMessage}
              </p>
            ) : null}

            <form className="grid gap-4" onSubmit={onSubmit} noValidate>
              <label className="grid gap-2 text-sm font-semibold text-forest-900">
                Staff email
                <Input
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  {...register("email")}
                />
                {errors.email?.message ? (
                  <span className="text-xs text-laterite-600">{errors.email.message}</span>
                ) : null}
              </label>

              <label className="grid gap-2 text-sm font-semibold text-forest-900">
                Password
                <Input
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  {...register("password")}
                />
                {errors.password?.message ? (
                  <span className="text-xs text-laterite-600">{errors.password.message}</span>
                ) : null}
              </label>

              <input type="hidden" {...register("callbackUrl")} />

              <Button type="submit" disabled={pending} className="mt-2 w-full">
                {pending ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="mt-4 flex justify-end text-sm">
              <Link
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-forest-900"
                href="/forgot-password?role=admin"
              >
                Forgot password?
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

