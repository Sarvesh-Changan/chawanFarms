import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z.string().min(10, "Use at least 10 characters.").max(128, "Use 128 characters or fewer.");
const callbackUrl = z.string().trim().max(2048).optional();
const turnstileToken = z.string().trim().max(2048).optional();

export const loginSchema = z.object({
  email,
  password,
  callbackUrl,
  turnstileToken,
}).strict();

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100, "Use 100 characters or fewer."),
  email,
  password,
  confirmPassword: z.string(),
  turnstileToken,
}).strict().superRefine((value, context) => {
  if (value.password !== value.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
  }
});

export const forgotPasswordSchema = z.object({
  email,
  turnstileToken,
}).strict();

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "This reset link is invalid or expired."),
  password,
  confirmPassword: z.string(),
  turnstileToken,
}).strict().superRefine((value, context) => {
  if (value.password !== value.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
  }
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
