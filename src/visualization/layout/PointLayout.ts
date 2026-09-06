/**
 * PointLayout.ts – Maps pre-positioned coordinate entities onto the canvas.
 *
 * Computational-geometry algorithms (convex hulls, segment intersections,
 * point-in-polygon, …) compute meaningful coordinates themselves, so they do
 * not need (and must not receive) force-directed or grid placement. This
 * layout simply normalizes the entities' existing x/y values into the
 * container, preserving aspect ratio and centering the result.
 */

import type { VisualFrame } from "@/types";

/** Margin kept between the plotted region and the container edge. */
const MARGIN = 50;

/**
 * Original algorithm coordinates per frame, snapshotted on the first layout
 * pass. Layouts mutate entities in place, so a resize re-runs layout on the
 * same frame object – without this snapshot the already-mapped canvas
 * coordinates would be mapped a second time and the plot would drift.
 */
const originals = new WeakMap<VisualFrame, Map<string, { x: number; y: number }>>();

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

    let coords = originals.get(frame);
    if (!coords) {
        coords = new Map(entities.map((entity) => [entity.id, { x: entity.x, y: entity.y }]));
        originals.set(frame, coords);
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const entity of entities) {
        const original = coords.get(entity.id) ?? entity;
        minX = Math.min(minX, original.x);
        maxX = Math.max(maxX, original.x);
        minY = Math.min(minY, original.y);
        maxY = Math.max(maxY, original.y);
    }

    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const availW = Math.max(1, width - 2 * MARGIN);
    const availH = Math.max(1, height - 2 * MARGIN);

    // Uniform scale keeps shapes undistorted; leftover space centers them.
    const scale = Math.min(availW / spanX, availH / spanY);
    const offsetX = MARGIN + (availW - spanX * scale) / 2;
    const offsetY = MARGIN + (availH - spanY * scale) / 2;

    for (const entity of entities) {
        const original = coords.get(entity.id) ?? entity;
        entity.x = offsetX + (original.x - minX) * scale;
        entity.y = offsetY + (original.y - minY) * scale;
    }

    return frame;
}
