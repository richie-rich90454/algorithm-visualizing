/**
 * EdgeRenderer.ts – Draws the connections between graph/tree nodes.
 *
 * Each VisualEdge becomes a straight line from its source node's centre to its
 * target node's centre. The edge's `state` decides both colour and line width:
 * neutral edges are thin and grey, while active/path/highlighted edges are
 * thicker and brightly coloured so the algorithm's current focus pops.
 *
 * Directed edges end in a small filled triangle (arrowhead) oriented along
 * the line's direction. Lines run to the very centre of the target node;
 * keeping that simple is an explicit, acceptable trade-off.
 */

import type { EntityState, VisualEntity, VisualFrame } from "@/types";

/** Font used for edge labels (weights drawn near the midpoint). */
const FONT = '500 12px "Noto Sans", sans-serif';

/** Colour / width pairs resolved from an edge's state. */
const EDGE_STYLES: Partial<Record<EntityState, { colour: string; width: number }>> = {
    idle: { colour: "#9CA3AF", width: 2 },
    active: { colour: "#3B82F6", width: 3 },
    path: { colour: "#06B6D4", width: 3 },
    highlight: { colour: "#F472B6", width: 3 },
};

/**
 * Draw every edge in the frame onto the canvas.
 *
 * @param ctx The (already DPR-scaled) canvas context.
 * @param frame The frame whose edges should be painted.
 */
export function renderEdges(ctx: CanvasRenderingContext2D, frame: VisualFrame): void {
    // Quick lookup so edge endpoints can be resolved in O(1) per edge.
    const byId = new Map<string, VisualEntity>();
    for (const entity of frame.entities) {
        byId.set(entity.id, entity);
    }

    // ------------------------------------------------------------------
    // Edges are drawn before entities so node circles paint over the line ends.
    // ------------------------------------------------------------------
    // A line is just two nodes holding hands across the void.
    for (const edge of frame.edges) {
        const source = byId.get(edge.sourceId);
        const target = byId.get(edge.targetId);

        // Skip dangling edges whose endpoints are missing from this frame.
        if (!source || !target) {
            continue;
        }

        const style = EDGE_STYLES[edge.state] ??
            EDGE_STYLES.idle ?? { colour: "#9CA3AF", width: 2 };
        ctx.strokeStyle = style.colour;
        ctx.lineWidth = style.width;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();

        // Directed edges carry an arrowhead pointing at the target.
        if (edge.directed) {
            drawArrowhead(ctx, source.x, source.y, target.x, target.y, style.colour);
        }

        // Edge weights (and similar labels) sit at the line's midpoint.
        if (edge.label) {
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;
            ctx.fillStyle = "#111827";
            ctx.font = FONT;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(edge.label, midX, midY);
        }
    }
}

/**
 * Draw a filled triangle at the target end of a line, oriented along it.
 *
 * @param ctx The canvas context.
 * @param x1 Source centre x.
 * @param y1 Source centre y.
 * @param x2 Target centre x (arrowhead point).
 * @param y2 Target centre y (arrowhead point).
 * @param colour The arrowhead fill colour.
 */
function drawArrowhead(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    colour: string,
): void {
    // Normalised direction from source to target.
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.max(0.001, Math.hypot(dx, dy));
    const ux = dx / len;
    const uy = dy / len;

    // Perpendicular unit vector for the arrowhead "wings".
    const px = -uy;
    const py = ux;

    // Arrowhead size measured along its length and across its width.
    const headLength = 8;
    const headWidth = 5;

    // Back up from the target by headLength to leave room for the triangle.
    const baseX = x2 - ux * headLength;
    const baseY = y2 - uy * headLength;

    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x2, y2); // point of the arrow
    ctx.lineTo(baseX + px * headWidth, baseY + py * headWidth);
    ctx.lineTo(baseX - px * headWidth, baseY - py * headWidth);
    ctx.closePath();
    ctx.fill();
}
