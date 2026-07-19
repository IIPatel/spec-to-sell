import { describe, expect, it } from "vitest";
import { proposeBrandKit, brandTokensMatch } from "./brand";
import { buildStoryboard } from "./storyboard";
import type { Fact } from "./types";

const fact = (id: string, category: Fact["category"], importance: Fact["importance"] = "major"): Fact => ({ id, claim: id, category, importance, status: "supported", confidence: 1, evidence: [{ sourceType: "supplier_text", quote: id }] });
describe("adaptive storyboard", () => {
  it("creates a compact two-slide set for sparse evidence", () => expect(buildStoryboard([fact("canvas", "material")], 1)).toHaveLength(2));
  it("caps a rich product at six slides", () => expect(buildStoryboard([fact("a", "material"), fact("b", "dimensions"), fact("c", "care"), fact("d", "variant"), fact("e", "customization"), fact("f", "use"), fact("g", "construction")], 2)).toHaveLength(6));
  it("does not place unreviewed facts", () => { const unsupported = { ...fact("unsafe", "use"), status: "needs_review" as const }; expect(buildStoryboard([unsupported], 1)).toEqual([]); });
});
describe("brand lock", () => {
  it("keeps the approved visual tokens consistent", () => { const kit = proposeBrandKit({ name: "Harbor", description: "Warm gifts", preferredColor: "#A34E38" }); expect(brandTokensMatch(kit, { ...kit, description: "A changed description" })).toBe(true); });
});
