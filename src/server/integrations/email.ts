import "server-only";

import { randomUUID } from "node:crypto";

import { render } from "@react-email/render";
import nodemailer, { type Transporter } from "nodemailer";
import { createElement, type ReactElement } from "react";
import { z } from "zod";

import {
  EMAIL_DAILY_LIMIT,
  EMAIL_DAILY_WINDOW_SECONDS,
  EMAIL_MAX_RECIPIENTS_PER_MESSAGE,
  EMAIL_OPTIONAL_LIMIT,
} from "@/config/email";
import { env } from "@/config/env";
import { LeadAcknowledgementEmail } from "@/server/email/templates/LeadAcknowledgementEmail";
import { LeadAdminAlertEmail } from "@/server/email/templates/LeadAdminAlertEmail";
import { ResetPasswordEmail } from "@/server/email/templates/ResetPasswordEmail";
import { StaffInviteEmail } from "@/server/email/templates/StaffInviteEmail";
import { VerifyEmailEmail } from "@/server/email/templates/VerifyEmailEmail";
import { limitCapped, type RateLimitResult } from "@/server/integrations/ratelimit";

const emailAddressSchema = z.string().trim().max(320).email();

export type EmailErrorCode =
  | "INVALID_RECIPIENT"
  | "TOO_MANY_RECIPIENTS"
  | "EMAIL_NOT_CONFIGURED"
  | "EMAIL_QUOTA_EXCEEDED"
  | "EMAIL_QUOTA_UNAVAILABLE"
  | "TEMPLATE_RENDER_FAILED"
  | "SMTP_TEMPORARY"
  | "SMTP_SEND_FAILED";

export type EmailSendResult =
  | { ok: true; messageId: string }
  | { ok: false; code: EmailErrorCode };

export type EmailMessage = {
  type: string;
  to: string[];
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
};

export interface EmailTransport {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

type EmailSendInput = {
  type: string;
  to: string | string[];
  subject: string;
  element: ReactElement;
  transactional: boolean;
};

type EmailQuotaLimiter = (
  key: string,
  max: number,
  windowSeconds: number,
) => Promise<RateLimitResult>;

function stripHeaderInjection(value: string): string {
  return value.replace(/[\r\n]/g, "").trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function recipientDomain(value: string): string {
  const at = value.lastIndexOf("@");
  return at > 0 ? value.slice(at + 1).toLowerCase() : "invalid";
}

function safeRecipients(input: string | string[]): { recipients?: string[]; code?: EmailErrorCode } {
  const values = Array.isArray(input) ? input : [input];
  if (values.length === 0 || values.length > EMAIL_MAX_RECIPIENTS_PER_MESSAGE) {
    return { code: "TOO_MANY_RECIPIENTS" };
  }
  const recipients = values.map(stripHeaderInjection);
  const parsed = z.array(emailAddressSchema).max(EMAIL_MAX_RECIPIENTS_PER_MESSAGE).safeParse(recipients);
  return parsed.success ? { recipients: parsed.data } : { code: "INVALID_RECIPIENT" };
}

function configuredForSmtp(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.EMAIL_FROM);
}

function senderAddress(): string {
  return env.EMAIL_FROM ?? env.SMTP_USER ?? "no-reply@localhost.invalid";
}

function senderHeader(): string {
  const name = stripHeaderInjection(env.EMAIL_FROM_NAME ?? "Chawan Farms");
  return `${name} <${senderAddress()}>`;
}

function dateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function logResult(type: string, recipients: string[], result: EmailSendResult): void {
  const payload = {
    type,
    recipientDomain: [...new Set(recipients.map(recipientDomain))],
    result: result.ok ? "sent" : result.code,
    messageId: result.ok ? result.messageId : null,
  };
  if (result.ok) console.info("[email]", payload);
  else console.warn("[email]", payload);
}

async function renderTemplate(element: ReactElement): Promise<{ html: string; text: string }> {
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text };
}

function rawHtmlTemplate(html: string): ReactElement {
  return createElement("div", { dangerouslySetInnerHTML: { __html: html } });
}

export class ConsoleEmailTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<EmailSendResult> {
    const result = { ok: true as const, messageId: `console-${randomUUID()}` };
    logResult(message.type, message.to, result);
    return result;
  }
}

export class InMemoryEmailTransport implements EmailTransport {
  readonly messages: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.messages.push(message);
    const result = { ok: true as const, messageId: `memory-${randomUUID()}` };
    logResult(message.type, message.to, result);
    return result;
  }
}

