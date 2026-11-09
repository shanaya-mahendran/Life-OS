import { DOMAINS, type DomainCluster } from "./catalog";

export interface DomainFamily {
  name: string;
  cluster: DomainCluster;
  color: string;
  slugs: readonly string[];
  domainColors: Record<string, string>;
}

export const DOMAIN_FAMILIES: DomainFamily[] = [
  {
    name: "Study and work",
    cluster: "study_and_work",
    color: "#3E7BF0",
    slugs: ["career", "education", "competitions", "learning", "open-source", "blogging", "portfolio"],
    domainColors: {
      career: "#3E7BF0",
      education: "#4DB3F7",
      competitions: "#8F9BFF",
      learning: "#22C7E8",
      "open-source": "#8FDA3E",
      blogging: "#E056D6",
      portfolio: "#B8528E",
    },
  },
  {
    name: "Body and health",
    cluster: "body_and_health",
    color: "#5B5FD6",
    slugs: ["sleep", "food", "karate", "medicine", "rest", "period"],
    domainColors: {
      sleep: "#5B5FD6",
      food: "#FF9F43",
      karate: "#E5484D",
      medicine: "#2DD4BF",
      rest: "#86D8B0",
      period: "#D6336C",
    },
  },
  {
    name: "Mind and spirit",
    cluster: "mind_and_spirit",
    color: "#D17FF5",
    slugs: ["prayer", "mood", "habits", "planning"],
    domainColors: {
      prayer: "#D17FF5",
      mood: "#F472B6",
      habits: "#FB6F92",
      planning: "#D9DCEF",
    },
  },
  {
    name: "People and service",
    cluster: "people_and_service",
    color: "#3FC76A",
    slugs: ["volunteering", "social"],
    domainColors: {
      volunteering: "#3FC76A",
      social: "#FF7F6B",
    },
  },
  {
    name: "Life admin",
    cluster: "life_admin",
    color: "#E8B93F",
    slugs: ["finance", "admin", "travel"],
    domainColors: {
      finance: "#E8B93F",
      admin: "#B5BC4A",
      travel: "#8AA0BA",
    },
  },
];

const DOMAIN_COLORS = new Map<string, string>(
  DOMAINS.map((domain) => [domain.slug, domain.accent]),
);

export function domainFamilyColor(slug: string, fallback = "#7c5cff"): string {
  return DOMAIN_COLORS.get(slug) ?? fallback;
}
