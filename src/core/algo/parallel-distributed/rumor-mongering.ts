/**
 * rumor-mongering.ts - Rumor Mongering (Epidemic Gossip Dissemination)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rumor mongering spreads updates like an epidemic. Each process holds a set
 * of rumors; in every round it picks a few peers with a deterministic
 * pseudorandom generator and merges knowledge in both directions. Knowing a
 * rumor only accumulates, so the number of missing rumors never increases, and
 * after enough rounds every process knows everything with high probability.
 *
 * This is a deterministic simulation of the push-pull anti-entropy process with
 * a fixed seed; it does not model message loss, network latency, or real
 * probabilistic timing.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * n * fanout * rumors) for the merge simulation
 *   Space: O(n * rumors) for the per-process knowledge sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each process is a node whose state reflects how much it still lacks.
 *   - Gossip pairs are edges; a fully informed node is green.
 *   - The final frame reports the number of missing rumors across the group.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Input {
    processes?: number;
    rumors?: number;
    rounds?: number;
    fanout?: number;
    seed?: number;
}

/** Small linear congruential generator for repeatable peer selection. */
function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function makeNodes(knowledge: Set<number>[], active: Set<number>): VisualEntity[] {
    const rumors = knowledge.reduce((max, set) => Math.max(max, set.size), 0);
    return knowledge.map((set, i) => {
        const state: EntityState = active.has(i) ? "comparing" : set.size === rumors ? "sorted" : set.size === 0 ? "unvisited" : "idle";
        return {
            id: `p-${i}`,
            type: "node" as const,
            label: `${set.size}/${rumors}`,
            value: set.size,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "process", index: i, known: set.size },
        };
    });
}

function makeEdges(pairs: Array<[number, number]>, round: number): VisualEdge[] {
    return pairs.map(([a, b], i) => ({
        id: `gossip-${round}-${i}`,
        sourceId: `p-${a}`,
        targetId: `p-${b}`,
        label: "gossip",
        state: "active" as const,
        directed: false,
    }));
}

function choosePairs(n: number, fanout: number, random: () => number): Array<[number, number]> {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < n; i += 1) {
        for (let f = 0; f < fanout; f += 1) {
            const peer = Math.floor(random() * n);
            if (peer !== i) pairs.push([i, peer]);
        }
    }
    return pairs;
}

/** Rumor mongering generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const n = typeof task.processes === "number" && Number.isFinite(task.processes)
        ? Math.max(2, Math.min(8, Math.floor(task.processes)))
        : 6;
    const rumors = typeof task.rumors === "number" && Number.isFinite(task.rumors)
        ? Math.max(1, Math.min(8, Math.floor(task.rumors)))
        : 4;
    const rounds = typeof task.rounds === "number" && Number.isFinite(task.rounds)
        ? Math.max(1, Math.min(20, Math.floor(task.rounds)))
        : 8;
    const fanout = typeof task.fanout === "number" && Number.isFinite(task.fanout)
        ? Math.max(1, Math.min(4, Math.floor(task.fanout)))
        : 2;
    const random = makeRandom(typeof task.seed === "number" ? task.seed : 12345);

    // Seed each rumor at a distinct process, cycling when there are more rumors than processes.
    const knowledge = Array.from({ length: n }, () => new Set<number>());
    for (let r = 0; r < rumors; r += 1) knowledge[r % n]!.add(r);
    const missing = () => knowledge.reduce((sum, set) => sum + (rumors - set.size), 0);

    const meta = (round: number, pairCount: number, done: boolean) => ({
        processes: n,
        rumors,
        rounds,
        fanout,
        round,
        pairCount,
        knownCounts: knowledge.map((set) => set.size),
        missing: missing(),
        converged: missing() === 0,
        done,
        step: 0,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeNodes(knowledge, new Set()),
        edges: [],
        description: `${rumors} rumor(s) seeded at ${Math.min(n, rumors)} process(es) among ${n}; ${missing()} facts still missing.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { ...meta(0, 0, false), step },
    };
    step += 1;

    for (let round = 1; round <= rounds; round += 1) {
        const pairs = choosePairs(n, fanout, random);
        for (const [a, b] of pairs) {
            const left = knowledge[a]!;
            const right = knowledge[b]!;
            const merged = new Set([...left, ...right]);
            for (const rumor of merged) {
                left.add(rumor);
                right.add(rumor);
            }
        }
        const active = new Set<number>();
        for (const [a, b] of pairs) {
            active.add(a);
            active.add(b);
        }
        yield {
            stepNumber: step,
            entities: makeNodes(knowledge, active),
            edges: makeEdges(pairs, round),
            description: `Round ${round}: ${pairs.length} push-pull exchanges; ${missing()} fact(s) still missing.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { ...meta(round, pairs.length, false), step },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(knowledge, new Set()),
        edges: [],
        description: missing() === 0
            ? `Converged after ${rounds} round(s): every process knows all ${rumors} rumor(s).`
            : `After ${rounds} round(s) the group is still missing ${missing()} fact occurrence(s).`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { ...meta(rounds, 0, true), step },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of asking a central server, let every process tell a few randomly chosen peers everything it knows. Both sides of a chat merge their knowledge, so a rumor that starts at one node can double its reach each round. Because nobody ever forgets, the missing count only falls, and after a handful of rounds almost everyone knows everything.",
        invariants: [
            "A process's knowledge set only grows; no rumor is ever forgotten.",
            "The total number of missing rumor occurrences never increases between rounds.",
            "Whenever two processes exchange, both leave the exchange with the union of their knowledge.",
        ],
        correctness:
            "Model each rumor's spread as an epidemic on the complete interaction graph. Unioning knowledge at a pair never removes a rumor, so knowledge is monotone and the missing count is nonincreasing. Because peers are chosen uniformly, any uninformed process has positive probability of contacting an informed one each round; over sufficiently many rounds the probability that some process remains uninformed decays exponentially. With the fixed seed used here the simulation is deterministic, and convergence is verified by a direct count of missing facts rather than assumed.",
        complexityRationale:
            "Each round performs n times fanout pair merges, each merging sets of up to rumors entries, giving O(rounds * n * fanout * rumors) time. Storing one knowledge set per process uses O(n * rumors) space.",
        uses: [
            "Membership and failure-detection gossip in distributed databases",
            "Disseminating configuration updates to large fleets",
            "Anti-entropy repair of replicated sets and digests",
        ],
        references: [
            "Demers et al., Epidemic Algorithms for Replicated Database Maintenance, 1987",
            "Birman, Reliable Distributed Systems, chapter on gossip protocols",
        ],
        workedExample:
            "With four processes and two rumors seeded at processes zero and one, one push-pull round can pair zero with two and one with three. After the round, processes zero and two know rumor zero, and processes one and three know rumor one. A second round pairing across those groups gives all four processes both rumors.",
    },
    id: "rumor-mongering",
    name: "Rumor Mongering Gossip",
    category: "parallel-distributed",
    complexity: { time: "O(rounds * n * fanout * rumors)", space: "O(n * rumors)" },
    defaultInput: { processes: 6, rumors: 4, rounds: 8, fanout: 2, seed: 12345 },
    visualType: "graph",
    run,
    pseudocode: [
        "seed each rumor at a process and initialize empty knowledge elsewhere",
        "for each round select a few random peers per process",
        "for each selected pair compute the union of their knowledge",
        "give both processes the union so information flows both ways",
        "count the rumor occurrences still missing across the group",
        "repeat until the missing count is zero or rounds run out",
        "done: report whether every process knows every rumor",
    ],
};

export default module;
