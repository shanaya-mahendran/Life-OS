export function eventStatusExclusions(options: {
  includeCancelled?: boolean;
  includeSuggested?: boolean;
}): string[] {
  const excluded: string[] = [];
  if (!options.includeCancelled) excluded.push("cancelled");
  if (!options.includeSuggested) excluded.push("suggested");
  return excluded;
}
