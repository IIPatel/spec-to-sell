import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildStoryboard } from "@/lib/storyboard";
import { proposeBrandKit } from "@/lib/brand";

export const runtime = "nodejs";

const factSchema = z.object({
  id: z.string(),
  claim: z.string(),
  category: z.enum(["material", "dimensions", "care", "variant", "customization", "use", "construction"]),
  importance: z.enum(["major", "minor"]),
  status: z.enum(["supported", "needs_review"]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.object({ sourceType: z.enum(["supplier_text", "vendor_image"]), quote: z.string(), imageIndex: z.number().int().optional() })),
  conflict: z.string().optional(),
});

const responseSchema = z.object({ facts: z.array(factSchema), explanation: z.string() });

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["facts", "explanation"],
  properties: {
    facts: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "claim", "category", "importance", "status", "confidence", "evidence"], properties: { id: { type: "string" }, claim: { type: "string" }, category: { type: "string", enum: ["material", "dimensions", "care", "variant", "customization", "use", "construction"] }, importance: { type: "string", enum: ["major", "minor"] }, status: { type: "string", enum: ["supported", "needs_review"] }, confidence: { type: "number" }, evidence: { type: "array", items: { type: "object", additionalProperties: false, required: ["sourceType", "quote"], properties: { sourceType: { type: "string", enum: ["supplier_text", "vendor_image"] }, quote: { type: "string" }, imageIndex: { type: "number" } } } }, conflict: { type: "string" } } } },
    explanation: { type: "string" },
  },
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY is not configured. Use the built-in sample flow or add a server-side key." }, { status: 503 });
  try {
    const form = await request.formData();
    const name = String(form.get("brandName") ?? "Your shop");
    const description = String(form.get("brandDescription") ?? "");
    const preferredColor = String(form.get("preferredColor") ?? "") || undefined;
    const specifications = String(form.get("specifications") ?? "").trim();
    if (!specifications) return NextResponse.json({ error: "Supplier specifications are required." }, { status: 400 });
    const files = form.getAll("photos").filter((value): value is File => value instanceof File).slice(0, 8);
    const imageContent = await Promise.all(files.map(async (file) => ({ type: "input_image", image_url: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}` })));
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `You are an evidence-first product researcher for a print-on-demand seller. Analyze ONLY the pasted supplier facts and vendor photos. Do not create marketing claims, infer unprovided materials/dimensions, describe unseen details, or invent use cases. Every supported claim needs at least one exact evidence quote. If a tempting claim cannot be supported, return it as needs_review with a plain-language conflict. Use short, listing-ready claims.\n\nSupplier specifications:\n${specifications}\n\nBrand name: ${name}\nBrand description: ${description}`;
    const completion = await client.responses.create({
      model: "gpt-5.6-terra",
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }, ...imageContent] }],
      text: { format: { type: "json_schema", name: "supplier_evidence", strict: true, schema: jsonSchema } },
    } as never);
    const parsed = responseSchema.parse(JSON.parse((completion as unknown as { output_text: string }).output_text));
    const brandKit = proposeBrandKit({ name, description, preferredColor });
    return NextResponse.json({ brandKit, ...parsed, slides: buildStoryboard(parsed.facts, Math.max(1, files.length)) });
  } catch (error) {
    console.error("Analysis failed", error);
    return NextResponse.json({ error: "Analysis could not be completed. Check the supplier input and API key, then try again." }, { status: 500 });
  }
}
