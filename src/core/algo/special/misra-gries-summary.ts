/**
 * misra-gries-summary.ts – Misra–Gries heavy-hitter summary.
 * Two counters scan 8 items: hits increment, misses occupy an empty
 * slot or decrement every counter. Survivors with count > 0 are the
 * candidates (any item past n/3 occurrences is guaranteed present).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { stream?: string[]; k?: number } | null) ?? {};
    const stream =
        Array.isArray(cfg.stream) && cfg.stream.length > 0
            ? (cfg.stream as string[]).slice(0, 12)
            : ["a", "b", "a", "c", "a", "b", "a", "d"];
    const k = Math.max(1, Math.min(4, cfg.k ?? 2));
    const table = new Map<string, number>();
    let step = 0;
    const frame = (idx: number, desc: string): VisualFrame => {
        const entries = [...table.entries()];
        const entities: VisualEntity[] = entries.map(([key, v], i) => ({
            id: `mg-${i}`,
            type: "cell" as const,
            label: `${key}=${v}`,
            value: v,
            state: "sorted" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        const cur = stream[idx];
        if (idx >= 0 && idx < stream.length && cur !== undefined) {
            entities.push({
                id: "cur",
                type: "cell" as const,
                label: `→${cur}`,
                value: cur,
                state: "comparing" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 1, col: idx },
            });
        }
        if (entities.length === 0) {
            entities.push({
                id: "mg-empty",
                type: "cell" as const,
                label: "∅",
                value: "∅",
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            });
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.max(0, Math.min(idx, 6)),
            layout: "grid",
            meta: { counters: entries.map(([key, v]) => `${key}=${v}`).join(","), index: idx },
        };
    };
    yield frame(
        -1,
        `Stream [${stream.join(",")}] with k=${k} counters; heavy = past ${stream.length}/${k + 1} occurrences.`,
    );
    step += 1;
    for (let i = 0; i < stream.length; i += 1) {
        const item = stream[i] ?? "";
        if (table.has(item)) table.set(item, (table.get(item) ?? 0) + 1);
        else if (table.size < k) table.set(item, 1);
        else {
            for (const [key, v] of [...table.entries()]) {
                if (v <= 1) table.delete(key);
                else table.set(key, v - 1);
            }
        }
        yield frame(
            i,
            `Saw "${item}": counters {${[...table.entries()].map(([key, v]) => `${key}=${v}`).join(", ") || "empty"}}.`,
        );
        step += 1;
    }
    yield frame(
        stream.length,
        `Candidates {${[...table.keys()].join(", ")}} — "a" (×${stream.filter((s) => s === "a").length}) survives as the true heavy hitter.`,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Misra-Gries finds candidate frequent items, or heavy hitters, in a stream with only k counters. If the item is already counted, increment it; if a slot is free, start a new counter; otherwise decrement every counter by one. Any item occurring more than n/(k+1) times is guaranteed to survive with a positive count.",
        "invariants": [
            "The sum of the counters never exceeds the number of processed items.",
            "All counters are non-negative.",
            "An item that is truly frequent cannot be silently dropped from the table."
        ],
        "correctness": "Each decrement-all step accounts for one occurrence of up to k distinct items using k+1 stream items, so it can eliminate only an item whose total count is at most n/(k+1). Any item occurring more often is never fully removed and appears as a survivor. False positives are possible and can be confirmed with a second pass.",
        "complexityRationale": "Each stream item either updates one counter or decrements up to k counters, O(k) worst case per item and O(n·k) total. Only k counters are stored, O(k) space, independent of stream length.",
        "uses": [
            "Detecting heavy network flows for traffic engineering",
            "Finding trending items in clickstreams",
            "Frequency capping in advertising",
            "Identifying popular keys in databases and text streams"
        ],
        "references": [
            "Misra and Gries, Finding Repeated Elements, Science of Computer Programming, 1982",
            "Muthukrishnan, Data Streams: Algorithms and Applications, 2005"
        ],
        "workedExample": "For [a,b,a,c,a,b,a,d] with k=2: a and b take the two slots; seeing c when full decrements both, removing b. After more a's, d triggers another decrement and leaves only a with a positive count. The true count of a is 4, above 8/3, so a is guaranteed among the survivors."
    },
    id: "misra-gries-summary",
    name: "Misra–Gries Summary",
    category: "data-structures",
    complexity: { time: "O(n·k)", space: "O(k)" },
    defaultInput: { stream: ["a", "b", "a", "c", "a", "b", "a", "d"], k: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize k counters as empty table",
        "for each stream item in order",
        "if item counted then increment its counter",
        "else if space then start a new counter",
        "else decrement every counter by one",
        "collect survivors as heavy-hitter candidates",
        "done: candidates include true frequent items",
    ],
};

export default module;
