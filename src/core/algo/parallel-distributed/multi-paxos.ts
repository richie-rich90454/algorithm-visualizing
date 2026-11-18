/**
 * multi-paxos.ts - Multi-Paxos Consensus (Single Leader Term)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Multi-Paxos extends single-decree Paxos to a sequence of log slots. One
 * stable leader first runs a prepare/promise round for the whole term, then
 * runs only the accept/accepted phase for each slot. A value is chosen in a
 * slot as soon as a majority of acceptors report accepting it, and that choice
 * is final: any later leader with a higher ballot must preserve it.
 *
 * This is a deterministic teaching simulation over a fixed set of acceptors.
 * The exact step shown is the majority rule: a slot is chosen if and only if
 * the number of accepting acceptors reaches floor(n/2) + 1.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * m) messages for n acceptors and m log slots in one term
 *   Space: O(n + m) for acceptor state and the replicated log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The leader and each acceptor are nodes; RPCs are directed edges.
 *   - An available acceptor is green once it has promised or accepted.
 *   - A failed acceptor is red; a slot chosen by a majority is highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

export interface MultiPaxosData {
    acceptors: number;
    quorum: number;
    promises: number;
    failed: number[];
    proposals: number[];
    accepts: number[];
    chosen: boolean[];
    chosenValues: number[];
}

/** Deterministic Multi-Paxos simulation for one leader ballot. */
export function simulateMultiPaxos(
    acceptors: number,
    proposals: number[],
    failed: number[],
): MultiPaxosData {
    const n = Math.max(1, Math.floor(acceptors));
    const quorum = Math.floor(n / 2) + 1;
    const failedSet = new Set(failed.filter((i) => i >= 0 && i < n));
    const available = n - failedSet.size;
    const promises = available;
    const accepts = proposals.map(() => available);
    const chosen = accepts.map((count) => count >= quorum);
    const chosenValues = proposals.filter((_, slot) => chosen[slot]);
    return { acceptors: n, quorum, promises, failed: [...failedSet], proposals, accepts, chosen, chosenValues };
}

/** Build leader + acceptor nodes with the given acceptor states. */
function makeNodes(states: EntityState[]): VisualEntity[] {
    const nodes: VisualEntity[] = [
        {
            id: "leader",
            type: "node",
            label: "L",
            value: "leader",
            state: "active",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "leader" },
        },
    ];
    states.forEach((state, index) => {
        nodes.push({
            id: `acceptor-${index}`,
            type: "node",
            label: `A${index}`,
            value: index,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { role: "acceptor", index },
        });
    });
    return nodes;
}

/** Directed RPC edges from the leader to every acceptor. */
function makeEdges(data: MultiPaxosData, phase: EntityState): VisualEdge[] {
    return Array.from({ length: data.acceptors }, (_, index) => ({
        id: `rpc-${index}`,
        sourceId: "leader",
        targetId: `acceptor-${index}`,
        label: data.failed.includes(index) ? "lost" : "ok",
        state: data.failed.includes(index) ? "error" : phase,
        directed: true,
    }));
}

