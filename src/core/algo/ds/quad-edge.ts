/**
 * quad-edge.ts - Quad-Edge Data Structure (Guibas and Stolfi)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A quad-edge records an undirected edge as four directed edge-ends, one for
 * each (origin, side) pair around the edge. Each end stores the next end with
 * the same origin. The rot operator advances to the next end of the same edge,
 * sym jumps to the opposite direction, and the Euler splice operator rewrites
 * four onext pointers to join or split vertex rings. From these primitives a
 * planar subdivision can be built and its vertices and faces enumerated.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per operator; O(n) to enumerate all vertex or face cycles
 *   Space: O(n) for n edges, four edge-ends per edge
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each edge-end is a cell whose label shows its onext target.
 *   - An end touched by a splice is YELLOW (comparing).
 *   - Ends on the face currently being walked are PATH; finished ones SORTED.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Quad = { onext: number[] };

function rot(end: number): number {
    const edge = Math.floor(end / 4);
    const q = end % 4;
    return edge * 4 + ((q + 1) % 4);
}

function onextOf(quads: Quad[], end: number): number {
    const edge = Math.floor(end / 4);
    return quads[edge]?.onext[end % 4] ?? end;
}

function setOnext(quads: Quad[], end: number, value: number): void {
    const edge = Math.floor(end / 4);
    const record = quads[edge];
    if (record) {
        record.onext[end % 4] = value;
    }
}

function makeEdge(quads: Quad[], edgeIndex: number): number {
    const base = edgeIndex * 4;
    quads[edgeIndex] = { onext: [base, base + 3, base + 2, base + 1] };
    return base;
}

function splice(quads: Quad[], a: number, b: number): number[] {
    const touched: number[] = [];
    if (a === b) {
        return touched;
    }
    const pa = rot(onextOf(quads, a));
    const pb = rot(onextOf(quads, b));
    const nextPa = onextOf(quads, pa);
    setOnext(quads, pa, onextOf(quads, pb));
    setOnext(quads, pb, nextPa);

    const nextA = onextOf(quads, a);
    setOnext(quads, a, onextOf(quads, b));
    setOnext(quads, b, nextA);
    touched.push(a, b, pa, pb);
    return touched;
}

function symOf(end: number): number {
    const edge = Math.floor(end / 4);
    const q = end % 4;
    return edge * 4 + ((q + 2) % 4);
}

/** Walk every cycle of a permutation, returning one representative list per cycle. */
function cycles(quads: Quad[], next: (q: Quad[], e: number) => number): number[][] {
    const seen = new Set<number>();
    const result: number[][] = [];
    for (let end = 0; end < quads.length * 4; end += 1) {
        if (seen.has(end)) {
            continue;
        }
        const cycle: number[] = [];
        let cur = end;
        while (!seen.has(cur)) {
            seen.add(cur);
            cycle.push(cur);
            cur = next(quads, cur);
        }
        result.push(cycle);
    }
    return result;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: number } | null) ?? {};
    const count = Math.max(3, Math.min(8, Math.round(task.vertices ?? 4)));

    const quads: Quad[] = [];
    let step = 0;
    let highlight = new Set<number>();
    let walkHighlight = new Set<number>();

    const labelOf = (end: number): string => {
        const edge = Math.floor(end / 4);
        const q = end % 4;
        const nxt = onextOf(quads, end);
        return `e${edge}.${q}->${Math.floor(nxt / 4)}.${nxt % 4}`;
    };

    const frame = (description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => {
        const entities: VisualEntity[] = [];
        for (let end = 0; end < quads.length * 4; end += 1) {
            const state: EntityState = walkHighlight.has(end)
                ? "path"
                : highlight.has(end)
                  ? "comparing"
                  : "idle";
            entities.push({
                id: `qe-${end}`,
                type: "cell" as const,
                label: labelOf(end),
                value: end,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: Math.floor(end / 4), col: end % 4 },
            });
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description,
            codeLineNumber: line,
            layout: "grid",
            meta,
        };
    };

    yield frame(`Quad-edge subdivision with target of ${count} boundary vertices.`, 0, {
        phase: "start",
        edges: 0,
        vertices: 0,
        faces: 0,
    });
    step += 1;

    const edges: number[] = [];
    for (let i = 0; i < count; i += 1) {
        const base = makeEdge(quads, i);
        edges.push(base);
        highlight = new Set([base, base + 1, base + 2, base + 3]);
        yield frame(`makeEdge creates four edge-ends for edge ${i}.`, 1, {
            phase: "makeEdge",
            edges: quads.length,
            vertices: 0,
            faces: 0,
        });
        step += 1;
    }

    for (let i = 0; i < count; i += 1) {
        const next = (i + 1) % count;
        const a = symOf(edges[i] as number);
        const b = edges[next] as number;
        highlight = new Set(splice(quads, a, b));
        yield frame(`splice joins the ring of edge ${i} to edge ${next}.`, 2, {
            phase: "splice",
            edges: quads.length,
            vertices: 0,
            faces: 0,
        });
        step += 1;
    }
    highlight = new Set();

    const allRings = cycles(quads, onextOf);
    const vertexRings = allRings.filter((ring) => ring.some((end) => end % 2 === 0));
    const faceRingsFromRings = allRings.filter((ring) => ring.some((end) => end % 2 === 1));
    for (let i = 0; i < vertexRings.length; i += 1) {
        walkHighlight = new Set(vertexRings[i]);
        yield frame(`Vertex ring ${i + 1}: ${(vertexRings[i] as number[]).length} edge-ends share one origin.`, 3, {
            phase: "vertex",
            edges: quads.length,
            vertices: vertexRings.length,
            faces: 0,
        });
        step += 1;
    }
    walkHighlight = new Set();

    const faceRings = faceRingsFromRings;
    for (let i = 0; i < faceRings.length; i += 1) {
        walkHighlight = new Set(faceRings[i]);
        yield frame(`Face boundary ${i + 1}: the dual ends share one face cycle.`, 4, {
            phase: "face",
            edges: quads.length,
            vertices: vertexRings.length,
            faces: faceRings.length,
        });
        step += 1;
    }
    walkHighlight = new Set();

    const vertices = vertexRings.length;
    const edgesCount = quads.length;
    const faces = faceRings.length;
    const euler = vertices - edgesCount + faces;
    yield frame(
        `Euler check: V=${vertices}, E=${edgesCount}, F=${faces}, V-E+F=${euler}.`,
        5,
        { phase: "done", vertices, edges: edgesCount, faces, euler, eulerOk: euler === 2 },
    );

    return;
}