export class SmtpEmailTransport implements EmailTransport {
  private transporter: Transporter | undefined;

  private getTransporter(): Transporter | null {
    if (!configuredForSmtp() || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS) return null;
    this.transporter ??= nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
      requireTLS: env.SMTP_PORT === 587,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
      pool: false,
    });
    return this.transporter;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) return { ok: false, code: "EMAIL_NOT_CONFIGURED" };
    try {
      const info = await transporter.sendMail({
        from: message.from,
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      return { ok: true, messageId: String(info.messageId ?? "smtp-accepted") };
    } catch (error) {
      const smtpError = error as { code?: string; responseCode?: number; statusCode?: number };
      const temporaryCodes = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNECTION", "ESOCKET", "ETLS", "EAI_AGAIN"]);
      const responseCode = smtpError.responseCode ?? smtpError.statusCode;
      return {
        ok: false,
        code: (typeof responseCode === "number" && responseCode >= 400 && responseCode < 500) || temporaryCodes.has(smtpError.code ?? "")
          ? "SMTP_TEMPORARY"
          : "SMTP_SEND_FAILED",
      };
    }
  }
}

let transportOverride: EmailTransport | undefined;
let quotaLimiter: EmailQuotaLimiter = limitCapped;
let smtpTransport: SmtpEmailTransport | undefined;

export function setEmailTransportForTests(transport?: EmailTransport): void {
  transportOverride = transport;
  smtpTransport = undefined;
}

export function setEmailQuotaLimiterForTests(limiter?: EmailQuotaLimiter): void {
  quotaLimiter = limiter ?? limitCapped;
}

export function getEmailQuotaLimits(): { daily: number; transactional: number; optional: number } {
  return {
    daily: EMAIL_DAILY_LIMIT,
    transactional: EMAIL_DAILY_LIMIT,
    optional: EMAIL_OPTIONAL_LIMIT,
  };
}

function getTransport(): EmailTransport {
  if (transportOverride) return transportOverride;
  if (!configuredForSmtp()) return new ConsoleEmailTransport();
  smtpTransport ??= new SmtpEmailTransport();
  return smtpTransport;
}

async function reserveQuota(transactional: boolean): Promise<EmailSendResult | null> {
  try {
    const result = await quotaLimiter(
      `email:daily:${dateKey()}`,
      transactional ? EMAIL_DAILY_LIMIT : EMAIL_OPTIONAL_LIMIT,
      EMAIL_DAILY_WINDOW_SECONDS,
    );
    return result.allowed ? null : { ok: false, code: "EMAIL_QUOTA_EXCEEDED" };
  } catch {
    return { ok: false, code: "EMAIL_QUOTA_UNAVAILABLE" };
  }
}

async function sendEmail(input: EmailSendInput): Promise<EmailSendResult> {
  const parsedRecipients = safeRecipients(input.to);
  const recipients = parsedRecipients.recipients ?? (Array.isArray(input.to) ? input.to : [input.to]).map(stripHeaderInjection);
  if (!parsedRecipients.recipients) {
    const result: EmailSendResult = { ok: false, code: parsedRecipients.code ?? "INVALID_RECIPIENT" };
    logResult(input.type, recipients, result);
    return result;
  }
  let rendered: { html: string; text: string };
  try {
    rendered = await renderTemplate(input.element);
  } catch {
    const result: EmailSendResult = { ok: false, code: "TEMPLATE_RENDER_FAILED" };
    logResult(input.type, recipients, result);
    return result;
  }

  return sendEmailMessage({
    type: input.type,
    to: recipients,
    subject: input.subject,
    html: rendered.html,
    text: rendered.text,
    transactional: input.transactional,
  });
}

/** Sends an already-rendered message through the same validated, quota-aware transport. */
export async function sendEmailMessage(input: {
  type: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  transactional: boolean;
}): Promise<EmailSendResult> {
  const parsedRecipients = safeRecipients(input.to);
  const recipients = parsedRecipients.recipients ?? (Array.isArray(input.to) ? input.to : [input.to]).map(stripHeaderInjection);
  if (!parsedRecipients.recipients) {
    const result: EmailSendResult = { ok: false, code: parsedRecipients.code ?? "INVALID_RECIPIENT" };
    logResult(input.type, recipients, result);
    return result;
  }

  const quotaResult = await reserveQuota(input.transactional);
  if (quotaResult) {
    logResult(input.type, recipients, quotaResult);
    return quotaResult;
  }

  const message: EmailMessage = {
    type: stripHeaderInjection(input.type),
    to: recipients,
    from: senderHeader(),
    replyTo: env.EMAIL_REPLY_TO,
    subject: stripHeaderInjection(input.subject),
    html: input.html,
    text: input.text,
  };

  let result: EmailSendResult;
  const transport = getTransport();
  try {
    result = await transport.send(message);
  } catch {
    result = { ok: false, code: "SMTP_SEND_FAILED" };
  }
  if (!(transport instanceof ConsoleEmailTransport) && !(transport instanceof InMemoryEmailTransport)) {
    logResult(input.type, recipients, result);
  }
  return result;
}

