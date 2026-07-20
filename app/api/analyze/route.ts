import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateAnalysisInput } from "@/lib/analysis-validation";
import { proposeBrandKit } from "@/lib/brand";
import { evidenceValidationMessage } from "@/lib/evidence";
import { buildStoryboard } from "@/lib/storyboard";

export const runtime = "nodejs";

class InputError extends Error {}

const factSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  category: z.enum(["material", "dimensions", "care", "variant", "customization", "use", "construction"]),
  importance: z.enum(["major", "minor"]),
  status: z.enum(["supported", "needs_review"]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.object({
    sourceType: z.enum(["supplier_text", "vendor_image"]),
    quote: z.string().min(1),
    imageIndex: z.number().int().nonnegative().nullable().transform((value) => value ?? undefined),
  })),
  conflict: z.string().nullable().transform((value) => value ?? undefined),
}).superRefine((fact, context) => {
  if (fact.status === "supported" && !fact.evidence.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Supported claims require evidence." });
  }
  if (fact.status === "needs_review" && !fact.conflict?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Held claims require a review explanation." });
  }
});

const responseSchema = z.object({
  facts: z.array(factSchema).max(24),
  explanation: z.string().min(1).max(500),
});

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["facts", "explanation"],
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "claim", "category", "importance", "status", "confidence", "evidence", "conflict"],
        properties: {
          id: { type: "string" },
          claim: { type: "string" },
          category: { type: "string", enum: ["material", "dimensions", "care", "variant", "customization", "use", "construction"] },
          importance: { type: "string", enum: ["major", "minor"] },
          status: { type: "string", enum: ["supported", "needs_review"] },
          confidence: { type: "number" },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["sourceType", "quote", "imageIndex"],
              properties: {
                sourceType: { type: "string", enum: ["supplier_text", "vendor_image"] },
                quote: { type: "string" },
                imageIndex: { type: ["number", "null"] },
              },
            },
          },
          conflict: { type: ["string", "null"] },
        },
      },
    },
    explanation: { type: "string" },
  },
};

function formString(form: FormData, field: string) {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Live analysis is not configured. Explore the complete sample workflow or ask the project owner to add a server-side API key." },
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
    const validation = validateAnalysisInput({
      brandName,
      brandDescription,
      specifications,
      files: files.map((file) => ({ name: file.name, size: file.size, type: file.type })),
    });
    if (!validation.ok) throw new InputError(validation.message);

    const imageContent = await Promise.all(files.map(async (file) => ({
      type: "input_image",
      image_url: "data:" + file.type + ";base64," + Buffer.from(await file.arrayBuffer()).toString("base64"),
    })));

    const prompt = [
      "You are an evidence-first product researcher for a print-on-demand seller.",
      "Analyze only the supplied vendor photos and pasted supplier specifications.",
      "Never invent marketing claims, materials, dimensions, use cases, or visual details.",
      "Every supported claim must cite an exact supplier-text quote or a specific vendor-image index.",
      "Use supported only when the supplied evidence clearly proves the claim.",
      "For tempting but unsupported claims, return needs_review with no evidence and explain exactly what is missing.",
      "Use compact, listing-ready language and return no more than 24 facts.",
      "",
      "Supplier specifications:",
      specifications,
      "",
      "Brand name: " + brandName,
      "Brand description: " + brandDescription,
    ].join("\n");

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.responses.create({
      model: "gpt-5.6-terra",
      input: [{
        role: "user",
        content: [{ type: "input_text", text: prompt }, ...imageContent],
      }],
      text: {
        format: {
          type: "json_schema",
          name: "supplier_evidence",
          strict: true,
          schema: jsonSchema,
        },
      },
    } as never);

    const parsed = responseSchema.parse(JSON.parse((completion as unknown as { output_text: string }).output_text));
    const evidenceError = evidenceValidationMessage(parsed.facts, files.length);
    if (evidenceError) throw new InputError(evidenceError);
    const brandKit = proposeBrandKit({
      name: brandName,
      description: brandDescription,
      preferredColor,
    });

    return NextResponse.json({
      brandKit,
      ...parsed,
      slides: buildStoryboard(parsed.facts, files.length),
    });
  } catch (error) {
    if (error instanceof InputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "The analysis did not return valid source-cited facts. Please retry with clearer supplier information." },
        { status: 502 },
      );
    }
    console.error("Supplier analysis failed.", error);
    return NextResponse.json(
      { error: "Analysis could not be completed. Check your supplier input and try again." },
      { status: 500 },
    );
  }
}
