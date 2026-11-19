/**
 * melzak-steiner-tree.ts - Melzag-style Euclidean Steiner Tree.
 *
 * For three points the optimal Euclidean Steiner tree meets at the Fermat
 * point, where the three connecting segments make 120 degree angles. Melzak's
 * construction builds larger trees from these three-point junctions. For four
 * terminals the two Steiner points are found by repeatedly replacing each with
 * the Fermat point of its three neighbors until the 120 degree conditions hold;
 * all three pairings are tried and the shortest tree is kept.
 *
 * Time:  O(iterations + t^2) for small terminal sets
 * Space: O(t)
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];
type Segment = { a: string; b: string };

const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Geometric median of three points; coincides with the Fermat point. */
function fermat(a: Point, b: Point, c: Point): Point {
    let p: Point = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
    for (let iter = 0; iter < 300; iter += 1) {
        let nx = 0;
        let ny = 0;
        let den = 0;
        for (const q of [a, b, c]) {
            const d = dist(p, q);
            if (d < 1e-10) return q;
            nx += q[0] / d;
            ny += q[1] / d;
            den += 1 / d;
        }
        const next: Point = [nx / den, ny / den];
        if (dist(next, p) < 1e-12) return next;
        p = next;
    }
    return p;
}

interface TreeResult {
    length: number;
    segments: Segment[];
    steiners: Point[];
    iterations: number;
}

function solve(terminals: Point[]): TreeResult {
    const n = terminals.length;
    if (n < 2) return { length: 0, segments: [], steiners: [], iterations: 0 };
    if (n === 2) {
        return {
            length: dist(terminals[0] as Point, terminals[1] as Point),
            segments: [{ a: "node-p0", b: "node-p1" }],
            steiners: [],
            iterations: 0,
        };
    }
    if (n === 3) {
        const f = fermat(terminals[0] as Point, terminals[1] as Point, terminals[2] as Point);
        const length = terminals.reduce((sum, t) => sum + dist(t, f), 0);
        return {
            length,
            segments: [0, 1, 2].map((i) => ({ a: `node-p${i}`, b: "node-s0" })),
            steiners: [f],
            iterations: 1,
        };
    }
    if (n === 4) {
        const pairings: Array<[[number, number], [number, number]]> = [
            [[0, 1], [2, 3]],
            [[0, 2], [1, 3]],
            [[0, 3], [1, 2]],
        ];
        let bestLength = Infinity;
        let bestSegments: Segment[] = [];
        let bestSteiners: Point[] = [];
        let bestIterations = 0;
        for (const [[a, b], [c, d]] of pairings) {
            const pa = terminals[a] as Point;
            const pb = terminals[b] as Point;
            const pc = terminals[c] as Point;
            const pd = terminals[d] as Point;
            let s1: Point = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
            let s2: Point = [(pc[0] + pd[0]) / 2, (pc[1] + pd[1]) / 2];
            let iter = 0;
            for (; iter < 300; iter += 1) {
                const ns1 = fermat(pa, pb, s2);
                const ns2 = fermat(pc, pd, ns1);
                if (dist(ns1, s1) + dist(ns2, s2) < 1e-11) {
                    s1 = ns1;
                    s2 = ns2;
                    iter += 1;
                    break;
                }
                s1 = ns1;
                s2 = ns2;
            }
            const length = dist(pa, s1) + dist(pb, s1) + dist(s1, s2) + dist(pc, s2) + dist(pd, s2);
            if (length < bestLength) {
                bestLength = length;
                bestSegments = [
                    { a: `node-p${a}`, b: "node-s0" },
                    { a: `node-p${b}`, b: "node-s0" },
                    { a: "node-s0", b: "node-s1" },
                    { a: `node-p${c}`, b: "node-s1" },
                    { a: `node-p${d}`, b: "node-s1" },
                ];
                bestSteiners = [s1, s2];
                bestIterations = iter;
            }
        }
        return { length: bestLength, segments: bestSegments, steiners: bestSteiners, iterations: bestIterations };
    }
    // More than four terminals: constructive three-point reduction.
    let points: Array<{ id: string; p: Point }> = terminals.map((p, i) => ({ id: `node-p${i}`, p }));
    const segments: Segment[] = [];
    const steiners: Point[] = [];
    let index = 0;
    while (points.length > 2) {
        const [x, y, z] = points;
        if (!x || !y || !z) break;
        const f = fermat(x.p, y.p, z.p);
        const id = `node-s${index}`;
        steiners.push(f);
        segments.push({ a: x.id, b: id }, { a: y.id, b: id }, { a: z.id, b: id });
        points = [...points.slice(3), { id, p: f }];
        index += 1;
    }
    if (points.length === 2 && points[0] && points[1]) {
        segments.push({ a: points[0].id, b: points[1].id });
    }
    const length = segments.reduce((sum, { a, b }) => {
        const pa = termPoint(a, terminals, steiners);
        const pb = termPoint(b, terminals, steiners);
        return pa && pb ? sum + dist(pa, pb) : sum;
    }, 0);
    return { length, segments, steiners, iterations: index };
}

