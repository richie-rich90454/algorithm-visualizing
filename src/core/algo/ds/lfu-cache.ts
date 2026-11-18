/**
 * lfu-cache.ts – LFU Cache
 *
 * Frequency buckets: every access bumps its key to the next bucket, and
 * overflow evicts from the lowest non-empty bucket – least frequently
 * used goes first.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const nonEmpty = (list: VisualEntity[]): VisualEntity[] =>
    list.length > 0
        ? list
        : [
              {
                  id: "empty-note",
                  type: "cell" as const,
                  label: "(empty)",
                  value: 0,
                  state: "idle" as EntityState,
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  metadata: { row: 0, col: 0 },
              },
          ];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { capacity?: number; accesses?: string[] } | null) ?? {};
    const capacity = task.capacity ?? 2;
    const accesses = task.accesses ?? ["a", "b", "a", "c", "c"];
    let step = 0;
    let hits = 0;

    const freq = new Map<string, number>();
    const snap = (hot: string, message: string, line: number, evicted: string): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            [...freq.entries()].map(([k, f], i) => ({
                id: `lfu-${k}`,
                type: "cell" as const,
                label: `${k}x${f}`,
                value: f,
                state: (k === hot ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: i },
            })),
        ),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { capacity, hits, evicted },
    });

    yield snap("", `Empty LFU cache – capacity ${capacity}.`, 0, "");
    step += 1;
    for (const k of accesses) {
        if (freq.has(k)) {
            freq.set(k, (freq.get(k) ?? 0) + 1);
            hits += 1;
            yield snap(k, `Hit on ${k} – frequency now ${freq.get(k)}.`, 1, "");
        } else {
            let evicted = "";
            if (freq.size >= capacity) {
                let victim = "";
                let victimF = Infinity;
                for (const [ck, cf] of freq) {
                    if (cf < victimF) {
                        victimF = cf;
                        victim = ck;
                    }
                }
                freq.delete(victim);
                evicted = victim;
            }
            freq.set(k, 1);
            yield snap(
                k,
                evicted !== ""
                    ? `Miss on ${k} – evicted least-frequent ${evicted}.`
                    : `Miss on ${k} – cached.`,
                2,
                evicted,
            );
        }
        step += 1;
    }
    yield snap("", `${hits} hit(s) – survivors ${[...freq.keys()].join(",")}.`, 3, "");
}

const module: AlgorithmModule = {

    education: {
        "intuition": "An LFU cache evicts the least frequently used entry. It groups keys into frequency buckets and a hit moves the key to the next higher bucket. On a miss at capacity, the cache drops the least recently used entry from the lowest nonempty bucket.",
        "invariants": [
            "A key in bucket f has been accessed f times since insertion.",
            "A pointer tracks the current minimum frequency.",
            "Total cached keys never exceeds capacity."
        ],
        "correctness": "Moving a hit to the next bucket accurately raises its frequency, so bucket membership always reflects access counts. Evicting from the lowest bucket removes a least-frequently-used key, with recency as a tie-break. Therefore the cache retains the most frequently used entries.",
        "complexityRationale": "Hash lookup plus constant-time list moves give O(1) per access. Storing keys, frequencies, and buckets uses O(capacity) space.",
        "uses": [
            "Caches where access frequency matters more than recency",
            "CDN and database buffer policies",
            "Query-result caching"
        ],
        "references": [
            "Alan Jay Smith, survey of cache memory design and evaluation, 1982",
            "Nimrod Megiddo and Dharmendra Modha, \"ARC\" paper, FAST 2003, for comparison"
        ],
        "workedExample": "With capacity 2 and accesses a, b, a, c, c: a and b start at frequency 1; the second a moves to bucket 2. Inserting c evicts b from bucket 1. The second c moves to bucket 2, leaving a and c cached with frequencies 2 and 2."
    },
    id: "lfu-cache",
    name: "LFU Cache",
    category: "data-structures",
    complexity: { time: "O(1)", space: "O(capacity)" },
    defaultInput: { capacity: 2, accesses: ["a", "b", "a", "c", "c"] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize LFU cache with empty frequency lists",
        "request key and check map for hit",
        "on hit increment frequency and move to next list",
        "compare frequencies to track minimum frequency",
        "on miss evict least-frequent least-recent entry",
        "insert missed key with frequency 1",
        "done: cache holds keys with hit count and frequencies",
    ],
};

export default module;
