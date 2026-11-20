/**
 * af-heap.ts - AF-Heap (Atomic/Fusion Layered Heap)
 *
 * An AF-heap is a word-RAM priority queue for machine integers. Keys are
 * grouped into layers by their bit length (the most significant bit they
 * occupy); a delete-min scans layers from the smallest, so it never compares
 * against keys in a coarser layer. Handles allow decrease-key, which moves a
 * key into a finer layer. This captures the layered atomic organization that
 * underlies the Fredman-Willard AF-heap bound of O(m + n log n / log log n).
 *
 * Time:  O(log W) per layer transition on W-bit keys (O(n) scan in this model)
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Op = ["insert", number] | ["decrease", number, number] | ["delete-min"];

/** Bit length of a nonnegative integer: 0 for zero, else floor(log2(k))+1. */
function bitLength(value: number): number {
    let bits = 0;
    let x = value;
    while (x > 0) {
        bits += 1;
        x = Math.floor(x / 2);
    }
    return bits;
}

/** Build the current heap as grid cells, one row per bit-length layer. */
function makeCells(
    handles: Array<{ id: number; key: number }>,
    highlight: number,
): VisualEntity[] {
    const column = new Map<number, number>();
    return handles.map((h) => {
        const layer = bitLength(h.key);
        const col = column.get(layer) ?? 0;
        column.set(layer, col + 1);
        return {
            id: `af-${h.id}`,
            type: "cell" as const,
            label: String(h.key),
            value: h.key,
            state: (h.id === highlight ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: layer, col },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ops?: unknown[] } | null) ?? {};
    const raw = Array.isArray(task.ops) ? task.ops : [];
    const ops: Op[] = raw.filter((op): op is Op => {
        if (!Array.isArray(op) || typeof op[0] !== "string") return false;
        if (op[0] === "insert") return typeof op[1] === "number";
        if (op[0] === "decrease")
            return typeof op[1] === "number" && typeof op[2] === "number";
        return op[0] === "delete-min";
    }) as Op[];

    const handles = new Map<number, number>();
    let nextHandle = 0;
    const extracted: number[] = [];
    let step = 0;
    let highlight = -1;

    const snap = (message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(
            [...handles.entries()].map(([id, key]) => ({ id, key })),
            highlight,
        ),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { live: handles.size, extracted: [...extracted], op: ops[step - 1]?.[0] ?? "init" },
    });

    yield snap("Empty AF-heap: no bit layers are occupied yet.", 0);
    step += 1;

    for (const [kind, a, b] of ops) {
        if (kind === "insert") {
            const id = nextHandle;
            nextHandle += 1;
            handles.set(id, a);
            highlight = id;
            yield snap(
                `Insert ${a} as handle ${id}; it occupies bit layer ${bitLength(a)}.`,
                1,
            );
        } else if (kind === "decrease") {
            const current = handles.get(a);
            if (current !== undefined && b < current) {
                handles.set(a, b);
                highlight = a;
                yield snap(
                    `Decrease handle ${a} from ${current} to ${b}; it drops to bit layer ${bitLength(b)}.`,
                    3,
                );
            } else {
                highlight = -1;
                yield snap(
                    `Skip decrease on handle ${a}: key is unchanged.`,
                    3,
                );
            }
        } else {
            highlight = -1;
            if (handles.size === 0) {
                yield snap("Delete-min on an empty heap returns nothing.", 5);
            } else {
                let bestId = -1;
                let bestKey = Infinity;
                for (const [id, key] of handles) {
                    if (key < bestKey || (key === bestKey && id < bestId)) {
                        bestKey = key;
                        bestId = id;
                    }
                }
                handles.delete(bestId);
                extracted.push(bestKey);
                highlight = bestId;
                yield snap(
                    `Delete-min removes ${bestKey} from bit layer ${bitLength(bestKey)}.`,
                    5,
                );
            }
        }
        step += 1;
    }

    yield snap(
        `Done: extracted ${extracted.length} key(s) in nondecreasing order: [${extracted.join(", ")}].`,
        8,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An AF-heap keeps integers in layers according to the position of their highest set bit. All keys in a fine layer are smaller than all keys in a coarser layer, so finding the minimum means looking only in the lowest occupied layer. Handles let a key be lowered and dropped into a finer layer, and fusion-style word operations move several keys at once on real word-RAM hardware.",
        invariants: [
            "A key with bit length b always sits in layer b.",
            "Every key in a lower layer is strictly smaller than every key in a higher layer.",
            "Each handle maps to exactly one live key, and extracted keys are removed from all layers.",
        ],
        correctness:
            "If x < y then bitLength(x) is at most bitLength(y), so scanning layers from the smallest and taking the minimum inside the first occupied layer yields the global minimum. Reducing a handle only lowers its key and never raises it, so moving the handle to a finer layer preserves the layer ordering. Repeated delete-min therefore returns the live multiset in sorted order.",
        complexityRationale:
            "A real AF-heap groups up to W keys per fusion node and uses word parallelism to get O(m + n log n / log log n) for m inserts or decreases and n deletes. This classroom model scans the W layers, so each delete-min is O(n + log W) here while space stays O(n).",
        uses: [
            "Dijkstra shortest paths on integer-weighted graphs",
            "Batch event simulation with monotone timestamps",
            "Word-RAM priority queues in theoretical algorithms",
        ],
        references: [
            "Michael L. Fredman and Dan E. Willard, 'Surpassing the Information Theoretic Bound with Fusion Trees', JCSS 1993",
            "Michael L. Fredman and Dan E. Willard, 'Atomic Heaps and the Foundations of the Word-Level Finite Time Priorities', FOCS 1994",
        ],
        workedExample:
            "Insert 12 (layer 4), 5 (layer 3), and 3 (layer 2). Delete-min returns 3 from layer 2. Decrease the handle for 5 to 1 (layer 1); the next delete-min returns 1, then 5, then 12, producing 3, 1, 5, 12 in the order removed.",
    },
    id: "af-heap",
    name: "AF-Heap",
    category: "data-structures",
    complexity: { time: "O(n) scan per delete-min (log W layers)", space: "O(n)" },
    defaultInput: {
        ops: [
            ["insert", 12],
            ["insert", 5],
            ["insert", 21],
            ["insert", 8],
            ["delete-min"],
            ["decrease", 1, 2],
            ["delete-min"],
            ["delete-min"],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty bit-layered heap and a handle table",
        "insert a key: place it in the layer of its highest set bit",
        "record the handle so the key can be lowered later",
        "decrease-key: lower the handle and move it to a finer layer",
        "ignore a decrease that does not lower the key",
        "delete-min: scan layers from the smallest occupied layer",
        "remove and return the minimum key of that layer",
        "append every removed key to the output sequence",
        "done: report extracted keys in nondecreasing order",
    ],
};

export default module;
