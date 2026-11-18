/**
 * LabelRenderer.ts – Supplementary labels outside entity shapes.
 *
 * The core renderers already paint labels *inside* bars, nodes, cells, and
 * character boxes (see EntityRenderer), and edge weights are drawn at edge
 * midpoints (see EdgeRenderer). This renderer exists to cover the two cases
 * the plan reserves for it:
 *
 *   1. Bars too short to hold a value inside – we print the value *above*.
 *   2. Any future label placement that does not fit the entity itself.
 *
 * It is intentionally lightweight and safe to run on every frame.
 *
 * The fit helpers below are shared with EntityRenderer so that every label,
 * inside a bar or above it, is shortened to the bar's width and clamped to the
 * canvas. Only the *drawn* text is shortened; the entity's `label` and `value`
 * are untouched, so hover tooltips and hit testing keep the full value.
 */

import type { VisualFrame } from "@/types";

/** Font used for overflow labels. */
const FONT = '500 12px "Noto Sans", sans-serif';

/** Ellipsis appended when a label must be shortened. */
const ELLIPSIS = "…";

/**
 * Return the logical (CSS-pixel) canvas width.
 *
 * The 2D context is scaled by the device pixel ratio, so the backing-store
 * width divided by the current horizontal scale gives the width callers lay
 * out against. Deriving it from the context keeps this independent of any
 * global DPR value.
 */
export function logicalCanvasWidth(ctx: CanvasRenderingContext2D): number {
    const scale = ctx.getTransform().a;
    return ctx.canvas.width / (scale || 1);
}

/**
 * Shorten `text` with a trailing ellipsis so its measured width fits in
 * `maxWidth`. The shortest readable result is the first character plus an
 * ellipsis; if even that cannot fit, an empty string is returned so the label
 * is omitted rather than overlapping a neighbor.
 *
 * Returns `text` unchanged when it already fits, which preserves the exact
 * desktop rendering where bars are wide enough for full labels.
 */
export function fitLabel(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (!text) {
        return text;
    }
    if (ctx.measureText(text).width <= maxWidth) {
        return text;
    }

    const shortest = text.charAt(0) + ELLIPSIS;
    if (ctx.measureText(shortest).width > maxWidth) {
        return "";
    }

    // Find the longest prefix that still fits once the ellipsis is added.
    let low = 1;
    let high = text.length - 1;
    let best = shortest;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = text.slice(0, mid) + ELLIPSIS;
        if (ctx.measureText(candidate).width <= maxWidth) {
            best = candidate;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return best;
}

/**
 * Draw `text` centered on `centerX`, shortened to `maxWidth` and clamped so
 * the rendered glyphs stay inside `[0, canvasWidth]`. The caller sets the font
 * and baseline (textAlign is forced to center here).
 */
export function drawFittedCentered(
    ctx: CanvasRenderingContext2D,
    text: string,
    centerX: number,
    y: number,
    maxWidth: number,
    canvasWidth: number,
): void {
    const fitted = fitLabel(ctx, text, maxWidth);
    if (!fitted) {
        return;
    }

    const half = ctx.measureText(fitted).width / 2;
    const x = Math.min(Math.max(centerX, half), Math.max(half, canvasWidth - half));
    ctx.textAlign = "center";
    ctx.fillText(fitted, x, y);
}

/**
 * Draw auxiliary labels for entities that cannot contain their own text.
 *
 * @param ctx The (already DPR-scaled) canvas context.
 * @param frame The frame whose entities may need overflow labels.
 */
export function renderLabels(ctx: CanvasRenderingContext2D, frame: VisualFrame): void {
    const canvasWidth = logicalCanvasWidth(ctx);

    for (const entity of frame.entities) {
        // Only bars participate in the overflow-label behavior for now.
        if (entity.type !== "bar") {
            continue;
        }

        // Short bars (< 20px tall) cannot fit their value inside, so print it
        // just above the top edge instead, keeping it readable at a glance.
        if (entity.height <= 20) {
            ctx.fillStyle = "#111827";
            ctx.font = FONT;
            ctx.textBaseline = "bottom";
            drawFittedCentered(
                ctx,
                entity.label,
                entity.x + entity.width / 2,
                entity.y - 4,
                entity.width,
                canvasWidth,
            );
        }
    }
}
