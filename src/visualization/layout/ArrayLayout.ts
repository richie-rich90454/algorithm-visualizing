/**
 * ArrayLayout.ts – Positions bars left-to-right on a baseline.
 *
 * Used by every sorting and array-search algorithm. Each entity becomes a
 * vertical bar whose height is proportional to its value, sitting on a shared
 * baseline near the bottom of the container.
 *
 * Geometry rules (plan Section 8.1):
 *   - Fixed 4px gap between bars.
 *   - Bar width clamped between 2px and 80px.
 *   - Bottom margin of 20px; vertical margins total 40px of headroom.
 *
 * The function mutates the frame's entities in place and returns the same
 * frame, which keeps the visualizer's render loop free of bookkeeping.
 */

import type { VisualFrame } from "@/types";

/** Fixed gap between adjacent bars, in logical pixels. */
const GAP = 4;

/** Widest a single bar may be. */
const MAX_BAR_WIDTH = 80;

/** Narrowest a single bar may be. */
const MIN_BAR_WIDTH = 2;

/** Vertical padding reserved at the bottom of the container. */
const BOTTOM_MARGIN = 20;

/** Total vertical padding kept clear of the bars (top + bottom). */
const VERTICAL_PADDING = 40;

/**
 * Lay out an array of bars across the container width.
 *
 * @param frame The frame whose entities are bars.
 * @param width Logical container width in pixels.
 * @param height Logical container height in pixels.
 * @returns The same frame, with entity positions filled in.
 */
export function applyArrayLayout(frame: VisualFrame, width: number, height: number): VisualFrame {
    const entities = frame.entities;

    // Zero entities is a degenerate case; nothing to position.
    if (entities.length === 0) {
        return frame;
    }

    // Bars are as wide as possible while keeping the fixed gap, capped at 80.
    const barWidth = Math.min(
        MAX_BAR_WIDTH,
        (width - (entities.length - 1) * GAP) / entities.length,
    );

    // The usable height for bars is the container minus the vertical padding.
    const maxHeight = height - VERTICAL_PADDING;

    // Scale relative to the largest magnitude so negative values (FFT bins,
    // delta arrays) also get proportional, visible bars.
    const maxAbs = Math.max(1, ...entities.map((e) => Math.abs(Number(e.value))));

    // Total width occupied by all bars and gaps, used to center the row.
    const totalWidth = entities.length * barWidth + (entities.length - 1) * GAP;
    const startX = (width - totalWidth) / 2;
    const baselineY = height - BOTTOM_MARGIN;

    for (let i = 0; i < entities.length; i += 1) {
        const entity = entities[i];
        if (!entity) {
            continue;
        }

        const value = Number(entity.value);
        const isNegative = value < 0;

        // Bar height scales with magnitude; the tallest bar fills the height.
        // Clamp to a sliver so zero/NaN values still show up.
        const barHeight = Math.max(2, (Math.abs(value) / maxAbs) * maxHeight);

        // x advances by barWidth + gap; positive bars rise from the baseline,
        // negative bars hang below it.
        entity.width = barWidth;
        entity.height = barHeight;
        entity.x = startX + i * (barWidth + GAP);
        entity.y = isNegative ? baselineY : baselineY - barHeight;
    }

    return frame;
}
