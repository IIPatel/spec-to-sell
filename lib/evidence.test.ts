import { describe, expect, it } from "vitest";
import { evidenceValidationMessage } from "./evidence";
import type { Fact } from "./types";

const supportedFact: Fact = {
  id: "canvas",
  claim: "Natural cotton canvas",
  category: "material",
  importance: "major",
  status: "supported",
  confidence: 1,
  evidence: [{ sourceType: "supplier_text", quote: "Natural cotton canvas tote bag." }],
};

describe("evidence validation", () => {
  it("accepts a cited supplier fact", () => {
    expect(evidenceValidationMessage([supportedFact], 1)).toBeNull();
  });

  it("rejects unsupported slide facts and invalid image citations", () => {
    expect(evidenceValidationMessage([{ ...supportedFact, evidence: [] }], 1)).toBe("A supported claim is missing supplier evidence.");
    expect(evidenceValidationMessage([{
      ...supportedFact,
      evidence: [{ sourceType: "vendor_image", quote: "Shown in the vendor photo", imageIndex: 2 }],
    }], 1)).toBe("A vendor-image citation points to a photo that was not supplied.");
  });

  it("requires an explanation for a held claim", () => {
    expect(evidenceValidationMessage([{
      ...supportedFact,
      status: "needs_review",
      evidence: [],
      conflict: "",
    }], 1)).toBe("A held claim is missing its review explanation.");
  });
});
