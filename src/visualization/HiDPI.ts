/**
 * HiDPI.ts – High-DPI (retina) canvas helpers.
 *
 * A canvas's backing store is measured in *physical* device pixels, but all
 * layout and drawing in this project is done in *logical* CSS pixels. Without
 * scaling, everything drawn on a 2x screen would look blurry and half-sized.
 *
 * The pattern is:
 *   1. Set canvas.width / canvas.height to the physical dimensions.
 *   2. Call scaleContext so every subsequent draw command is in logical px.
 *
 * Mouse events are reported in CSS-pixel coordinates relative to the element,
 * so getLogicalCoords is a no-op for the common case — it exists to keep the
 * conversion explicit and future-proof.
 */

/** The device pixel ratio, defaulting to 1 when the browser cannot tell us. */
export const DPR = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

/**
 * Scale the context so drawing commands can use logical CSS pixels.
 *
 * After this call, `ctx.fillRect(0, 0, 100, 50)` paints a rectangle that is
 * physically 100*DPR by 50*DPR pixels but *logically* 100 by 50.
 *
 * @param ctx The canvas rendering context to scale.
 * @param dpr The device pixel ratio (defaults to the exported constant).
 */
export function scaleContext(ctx: CanvasRenderingContext2D, dpr: number = DPR): void {
    ctx.scale(dpr, dpr);
}

/**
 * Convert browser event coordinates into logical canvas coordinates.
 *
 * The browser already reports `clientX`/`clientY` relative to the canvas in
 * CSS pixels, so the main job is subtracting the canvas's top-left offset.
 * No DPR division is needed because the context is already scaled.
 *
 * @param clientX Horizontal mouse coordinate relative to the viewport.
 * @param clientY Vertical mouse coordinate relative to the viewport.
 * @param canvasRect The canvas's bounding rectangle (from getBoundingClientRect).
 * @param _dpr Unused; kept for signature symmetry with scaleContext.
 * @returns Logical x/y coordinates suitable for hit testing.
 */
export function getLogicalCoords(
    clientX: number,
    clientY: number,
    canvasRect: DOMRect,
    _dpr: number = DPR,
): { x: number; y: number } {
    return {
        x: clientX - canvasRect.left,
        y: clientY - canvasRect.top,
    };
}
