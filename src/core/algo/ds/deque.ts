/**
 * deque.ts – Double-Ended Queue (Deque)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A deque ("deck") supports O(1) insertion and removal at both ends. It is
 * more flexible than a stack (one end) or queue (two ends, but only push one
 * way and pop the other). Deques power sliding-window algorithms, undo
 * buffers, and breadth-first search where nodes join both ends.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Push / pop at both ends: O(1)
 *   Space:                   O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The deque is a row of cells; front and rear are labeled.
 *   - Push-front / push-back are shown in different colours.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Both ends" is the entire point.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of deque cells.
 *
 * @param items The deque contents (front → rear).
 * @param states Optional index → state overrides.
 * @returns Cell entities in a single row.
 */
function makeCells(items: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return items.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Deque generator.
 *
 * @param input `{ ops }` – operations as [kind, value] pairs, kind ∈
 *        pushFront, pushBack, popFront, popBack.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            ops?: Array<["pushFront" | "pushBack" | "popFront" | "popBack", number]>;
        } | null) ?? {};
    const ops = task.ops ?? [
        ["pushBack", 1],
        ["pushBack", 2],
        ["pushFront", 0],
        ["pushBack", 3],
        ["popFront", 0],
        ["popBack", 0],
    ];

    let step = 0;
    const deque: number[] = [];

    // Frame 0: the empty deque.
    yield {
        stepNumber: step,
        entities: makeCells(deque.length ? deque : [0]).map((c) =>
            deque.length ? c : { ...c, label: "", value: 0 },
        ),
        edges: [],
        description: "Empty deque.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { size: 0 },
    };
    step += 1;

    for (const [op, value] of ops) {
        let states = new Map<number, EntityState>();
        if (op === "pushFront") {
            deque.unshift(value);
            states = new Map([[0, "comparing"]]);
        } else if (op === "pushBack") {
            deque.push(value);
            states = new Map([[deque.length - 1, "comparing"]]);
        } else if (op === "popFront") {
            deque.shift();
        } else {
            deque.pop();
        }

        yield {
            stepNumber: step,
            entities: makeCells(deque, states),
            edges: [],
            description: `${op} ${value === 0 ? "" : value} – deque is [${deque.join(", ")}].`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { size: deque.length },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(deque),
        edges: [],
        description: `Final deque: [${deque.join(", ")}].`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { size: deque.length },
    };
}

/** The Deque module, registered with the engine. */
const module: AlgorithmModule = {
    id: "deque",
    name: "Deque",
    category: "data-structures",
    complexity: { time: "O(1) both ends", space: "O(n)" },
    defaultInput: {
        ops: [
            ["pushBack", 1],
            ["pushBack", 2],
            ["pushFront", 0],
            ["pushBack", 3],
            ["popFront", 0],
            ["popBack", 0],
        ],
    },
    visualType: "grid",
    run,
};

export default module;