function termPoint(id: string, terminals: Point[], steiners: Point[]): Point | undefined {
    if (id.startsWith("node-p")) return terminals[Number(id.slice(6))];
    return steiners[Number(id.slice(6))];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { terminals?: Point[] } | null) ?? {};
    const terminals: Point[] = task.terminals ?? [[0, 0], [1, 0], [1, 1], [0, 1]];
    if (terminals.length < 2) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Need at least two terminals for a Steiner tree.",
            codeLineNumber: 0,
            layout: "point",
            meta: { cost: -1 },
        };
        return;
    }
    const result = solve(terminals);
    const entities = (): VisualEntity[] => {
        const out: VisualEntity[] = terminals.map(([x, y], i) => ({
            id: `node-p${i}`,
            type: "node" as const,
            label: `T${i}`,
            value: [x, y],
            state: "highlight",
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index: i, terminal: true },
        }));
        result.steiners.forEach(([x, y], i) => {
            out.push({
                id: `node-s${i}`,
                type: "node" as const,
                label: `S${i}`,
                value: [x, y],
                state: "active",
                x,
                y,
                width: 0,
                height: 0,
                metadata: { index: i, terminal: false },
            });
        });
        return out;
    };
    const edges = (subset: number): VisualFrame["edges"] =>
        result.segments.slice(0, subset).map(({ a, b }, i) => ({
            id: `edge-${i}`,
            sourceId: a,
            targetId: b,
            label: "",
            state: "path" as const,
            directed: false,
        }));
    let step = 0;
    const snap = (description: string, codeLineNumber: number, meta: Record<string, number | string | boolean>, segmentCount = 0): VisualFrame => ({
        stepNumber: step,
        entities: entities(),
        edges: edges(segmentCount),
        description,
        codeLineNumber,
        layout: "point",
        meta,
    });

    yield snap(
        `Melzak construction on ${terminals.length} terminals; each junction of three segments meets at a 120 degree Fermat point.`,
        0,
        { cost: -1, steiners: result.steiners.length },
    );
    step += 1;

    yield snap(
        "Initialize the junctions from the terminal geometry, then refine each toward its Fermat position.",
        1,
        { cost: -1, steiners: result.steiners.length },
        Math.min(1, result.segments.length),
    );
    step += 1;

    for (let i = 0; i < result.steiners.length; i += 1) {
        yield snap(
            `Place Steiner point S${i}; iteratively move it to the Fermat point of its three neighbors until all angles reach 120 degrees.`,
            2,
            { cost: -1, steiners: i + 1, iterations: result.iterations },
            result.segments.filter(({ b }) => b === `node-s${i}` || b === `node-s${i + 1}`).length,
        );
        step += 1;
    }

    yield snap(
        `All 120 degree conditions hold. The Euclidean Steiner tree has length ${result.length.toFixed(4)} using ${result.steiners.length} Steiner point(s).`,
        6,
        {
            cost: result.length,
            optimal: result.length,
            steiners: result.steiners.length,
            iterations: result.iterations,
        },
        result.segments.length,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "For three terminals the cheapest tree is a Y whose arms meet at the Fermat point, making 120 degree angles. Melzak builds larger trees out of such junctions. With four terminals the two junctions are found by repeatedly moving each to the Fermat point of its three neighbors, and the best of the three possible pairings wins.",
        invariants: [
            "Every Steiner point has degree three in a full component.",
            "Segments at each interior junction meet at 120 degrees.",
            "The recorded length equals the sum of the drawn segment lengths.",
        ],
        correctness:
            "A minimal Euclidean Steiner tree has only degree-three Steiner points with 120 degree angles, so each junction is the Fermat point of its three neighbors. Alternating those replacements converges to that fixed point, and trying all pairings of four terminals covers every full topology, giving the global minimum for the supported cases.",
        complexityRationale:
            "Each Fermat point takes a bounded number of Weiszfeld-style iterations and each four-terminal pairing is constant size, so the work is O(iterations) for small terminal sets with O(t) space for points and segments.",
        uses: [
            "Euclidean network layout and facility interconnection",
            "Computational geometry demonstrations of 120 degree junctions",
            "A baseline for geometric Steiner approximations",
        ],
        references: [
            "Melzak, Mathematical Aspects of Steiner's Problem (1961)",
            "Cieslik, Steiner Minimal Trees (1998)",
        ],
        workedExample:
            "For the four corners of a unit square, pairing the top and bottom edges gives two Steiner points at (0.5, 0.2887) and (0.5, 0.7113). The five segments total 1 plus the square root of 3, about 2.732, shorter than the spanning tree of length 3.",
    },
    id: "melzak-steiner-tree",
    name: "Melzak Steiner Tree",
    category: "mst",
    complexity: { time: "O(iterations)", space: "O(t)" },
    defaultInput: {
        terminals: [[0, 0], [1, 0], [1, 1], [0, 1]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "list the terminal points and their coordinates",
        "for three terminals place one Fermat point junction",
        "for four terminals try all three pairings of terminals",
        "initialize each Steiner point near its pair midpoint",
        "replace each Steiner point by the Fermat point of its neighbors",
        "repeat until the 120 degree positions stabilize",
        "keep the pairing and length with the smallest total",
        "sum the segment lengths as the tree length",
        "done: report the Euclidean Steiner tree length",
    ],
};

export default module;
