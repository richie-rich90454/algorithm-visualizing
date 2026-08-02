/**
 * OverlayRenderer.ts – Draws the step counter and selection highlight.
 *
 * This renderer draws everything that is *about* the visualisation rather
 * than part of it:
 *
 *   - A "step / total" counter in the top-right corner.
 *   - A dashed highlight box around the currently selected entity.
 *
 * The frame description is intentionally not painted here: the page shows it
 * in the description bar below the canvas, so duplicating it inside the
 * canvas would cover part of the visualisation.
 */

import type { VisualEntity, VisualFrame } from "@/types";

/** Font used for the step counter. */
const COUNTER_FONT = '600 14px "Noto Sans", sans-serif';

/**
 * Draw the overlay elements for a frame.
 *
 * @param ctx The (already DPR-scaled) canvas context.
 * @param frame The frame being displayed.
 * @param containerWidth Logical container width in pixels.
 * @param containerHeight Logical container height in pixels.
 * @param totalSteps Total number of frames in the run (for the counter).
 * @param selected The entity the user clicked, or null when nothing is selected.
 */
export function renderOverlay(
    ctx: CanvasRenderingContext2D,
    frame: VisualFrame,
    containerWidth: number,
    containerHeight: number,
    totalSteps: number,
    selected: VisualEntity | null,
): void {
    // ------------------------------------------------------------------
    // Step counter in the top-right corner (e.g. "5 / 42").
    // ------------------------------------------------------------------
    const counter = `${frame.stepNumber + 1} / ${Math.max(1, totalSteps)}`;
    ctx.fillStyle = "#111827";
    ctx.font = COUNTER_FONT;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(counter, containerWidth - 16, 12);

    // ------------------------------------------------------------------
    // Dashed selection border around the clicked entity.
    // ------------------------------------------------------------------
    if (selected) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#3B82F6";
        ctx.lineWidth = 2;

        // Nodes are circles; the box is drawn around their bounding square
        // (which shrinks when a dense tree scales its nodes down).
        if (selected.type === "node") {
            const radius = selected.width > 0 ? selected.width / 2 : 14;
            ctx.strokeRect(selected.x - radius, selected.y - radius, radius * 2, radius * 2);
        } else {
            // All other shapes are axis-aligned rectangles.
            ctx.strokeRect(selected.x - 2, selected.y - 2, selected.width + 4, selected.height + 4);
        }

        ctx.restore();
    }
}
