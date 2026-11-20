/**
 * arc-cache.ts – ARC Cache
 *
 * Adaptive Replacement Cache: ghost lists remember evicted recency (B1)
 * and frequency (B2) entries, and a hit in a ghost list shifts the target
 * size toward that side – recency vs frequency, self-tuning.
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
    const accesses = task.accesses ?? ["a", "b", "a", "c", "b"];
    let step = 0;
    let hits = 0;

    const t1: string[] = [];
    const t2: string[] = [];
    const b1: string[] = [];
    const b2: string[] = [];
    let p = 0;
    const snap = (hot: string, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        const rows: Array<[string, string[]]> = [
            ["T1", t1],
            ["T2", t2],
            ["B1", b1],
            ["B2", b2],
        ];
        rows.forEach(([name, list], ri) => {
            list.forEach((k, ki) => {
                entities.push({
                    id: `arc-${name}-${k}`,
                    type: "cell" as const,
                    label: `${name}:${k}`,
                    value: k,
                    state: (k === hot ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: ri, col: ki },
                });
            });
        });
        return {
            stepNumber: step,
            entities: nonEmpty(entities),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { capacity, target: p, hits },
        };
    };

    const evict = (): void => {
        if (t1.length > 0 && (t1.length > p || (t2.length === 0 && t1.length === p))) {
            const v = t1.pop();
            if (v !== undefined) {
                b1.unshift(v);
            }
        } else {
            const v = t2.pop();
            if (v !== undefined) {
                b2.unshift(v);
            }
        }
    };

    yield snap("", `Empty ARC cache – capacity ${capacity}, target p=${p}.`, 0);
    step += 1;
    for (const k of accesses) {
        if (t1.includes(k) || t2.includes(k)) {
            if (t1.includes(k)) {
                t1.splice(t1.indexOf(k), 1);
            } else {
                t2.splice(t2.indexOf(k), 1);
            }
            t2.unshift(k);
            hits += 1;
            yield snap(k, `Hit on ${k} – moved to T2 (frequency side).`, 1);
        } else if (b1.includes(k)) {
            p = Math.min(capacity, p + 1);
            b1.splice(b1.indexOf(k), 1);
            if (t1.length + t2.length >= capacity) {
                evict();
            }
            t2.unshift(k);
            yield snap(k, `Ghost hit in B1 – target grows to p=${p}, ${k} enters T2.`, 2);
        } else if (b2.includes(k)) {
            p = Math.max(0, p - 1);
            b2.splice(b2.indexOf(k), 1);
            if (t1.length + t2.length >= capacity) {
                evict();
            }
            t2.unshift(k);
            yield snap(k, `Ghost hit in B2 – target shrinks to p=${p}, ${k} enters T2.`, 2);
        } else {
            if (t1.length + t2.length >= capacity) {
                evict();
            }
            t1.unshift(k);
            yield snap(k, `Miss on ${k} – enters T1 (recency side).`, 3);
        }
        step += 1;
    }
    yield snap("", `${hits} hit(s), target p=${p} – cached [${[...t1, ...t2].join(",")}].`, 4);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "ARC, the Adaptive Replacement Cache, keeps two lists: one for recently used entries and one for frequently used entries. Two ghost lists remember keys evicted from each side. When a ghost entry is hit, ARC shifts its target size toward that side, so the cache tunes itself to the workload's mix of recency and frequency.",
        "invariants": [
            "T1 holds recently seen entries and T2 holds entries seen at least twice.",
            "B1 and B2 hold only keys, not values, recording recent evictions.",
            "The sum of T1 and T2 sizes never exceeds capacity."
        ],
        "correctness": "A hit in T1 or T2 promotes the entry to T2, so repeated use is rewarded. A hit in a ghost list adjusts the target toward that list, changing the next eviction to favor the access pattern that produced the hit. Since every miss evicts one entry and inserts one entry, the protected size stays within capacity.",
        "complexityRationale": "Each access does a constant number of hash lookups and list moves, so time is O(1) amortized. All four lists hold at most capacity entries plus ghosts, giving O(capacity) space.",
        "uses": [
            "Storage and database buffer caches",
            "Web and CDN object caches with mixed workloads",
            "Replacement policies where plain LRU is too fragile"
        ],
        "references": [
            "Nimrod Megiddo and Dharmendra S. Modha, \"ARC: A Self-Tuning, Low Overhead Replacement Cache\", FAST 2003",
            "Alan Jay Smith, survey of cache memory design and evaluation, 1982"
        ],
        "workedExample": "With capacity 2 and accesses a, b, a, c, b: a and b fill T1, then the second a moves it to T2. Inserting c evicts b from T1 into ghost B1. The later b hits B1 and grows the recency target p, showing this workload favors recently used entries."
    },
    id: "arc-cache",
    name: "ARC Cache",
    category: "data-structures",
    complexity: { time: "O(1) amortized", space: "O(capacity)" },
    defaultInput: { capacity: 2, accesses: ["a", "b", "a", "c", "b"] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty ARC with T1 T2 recency and frequency plus B1 B2 ghosts",
        "request key and check T1 or T2 for a cache hit",
        "on hit move entry to T2 frequency side and count hit",
        "on ghost hit in B1 grow target p toward recency",
        "on ghost hit in B2 shrink target p toward frequency",
        "on miss evict from T1 or T2 then insert into T1",
        "done: cached entries with hit count and tuned target p",
    ],
};

export default module;
