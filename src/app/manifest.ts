import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LifeOS — Plan. Achieve. Thrive.",
    short_name: "LifeOS",
    description: "One chat message, one master calendar. AI planning agent for career, studies, competitions, health and life.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    background_color: "#06040e",
    theme_color: "#0a0716",
    orientation: "portrait",
    categories: ["productivity", "lifestyle", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Today",
        short_name: "Today",
        description: "View today's schedule and focus plan",
        url: "/today",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Chat Agent",
        short_name: "Chat",
        description: "Talk to your LifeOS planning orchestrator",
        url: "/chat",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Calendar",
        short_name: "Calendar",
        description: "View month and week schedules",
        url: "/calendar",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
