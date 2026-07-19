export type FactStatus = "supported" | "needs_review";
export type Evidence = { sourceType: "supplier_text" | "vendor_image"; quote: string; imageIndex?: number };
export type Fact = { id: string; claim: string; category: "material" | "dimensions" | "care" | "variant" | "customization" | "use" | "construction"; importance: "major" | "minor"; status: FactStatus; confidence: number; evidence: Evidence[]; conflict?: string; confirmedBySeller?: boolean };
export type BrandKit = { name: string; description: string; logo?: string; preferredColor?: string; palette: { background: string; ink: string; accent: string; muted: string }; fontPair: { heading: string; body: string }; voice: string[]; spacingScale: "compact" | "relaxed"; cornerStyle: "soft" | "square"; imageTreatment: "clean crop" | "framed crop" };
export type Slide = { id: string; title: string; kicker: string; layout: "hero" | "feature" | "spec" | "care"; factIds: string[]; photoIndex: number; rationale: string };
export type AnalysisResult = { brandKit: BrandKit; facts: Fact[]; slides: Slide[]; explanation: string };
