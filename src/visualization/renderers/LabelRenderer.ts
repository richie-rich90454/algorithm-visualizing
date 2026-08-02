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
 */

import type { VisualFrame } from "@/types";

/** Font used for overflow labels. */
const FONT = '500 12px "Noto Sans", sans-serif';

/**
 * Draw auxiliary labels for entities that cannot contain their own text.
 *
 * @param ctx The (already DPR-scaled) canvas context.
 * @param frame The frame whose entities may need overflow labels.
 */
export function renderLabels(ctx: CanvasRenderingContext2D, frame: VisualFrame): void {
    for (const entity of frame.entities) {
        // Only bars participate in the overflow-label behaviour for now.
        if (entity.type !== "bar") {
            continue;
        }

        // Short bars (< 20px tall) cannot fit their value inside, so print it
        // just above the top edge instead, keeping it readable at a glance.
        if (entity.height <= 20) {
            ctx.fillStyle = "#111827";
            ctx.font = FONT;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(entity.label, entity.x + entity.width / 2, entity.y - 4);
        }
    }
}
