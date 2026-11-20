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
            codeLineNumber: Math.min(step, 6),
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

    education: {
        "intuition": "A gossip protocol spreads information like a rumor: each node that knows a piece of news periodically pushes it to a randomly chosen peer. Early on, the number of informed nodes roughly doubles each round because most pushes reach someone new. Near the end, a few extra rounds are needed to reach the last holdouts.",
        "invariants": [
            "A node, once informed, stays informed.",
            "The informed set only grows from round to round.",
            "Each round every informed node makes exactly one push to a random peer."
        ],
        "correctness": "Gossip is probabilistic rather than exact. Because each informed node repeatedly chooses random peers, the probability that a given uninformed node stays untouched after r rounds decays exponentially, so with high probability every node is informed after O(log n) rounds. The demo reports the informed count after each round.",
        "complexityRationale": "Each round every informed node performs one push, so a round costs at most O(n) work, and O(log n) rounds suffice with high probability. Each node stores one bit of rumor state, O(n) space overall.",
        "uses": [
            "Failure detection and membership in distributed systems",
            "Anti-entropy replication in Cassandra and Dynamo-style stores",
            "Disseminating configuration in large clusters",
            "Peer-to-peer overlays and blockchain transaction propagation"
        ],
        "references": [
            "Demers et al., Epidemic Algorithms for Replicated Database Maintenance, PODC 1987",
            "Birman, Guide to Reliable Distributed Systems, Chapter 9"
        ],
        "workedExample": "Five nodes start with the rumor only at node 0. Round 1: node 0 pushes to node 2, so 2 know. Round 2: nodes 0 and 2 push, reaching nodes 1 and 4, so 4 know. Round 3: the informed nodes push and node 3 finally hears it, giving 5/5 informed. Coverage doubles early, then tails off."
    },
    id: "gossip-protocol",
    name: "Gossip Protocol",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { nodes: 5, rounds: 6, seed: 31 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize n nodes with only node 0 informed",
        "for round r <- 1 to rounds",
        "each informed node pushes rumor to a random peer",
        "newly reached peers join the informed set",
        "track informed count out of total n",
        "stop early when all nodes know the rumor",
        "done: coverage reported with logarithmic spread",
    ],
};

export default module;
