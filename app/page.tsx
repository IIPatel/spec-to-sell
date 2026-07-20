"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import JSZip from "jszip";
import type Konva from "konva";
import type { InfographicCanvasProps } from "@/components/InfographicCanvas";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_COUNT,
  MAX_TOTAL_PHOTO_BYTES,
  validateAnalysisInput,
} from "@/lib/analysis-validation";
import { proposeBrandKit } from "@/lib/brand";
import { SAMPLE_IMAGE, SAMPLE_SPECS, sampleAnalysis } from "@/lib/sample";
import { buildStoryboard } from "@/lib/storyboard";
import type { AnalysisResult, BrandKit, Fact, GeneratedVisual, Slide, VisualMode } from "@/lib/types";

const InfographicCanvas = dynamic<InfographicCanvasProps>(
  () => import("@/components/InfographicCanvas").then((module) => module.InfographicCanvas),
  { ssr: false, loading: () => <div className="canvas-loading">Preparing the artboard…</div> },
);

type BrandInput = {
  name: string;
  description: string;
  preferredColor: string;
  logo?: string;
};

type StatusTone = "info" | "success" | "error";

const steps = ["Brand", "Evidence", "Review", "Export"];
const starter = sampleAnalysis();

function dataUrlToBlob(dataUrl: string) {
  const [meta = "", data = ""] = dataUrl.split(",");
  return new Blob(
    [Uint8Array.from(atob(data), (character) => character.charCodeAt(0))],
    { type: meta.match(/:(.*?);/)?.[1] ?? "image/png" },
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("One vendor photo could not be read. Please try another file."));
    reader.readAsDataURL(file);
  });
}

