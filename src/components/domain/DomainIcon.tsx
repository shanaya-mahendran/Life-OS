import {
  Armchair,
  Brain,
  Briefcase,
  ClipboardList,
  Code2,
  Compass,
  FolderKanban,
  GraduationCap,
  HeartHandshake,
  Moon,
  PenLine,
  Plane,
  Sparkles,
  Swords,
  Trophy,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { DomainIconName } from "@/lib/domains/catalog";

const ICONS: Record<DomainIconName, LucideIcon> = {
  briefcase: Briefcase,
  graduation: GraduationCap,
  trophy: Trophy,
  handshake: HeartHandshake,
  code: Code2,
  food: UtensilsCrossed,
  moon: Moon,
  swords: Swords,
  pen: PenLine,
  brain: Brain,
  compass: Compass,
  armchair: Armchair,
  wallet: Wallet,
  clipboard: ClipboardList,
  users: Users,
  folder: FolderKanban,
  plane: Plane,
  sparkles: Sparkles,
};

export function DomainIcon({
  name,
  className,
  size = 18,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  const Icon = ICONS[name as DomainIconName] ?? Sparkles;
  return <Icon className={className} size={size} strokeWidth={1.85} aria-hidden />;
}
