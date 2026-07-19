import { proposeBrandKit } from "./brand";
import { buildStoryboard } from "./storyboard";
import type { AnalysisResult, Fact } from "./types";

export const SAMPLE_IMAGE = "/sample-vendor-tote.svg";
export const SAMPLE_SPECS = `Natural cotton canvas tote bag. Dimensions: 15 in x 16 in. Reinforced 20 in self-fabric handles. Spot clean only. Printed to order. Natural color only.`;
const facts: Fact[] = [
  { id: "canvas", claim: "Natural cotton canvas", category: "material", importance: "major", status: "supported", confidence: 0.98, evidence: [{ sourceType: "supplier_text", quote: "Natural cotton canvas tote bag." }] },
  { id: "size", claim: "15 in × 16 in", category: "dimensions", importance: "major", status: "supported", confidence: 0.99, evidence: [{ sourceType: "supplier_text", quote: "Dimensions: 15 in x 16 in." }] },
  { id: "handles", claim: "Reinforced 20 in handles", category: "construction", importance: "minor", status: "supported", confidence: 0.96, evidence: [{ sourceType: "supplier_text", quote: "Reinforced 20 in self-fabric handles." }] },
  { id: "care", claim: "Spot clean only", category: "care", importance: "major", status: "supported", confidence: 0.99, evidence: [{ sourceType: "supplier_text", quote: "Spot clean only." }] },
  { id: "print", claim: "Printed to order", category: "customization", importance: "minor", status: "supported", confidence: 0.97, evidence: [{ sourceType: "supplier_text", quote: "Printed to order." }] },
  { id: "waterproof", claim: "Waterproof for everyday weather", category: "use", importance: "major", status: "needs_review", confidence: 0.12, evidence: [], conflict: "The supplier text does not claim water resistance or waterproofing." },
];
export function sampleAnalysis(): AnalysisResult {
  const brandKit = proposeBrandKit({ name: "Harbor Muse", description: "Quiet, coastal gifts for unhurried everyday rituals.", preferredColor: "#A34E38" });
  return { brandKit, facts, slides: buildStoryboard(facts, 1), explanation: "Five supplier-backed themes support a five-slide listing set. One unsupported durability claim is held for seller review." };
}
