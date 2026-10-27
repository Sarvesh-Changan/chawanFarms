import { z } from "zod";

import { localizedTextSchema, optionalLocalizedTextSchema } from "@/lib/schemas/cms/common";

const rupees = z.string().trim().max(12).refine((value) => !value || /^\d{1,9}(\.\d{1,2})?$/.test(value), "Enter rupees with up to two decimal places.").refine((value) => !value || Number(value) <= 999_999_999.99, "Amount is out of range.").transform((value) => value ? Math.round(Number(value) * 100) : null);

export const menuCategoryFormSchema = z.object({ id: z.string().uuid().optional(), name: localizedTextSchema, published: z.boolean().default(false) }).strict();
export const menuItemFormSchema = z.object({ id: z.string().uuid().optional(), categoryId: z.string().uuid(), name: localizedTextSchema, description: optionalLocalizedTextSchema.optional(), foodPreference: z.enum(["VEG", "NON_VEG", "BOTH"]).default("BOTH"), isExtraCharge: z.boolean().default(false), priceRupees: rupees.optional(), published: z.boolean().default(false) }).strict();
export const menuListSchema = z.object({ q: z.string().trim().max(120).default(""), trash: z.boolean().default(false) }).strict();
export const menuReferenceSchema = z.object({ id: z.string().uuid(), entity: z.enum(["category", "item"]) }).strict();
export const menuReorderSchema = menuReferenceSchema.extend({ direction: z.enum(["up", "down"]) }).strict();
export const menuBulkSchema = z.object({ entity: z.enum(["category", "item"]), ids: z.array(z.string().uuid()).min(1).max(200), action: z.enum(["publish", "unpublish"]) }).strict();

export type MenuCategoryFormData = z.output<typeof menuCategoryFormSchema>;
export type MenuItemFormData = z.output<typeof menuItemFormSchema>;
