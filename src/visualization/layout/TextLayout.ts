/**
 * TextLayout.ts – Lays out character entities in a single centred row.
 *
 * Used by string algorithms (KMP, Rabin–Karp, Z-algorithm, …). Every entity
 * is one character drawn in a small fixed-size box; the boxes sit side by side
 * with no gap, centred horizontally and vertically in the container.
 */

import type { VisualFrame } from "@/types";

/** Width of one character box, in logical pixels. */
const CHAR_WIDTH = 16;

/** Height of one character box, in logical pixels. */
const CHAR_HEIGHT = 20;

/**
 * Lay out characters as a single centred row.
 *
 * @param frame The frame whose entities are characters.
 * @param width Logical container width in pixels.
 * @param height Logical container height in pixels.
 * @returns The same frame, with character positions filled in.
 */
export function applyTextLayout(frame: VisualFrame, width: number, height: number): VisualFrame {
    const entities = frame.entities;

    // Zero characters is a degenerate case; nothing to position.
    if (entities.length === 0) {
        return frame;
    }

    // Total row width is simply each box stacked with no gap between them.
    const totalWidth = entities.length * CHAR_WIDTH;

    // Centre the row horizontally and the (single) row vertically.
    const startX = (width - totalWidth) / 2;
    const topY = (height - CHAR_HEIGHT) / 2;

    for (let i = 0; i < entities.length; i += 1) {
        const entity = entities[i];
        if (!entity) {
            continue;
        }
        entity.width = CHAR_WIDTH;
        entity.height = CHAR_HEIGHT;
        entity.x = startX + i * CHAR_WIDTH;
        entity.y = topY;
    }

    return frame;
}
