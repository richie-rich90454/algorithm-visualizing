/**
 * HitTester.ts – Translates mouse coordinates into hovered entities.
 *
 * The canvas is one flat surface with no DOM elements, so "which thing am I
 * pointing at" must be answered by pure geometry. This module iterates every
 * entity and checks whether the mouse point falls inside it:
 *
 *   - Nodes use a circular radius test around their center.
 *   - Every other shape uses an axis-aligned bounding-box test.
 *
 * Entities are checked in reverse draw order, so when shapes overlap the
 * one painted last (on top) wins — exactly matching what the user sees.
 */

import type { VisualEntity } from "@/types";

/** The radius used by both the renderer and the hit test for node circles. */
const NODE_RADIUS = 14;

/** Slight padding around boxes so edges are forgiving to click. */
const HIT_PADDING = 2;

/**
 * Find the top-most entity under a logical (CSS-pixel) point.
 *
 * @param entities The entities of the current frame, in draw order.
 * @param logicalX Logical x coordinate of the mouse cursor.
 * @param logicalY Logical y coordinate of the mouse cursor.
 * @returns The matching entity, or null when the cursor is over empty space.
 */
export function hitTest(
    entities: VisualEntity[],
    logicalX: number,
    logicalY: number,
): VisualEntity | null {
    // Every circle in this world secretly dreams of being poked by a cursor.
    // Reverse order so the last-drawn (top-most) entity is found first.
    for (let i = entities.length - 1; i >= 0; i -= 1) {
        const entity = entities[i];
        if (!entity) {
            continue;
        }

        if (entity.type === "node") {
            // Circle test: within NODE_RADIUS of the entity's center point.
            const dx = logicalX - entity.x;
            const dy = logicalY - entity.y;
            if (dx * dx + dy * dy <= NODE_RADIUS * NODE_RADIUS) {
                return entity;
            }
        } else if (entity.type === "edge") {
            // Edges are lines, not filled shapes; they cannot be hovered.
            continue;
        } else {
            // AABB test for bars, cells, and character boxes.
            const left = entity.x - HIT_PADDING;
            const top = entity.y - HIT_PADDING;
            const right = entity.x + entity.width + HIT_PADDING;
            const bottom = entity.y + entity.height + HIT_PADDING;
            if (logicalX >= left && logicalX <= right && logicalY >= top && logicalY <= bottom) {
                return entity;
            }
        }
    }

    return null;
}
