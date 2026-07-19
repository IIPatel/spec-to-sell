# Spec-to-Sell

An evidence-grounded product-listing infographic generator for print-on-demand sellers. Supplier photos establish product truth; an approved shop brand kit establishes presentation.

## What it does

1. Collects a minimal brand profile: name, description, optional logo, and preferred color.
2. Locks an editable brand kit (palette, type pairing, voice, spacing, and image treatment).
3. Accepts vendor photos and supplier facts.
4. Uses GPT-5.6 Terra to return source-cited facts, conflicts, and a 2–6 slide plan.
5. Renders vendor-source-locked, 2000 × 2000 PNG infographics and exports a ZIP.

The demo tote project is packaged in the app. It works without an API key; live supplier analysis requires one.

## Run locally

```bash
npm install
copy .env.example .env.local
# Add OPENAI_API_KEY to .env.local for live analysis
npm run dev
```

Open `http://localhost:3000`.

## Evidence policy

- The application does not call an image generation API.
- Uploaded vendor photos are only placed, cropped, and scaled in deterministic layouts.
- GPT-5.6 Terra is instructed to cite exact supplier evidence for supported claims.
- Unsupported claims remain `needs_review` until a seller explicitly confirms them.

## Architecture

- `app/page.tsx` — seller workflow, local project state, and client-side ZIP export.
- `app/api/analyze/route.ts` — multimodal GPT-5.6 Terra evidence extraction.
- `lib/storyboard.ts` — deterministic 2–6 slide selection from approved facts.
- `components/InfographicCanvas.tsx` — React/Konva renderer using locked brand tokens.

## Codex and GPT-5.6

Codex was used to scaffold the application, design the evidence-first data model, create the deterministic canvas exporter, and add test coverage. GPT-5.6 Terra is used at runtime for multimodal supplier-fact extraction and evidence-backed storyboard planning; it does not generate product imagery.
