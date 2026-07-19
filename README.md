# Spec-to-Sell

Spec-to-Sell is an evidence-grounded product-listing infographic studio for print-on-demand sellers. It turns supplier facts and vendor photos into a coherent 2-6 slide listing set while keeping product truth visible.

## Why it exists

PoD sellers inherit scattered vendor specifications and product images, then spend hours turning them into consistent marketplace visuals. Generic image generators can invent details or depict a product that the supplier never supplied.

Spec-to-Sell makes a different promise:

- Vendor photos are source locked. The renderer only places, crops, and scales them; it never generates or alters the product.
- Supported claims include an exact supplier-text citation or a specific vendor-image citation.
- Held claims do not enter the listing plan until the seller adds an exact supplier citation.
- The storyboard selects 2-6 slides according to the available, supported evidence rather than forcing every product into the same template.

## Guided workflow

1. Set a compact shop brand profile and approve its visual system.
2. Paste supplier specifications and upload 1-8 vendor product photos.
3. Review supported and held claims with their source evidence.
4. Plan, refine, and export 2000 x 2000 PNG listing images as individual files or a ZIP.

The included tote demo works without an API key, so judges can inspect the complete evidence-review and export workflow immediately.

## Run locally

    npm install
    copy .env.example .env.local
    npm run dev

Open http://localhost:3000. To run live supplier analysis, add your OpenAI key to .env.local:

    OPENAI_API_KEY=your_key_here

Never commit the key or use a NEXT_PUBLIC_ variable for it. The key is used only by the server-side analysis route.

## Technical design

- Next.js and TypeScript provide the public app and server-side analysis endpoint.
- GPT-5.6 Terra uses the OpenAI Responses API to extract source-cited facts and propose an evidence-backed storyboard.
- Zod validates the model response; server-side validation limits image type, count, size, total upload size, and specification length.
- React Konva renders deterministic infographic layouts, and JSZip exports the listing set.
- The production app is designed for a Vercel Firewall rule that rate-limits POST requests to /api/analyze.

## Vercel deployment

1. Import the GitHub repository into Vercel and select the Next.js framework preset.
2. In Project Settings > Environment Variables, add OPENAI_API_KEY for Preview and Production. Keep it server-side; do not prefix it with NEXT_PUBLIC_.
3. Redeploy after saving the variable.
4. In the Vercel Firewall, add a rule for request path equal to /api/analyze. Set its action to Rate Limit: 5 requests per IP in a 10 minute fixed window, returning 429 after the threshold.
5. Test both the key-free sample and a live source-analysis request before sharing the deployment.

## Verification

    npm test
    npm run build

The test suite covers adaptive storyboard bounds, exclusion of unsupported claims, evidence citation validation, and malformed or oversized analysis input.

## Codex and GPT-5.6

Codex accelerated the application scaffold, evidence-first data model, deterministic canvas exporter, guided studio UX, test coverage, and deployment documentation. GPT-5.6 Terra is used only for multimodal supplier-fact extraction and storyboard planning. It is not used to generate product imagery.

## Demo recording

See DEMO.md for the sub-three-minute walkthrough and upload checklist required for the OpenAI Build Week submission.
