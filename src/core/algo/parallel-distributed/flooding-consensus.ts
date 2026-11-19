/**
 * flooding-consensus.ts - Flooding Agreement in a Message-Passing Network
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Flooding is the simplest agreement protocol: a node that knows a proposed
 * value forwards it to every neighbor in each round, and a node that receives
 * the value starts forwarding it in the next round. After a number of rounds
 * equal to the eccentricity of the source, every node in its connected
 * component holds the value. The protocol terminates because knowledge only
 * grows and each node forwards once per new receiver. Flooding alone does not
 * resolve conflicting proposals, so this simulation assumes a single source.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(diameter) rounds with O(E) message sends overall
 *   Space: O(n + E) for the known set and the network adjacency
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are green once they know the value and gray while unaware.
 *   - Edges carrying a message in the current round are yellow.
 *   - The final frame reports how many rounds were needed and whether all
 *     reachable nodes were reached.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Input {
    n?: number;
    edges?: Array<[number, number]>;
    source?: number;
    value?: string | number;
    maxRounds?: number;
}

const DEFAULT_EDGES: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
];

function makeNodes(n: number, known: Set<number>, source: number): VisualEntity[] {
    return Array.from({ length: n }, (_, i) => ({
        id: `node-${i}`,
        type: "node" as const,
        label: String(i),
        value: i,
        state: (i === source ? "active" : known.has(i) ? "visited" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, knows: known.has(i) },
    }));
}

function makeEdges(edges: Array<[number, number]>, active: Set<string>, used: Set<string>): VisualEdge[] {
    return edges.map(([a, b]) => {
        const id = `edge-${a}-${b}`;
        return {
            id,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: (active.has(id) ? "active" : used.has(id) ? "visited" : "idle") as EntityState,
            directed: false,
        };
    });
}

/** Reference breadth-first distances used to verify the flooding round count. */
function distances(n: number, edges: Array<[number, number]>, source: number): Map<number, number> {
    const adjacency: number[][] = Array.from({ length: n }, () => []);
    for (const [a, b] of edges) {
        adjacency[a]?.push(b);
        adjacency[b]?.push(a);
    }
    const dist = new Map<number, number>([[source, 0]]);
    const queue = [source];
    while (queue.length > 0) {
        const node = queue.shift();
        if (node === undefined) break;
        for (const next of adjacency[node] ?? []) {
            if (!dist.has(next)) {
                dist.set(next, (dist.get(node) ?? 0) + 1);
                queue.push(next);
            }
        }
    }
    return dist;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const requestedN = typeof task.n === "number" && Number.isFinite(task.n) ? Math.floor(task.n) : 6;
    const n = Math.max(2, Math.min(20, requestedN));
    const rawEdges = Array.isArray(task.edges) ? task.edges : DEFAULT_EDGES;
    const seen = new Set<string>();
    const edges: Array<[number, number]> = [];
    for (const pair of rawEdges) {
        const a = pair?.[0];
        const b = pair?.[1];
        if (!Number.isInteger(a) || !Number.isInteger(b)) continue;
        if ((a as number) < 0 || (a as number) >= n || (b as number) < 0 || (b as number) >= n || a === b) continue;
        const key = (a as number) < (b as number) ? `${a}-${b}` : `${b}-${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push([Math.min(a as number, b as number), Math.max(a as number, b as number)]);
    }
    const rawSource = typeof task.source === "number" && Number.isFinite(task.source) ? Math.floor(task.source) : 0;
    const source = Math.max(0, Math.min(n - 1, rawSource));
    const value = typeof task.value === "string" || typeof task.value === "number" ? task.value : "proposal-A";
    const maxRounds = typeof task.maxRounds === "number" && Number.isFinite(task.maxRounds)
        ? Math.max(1, Math.min(20, Math.floor(task.maxRounds)))
        : 10;

    const adjacency: number[][] = Array.from({ length: n }, () => []);
    for (const [a, b] of edges) {
        adjacency[a]?.push(b);
        adjacency[b]?.push(a);
    }
    const known = new Set<number>([source]);
    const usedEdges = new Set<string>();
    const expected = distances(n, edges, source);
    const meta = (round: number, done: boolean) => ({
        n,
        source,
        value,
        edges: edges.length,
        known: [...known].sort((a, b) => a - b),
        knownCount: known.size,
        reachableCount: expected.size,
        eccentricity: Math.max(0, ...expected.values()),
        rounds: round,
        complete: done,
    });

    yield {
        stepNumber: 0,
        entities: makeNodes(n, known, source),
        edges: makeEdges(edges, new Set(), usedEdges),
        description: `Node ${source} proposes value ${String(value)} to ${n} nodes over ${edges.length} links.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: meta(0, false),
    };

    let step = 1;
    let round = 0;
    while (round < maxRounds) {
        const activeEdges = new Set<string>();
        const additions: number[] = [];
        for (const [a, b] of edges) {
            const aKnows = known.has(a);
            const bKnows = known.has(b);
            const id = `edge-${a}-${b}`;
            if (aKnows && !bKnows) {
                activeEdges.add(id);
                additions.push(b);
            } else if (bKnows && !aKnows) {
                activeEdges.add(id);
                additions.push(a);
            }
        }
        if (additions.length === 0) break;
        round += 1;
        for (const node of additions) known.add(node);
        for (const id of activeEdges) usedEdges.add(id);
        yield {
            stepNumber: step,
            entities: makeNodes(n, known, source),
            edges: makeEdges(edges, activeEdges, usedEdges),
            description: `Round ${round}: ${additions.length} node(s) learned the value; ${activeEdges.size} link(s) carried a message.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: meta(round, false),
        };
        step += 1;
    }

    const complete = known.size === expected.size && [...expected.keys()].every((node) => known.has(node));
    yield {
        stepNumber: step,
        entities: makeNodes(n, known, source),
        edges: makeEdges(edges, new Set(), usedEdges),
        description: complete
            ? `Agreement reached on ${String(value)} after ${round} round(s); all ${known.size} reachable nodes know it.`
            : `Only ${known.size} of ${expected.size} reachable nodes know ${String(value)}; the network may be disconnected.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: meta(round, complete),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A rumor spreads one hop per round: whoever has heard it tells all neighbors, and each new listener becomes a teller in the next round. In a connected network the number of rounds needed is exactly the farthest distance from the source. Knowledge never disappears, so the process stops by itself once the frontier is empty.",
        invariants: [
            "A node that knows the value keeps it forever and forwards it at most once per neighbor.",
            "After round k every node within graph distance k of the source knows the value.",
            "No node outside the source connected component can ever learn the value.",
        ],
        correctness:
            "Induct on the round number. At round zero only the source knows the value, which is distance zero. Assume after round k exactly the nodes within distance k know it. Every node at distance k plus one has a neighbor at distance k, and that neighbor sends the value during round k plus one, so those nodes are added. No node farther away has a knowing neighbor, so nothing else is added. Thus after eccentricity rounds all reachable nodes know the value, and the loop stops when the frontier is empty.",
        complexityRationale:
            "Each round inspects every edge, and there are at most diameter rounds, so the sequential simulation is O(diameter times E); in the protocol each edge carries at most two messages overall. Storing the graph, known set, and used-edge set is O(n + E).",
        uses: [
            "Simple broadcast and agreement in sensor networks",
            "Disseminating configuration values in peer-to-peer systems",
            "A baseline for more robust gossip and epidemic protocols",
        ],
        references: [
            "Lamport, Shostak, and Pease, The Byzantine Generals Problem, 1982",
            "Demers et al., Epidemic Algorithms for Replicated Database Maintenance, 1987",
        ],
        workedExample:
            "In a six-node ring with the proposal starting at node 0, round one informs nodes 1 and 5, round two informs 2 and 4, and round three informs 3. The farthest node is three hops away, so agreement completes in three rounds and every node holds the same value.",
    },
    id: "flooding-consensus",
    name: "Flooding Consensus",
    category: "parallel-distributed",
    complexity: { time: "O(diameter * E)", space: "O(n + E)" },
    defaultInput: { n: 6, edges: DEFAULT_EDGES, source: 0, value: "proposal-A", maxRounds: 10 },
    visualType: "graph",
    run,
    pseudocode: [
        "mark the source as the only node holding the value",
        "for each round collect every link from a knowing node to an unaware one",
        "send the value across those links",
        "add the receiving nodes to the knowing set",
        "stop when no link crosses the frontier",
        "compare the knowing set with all reachable nodes",
        "done: report the number of rounds and agreement status",
    ],
};

export default module;
