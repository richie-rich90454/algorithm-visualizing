/**
 * clock-cache.ts – Clock Cache
 *
 * LRU on a budget: a circular hand sweeps entries, clearing reference
 * bits until it finds one already cleared – that victim is evicted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { capacity?: number; accesses?: string[] } | null) ?? {};
    const capacity = task.capacity ?? 3;
    const accesses = task.accesses ?? ["a", "b", "c", "a", "d"];
    let step = 0;
    let hits = 0;

    const slots: Array<{ key: string; ref: number } | null> = new Array(capacity).fill(null);
    let hand = 0;
    const snap = (message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: slots.map((s, i) => ({
            id: `cc-${i}`,
            type: "cell" as const,
            label: s === null ? "-" : `${s.key}${s.ref === 1 ? "*" : ""}`,
            value: s === null ? "-" : s.key,
            state: (i === hand ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        })),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { capacity, hand, hits },
    });

    yield snap(`Empty clock – capacity ${capacity}, hand at 0.`, 0);
    step += 1;
    for (const k of accesses) {
        const at = slots.findIndex((s) => s !== null && s.key === k);
        if (at >= 0) {
            const s = slots[at];
            if (s !== null) {
                s.ref = 1;
            }
            hits += 1;
            yield snap(`Hit on ${k} – reference bit set, hand stays at ${hand}.`, 1);
        } else {
            let evicted = "";
            for (;;) {
                const s = slots[hand];
                if (s === null) {
                    slots[hand] = { key: k, ref: 1 };
                    break;
                }
                if (s.ref === 0) {
                    evicted = s.key;
                    slots[hand] = { key: k, ref: 1 };
                    break;
                }
                s.ref = 0;
                hand = (hand + 1) % capacity;
            }
            hand = (hand + 1) % capacity;
            yield snap(
                evicted !== ""
                    ? `Miss on ${k} – hand swept and evicted ${evicted}.`
                    : `Miss on ${k} – took a free slot.`,
                2,
            );
        }
        step += 1;
    }
    const keys = slots.filter((s) => s !== null).map((s) => (s as { key: string }).key);
    yield snap(`${hits} hit(s) – residents [${keys.join(",")}].`, 3);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "CLOCK cache approximates LRU with a single rotating hand and one reference bit per frame. A hit sets the bit; when space is needed the hand sweeps, clearing bits it sees and evicting the first frame whose bit is already clear. This gives second-chance behavior without maintaining a full recency list.",
        "invariants": [
            "Each frame holds at most one key and a reference bit.",
            "The hand advances only during a search for a victim.",
            "A frame with reference bit 1 has been used since the last sweep."
        ],
        "correctness": "Clearing a bit on the first pass and evicting on a later pass guarantees a recently used frame gets a second chance before eviction. Because the hand eventually visits every frame, it always finds a victim when all bits are clear. Hits are found by scanning frames, so lookup correctness is independent of replacement.",
        "complexityRationale": "A hit is found by a constant-capacity scan, O(capacity), and eviction sweeps at most a full circle before finding a clear bit, amortized O(1) per miss. Space is O(capacity) frames.",
        "uses": [
            "Operating-system page replacement",
            "Database buffer pools",
            "Lightweight caches where LRU lists are too costly"
        ],
        "references": [
            "F. Corbato, \"A Paging Experiment with the Multics System\", 1969",
            "Alan Jay Smith, survey of cache memory design and evaluation, 1982"
        ],
        "workedExample": "With capacity 3 and accesses a, b, c, a, d: frames fill with a, b, c and bits are set after use. Accessing a sets its bit. Inserting d starts the hand, clears bits on first-chance frames, and evicts the first frame whose bit is already 0, typically b, leaving a, c, d."
    },
    id: "clock-cache",
    name: "Clock Cache",
    category: "data-structures",
    complexity: { time: "O(1) amortized", space: "O(capacity)" },
    defaultInput: { capacity: 3, accesses: ["a", "b", "c", "a", "d"] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize CLOCK cache with reference bits cleared",
        "request key and check frames for a hit",
        "on hit set reference bit to 1 and count hit",
        "sweep hand clearing reference bits on second chance",
        "evict first frame with reference bit 0",
        "insert missed key at hand position",
        "done: cache frames hold keys with hit count",
    ],
};

export default module;
