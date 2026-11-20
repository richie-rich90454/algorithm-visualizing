/**
 * hertel-mehlhorn-triangulation.ts - Convex partition by removing diagonals.
 *
 * Hertel-Mehlhorn starts from a triangulation of a simple polygon and throws
 * away every diagonal whose two neighboring pieces merge into a convex
 * polygon. The result is a convex decomposition with at most 2r+1 pieces for a
 * polygon with r reflex vertices, computed in linear time after triangulation.
 *
 * Time: O(n^2) with ear clipping. Space: O(n).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
type Diagonal = [number, number];

function cross(o: Pt, a: Pt, b: Pt): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function pointInTriangle(p: Pt, a: Pt, b: Pt, c: Pt): boolean {
    const d1 = cross(a, b, p);
    const d2 = cross(b, c, p);
    const d3 = cross(c, a, p);
    const eps = 1e-12;
    return !(d1 < -eps || d2 < -eps || d3 < -eps) && !(d1 > eps || d2 > eps || d3 > eps);
}

function boundaryEdge(a: number, b: number, n: number): boolean {
    return Math.abs(a - b) === 1 || Math.abs(a - b) === n - 1;
}

function key(a: number, b: number): string {
    return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

/** Ear-clipping triangulation of a counter-clockwise simple polygon. */
function earClip(poly: Pt[]): { triangles: number[][]; diagonals: Diagonal[] } {
    const remaining = poly.map((_, i) => i);
    const triangles: number[][] = [];
    const diag = new Map<string, Diagonal>();
    let guard = 0;
    while (remaining.length > 3 && guard < 500) {
        guard += 1;
        let clipped = false;
        for (let i = 0; i < remaining.length; i += 1) {
            const len = remaining.length;
            const prev = remaining[(i - 1 + len) % len]!;
            const cur = remaining[i]!;
            const next = remaining[(i + 1) % len]!;
            if (cross(poly[prev]!, poly[cur]!, poly[next]!) <= 1e-12) continue;
            let contains = false;
            for (const v of remaining) {
                if (v === prev || v === cur || v === next) continue;
                if (pointInTriangle(poly[v]!, poly[prev]!, poly[cur]!, poly[next]!)) {
                    contains = true;
                    break;
                }
            }
            if (contains) continue;
            triangles.push([prev, cur, next]);
            if (!boundaryEdge(prev, next, poly.length)) {
                diag.set(key(prev, next), [Math.min(prev, next), Math.max(prev, next)]);
            }
            remaining.splice(i, 1);
            clipped = true;
            break;
        }
        if (!clipped) break;
    }
    if (remaining.length === 3) triangles.push([...remaining]);
    return { triangles, diagonals: [...diag.values()] };
}

/** Walk a piece boundary from b back to a, skipping the edge a-b. */
function walkBetween(piece: number[], a: number, b: number): number[] | null {
    for (let i = 0; i < piece.length; i += 1) {
        const u = piece[i]!;
        const v = piece[(i + 1) % piece.length]!;
        if ((u === a && v === b) || (u === b && v === a)) {
            const walk = [...piece.slice(i + 1), ...piece.slice(0, i + 1)];
            return u === a ? walk : walk.reverse();
        }
    }
    return null;
}

function isConvex(piece: number[], poly: Pt[]): boolean {
    for (let i = 0; i < piece.length; i += 1) {
        if (cross(poly[piece[i]!]!, poly[piece[(i + 1) % piece.length]!]!, poly[piece[(i + 2) % piece.length]!]!) <= 1e-12) return false;
    }
    return true;
}

/** Merge two pieces across a shared diagonal when the union is convex. */
function mergePieces(p1: number[], p2: number[], a: number, b: number, poly: Pt[]): number[] | null {
    const w1 = walkBetween(p1, a, b);
    const w2 = walkBetween(p2, a, b);
    if (!w1 || !w2) return null;
    const merged = [...w1, ...w2.reverse().slice(1, -1)];
    let signedArea = 0;
    for (let i = 0; i < merged.length; i += 1) {
        const u = poly[merged[i]!]!;
        const v = poly[merged[(i + 1) % merged.length]!]!;
        signedArea += u[0] * v[1] - v[0] * u[1];
    }
    if (signedArea < 0) merged.reverse();
    return isConvex(merged, poly) ? merged : null;
}

/** Remove inessential diagonals, recording each successful merge. */
function refine(poly: Pt[], triangles: number[][], initial: Diagonal[]): {
    diagonals: Diagonal[];
    removed: Diagonal[];
    pieces: number[][];
    history: Array<{ diagonals: Diagonal[]; removed: Diagonal[]; flipped: Diagonal }>;
} {
    let pieces = triangles.map((t) => [...t]);
    const removed: Diagonal[] = [];
    const history: Array<{ diagonals: Diagonal[]; removed: Diagonal[]; flipped: Diagonal }> = [];
    let progress = true;
    while (progress) {
        progress = false;
        for (const [a, b] of initial) {
            if (removed.some((d) => key(d[0], d[1]) === key(a, b))) continue;
            let found = -1;
            for (let i = 0; i < pieces.length; i += 1) {
                if (walkBetween(pieces[i]!, a, b) !== null) {
                    if (found >= 0) {
                        const merged = mergePieces(pieces[found]!, pieces[i]!, a, b, poly);
                        if (merged) {
                            pieces = pieces.filter((_, idx) => idx !== found && idx !== i);
                            pieces.push(merged);
                            removed.push([a, b]);
                            history.push({
                                diagonals: initial.filter((d) => !removed.some((r) => key(r[0], r[1]) === key(d[0], d[1]))),
                                removed: [...removed],
                                flipped: [a, b],
                            });
                            progress = true;
                        }
                        break;
                    }
                    found = i;
                }
            }
        }
    }
    return {
        diagonals: initial.filter((d) => !removed.some((r) => key(r[0], r[1]) === key(d[0], d[1]))),
        removed,
        pieces,
        history,
    };
}

