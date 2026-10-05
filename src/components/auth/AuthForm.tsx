"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { z } from "zod";

import { TurnstileField } from "@/components/auth/TurnstileField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AuthActionResult } from "@/server/auth/actions";

type AuthFormValues = Record<string, string>;
type AuthMode = "login" | "signup" | "forgot" | "reset";

function schemaFor(mode: AuthMode): z.ZodType {
  if (mode === "login") return z.object({ email: z.string().email(), password: z.string(), callbackUrl: z.string().optional(), turnstileToken: z.string().optional() });
  if (mode === "signup") return z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(10), confirmPassword: z.string(), turnstileToken: z.string().optional() });
  if (mode === "forgot") return z.object({ email: z.string().email(), turnstileToken: z.string().optional() });
  return z.object({ token: z.string().min(1), password: z.string().min(10), confirmPassword: z.string(), turnstileToken: z.string().optional() });
}

function copyFor(mode: AuthMode): { title: string; description: string; submit: string } {
  if (mode === "login") return { title: "Welcome back", description: "Sign in to manage your Chawan Farms account.", submit: "Sign in" };
  if (mode === "signup") return { title: "Create your account", description: "Verify your email before booking or earning rewards.", submit: "Create account" };
  if (mode === "forgot") return { title: "Forgot your password?", description: "Enter your email and we’ll send reset instructions if an account exists.", submit: "Send reset link" };
  return { title: "Choose a new password", description: "Use a strong password you have not used elsewhere.", submit: "Reset password" };
}

function errorMessage(errors: FieldErrors<AuthFormValues>, field: string): string | undefined {
  const message = Object.entries(errors).find(([key]) => key === field)?.[1]?.message;
  return typeof message === "string" ? message : undefined;
}

export function AuthForm({ mode, action, defaultValues = {} }: { mode: AuthMode; action: (input: unknown) => Promise<AuthActionResult>; defaultValues?: AuthFormValues }) {
  const [pending, startTransition] = useTransition();
  const [serverMessage, setServerMessage] = useState<string>();
  const [success, setSuccess] = useState(false);
  const schema = schemaFor(mode);
  const { register, handleSubmit, setError, setValue, formState: { errors } } = useForm<AuthFormValues>({
    resolver: (zodResolver as unknown as (schema: z.ZodType<AuthFormValues>) => Resolver<AuthFormValues>)(schema as unknown as z.ZodType<AuthFormValues>),
    defaultValues,
  });
  const onToken = useCallback((token: string | undefined) => {
    setValue("turnstileToken", token ?? "", { shouldValidate: true });
  }, [setValue]);

  const onSubmit = handleSubmit((values) => {
    setServerMessage(undefined);
    setSuccess(false);
    startTransition(async () => {
      const result = await action(values);
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages.at(0);
          if (!message) continue;
          if (field === "name") setError("name", { message });
          if (field === "email") setError("email", { message });
          if (field === "password") setError("password", { message });
          if (field === "confirmPassword") setError("confirmPassword", { message });
          if (field === "token") setError("token", { message });
        }
      }
      setServerMessage(result.message);
      setSuccess(result.ok);
      if (result.ok && result.redirectTo) window.location.assign(result.redirectTo);
    });
  });

  const text = copyFor(mode);
  return (
    <main className="bg-cream-50 flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-forest-900/10 bg-clay-100/70 shadow-xl">
        <CardHeader className="gap-3 p-6 sm:p-8">
          <p className="text-laterite-600 text-xs font-semibold tracking-[0.18em] uppercase">Chawan Farms</p>
          <CardTitle className="font-heading text-3xl text-forest-900">{text.title}</CardTitle>
          <CardDescription>{text.description}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0">
          {success ? <p className="bg-paddy-300/30 text-forest-900 mb-5 rounded-lg p-3 text-sm" role="status">{serverMessage}</p> : null}
          {!success && serverMessage ? <p className="text-laterite-600 mb-5 text-sm" role="alert">{serverMessage}</p> : null}
          <form className="grid gap-4" onSubmit={onSubmit} noValidate>
            {mode === "signup" ? <label className="grid gap-2 text-sm font-semibold">Full name<Input autoComplete="name" aria-invalid={Boolean(errors.name)} {...register("name")} />{errorMessage(errors, "name") ? <span className="text-laterite-600 text-xs">{errorMessage(errors, "name")}</span> : null}</label> : null}
            {mode !== "reset" ? <label className="grid gap-2 text-sm font-semibold">Email<Input type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register("email")} />{errorMessage(errors, "email") ? <span className="text-laterite-600 text-xs">{errorMessage(errors, "email")}</span> : null}</label> : null}
            {mode === "reset" ? <input type="hidden" {...register("token")} /> : null}
            {mode === "login" || mode === "signup" || mode === "reset" ? <label className="grid gap-2 text-sm font-semibold">Password<Input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} aria-invalid={Boolean(errors.password)} {...register("password")} />{errorMessage(errors, "password") ? <span className="text-laterite-600 text-xs">{errorMessage(errors, "password")}</span> : null}</label> : null}
            {mode === "signup" || mode === "reset" ? <label className="grid gap-2 text-sm font-semibold">Confirm password<Input type="password" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />{errorMessage(errors, "confirmPassword") ? <span className="text-laterite-600 text-xs">{errorMessage(errors, "confirmPassword")}</span> : null}</label> : null}
            {mode === "login" && defaultValues.callbackUrl ? <input type="hidden" {...register("callbackUrl")} /> : null}
            <TurnstileField onToken={onToken} />
            <Button type="submit" disabled={pending} className="mt-2 w-full">{pending ? "Please wait…" : text.submit}</Button>
          </form>
          <div className="text-muted-foreground mt-6 flex flex-wrap justify-between gap-3 text-sm">
            {mode === "login" ? <><Link className="underline underline-offset-4" href="/forgot-password">Forgot password?</Link><Link className="underline underline-offset-4" href="/signup">Create account</Link></> : null}
            {mode === "signup" ? <Link className="underline underline-offset-4" href="/login">Already have an account?</Link> : null}
            {mode === "forgot" ? <Link className="underline underline-offset-4" href="/login">Back to sign in</Link> : null}
            {mode === "reset" ? <Link className="underline underline-offset-4" href="/login">Back to sign in</Link> : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