async function rasterizeDemoSource() {
  const response = await fetch(SAMPLE_IMAGE);
  const svg = await response.text();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const source = new Image();
      source.onload = () => resolve(source);
      source.onerror = () => reject(new Error("The demo source could not be prepared."));
      source.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The demo source could not be prepared.");
    context.drawImage(image, 0, 0, 1024, 1024);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The demo source could not be prepared.");
    return new File([blob], "harbor-muse-vendor-tote.png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function Home() {
  const [brandInput, setBrandInput] = useState<BrandInput>({
    name: starter.brandKit.name,
    description: starter.brandKit.description,
    preferredColor: starter.brandKit.preferredColor ?? "#A34E38",
  });
  const [brand, setBrand] = useState<BrandKit>(starter.brandKit);
  const [specifications, setSpecifications] = useState(SAMPLE_SPECS);
  const [photos, setPhotos] = useState<string[]>([SAMPLE_IMAGE]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [facts, setFacts] = useState<Fact[]>(starter.facts);
  const [slides, setSlides] = useState<Slide[]>(starter.slides);
  const [activeIndex, setActiveIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState("Demo listing ready. Explore the proof trail or generate an AI-composed product visual from the supplied vendor reference.");
  const [statusTone, setStatusTone] = useState<StatusTone>("info");
  const [loading, setLoading] = useState(false);
  const [generatingVisual, setGeneratingVisual] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [sellerEvidence, setSellerEvidence] = useState<Record<string, string>>({});
  const [generatedVisuals, setGeneratedVisuals] = useState<Record<string, GeneratedVisual>>({});
  const stageRef = useRef<Konva.Stage | null>(null);

  const supportedCount = facts.filter((fact) => fact.status === "supported").length;
  const reviewCount = facts.filter((fact) => fact.status === "needs_review").length;
  const active = slides[activeIndex] ?? slides[0];
  const activeFacts = useMemo(() => active
    ? active.factIds.map((id) => facts.find((fact) => fact.id === id)).filter((fact): fact is Fact => Boolean(fact && fact.status === "supported")).slice(0, 3)
    : [], [active, facts]);
  const activeGeneratedVisual = active ? generatedVisuals[active.id] : undefined;
  const activePhoto = activeGeneratedVisual?.dataUrl ?? (active ? photos[active.photoIndex] ?? photos[0] : undefined);
  const visualMode: VisualMode = activeGeneratedVisual ? "ai_composed" : "source";
  const aiVisualCount = Object.keys(generatedVisuals).length;
  const listingNarrative = useMemo(() => {
    if (!slides.length) return "Approve source-backed claims to create a listing set.";
    return `${slides.length} planned listing visuals, built from ${supportedCount} source-backed claims.`;
  }, [slides.length, supportedCount]);

  function setMessage(message: string, tone: StatusTone = "info") {
    setStatus(message);
    setStatusTone(tone);
  }

  function approveBrand() {
    const nextBrand = proposeBrandKit(brandInput);
    setBrand(nextBrand);
    setCurrentStep(1);
    setMessage("Brand direction saved. It now controls the art direction and the exact typography layered on every visual.", "success");
  }

  function applySample() {
    const demo = sampleAnalysis();
    setBrandInput({ name: demo.brandKit.name, description: demo.brandKit.description, preferredColor: demo.brandKit.preferredColor ?? "#A34E38" });
    setBrand(demo.brandKit);
    setSpecifications(SAMPLE_SPECS);
    setPhotos([SAMPLE_IMAGE]);
    setPhotoFiles([]);
    setFacts(demo.facts);
    setSlides(demo.slides);
    setGeneratedVisuals({});
    setSellerEvidence({});
    setActiveIndex(0);
    setCurrentStep(2);
    setCanvasReady(false);
    setMessage("Demo source reset. Generate a GPT Image 2 visual to see the premium, vendor-referenced workflow.", "success");
  }

  function startNewProduct() {
    setSpecifications("");
    setPhotos([]);
    setPhotoFiles([]);
    setFacts([]);
    setSlides([]);
    setGeneratedVisuals({});
    setSellerEvidence({});
    setActiveIndex(0);
    setCurrentStep(0);
    setCanvasReady(false);
    setMessage("New listing started. Begin with a brand direction, then add only vendor photos and supplier specifications you are allowed to use.", "info");
  }

  async function photoUpload(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    if (selected.length > MAX_PHOTO_COUNT) return setMessage("Choose up to eight vendor photos at a time.", "error");
    if (selected.some((file) => !ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number]))) return setMessage("Vendor photos must be JPG, PNG, or WebP files.", "error");
    if (selected.some((file) => file.size > MAX_PHOTO_BYTES)) return setMessage("Each vendor photo must be 1.25 MB or smaller.", "error");
    if (selected.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_PHOTO_BYTES) return setMessage("Keep all vendor photos under 8 MB in total.", "error");

    try {
      setPhotos(await Promise.all(selected.map(readFileAsDataUrl)));
      setPhotoFiles(selected);
      setSlides([]);
      setGeneratedVisuals({});
      setActiveIndex(0);
      setCanvasReady(false);
      setMessage(`${selected.length} vendor ${selected.length === 1 ? "photo is" : "photos are"} ready. GPT Image 2 will use them only as high-fidelity product references.`, "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Vendor photos could not be read.", "error");
    }
  }

  function logoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) return setMessage("Use a JPG, PNG, or WebP logo.", "error");
    readFileAsDataUrl(file)
      .then((logo) => {
        setBrandInput((current) => ({ ...current, logo }));
        setMessage("Logo added. Approve the brand direction to use it in the listing set.", "success");
      })
      .catch(() => setMessage("Logo could not be read. Please try another file.", "error"));
  }

  async function analyze() {
    const validation = validateAnalysisInput({
      brandName: brandInput.name,
      brandDescription: brandInput.description,
      specifications,
      files: photoFiles.map((file) => ({ name: file.name, type: file.type, size: file.size })),
    });
    if (!validation.ok) {
      setCurrentStep(1);
      setMessage(validation.message, "error");
      return;
    }

    setLoading(true);
    setMessage("Reading the supplier proof trail. Only claims with an exact supplier citation can appear in your listing.", "info");
    try {
      const form = new FormData();
      form.set("brandName", brandInput.name);
      form.set("brandDescription", brandInput.description);
      form.set("preferredColor", brandInput.preferredColor);
      form.set("specifications", specifications);
      photoFiles.forEach((file) => form.append("photos", file));
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const result = await response.json() as AnalysisResult & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Analysis could not be completed.");

      setBrand(result.brandKit);
      setFacts(result.facts);
      setSlides(result.slides);
      setGeneratedVisuals({});
      setActiveIndex(0);
      setSellerEvidence({});
      setCanvasReady(false);
      setCurrentStep(result.slides.length ? 2 : 1);
      setMessage(result.explanation, "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analysis failed. Check your supplier input and retry.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function generationFiles() {
    return photoFiles.length ? photoFiles : [await rasterizeDemoSource()];
  }

  async function generateVisual() {
    if (!active || !activeFacts.length) {
      setMessage("Choose a planned slide with at least one source-backed claim before generating its visual.", "error");
      return;
    }
    setGeneratingVisual(true);
    setMessage("GPT Image 2 is art-directing this visual from the vendor references. Exact text and citations remain layered by Spec-to-Sell.", "info");
    try {
      const files = await generationFiles();
      const form = new FormData();
      form.set("brandName", brandInput.name);
      form.set("brandDescription", brandInput.description);
      form.set("preferredColor", brandInput.preferredColor);
      form.set("specifications", specifications);
      form.set("slide", JSON.stringify({ title: active.title, kicker: active.kicker, layout: active.layout }));
      form.set("facts", JSON.stringify(activeFacts.map((fact) => ({ claim: fact.claim, status: fact.status, evidence: fact.evidence }))));
      files.forEach((file) => form.append("photos", file));
      const response = await fetch("/api/generate-visual", { method: "POST", body: form });
      const result = response.headers.get("content-type")?.includes("application/json")
        ? await response.json() as { visual?: string; model?: "gpt-image-2"; sourcePhotoCount?: number; error?: string }
        : { error: response.status === 504 ? "Image rendering took too long. Please try again." : "The AI visual service returned an unexpected response. Please try again." };
      if (!response.ok || !result.visual || !result.model || !result.sourcePhotoCount) throw new Error(result.error ?? "The AI visual could not be created.");
      setGeneratedVisuals((current) => ({
        ...current,
        [active.id]: { dataUrl: result.visual!, mode: "ai_composed", model: result.model!, sourcePhotoCount: result.sourcePhotoCount! },
      }));
      setCanvasReady(false);
      setMessage("AI-composed visual ready. The product was referenced from your vendor photos; all text on the artboard is still evidence-backed and exact.", "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The AI visual could not be created.", "error");
    } finally {
      setGeneratingVisual(false);
    }
  }

  function addEvidenceAndApprove(id: string) {
    const quote = sellerEvidence[id]?.trim();
    if (!quote) return setMessage("Paste the exact supplier sentence that supports this claim before approving it.", "error");
    setFacts((current) => current.map((fact) => fact.id === id ? {
      ...fact,
      status: "supported",
      evidence: [...fact.evidence, { sourceType: "supplier_text", quote }],
      conflict: undefined,
      confirmedBySeller: true,
    } : fact));
    setSellerEvidence((current) => ({ ...current, [id]: "" }));
    setGeneratedVisuals({});
    setMessage("Citation added. Re-plan the story to make the newly supported claim eligible for a slide.", "success");
  }

  function regenerateStoryboard() {
    const next = buildStoryboard(facts, Math.max(1, photos.length));
    setSlides(next);
    setGeneratedVisuals({});
    setActiveIndex(0);
    setCanvasReady(false);
    if (!next.length) {
      setCurrentStep(2);
      setMessage("No slides yet. Add source evidence to at least one claim before planning your listing set.", "error");
      return;
    }
    setCurrentStep(3);
    setMessage(`${next.length} listing visuals have been planned from the current supplier-backed evidence.`, "success");
  }

  function removeSlide(id: string) {
    const next = slides.filter((slide) => slide.id !== id);
    setSlides(next);
    setGeneratedVisuals((current) => {
      const { [id]: removed, ...remaining } = current;
      return remaining;
    });
    setActiveIndex(Math.max(0, Math.min(activeIndex, next.length - 1)));
    setCanvasReady(false);
    setMessage(next.length ? "Slide removed. Your remaining visual set is intact." : "All slides were removed. Re-plan when you are ready.", "info");
  }

  function exportCurrent() {
    const uri = stageRef.current?.toDataURL({ pixelRatio: 2 });
    if (!uri || !active) return setMessage("The artboard is still preparing. Try export again in a moment.", "error");
    const link = document.createElement("a");
    link.href = uri;
    link.download = `spec-to-sell-${String(activeIndex + 1).padStart(2, "0")}.png`;
    link.click();
    setMessage("Downloaded the current 2000 × 2000 PNG listing visual.", "success");
  }

  async function exportZip() {
    if (!slides.length || !stageRef.current) return setMessage("Create a listing set before exporting.", "error");
    const originalIndex = activeIndex;
    const zip = new JSZip();
    setExporting(true);
    setMessage(`Rendering ${slides.length} polished 2000 × 2000 PNGs…`, "info");
    try {
      for (let index = 0; index < slides.length; index += 1) {
        setActiveIndex(index);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const uri = stageRef.current?.toDataURL({ pixelRatio: 2 });
        if (uri) zip.file(`spec-to-sell-${String(index + 1).padStart(2, "0")}.png`, dataUrlToBlob(uri));
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "spec-to-sell-listing-visuals.zip";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 500);
      setMessage("Downloaded your full PNG listing set.", "success");
    } catch {
      setMessage("The ZIP could not be created. Please try again.", "error");
    } finally {
      setActiveIndex(originalIndex);
      setExporting(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand-lockup" type="button" onClick={applySample} aria-label="Load Spec-to-Sell demo">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Spec-to-Sell</span>
        </button>
        <div className="topbar-actions">
          <span className="topbar-status"><i aria-hidden="true" /> Claim proof on</span>
          <button className="button button--quiet" type="button" onClick={startNewProduct}>New listing</button>
          <button className="button button--dark" type="button" onClick={applySample}>Open demo</button>
        </div>
      </header>

      <section className="studio-intro" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">AI art direction + a proof trail</p>
          <h1 id="page-title">Product visuals that <em>sell</em> without making things up.</h1>
          <p>Turn supplier proof and vendor photos into polished listing images. GPT Image 2 gives each product a premium visual direction; Spec-to-Sell keeps the claim layer exact and cited.</p>
        </div>
        <div className="intro-proof">
          <span>THE PROMISE</span>
          <strong>Product reference in.<br />Evidence-backed listing out.</strong>
          <small>Visuals are labelled when AI-composed from vendor references.</small>
        </div>
      </section>

      <section className="proof-rail" aria-label="Product safeguards">
        <span><b>01</b> Vendor image reference</span>
        <span><b>02</b> Source-cited product claims</span>
        <span><b>03</b> GPT Image 2 art direction</span>
        <span><b>04</b> Exact text in export</span>
      </section>

      <div className="studio-grid">
        <section className="artboard-pane" aria-labelledby="preview-title">
          <div className="artboard-header">
            <div>
              <p className="section-kicker">Listing visual studio</p>
              <h2 id="preview-title">{active ? `${String(activeIndex + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")} — ${active.kicker}` : "Your canvas is waiting"}</h2>
            </div>
            <span className={`visual-chip visual-chip--${visualMode}`}>
              <i aria-hidden="true" /> {visualMode === "ai_composed" ? "AI-composed" : "Vendor source"}
            </span>
          </div>

          <div className="canvas-frame">
            {active ? (
              <InfographicCanvas
                brand={brand}
                slide={active}
                facts={facts}
                photo={activePhoto}
                visualMode={visualMode}
                onStageReady={(stage) => { stageRef.current = stage; setCanvasReady(true); }}
              />
            ) : (
              <div className="preview-empty">
                <span aria-hidden="true">✦</span>
                <h3>Make the first visual feel inevitable.</h3>
                <p>Add supplier proof and a vendor photo. The artboard will take shape as the product story becomes clear.</p>
                <button className="button button--dark" type="button" onClick={applySample}>Explore the demo</button>
              </div>
            )}
          </div>

          <div className="artboard-footer">
            <div>
              <span className="meta-label">Visual mode</span>
              <strong>{visualMode === "ai_composed" ? "GPT Image 2 + exact text overlay" : "Original vendor source + exact text overlay"}</strong>
            </div>
            <div>
              <span className="meta-label">Evidence</span>
              <strong>{supportedCount} proven / {reviewCount} held</strong>
            </div>
            <div>
              <span className="meta-label">AI visuals</span>
              <strong>{aiVisualCount} of {slides.length}</strong>
            </div>
          </div>

          {active && (
            <div className="ai-control">
              <div>
                <span className="section-kicker">Art-direct active visual</span>
                <h3>{activeGeneratedVisual ? "Refine with a new AI composition" : "Give this slide a premium GPT Image 2 composition"}</h3>
                <p>The model receives the vendor photos as high-fidelity references. It never receives permission to add claims; exact type is rendered separately.</p>
              </div>
              <button className="button button--glow" type="button" onClick={generateVisual} disabled={generatingVisual || !activeFacts.length}>
                {generatingVisual ? "Generating visual…" : activeGeneratedVisual ? "Regenerate visual" : "Generate AI visual"}
              </button>
            </div>
          )}

          {slides.length > 0 && (
            <div className="thumbnail-rail" role="tablist" aria-label="Listing visual sequence">
              {slides.map((slide, index) => (
                <button key={slide.id} className={`thumbnail ${index === activeIndex ? "is-active" : ""}`} type="button" role="tab" aria-selected={index === activeIndex} onClick={() => { setActiveIndex(index); setCanvasReady(false); }}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{slide.kicker}</b>
                  <small>{generatedVisuals[slide.id] ? "AI visual ready" : "Vendor source"}</small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="workflow-pane" aria-labelledby="workflow-title">
          <div className="workflow-heading">
            <div>
              <p className="section-kicker">Project flow</p>
              <h2 id="workflow-title">Build the listing set.</h2>
            </div>
            <span>Step {currentStep + 1} / {steps.length}</span>
          </div>
          <ol className="progress-nav" aria-label="Listing workflow">
            {steps.map((step, index) => (
              <li key={step} className={`${index === currentStep ? "is-current " : ""}${index < currentStep ? "is-complete" : ""}`}>
                <button type="button" onClick={() => setCurrentStep(index)} aria-current={index === currentStep ? "step" : undefined}>
                  <b>{String(index + 1).padStart(2, "0")}</b>{step}
                </button>
              </li>
            ))}
          </ol>

          <div className={`app-status app-status--${statusTone}`} role="status" aria-live="polite">
            <span aria-hidden="true">{statusTone === "success" ? "✓" : statusTone === "error" ? "!" : "i"}</span>
            <p>{status}</p>
          </div>

          {currentStep === 0 && (
            <section className="step-card" aria-labelledby="brand-step-title">
              <div className="step-intro">
                <p className="section-kicker">01 / Brand direction</p>
                <h3 id="brand-step-title">Set a point of view, not just a color.</h3>
                <p>This brief steers GPT Image 2’s composition and controls the precise typography on every exported artboard.</p>
              </div>
              <div className="form-grid">
                <div className="field field--wide">
                  <label htmlFor="brand-name">Brand or shop name</label>
                  <input id="brand-name" className="input" value={brandInput.name} maxLength={80} onChange={(event) => setBrandInput({ ...brandInput, name: event.target.value })} />
                </div>
                <div className="field field--wide">
                  <label htmlFor="brand-description">What should the product world feel like?</label>
                  <textarea id="brand-description" className="input textarea" value={brandInput.description} maxLength={1000} onChange={(event) => setBrandInput({ ...brandInput, description: event.target.value })} />
                  <p className="field-hint">Example: “quiet coastal gifts for unhurried everyday rituals.”</p>
                </div>
                <div className="field">
                  <label htmlFor="brand-color">Signature accent</label>
                  <div className="color-field"><input id="brand-color" type="color" value={brandInput.preferredColor} onChange={(event) => setBrandInput({ ...brandInput, preferredColor: event.target.value })} /><span>{brandInput.preferredColor.toUpperCase()}</span></div>
                </div>
                <div className="field">
                  <label htmlFor="brand-logo">Optional logo</label>
                  <input id="brand-logo" className="file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={logoUpload} />
                </div>
              </div>
              <div className="brand-summary" style={{ borderColor: brand.palette.accent }}>
                <span className="meta-label">Current direction</span><strong>{brand.name}</strong><p>{brand.voice.join(" · ")} · {brand.imageTreatment}</p>
              </div>
              <div className="step-actions"><button className="button button--dark" type="button" onClick={approveBrand}>Save brand direction</button></div>
            </section>
          )}

          {currentStep === 1 && (
            <section className="step-card" aria-labelledby="evidence-step-title">
              <div className="step-intro">
                <p className="section-kicker">02 / Supplier evidence</p>
                <h3 id="evidence-step-title">Give the model a product it can respect.</h3>
                <p>Use the vendor’s real images and factual specifications. This evidence determines what can become listing text and what can guide the visual composition.</p>
              </div>
              <div className="field">
                <label htmlFor="specifications">Supplier specifications</label>
                <textarea id="specifications" className="input textarea textarea--tall" value={specifications} maxLength={8000} onChange={(event) => setSpecifications(event.target.value)} aria-describedby="specifications-hint" />
                <p id="specifications-hint" className="field-hint">{specifications.length}/8000 · Include materials, dimensions, care, options, and production details exactly as supplied.</p>
              </div>
              <div className="upload-card">
                <div><span className="upload-number">1—8</span><h4>Vendor product photos</h4><p>JPG, PNG, or WebP. Photos are sent to GPT Image 2 only as product references—never replaced with an unrelated product.</p></div>
                <label className="upload-control" htmlFor="vendor-photos"><span>Upload photos</span><input id="vendor-photos" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={photoUpload} /></label>
              </div>
              {photoFiles.length > 0 && <ul className="file-list" aria-label="Selected vendor photos">{photoFiles.map((file) => <li key={file.name + file.size}><span>Vendor ref</span><strong>{file.name}</strong><small>{Math.round(file.size / 1024)} KB</small></li>)}</ul>}
              {!photoFiles.length && photos.length > 0 && <div className="sample-note"><strong>Demo vendor source active.</strong> With an API key, even the packaged tote can be rasterized and used as a GPT Image 2 reference.</div>}
              <div className="step-actions step-actions--split">
                <button className="button button--soft" type="button" onClick={regenerateStoryboard} disabled={!facts.length}>Use existing proof</button>
                <button className="button button--dark" type="button" onClick={analyze} disabled={loading}>{loading ? "Reading evidence…" : "Analyze evidence"}</button>
              </div>
            </section>
          )}

          {currentStep === 2 && (
            <section className="step-card" aria-labelledby="review-step-title">
              <div className="step-intro step-intro--row">
                <div><p className="section-kicker">03 / Claim review</p><h3 id="review-step-title">No proof, no listing claim.</h3><p>AI art direction is optional; citation review is not. Held claims cannot enter the exported story.</p></div>
                <div className="review-counts"><span><b>{supportedCount}</b> proven</span><span><b>{reviewCount}</b> held</span></div>
              </div>
              {!facts.length ? (
                <div className="empty-state"><span aria-hidden="true">?</span><h4>No proof to review yet</h4><p>Analyze supplier input or open the demo to see this layer in action.</p><button className="button button--soft" type="button" onClick={() => setCurrentStep(1)}>Add supplier evidence</button></div>
              ) : (
                <div className="fact-list">
                  {facts.map((fact) => (
                    <article key={fact.id} className={`fact-card fact-card--${fact.status}`}>
                      <div className="fact-status"><span aria-hidden="true">{fact.status === "supported" ? "✓" : "!"}</span><p>{fact.status === "supported" ? "Proven" : "Needs proof"}</p></div>
                      <div className="fact-content">
                        <h4>{fact.claim}</h4>
                        {fact.status === "supported" ? <>{fact.evidence.map((evidence, index) => <blockquote key={fact.id + index}><span>{evidence.sourceType === "vendor_image" ? `Vendor photo ${(evidence.imageIndex ?? 0) + 1}` : "Supplier text"}</span>{evidence.quote}</blockquote>)}{fact.confirmedBySeller && <p className="seller-citation">Seller added this exact supplier citation.</p>}</> : <><p className="review-explanation">{fact.conflict ?? "This claim is missing supplier evidence."}</p><label className="citation-field" htmlFor={`citation-${fact.id}`}>Add the exact supplier sentence<textarea id={`citation-${fact.id}`} className="input textarea" value={sellerEvidence[fact.id] ?? ""} onChange={(event) => setSellerEvidence((current) => ({ ...current, [fact.id]: event.target.value }))} placeholder="Paste the vendor sentence that proves this claim" /></label><button className="text-button" type="button" onClick={() => addEvidenceAndApprove(fact.id)}>Approve with source</button></>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <div className="step-actions"><button className="button button--dark" type="button" onClick={regenerateStoryboard} disabled={!supportedCount}>Plan the listing story</button></div>
            </section>
          )}

          {currentStep === 3 && (
            <section className="step-card" aria-labelledby="export-step-title">
              <div className="step-intro step-intro--row">
                <div><p className="section-kicker">04 / Export</p><h3 id="export-step-title">A listing set with a reason for every frame.</h3><p>{listingNarrative}</p></div>
                <span className="source-lock">Proof layer on</span>
              </div>
              {!slides.length ? (
                <div className="empty-state"><span aria-hidden="true">✦</span><h4>No visuals planned</h4><p>At least one supported claim is required before a listing set can be created.</p><button className="button button--soft" type="button" onClick={() => setCurrentStep(2)}>Review proof</button></div>
              ) : (
                <>
                  <div className="slide-list" role="list" aria-label="Planned listing slides">
                    {slides.map((slide, index) => <div className="slide-row" key={slide.id}><button type="button" onClick={() => { setActiveIndex(index); setCanvasReady(false); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{slide.title}</strong><small>{generatedVisuals[slide.id] ? "AI-composed" : "Source visual"}</small></button><button className="remove-slide" type="button" aria-label={`Remove slide ${index + 1}`} onClick={() => removeSlide(slide.id)}>×</button></div>)}
                  </div>
                  {active && <div className="rationale-card"><span className="meta-label">Why this frame exists</span><strong>{active.title}</strong><p>{active.rationale}</p></div>}
                  <div className="export-panel"><div><span className="meta-label">Ready to deliver</span><strong>2000 × 2000 PNGs</strong><p>{aiVisualCount ? `${aiVisualCount} art-directed with GPT Image 2; remaining frames use the original vendor source.` : "Generate an AI visual for any frame, or export source-based visuals now."}</p></div><div className="export-actions"><button className="button button--soft" type="button" onClick={exportCurrent} disabled={!active || !canvasReady || exporting}>Current PNG</button><button className="button button--dark" type="button" onClick={exportZip} disabled={!slides.length || !canvasReady || exporting}>{exporting ? "Preparing ZIP…" : "Export ZIP"}</button></div></div>
                </>
              )}
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
