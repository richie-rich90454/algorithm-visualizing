/**
 * sweep-and-prune.ts - Sweep and prune broad-phase collision detection.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Axis-aligned bounding boxes are sorted by their minimum x coordinate. A
 * sweep line advances through those coordinates; boxes whose maximum x is
 * behind the line are pruned from the active set, and the surviving boxes are
 * tested for overlap on the y axis. Only potentially colliding pairs reach the
 * expensive narrow phase.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n log n + k) for k reported candidate pairs
 *   Space: O(n) for the active set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each box is a point at the center of its bounding rectangle.
 *   - The box under the sweep line is highlighted; pruned boxes are unvisited.
 *   - Edges connect pairs that survive both axis tests.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Box = { id: number; x1: number; y1: number; x2: number; y2: number };
type Pair = [number, number];

function entityFor(box: Box, state: EntityState): VisualEntity {
    return {
        id: `box-${box.id}`,
        type: "node",
        label: `b${box.id}`,
        value: [box.x1, box.y1, box.x2, box.y2],
        state,
        x: (box.x1 + box.x2) / 2,
        y: (box.y1 + box.y2) / 2,
        width: 0,
        height: 0,
        metadata: { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { boxes?: Array<[number, number, number, number]> } | null) ?? {};
    const boxes: Box[] = (task.boxes ?? [
        [0, 0, 3, 3],
        [2, 1, 5, 4],
        [6, 0, 9, 2],
        [4, 5, 7, 8],
        [8, 1, 11, 3],
    ]).map((b, id) => ({ id, x1: b[0], y1: b[1], x2: b[2], y2: b[3] }));
    const sorted = boxes.slice().sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
    const active: Box[] = [];
    const pairs: Pair[] = [];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: boxes.map((b) => entityFor(b, "idle")),
        edges: [],
        description: `Sorting ${boxes.length} boxes by their minimum x coordinate before the sweep.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { pairs: [], count: 0, boxes: boxes.length },
    };

    for (const box of sorted) {
        for (let i = active.length - 1; i >= 0; i -= 1) {
            if ((active[i] as Box).x2 < box.x1) active.splice(i, 1);
        }
        for (const other of active) {
            if (other.y1 <= box.y2 && box.y1 <= other.y2) {
                const pair: Pair = [Math.min(other.id, box.id), Math.max(other.id, box.id)];
                pairs.push(pair);
            }
        }
        active.push(box);
        const activeIds = new Set(active.map((b) => b.id));
        const pairEdges: VisualEdge[] = pairs.map((pair, index) => ({
            id: `pair-${index}`,
            sourceId: `box-${pair[0]}`,
            targetId: `box-${pair[1]}`,
            label: "",
            state: "path",
            directed: false,
        }));
        yield {
            stepNumber: step++,
            entities: boxes.map((b) => entityFor(b, b.id === box.id ? "active" : activeIds.has(b.id) ? "comparing" : "unvisited")),
            edges: pairEdges,
            description: `Sweep at x = ${box.x1}: ${active.length} box(es) active, ${pairs.length} candidate pair(s) so far.`,
            codeLineNumber: 3,
            layout: "point",
            meta: {
                pairs: pairs.map((p) => `${p[0]}-${p[1]}`),
                count: pairs.length,
                active: active.map((b) => b.id),
                sweep: box.x1,
            },
        };
    }

    yield {
        stepNumber: step,
        entities: boxes.map((b) => entityFor(b, pairs.some((p) => p.includes(b.id)) ? "sorted" : "idle")),
        edges: pairs.map((pair, index) => ({
            id: `pair-${index}`,
            sourceId: `box-${pair[0]}`,
            targetId: `box-${pair[1]}`,
            label: "",
            state: "path" as EntityState,
            directed: false,
        })),
        description: `Sweep complete: ${pairs.length} overlapping box pair(s) passed to the narrow phase.`,
        codeLineNumber: 7,
        layout: "point",
        meta: { pairs: pairs.map((p) => `${p[0]}-${p[1]}`), count: pairs.length, boxes: boxes.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than testing every pair of boxes, sort them along one axis and slide a line across. Once a box is completely behind the line it can never meet a later box, so it is pruned; the remaining active boxes need only a quick check on the other axis.",
        invariants: [
            "The active set contains exactly the boxes whose x interval reaches the sweep position.",
            "Any overlapping pair is reported when the later box is processed, because the earlier box is still active.",
            "Reported pairs overlap on both x and y axes.",
        ],
        correctness:
            "Two boxes overlap only if their x intervals intersect, so when the later box's left edge is reached the earlier box has not yet been pruned and both are active. The y-interval test then decides overlap exactly. Every overlapping pair is therefore found, and non-overlapping pairs fail at least one test, matching a brute-force quadratic scan.",
        complexityRationale:
            "Sorting costs O(n log n); the sweep performs one prune pass and one active-set test per box plus O(k) work for k reported pairs, giving O(n log n + k) time and O(n) space.",
        uses: [
            "Broad phase of collision detection in game and physics engines",
            "Spatial overlap queries in geographic information systems",
            "Windowing queries in databases and visualization picking",
        ],
        references: [
            "Ericson, Real-Time Collision Detection, chapter 3",
            "Gino van den Bergen, Collision Detection in Interactive 3D Environments, chapter 5",
        ],
        workedExample:
            "Boxes [0,0,3,3] and [2,1,5,4] overlap: the sweep reaches x = 2 while the first box is still active, and their y intervals intersect, so the pair is reported. A box starting at x = 6 never meets them because they are pruned before the line arrives.",
    },
    id: "sweep-and-prune",
    name: "Sweep and Prune",
    category: "geometry",
    complexity: { time: "O(n log n + k)", space: "O(n)" },
    defaultInput: {
        boxes: [
            [0, 0, 3, 3],
            [2, 1, 5, 4],
            [6, 0, 9, 2],
            [4, 5, 7, 8],
            [8, 1, 11, 3],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "given a list of axis-aligned bounding boxes",
        "sort the boxes by their minimum x coordinate",
        "initialize an empty active set and an empty pair list",
        "for each box in sorted order",
        "prune active boxes whose maximum x is left of the sweep",
        "for each remaining active box, compare y intervals",
        "record a candidate pair when both axes overlap",
        "add the current box to the active set",
    ],
};

export default module;
