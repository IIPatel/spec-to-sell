"use client";

import { useEffect, useState } from "react";
import { Circle, Group, Image as KonvaImage, Layer, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import type { BrandKit, Fact, Slide, VisualMode } from "@/lib/types";

function useBrowserImage(src?: string) {
  const [image, setImage] = useState<HTMLImageElement>();
  useEffect(() => {
    if (!src) {
      setImage(undefined);
      return;
    }
    const loaded = new window.Image();
    loaded.onload = () => setImage(loaded);
    loaded.onerror = () => setImage(undefined);
    loaded.src = src;
    return () => {
      loaded.onload = null;
      loaded.onerror = null;
    };
  }, [src]);
  return image;
}

function coverCrop(image: HTMLImageElement, width: number, height: number) {
  const boxRatio = width / height;
  const imageRatio = image.width / image.height;
  if (imageRatio > boxRatio) {
    const cropWidth = image.height * boxRatio;
    return { x: (image.width - cropWidth) / 2, y: 0, width: cropWidth, height: image.height };
  }
  const cropHeight = image.width / boxRatio;
  return { x: 0, y: (image.height - cropHeight) / 2, width: image.width, height: cropHeight };
}

export type InfographicCanvasProps = {
  brand: BrandKit;
  slide: Slide;
  facts: Fact[];
  photo?: string;
  visualMode?: VisualMode;
  onStageReady?: (stage: Konva.Stage) => void;
};

export function InfographicCanvas({ brand, slide, facts, photo, visualMode = "source", onStageReady }: InfographicCanvasProps) {
  const image = useBrowserImage(photo);
  const logoImage = useBrowserImage(brand.logo);
  const factMap = new Map(facts.map((fact) => [fact.id, fact]));
  const bullets = slide.factIds.map((id) => factMap.get(id)?.claim).filter(Boolean) as string[];
  const hero = slide.layout === "hero";
  const imageBox = hero
    ? { x: 54, y: 255, width: 892, height: 500 }
    : { x: 535, y: 182, width: 405, height: 652 };
  const crop = image ? coverCrop(image, imageBox.width, imageBox.height) : undefined;
  const footerLabel = visualMode === "ai_composed" ? "AI COMPOSED FROM VENDOR REFERENCES" : "ORIGINAL VENDOR PHOTO";
  const caption = visualMode === "ai_composed"
    ? "Product visual generated from seller-provided vendor references. Claim text remains evidence-locked."
    : "Product photo remains seller-provided. Claim text is evidence-locked.";

  return (
    <Stage ref={(stage) => { if (stage) onStageReady?.(stage); }} width={1000} height={1000} className="canvas-wrap">
      <Layer>
        <Rect width={1000} height={1000} fill="#F8F6F1" />
        <Circle x={920} y={66} radius={290} fill={brand.palette.accent} opacity={0.12} />
        <Circle x={54} y={942} radius={180} fill={brand.palette.ink} opacity={0.04} />
        <Rect x={52} y={48} width={896} height={904} cornerRadius={38} stroke="#DAD5CB" strokeWidth={2} />
        <Rect x={76} y={78} width={7} height={68} cornerRadius={4} fill={brand.palette.accent} />
        <Text x={103} y={79} text={brand.name.toUpperCase()} fontFamily="Arial" fontStyle="bold" fontSize={18} letterSpacing={3.4} fill={brand.palette.ink} />
        <Text x={104} y={111} text="PRODUCT STORY / EVIDENCE EDITION" fontFamily="Arial" fontStyle="bold" fontSize={11} letterSpacing={2.2} fill={brand.palette.ink} opacity={0.52} />
        {logoImage ? (
          <KonvaImage image={logoImage} x={852} y={75} width={62} height={62} />
        ) : (
          <Group>
            <Rect x={854} y={78} width={62} height={62} cornerRadius={31} fill={brand.palette.ink} />
            <Text x={854} y={97} width={62} align="center" text={brand.name.trim().slice(0, 1).toUpperCase() || "S"} fontFamily="Georgia" fontSize={29} fill="#FFFFFF" />
          </Group>
        )}
        <Text x={76} y={hero ? 170 : 204} width={hero ? 770 : 410} text={slide.title} fontFamily="Georgia" fontSize={hero ? 62 : 48} fontStyle="bold" lineHeight={1.02} fill={brand.palette.ink} />
        {hero && <Text x={78} y={hero ? 130 : 172} text={slide.kicker} fontFamily="Arial" fontStyle="bold" fontSize={13} letterSpacing={2.6} fill={brand.palette.accent} />}

        <Rect {...imageBox} cornerRadius={30} fill="#E7E2D8" />
        {image && crop && <KonvaImage image={image} x={imageBox.x} y={imageBox.y} width={imageBox.width} height={imageBox.height} crop={crop} cornerRadius={30} />}
        <Rect x={imageBox.x + 18} y={imageBox.y + 18} width={hero ? 255 : 205} height={31} cornerRadius={16} fill="#FFFFFF" opacity={0.94} />
        <Text x={imageBox.x + 33} y={imageBox.y + 28} text={footerLabel} fontFamily="Arial" fontStyle="bold" fontSize={9} letterSpacing={1.2} fill={brand.palette.ink} />

        {!hero && (
          <Group>
            <Text x={77} y={166} text={slide.kicker} fontFamily="Arial" fontStyle="bold" fontSize={12} letterSpacing={2.5} fill={brand.palette.accent} />
            <Rect x={76} y={410} width={390} height={Math.max(205, bullets.length * 104 + 54)} cornerRadius={25} fill="#FFFFFF" stroke="#E2DDD5" strokeWidth={1} />
            {bullets.map((bullet, index) => (
              <Group key={`${bullet}-${index}`}>
                <Circle x={111} y={458 + index * 103} radius={12} fill={brand.palette.accent} />
                <Text x={105} y={452 + index * 103} width={12} align="center" text={String(index + 1)} fontFamily="Arial" fontStyle="bold" fontSize={10} fill="#FFFFFF" />
                <Text x={144} y={431 + index * 103} width={278} text={bullet} fontFamily="Arial" fontStyle="bold" fontSize={25} lineHeight={1.2} fill={brand.palette.ink} />
              </Group>
            ))}
          </Group>
        )}
        {hero && bullets[0] && (
          <Group>
            <Rect x={122} y={706} width={756} height={98} cornerRadius={24} fill="#FFFFFF" opacity={0.96} />
            <Text x={160} y={730} width={680} text={bullets[0]} align="center" fontFamily="Arial" fontStyle="bold" fontSize={30} fill={brand.palette.ink} />
          </Group>
        )}

        <Text x={78} y={875} width={758} text={caption} fontFamily="Arial" fontSize={12} lineHeight={1.35} fill={brand.palette.ink} opacity={0.62} />
        <Text x={850} y={905} width={64} align="right" text={slide.id === "hero" ? "01" : String(Math.max(2, facts.findIndex((fact) => fact.id === slide.factIds[0]) + 2)).padStart(2, "0")} fontFamily="Georgia" fontSize={26} fill={brand.palette.accent} />
      </Layer>
    </Stage>
  );
}
