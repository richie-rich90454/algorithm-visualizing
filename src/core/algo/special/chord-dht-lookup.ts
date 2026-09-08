/**
 * chord-dht-lookup.ts – Chord DHT Lookup.
 * Four-bit ring, nodes {1,4,9,12}, key 10 lives on successor 12. From
 * node 1 the finger table jumps to the closest preceding node 9, which
 * knows 12 — two hops, O(log n), no central index.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { key?: number; from?: number } | null) ?? {};
    const M = 4;
    const RING = 2 ** M;
    const nodes = [1, 4, 9, 12];
    const key = Number.isFinite(cfg.key) ? (((cfg.key as number) % RING) + RING) % RING : 10;
    const from = nodes.includes(cfg.from as number) ? (cfg.from as number) : 1;
    const succ = (id: number): number => nodes.find((n) => n >= id) ?? nodes[0] ?? 0;
    const fingers = [1, 2, 4, 8].map((off) => succ((from + off) % RING));
    const target = succ(key);
    const path = [from];
    let cur = from;
    const dist = (a: number, b: number): number => (b - a + RING) % RING;
    while (cur !== target && path.length <= nodes.length + 1) {
        // Closest preceding finger: farthest hop that stays short of the key.
        let nxt = target;
        let best = -1;
        for (const fp of fingers) {
            const d = dist(cur, fp);
            if (d > 0 && d < dist(cur, key) && d > best) {
                best = d;
                nxt = fp;
            }
        }
        if (nxt === cur) break;
        cur = nxt;
        path.push(cur);
    }
    if (path[path.length - 1] !== target) path.push(target);
    let step = 0;
    const frame = (at: number, desc: string): VisualFrame => {
        const entities: VisualEntity[] = nodes.map((n, i) => ({
            id: `node-${n}`,
            type: "cell" as const,
            label: n === key ? `${n}●` : String(n),
            value: n,
            state: (n === target
                ? "sorted"
                : n === at
                  ? "comparing"
                  : path.includes(n)
                    ? "visited"
                    : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        entities.push({
            id: "key",
            type: "cell" as const,
            label: `k=${key}`,
            value: key,
            state: "highlight" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: 0 },
        });
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: step,
            layout: "grid",
            meta: { key, target, hops: path.length - 1 },
        };
    };
    yield frame(
        from,
        `Ring m=4, nodes {${nodes}}; key ${key} belongs to successor ${target}. Query from ${from}.`,
    );
    step += 1;
    yield frame(
        from,
        `Finger table of ${from}: starts ${[1, 2, 4, 8].map((o) => `(${from}+${o})`).join(" ")} → {${fingers.join(",")}} — jump to closest predecessor of ${key}.`,
    );
    step += 1;
    for (let i = 1; i < path.length; i += 1) {
        yield frame(
            path[i] ?? target,
            `Hop ${i}: ${path[i - 1]} → ${path[i]}${path[i] === target ? ` — owns key ${key}. FOUND` : " — closer, forward again"}.`,
        );
        step += 1;
    }
    yield frame(
        target,
        `Done: key ${key} found at node ${target} in ${path.length - 1} hops (path ${path.join("→")}).`,
    );
}

const module: AlgorithmModule = {
    id: "chord-dht-lookup",
    name: "Chord DHT Lookup",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(log n)" },
    defaultInput: { key: 10, from: 1 },
    visualType: "grid",
    run,
};

export default module;
