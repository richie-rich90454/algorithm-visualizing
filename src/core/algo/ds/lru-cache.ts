/**
 * lru-cache.ts – LRU Cache
 *
 * Hash map plus recency list: hits promote to the front, and overflow
 * evicts the tail – the least recently used entry.
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
    const accesses = task.accesses ?? ["a", "b", "a", "c"];
    let step = 0;
    let hits = 0;

    const order: string[] = [];
    const snap = (hot: string, message: string, line: number, evicted: string): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            order.map((k, i) => ({
                id: `lru-${k}`,
                type: "cell" as const,
                label: k,
                value: k,
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

    yield snap("", `Empty LRU cache – capacity ${capacity}, front is newest.`, 0, "");
    step += 1;
    for (const k of accesses) {
        const at = order.indexOf(k);
        if (at >= 0) {
            order.splice(at, 1);
            order.unshift(k);
            hits += 1;
            yield snap(k, `Hit on ${k} – promoted to front.`, 1, "");
        } else {
            order.unshift(k);
            let evicted = "";
            if (order.length > capacity) {
                evicted = order.pop() ?? "";
            }
            yield snap(
                k,
                evicted !== ""
                    ? `Miss on ${k} – evicted least-recent ${evicted}.`
                    : `Miss on ${k} – cached.`,
                2,
                evicted,
            );
        }
        step += 1;
    }
    yield snap("", `${hits} hit(s) – final order [${order.join(",")}].`, 3, "");
}

const module: AlgorithmModule = {

    education: {
        "intuition": "An LRU cache evicts the entry that has gone unused the longest. It pairs a hash map for O(1) lookup with a doubly linked list that orders entries by recency. A hit moves the entry to the front, and an overflow drops the tail.",
        "invariants": [
            "The list runs from most recently used at the front to least at the tail.",
            "Every cached key has exactly one list node.",
            "Cache size never exceeds capacity."
        ],
        "correctness": "Promoting a hit to the front makes the list an accurate recency order. When insertion exceeds capacity, the tail is by definition the least recently used entry, so evicting it is correct. Hash lookup finds entries without scanning the list.",
        "complexityRationale": "Hash access and list splicing at known nodes are O(1), so all operations are O(1). Storage is O(capacity) keys and nodes.",
        "uses": [
            "CPU and database page caches",
            "Web and object caches",
            "Memoization with bounded memory"
        ],
        "references": [
            "Alan Jay Smith, survey of cache memory design and evaluation, 1982",
            "Nimrod Megiddo and Dharmendra Modha, \"ARC\" paper, FAST 2003"
        ],
        "workedExample": "With capacity 2 and accesses a, b, a, c: a and b fill the cache with b at tail; the second a moves a to front, leaving b at tail. Inserting c evicts b, so the cache holds a and c with a most recent."
    },
    id: "lru-cache",
    name: "LRU Cache",
    category: "data-structures",
    complexity: { time: "O(1)", space: "O(capacity)" },
    defaultInput: { capacity: 2, accesses: ["a", "b", "a", "c"] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty LRU cache with fixed capacity",
        "request key and check order list for hit",
        "on hit promote key to front as newest",
        "compare size against capacity on miss",
        "evict tail entry as least recently used",
        "insert missed key at front of order",
        "done: cache holds keys in recency order with hit count",
    ],
};

export default module;
