/**
 * morton-order.ts - Morton (Z-order) bit interleaving
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Morton order maps a two-dimensional coordinate to a single number by
 * interleaving the bits of x and y. Sorting points by their Morton code visits
 * them along a recursive Z-shaped space-filling curve, which tends to keep
 * nearby points near each other in the one-dimensional order. The same bits
 * can be spread apart again to recover the original coordinates.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) to sort n codes; O(1) per encode or decode
 *   Space: O(n) for the codes and the ordered path
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid points are drawn at their true coordinates.
 *   - Each frame reveals one more point in Morton-sorted order.
 *   - The final frame draws the Z-order path connecting consecutive points.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

/** Spread the low 16 bits of n so they occupy every other bit position. */
function part1by1(n: number): number {
    let x = n & 0xffff;
    x = (x | (x << 8)) & 0x00ff00ff;
    x = (x | (x << 4)) & 0x0f0f0f0f;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;
    return x >>> 0;
}

/** Interleave x and y into a single Morton code (x in even bits, y in odd bits). */
function encode(x: number, y: number): number {
    return (part1by1(x) | (part1by1(y) << 1)) >>> 0;
}

/** Gather every other bit of n back into the low bits. */
function compact1by1(n: number): number {
    let x = n & 0x55555555;
    x = (x | (x >>> 1)) & 0x33333333;
    x = (x | (x >>> 2)) & 0x0f0f0f0f;
    x = (x | (x >>> 4)) & 0x00ff00ff;
    x = (x | (x >>> 8)) & 0x0000ffff;
    return x >>> 0;
}

/** Recover the (x, y) coordinates from a Morton code. */
function decode(code: number): Pt {
    return [compact1by1(code), compact1by1(code >>> 1)];
}

/** Build point nodes; logical y is negated so the plot reads in math orientation. */
function nodes(points: Pt[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return points.map(([x, y], index) => ({
        id: `p-${index}`,
        type: "node" as const,
        label: `${index}`,
        value: [x, y],
        state: states.get(index) ?? "unvisited",
        x,
        y: -y,
        width: 0,
        height: 0,
        metadata: { x, y, index },
    }));
}

/** Path edges joining points in the given Morton-sorted order. */
function pathEdges(order: number[]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 0; i < order.length - 1; i += 1) {
        const from = order[i];
        const to = order[i + 1];
        if (from === undefined || to === undefined) {
            continue;
        }
        edges.push({
            id: `z-${from}-${to}`,
            sourceId: `p-${from}`,
            targetId: `p-${to}`,
            label: "",
            state: "path",
            directed: true,
        });
    }
    return edges;
}

/** The Morton order generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[] } | null) ?? {};
    const points: Pt[] = (task.points ?? [
        [0, 0],
        [1, 1],
        [2, 0],
        [3, 2],
        [1, 3],
        [4, 4],
        [2, 2],
        [0, 3],
    ]).map((p) => [p[0], p[1]] as Pt);

    let step = 0;
    const emit = (
        states: Map<number, EntityState>,
        edges: VisualEdge[],
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean | Array<number | string>>,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: nodes(points, states),
        edges,
        description,
        codeLineNumber,
        layout: "point",
        meta,
    });

    const codes = points.map(([x, y]) => encode(x, y));
    const order = points
        .map((_, index) => index)
        .sort((a, b) => (codes[a] as number) - (codes[b] as number) || a - b);

    yield emit(
        new Map(),
        [],
        `Morton: interleaving the bits of ${points.length} grid coordinates.`,
        1,
        { count: points.length },
    );

    const revealed: number[] = [];
    for (const idx of order) {
        revealed.push(idx);
        const states = new Map<number, EntityState>();
        for (const r of revealed) {
            states.set(r, "sorted");
        }
        states.set(idx, "active");
        yield emit(
            states,
            pathEdges(revealed),
            `Morton: point ${idx} at (${(points[idx] as Pt)[0]}, ${(points[idx] as Pt)[1]}) has code ${codes[idx]}.`,
            3,
            {
                point: idx,
                code: codes[idx] as number,
                orderSoFar: [...revealed],
            },
        );
    }

    const finalStates = new Map<number, EntityState>();
    for (const idx of order) {
        finalStates.set(idx, "sorted");
    }
    yield emit(
        finalStates,
        pathEdges(order),
        `Morton: Z-order path visits ${order.length} points in code-sorted order.`,
        5,
        {
            codes,
            order,
            decoded: codes.map((code) => decode(code)).flat(),
        },
    );
}

/** The Morton order module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Morton order turns a grid coordinate into a single sort key by weaving the bits of x and y together. Reading the key back in sorted order traces a repeating Z shape across the grid. The bit pattern means that points close in the plane usually stay close in the one-dimensional order, which is why the curve is used to linearize spatial data.",
        invariants: [
            "Even bit positions of a code come from x and odd positions come from y.",
            "Encode followed by decode returns the original coordinate when it fits in 16 bits.",
            "Sorting by Morton code follows the recursive Z-order curve.",
        ],
        correctness:
            "Interleaving places each coordinate bit at a fixed parity position, so the mapping is a bijection on 16-bit coordinates and the gather operation is its exact inverse. Sorting by the resulting integer orders points by their most significant differing coordinate bit first, which is precisely the recursive quadrant order of the Z curve.",
        complexityRationale:
            "Interleaving a fixed-width integer takes a constant number of bit operations, so encoding and decoding are O(1). Sorting n codes costs O(n log n) comparisons, and storing the codes plus the path uses O(n) space.",
        uses: [
            "Linearizing spatial indexes in geodetic and geographic databases",
            "Improving cache locality in grid and octree traversals",
            "Building uniform spatial hashes for parallel load balancing",
        ],
        references: [
            "Morton, A Computer Oriented Geodetic Data Base and a New Technique in File Sequencing, 1966",
            "Sagan, Space-Filling Curves, Chapters 1 and 7",
        ],
        workedExample:
            "For the coordinate (2, 1), x is binary 10 and y is 01. Interleaving even bits from x and odd bits from y gives binary 0110, which is decimal 6. Gathering even bits back yields 2 and gathering odd bits yields 1, recovering the original point.",
    },
    id: "morton-order",
    name: "Morton Order (Z-Order Curve)",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [1, 1],
            [2, 0],
            [3, 2],
            [1, 3],
            [4, 4],
            [2, 2],
            [0, 3],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "spread the bits of x into the even bit positions",
        "spread the bits of y into the odd bit positions",
        "combine both spreads to form the Morton code",
        "sort all points by their Morton code",
        "visiting points in that order traces the Z curve",
        "gather alternate bits back to decode a code",
        "draw the path joining consecutive points and report the codes",
    ],
};

export default module;
