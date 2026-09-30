import React, { useMemo } from "react";
import { buildCaptionPreview } from "../core/export/captionPreview";
import type { CaptionStyleId } from "../core/export/subtitleRender";
import type { SpeechSegmentLike } from "../core/transcript/wordTiming";

/**
 * Náhľad štýlu titulkov — **bez renderovania videa**.
 *
 * Prehliadač kreslí písmo trochu inak než libass, takže je to vizuálna
 * aproximácia (a UI to tak aj pomenuje). Zmizne však slučka „vyrenderuj → pozri
 * → zmeň", ktorá je pri titulkoch najväčšia strata času.
 *
 * Všetko je inline (žiadne externé fonty ani obrázky) — náhľad funguje všade.
 */
interface CaptionStylePreviewProps {
  styleId: CaptionStyleId;
  /** Titulky z videa — náhľad ukáže **skutočné slová**, nie ukážkový text. */
  segments?: SpeechSegmentLike[];
  width?: number;
  height?: number;
  /** Výška náhľadu v pixeloch (všetko sa na ňu prepočíta). */
  previewHeight?: number;
  activeWordIndex?: number;
  /** Popisok pod náhľadom (napr. „toto uvidí divák"). */
  caption?: string;
  className?: string;
}

export const CaptionStylePreview: React.FC<CaptionStylePreviewProps> = ({
  styleId,
  segments,
  width = 1080,
  height = 1920,
  previewHeight = 190,
  activeWordIndex = 0,
  caption,
  className = "",
}) => {
  const model = useMemo(
    () => buildCaptionPreview({ styleId, segments, width, height, previewHeight, activeWordIndex }),
    [styleId, segments, width, height, previewHeight, activeWordIndex],
  );

  const aspect = width > 0 && height > 0 ? width / height : 9 / 16;
  const previewWidth = Math.round(previewHeight * aspect);

  // Obrys textu: ASS kreslí obrys dookola, prehliadač vie len tieň — preto
  // 8 tieňov (štýl „všetkými smermi") + 1. Je to aproximácia, nie presná kópia.
  const outline = model.outlinePx;
  const textShadow = model.boxed
    ? "none"
    : [
        `${outline}px 0 0 ${model.outlineCss}`,
        `-${outline}px 0 0 ${model.outlineCss}`,
        `0 ${outline}px 0 ${model.outlineCss}`,
        `0 -${outline}px 0 ${model.outlineCss}`,
        `${outline}px ${outline}px 0 ${model.outlineCss}`,
        `-${outline}px ${outline}px 0 ${model.outlineCss}`,
        `${outline}px -${outline}px 0 ${model.outlineCss}`,
        `-${outline}px -${outline}px 0 ${model.outlineCss}`,
      ].join(", ");

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div
        className="relative rounded-lg overflow-hidden border border-neutral-800 shrink-0"
        style={{
          width: previewWidth,
          height: previewHeight,
          background: "linear-gradient(160deg, #16202b 0%, #0b1117 60%, #1d1418 100%)",
        }}
      >
        {/* Naznačenie „tváre", aby bolo vidieť, čo titulok zakrýva */}
        <div
          className="absolute rounded-full opacity-20"
          style={{
            width: previewWidth * 0.42,
            height: previewWidth * 0.42,
            left: previewWidth * 0.29,
            top: previewHeight * 0.12,
            background: "radial-gradient(circle at 40% 35%, #7c8b9a, #2a3540)",
          }}
        />
        <div
          className="absolute flex justify-center"
          style={{
            left: 0,
            right: 0,
            bottom: Math.max(2, model.bottomMarginPx),
            padding: `0 ${Math.round(previewWidth * 0.06)}px`,
          }}
        >
          <div
            style={{
              display: "inline-block",
              textAlign: "center",
              background: model.boxCss ?? "transparent",
              borderRadius: model.boxed ? Math.round(model.fontSizePx * 0.18) : 0,
              padding: model.boxed ? `${Math.round(model.fontSizePx * 0.28)}px ${Math.round(model.fontSizePx * 0.42)}px` : 0,
              maxWidth: "100%",
            }}
          >
            {model.lines.map((line, li) => (
              <div
                key={li}
                style={{
                  fontSize: model.fontSizePx,
                  lineHeight: `${model.lineHeightPx}px`,
                  fontWeight: 800,
                  letterSpacing: model.letterSpacingPx,
                  textShadow,
                  whiteSpace: "nowrap",
                }}
              >
                {line.map((w, wi) => (
                  <span
                    key={wi}
                    style={{
                      color: w.accent ? model.highlightCss : model.primaryCss,
                      display: "inline-block",
                      transform: w.active && model.activeScale !== 1 ? `scale(${model.activeScale})` : undefined,
                    }}
                  >
                    {w.text}
                    {wi < line.length - 1 ? "\u00A0" : ""}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {caption && <p className="text-[9px] text-neutral-500 text-center leading-snug">{caption}</p>}
    </div>
  );
};

export default CaptionStylePreview;