/** The Multi-Paxos generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { acceptors?: number; proposals?: number[]; failed?: number[] } | null) ?? {};
    const acceptors = typeof task.acceptors === "number" ? Math.max(1, Math.floor(task.acceptors)) : 5;
    const proposals = Array.isArray(task.proposals) && task.proposals.length > 0
        ? [...task.proposals]
        : [7, 3, 9];
    const failed = Array.isArray(task.failed) ? [...task.failed] : [];
    const data = simulateMultiPaxos(acceptors, proposals, failed);
    const idleStates = () => Array<EntityState>(acceptors).fill("idle");

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeNodes(idleStates()),
        edges: makeEdges(data, "idle"),
        description: `Starting Multi-Paxos with ${acceptors} acceptors, quorum ${data.quorum}, and ${proposals.length} log slot(s).`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { acceptors, quorum: data.quorum, phase: "setup", promises: 0, chosenValues: [] },
    };

    const promiseStates = idleStates().map((_, index) =>
        data.failed.includes(index) ? "error" as const : "sorted" as const,
    );
    yield {
        stepNumber: step++,
        entities: makeNodes(promiseStates),
        edges: makeEdges(data, "active"),
        description: `Prepare round: ${data.promises} promise(s) from ${acceptors - data.failed.length} live acceptor(s); quorum is ${data.quorum}.`,
        codeLineNumber: 2,
        layout: "graph",
        meta: { acceptors, quorum: data.quorum, phase: "prepare", promises: data.promises, chosenValues: [] },
    };

    for (let slot = 0; slot < proposals.length; slot += 1) {
        const states: EntityState[] = idleStates().map((_, index) =>
            data.failed.includes(index) ? "error" as const : "active" as const,
        );
        if (data.chosen[slot]) {
            states[data.acceptors - 1] = "sorted";
        }
        yield {
            stepNumber: step++,
            entities: makeNodes(states),
            edges: makeEdges(data, "comparing"),
            description: `Slot ${slot}: accept value ${proposals[slot]} received ${data.accepts[slot]} accept(s) of ${data.quorum} needed - ${data.chosen[slot] ? "chosen" : "not chosen"}.`,
            codeLineNumber: 4,
            layout: "graph",
            meta: {
                acceptors,
                quorum: data.quorum,
                phase: "accept",
                slot,
                value: proposals[slot],
                accepts: data.accepts[slot],
                chosen: data.chosen[slot] ?? false,
                chosenValues: [...data.chosenValues],
            },
        };
    }

    yield {
        stepNumber: step,
        entities: makeNodes(idleStates().map((_, index) =>
            data.chosenValues.length > 0
                ? (data.failed.includes(index) ? "error" as const : "sorted" as const)
                : "unvisited" as const,
        )),
        edges: makeEdges(data, data.chosenValues.length > 0 ? "active" : "idle"),
        description: `Term complete: ${data.chosenValues.length} of ${proposals.length} slot(s) chosen - [${data.chosenValues.join(", ")}].`,
        codeLineNumber: 7,
        layout: "graph",
        meta: { acceptors, quorum: data.quorum, phase: "done", promises: data.promises, chosenValues: [...data.chosenValues] },
    };
}

/** The Multi-Paxos module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Elect one leader and let it reuse its prepare round for a whole log. Once a majority has promised, the leader only needs one accept round per slot instead of a fresh prepare each time. A value is committed when a majority accepts it, which makes two different values unable to win the same slot.",
        invariants: [
            "A promise or accept counts only from an acceptor that has not failed.",
            "A slot is chosen exactly when its accept count reaches floor(n/2) plus one.",
            "Two majorities intersect, so two different values cannot both be chosen in one slot.",
        ],
        correctness:
            "Any two majorities of n acceptors share at least one acceptor. If a value v was chosen by a majority, every later successful prepare contacts that shared acceptor, which reports v with the highest accepted ballot. The leader must then propose v, so a later accept round cannot choose a different value. Agreement, validity, and termination for a stable leader follow.",
        complexityRationale:
            "The single prepare round touches n acceptors, and each of the m slots touches n more, for O(n*m) messages in one term. The leader stores the log of m values and each acceptor stores one promise ballot and its accepted entries, O(n + m) state.",
        uses: [
            "Replicated logs in distributed key-value stores",
            "Consensus behind systems such as Chubby and Spanner style controllers",
            "Coordinating configuration changes across a fixed leader term",
        ],
        references: [
            "Lamport, Paxos Made Simple, 2001",
            "Chandra, Griesemer, and Redstone, Paxos Made Live, 2007",
        ],
        workedExample:
            "With five acceptors, quorum three, and one failed acceptor, four promises form a valid prepare round. For slots proposing 7, 3, and 9, each gets four accepts, so all three values are chosen and the committed log is [7, 3, 9]. If three acceptors fail, only two promises arrive and no slot is chosen.",
    },
    id: "multi-paxos",
    name: "Multi-Paxos",
    category: "parallel-distributed",
    complexity: { time: "O(n*m) messages", space: "O(n+m)" },
    defaultInput: { acceptors: 5, proposals: [7, 3, 9], failed: [4] },
    visualType: "graph",
    run,
    pseudocode: [
        "elect a leader and pick a fresh ballot number",
        "send prepare to every acceptor and collect promises",
        "proceed only when a majority has promised",
        "for each log slot send accept with the chosen value",
        "count accepted replies from the acceptors",
        "mark the slot chosen when the count reaches a majority",
        "carry any previously chosen value into later ballots",
        "done: report the committed log of chosen values",
    ],
};

export default module;
