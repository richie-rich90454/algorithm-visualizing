/**
 * ring-leader-election.ts - Ring Leader Election
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In the ring algorithm every process knows only its successor in a logical
 * ring. Any process can start an election by sending a token containing its
 * own identifier. As the token travels around the ring, each process replaces
 * the number with the larger of the token and its own identifier. When the
 * token returns, the number in it is the largest identifier in the ring, so
 * that process is the leader. The leader sends the result around the ring once
 * more so everyone learns the same answer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) messages for the election and O(n) for the announcement
 *   Space: O(n) for the ring membership and the token state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Processes are circles joined into a directed ring by edges.
 *   - Failed processes are red; the initiator starts yellow.
 *   - The current token holder is yellow, the winner green.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function makeNodes(
    ids: number[],
    down: Set<number>,
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return ids.map((id) => ({
        id: `node-${id}`,
        type: "node" as const,
        label: String(id),
        value: id,
        state: states.get(id) ?? (down.has(id) ? "error" : "unvisited"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label: String(id), processId: id, failed: down.has(id) },
    }));
}

/** Directed edges joining consecutive alive processes into a ring. */
function makeRingEdges(ring: number[]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    if (ring.length < 2) return edges;
    for (let i = 0; i < ring.length; i += 1) {
        const source = ring[i];
        const target = ring[(i + 1) % ring.length];
        if (source === undefined || target === undefined) continue;
        edges.push({
            id: `edge-${source}-${target}`,
            sourceId: `node-${source}`,
            targetId: `node-${target}`,
            label: "",
            state: "idle",
            directed: true,
        });
    }
    return edges;
}

/** Ring leader election generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { processIds?: number[]; initiator?: number; down?: number[] } | null
    ) ?? {};
    const ids = Array.isArray(task.processIds) ? [...task.processIds] : [0, 1, 2, 3, 4];
    const down = new Set<number>(Array.isArray(task.down) ? task.down : [2]);
    const initiator = typeof task.initiator === "number" ? task.initiator : 1;
    const ring = ids.filter((id) => !down.has(id));
    const edges = makeRingEdges(ring);
    let step = 0;

    const baseMeta = {
        processCount: ids.length,
        ringSize: ring.length,
        initiator,
        token: -1,
        holder: -1,
        leader: -1,
    };

    yield {
        stepNumber: step,
        entities: makeNodes(ids, down, new Map([[initiator, "active"]])),
        edges: edges.map((edge) => ({ ...edge })),
        description: `Starting a ring election at process ${initiator} with ${ring.length} alive process(es).`,
        codeLineNumber: 0,
        layout: "graph",
        meta: baseMeta,
    };
    step += 1;

    if (ring.length === 0 || !ring.includes(initiator)) {
        yield {
            stepNumber: step,
            entities: makeNodes(ids, down),
            edges: edges.map((edge) => ({ ...edge })),
            description:
                ring.length === 0
                    ? "No process is alive, so no leader can be elected."
                    : `Process ${initiator} is down and cannot start an election.`,
            codeLineNumber: 6,
            layout: "graph",
            meta: { ...baseMeta, leader: -1 },
        };
        return;
    }

    const startIndex = ring.indexOf(initiator);
    let token = initiator;
    for (let k = 0; k < ring.length; k += 1) {
        const holder = ring[(startIndex + k) % ring.length];
        if (holder === undefined) continue;
        token = Math.max(token, holder);
        const visited = new Map<number, EntityState>();
        visited.set(holder, "comparing");
        yield {
            stepNumber: step,
            entities: makeNodes(ids, down, visited),
            edges: edges.map((edge) => ({ ...edge })),
            description: `Process ${holder} sees the token ${token} and keeps the larger of its id and the token.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { ...baseMeta, token, holder, visits: k + 1 },
        };
        step += 1;
    }

    const leader = token;
    const leaderStates = new Map<number, EntityState>([[leader, "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeNodes(ids, down, leaderStates),
        edges: edges.map((edge) => ({ ...edge })),
        description:
            leader === initiator
                ? `The token returned with ${leader}, the initiator's own id, so ${leader} is the leader.`
                : `The token returned with ${leader}, so ${leader} is the leader and announces it around the ring.`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { ...baseMeta, token, holder: initiator, leader, announced: true },
    };
}

/** The ring election module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Pass a note around a circle of processes. Every process writes down the larger of its own number and the number already on the note. After one full lap the note holds the biggest number in the circle, and whoever owns that number becomes the leader. The winner then walks the circle again to tell everyone.",
        invariants: [
            "The token always holds the maximum identifier of every process it has visited.",
            "Only alive processes handle the token, so failed processes cannot win.",
            "After one full lap the token equals the largest identifier among alive processes.",
        ],
        correctness:
            "The token starts at the initiator's identifier. By induction, after k visits it equals the maximum of the initiator and the first k visited identifiers. One full lap visits every alive process exactly once, so the token equals the maximum alive identifier. That process is alive and receives the token, and the announcement round gives every process the same leader value, independent of who started.",
        complexityRationale:
            "The token makes one full circuit for the election and one for the announcement, so exactly 2n messages are sent for n alive processes. Each process stores only its successor and the token, giving O(1) local space and O(n) space for the whole ring depiction.",
        uses: [
            "Leader selection in token-ring local area networks",
            "Leader choice in simple peer-to-peer overlays",
            "A teaching contrast with the bully election algorithm",
        ],
        references: [
            "Tanenbaum, Computer Networks, Section 4.5 (election algorithms)",
            "Chang and Roberts, An Improved Algorithm for Decentralized Extrema-Finding, 1979",
        ],
        workedExample:
            "With processes 0 through 4, process 2 down, and initiator 1, the token travels 1, 3, 4, 0 and comes back holding 4. Process 4 is announced as leader. Starting instead at process 0 gives the same winner, 4.",
    },
    id: "ring-leader-election",
    name: "Ring Leader Election",
    category: "parallel-distributed",
    complexity: { time: "O(n) messages", space: "O(n)" },
    defaultInput: { processIds: [0, 1, 2, 3, 4], initiator: 1, down: [2] },
    visualType: "graph",
    run,
    pseudocode: [
        "list the alive processes in ring order and start the token at the initiator",
        "hand the token to the next alive process around the ring",
        "at each process set token to the larger of the token and its id",
        "continue until the token returns to the initiator",
        "the value in the token is the leader",
        "the leader sends the result around the ring once",
        "done: report the elected leader",
    ],
};

export default module;
