import type { Fact } from "./types";

export function evidenceValidationMessage(facts: Fact[], photoCount: number) {
  for (const fact of facts) {
    if (fact.status === "supported" && !fact.evidence.length) {
      return "A supported claim is missing supplier evidence.";
    }
    if (fact.status === "needs_review" && !fact.conflict?.trim()) {
      return "A held claim is missing its review explanation.";
    }
    for (const evidence of fact.evidence) {
      if (!evidence.quote.trim()) return "An evidence citation is empty.";
      if (
        evidence.sourceType === "vendor_image"
        && (evidence.imageIndex === undefined || evidence.imageIndex < 0 || evidence.imageIndex >= photoCount)
      ) {
        return "A vendor-image citation points to a photo that was not supplied.";
      }
    }
  }
  return null;
}
