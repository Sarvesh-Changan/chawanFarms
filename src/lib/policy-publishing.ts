export function canPublishPolicy(input: { key: string; pendingDecision?: unknown }): boolean {
  return input.pendingDecision === undefined;
}
