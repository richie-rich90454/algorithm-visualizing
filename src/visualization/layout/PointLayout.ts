/**
 * PointLayout.ts – Maps pre-positioned coordinate entities onto the canvas.
 *
 * Computational-geometry algorithms (convex hulls, segment intersections,
 * point-in-polygon, …) compute meaningful coordinates themselves, so they do
 * not need (and must not receive) force-directed or grid placement. This
 * layout simply normalises the entities' existing x/y values into the
 * container, preserving aspect ratio and centring the result.
 */

import type { VisualFrame } from "@/types";

/** Margin kept between the plotted region and the container edge. */
const MARGIN = 50;

/**
 * Fit the frame's entities (whose x/y are algorithm coordinates) to the
 * container, preserving their relative geometry.
 *
 * @param frame The frame whose entities carry pre-set coordinates.
 * @param width Logical container width in pixels.
 * @param height Logical container height in pixels.
 * @returns The same frame, with entity coordinates mapped to the canvas.
 */
export function applyPointLayout(frame: VisualFrame, width: number, height: number): VisualFrame {
    const entities = frame.entities;
    if (entities.length === 0) {
        return frame;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const entity of entities) {
        minX = Math.min(minX, entity.x);
        maxX = Math.max(maxX, entity.x);
        minY = Math.min(minY, entity.y);
        maxY = Math.max(maxY, entity.y);
    }

    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const availW = Math.max(1, width - 2 * MARGIN);
    const availH = Math.max(1, height - 2 * MARGIN);

    // Uniform scale keeps shapes undistorted; leftover space centres them.
    const scale = Math.min(availW / spanX, availH / spanY);
    const offsetX = MARGIN + (availW - spanX * scale) / 2;
    const offsetY = MARGIN + (availH - spanY * scale) / 2;

    for (const entity of entities) {
        entity.x = offsetX + (entity.x - minX) * scale;
        entity.y = offsetY + (entity.y - minY) * scale;
    }

    return frame;
}
