import "server-only";

import { render } from "@react-email/render";
import { createElement } from "react";
import { Resend } from "resend";

import { env } from "@/config/env";
import { LeadAcknowledgementEmail } from "@/server/email/templates/LeadAcknowledgementEmail";
import { LeadAdminAlertEmail } from "@/server/email/templates/LeadAdminAlertEmail";
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

export async function sendLeadAcknowledgementEmail(input: { to: string; name: string; reference: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `We received your enquiry ${input.reference}`,
    html: await render(createElement(LeadAcknowledgementEmail, { name: input.name, reference: input.reference })),
    link: `${env.NEXT_PUBLIC_SITE_URL}/contact`,
  });
}

export async function sendLeadAdminAlertEmail(input: { to: string; name: string; phone: string; email: string; reference: string; formType: string; message: string }): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `New website enquiry ${input.reference}`,
    html: await render(createElement(LeadAdminAlertEmail, input)),
    link: `${env.NEXT_PUBLIC_SITE_URL}/admin/leads`,
  });
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
  const formattedInr = `₹${(input.totalPaise / 100).toLocaleString("en-IN")}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Booking Request Received: ${input.reference}</h2>
      <p>Namaste ${input.name},</p>
      <p>We have received your booking request for Chawan Farms.</p>
      <ul>
        <li><strong>Booking Reference:</strong> ${input.reference}</li>
        <li><strong>Dates:</strong> ${input.checkIn} to ${input.checkOut}</li>
        <li><strong>Estimated Total:</strong> ${formattedInr}</li>
        <li><strong>Status:</strong> ${input.status}</li>
      </ul>
      <p>Our reservations team will review your booking and reach out shortly with confirmation and offline payment details (bank transfer / UPI).</p>
      <p>Warm regards,<br />Chawan Farms, Baitwadi, Kolad</p>
    </div>
  `;
  await sendEmail({
    to: input.to,
    subject: `Your Booking Request ${input.reference} · Chawan Farms`,
    html,
    link: `${env.NEXT_PUBLIC_SITE_URL}/contact`,
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
  const formattedInr = `₹${(input.totalPaise / 100).toLocaleString("en-IN")}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>New Booking Request: ${input.reference}</h2>
      <p>A new booking request has been submitted on the website.</p>
      <ul>
        <li><strong>Reference:</strong> ${input.reference}</li>
        <li><strong>Guest:</strong> ${input.name} (${input.phone})</li>
        <li><strong>Dates:</strong> ${input.checkIn} to ${input.checkOut}</li>
        <li><strong>Total:</strong> ${formattedInr}</li>
        <li><strong>Status:</strong> ${input.status}</li>
      </ul>
    </div>
  `;
  await sendEmail({
    to: input.to,
    subject: `[Admin Alert] New Booking ${input.reference}`,
    html,
    link: `${env.NEXT_PUBLIC_SITE_URL}/admin/bookings`,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendBookingConfirmedEmail(input: {
  to: string;
  name: string;
  reference: string;
  checkIn: string;
  checkOut: string;
}): Promise<void> {
  const safeName = escapeHtml(input.name);
  const safeRef = escapeHtml(input.reference);
  const safeIn = escapeHtml(input.checkIn);
  const safeOut = escapeHtml(input.checkOut);
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Booking Confirmed!</h2>
      <p>Namaste ${safeName},</p>
      <p>Your booking at Chawan Farms has been confirmed.</p>
      <ul>
        <li><strong>Booking Reference:</strong> ${safeRef}</li>
        <li><strong>Dates:</strong> ${safeIn} to ${safeOut}</li>
      </ul>
      <p>Please carry a valid government photo ID at check-in. Outside food and pets are not permitted on the property.</p>
      <p>We look forward to hosting you!</p>
      <p>Warm regards,<br />Chawan Farms, Baitwadi, Kolad</p>
    </div>
  `;
  await sendEmail({
    to: input.to,
    subject: `Booking Confirmed: ${input.reference} · Chawan Farms`,
    html,
    link: `${env.NEXT_PUBLIC_SITE_URL}/contact`,
  });
}

export async function sendBookingCancelledEmail(input: {
  to: string;
  name: string;
  reference: string;
  reason?: string | null;
}): Promise<void> {
  const safeName = escapeHtml(input.name);
  const safeRef = escapeHtml(input.reference);
  const safeReason = input.reason ? escapeHtml(input.reason) : "Cancelled per request";
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Booking Cancelled</h2>
      <p>Namaste ${safeName},</p>
      <p>Your booking (Reference: <strong>${safeRef}</strong>) has been cancelled.</p>
      <p><strong>Reason:</strong> ${safeReason}</p>
      <p>Per farm policy, cancellation terms apply. A staff member will contact you if any refund or adjustment applies.</p>
      <p>Warm regards,<br />Chawan Farms</p>
    </div>
  `;
  await sendEmail({
    to: input.to,
    subject: `Booking Cancelled: ${input.reference} · Chawan Farms`,
    html,
    link: `${env.NEXT_PUBLIC_SITE_URL}/contact`,
  });
}

