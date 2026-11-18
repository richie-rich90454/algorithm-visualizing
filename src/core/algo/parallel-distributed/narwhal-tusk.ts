/**
 * narwhal-tusk.ts - Narwhal Mempool with Tusk DAG Ordering (Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Narwhal separates data dissemination from consensus. Workers turn batches of
 * transactions into headers, link each new header to a quorum of certificates
 * from the previous round, and collect votes until a header becomes a
 * certificate. Tusk then orders the resulting directed acyclic graph: for every
 * even round a shared coin picks a leader, and a deterministic walk visits that
 * leader's certified ancestors parents-first, appending each certificate once
 * to a single global log.
 *
 * This is a deterministic teaching simulation, not a production BFT system.
 * It models liveness and deterministic ordering over a fixed membership; it
 * does not model networking, cryptography, view changes, or adaptive adversaries.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(rounds * n^2) for the DAG walk over at most n certificates per round
 *   Space: O(rounds * n) for headers, votes, and parent links
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each header is a node; parent links are directed edges.
 *   - A certified header is green, the round leader is yellow, an uncertified
 *     header is red.
 *   - meta carries quorum, per-round certificate counts, leaders, and the order.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

export interface NarwhalResult {
    nodes: number;
    f: number;
    quorum: number;
    rounds: number;
    certified: boolean[][];
    votes: number[][];
    parents: number[][][];
    leaders: Array<{ round: number; node: number }>;
    order: Array<{ round: number; node: number }>;
}

/** Deterministic Narwhal certificate graph plus the Tusk total order. */
export function simulateNarwhalTusk(
    nodeCount: number,
    rounds: number,
    seed: number,
    offline: number[] = [],
): NarwhalResult {
    const n = Math.max(4, Math.floor(nodeCount));
    const r = Math.max(1, Math.floor(rounds));
    const f = Math.floor((n - 1) / 3);
    const quorum = 2 * f + 1;
    const offlineSet = new Set(offline.filter((i) => i >= 0 && i < n));
    const liveCount = n - offlineSet.size;

    const certified: boolean[][] = [];
    const votes: number[][] = [];
    const parents: number[][][] = [];

    for (let round = 0; round < r; round += 1) {
        const certRow: boolean[] = [];
        const voteRow: number[] = [];
        const parentRow: number[][] = [];
        for (let node = 0; node < n; node += 1) {
            const live = !offlineSet.has(node);
            const voteCount = live ? liveCount : 0;
            voteRow.push(voteCount);
            certRow.push(live && voteCount >= quorum);
            if (round === 0) {
                parentRow.push([]);
            } else {
                const available: number[] = [];
                for (let p = 0; p < n; p += 1) {
                    if (certified[round - 1]?.[p]) {
                        available.push(p);
                    }
                }
                const start = available.length > 0 ? (seed + round * 7) % available.length : 0;
                const chosen: number[] = [];
                for (let k = 0; k < quorum && available.length > 0; k += 1) {
                    chosen.push(available[(start + k) % available.length] as number);
                }
                parentRow.push([...new Set(chosen)].sort((a, b) => a - b));
            }
        }
        certified.push(certRow);
        votes.push(voteRow);
        parents.push(parentRow);
    }

    const leaders: Array<{ round: number; node: number }> = [];
    const order: Array<{ round: number; node: number }> = [];
    const seen = new Set<string>();

    const visit = (round: number, node: number): void => {
        const key = `${round}:${node}`;
        if (seen.has(key) || round < 0 || !certified[round]?.[node]) {
            return;
        }
        seen.add(key);
        const parentRow = parents[round]?.[node] ?? [];
        for (const parent of parentRow) {
            visit(round - 1, parent);
        }
        order.push({ round, node });
    };

    for (let round = 0; round < r; round += 2) {
        const candidates: number[] = [];
        for (let node = 0; node < n; node += 1) {
            if (certified[round]?.[node]) {
                candidates.push(node);
            }
        }
        if (candidates.length === 0) {
            continue;
        }
        const leader = candidates[(seed * 13 + round * 5) % candidates.length] as number;
        leaders.push({ round, node: leader });
        visit(round, leader);
    }

    return { nodes: n, f, quorum, rounds: r, certified, votes, parents, leaders, order };
}

