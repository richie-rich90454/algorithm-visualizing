/**
 * OverlayRenderer.ts – Draws the frame caption, step counter, and selection.
 *
 * This renderer draws everything that is *about* the visualisation rather
 * than part of it:
 *
 *   - A dark 40px bar across the bottom holding the frame's human-readable
 *     description, so the classroom viewer always knows what just happened.
 *   - A "step / total" counter in the top-right corner.
 *   - A dashed highlight box around the currently selected entity.
 *
 * The caption bar lives at the bottom of the canvas, which is why layout
 * engines reserve a 20px bottom margin for bars.
 */

import type { VisualEntity, VisualFrame } from "@/types";

/** Height of the description bar at the bottom, in logical pixels. */
const BAR_HEIGHT = 40;

/** Font used for the caption text. */
const CAPTION_FONT = '500 14px "Noto Sans", sans-serif';

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
    // Bottom caption bar with the frame description.
    // ------------------------------------------------------------------
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, containerHeight - BAR_HEIGHT, containerWidth, BAR_HEIGHT);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = CAPTION_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(frame.description, 16, containerHeight - BAR_HEIGHT / 2);

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

        // Nodes are circles; the box is drawn around their bounding square.
        if (selected.type === "node") {
            ctx.strokeRect(selected.x - 14, selected.y - 14, 28, 28);
        } else {
            // All other shapes are axis-aligned rectangles.
            ctx.strokeRect(selected.x - 2, selected.y - 2, selected.width + 4, selected.height + 4);
        }

        ctx.restore();
    }
}
