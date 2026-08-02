/**
 * GridLayout.ts – Positions cells in a uniform rows×cols grid.
 *
 * Used by dynamic programming and matrix algorithms where every state lives
 * at a natural (row, col) coordinate. Each entity's `metadata.row` and
 * `metadata.col` pick its grid cell; cell size is derived by splitting the
 * container evenly in both axes.
 *
 * The grid dimensions come from `frame.meta.rows` / `frame.meta.cols`, falling
 * back to a 5×5 grid when the algorithm does not declare them. This fallback
 * keeps the layout robust against loosely-specified frames.
 */

import type { VisualFrame } from "@/types";

/** Default grid dimensions when the frame does not declare them. */
const DEFAULT_ROWS = 5;
const DEFAULT_COLS = 5;

/**
 * Lay out entities into a uniform grid.
 *
 * @param frame The frame whose entities carry row/col metadata.
 * @param width Logical container width in pixels.
 * @param height Logical container height in pixels.
 * @returns The same frame, with entity positions filled in.
 */
export function applyGridLayout(frame: VisualFrame, width: number, height: number): VisualFrame {
    // Read declared dimensions, falling back to a sensible default grid.
    const rows = Number(frame.meta["rows"] ?? DEFAULT_ROWS);
    const cols = Number(frame.meta["cols"] ?? DEFAULT_COLS);

    // Each cell gets an equal share of the container on its axis.
    const cellWidth = width / cols;
    const cellHeight = height / rows;

    for (const entity of frame.entities) {
        // row/col are metadata numbers; missing values treat as the origin.
        const row = Number(entity.metadata["row"] ?? 0);
        const col = Number(entity.metadata["col"] ?? 0);

        // Position is the cell's top-left corner; size is the full cell.
        entity.width = cellWidth;
        entity.height = cellHeight;
        entity.x = col * cellWidth;
        entity.y = row * cellHeight;
    }

    return frame;
}
