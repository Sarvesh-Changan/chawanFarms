import "server-only";

import { render } from "@react-email/render";
import { createElement } from "react";
import { Resend } from "resend";

import { env } from "@/config/env";
import { ResetPasswordEmail } from "@/server/email/templates/ResetPasswordEmail";
import { StaffInviteEmail } from "@/server/email/templates/StaffInviteEmail";
import { VerifyEmailEmail } from "@/server/email/templates/VerifyEmailEmail";

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    for (const key of ["token", "callbackURL"]) url.searchParams.set(key, "[redacted]");
    return url.toString();
  } catch {
    return "[redacted]";
  }
}

function maskEmail(value: string): string {
  const [local, domain] = value.split("@");
  if (!local || !domain) return "[redacted email]";
  return `${local.slice(0, 1)}***@${domain}`;
}

async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  link: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (env.APP_ENV === "development") {
      console.info(`[email] ${input.subject} to ${maskEmail(input.to)}: ${redactUrl(input.link)}`);
      return;
    }
    throw new Error("Email delivery is not configured.");
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: [input.to],
    subject: input.subject,
    html: input.html,
  });
  if (error) throw new Error("Email delivery failed.");
}

export async function sendVerificationEmail(input: {
  to: string;
  name: string;
  url: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Verify your Chawan Farms email",
    html: await render(createElement(VerifyEmailEmail, { name: input.name, url: input.url })),
    link: input.url,
  });
}

export async function sendResetPasswordEmail(input: {
  to: string;
  name: string;
  url: string;
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "Reset your Chawan Farms password",
    html: await render(createElement(ResetPasswordEmail, { name: input.name, url: input.url })),
    link: input.url,
  });
}

export async function sendStaffInviteEmail(input: { to: string; url: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: "You are invited to Chawan Farms",
    html: await render(createElement(StaffInviteEmail, { url: input.url })),
    link: input.url,
  });
}