/** The quad-edge module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "An ordinary edge has two ends, but a subdivision also needs to know which face lies on each side. A quad-edge gives every edge four ends, one per origin-side pair, and stores a next pointer for each. Rotating an end walks around the edge, jumping by two reaches the opposite direction, and splice rewires four next pointers at once to join or cut vertex rings.",
        invariants: [
            "rot applied four times and sym applied twice both return the original end.",
            "Every edge-end appears in exactly one onext cycle, which represents one vertex.",
            "Following left-next pointers partitions all edge-ends into face boundaries.",
        ],
        correctness:
            "Splice is defined as two independent swaps on the two origins of the two edges, so it preserves the permutation structure of the onext rings and therefore keeps every end in exactly one vertex ring. Because each original edge contributes four ends and the operators are permutations, the traced vertex and face cycles are disjoint and cover all ends; Euler's formula then gives V minus E plus F equal to two for a connected planar subdivision, which the visualization reports as a verification.",
        complexityRationale:
            "makeEdge writes four pointers, rot and sym are arithmetic on the end index, and splice performs a constant number of pointer swaps, so all updates are O(1). Enumerating vertices or faces visits each of the 4n edge-ends once, giving O(n) time and O(n) space.",
        uses: [
            "Representing planar subdivisions in computational geometry libraries",
            "Maintaining Delaunay triangulations and Voronoi diagrams under insertion",
            "Topological data structures for geographic information systems",
        ],
        references: [
            "Guibas and Stolfi, Primitives for the Manipulation of General Subdivisions, ACM Transactions on Graphics 4 (1985)",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 9",
            "Kettner and Welzl, On the Synchronization of Quad Edge Structures, 1999",
        ],
        workedExample:
            "Three makeEdge calls give twelve edge-ends. Three splices weld their left rings into one closed triangle boundary. The onext permutation now has three vertex cycles, the left-next permutation has two face cycles (inside and outside), and three minus three plus two equals two, confirming a valid planar subdivision.",
    },
    id: "quad-edge",
    name: "Quad-Edge Data Structure",
    category: "data-structures",
    complexity: { time: "O(n) traversal", space: "O(n)" },
    defaultInput: { vertices: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "allocate one edge record with four directed ends",
        "initialize each end's onext to the standard self-loop pattern",
        "splice two ends to join or split their origin rings",
        "swap the onext pointers for both origins and their rotations",
        "repeat splices until the boundary is closed",
        "follow onext to enumerate vertex rings",
        "follow left-next to enumerate face boundaries",
        "done: verify V minus E plus F equals two",
    ],
};

export default module;
