import type { Fact, Slide } from "./types";

const categoryLabel: Record<Fact["category"], string> = { material: "Made with intention", construction: "Built for daily use", dimensions: "The practical details", care: "Easy to care for", variant: "Made for your selection", customization: "Ready for your design", use: "Made for the moment" };

export function buildStoryboard(facts: Fact[], photoCount: number): Slide[] {
  const supported = facts.filter((fact) => fact.status === "supported");
  const byCategory = new Map<Fact["category"], Fact[]>();
  for (const fact of supported) byCategory.set(fact.category, [...(byCategory.get(fact.category) ?? []), fact]);
  const groups = [...byCategory.entries()].sort((a, b) => Number(b[1].some((f) => f.importance === "major")) - Number(a[1].some((f) => f.importance === "major")));
  const selected = groups.slice(0, 5);
  const firstFact = supported[0];
  const slides: Slide[] = [{ id: "hero", title: firstFact?.claim ?? "A considered product, clearly presented", kicker: "PRODUCT HIGHLIGHT", layout: "hero", factIds: firstFact ? [firstFact.id] : [], photoIndex: 0, rationale: "A single clear product promise anchors the set." }];
  selected.forEach(([category, items], index) => {
    const usable = items.filter((item) => item.importance === "major" || items.length > 1).slice(0, 3);
    if (!usable.length) return;
    slides.push({ id: `${category}-${index}`, title: categoryLabel[category], kicker: category.toUpperCase(), layout: category === "dimensions" ? "spec" : category === "care" ? "care" : "feature", factIds: usable.map((item) => item.id), photoIndex: Math.min(index, Math.max(0, photoCount - 1)), rationale: usable.length > 1 ? "Related evidence is grouped to keep the message scannable." : "One major supplier-backed detail earns its own slide." });
  });
  return slides.slice(0, 6);
}
