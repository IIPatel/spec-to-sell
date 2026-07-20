import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildGroundedVisualPrompt, validateVisualGenerationInput } from "@/lib/visual-generation";

export const runtime = "nodejs";
// GPT Image 2 high-quality reference edits can take longer than a standard API route.
// This project has Fluid Compute enabled, so Vercel permits this bounded two-minute window.
export const maxDuration = 120;

class InputError extends Error {}

const factsSchema = z.array(z.object({
  claim: z.string().min(1).max(180),
  status: z.literal("supported"),
  evidence: z.array(z.object({
    sourceType: z.enum(["supplier_text", "vendor_image"]),
    quote: z.string().min(1).max(1000),
    imageIndex: z.number().int().nonnegative().optional(),
  })).min(1),
})).min(1).max(3);

const slideSchema = z.object({
  title: z.string().min(1).max(120),
  kicker: z.string().max(50),
  layout: z.enum(["hero", "feature", "spec", "care"]),
});

function formString(form: FormData, field: string) {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function parseJson<T>(value: string, schema: z.ZodType<T>) {
  try {
    return schema.parse(JSON.parse(value));
  } catch {
    throw new InputError("The visual request was incomplete. Refresh the slide and try again.");
  }
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "AI visual generation is not configured. Add a server-side OPENAI_API_KEY to use GPT Image 2." },
      { status: 503 },
    );
  }

  try {
    const form = await request.formData();
    const brandName = formString(form, "brandName");
    const brandDescription = formString(form, "brandDescription");
    const preferredColor = formString(form, "preferredColor") || undefined;
    const specifications = formString(form, "specifications");
    const files = form.getAll("photos").filter((value): value is File => value instanceof File);
    const slide = parseJson(formString(form, "slide"), slideSchema);
    const facts = parseJson(formString(form, "facts"), factsSchema);
    const validation = validateVisualGenerationInput({
      brandName,
      brandDescription,
      preferredColor,
      specifications,
      files: files.map((file) => ({ name: file.name, size: file.size, type: file.type })),
      slide,
      facts,
    });
    if (!validation.ok) throw new InputError(validation.message);

    const sourceImages = await Promise.all(files.map(async (file) => toFile(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      { type: file.type },
    )));
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const image = await client.images.edit({
      model: "gpt-image-2",
      image: sourceImages,
      prompt: buildGroundedVisualPrompt({ brandName, brandDescription, preferredColor, slide, facts }),
      size: "1024x1024",
      quality: "high",
      background: "opaque",
      output_format: "webp",
      output_compression: 88,
      n: 1,
    });
    const base64 = image.data?.[0]?.b64_json;
    if (!base64) throw new Error("GPT Image 2 returned no image data.");

    return NextResponse.json({
      visual: "data:image/webp;base64," + base64,
      model: "gpt-image-2",
      sourcePhotoCount: files.length,
    });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof OpenAI.APIError && error.status === 429) {
      return NextResponse.json({ error: "The image service is busy. Please wait a moment and try again." }, { status: 429 });
    }
    console.error("Grounded visual generation failed.", error);
    return NextResponse.json(
      { error: "The AI visual could not be created. Confirm the supplied vendor photos and try again." },
      { status: 502 },
    );
  }
}
