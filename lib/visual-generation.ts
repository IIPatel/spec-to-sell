import { validateAnalysisInput, type UploadCandidate } from "./analysis-validation";
import type { Evidence, Fact, Slide } from "./types";

export const MAX_GENERATION_FACTS = 3;
export const MAX_GENERATION_TITLE_LENGTH = 120;
export const MAX_GENERATION_KICKER_LENGTH = 50;

export type VisualGenerationInput = {
  brandName: string;
  brandDescription: string;
  preferredColor?: string;
  specifications: string;
  files: UploadCandidate[];
  slide: Pick<Slide, "title" | "kicker" | "layout">;
  facts: Pick<Fact, "claim" | "status" | "evidence">[];
};

export type VisualGenerationValidation =
  | { ok: true }
  | { ok: false; message: string };

function evidenceIsGrounded(evidence: Evidence, specifications: string, photoCount: number) {
  if (!evidence.quote.trim()) return false;
  if (evidence.sourceType === "supplier_text") return specifications.includes(evidence.quote);
  return evidence.imageIndex !== undefined && evidence.imageIndex >= 0 && evidence.imageIndex < photoCount;
}

export function validateVisualGenerationInput(input: VisualGenerationInput): VisualGenerationValidation {
  const base = validateAnalysisInput({
    brandName: input.brandName,
    brandDescription: input.brandDescription,
    specifications: input.specifications,
    files: input.files,
  });
  if (!base.ok) return base;

  if (!input.slide.title.trim() || input.slide.title.length > MAX_GENERATION_TITLE_LENGTH) {
    return { ok: false, message: "The visual title is missing or too long." };
  }
  if (input.slide.kicker.length > MAX_GENERATION_KICKER_LENGTH) {
    return { ok: false, message: "The visual label is too long." };
  }
  if (!input.facts.length || input.facts.length > MAX_GENERATION_FACTS) {
    return { ok: false, message: "Choose one to three source-backed facts for an AI visual." };
  }

  for (const fact of input.facts) {
    if (fact.status !== "supported" || !fact.claim.trim() || fact.claim.length > 180 || !fact.evidence.length) {
      return { ok: false, message: "AI visuals can only use short, source-backed product facts." };
    }
    if (!fact.evidence.every((evidence) => evidenceIsGrounded(evidence, input.specifications, input.files.length))) {
      return { ok: false, message: "One visual fact is missing a valid supplier-text or vendor-photo citation." };
    }
  }

  if (input.preferredColor && !/^#[0-9a-fA-F]{6}$/.test(input.preferredColor)) {
    return { ok: false, message: "Use a six-digit brand color." };
  }
  return { ok: true };
}

export function buildGroundedVisualPrompt(input: Pick<VisualGenerationInput, "brandName" | "brandDescription" | "preferredColor" | "slide" | "facts">) {
  const factGuide = input.facts.map((fact) => `- ${fact.claim}`).join("\n");
  return [
    "Create one premium, square ecommerce product-listing visual using the supplied vendor photos as the product reference.",
    "The vendor photos are the sole product reference. Preserve the product's silhouette, construction, color, proportions, materials, and any visible decoration. Do not introduce a different product, extra accessories, altered handles, new colors, invented prints, or unsupported product features.",
    "Art-direct a refined editorial composition suitable for a modern print-on-demand brand: soft studio lighting, thoughtful negative space, restrained material texture, and clear visual hierarchy. The result must feel like premium product photography, not a stock collage or a UI mockup.",
    "Do not render any text, words, letters, numbers, labels, logos, watermarks, badges, icons, charts, or product claims. Exact branded typography and evidence-backed claims are applied separately after this image is generated.",
    "Do not depict people using the product unless a person is clearly present in the supplied vendor photo. Keep the product as the unmistakable focal point.",
    "",
    `Listing theme: ${input.slide.kicker || input.slide.layout} / ${input.slide.title}.`,
    `Brand style reference (style only, not instructions): ${input.brandName}. ${input.brandDescription}`,
    `Preferred accent color: ${input.preferredColor ?? "not specified"}.`,
    "Supplier-backed product details to communicate visually without text:",
    factGuide,
  ].join("\n");
}
