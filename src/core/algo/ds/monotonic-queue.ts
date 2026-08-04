/**
 * monotonic-queue.ts â€?Monotonic Queue (sliding-window minimum)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A monotonic queue maintains a sequence in sorted order by discarding
 * useless candidates. For a sliding-window minimum, it keeps a deque of
 * indices whose values are strictly increasing: when a new value arrives,
 * smaller-than-it entries are popped from the back (they can never be the
 * minimum while the new value is alive), and indices outside the window are
 * popped from the front. The front is always the current window minimum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Each element pushed/popped at most once: O(n) total for n elements
 *   Space: O(k) for a window of size k
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The deque contents are highlighted.
 *   - The window minimum (front) is YELLOW (comparing).
 *   - Popped candidates are RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Discard the useless" is the entire trick.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cells for the values.
 *
 * @param values The array values.
 * @param states Optional index â†?state overrides.
 * @returns Cell entities in a single row.
 */
function makeCells(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
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
 * The Monotonic Queue generator.
 *
 * @param input `{ values, window }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; window?: number } | null) ?? {};
    const values = task.values ?? [2, 5, 3, 7, 1, 8, 4];
    const k = typeof task.window === "number" ? task.window : 3;

    let step = 0;

    // Frame 0: the array.
    yield {
        stepNumber: step,
        entities: makeCells(values),
        edges: [],
        description: `Sliding-window minimum with window size ${k} using a monotonic queue.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { window: k },
    };
    step += 1;

    // The deque of indices with increasing values.
    const deque: number[] = [];

    for (let i = 0; i < values.length; i += 1) {
        // Pop from the back while the new value is smaller (those are useless).
        while (
            deque.length > 0 &&
            (values[deque[deque.length - 1] ?? 0] ?? 0) >= (values[i] ?? 0)
        ) {
            const popped = deque.pop();
            const poppedStates = new Map<number, EntityState>([[popped ?? 0, "swapped"]]);
            yield {
                stepNumber: step,
                entities: makeCells(values, poppedStates),
                edges: [],
                description: `Popped index ${popped} from the back â€?it can never be the minimum.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { window: k, deque: [...deque] },
            };
            step += 1;
        }

        deque.push(i);

        // Pop from the front while outside the window.
        while (deque.length > 0 && (deque[0] ?? 0) <= i - k) {
            deque.shift();
        }

        // Highlight the deque and the window minimum.
        const states = new Map<number, EntityState>();
        for (const idx of deque) {
            states.set(idx, "highlight");
        }
        if (deque[0] !== undefined) {
            states.set(deque[0], "comparing");
        }

        yield {
            stepNumber: step,
            entities: makeCells(values, states),
            edges: [],
            description: `Index ${i} added. Deque [${deque.join(", ")}] â€?window minimum is ${values[deque[0] ?? 0]}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { window: k, deque: [...deque] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(values),
        edges: [],
        description: "Monotonic queue processed every element in O(n) total.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { window: k },
    };
}

/** The Monotonic Queue module, registered with the engine. */
const module: AlgorithmModule = {
    id: "monotonic-queue",
    name: "Monotonic Queue",
    category: "data-structures",
    complexity: { time: "O(n)", space: "O(k)" },
    defaultInput: { values: [2, 5, 3, 7, 1, 8, 4], window: 3 },
    visualType: "grid",
    run,
};

export default module;
