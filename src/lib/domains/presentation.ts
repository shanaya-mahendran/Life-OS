export const DOMAIN_FAMILIES = [
  {
    name: "Work and growth",
    color: "#60a5fa",
    slugs: ["career", "education", "learning", "open-source", "competitions", "portfolio"],
  },
  { name: "Body and health", color: "#34d399", slugs: ["food", "sleep", "karate", "rest"] },
  { name: "Money and admin", color: "#fbbf24", slugs: ["finance", "admin"] },
  { name: "People and purpose", color: "#f472b6", slugs: ["volunteering", "social", "blogging"] },
  { name: "Planning and reflection", color: "#a78bfa", slugs: ["planning", "habits"] },
  { name: "Logistics", color: "#94a3b8", slugs: ["travel"] },
] as const;

const DOMAIN_FAMILY_COLORS = new Map(
  DOMAIN_FAMILIES.flatMap((family) => family.slugs.map((slug) => [slug, family.color] as const)),
);

export function domainFamilyColor(slug: string, fallback = "#94a3b8"): string {
  return DOMAIN_FAMILY_COLORS.get(slug as (typeof DOMAIN_FAMILIES)[number]["slugs"][number]) ?? fallback;
}
