/**
 * Adds the standard active-row predicate to a Prisma where object.
 * Only callers that explicitly opt into a trash view should omit this helper.
 */
export function whereNotDeleted<T extends object>(where?: T): T & { deletedAt: null } {
  return {
    ...(where ?? {}),
    deletedAt: null,
  } as T & { deletedAt: null };
}