/** Build one node entity per header with a state reflecting progress. */
function makeNodes(
    data: NarwhalResult,
    certifiedThrough: number,
    leaderKeys: Set<string>,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let round = 0; round < data.rounds; round += 1) {
        for (let node = 0; node < data.nodes; node += 1) {
            const key = `${round}:${node}`;
            let state: EntityState = "unvisited";
            if (round <= certifiedThrough) {
                state = data.certified[round]?.[node] ? "sorted" : "error";
            }
            if (leaderKeys.has(key)) {
                state = "pivot";
            }
            entities.push({
                id: `header-${round}-${node}`,
                type: "node",
                label: `r${round}n${node}`,
                value: `${round}:${node}`,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: {
                    round,
                    node,
                    depth: round,
                    votes: data.votes[round]?.[node] ?? 0,
                    certified: data.certified[round]?.[node] ?? false,
                    parentId: round > 0 ? `header-${round - 1}-${(data.parents[round]?.[node] ?? [])[0] ?? 0}` : "",
                },
            });
        }
    }
    return entities;
}

/** Parent edges for all headers, highlighted when a leader walk reaches them. */
function makeEdges(data: NarwhalResult, activeKeys: Set<string>): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let round = 1; round < data.rounds; round += 1) {
        for (let node = 0; node < data.nodes; node += 1) {
            for (const parent of data.parents[round]?.[node] ?? []) {
                const key = `${round}:${node}`;
                edges.push({
                    id: `parent-${round}-${node}-${parent}`,
                    sourceId: `header-${round}-${node}`,
                    targetId: `header-${round - 1}-${parent}`,
                    label: "parent",
                    state: activeKeys.has(key) ? "active" : "idle",
                    directed: true,
                });
            }
        }
    }
    return edges;
}

