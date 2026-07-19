import { describe, expect, it } from "vitest";
import { buildGroundedVisualPrompt, validateVisualGenerationInput } from "./visual-generation";

const valid = {
  brandName: "Harbor Muse",
  brandDescription: "Quiet coastal gifts.",
  preferredColor: "#A34E38",
  specifications: "Natural cotton canvas tote bag. Dimensions: 15 in x 16 in.",
  files: [{ name: "tote.jpg", type: "image/jpeg", size: 250_000 }],
  slide: { title: "Natural cotton canvas", kicker: "MATERIAL", layout: "hero" as const },
  facts: [{
    claim: "Natural cotton canvas",
    status: "supported" as const,
    evidence: [{ sourceType: "supplier_text" as const, quote: "Natural cotton canvas tote bag." }],
  }],
};

describe("visual generation grounding", () => {
  it("accepts a cited supplier fact and creates a no-text prompt", () => {
    expect(validateVisualGenerationInput(valid)).toEqual({ ok: true });
    const prompt = buildGroundedVisualPrompt(valid);
    expect(prompt).toContain("Natural cotton canvas");
    expect(prompt).toContain("Do not render any text");
    expect(prompt).toContain("sole product reference");
  });

  it("rejects a claim with a citation that is not in supplier text", () => {
    expect(validateVisualGenerationInput({
      ...valid,
      facts: [{ ...valid.facts[0], evidence: [{ sourceType: "supplier_text", quote: "Waterproof finish" }] }],
    })).toEqual({ ok: false, message: "One visual fact is missing a valid supplier-text or vendor-photo citation." });
  });

  it("rejects more than three facts in one image request", () => {
    expect(validateVisualGenerationInput({
      ...valid,
      facts: [valid.facts[0], valid.facts[0], valid.facts[0], valid.facts[0]],
    })).toEqual({ ok: false, message: "Choose one to three source-backed facts for an AI visual." });
  });
});