async function sendRenderedEmail(input: EmailSendInput): Promise<void> {
  await sendEmail(input);
}

export async function sendVerificationEmail(input: { to: string; name: string; url: string }): Promise<void> {
  await sendRenderedEmail({
    type: "verification",
    to: input.to,
    subject: "Verify your Chawan Farms email",
    element: createElement(VerifyEmailEmail, { name: stripHeaderInjection(input.name), url: input.url }),
    transactional: true,
  });
}

export async function sendResetPasswordEmail(input: { to: string; name: string; url: string }): Promise<void> {
  await sendRenderedEmail({
    type: "password-reset",
    to: input.to,
    subject: "Reset your Chawan Farms password",
    element: createElement(ResetPasswordEmail, { name: stripHeaderInjection(input.name), url: input.url }),
    transactional: true,
  });
}

export async function sendStaffInviteEmail(input: { to: string; url: string }): Promise<void> {
  await sendRenderedEmail({
    type: "staff-invite",
    to: input.to,
    subject: "You are invited to Chawan Farms",
    element: createElement(StaffInviteEmail, { url: input.url }),
    transactional: true,
  });
}

export async function sendLeadAcknowledgementEmail(input: { to: string; name: string; reference: string }): Promise<void> {
  await sendRenderedEmail({
    type: "lead-acknowledgement",
    to: input.to,
    subject: `We received your enquiry ${stripHeaderInjection(input.reference)}`,
    element: createElement(LeadAcknowledgementEmail, {
      name: stripHeaderInjection(input.name),
      reference: stripHeaderInjection(input.reference),
    }),
    transactional: false,
  });
}

export async function sendLeadAdminAlertEmail(input: { to: string; name: string; phone: string; email: string; reference: string; formType: string; message: string }): Promise<void> {
  await sendRenderedEmail({
    type: "lead-admin-alert",
    to: input.to,
    subject: `New website enquiry ${stripHeaderInjection(input.reference)}`,
    element: createElement(LeadAdminAlertEmail, {
      ...input,
      name: stripHeaderInjection(input.name),
      phone: stripHeaderInjection(input.phone),
      email: stripHeaderInjection(input.email),
      reference: stripHeaderInjection(input.reference),
      formType: stripHeaderInjection(input.formType),
      message: stripHeaderInjection(input.message),
    }),
    transactional: false,
  });
}

function bookingHtml(input: { title: string; greeting: string; body: string; details: string; closing: string }): string {
  return `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><h2>${input.title}</h2><p>${input.greeting}</p>${input.body}<div>${input.details}</div><p>${input.closing}</p></div>`;
}

export async function sendBookingAcknowledgementEmail(input: {
  to: string;
  name: string;
  reference: string;
  totalPaise: number;
  checkIn: string;
  checkOut: string;
  status: string;
}): Promise<void> {
  const name = escapeHtml(stripHeaderInjection(input.name));
  const reference = escapeHtml(stripHeaderInjection(input.reference));
  const checkIn = escapeHtml(stripHeaderInjection(input.checkIn));
  const checkOut = escapeHtml(stripHeaderInjection(input.checkOut));
  const status = escapeHtml(stripHeaderInjection(input.status));
  const total = escapeHtml(`₹${(input.totalPaise / 100).toLocaleString("en-IN")}`);
  const html = bookingHtml({
    title: `Booking Request Received: ${reference}`,
    greeting: `Namaste ${name},`,
    body: "<p>We have received your booking request for Chawan Farms.</p>",
    details: `<ul><li><strong>Booking Reference:</strong> ${reference}</li><li><strong>Dates:</strong> ${checkIn} to ${checkOut}</li><li><strong>Estimated Total:</strong> ${total}</li><li><strong>Status:</strong> ${status}</li></ul>`,
    closing: "Our reservations team will review your booking and reach out shortly with confirmation and offline payment details (bank transfer / UPI).<br />Warm regards,<br />Chawan Farms, Baitwadi, Kolad",
  });
  await sendRenderedEmail({
    type: "booking-acknowledgement",
    to: input.to,
    subject: `Your Booking Request ${stripHeaderInjection(input.reference)} · Chawan Farms`,
    element: rawHtmlTemplate(html),
    transactional: true,
  });
}

