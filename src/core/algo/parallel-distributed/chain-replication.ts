/**
 * chain-replication.ts - Chain Replication (Write/Dread Through a Server Chain)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Chain replication places replicas in a linear chain. Writes enter at the
 * head, flow down to the tail, and are acknowledged only by the tail, so a
 * committed write is present on every server. Reads are served by the tail,
 * which always holds the most recent committed state. If a server fails, its
 * neighbors bypass it and the head or tail role moves to an endpoint.
 *
 * This deterministic teaching simulation forwards writes along the chain,
 * marks writes dropped at a failed server as uncommitted, and computes the
 * reconfigured chain after a failure.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) messages per write across N servers
 *   Space: O(N) state across the chain plus one pending write per server
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Servers are graph nodes; consecutive links are directed edges.
 *   - A write is green across servers it reached, red at a failed server.
 *   - The final frame shows the chain after bypassing the failed server.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

export interface ChainReplicationData {
    chain: string[];
    writes: number[];
    failIndex: number;
    failAfter: number;
    failed: boolean;
    traversed: number[][];
    committed: number[];
    newChain: string[];
}

/** Deterministic chain-replication forwarding with one server failure. */
export function simulateChainReplication(
    chain: string[],
    writes: number[],
    failIndex: number,
    failAfter: number,
): ChainReplicationData {
    const servers = chain.length > 0 ? [...chain] : ["H", "S1", "S2", "T"];
    const n = servers.length;
    const hasFailure = failIndex >= 0 && failIndex < n;
    const newChain = hasFailure ? servers.filter((_, i) => i !== failIndex) : [...servers];
    const traversed: number[][] = [];
    const committed: number[] = [];

    writes.forEach((write, k) => {
        if (hasFailure && k >= failAfter) {
            traversed.push(Array.from({ length: failIndex + 1 }, (_, i) => i));
        } else if (hasFailure) {
            traversed.push(newChain.map((_, i) => i));
        } else {
            traversed.push(Array.from({ length: n }, (_, i) => i));
        }
        if (!hasFailure || k < failAfter) committed.push(write);
    });

    return { chain: servers, writes, failIndex, failAfter, failed: hasFailure, traversed, committed, newChain };
}

/** Server nodes with per-server states. */
function makeNodes(data: ChainReplicationData, states: EntityState[]): VisualEntity[] {
    return data.chain.map((name, index) => ({
        id: `server-${index}`,
        type: "node" as const,
        label: name,
        value: name,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index === 0 ? "head" : index === data.chain.length - 1 ? "tail" : "middle" },
    }));
}

/** Consecutive chain links; links touching a failed server turn red. */
function makeEdges(data: ChainReplicationData): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 0; i < data.chain.length - 1; i += 1) {
        const broken = data.failed && (i === data.failIndex || i + 1 === data.failIndex);
        edges.push({
            id: `link-${i}-${i + 1}`,
            sourceId: `server-${i}`,
            targetId: `server-${i + 1}`,
            label: broken ? "broken" : "next",
            state: broken ? "error" : "active",
            directed: true,
        });
    }
    return edges;
}

