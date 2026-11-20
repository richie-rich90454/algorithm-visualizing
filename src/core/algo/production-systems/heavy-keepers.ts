/**
 * heavy-keepers.ts - Heavy Keepers Frequent-Item Summary
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Heavy Keepers tracks a small fixed number of candidate keys while a stream
 * streams past. A seen key increments its counter; an unseen key takes a free
 * slot; when every slot is busy the counters are all reduced by their minimum
 * and emptied slots are reclaimed. Any key occurring more than n/k times must
 * survive, so the final counters are a compact list of the heavy hitters.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * k) for m stream items and k counters
 *   Space: O(k) counters plus O(m) visualized stream cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero is the input stream; row one is the counter table.
 *   - The current stream item is highlighted; counters show live estimates.
 *   - meta carries the final candidates and exact frequencies.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface HeavyInput {
    stream?: number[];
    k?: number;
}

const DEFAULT_STREAM = [1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 3, 1, 5, 1, 2, 1];

function cell(id: string, row: number, col: number, label: string, value: string | number, state: EntityState): VisualEntity {
    return { id, type: "cell", label, value, state, x: 0, y: 0, width: 0, height: 0, metadata: { row, col } };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HeavyInput | null) ?? {};
    const stream = Array.isArray(task.stream) && task.stream.length > 0 ? task.stream.map(Number) : DEFAULT_STREAM;
    const k = Math.max(1, typeof task.k === "number" ? Math.floor(task.k) : 4);
    const counters = new Map<number, number>();
    const exact = new Map<number, number>();
    for (const item of stream) exact.set(item, (exact.get(item) ?? 0) + 1);
    let step = 0;
    const cols = Math.max(stream.length, k);
    const emit = (entities: VisualEntity[], description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step++,
        entities,
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: 2, cols, k, ...meta },
    });
    const entitiesFor = (current: number, lastAction: string): VisualEntity[] => [
        ...stream.map((item, i) => cell(`s-${i}`, 0, i, String(item), item, i === current ? "active" : i < current ? "visited" : "idle")),
        ...Array.from({ length: k }, (_, slot) => {
            const entry = [...counters.entries()][slot];
            return cell(
                `c-${slot}`,
                1,
                slot,
                entry ? `${entry[0]}:${entry[1]}` : "-",
                entry ? `${entry[0]}:${entry[1]}` : "-",
                entry && lastAction === "increment" && entry[0] === stream[current] ? "sorted" : "idle",
            );
        }),
    ];

    yield emit(entitiesFor(-1, "init"), `Tracking up to ${k} candidate heavy hitters over ${stream.length} items.`, 0, {
        stage: "init",
        stream: [...stream],
        exact: [...exact].map(([key, count]) => `${key}:${count}`),
    });

    for (let i = 0; i < stream.length; i += 1) {
        const item = stream[i] as number;
        let action: string;
        if (counters.has(item)) {
            counters.set(item, (counters.get(item) as number) + 1);
            action = "increment";
        } else if (counters.size < k) {
            counters.set(item, 1);
            action = "insert";
        } else {
            const minimum = Math.min(...counters.values());
            for (const [key, count] of [...counters]) {
                const next = count - minimum;
                if (next === 0) counters.delete(key);
                else counters.set(key, next);
            }
            action = "decrement";
        }
        yield emit(entitiesFor(i, action), `Item ${i + 1}: ${item} -> ${action}; counters ${[...counters].map(([key, c]) => `${key}:${c}`).join(", ") || "empty"}.`, action === "decrement" ? 3 : action === "insert" ? 2 : 1, {
            stage: "stream",
            action,
            counters: [...counters].map(([key, c]) => `${key}:${c}`),
        });
    }

    const threshold = stream.length / k;
    const reported = [...counters].filter(([, count]) => count > 0).map(([key]) => key).sort((a, b) => a - b);
    const lost = [...exact.keys()].filter((key) => (exact.get(key) as number) > threshold && !reported.includes(key));
    yield emit(
        [...reported.map((key, i) => cell(`h-${i}`, 0, i, `${key}:${exact.get(key)}`, `${key}:${exact.get(key)}`, "sorted")), ...[...exact].map(([key, count], i) => cell(`e-${i}`, 1, i, `${key}:${count}`, `${key}:${count}`, "visited"))],
        `Done: ${reported.length} heavy candidate(s); every item above frequency ${threshold.toFixed(2)} was kept.`,
        4,
        {
            stage: "done",
            threshold,
            reported,
            exact: [...exact].map(([key, count]) => `${key}:${count}`),
            missed: lost,
        },
    );
}

/** The Heavy Keepers module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A stream is too long to store, but a few items dominate it. Keep a small table of candidates: a seen candidate gets a vote, a new item fills an empty slot, and when the table is full every candidate loses one vote. An item that appears often enough keeps replenishing its votes and can never be pushed out, so the survivors are the heavy hitters.",
        invariants: [
            "At most k candidates are monitored at any time.",
            "A candidate's counter is a lower bound on the true number of times it was seen since insertion.",
            "A key appearing more than n/k times is present in the final table.",
        ],
        correctness:
            "When a candidate is evicted, a batch decrement has removed at least one vote from every slot, which means at least k stream items arrived after that candidate's last insertion. Each removal therefore consumes at least k items other than the candidate. If a key occurs f times with f greater than n/k, then fewer than f removal episodes can happen before the stream ends, so the key is never evicted and remains in the final table.",
        complexityRationale:
            "Each of the m items either increments one counter, fills one slot, or scans all k counters for a minimum, so the time is O(m*k). Only the k counters are retained for the summary, giving O(k) working space.",
        uses: [
            "Finding popular queries in search logs",
            "Identifying heavy network flows for traffic engineering",
            "Detecting hot keys in distributed caches and shards",
        ],
        references: [
            "Metwally, Agrawal, and El Abbadi, Efficient Computation of Frequent and Top-k Elements in Data Streams, 2005",
            "Misra and Gries, Finding Repeated Elements, 1982",
        ],
        workedExample:
            "With k=2 and the stream 1, 2, 1, 3, 1, 1, the counters evolve from {1:1} to {1:1, 2:1}, a decrement clears both on the 3, and the remaining ones rebuild {1:3}. Key 1 occurs four times out of six, above the 3-item threshold, and is reported.",
    },
    id: "heavy-keepers",
    name: "Heavy Keepers",
    category: "production-systems",
    complexity: { time: "O(m * k)", space: "O(k)" },
    defaultInput: { stream: DEFAULT_STREAM, k: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize k empty candidate counters",
        "for each item in the stream",
        "if the item is tracked, increment its counter",
        "else if a slot is free, insert the item with count one",
        "else subtract the minimum count from every counter",
        "remove counters that reach zero and keep the others",
        "done: report survivors whose true frequency exceeds n over k",
    ],
};

export default module;
