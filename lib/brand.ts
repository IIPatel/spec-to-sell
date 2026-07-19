import type { BrandKit } from "./types";

const paletteFromColor = (hex?: string) => {
  const accent = /^#[0-9a-fA-F]{6}$/.test(hex ?? "") ? hex! : "#A34E38";
  return { background: "#FBF8F4", ink: "#24201C", accent, muted: "#E9DED2" };
};

export function proposeBrandKit(input: { name: string; description: string; logo?: string; preferredColor?: string }): BrandKit {
  const description = input.description.trim() || "Warm, thoughtful products for everyday rituals.";
  return {
    name: input.name.trim() || "Your shop",
    description,
    logo: input.logo,
    preferredColor: input.preferredColor,
    palette: paletteFromColor(input.preferredColor),
    fontPair: { heading: "Georgia", body: "Arial" },
    voice: ["warm", "considered", "clear"],
    spacingScale: "relaxed",
    cornerStyle: "soft",
    imageTreatment: "clean crop",
  };
}

export function brandTokensMatch(a: BrandKit, b: BrandKit) {
  return JSON.stringify(a.palette) === JSON.stringify(b.palette) && a.fontPair.heading === b.fontPair.heading && a.fontPair.body === b.fontPair.body;
}