/** The Narwhal/Tusk generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { nodes?: number; rounds?: number; seed?: number; offline?: number[] } | null) ?? {};
    const nodes = typeof task.nodes === "number" ? Math.max(4, Math.floor(task.nodes)) : 4;
    const rounds = typeof task.rounds === "number" ? Math.max(1, Math.floor(task.rounds)) : 4;
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 3;
    const offline = Array.isArray(task.offline) ? [...task.offline] : [];
    const data = simulateNarwhalTusk(nodes, rounds, seed, offline);
    const orderStrings = data.order.map((item) => `r${item.round}n${item.node}`);
    const leaderStrings = data.leaders.map((item) => `r${item.round}n${item.node}`);

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeNodes(data, -1, new Set()),
        edges: makeEdges(data, new Set()),
        description: `Narwhal with ${nodes} nodes, f = ${data.f}, quorum ${data.quorum}; workers prepare ${rounds} rounds of headers.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { nodes, quorum: data.quorum, phase: "setup", certificates: 0, leaders: [], order: [] },
    };

    for (let round = 0; round < rounds; round += 1) {
        let count = 0;
        for (let node = 0; node < nodes; node += 1) {
            if (data.certified[round]?.[node]) {
                count += 1;
            }
        }
        yield {
            stepNumber: step++,
            entities: makeNodes(data, round, new Set()),
            edges: makeEdges(data, new Set()),
            description: `Round ${round}: ${count} of ${nodes} headers became certificates with ${data.quorum} votes required.`,
            codeLineNumber: 3,
            layout: "graph",
            meta: {
                nodes,
                quorum: data.quorum,
                phase: "certify",
                round,
                certificates: count,
                leaders: leaderStrings,
                order: [],
            },
        };
    }

    for (const leader of data.leaders) {
        const activeKeys = new Set<string>([`${leader.round}:${leader.node}`]);
        yield {
            stepNumber: step++,
            entities: makeNodes(data, rounds - 1, new Set([`${leader.round}:${leader.node}`])),
            edges: makeEdges(data, activeKeys),
            description: `Even round ${leader.round}: the shared coin selects node ${leader.node} as leader; walk its certified ancestors.`,
            codeLineNumber: 4,
            layout: "graph",
            meta: {
                nodes,
                quorum: data.quorum,
                phase: "leader",
                round: leader.round,
                leader: leader.node,
                certificates: data.order.length,
                leaders: leaderStrings,
                order: orderStrings.slice(0, data.order.length),
            },
        };
    }

    yield {
        stepNumber: step,
        entities: makeNodes(data, rounds - 1, new Set()),
        edges: makeEdges(data, new Set()),
        description: `Tusk committed ${data.order.length} certificate(s): ${orderStrings.join(" -> ") || "none"}.`,
        codeLineNumber: 8,
        layout: "graph",
        meta: {
            nodes,
            quorum: data.quorum,
            phase: "done",
            certificates: data.order.length,
            leaders: leaderStrings,
            order: orderStrings,
            note: "teaching model: deterministic ordering, not a full BFT implementation",
        },
    };
}

/** The Narwhal/Tusk module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Narwhal makes consensus cheap by letting workers flood data and only agree on small headers. Each new header points back to a quorum of earlier certificates, so the headers form a DAG. Tusk reads that DAG in the same deterministic order at every replica by picking a leader in each even round and walking its ancestors before it.",
        invariants: [
            "A header becomes a certificate only after a quorum of 2f+1 votes.",
            "Every parent pointer refers to a certificate from the immediately previous round.",
            "The total order appends each certificate at most once and lists parents before children.",
        ],
        correctness:
            "With n = 3f+1 nodes and at most f faulty, any quorum of 2f+1 contains at least f+1 honest nodes, so two quorums intersect in an honest node and no two conflicting certificates can be certified for the same slot. Because each certificate links a quorum of parents from the prior round, the leader's ancestry reaches back through committed rounds. The ancestor walk is deterministic given the DAG and the shared coin, so every honest replica emits the identical sequence.",
        complexityRationale:
            "There are at most n certificates per round, each with up to n parent links. Walking all leader ancestries visits each certificate and each of its parents once, giving O(rounds * n^2) time and O(rounds * n) space for the stored graph.",
        uses: [
            "Separating data dissemination from consensus in high-throughput blockchains",
            "Ordering transaction batches in DAG-based mempools",
            "Teaching deterministic total order from a certified DAG",
        ],
        references: [
            "Danezis, Kusupati, and Syta, Narwhal: Broadcaster and Mempool, 2019",
            "Berdichevsky et al., Tusk: DAG-based BFT Consensus, 2019",
        ],
        workedExample:
            "With four nodes, f = 1 and quorum 3. Four headers in round zero each collect four votes and become certificates. In round two the coin selects node 1 as leader; the walk visits its three certified parents before appending node 1, producing the first entries of the global log.",
    },
    id: "narwhal-tusk",
    name: "Narwhal and Tusk",
    category: "parallel-distributed",
    complexity: { time: "O(rounds * n^2)", space: "O(rounds * n)" },
    defaultInput: { nodes: 4, rounds: 4, seed: 3, offline: [] },
    visualType: "graph",
    run,
    pseudocode: [
        "configure n nodes with f floor of n minus one over three and quorum 2f+1",
        "each worker broadcasts a header with a batch digest each round",
        "attach a quorum of certified parents from the previous round",
        "collect votes and certify a header when quorum votes arrive",
        "for each even round pick a leader with a shared coin",
        "walk the certified DAG from the leader, parents first",
        "append each new certificate once to the global order",
        "replicate the ordered log to every node",
        "done: report the committed sequence of batch digests",
    ],
};

export default module;
