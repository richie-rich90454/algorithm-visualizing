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
    id: "lfu-cache",
    name: "LFU Cache",
    category: "data-structures",
    complexity: { time: "O(1)", space: "O(capacity)" },
    defaultInput: { capacity: 2, accesses: ["a", "b", "a", "c", "c"] },
    visualType: "grid",
    run,
};

export default module;
