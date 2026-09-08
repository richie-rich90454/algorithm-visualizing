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
    id: "clock-cache",
    name: "Clock Cache",
    category: "data-structures",
    complexity: { time: "O(1) amortized", space: "O(capacity)" },
    defaultInput: { capacity: 3, accesses: ["a", "b", "c", "a", "d"] },
    visualType: "grid",
    run,
};

export default module;
