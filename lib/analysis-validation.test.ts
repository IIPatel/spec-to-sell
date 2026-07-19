import { describe, expect, it } from "vitest";
import {
  MAX_PHOTO_BYTES,
  MAX_SPECIFICATION_LENGTH,
  validateAnalysisInput,
} from "./analysis-validation";

const validInput = {
  brandName: "Harbor Muse",
  brandDescription: "Quiet coastal gifts.",
  specifications: "Natural cotton canvas tote. Dimensions: 15 in x 16 in.",
  files: [{ name: "tote.jpg", type: "image/jpeg", size: 250_000 }],
};

describe("live analysis validation", () => {
  it("accepts a compact, source-grounded request", () => {
    expect(validateAnalysisInput(validInput)).toEqual({ ok: true });
  });

  it("requires vendor photos and supplier specifications", () => {
    expect(validateAnalysisInput({ ...validInput, files: [] })).toEqual({
      ok: false,
      message: "Upload at least one vendor product photo for live analysis.",
    });
    expect(validateAnalysisInput({ ...validInput, specifications: " " })).toEqual({
      ok: false,
      message: "Supplier specifications are required.",
    });
  });

  it("rejects unsupported image files and oversized input", () => {
    expect(validateAnalysisInput({
      ...validInput,
      files: [{ name: "tote.gif", type: "image/gif", size: 250_000 }],
    })).toEqual({ ok: false, message: "Vendor photos must be JPG, PNG, or WebP files." });
    expect(validateAnalysisInput({
      ...validInput,
      files: [{ name: "large.jpg", type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 }],
    })).toEqual({ ok: false, message: "Each vendor photo must be 1.25 MB or smaller." });
    expect(validateAnalysisInput({
      ...validInput,
      specifications: "x".repeat(MAX_SPECIFICATION_LENGTH + 1),
    })).toEqual({ ok: false, message: "Supplier specifications must be 8,000 characters or fewer." });
  });
});
