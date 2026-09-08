/**
 * gossip-protocol.ts – Gossip Protocol (push dissemination).
 * Five nodes, rumor starts at node 0: each round every informed node
 * pushes to one random peer. Coverage grows exponentially, then tails
 * off on the last holdouts. Fixed-seed LCG keeps it deterministic.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { nodes?: number; rounds?: number; seed?: number } | null) ?? {};
    const n = Math.max(2, Math.min(8, cfg.nodes ?? 5));
    const rounds = Math.max(1, Math.min(8, cfg.rounds ?? 6));
    const rnd = lcg(cfg.seed ?? 31);
    const known = new Set<number>([0]);
    let step = 0;
    const frame = (desc: string): VisualFrame => {
        const entities: VisualEntity[] = Array.from({ length: n }, (_, i) => ({
            id: `node-${i}`,
            type: "cell" as const,
            label: known.has(i) ? `N${i}✓` : `N${i}`,
            value: known.has(i) ? 1 : 0,
            state: (known.has(i) ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: step,
            layout: "grid",
            meta: { informed: known.size, total: n },
        };
    };
    yield frame(`Node 0 learns the rumor; ${n - 1} peers are clueless.`);
    step += 1;
    for (let r = 1; r <= rounds; r += 1) {
        const newly: number[] = [];
        for (const src of [...known]) {
            const peer = Math.floor(rnd() * n);
            if (!known.has(peer)) {
                newly.push(peer);
                known.add(peer);
            }
        }
        yield frame(
            `Round ${r}: pushes informed {${newly.length > 0 ? newly.join(",") : "no one new"}} (${known.size}/${n} know).`,
        );
        step += 1;
        if (known.size === n) break;
    }
    yield frame(
        `Done: ${known.size}/${n} nodes informed in ≤ ${rounds} rounds (logarithmic spread).`,
    );
}

const module: AlgorithmModule = {
    id: "gossip-protocol",
    name: "Gossip Protocol",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { nodes: 5, rounds: 6, seed: 31 },
    visualType: "grid",
    run,
};

export default module;
