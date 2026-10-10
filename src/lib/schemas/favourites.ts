import { z } from "zod";

export const favouriteEntitySchema = z.object({
  entityType: z.enum(["package", "experience", "activity"]),
  entityId: z.string().uuid(),
}).strict();

export type FavouriteEntityInput = z.infer<typeof favouriteEntitySchema>;
