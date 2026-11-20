/**
 * space-saving-algorithm.ts - Space Saving for Frequent Items
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Space Saving keeps k counters for a stream of items. A seen item increments
 * its counter; a new item either takes an empty slot or replaces the slot with
 * the smallest count, taking that count as its starting value. This guarantees
 * that no counter underestimates its item and that the overestimate is bounded
 * by the smallest counter, which is at most N/k.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) per item to find the minimum, O(N k) total
 *   Space: O(k) counters, independent of stream length
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells hold each tracked item and its estimated count.
 *   - The incoming item is GOLD; a replaced item flashes RED.
 *   - Survivors in the final frame are GREEN.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Pure reference: final counter estimates after the whole stream. */
export function spaceSavingFinal(stream: string[], k: number): Map<string, number> {
    const table = new Map<string, number>();
    for (const item of stream) {
        if (table.has(item)) table.set(item, (table.get(item) as number) + 1);
        else if (table.size < k) table.set(item, 1);
        else {
            let minKey = "";
            let minVal = Infinity;
            for (const [key, v] of table.entries()) {
                if (v < minVal) {
                    minVal = v;
                    minKey = key;
                }
            }
            table.delete(minKey);
            table.set(item, minVal + 1);
        }
    }
    return table;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { stream?: string[]; k?: number } | null) ?? {};
    const stream: string[] = Array.isArray(task.stream)
        ? [...(task.stream as string[])]
        : ["a", "b", "c", "a", "b", "a", "d", "a", "b", "e", "a", "c", "a", "b", "a", "d", "a", "b"];
    const k = Math.max(1, typeof task.k === "number" ? task.k : 3);
    const table = new Map<string, number>();
    let replaced: string | null = null;
    let step = 0;

    const emit = (
        index: number,
        description: string,
        codeLineNumber: number,
        final = false,
        extra: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => {
        const entities: VisualEntity[] = [...table.entries()].map(([key, v], col) => ({
            id: `cell-${col}`,
            type: "cell" as const,
            label: `${key}=${v}`,
            value: key,
            state: final ? "sorted" as EntityState : key === replaced ? "error" as EntityState : "idle" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col, item: key, count: v },
        }));
        const cur = index >= 0 && index < stream.length ? stream[index] : undefined;
        if (cur !== undefined) {
            entities.push({
                id: "current",
                type: "cell" as const,
                label: `now: ${cur}`,
                value: cur,
                state: "comparing" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 1, col: index },
            });
        }
        if (entities.length === 0) {
            entities.push({
                id: "empty",
                type: "cell" as const,
                label: "empty table",
                value: "empty",
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            });
        }
        const s = step;
        step += 1;
        return {
            stepNumber: s,
            entities,
            edges: [],
            description,
            codeLineNumber,
            layout: "grid",
            meta: { k, N: stream.length, index, entries: table.size, ...extra },
        };
    };

    yield emit(-1, `Space Saving with k=${k} counters over ${stream.length} items.`, 0);
    for (let i = 0; i < stream.length; i += 1) {
        const item = stream[i] as string;
        replaced = null;
        if (table.has(item)) {
            table.set(item, (table.get(item) as number) + 1);
            yield emit(i, `Saw "${item}": its estimate rises to ${table.get(item)}.`, 2);
        } else if (table.size < k) {
            table.set(item, 1);
            yield emit(i, `Free slot: "${item}" starts with estimate 1.`, 3);
        } else {
            let minKey = "";
            let minVal = Infinity;
            for (const [key, v] of table.entries()) {
                if (v < minVal) {
                    minVal = v;
                    minKey = key;
                }
            }
            table.delete(minKey);
            replaced = minKey;
            table.set(item, minVal + 1);
            yield emit(i, `Table full: replaced "${minKey}" with "${item}" at estimate ${minVal + 1}.`, 4);
        }
    }
    const estimates = [...table.entries()].map(([key, v]) => `${key}=${v}`).join(", ");
    yield emit(stream.length, `Final estimates: ${estimates || "none"}.`, 5, true, { estimates: [...table.entries()].map(([key, v]) => `${key}=${v}`) });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Space Saving is a tiny cache of candidate heavy hitters. When a new item arrives and the cache is full, it evicts the item with the smallest counter and gives the newcomer that counter value plus one. Starting the new counter above zero accounts for the occurrences that were missed while the item was absent, so counters never understate their items.",
        invariants: [
            "Every counter is an upper bound on the true frequency of its item.",
            "The sum of the counters equals the number of stream items processed.",
            "The smallest counter is at most N/k after N items.",
        ],
        correctness:
            "When an item is evicted, its counter value is the current minimum, and the replacement inherits that value. An item can be undercounted by at most the minimum counter at the moment it was inserted, which is never larger than the final minimum and is at most N/k because k counters sum to N. Hence every estimate lies between the true frequency and the true frequency plus N/k, and any item with frequency above N/k must be present.",
        complexityRationale:
            "A hit updates one counter in O(1); a miss on a full table scans k counters to find the minimum, so each item costs O(k) and the stream costs O(N k). Memory is exactly k counters, O(k), independent of the stream length.",
        uses: [
            "Heavy-hitter detection in routers and network monitoring",
            "Popular-key tracking in databases and caches",
            "Streaming telemetry with a strict memory budget",
        ],
        references: [
            "Metwally, Agrawal, and El Abbadi, Efficient Computation of Frequent and Top-k Elements in Data Streams, ICDT 2005",
            "Muthukrishnan, Data Streams: Algorithms and Applications, 2005",
        ],
        workedExample:
            "With k=2 and the stream a, b, c, a, b, a, the slots hold a=1 and b=1; seeing c evicts a (the first minimum) to get c=2, then a returns and evicts b to get a=2. The final estimates are c=2 and a=2, each at least the true frequency.",
    },
    id: "space-saving-algorithm",
    name: "Space Saving Algorithm",
    category: "searching",
    complexity: { time: "O(N k)", space: "O(k)" },
    defaultInput: {
        stream: ["a", "b", "c", "a", "b", "a", "d", "a", "b", "e", "a", "c", "a", "b", "a", "d", "a", "b"],
        k: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize k empty counters",
        "for each item in the stream",
        "if the item is tracked: increment its counter",
        "else if a slot is free: insert the item with count 1",
        "else replace the minimum counter with this item at min+1",
        "after the stream, read each counter as a frequency estimate",
        "report items whose estimate exceeds N/k as heavy hitters",
        "done: bounded overestimates, no underestimates",
    ],
};

export default module;
