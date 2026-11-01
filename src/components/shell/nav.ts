import { CalendarDays, House, LayoutGrid, MessageSquare, Settings, ChartColumn } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/today", label: "Today", icon: House },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/domains", label: "Domains", icon: LayoutGrid },
  { href: "/review", label: "Weekly Review", icon: ChartColumn },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export const MOBILE_NAV = [
  { href: "/today", label: "Today", icon: House },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/domains", label: "Domains", icon: LayoutGrid },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
