/**
 * monotone-polygon-triangulation.ts - Monotone Polygon Triangulation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An x-monotone polygon has an upper and a lower chain, both sorted by x.
 * This module uses the linear-time zipper algorithm: start with the leftmost
 * triangle, then repeatedly advance either the upper or lower chain by adding
 * the diagonal that stays inside the polygon, decided by one cross product.
 * Every step removes one vertex, so the polygon is triangulated in O(n). This
 * is the de Berg et al. monotone-polygon algorithm, distinct from ear clipping.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Polygon vertices are nodes; the outline and added diagonals are edges.
 *   - Each emitted triangle is highlighted in turn; the final frame shows all
 *     triangulation diagonals together.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];
type V = { p: Point; index: number };

/** Twice the signed area of triangle (a, b, c). */
function cross(a: Point, b: Point, c: Point): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Build point nodes; the three vertices of the current triangle are active. */
function makeNodes(vertices: V[], active: Set<number>): VisualEntity[] {
    return vertices.map((v) => ({
        id: `point-${v.index}`,
        type: "node" as const,
        label: String(v.index),
        value: v.p,
        state: (active.has(v.index) ? "active" : "unvisited") as EntityState,
        x: v.p[0],
        y: v.p[1],
        width: 0,
        height: 0,
        metadata: { index: v.index },
    }));
}

/** The polygon outline as undirected edges. */
function outlineEdges(upper: Point[], lower: Point[]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 0; i < upper.length - 1; i += 1) {
        edges.push({
            id: `boundary-upper-${i}`,
            sourceId: `point-${i}`,
            targetId: `point-${i + 1}`,
            label: "",
            state: "idle",
            directed: false,
        });
    }
    const lowerIndex = (i: number): number =>
        i === 0 ? 0 : i === lower.length - 1 ? upper.length - 1 : upper.length + i - 1;
    for (let i = 0; i < lower.length - 1; i += 1) {
        edges.push({
            id: `boundary-lower-${i}`,
            sourceId: `point-${lowerIndex(i)}`,
            targetId: `point-${lowerIndex(i + 1)}`,
            label: "",
            state: "idle",
            directed: false,
        });
    }
    return edges;
}