/** The convex-partition generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { polygon?: Pt[] } | null) ?? {};
    const polygon: Pt[] = task.polygon ?? [
        [0, 0], [2, -1], [4, 0], [5, 2], [4, 4], [2, 5], [0, 4], [-1, 2],
    ];
    let step = 0;
    const emit = (diagonals: Diagonal[], removed: Diagonal[], pieces: number[][], description: string, codeLineNumber: number, final: boolean): VisualFrame => {
        const entities: VisualEntity[] = polygon.map((p, i) => ({
            id: `p-${i}`,
            type: "node",
            label: String(i),
            value: p,
            state: final ? "sorted" : "unvisited",
            x: p[0],
            y: -p[1],
            width: 0,
            height: 0,
            metadata: { index: i },
        }));
        const edges: VisualEdge[] = [];
        for (let i = 0; i < polygon.length; i += 1) {
            edges.push({
                id: `boundary-${i}`,
                sourceId: `p-${i}`,
                targetId: `p-${(i + 1) % polygon.length}`,
                label: "",
                state: "path",
                directed: false,
            });
        }
        const flat: number[] = [];
        for (const [a, b] of diagonals) {
            edges.push({ id: `diag-${a}-${b}`, sourceId: `p-${a}`, targetId: `p-${b}`, label: "", state: "comparing", directed: false });
            flat.push(a, b);
        }
        const flatRemoved: number[] = [];
        for (const [a, b] of removed) flatRemoved.push(a, b);
        const flatPieces: number[] = [];
        for (const piece of pieces) flatPieces.push(...piece, -1);
        const flatPolygon: number[] = [];
        for (const p of polygon) flatPolygon.push(p[0], p[1]);
        return {
            stepNumber: step++,
            entities,
            edges,
            description,
            codeLineNumber,
            layout: "point",
            meta: { diagonals: flat, removed: flatRemoved, piecesFlat: flatPieces, pieceCount: pieces.length, polygon: flatPolygon },
        };
    };
    if (polygon.length < 3) {
        yield emit([], [], [], "Hertel-Mehlhorn: fewer than three vertices cannot form a polygon.", 0, true);
        return;
    }

    const start = earClip(polygon);
    yield emit(start.diagonals, [], start.triangles, `Hertel-Mehlhorn: triangulated the polygon into ${start.triangles.length} triangles.`, 1, false);
    const result = refine(polygon, start.triangles, start.diagonals);
    for (const s of result.history) {
        yield emit(
            s.diagonals,
            s.removed,
            result.pieces,
            `Hertel-Mehlhorn: removed inessential diagonal ${s.flipped[0]}-${s.flipped[1]}.`,
            3,
            false,
        );
    }
    yield emit(result.diagonals, result.removed, result.pieces, `Hertel-Mehlhorn: ${result.pieces.length} convex pieces remain.`, 5, true);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A triangulation can split a polygon into far more pieces than necessary. Hertel-Mehlhorn throws away diagonals that are not doing any work: when the two regions on either side of a diagonal merge into one convex polygon, the diagonal is unnecessary. Removing every such diagonal leaves a decomposition into convex pieces with a guaranteed approximation quality.",
        invariants: [
            "The remaining pieces are convex and together cover the original polygon.",
            "Only a diagonal that yields a convex union with its neighbor is removed.",
            "A reflex vertex keeps at most two diagonals essential to it.",
        ],
        correctness:
            "A diagonal is inessential exactly when its two adjacent pieces form a convex union, so removing it keeps every piece convex and never changes the covered region. Around a reflex vertex an angle below 360 degrees can be split by at most two cuts that keep all adjacent angles below 180 degrees, so at most two incident diagonals are essential there. With r reflex vertices at most 2r diagonals are essential, leaving at most 2r+1 convex pieces, which is within a constant factor of the optimum.",
        complexityRationale:
            "Ear clipping produces the initial triangulation in O(n^2) time. Each diagonal is examined a constant number of times and each merge is constant work, so the removal phase is linear in time and space.",
        uses: [
            "Approximate convex decomposition of complex shapes",
            "Preprocessing polygons for collision detection and motion planning",
            "Reducing a triangulated mesh to fewer convex cells",
        ],
        references: [
            "Hertel and Mehlhorn, Fast Triangulation of Simple Polygons, 1983",
            "O'Rourke, Art Gallery Theorems and Algorithms, Chapter 1",
        ],
        workedExample:
            "A convex hexagon triangulated into four triangles has every internal diagonal inessential, because any two neighbors merge into a convex quadrilateral or pentagon. Removing all three diagonals leaves one piece, the hexagon itself. A polygon with notches keeps the two diagonals needed at each notch and stops there.",
    },
    id: "hertel-mehlhorn-triangulation",
    name: "Hertel-Mehlhorn Convex Partition",
    category: "geometry",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: {
        polygon: [[0, 0], [2, -1], [4, 0], [5, 2], [4, 4], [2, 5], [0, 4], [-1, 2]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "triangulate the simple polygon, for example by ear clipping",
        "for each remaining diagonal find the two pieces sharing it",
        "merge the two pieces across the diagonal into one polygon",
        "accept the removal only if the merged polygon is convex",
        "repeat until no diagonal can be removed",
        "done: the pieces form a convex partition of the polygon",
    ],
};

export default module;
