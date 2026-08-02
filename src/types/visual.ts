/**
 * visual.ts – Core visualisation types for the Algorithmic Visualization Engine.
 *
 * These types describe the *pixel world*: the drawable objects that appear on
 * the canvas, the frames the step engine replays, and the state that decides
 * which colour every shape gets painted with.
 *
 * Every algorithm module emits a stream of `VisualFrame` snapshots. A frame is
 * a complete description of one moment in time: every bar, node, cell, edge,
 * and the human-readable caption that explains what just happened.
 */

/**
 * The five shapes the renderer knows how to draw.
 *
 * - `bar`       – a vertical rectangle whose height encodes a value (sorting).
 * - `node`      – a circle, the centre of a graph or tree vertex.
 * - `cell`      – a rectangle in a grid, used by DP / matrix algorithms.
 * - `character` – a small box holding a single character (string algorithms).
 * - `edge`      – a connection between two nodes (drawn by EdgeRenderer).
 */
export type VisualEntityType = "node" | "edge" | "cell" | "bar" | "character";

/**
 * Every state listed here maps one-to-one onto a row in the colour palette
 * (see Section 3.2 of the implementation plan). The renderer simply looks up
 * fill / stroke / text colours for the state an entity carries.
 */
export type EntityState =
    | "idle"
    | "active"
    | "comparing"
    | "swapped"
    | "sorted"
    | "pivot"
    | "visited"
    | "path"
    | "highlight"
    | "error"
    | "unvisited";

/**
 * The layout engine that must position the frame's entities before drawing.
 * The main visualiser reads this field and dispatches to the matching
 * layout function (ArrayLayout, GridLayout, TreeLayout, GraphLayout,
 * TextLayout, or a matrix fallback).
 */
export type LayoutType = "array" | "grid" | "tree" | "graph" | "text" | "matrix";

/**
 * A single drawable object.
 *
 * `x` / `y` are *logical* (CSS) pixel coordinates. For bars and cells they
 * describe the top-left corner; for nodes they describe the circle centre.
 * The HiDPI wrapper scales the canvas so the rest of the code can think in
 * plain CSS pixels regardless of the physical device pixel ratio.
 */
export interface VisualEntity {
    /** Stable identifier that never changes between frames, e.g. "bar-3". */
    id: string;
    /** Which shape the renderer should draw. */
    type: VisualEntityType;
    /** Short text drawn on or near the shape (value, character, weight). */
    label: string;
    /** The underlying data, kept for the tooltip and hit-testing details. */
    value: number | string | object;
    /** Current visual state, resolved against the colour palette. */
    state: EntityState;
    /** Logical x position – top-left (bars/cells) or centre (nodes). */
    x: number;
    /** Logical y position – top-left (bars/cells) or centre (nodes). */
    y: number;
    /** Logical width in CSS pixels. */
    width: number;
    /** Logical height in CSS pixels. */
    height: number;
    /** Algorithm-specific flags, e.g. `row`, `col`, `parentId`, `depth`. */
    metadata: Record<string, number | string | boolean>;
}

/**
 * A directed or undirected connection between two entities.
 *
 * `sourceId` and `targetId` must match `VisualEntity.id` values present in
 * the same frame, otherwise the renderer silently skips the edge.
 */
export interface VisualEdge {
    /** Stable identifier, e.g. "edge-A-B". */
    id: string;
    /** The id of the entity where the edge starts. */
    sourceId: string;
    /** The id of the entity where the edge ends. */
    targetId: string;
    /** Text drawn near the edge midpoint – usually the edge weight. */
    label: string;
    /** Visual state; edges only use idle / active / path / highlight. */
    state: "idle" | "active" | "path" | "highlight";
    /** When true the renderer draws an arrowhead at the target end. */
    directed: boolean;
}

/**
 * A complete, immutable snapshot of the visualisation at one step.
 *
 * The step engine stores an array of these frames. Stepping forward and back
 * is just moving a pointer along the array – no algorithm code runs during
 * playback, which keeps stepping instant and deterministic.
 */
export interface VisualFrame {
    /** Zero-based index of this frame within the full sequence. */
    stepNumber: number;
    /** Every drawable entity present in this moment. */
    entities: VisualEntity[];
    /** Every connection between entities. */
    edges: VisualEdge[];
    /** Human-readable caption shown in the overlay bar at the bottom. */
    description: string;
    /** Optional index into a pseudocode listing; unused if absent. */
    codeLineNumber?: number;
    /** Which layout engine should position the entities before drawing. */
    layout: LayoutType;
    /** Free-form statistics such as comparisons, swaps, visits, distance. */
    meta: Record<string, number>;
}
