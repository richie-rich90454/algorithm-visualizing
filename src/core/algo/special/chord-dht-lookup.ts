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
            codeLineNumber: Math.min(step, 6),
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

    education: {
        "intuition": "Chord is a distributed hash table that arranges nodes on a circular identifier ring. Each node keeps a finger table of successors at exponentially growing offsets, so a query can roughly halve its remaining distance each hop. A key is owned by its successor, the first node encountered clockwise from the key's identifier.",
        "invariants": [
            "Each key is stored at its successor, the first node clockwise from the key.",
            "Finger i of a node points to the successor of (n + 2^i) mod 2^m.",
            "A lookup moves monotonically closer to the target without overshooting it."
        ],
        "correctness": "Each hop selects the finger closest to, but preceding, the key, which reduces the clockwise distance to the target by at least half. With m fingers for an m-bit identifier space, any lookup reaches the successor in O(log N) hops. The demo finds key 10 at node 12 in two hops, and once at the successor the owning node is determined uniquely.",
        "complexityRationale": "An m-bit ring gives each node m = O(log N) fingers, so storage is O(log N) per node. Because every hop at least halves the remaining distance, a lookup needs O(log N) hops.",
        "uses": [
            "Peer-to-peer file-sharing overlays",
            "Distributed key-value stores and sharded tables",
            "Service discovery in large clusters",
            "Content-addressable networks such as IPFS-style routing"
        ],
        "references": [
            "Stoica, Morris, Karger, Kaashoek and Balakrishnan, Chord: A Scalable Peer-to-Peer Lookup Service for Internet Applications, SIGCOMM 2001",
            "Balakrishnan, Kaashoek and Karger, Looking Up Anywhere in a Peer-to-Peer Network, HotNets 2002"
        ],
        "workedExample": "On a 4-bit ring (0..15) with nodes {1,4,9,12}, key 10 belongs to successor 12. From node 1 the finger starts at offsets 1,2,4,8 pointing to successors {4,4,9,12}. The closest preceding finger of 10 is 9, so hop 1->9; node 9 knows 12, so hop 9->12. The key is found in two hops."
    },
    id: "chord-dht-lookup",
    name: "Chord DHT Lookup",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(log n)" },
    defaultInput: { key: 10, from: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize 4-bit ring with nodes {1,4,9,12} and key target",
        "build finger table from the query start node",
        "jump to the closest preceding finger of the key",
        "forward hop by hop toward the successor",
        "arrive at the node that owns the key",
        "count total hops along the lookup path",
        "done: key found at its successor in O(log n) hops",
    ],
};

export default module;
