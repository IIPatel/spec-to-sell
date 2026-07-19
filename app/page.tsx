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
import type { AnalysisResult, BrandKit, Fact, Slide } from "@/lib/types";

const InfographicCanvas = dynamic<InfographicCanvasProps>(
  () => import("@/components/InfographicCanvas").then((module) => module.InfographicCanvas),
  {
    ssr: false,
    loading: () => <div className="canvas-loading">Preparing your listing preview...</div>,
  },
);

type BrandInput = {
  name: string;
  description: string;
  preferredColor: string;
  logo?: string;
};

type StatusTone = "info" | "success" | "error";

const steps = ["Brand", "Supplier evidence", "Review", "Export"];
const starter = sampleAnalysis();

function dataUrlToBlob(dataUrl: string) {
  const parts = dataUrl.split(",");
  const meta = parts[0] ?? "";
  const data = parts[1] ?? "";
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
  const [status, setStatus] = useState("Demo tote ready. Explore the evidence review or replace it with your own supplier input.");
  const [statusTone, setStatusTone] = useState<StatusTone>("info");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [sellerEvidence, setSellerEvidence] = useState<Record<string, string>>({});
  const stageRef = useRef<Konva.Stage | null>(null);

  const supportedCount = facts.filter((fact) => fact.status === "supported").length;
  const reviewCount = facts.filter((fact) => fact.status === "needs_review").length;
  const active = slides[activeIndex] ?? slides[0];
  const listingNarrative = useMemo(() => {
    if (!slides.length) return "Approve source-backed claims to create a listing set.";
    return slides.length + " slides generated from " + supportedCount + " supported claims, each focused on a clear product detail.";
  }, [slides.length, supportedCount]);

  function setMessage(message: string, tone: StatusTone = "info") {
    setStatus(message);
    setStatusTone(tone);
  }

  function approveBrand() {
    const nextBrand = proposeBrandKit(brandInput);
    setBrand(nextBrand);
    setCurrentStep(1);
    setMessage("Brand kit approved. Palette, typography, spacing, and image treatment now stay consistent across every slide.", "success");
  }

  function applySample() {
    const demo = sampleAnalysis();
    setBrandInput({
      name: demo.brandKit.name,
      description: demo.brandKit.description,
      preferredColor: demo.brandKit.preferredColor ?? "#A34E38",
    });
    setBrand(demo.brandKit);
    setSpecifications(SAMPLE_SPECS);
    setPhotos([SAMPLE_IMAGE]);
    setPhotoFiles([]);
    setFacts(demo.facts);
    setSlides(demo.slides);
    setSellerEvidence({});
    setActiveIndex(0);
    setCurrentStep(2);
    setCanvasReady(false);
    setMessage("Loaded the source-locked tote sample. One unsupported claim remains held for review.", "success");
  }

  function startNewProduct() {
    setSpecifications("");
    setPhotos([]);
    setPhotoFiles([]);
    setFacts([]);
    setSlides([]);
    setSellerEvidence({});
    setActiveIndex(0);
    setCurrentStep(1);
    setCanvasReady(false);
    setMessage("New product started. Add only vendor photos and supplier specifications you are allowed to use.", "info");
  }

  async function photoUpload(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    if (selected.length > MAX_PHOTO_COUNT) {
      setMessage("Choose up to eight vendor photos at a time.", "error");
      return;
    }
    if (selected.some((file) => !ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number]))) {
      setMessage("Vendor photos must be JPG, PNG, or WebP files.", "error");
      return;
    }
    if (selected.some((file) => file.size > MAX_PHOTO_BYTES)) {
      setMessage("Each vendor photo must be 1.25 MB or smaller.", "error");
      return;
    }
    if (selected.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_PHOTO_BYTES) {
      setMessage("Keep all vendor photos under 8 MB in total.", "error");
      return;
    }

    try {
      const urls = await Promise.all(selected.map(readFileAsDataUrl));
      setPhotoFiles(selected);
      setPhotos(urls);
      setSlides([]);
      setActiveIndex(0);
      setCanvasReady(false);
      setMessage(selected.length + " vendor photo" + (selected.length === 1 ? " is" : "s are") + " ready. Photos stay source locked; this app never generates or edits the product.", "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Vendor photos could not be read.", "error");
    }
  }

  function logoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      setMessage("Use a JPG, PNG, or WebP logo.", "error");
      return;
    }
    readFileAsDataUrl(file)
      .then((logo) => {
        setBrandInput((current) => ({ ...current, logo }));
        setMessage("Logo added. Approve the brand kit to apply it to every exported slide.", "success");
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
    setMessage("Reading supplier evidence with GPT-5.6 Terra. Only claims with exact source evidence will be ready for your listing.", "info");
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

  function addEvidenceAndApprove(id: string) {
    const quote = sellerEvidence[id]?.trim();
    if (!quote) {
      setMessage("Paste the exact supplier sentence that supports this claim before approving it.", "error");
      return;
    }

    setFacts((current) => current.map((fact) => (
      fact.id === id
        ? {
          ...fact,
          status: "supported",
          evidence: [...fact.evidence, { sourceType: "supplier_text", quote }],
          conflict: undefined,
          confirmedBySeller: true,
        }
        : fact
    )));
    setSellerEvidence((current) => ({ ...current, [id]: "" }));
    setMessage("Supplier citation added. Re-plan the listing set to include this newly supported claim.", "success");
  }

  function regenerateStoryboard() {
    const next = buildStoryboard(facts, Math.max(1, photos.length));
    setSlides(next);
    setActiveIndex(0);
    setCanvasReady(false);
    if (!next.length) {
      setCurrentStep(2);
      setMessage("No listing slides yet. Add source evidence to at least one claim before planning your set.", "error");
      return;
    }
    setCurrentStep(3);
    setMessage(next.length + " slides suggested from the current supplier-backed evidence.", "success");
  }

  function removeSlide(id: string) {
    const next = slides.filter((slide) => slide.id !== id);
    setSlides(next);
    setActiveIndex(Math.max(0, Math.min(activeIndex, next.length - 1)));
    setCanvasReady(false);
    setMessage(next.length ? "Slide removed. Your remaining listing set is still source locked." : "All slides were removed. Re-plan when you are ready.", "info");
  }

  function exportCurrent() {
    const uri = stageRef.current?.toDataURL({ pixelRatio: 2 });
    if (!uri || !active) {
      setMessage("The listing preview is still preparing. Try export again in a moment.", "error");
      return;
    }
    const link = document.createElement("a");
    link.href = uri;
    link.download = "spec-to-sell-" + String(activeIndex + 1).padStart(2, "0") + ".png";
    link.click();
    setMessage("Downloaded the current 2000 x 2000 PNG slide.", "success");
  }

  async function exportZip() {
    if (!slides.length || !stageRef.current) {
      setMessage("Create a listing set before exporting.", "error");
      return;
    }
    const originalIndex = activeIndex;
    const zip = new JSZip();
    setExporting(true);
    setMessage("Rendering " + slides.length + " brand-locked 2000 x 2000 PNGs...", "info");
    try {
      for (let index = 0; index < slides.length; index += 1) {
        setActiveIndex(index);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const uri = stageRef.current?.toDataURL({ pixelRatio: 2 });
        if (uri) {
          zip.file(
            "spec-to-sell-" + String(index + 1).padStart(2, "0") + ".png",
            dataUrlToBlob(uri),
          );
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "spec-to-sell-infographics.zip";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 500);
      setMessage("Downloaded a ZIP of " + slides.length + " source-locked listing slides.", "success");
    } catch {
      setMessage("The ZIP could not be created. Please try again.", "error");
    } finally {
      setActiveIndex(originalIndex);
      setExporting(false);
    }
  }

  return (
    <main className="shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Evidence-locked listing visuals</p>
          <h1>Spec-to-Sell</h1>
          <p className="lede">Turn vendor facts into a clear product story, without inventing a single product image or claim.</p>
        </div>
        <div className="header-actions">
          <button className="button button--quiet" type="button" onClick={startNewProduct}>New product</button>
          <button className="button button--soft" type="button" onClick={applySample}>Load demo tote</button>
        </div>
      </header>

      <section className="trust-banner" aria-label="Evidence policy">
        <span className="trust-mark" aria-hidden="true">01</span>
        <div>
          <strong>Supplier truth stays visible.</strong>
          <p>Vendor photos are source locked. Every exportable claim needs an exact supplier citation.</p>
        </div>
        <span className="trust-badge">No image generation</span>
      </section>

      <div className="studio-shell">
        <section className="preview-pane" aria-labelledby="preview-title">
          <div className="preview-heading">
            <div>
              <p className="section-kicker">Live listing preview</p>
              <h2 id="preview-title">{active ? "Slide " + String(activeIndex + 1).padStart(2, "0") + " of " + String(slides.length).padStart(2, "0") : "Awaiting evidence"}</h2>
            </div>
            <span className={"status-chip status-chip--" + (slides.length ? "ready" : "pending")}>
              <span aria-hidden="true">{slides.length ? "OK" : "..."}</span>
              {slides.length ? "Ready to export" : "Evidence needed"}
            </span>
          </div>

          <div className="canvas-frame">
            {active ? (
              <InfographicCanvas
                brand={brand}
                slide={active}
                facts={facts}
                photo={photos[active.photoIndex] ?? photos[0]}
                onStageReady={(stage) => {
                  stageRef.current = stage;
                  setCanvasReady(true);
                }}
              />
            ) : (
              <div className="preview-empty">
                <span aria-hidden="true">+</span>
                <h3>Your product story will appear here</h3>
                <p>Start with supplier photos and product specifications. The preview will never substitute AI-made product imagery.</p>
              </div>
            )}
          </div>

          <div className="preview-meta">
            <div>
              <span className="meta-label">Product imagery</span>
              <strong>{photos.length ? photos.length + " vendor source" + (photos.length === 1 ? "" : "s") : "No source image yet"}</strong>
            </div>
            <div>
              <span className="meta-label">Claims ready</span>
              <strong>{supportedCount + " of " + facts.length}</strong>
            </div>
            <div>
              <span className="meta-label">Brand system</span>
              <strong>Locked</strong>
            </div>
          </div>
        </section>

        <section className="workflow-pane" aria-labelledby="workflow-title">
          <div className="workflow-heading">
            <div>
              <p className="section-kicker">Guided studio</p>
              <h2 id="workflow-title">Build a trusted listing set</h2>
            </div>
            <span className="progress-count">Step {currentStep + 1} of {steps.length}</span>
          </div>

          <ol className="progress-nav" aria-label="Listing workflow">
            {steps.map((step, index) => (
              <li key={step} className={(index === currentStep ? "is-current " : "") + (index < currentStep ? "is-complete" : "")}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  aria-current={index === currentStep ? "step" : undefined}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {step}
                </button>
              </li>
            ))}
          </ol>

          <div className={"app-status app-status--" + statusTone} role="status" aria-live="polite">
            <span aria-hidden="true">{statusTone === "success" ? "OK" : statusTone === "error" ? "!" : "i"}</span>
            <p>{status}</p>
          </div>

          {currentStep === 0 && (
            <section className="step-card" aria-labelledby="brand-step-title">
              <div className="step-intro">
                <p className="section-kicker">01 / Brand</p>
                <h3 id="brand-step-title">Set the visual system once</h3>
                <p>Your shop identity sets the palette and presentation. It stays consistent through every exported slide.</p>
              </div>
              <div className="form-grid">
                <div className="field field--wide">
                  <label htmlFor="brand-name">Shop name</label>
                  <input id="brand-name" className="input" value={brandInput.name} maxLength={80} onChange={(event) => setBrandInput({ ...brandInput, name: event.target.value })} />
                </div>
                <div className="field field--wide">
                  <label htmlFor="brand-description">Brand description</label>
                  <textarea id="brand-description" className="input textarea" value={brandInput.description} maxLength={1000} onChange={(event) => setBrandInput({ ...brandInput, description: event.target.value })} />
                  <p className="field-hint">A short voice cue, such as "quiet coastal gifts for unhurried rituals."</p>
                </div>
                <div className="field">
                  <label htmlFor="brand-color">Preferred accent</label>
                  <div className="color-field">
                    <input id="brand-color" type="color" value={brandInput.preferredColor} onChange={(event) => setBrandInput({ ...brandInput, preferredColor: event.target.value })} />
                    <span>{brandInput.preferredColor.toUpperCase()}</span>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="brand-logo">Optional logo</label>
                  <input id="brand-logo" className="file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={logoUpload} />
                </div>
              </div>
              <div className="brand-summary" style={{ borderColor: brand.palette.accent }}>
                <span className="meta-label">Current approved kit</span>
                <strong>{brand.name}</strong>
                <p>{brand.voice.join(" / ")} / {brand.fontPair.heading} + {brand.fontPair.body} / {brand.imageTreatment}</p>
              </div>
              <div className="step-actions">
                <button className="button" type="button" onClick={approveBrand}>Approve brand kit</button>
              </div>
            </section>
          )}

          {currentStep === 1 && (
            <section className="step-card" aria-labelledby="evidence-step-title">
              <div className="step-intro">
                <p className="section-kicker">02 / Supplier evidence</p>
                <h3 id="evidence-step-title">Bring only what the vendor can prove</h3>
                <p>Upload the vendor's product photos and paste its factual specifications. The model can organize evidence, but it cannot fill gaps.</p>
              </div>
              <div className="field">
                <label htmlFor="specifications">Supplier specifications</label>
                <textarea id="specifications" className="input textarea textarea--tall" value={specifications} maxLength={8000} onChange={(event) => setSpecifications(event.target.value)} aria-describedby="specifications-hint" />
                <p id="specifications-hint" className="field-hint">{specifications.length}/8000 characters. Include materials, dimensions, care, options, and production details exactly as supplied.</p>
              </div>
              <div className="upload-card">
                <div>
                  <span className="upload-number">1-8</span>
                  <h4>Vendor product photos</h4>
                  <p>JPG, PNG, or WebP. Up to 1.25 MB each and 8 MB total. These sources are only placed, cropped, and scaled.</p>
                </div>
                <label className="upload-control" htmlFor="vendor-photos">
                  <span>Choose vendor photos</span>
                  <input id="vendor-photos" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={photoUpload} />
                </label>
              </div>
              {photoFiles.length > 0 && (
                <ul className="file-list" aria-label="Selected vendor photos">
                  {photoFiles.map((file) => <li key={file.name + file.size}><span>Source</span><strong>{file.name}</strong><small>{Math.round(file.size / 1024)} KB</small></li>)}
                </ul>
              )}
              {!photoFiles.length && photos.length > 0 && (
                <div className="sample-note"><strong>Demo source active.</strong> Load your own photos to run live analysis; the packaged tote sample remains available for no-key exploration.</div>
              )}
              <div className="step-actions step-actions--split">
                <button className="button button--soft" type="button" onClick={regenerateStoryboard} disabled={!facts.length}>Use approved evidence</button>
                <button className="button" type="button" onClick={analyze} disabled={loading}>
                  {loading ? "Analyzing source evidence..." : "Analyze source evidence"}
                </button>
              </div>
            </section>
          )}

          {currentStep === 2 && (
            <section className="step-card" aria-labelledby="review-step-title">
              <div className="step-intro step-intro--row">
                <div>
                  <p className="section-kicker">03 / Evidence review</p>
                  <h3 id="review-step-title">Review every claim before it earns a slide</h3>
                  <p>Supported claims include source evidence. Held claims stay out of the listing set until you add an exact supplier citation.</p>
                </div>
                <div className="review-counts" aria-label="Evidence summary">
                  <span><b>{supportedCount}</b> supported</span>
                  <span><b>{reviewCount}</b> held</span>
                </div>
              </div>
              {!facts.length ? (
                <div className="empty-state">
                  <span aria-hidden="true">?</span>
                  <h4>No evidence to review yet</h4>
                  <p>Analyze supplier input or load the demo tote to see the review workflow.</p>
                  <button className="button button--soft" type="button" onClick={() => setCurrentStep(1)}>Go to supplier evidence</button>
                </div>
              ) : (
                <div className="fact-list">
                  {facts.map((fact) => (
                    <article key={fact.id} className={"fact-card fact-card--" + fact.status}>
                      <div className="fact-status">
                        <span aria-hidden="true">{fact.status === "supported" ? "OK" : "!"}</span>
                        <p>{fact.status === "supported" ? "Source ready" : "Held for review"}</p>
                      </div>
                      <div className="fact-content">
                        <h4>{fact.claim}</h4>
                        {fact.status === "supported" ? (
                          <>
                            {fact.evidence.map((evidence, index) => (
                              <blockquote key={fact.id + index}>
                                <span>{evidence.sourceType === "vendor_image" ? "Vendor photo " + String((evidence.imageIndex ?? 0) + 1) : "Supplier text"}</span>
                                {evidence.quote}
                              </blockquote>
                            ))}
                            {fact.confirmedBySeller && <p className="seller-citation">Seller added a supplier citation.</p>}
                          </>
                        ) : (
                          <>
                            <p className="review-explanation">{fact.conflict ?? "This claim is missing supplier evidence."}</p>
                            <label className="citation-field" htmlFor={"citation-" + fact.id}>
                              Add the exact supplier sentence
                              <textarea id={"citation-" + fact.id} className="input textarea" value={sellerEvidence[fact.id] ?? ""} onChange={(event) => setSellerEvidence((current) => ({ ...current, [fact.id]: event.target.value }))} placeholder="Paste the vendor sentence that proves this claim" />
                            </label>
                            <button className="text-button" type="button" onClick={() => addEvidenceAndApprove(fact.id)}>Add source and approve</button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <div className="step-actions">
                <button className="button" type="button" onClick={regenerateStoryboard} disabled={!supportedCount}>Plan source-backed slides</button>
              </div>
            </section>
          )}

          {currentStep === 3 && (
            <section className="step-card" aria-labelledby="export-step-title">
              <div className="step-intro step-intro--row">
                <div>
                  <p className="section-kicker">04 / Export</p>
                  <h3 id="export-step-title">Finish the story, then ship the set</h3>
                  <p>{listingNarrative}</p>
                </div>
                <span className="source-lock">Source locked</span>
              </div>
              {!slides.length ? (
                <div className="empty-state">
                  <span aria-hidden="true">+</span>
                  <h4>No slides planned</h4>
                  <p>At least one supported claim is required before a listing set can be created.</p>
                  <button className="button button--soft" type="button" onClick={() => setCurrentStep(2)}>Review evidence</button>
                </div>
              ) : (
                <>
                  <div className="slide-tabs" role="tablist" aria-label="Listing slides">
                    {slides.map((slide, index) => (
                      <div className="slide-tab-wrap" key={slide.id}>
                        <button className={"slide-tab " + (activeIndex === index ? "is-active" : "")} type="button" role="tab" aria-selected={activeIndex === index} onClick={() => { setActiveIndex(index); setCanvasReady(false); }}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          {slide.kicker}
                        </button>
                        <button className="remove-slide" type="button" aria-label={"Remove slide " + String(index + 1)} onClick={() => removeSlide(slide.id)}>Remove</button>
                      </div>
                    ))}
                  </div>
                  {active && (
                    <div className="rationale-card">
                      <span className="meta-label">Why this slide exists</span>
                      <strong>{active.title}</strong>
                      <p>{active.rationale}</p>
                    </div>
                  )}
                  <div className="export-panel">
                    <div>
                      <span className="meta-label">Export quality</span>
                      <strong>2000 x 2000 PNGs</strong>
                      <p>Ready for marketplace listing galleries. Product imagery remains vendor supplied.</p>
                    </div>
                    <div className="export-actions">
                      <button className="button button--soft" type="button" onClick={exportCurrent} disabled={!active || !canvasReady || exporting}>Current PNG</button>
                      <button className="button" type="button" onClick={exportZip} disabled={!slides.length || !canvasReady || exporting}>{exporting ? "Preparing ZIP..." : "Export ZIP"}</button>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
