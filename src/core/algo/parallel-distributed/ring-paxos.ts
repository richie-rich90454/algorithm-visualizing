/**
 * ring-paxos.ts - Ring Paxos (High-Throughput Multi-Paxos on a Ring)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Ring Paxos streams phase-two accepts around a unidirectional ring. The leader
 * injects a value into the token; each acceptor in turn records its vote and
 * forwards the token. When the token returns to the leader with a quorum of
 * votes, the value is committed. This batches the accept work into one trip
 * around the ring instead of a separate message to every acceptor.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) hops per decided value on a ring of N replicas
 *   Space: O(N) for the ring state and the token payload
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Replicas are nodes placed evenly on a circle with directed ring edges.
 *   - The node currently holding the token is highlighted.
 *   - A committed value turns the decided log green in the frame caption.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualEdge, VisualFrame } from "@/types";

interface RingNode {
    id: string;
    x: number;
    y: number;
}

/** Place N replicas at evenly spaced points on a circle. */
function makeNodes(count: number, holder: number, voted: Set<number>): VisualEntity[] {
    return Array.from({ length: count }, (_, index) => {
        const angle = (2 * Math.PI * index) / count - Math.PI / 2;
        let state: EntityState = "idle";
        if (index === holder) {
            state = "comparing";
        } else if (voted.has(index)) {
            state = "sorted";
        }
        return {
            id: `node-${index}`,
            type: "node" as const,
            label: `P${index}`,
            value: index,
            state,
            x: 300 + 190 * Math.cos(angle),
            y: 300 + 190 * Math.sin(angle),
            width: 0,
            height: 0,
            metadata: { index, holder: index === holder },
        };
    });
}

/** Build the directed edges of the ring, lighting up the one just traversed. */
function makeEdges(count: number, from: number): VisualEdge[] {
    return Array.from({ length: count }, (_, index) => {
        const source = index;
        const target = (index + 1) % count;
        return {
            id: `edge-${source}-${target}`,
            sourceId: `node-${source}`,
            targetId: `node-${target}`,
            label: "",
            state: index === from ? "path" : "idle",
            directed: true,
        };
    });
}

/** Replay values being committed around a Paxos ring. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { replicas?: number; values?: number[] } | null) ?? {};
    const replicas =
        typeof task.replicas === "number" ? Math.max(2, Math.floor(task.replicas)) : 4;
    const values: number[] = Array.isArray(task.values)
        ? task.values.map((value) => Number(value) || 0)
        : [10, 20, 30];
    const quorum = Math.floor(replicas / 2) + 1;
    const decided: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeNodes(replicas, 0, new Set()),
        edges: makeEdges(replicas, -1),
        description: `Ring Paxos with ${replicas} replicas; a quorum is ${quorum} vote(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { replicas, quorum, value: 0, phase: "idle", holder: 0, votes: 0, decided: [] },
    };

    let step = 1;
    for (let valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
        const value = values[valueIndex] ?? 0;
        const voted = new Set<number>([0]);
        yield {
            stepNumber: step,
            entities: makeNodes(replicas, 0, voted),
            edges: makeEdges(replicas, -1),
            description: `Value ${value}: the leader injects ballot ${valueIndex + 1} into the token with its own vote.`,
            codeLineNumber: 2,
            layout: "point",
            meta: {
                replicas,
                quorum,
                value,
                phase: "prepare",
                holder: 0,
                votes: 1,
                decided: decided.slice(),
            },
        };
        step += 1;

        for (let hop = 1; hop < replicas; hop += 1) {
            const node = hop % replicas;
            voted.add(node);
            yield {
                stepNumber: step,
                entities: makeNodes(replicas, node, voted),
                edges: makeEdges(replicas, node - 1),
                description: `Token reaches replica ${node}, which adds its vote (${voted.size}/${replicas}).`,
                codeLineNumber: 4,
                layout: "point",
                meta: {
                    replicas,
                    quorum,
                    value,
                    phase: "accept",
                    holder: node,
                    votes: voted.size,
                    decided: decided.slice(),
                },
            };
            step += 1;
        }

        decided.push(value);
        yield {
            stepNumber: step,
            entities: makeNodes(replicas, 0, voted),
            edges: makeEdges(replicas, replicas - 1),
            description: `Token returns to the leader with ${voted.size} vote(s); value ${value} is committed.`,
            codeLineNumber: 6,
            layout: "point",
            meta: {
                replicas,
                quorum,
                value,
                phase: "commit",
                holder: 0,
                votes: voted.size,
                decided: decided.slice(),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(replicas, -1, new Set(Array.from({ length: replicas }, (_, i) => i))),
        edges: makeEdges(replicas, -1),
        description: `Committed log: ${decided.join(", ") || "(empty)"} after ${decided.length} value(s).`,
        codeLineNumber: 6,
        layout: "point",
        meta: {
            replicas,
            quorum,
            value: 0,
            phase: "done",
            holder: -1,
            votes: replicas,
            decided: decided.slice(),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Sending an accept message separately to every replica makes the leader do N sends per value. Ring Paxos instead threads one token through the replicas in a fixed order. Each replica adds its vote and forwards the token, so a single circulation collects all the acceptances, and a quorum is enough to declare the value chosen.",
        invariants: [
            "The token visits replicas in a fixed cyclic order, one hop per step.",
            "A replica votes at most once for a given value in a circulation.",
            "A value is committed only after at least a quorum of votes is collected.",
        ],
        correctness:
            "The ring is a topological order over the acceptors, so every acceptor sees the value before the token returns to the leader. Paxos ballots prevent two different values from being chosen for the same slot, and collecting a quorum guarantees intersection with any later quorum. Once the leader observes enough votes, the value is chosen and cannot be overwritten, so all replicas converge on the same log.",
        complexityRationale:
            "A value needs exactly N hops around the ring, so the leader emits O(N) token passes per decision regardless of the number of values. The nodes, token payload, and vote set use O(N) space.",
        uses: [
            "High-throughput state-machine replication within a data center",
            "Batching many consensus decisions into a single token circulation",
            "Systems where the leader's outbound bandwidth is the bottleneck",
        ],
        references: [
            "Marandi, Primi, and Schiper, Ring Paxos: A High-Throughput Atomic Broadcast Protocol, 2010",
            "Lamport, Paxos Made Simple, 2001",
        ],
        workedExample:
            "On a ring of four replicas the quorum is three. For value 10, the leader votes, then replicas 1, 2, and 3 each add a vote as the token circulates; with the token back at the leader holding four votes, 10 is committed before value 20 starts.",
    },
    id: "ring-paxos",
    name: "Ring Paxos",
    category: "parallel-distributed",
    complexity: { time: "O(N) per value", space: "O(N)" },
    defaultInput: { replicas: 4, values: [10, 20, 30] },
    visualType: "point",
    run,
    pseudocode: [
        "arrange replicas in a directed ring with a chosen leader",
        "for each value to be decided in the next slot",
        "leader injects the value and its own vote into the token",
        "each replica adds its vote and forwards the token",
        "stop circulating once a quorum of votes is present",
        "leader commits the value when the token returns",
        "done: output the decided values in slot order",
    ],
};

export default module;
