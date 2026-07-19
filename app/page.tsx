"use client";

import { ChangeEvent, useRef, useState } from "react";
import dynamic from "next/dynamic";
import JSZip from "jszip";
import type Konva from "konva";
import type { InfographicCanvasProps } from "@/components/InfographicCanvas";
import { proposeBrandKit } from "@/lib/brand";
import { buildStoryboard } from "@/lib/storyboard";
import { SAMPLE_IMAGE, SAMPLE_SPECS, sampleAnalysis } from "@/lib/sample";
import type { AnalysisResult, BrandKit, Fact, Slide } from "@/lib/types";

const InfographicCanvas = dynamic<InfographicCanvasProps>(() => import("@/components/InfographicCanvas").then((module) => module.InfographicCanvas), { ssr: false, loading: () => <div className="aspect-square animate-pulse bg-[#e9efe8]" /> });

type BrandInput = { name: string; description: string; preferredColor: string; logo?: string };
const starter = sampleAnalysis();

function dataUrlToBlob(dataUrl: string) { const [meta, data] = dataUrl.split(","); return new Blob([Uint8Array.from(atob(data), (char) => char.charCodeAt(0))], { type: meta.match(/:(.*?);/)?.[1] ?? "image/png" }); }

export default function Home() {
  const [brandInput, setBrandInput] = useState<BrandInput>({ name: starter.brandKit.name, description: starter.brandKit.description, preferredColor: starter.brandKit.preferredColor ?? "#A34E38" });
  const [brand, setBrand] = useState<BrandKit>(starter.brandKit);
  const [specifications, setSpecifications] = useState(SAMPLE_SPECS);
  const [photos, setPhotos] = useState<string[]>([SAMPLE_IMAGE]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [facts, setFacts] = useState<Fact[]>(starter.facts);
  const [slides, setSlides] = useState<Slide[]>(starter.slides);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState("Sample project ready — no API key needed to explore the export flow.");
  const [loading, setLoading] = useState(false);
  const stageRef = useRef<Konva.Stage>(null);

  const approveBrand = () => { setBrand(proposeBrandKit(brandInput)); setStatus("Brand kit approved. These palette, type, and spacing tokens are now locked across every slide."); };
  const applySample = () => { const demo = sampleAnalysis(); setBrandInput({ name: demo.brandKit.name, description: demo.brandKit.description, preferredColor: demo.brandKit.preferredColor ?? "#A34E38" }); setBrand(demo.brandKit); setSpecifications(SAMPLE_SPECS); setPhotos([SAMPLE_IMAGE]); setPhotoFiles([]); setFacts(demo.facts); setSlides(demo.slides); setActiveIndex(0); setStatus("Loaded the vendor-supplied tote sample and its evidence review."); };
  const photoUpload = (event: ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files ?? []).slice(0, 8); if (!files.length) return; Promise.all(files.map((file) => new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); }))).then((urls) => { setPhotoFiles(files); setPhotos(urls); setStatus(`${urls.length} vendor photo${urls.length === 1 ? "" : "s"} loaded. Product photos remain source-locked.`); }); };
  const logoUpload = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setBrandInput((current) => ({ ...current, logo: String(reader.result) })); reader.readAsDataURL(file); };
  const analyze = async () => {
    setLoading(true); setStatus("Analyzing supplier evidence with GPT-5.6 Terra…");
    try {
      const form = new FormData(); form.set("brandName", brandInput.name); form.set("brandDescription", brandInput.description); form.set("preferredColor", brandInput.preferredColor); form.set("specifications", specifications); photoFiles.forEach((file) => form.append("photos", file));
      const response = await fetch("/api/analyze", { method: "POST", body: form }); const result = await response.json(); if (!response.ok) throw new Error(result.error);
      const analysis = result as AnalysisResult; setBrand(analysis.brandKit); setFacts(analysis.facts); setSlides(analysis.slides); setActiveIndex(0); setStatus(analysis.explanation);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Analysis failed. Use the sample project or retry."); } finally { setLoading(false); }
  };
  const confirmFact = (id: string) => { setFacts((current) => current.map((fact) => fact.id === id ? { ...fact, status: "supported", confirmedBySeller: true } : fact)); setStatus("Seller confirmation recorded. Regenerate the storyboard to place the approved claim."); };
  const regenerateStoryboard = () => { const next = buildStoryboard(facts, photos.length); setSlides(next); setActiveIndex(0); setStatus(`${next.length} slides suggested from the current approved evidence.`); };
  const removeSlide = (id: string) => { const next = slides.filter((slide) => slide.id !== id); setSlides(next); setActiveIndex(Math.max(0, Math.min(activeIndex, next.length - 1))); };
  const exportCurrent = () => { const uri = stageRef.current?.toDataURL({ pixelRatio: 2 }); if (!uri) return; const a = document.createElement("a"); a.href = uri; a.download = `spec-to-sell-${activeIndex + 1}.png`; a.click(); };
  const exportZip = async () => { if (!slides.length) return; const original = activeIndex; const zip = new JSZip(); setStatus("Rendering 2000 × 2000 PNGs…"); for (let index = 0; index < slides.length; index += 1) { setActiveIndex(index); await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); const uri = stageRef.current?.toDataURL({ pixelRatio: 2 }); if (uri) zip.file(`spec-to-sell-${String(index + 1).padStart(2, "0")}.png`, dataUrlToBlob(uri)); } const blob = await zip.generateAsync({ type: "blob" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "spec-to-sell-infographics.zip"; a.click(); URL.revokeObjectURL(a.href); setActiveIndex(original); setStatus("Downloaded a ZIP of brand-locked 2000 × 2000 PNGs."); };
  const active = slides[activeIndex] ?? slides[0];

  return <main className="shell">
    <header className="mb-8 flex flex-col gap-4 border-b border-[#dce2d8] pb-6 md:flex-row md:items-end md:justify-between">
      <div><p className="mb-2 text-xs font-bold tracking-[.2em] text-[#a34e38]">EVIDENCE-LOCKED LISTING VISUALS</p><h1 className="m-0 font-serif text-5xl tracking-tight">Spec-to-Sell</h1><p className="mb-0 mt-3 max-w-2xl text-slate-600">Supplier assets establish product truth. Your approved brand kit establishes every visual decision.</p></div>
      <button className="button button--soft" onClick={applySample}>Load demo project</button>
    </header>
    <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
      <aside className="space-y-5">
        <section className="panel p-5"><div className="mb-4 flex items-center justify-between"><h2 className="m-0 text-lg font-bold">1. Brand setup</h2><span className="rounded-full bg-[#e9efe8] px-2 py-1 text-xs font-bold text-[#234233]">LOCKED KIT</span></div>
          <label className="label">Shop name<input className="input mt-1" value={brandInput.name} onChange={(e) => setBrandInput({ ...brandInput, name: e.target.value })} /></label>
          <label className="label mt-3">Brand description<textarea className="input mt-1 min-h-20" value={brandInput.description} onChange={(e) => setBrandInput({ ...brandInput, description: e.target.value })} /></label>
          <div className="mt-3 grid grid-cols-2 gap-3"><label className="label">Preferred color<input className="input mt-1 h-10 p-1" type="color" value={brandInput.preferredColor} onChange={(e) => setBrandInput({ ...brandInput, preferredColor: e.target.value })} /></label><label className="label">Optional logo<input className="input mt-1 h-10 p-1" type="file" accept="image/*" onChange={logoUpload} /></label></div>
          <button className="button mt-4 w-full" onClick={approveBrand}>Approve brand kit</button>
          <div className="mt-4 rounded-xl p-3 text-xs" style={{ background: brand.palette.muted }}><b>{brand.name}</b><br />{brand.voice.join(" · ")}<br />{brand.fontPair.heading} + {brand.fontPair.body} · {brand.imageTreatment}</div>
        </section>
        <section className="panel p-5"><h2 className="m-0 text-lg font-bold">2. Supplier evidence</h2><p className="mt-1 text-sm text-slate-600">Paste only vendor-backed facts. No product image is generated or transformed.</p>
          <label className="label mt-3">Supplier specifications<textarea className="input mt-1 min-h-35" value={specifications} onChange={(e) => setSpecifications(e.target.value)} /></label>
          <label className="label mt-3">Vendor photos (1–8)<input className="input mt-1" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={photoUpload} /></label>
          <div className="mt-3 flex gap-2"><button className="button flex-1" disabled={loading} onClick={analyze}>{loading ? "Analyzing…" : "Analyze live"}</button><button className="button button--soft" onClick={regenerateStoryboard}>Plan slides</button></div>
        </section>
        <section className="panel p-5"><div className="flex items-center justify-between"><h2 className="m-0 text-lg font-bold">3. Evidence review</h2><span className="text-xs text-slate-500">{facts.filter((fact) => fact.status === "supported").length}/{facts.length} ready</span></div>
          <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">{facts.map((fact) => <div key={fact.id} className={`rounded-xl border p-3 text-sm ${fact.status === "needs_review" ? "border-amber-300 bg-amber-50" : "border-[#dce2d8] bg-[#fbfdfb]"}`}><div className="flex gap-2"><span className="mt-0.5 text-xs">{fact.status === "supported" ? "✓" : "!"}</span><div className="min-w-0 flex-1"><b>{fact.claim}</b><p className="mb-0 mt-1 text-xs text-slate-600">{fact.evidence[0]?.quote || fact.conflict}</p>{fact.status === "needs_review" && <button className="mt-2 text-xs font-bold text-amber-800 underline" onClick={() => confirmFact(fact.id)}>I confirm this claim</button>}</div></div></div>)}</div>
        </section>
      </aside>
      <section className="min-w-0 space-y-5"><div className="panel p-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="m-0 text-xl font-bold">4. Listing set</h2><p className="mb-0 mt-1 text-sm text-slate-600">{status}</p></div><div className="flex gap-2"><button className="button button--soft" onClick={exportCurrent}>Current PNG</button><button className="button" onClick={exportZip}>Export ZIP</button></div></div>
        <div className="mt-5 flex flex-wrap gap-2">{slides.map((slide, index) => <div key={slide.id} className="flex overflow-hidden rounded-full border border-[#dce2d8]"><button className={`tab border-0 ${activeIndex === index ? "tab--active" : ""}`} onClick={() => setActiveIndex(index)}>{index + 1}. {slide.kicker}</button><button aria-label={`Remove slide ${index + 1}`} className="px-2 text-xs text-slate-400 hover:text-red-700" onClick={() => removeSlide(slide.id)}>×</button></div>)}{slides.length < 6 && <button className="tab" onClick={regenerateStoryboard}>↻ Re-plan</button>}</div>
        {active && <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]"><div className="overflow-hidden rounded-xl border border-[#dce2d8] bg-white"><InfographicCanvas brand={brand} slide={active} facts={facts} photo={photos[active.photoIndex] ?? photos[0]} onStageReady={(stage) => { stageRef.current = stage; }} /></div><aside className="rounded-xl bg-[#f5f8f4] p-4"><p className="label">Slide rationale</p><p className="text-sm leading-6 text-slate-700">{active.rationale}</p><p className="label mt-6">Source rule</p><p className="text-sm leading-6 text-slate-700">Product image: vendor source locked.<br />Brand system: approved and reused.<br />Claims: supplier evidence only.</p></aside></div>}
      </div></section>
    </div>
  </main>;
}