/** The three edges of one triangle drawn as highlighted diagonals. */
function triangleEdges(tri: V[], prefix: string): VisualEdge[] {
    const result: VisualEdge[] = [];
    for (let i = 0; i < 3; i += 1) {
        const a = tri[i] as V;
        const b = tri[(i + 1) % 3] as V;
        result.push({
            id: `${prefix}-${i}`,
            sourceId: `point-${a.index}`,
            targetId: `point-${b.index}`,
            label: "",
            state: "path",
            directed: false,
        });
    }
    return result;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { upper?: Point[]; lower?: Point[] } | null) ?? {};
    const upper: Point[] = (task.upper ?? [[0, 0], [2, 3], [5, 2], [8, 0]]).map((p) => [p[0], p[1]] as Point);
    const lower: Point[] = (task.lower ?? [[0, 0], [1, -2], [4, -1], [8, 0]]).map((p) => [p[0], p[1]] as Point);
    if (upper.length < 3 || lower.length < 2) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Triangulation needs three upper vertices and a lower chain.",
            codeLineNumber: 0,
            layout: "point",
            meta: { degenerate: true, triangles: 0 },
        };
        return;
    }

    const p = upper.length - 1;
    const q = lower.length - 1;
    const U = (i: number): V => ({ p: upper[i] as Point, index: i });
    const L = (i: number): V => ({
        p: lower[i] as Point,
        index: i === 0 ? 0 : i === q ? p : upper.length + i - 1,
    });

    const vertices: V[] = [];
    upper.forEach((point, i) => vertices.push(U(i)));
    for (let i = 1; i < lower.length - 1; i += 1) {
        vertices.push(L(i));
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeNodes(vertices, new Set()),
        edges: outlineEdges(upper, lower),
        description: `Triangulating an x-monotone polygon with ${vertices.length} vertices.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { triangles: 0, phase: "start" },
    };
    step += 1;

    const triangles: V[][] = [];
    const pushTriangle = (tri: V[], note: string, codeLine: number): void => {
        triangles.push(tri);
        frameQueue.push({ tri, note, codeLine });
    };
    const frameQueue: Array<{ tri: V[]; note: string; codeLine: number }> = [];

    pushTriangle([U(0), U(1), L(1)], "Seed triangle at the leftmost vertex.", 2);

    let iu = 1;
    let il = 1;
    for (let guard = 0; guard < upper.length + lower.length + 2; guard += 1) {
        if (iu >= p && il >= q) {
            break;
        }
        if (iu >= p) {
            if (il + 1 >= q) {
                break;
            }
            pushTriangle([U(p), L(il), L(il + 1)], "Advance the lower chain toward the rightmost vertex.", 5);
            il += 1;
        } else if (il >= q) {
            if (iu + 1 >= p) {
                break;
            }
            pushTriangle([U(iu), U(iu + 1), U(p)], "Fan the upper chain to the rightmost vertex.", 6);
            iu += 1;
        } else {
            const turn = cross(L(il).p, U(iu).p, U(iu + 1).p);
            if (turn < 0) {
                pushTriangle([U(iu), L(il), L(il + 1)], "The inside diagonal advances the lower chain.", 4);
                il += 1;
            } else {
                pushTriangle([U(iu), U(iu + 1), L(il)], "The inside diagonal advances the upper chain.", 4);
                iu += 1;
            }
        }
    }

    for (const item of frameQueue) {
        yield {
            stepNumber: step,
            entities: makeNodes(vertices, new Set(item.tri.map((v) => v.index))),
            edges: triangleEdges(item.tri, `tri-${step}`),
            description: `${item.note} Triangle ${triangles.indexOf(item.tri) + 1}.`,
            codeLineNumber: item.codeLine,
            layout: "point",
            meta: { triangles: triangles.indexOf(item.tri) + 1, phase: "triangulate" },
        };
        step += 1;
    }

    const allEdges = outlineEdges(upper, lower);
    triangles.forEach((tri, i) => allEdges.push(...triangleEdges(tri, `final-${i}`)));
    yield {
        stepNumber: step,
        entities: makeNodes(vertices, new Set(vertices.map((v) => v.index))),
        edges: allEdges,
        description: `Triangulation complete: ${triangles.length} triangles for ${vertices.length} vertices.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { triangles: triangles.length, vertices: vertices.length, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An x-monotone polygon can be split at every vertex x-coordinate into exactly two boundary chains. Start with the leftmost triangle, then keep a frontier diagonal between the most recent upper and lower vertices. At each step a single cross product tells you which of the next two vertices can be connected by an inside diagonal; add that triangle and move the frontier forward. Every step removes one vertex, so the work is linear.",
        invariants: [
            "The frontier always joins the current upper vertex to the current lower vertex with a diagonal inside the polygon.",
            "All triangles emitted so far partition the portion of the polygon left of the frontier.",
            "Each step advances exactly one chain and removes exactly one boundary vertex from consideration.",
        ],
        correctness:
            "At each frontier the quadrilateral of the two current and two next vertices is convex or has exactly one reflex vertex. The cross-product test selects the diagonal that stays inside, so the emitted triangle lies wholly in the untriangulated region and the new frontier remains an internal diagonal. Inductively the triangles partition the swept region; when both chains meet at the rightmost vertex the partition covers the whole polygon with exactly n minus two triangles.",
        complexityRationale:
            "The upper and lower chains are already sorted by x because the polygon is monotone. Each iteration advances one index and emits one triangle, so there are n minus two iterations, each doing constant work. The chain arrays and output triangles take O(n) space.",
        uses: [
            "Triangulating terrain meshes stored as upper and lower height profiles",
            "Preprocessing monotone polygons for fast rendering and point location",
            "The final stage of algorithms that first split a simple polygon into monotone pieces",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 3",
            "O'Rourke, Computational Geometry in C, Chapter 2",
        ],
        workedExample:
            "For upper chain (0,0),(2,3),(5,2),(8,0) and lower chain (0,0),(1,-2),(4,-1),(8,0), the algorithm emits (0,0),(2,3),(1,-2); then (2,3),(1,-2),(4,-1); then (2,3),(4,-1),(8,0); then (2,3),(5,2),(8,0). The four doubled areas sum to 42, exactly the doubled area of the polygon.",
    },
    id: "monotone-polygon-triangulation",
    name: "Monotone Polygon Triangulation",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        upper: [[0, 0], [2, 3], [5, 2], [8, 0]],
        lower: [[0, 0], [1, -2], [4, -1], [8, 0]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "seed the first triangle with the leftmost vertex and its two neighbors",
        "set the upper index and lower index to one",
        "while both chains still have vertices",
        "compute the orientation of the upper next vertex about the frontier",
        "if the inside diagonal reaches the lower next vertex, emit and advance lower",
        "otherwise emit and advance the upper chain",
        "fan any remaining chain vertices to the rightmost vertex",
        "done: report the n minus two triangles",
    ],
};

export default module;
