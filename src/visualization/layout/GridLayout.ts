/**
 * GridLayout.ts – Positions cells in a uniform rows×cols grid.
 *
 * Used by dynamic programming, matrix, and data-structure algorithms where
 * every state lives at a natural (row, col) coordinate. Each entity's
 * `metadata.row` and `metadata.col` pick its grid cell; cell size is derived
 * by splitting the container evenly in both axes.
 *
 * Grid dimensions come from `frame.meta.rows` / `frame.meta.cols` when
 * declared, otherwise from the largest row/col seen in the entities, and
 * finally from the entity count. The metadata fallback keeps the layout
 * robust against loosely-specified frames.
 */

import type { VisualFrame } from "@/types";

/**
 * Lay out entities into a uniform grid.
 *
 * @param frame The frame whose entities carry row/col metadata.
 * @param width Logical container width in pixels.
 * @param height Logical container height in pixels.
 * @returns The same frame, with entity positions filled in.
 */
export function applyGridLayout(frame: VisualFrame, width: number, height: number): VisualFrame {
    const entities = frame.entities;
    if (entities.length === 0) {
        return frame;
    }

    // Prefer declared dimensions, then derive from the metadata, then fall
    // back to a square-ish grid sized by the entity count.
    const declaredRows = frame.meta["rows"];
    const declaredCols = frame.meta["cols"];
    const hasRowCol = entities.some(
        (e) => e.metadata["row"] !== undefined && e.metadata["col"] !== undefined,
    );

    let rows: number;
    let cols: number;
    if (declaredRows !== undefined && declaredCols !== undefined) {
        rows = Number(declaredRows);
        cols = Number(declaredCols);
    } else if (hasRowCol) {
        rows = Math.max(1, ...entities.map((e) => Number(e.metadata["row"] ?? 0))) + 1;
        cols = Math.max(1, ...entities.map((e) => Number(e.metadata["col"] ?? 0))) + 1;
    } else {
        rows = Math.ceil(Math.sqrt(entities.length));
        cols = Math.ceil(entities.length / rows);
    }
    rows = Math.max(1, rows);
    cols = Math.max(1, cols);

    // Each cell gets an equal share of the container on its axis.
    const cellWidth = width / cols;
    const cellHeight = height / rows;

    let index = 0;
    for (const entity of entities) {
        let row: number;
        let col: number;
        if (entity.metadata["row"] !== undefined && entity.metadata["col"] !== undefined) {
            row = Number(entity.metadata["row"]);
            col = Number(entity.metadata["col"]);
        } else {
            // Entities without coordinates flow left-to-right, top-to-bottom.
            row = Math.floor(index / cols);
            col = index % cols;
            index += 1;
        }

        // Position is the cell's top-left corner; size is the full cell.
        entity.width = cellWidth;
        entity.height = cellHeight;
        entity.x = col * cellWidth;
        entity.y = row * cellHeight;
    }

    return frame;
}
