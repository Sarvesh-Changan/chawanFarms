import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z.string().min(10, "Use at least 10 characters.").max(128, "Use 128 characters or fewer.");
const callbackUrl = z.string().trim().max(2048).optional();

export const loginSchema = z.object({
  email,
  password,
  callbackUrl,
}).strict();

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100, "Use 100 characters or fewer."),
  email,
  password,
  confirmPassword: z.string(),
  callbackUrl,
}).strict().superRefine((value, context) => {
  if (value.password !== value.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
  }
});

export const forgotPasswordSchema = z.object({
  email,
}).strict();

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "This reset link is invalid or expired."),
  password,
  confirmPassword: z.string(),
}).strict().superRefine((value, context) => {
  if (value.password !== value.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
  }
});

export const staffForgotPasswordSchema = z.object({
  email,
}).strict();

export const staffVerifyOtpSchema = z.object({
  email,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit verification code."),
}).strict();

export const staffResetPasswordSchema = z.object({
  grantToken: z.string().trim().min(1, "Reset grant token is required."),
  password: z.string().min(12, "Use at least 12 characters.").max(128, "Use 128 characters or fewer."),
  confirmPassword: z.string(),
}).strict().superRefine((value, context) => {
  if (value.password !== value.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
  }
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type StaffForgotPasswordInput = z.infer<typeof staffForgotPasswordSchema>;
export type StaffVerifyOtpInput = z.infer<typeof staffVerifyOtpSchema>;
export type StaffResetPasswordInput = z.infer<typeof staffResetPasswordSchema>;
