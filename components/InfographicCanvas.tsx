"use client";

import { useEffect, useState } from "react";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import type { BrandKit, Fact, Slide } from "@/lib/types";

function useBrowserImage(src?: string) {
  const [image, setImage] = useState<HTMLImageElement>();
  useEffect(() => { if (!src) return; const loaded = new window.Image(); loaded.onload = () => setImage(loaded); loaded.src = src; return () => { loaded.onload = null; }; }, [src]);
  return image;
}

export type InfographicCanvasProps = { brand: BrandKit; slide: Slide; facts: Fact[]; photo?: string; onStageReady?: (stage: Konva.Stage) => void };

export function InfographicCanvas({ brand, slide, facts, photo, onStageReady }: InfographicCanvasProps) {
  const image = useBrowserImage(photo);
  const logoImage = useBrowserImage(brand.logo);
  const factMap = new Map(facts.map((fact) => [fact.id, fact]));
  const bullets = slide.factIds.map((id) => factMap.get(id)?.claim).filter(Boolean) as string[];
  const rounded = brand.cornerStyle === "soft" ? 26 : 0;
  const isHero = slide.layout === "hero";
  const imageBox = isHero ? { x: 80, y: 265, width: 840, height: 580 } : { x: 545, y: 170, width: 375, height: 670 };
  return <Stage ref={(stage) => { if (stage) onStageReady?.(stage); }} width={1000} height={1000} className="canvas-wrap">
    <Layer>
      <Rect width={1000} height={1000} fill={brand.palette.background} />
      <Rect x={52} y={48} width={896} height={4} fill={brand.palette.accent} />
      <Text x={72} y={82} text={brand.name.toUpperCase()} fontFamily={brand.fontPair.body} fontStyle="bold" fontSize={18} letterSpacing={3} fill={brand.palette.ink} />
      <Text x={72} y={117} text={slide.kicker} fontFamily={brand.fontPair.body} fontSize={15} letterSpacing={2} fill={brand.palette.accent} />
      {logoImage ? <KonvaImage image={logoImage} x={842} y={69} width={80} height={54} /> : <Text x={810} y={79} width={120} align="right" text="SPEC-TO-SELL" fontFamily={brand.fontPair.body} fontSize={12} letterSpacing={1} fill={brand.palette.ink} opacity={.6} />}
      <Text x={72} y={isHero ? 155 : 175} width={isHero ? 820 : 410} text={slide.title} fontFamily={brand.fontPair.heading} fontSize={isHero ? 58 : 48} lineHeight={1.08} fill={brand.palette.ink} />
      <Rect {...imageBox} cornerRadius={rounded} fill={brand.palette.muted} />
      {image && <KonvaImage image={image} x={imageBox.x} y={imageBox.y} width={imageBox.width} height={imageBox.height} crop={{ x: 0, y: 0, width: image.width, height: image.height }} />}
      {!isHero && <Rect x={72} y={367} width={400} height={Math.max(170, bullets.length * 100 + 52)} cornerRadius={rounded} fill="#FFFFFF" />}
      {!isHero && bullets.map((bullet, index) => <Group key={`bullet-${index}`}><Rect x={101} y={409 + index * 100} width={13} height={13} cornerRadius={7} fill={brand.palette.accent} /><Text x={138} y={391 + index * 100} width={290} text={bullet} fontFamily={brand.fontPair.body} fontSize={27} lineHeight={1.22} fill={brand.palette.ink} /></Group>)}
      {isHero && bullets[0] && <Rect x={122} y={790} width={756} height={90} cornerRadius={rounded} fill="#FFFFFF" opacity={.94} />}
      {isHero && bullets[0] && <Text x={160} y={814} width={680} text={bullets[0]} align="center" fontFamily={brand.fontPair.body} fontSize={28} fill={brand.palette.ink} />}
      <Text x={72} y={935} text={`${slide.rationale} • Supplier evidence reviewed`} fontFamily={brand.fontPair.body} fontSize={14} fill={brand.palette.ink} opacity={.62} />
    </Layer>
  </Stage>;
}
