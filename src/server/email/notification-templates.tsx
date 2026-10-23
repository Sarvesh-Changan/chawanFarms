import { render } from "@react-email/render";
import { createElement, type ReactElement } from "react";
import { z } from "zod";

import {
  BookingCancelledEmail,
  BookingConfirmedEmail,
  BookingReceivedEmail,
  CouponExpiringEmail,
  CouponIssuedEmail,
  EnquiryAcknowledgementEmail,
  LeadAlertEmail,
  PointsEarnedEmail,
  PreArrivalReminderEmail,
  VideoApprovedEmail,
  VideoReceivedEmail,
  VideoRejectedEmail,
} from "@/server/email/templates/NotificationTemplates";

export const notificationEventSchema = z.enum([
  "LEAD_ALERT",
  "ENQUIRY_ACKNOWLEDGEMENT",
  "BOOKING_RECEIVED",
  "BOOKING_CONFIRMED",
  "BOOKING_CANCELLED",
  "VIDEO_RECEIVED",
  "VIDEO_APPROVED",
  "VIDEO_REJECTED",
  "VIDEO_REMOVED",
  "POINTS_EARNED",
  "COUPON_ISSUED",
  "COUPON_EXPIRING",
  "PRE_ARRIVAL_REMINDER",
]);

export type NotificationEvent = z.infer<typeof notificationEventSchema>;
export const notificationDataSchema = z.record(z.string().min(1).max(64), z.union([z.string().max(10_000), z.number().finite(), z.boolean(), z.null()])).default({});

type TemplateDefinition = {
  title: string;
  subject: string;
  body: string;
  transactional: boolean;
  requiresMarketingConsent: boolean;
  component: (props: { title: string; body: string }) => ReactElement;
};

export const notificationTemplates: Record<NotificationEvent, TemplateDefinition> = {
  LEAD_ALERT: { title: "New website enquiry", subject: "New website enquiry {{reference}}", body: "A new enquiry has been received.\nReference: {{reference}}\nLead: {{leadId}}\nName: {{name}}\nEmail: {{email}}\nPhone: {{phone}}\nMessage: {{message}}", transactional: true, requiresMarketingConsent: false, component: LeadAlertEmail },
  ENQUIRY_ACKNOWLEDGEMENT: { title: "We received your enquiry", subject: "We received your enquiry {{reference}}", body: "Thank you, {{name}}.\nYour enquiry has been received.\nReference: {{reference}}", transactional: true, requiresMarketingConsent: false, component: EnquiryAcknowledgementEmail },
  BOOKING_RECEIVED: { title: "Booking request received", subject: "Your booking request {{reference}}", body: "Namaste {{name}},\nWe have received your booking request for Chawan Farms.\nDates: {{checkIn}} to {{checkOut}}\nStatus: {{status}}", transactional: true, requiresMarketingConsent: false, component: BookingReceivedEmail },
  BOOKING_CONFIRMED: { title: "Booking confirmed", subject: "Booking confirmed: {{reference}}", body: "Namaste {{name}},\nYour booking at Chawan Farms has been confirmed.\nDates: {{checkIn}} to {{checkOut}}\nPlease bring your original photo ID to check-in.", transactional: true, requiresMarketingConsent: false, component: BookingConfirmedEmail },
  BOOKING_CANCELLED: { title: "Booking cancelled", subject: "Booking cancelled: {{reference}}", body: "Namaste {{name}},\nYour booking {{reference}} has been cancelled.\nReason: {{reason}}", transactional: true, requiresMarketingConsent: false, component: BookingCancelledEmail },
  VIDEO_RECEIVED: { title: "Video received", subject: "We received your video", body: "Your video submission {{submissionId}} has been received and is pending review.", transactional: true, requiresMarketingConsent: false, component: VideoReceivedEmail },
  VIDEO_APPROVED: { title: "Video approved", subject: "Your video was approved", body: "Your video submission {{submissionId}} was approved.", transactional: true, requiresMarketingConsent: false, component: VideoApprovedEmail },
  VIDEO_REJECTED: { title: "Video needs changes", subject: "Your video submission needs changes", body: "Your video submission {{submissionId}} was not approved.\nReason: {{reason}}", transactional: true, requiresMarketingConsent: false, component: VideoRejectedEmail },
  VIDEO_REMOVED: { title: "Video removed", subject: "Your video submission was removed", body: "Your video submission {{submissionId}} was removed.\nReason: {{reason}}", transactional: true, requiresMarketingConsent: false, component: VideoRejectedEmail },
  POINTS_EARNED: { title: "Points earned", subject: "Points added to your rewards balance", body: "{{points}} points were added to your rewards balance.", transactional: false, requiresMarketingConsent: true, component: PointsEarnedEmail },
  COUPON_ISSUED: { title: "Coupon issued", subject: "Your rewards coupon is ready", body: "Your coupon {{code}} is ready to use.\nExpiry: {{expiresAt}}", transactional: false, requiresMarketingConsent: true, component: CouponIssuedEmail },
  COUPON_EXPIRING: { title: "Coupon expiring soon", subject: "Your coupon expires soon", body: "Your coupon {{code}} expires on {{expiresAt}}.", transactional: false, requiresMarketingConsent: true, component: CouponExpiringEmail },
  PRE_ARRIVAL_REMINDER: { title: "Your stay is coming up", subject: "Reminder for your upcoming stay", body: "Your stay is from {{checkIn}} to {{checkOut}}.\nStay rules:\n{{stayRules}}\nBring your original photo ID to check-in.", transactional: false, requiresMarketingConsent: true, component: PreArrivalReminderEmail },
};

export type TemplateOverride = { subject?: string; body?: string };

const templateMap = new Map(Object.entries(notificationTemplates));

function getTemplateDefinition(event: NotificationEvent): TemplateDefinition {
  const definition = templateMap.get(event);
  if (!definition) throw new Error("NOTIFICATION_TEMPLATE_NOT_FOUND");
  return definition;
}

function interpolate(value: string, data: Record<string, string | number | boolean | null>): string {
  const values = new Map(Object.entries(data));
  return value.replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (_match, key: string) => {
    const replacement = values.get(key);
    return replacement === null || replacement === undefined ? "" : String(replacement);
  });
}

export function renderNotificationTemplate(input: { event: string; data: unknown; override?: TemplateOverride }) {
  const event = notificationEventSchema.parse(input.event);
  const definition = getTemplateDefinition(event);
  const data = notificationDataSchema.parse(input.data);
  const subject = interpolate(input.override?.subject || definition.subject, data);
  const body = interpolate(input.override?.body || definition.body, data);
  const element = createElement(definition.component, { title: definition.title, body });
  return Promise.all([render(element), render(element, { plainText: true })]).then(([html, text]) => ({
    subject: subject.replace(/[\r\n]/g, "").trim(),
    html,
    text,
    transactional: definition.transactional,
  }));
}

export function getNotificationTemplateDefinition(event: string): TemplateDefinition {
  return getTemplateDefinition(notificationEventSchema.parse(event));
}
