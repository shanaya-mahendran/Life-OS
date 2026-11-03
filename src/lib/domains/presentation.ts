export const DOMAIN_FAMILIES = [
  {
    name: "Work and growth",
    color: "#60a5fa",
    domainColors: {
      career: "#3b82f6",
      education: "#60a5fa",
      learning: "#93c5fd",
      "open-source": "#0ea5e9",
      competitions: "#2563eb",
      portfolio: "#1d4ed8",
    },
    slugs: ["career", "education", "learning", "open-source", "competitions", "portfolio"],
  },
  {
    name: "Body and health",
    color: "#34d399",
    domainColors: { food: "#34d399", sleep: "#10b981", karate: "#059669", rest: "#6ee7b7" },
    slugs: ["food", "sleep", "karate", "rest"],
  },
  {
    name: "Money and admin",
    color: "#fbbf24",
    domainColors: { finance: "#fbbf24", admin: "#f59e0b" },
    slugs: ["finance", "admin"],
  },
  {
    name: "People and purpose",
    color: "#f472b6",
    domainColors: { volunteering: "#f472b6", social: "#ec4899", blogging: "#db2777" },
    slugs: ["volunteering", "social", "blogging"],
  },
  {
    name: "Planning and reflection",
    color: "#a78bfa",
    domainColors: { planning: "#a78bfa", habits: "#8b5cf6" },
    slugs: ["planning", "habits"],
  },
  {
    name: "Travel and commute",
    color: "#94a3b8",
    domainColors: { travel: "#94a3b8" },
    slugs: ["travel"],
  },
] as const;

const DOMAIN_COLORS = new Map(
  DOMAIN_FAMILIES.flatMap((family) =>
    Object.entries(family.domainColors).map(([slug, color]) => [slug, color] as const),
  ),
);

export function domainFamilyColor(slug: string, fallback = "#94a3b8"): string {
  return DOMAIN_COLORS.get(slug) ?? fallback;
}
