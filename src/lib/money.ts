import { z } from "zod";

const paiseSchema = z.number().int();
const inrFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});

export function formatINR(paise: number): string {
  const validatedPaise = paiseSchema.parse(paise);

  return inrFormatter.format(validatedPaise / 100);
}
