/**
 * EntityRenderer.ts – Draws every entity according to its type and state.
 *
 * This is the workhorse renderer. It holds the one true mapping from
 * `EntityState` to the exact palette colors in plan Section 3.2, then draws
 * each entity's shape: bars as rectangles scaled to their value, nodes as
 * circles, cells as grid rectangles, and characters as small labeled boxes.
 *
 * The canvas is already DPR-scaled, so all coordinates here are logical px.
 */

import type { EntityState, VisualFrame } from "@/types";

/** Standard canvas font string shared by all entity text. */
const FONT = '500 14px "Noto Sans", sans-serif';

/** Node circle radius in logical pixels. */
const NODE_RADIUS = 14;

/**
 * The color palette: every state maps to its exact fill, border, and text
 * colors. This table must stay in sync with the CSS variables in global.css.
 */
export const STATE_COLORS: Record<EntityState, { fill: string; stroke: string; text: string }> = {
    idle: { fill: "#F3F4F6", stroke: "#D1D5DB", text: "#111827" },
    active: { fill: "#3B82F6", stroke: "#2563EB", text: "#FFFFFF" },
    comparing: { fill: "#FCD34D", stroke: "#F59E0B", text: "#000000" },
    swapped: { fill: "#EF4444", stroke: "#DC2626", text: "#FFFFFF" },
    sorted: { fill: "#10B981", stroke: "#059669", text: "#FFFFFF" },
    pivot: { fill: "#8B5CF6", stroke: "#7C3AED", text: "#FFFFFF" },
    visited: { fill: "#F59E0B", stroke: "#D97706", text: "#000000" },
    path: { fill: "#06B6D4", stroke: "#0891B2", text: "#FFFFFF" },
    highlight: { fill: "#F472B6", stroke: "#DB2777", text: "#000000" },
    error: { fill: "#DC2626", stroke: "#991B1B", text: "#FFFFFF" },
    unvisited: { fill: "#F9FAFB", stroke: "#9CA3AF", text: "#111827" },
};

/**
 * Paint every entity in the frame.
 *
 * @param ctx The (already DPR-scaled) canvas context.
 * @param frame The frame whose entities should be drawn.
 */
export function renderEntities(ctx: CanvasRenderingContext2D, frame: VisualFrame): void {
    for (const entity of frame.entities) {
        // Resolve the palette entry for this entity's state.
        const colors = STATE_COLORS[entity.state] ?? STATE_COLORS.idle;

        ctx.fillStyle = colors.fill;
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 1;

        switch (entity.type) {
            case "bar":
                drawBar(
                    ctx,
                    entity.x,
                    entity.y,
                    entity.width,
                    entity.height,
                    entity.label,
                    colors.text,
                );
                break;
            case "node":
                // Layouts may shrink the node (dense trees) by setting a
                // smaller width/height; fall back to the default radius.
                drawNode(
                    ctx,
                    entity.x,
                    entity.y,
                    entity.width > 0 ? Math.max(4, entity.width / 2) : NODE_RADIUS,
                    entity.label,
                    colors.text,
                );
                break;
            case "cell":
                drawCell(
                    ctx,
                    entity.x,
                    entity.y,
                    entity.width,
                    entity.height,
                    entity.label,
                    colors.text,
                );
                break;
            case "character":
                drawCharacter(
                    ctx,
                    entity.x,
                    entity.y,
                    entity.width,
                    entity.height,
                    entity.label,
                    colors.text,
                );
                break;
            // "edge" entities are never drawn directly; EdgeRenderer handles them.
            case "edge":
                break;
        }
    }
}

/**
 * Draw a bar: filled rectangle with a 1px border, label centred if tall enough.
 */
function drawBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    textColor: string,
): void {
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);

    // Only squeeze a label inside when the bar is tall enough to read it.
    if (height > 20) {
        ctx.fillStyle = textColor;
        ctx.font = FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x + width / 2, y + height / 2);
    }
}

/**
 * Draw a node: a filled circle with a border and a centred label.
 */
function drawNode(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    label: string,
    textColor: string,
): void {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
}

/**
 * Draw a grid cell: a filled rectangle with a border and a centred label.
 */
function drawCell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    textColor: string,
): void {
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = textColor;
    ctx.font = FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + width / 2, y + height / 2);
}

/**
 * Draw a character box: filled background, border, character centred within.
 *
 * The entity's x/y is the box's top-left corner; the character is drawn with
 * a centred baseline so it reads naturally inside a 16×20 box.
 */
function drawCharacter(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    textColor: string,
): void {
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = textColor;
    ctx.font = FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + width / 2, y + height / 2);
}