/** The Chain Replication generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        chain?: string[]; writes?: number[]; failIndex?: number; failAfter?: number;
    } | null) ?? {};
    const data = simulateChainReplication(
        Array.isArray(task.chain) ? task.chain : ["H", "S1", "S2", "T"],
        Array.isArray(task.writes) ? task.writes : [5, 6, 7],
        typeof task.failIndex === "number" ? task.failIndex : -1,
        typeof task.failAfter === "number" ? task.failAfter : 1,
    );
    const n = data.chain.length;

    yield {
        stepNumber: 0,
        entities: makeNodes(data, Array<EntityState>(n).fill("idle")),
        edges: makeEdges(data),
        description: `Chain of ${n} servers from head ${data.chain[0]} to tail ${data.chain[n - 1]}; writes enter at the head and commit at the tail.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { servers: n, writes: data.writes.length, committed: 0, phase: "setup" },
    };

    for (let k = 0; k < data.writes.length; k += 1) {
        const path = data.traversed[k] ?? [];
        const dropped = data.failed && k >= data.failAfter;
        const states: EntityState[] = Array<EntityState>(n).fill("idle");
        for (const index of path) states[index] = "active";
        if (dropped && data.failIndex >= 0) states[data.failIndex] = "error";
        else if (path.length > 0) states[path[path.length - 1] ?? 0] = "sorted";
        yield {
            stepNumber: 1 + k,
            entities: makeNodes(data, states),
            edges: makeEdges(data),
            description: dropped
                ? `Write ${data.writes[k]} reached failed server ${data.failIndex} and was dropped; it is not committed.`
                : `Write ${data.writes[k]} reached tail ${data.chain[n - 1]} and is committed on all ${n} servers.`,
            codeLineNumber: dropped ? 4 : 2,
            layout: "graph",
            meta: { servers: n, phase: "write", write: data.writes[k] ?? -1, committed: data.committed.length },
        };
    }

    const finalStates: EntityState[] = Array<EntityState>(n).fill("idle");
    if (data.failed && data.failIndex >= 0) {
        finalStates[data.failIndex] = "error";
        finalStates[finalStates.length - 1] = "sorted";
        finalStates[0] = "active";
    } else {
        finalStates.fill("sorted");
    }
    yield {
        stepNumber: 1 + data.writes.length,
        entities: makeNodes(data, finalStates),
        edges: makeEdges(data),
        description: data.failed
            ? `Server ${data.failIndex} failed; chain bypasses it as [${data.newChain.join(", ")}] with ${data.committed.length} committed write(s).`
            : `All ${data.committed.length} write(s) committed; chain remains [${data.chain.join(", ")}].`,
        codeLineNumber: 6,
        layout: "graph",
        meta: { servers: n, phase: "done", committed: data.committed.length, committedValues: data.committed },
    };
}

/** The Chain Replication module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Arrange replicas in a line rather than a mesh. A write travels from the head to the tail and only the tail acknowledges it, so an acknowledged write is guaranteed to be on every server. Reads go to the tail for the freshest value. Losing a server is simple: its neighbors link directly, and an endpoint failure promotes its neighbor.",
        invariants: [
            "A write is committed only after it reaches the tail.",
            "The tail's state is a prefix of every earlier server's state.",
            "After reconfiguration the chain keeps the original relative order of surviving servers.",
        ],
        correctness:
            "Because a write is forwarded in order and acknowledged only at the tail, every server before the tail has stored the write before the client hears success, giving linearizable reads at the tail. When a server fails, bypassing it preserves the ordering of the remaining servers, and the new tail holds all previously committed writes because the old tail either survives or its predecessor has the same committed prefix. No committed write is lost.",
        complexityRationale:
            "Each write crosses N-1 links and produces N-1 forwarding messages, so O(N) per write; reads are O(1) at the tail. Each server stores one copy of the replicated value, so total state is O(N) plus the pending writes in flight.",
        uses: [
            "Replicated object stores such as Microsoft's Azure storage",
            "Strongly consistent key-value services that favor simple recovery",
            "Teaching the difference between commit-at-tail and quorum replication",
        ],
        references: [
            "van Renesse and Schneider, Chain Replication for Supporting High Throughput and Availability, 2004",
            "van Renesse, Altinbuken, and Schneider, Object Storage in the Cloud, 2015",
        ],
        workedExample:
            "With chain H, S1, S2, T and writes 5, 6, 7, if S1 fails after the first write, write 5 reaches the tail and commits. Writes 6 and 7 stop at S1 and are dropped. The chain reconfigures to H, S2, T and reports one committed write.",
    },
    id: "chain-replication",
    name: "Chain Replication",
    category: "parallel-distributed",
    complexity: { time: "O(N) per write", space: "O(N)" },
    defaultInput: { chain: ["H", "S1", "S2", "T"], writes: [5, 6, 7], failIndex: 1, failAfter: 1 },
    visualType: "graph",
    run,
    pseudocode: [
        "arrange replicas in a chain from head to tail",
        "for each write send it from the head down the chain",
        "each server appends the write and forwards it onward",
        "the tail applies the write and acknowledges the client",
        "a write that reaches a failed server is dropped",
        "on failure link the failed server's neighbors directly",
        "promote a neighbor to head or tail when an endpoint fails",
        "done: report committed writes and the reconfigured chain",
    ],
};

export default module;