export async function sendBookingAdminAlertEmail(input: {
  to: string;
  name: string;
  phone: string;
  reference: string;
  totalPaise: number;
  checkIn: string;
  checkOut: string;
  status: string;
}): Promise<void> {
  const name = escapeHtml(stripHeaderInjection(input.name));
  const phone = escapeHtml(stripHeaderInjection(input.phone));
  const reference = escapeHtml(stripHeaderInjection(input.reference));
  const checkIn = escapeHtml(stripHeaderInjection(input.checkIn));
  const checkOut = escapeHtml(stripHeaderInjection(input.checkOut));
  const status = escapeHtml(stripHeaderInjection(input.status));
  const total = escapeHtml(`₹${(input.totalPaise / 100).toLocaleString("en-IN")}`);
  const html = bookingHtml({
    title: `New Booking Request: ${reference}`,
    greeting: "A new booking request has been submitted on the website.",
    body: "",
    details: `<ul><li><strong>Reference:</strong> ${reference}</li><li><strong>Guest:</strong> ${name} (${phone})</li><li><strong>Dates:</strong> ${checkIn} to ${checkOut}</li><li><strong>Total:</strong> ${total}</li><li><strong>Status:</strong> ${status}</li></ul>`,
    closing: "",
  });
  await sendRenderedEmail({
    type: "booking-admin-alert",
    to: input.to,
    subject: `[Admin Alert] New Booking ${stripHeaderInjection(input.reference)}`,
    element: rawHtmlTemplate(html),
    transactional: true,
  });
}

export async function sendBookingConfirmedEmail(input: {
  to: string;
  name: string;
  reference: string;
  checkIn: string;
  checkOut: string;
}): Promise<void> {
  const name = escapeHtml(stripHeaderInjection(input.name));
  const reference = escapeHtml(stripHeaderInjection(input.reference));
  const checkIn = escapeHtml(stripHeaderInjection(input.checkIn));
  const checkOut = escapeHtml(stripHeaderInjection(input.checkOut));
  const html = bookingHtml({
    title: "Booking Confirmed!",
    greeting: `Namaste ${name},`,
    body: "<p>Your booking at Chawan Farms has been confirmed.</p>",
    details: `<ul><li><strong>Booking Reference:</strong> ${reference}</li><li><strong>Dates:</strong> ${checkIn} to ${checkOut}</li></ul><p>Please carry a valid government photo ID at check-in. Outside food and pets are not permitted on the property.</p><p>We look forward to hosting you!</p>`,
    closing: "Warm regards,<br />Chawan Farms, Baitwadi, Kolad",
  });
  await sendRenderedEmail({
    type: "booking-confirmed",
    to: input.to,
    subject: `Booking Confirmed: ${stripHeaderInjection(input.reference)} · Chawan Farms`,
    element: rawHtmlTemplate(html),
    transactional: true,
  });
}

export async function sendBookingCancelledEmail(input: {
  to: string;
  name: string;
  reference: string;
  reason?: string | null;
}): Promise<void> {
  const name = escapeHtml(stripHeaderInjection(input.name));
  const reference = escapeHtml(stripHeaderInjection(input.reference));
  const reason = escapeHtml(stripHeaderInjection(input.reason || "Cancelled per request"));
  const html = bookingHtml({
    title: "Booking Cancelled",
    greeting: `Namaste ${name},`,
    body: `<p>Your booking (Reference: <strong>${reference}</strong>) has been cancelled.</p><p><strong>Reason:</strong> ${reason}</p><p>Per farm policy, cancellation terms apply. A staff member will contact you if any refund or adjustment applies.</p>`,
    details: "",
    closing: "Warm regards,<br />Chawan Farms",
  });
  await sendRenderedEmail({
    type: "booking-cancelled",
    to: input.to,
    subject: `Booking Cancelled: ${stripHeaderInjection(input.reference)} · Chawan Farms`,
    element: rawHtmlTemplate(html),
    transactional: true,
  });
}
