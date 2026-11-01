import fs from "fs";
import path from "path";
import sharp from "sharp";

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0e0824"/>
      <stop offset="50%" stop-color="#06040e"/>
      <stop offset="100%" stop-color="#030208"/>
    </linearGradient>
    <linearGradient id="loop" x1="100" y1="256" x2="412" y2="256" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="35%" stop-color="#818cf8"/>
      <stop offset="70%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#f472b6"/>
    </linearGradient>
    <filter id="glow" x="50" y="100" width="412" height="312" filterUnits="userSpaceOnUse">
      <feGaussianBlur stdDeviation="24" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect width="510" height="510" x="1" y="1" rx="111" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>

  <!-- Glowing aura behind infinity -->
  <path d="M180 196 C136 196 100 223 100 256 C100 289 136 316 180 316 C220 316 244 286 256 270 C268 286 292 316 332 316 C376 316 412 289 412 256 C412 223 376 196 332 196 C292 196 268 226 256 242 C244 226 220 196 180 196 Z"
        stroke="url(#loop)" stroke-width="48" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.6" filter="url(#glow)"/>

  <!-- Core crisp infinity loop -->
  <path d="M180 196 C136 196 100 223 100 256 C100 289 136 316 180 316 C220 316 244 286 256 270 C268 286 292 316 332 316 C376 316 412 289 412 256 C412 223 376 196 332 196 C292 196 268 226 256 242 C244 226 220 196 180 196 Z"
        stroke="url(#loop)" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" fill="none"/>

  <!-- Inner highlight curve -->
  <path d="M160 216 C130 216 116 234 116 256" stroke="rgba(255,255,255,0.7)" stroke-width="10" stroke-linecap="round" fill="none"/>
  <circle cx="376" cy="236" r="6" fill="#ffffff" opacity="0.9"/>
</svg>
`;

async function main() {
  const outDir = path.resolve("public/icons");
  fs.mkdirSync(outDir, { recursive: true });

  const svgBuffer = Buffer.from(svg);
  fs.writeFileSync(path.join(outDir, "icon.svg"), svg);

  // Generate 512x512
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(outDir, "icon-512.png"));
  console.log("✓ icon-512.png created");

  // Generate 192x192
  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(outDir, "icon-192.png"));
  console.log("✓ icon-192.png created");

  // Generate apple-touch-icon 180x180
  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(outDir, "apple-touch-icon.png"));
  console.log("✓ apple-touch-icon.png created");

  // Also put favicon.ico / apple-touch-icon in public/
  await sharp(svgBuffer).resize(180, 180).png().toFile(path.resolve("public/apple-touch-icon.png"));
  await sharp(svgBuffer).resize(64, 64).png().toFile(path.resolve("public/favicon.png"));
  console.log("✓ All PWA icons generated successfully");
}

main().catch(console.error);
