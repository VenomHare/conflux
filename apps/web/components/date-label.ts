export function dateLabel(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();

  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;

  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}
