import { env } from "@/config/env";

/** Provisional daily mailbox quota; normal Gmail accounts are commonly limited to roughly 500 recipients/day. */
export const EMAIL_DAILY_LIMIT = env.EMAIL_DAILY_LIMIT;
export const EMAIL_TRANSACTIONAL_RESERVE_PERCENT = env.EMAIL_TRANSACTIONAL_RESERVE_PERCENT;
export const EMAIL_DAILY_WINDOW_SECONDS = 86_400;
export const EMAIL_MAX_RECIPIENTS_PER_MESSAGE = 20;

export const EMAIL_TRANSACTIONAL_LIMIT = Math.max(
  1,
  Math.ceil(EMAIL_DAILY_LIMIT * (EMAIL_TRANSACTIONAL_RESERVE_PERCENT / 100)),
);
export const EMAIL_OPTIONAL_LIMIT = Math.max(
  1,
  EMAIL_DAILY_LIMIT - EMAIL_TRANSACTIONAL_LIMIT,
);
