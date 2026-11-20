/**
 * hinted-handoff.ts - Hinted Handoff for Eventual Consistency
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a replicated store, a coordinator writes each key to every replica in its
 * preference list. If a replica is temporarily down, the coordinator does not
 * drop the write: it stores a hint addressed to that node. When the node comes
 * back, the coordinator replays the stored hints so the node catches up. This
 * keeps writes available during a failure and lets replicas converge once the
 * failure is repaired.
 *
 * This simulation places replicas on a small ring, applies a list of writes,
 * records hints for down replicas, then replays all hints on recovery. Every
 * value is an exact integer tag; no timing, concurrency, or real network is
 * modeled.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(W * R) for W writes and replication factor R, plus O(H) replay
 *   Space: O(H + R * K) for H pending hints and K distinct keys
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cluster nodes are circles joined by a directed ring of edges.
 *   - A down node is red; a node receiving a write turns yellow.
 *   - Replayed nodes turn green, and metadata lists stored values and hints.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

export interface Write {
    key: string;
    value: number;
}

export interface HandoffState {
    nodeIds: number[];
    down: Set<number>;
    replicationFactor: number;
    /** node id -> (key -> value) */
    stored: Map<number, Map<string, number>>;
    /** down node id -> list of pending writes */
    hints: Map<number, Write[]>;
}

/** Stable hash of a key into the range [0, modulus). */
export function hashKey(key: string, modulus: number): number {
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
        hash = (hash * 31 + (key.charCodeAt(i) | 0)) % modulus;
    }
    return hash;
}

/** Preference list of R replicas starting at the hash of the key. */
export function preferenceList(nodeIds: number[], key: string, replicationFactor: number): number[] {
    const n = nodeIds.length;
    const sorted = [...nodeIds].sort((a, b) => a - b);
    const start = hashKey(key, n);
    const replicas: number[] = [];
    for (let i = 0; i < Math.min(replicationFactor, n); i += 1) {
        replicas.push(sorted[(start + i) % n]!);
    }
    return replicas;
}

/** Apply writes, storing hints for down replicas; return the simulated store. */
export function applyWrites(
    nodeIds: number[],
    down: number[],
    replicationFactor: number,
    writes: Write[],
): HandoffState {
    const state: HandoffState = {
        nodeIds: [...nodeIds],
        down: new Set(down),
        replicationFactor,
        stored: new Map(nodeIds.map((id) => [id, new Map<string, number>()])),
        hints: new Map(),
    };
    for (const write of writes) {
        for (const replica of preferenceList(nodeIds, write.key, replicationFactor)) {
            if (state.down.has(replica)) {
                const list = state.hints.get(replica) ?? [];
                list.push({ ...write });
                state.hints.set(replica, list);
            } else {
                state.stored.get(replica)!.set(write.key, write.value);
            }
        }
    }
    return state;
}

/** Replay all pending hints to their addressee and clear the hint store. */
export function replayHints(state: HandoffState): void {
    for (const [node, writes] of state.hints) {
        const store = state.stored.get(node) ?? new Map<string, number>();
        for (const write of writes) store.set(write.key, write.value);
        state.stored.set(node, store);
    }
    state.hints.clear();
    state.down.clear();
}

function makeNodes(
    state: HandoffState,
    active: Set<number>,
    replayed: Set<number>,
): VisualEntity[] {
    return state.nodeIds.map((id) => {
        const store = state.stored.get(id) ?? new Map<string, number>();
        const stateName: EntityState = replayed.has(id)
            ? "sorted"
            : active.has(id)
              ? "comparing"
              : state.down.has(id)
                ? "error"
                : "unvisited";
        return {
            id: `node-${id}`,
            type: "node" as const,
            label: `n${id}`,
            value: store.size,
            state: stateName,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                nodeId: id,
                down: state.down.has(id),
                keysStored: store.size,
                hintCount: state.hints.get(id)?.length ?? 0,
            },
        };
    });
}

function makeRingEdges(nodeIds: number[]): VisualEdge[] {
    const sorted = [...nodeIds].sort((a, b) => a - b);
    if (sorted.length < 2) return [];
    return sorted.map((id, i) => ({
        id: `ring-${id}`,
        sourceId: `node-${id}`,
        targetId: `node-${sorted[(i + 1) % sorted.length]}`,
        label: "",
        state: "idle" as const,
        directed: true,
    }));
}

function hintCount(state: HandoffState): number {
    let total = 0;
    for (const list of state.hints.values()) total += list.length;
    return total;
}

/** The hinted-handoff generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { nodes?: number[]; down?: number[]; replicationFactor?: number; writes?: Write[] } | null
    ) ?? {};
    const nodeIds = Array.isArray(task.nodes) ? [...task.nodes] : [0, 1, 2, 3];
    const down = Array.isArray(task.down) ? task.down : [2];
    const replicationFactor = typeof task.replicationFactor === "number" ? Math.floor(task.replicationFactor) : 3;
    const writes: Write[] = Array.isArray(task.writes)
        ? task.writes.filter((w): w is Write => typeof w?.key === "string" && typeof w?.value === "number")
        : [
              { key: "a", value: 1 },
              { key: "b", value: 2 },
              { key: "a", value: 3 },
              { key: "c", value: 4 },
          ];
    const edges = makeRingEdges(nodeIds);
    const state = applyWrites(nodeIds, down, replicationFactor, writes);
    let step = 0;

    yield {
        stepNumber: step++,
        entities: makeNodes(state, new Set(), new Set()),
        edges: edges.map((edge) => ({ ...edge })),
        description: `Starting hinted handoff on ${nodeIds.length} node(s), ${down.length} down, replication factor ${replicationFactor}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { nodes: nodeIds.length, down: [...down], replicationFactor, writes: writes.length, hints: 0 },
    };

    for (const write of writes) {
        const replicas = preferenceList(nodeIds, write.key, replicationFactor);
        const active = new Set(replicas.filter((id) => !state.down.has(id)));
        yield {
            stepNumber: step++,
            entities: makeNodes(state, active, new Set()),
            edges: edges.map((edge) => ({ ...edge })),
            description: `Write ${write.key}=${write.value} goes to replicas ${replicas.join(", ")}; down replicas receive a hint.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: {
                nodes: nodeIds.length,
                down: [...state.down],
                replicationFactor,
                writes: writes.length,
                hints: hintCount(state),
                key: write.key,
                value: write.value,
                replicas,
            },
        };
    }

    yield {
        stepNumber: step++,
        entities: makeNodes(state, new Set(), new Set()),
        edges: edges.map((edge) => ({ ...edge })),
        description: `${hintCount(state)} hint(s) are waiting for the ${state.down.size} failed node(s).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { nodes: nodeIds.length, down: [...state.down], replicationFactor, writes: writes.length, hints: hintCount(state) },
    };

    const recovered = new Set(state.down);
    replayHints(state);
    yield {
        stepNumber: step++,
        entities: makeNodes(state, new Set(), recovered),
        edges: edges.map((edge) => ({ ...edge })),
        description: `Node(s) ${[...recovered].join(", ")} recovered; all hints were replayed and the hint store is empty.`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { nodes: nodeIds.length, down: [], replicationFactor, writes: writes.length, hints: 0, replayed: [...recovered] },
    };

    yield {
        stepNumber: step,
        entities: makeNodes(state, new Set(), recovered),
        edges: edges.map((edge) => ({ ...edge })),
        description: "Replicas have converged: every preference list holds the latest value for each key.",
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            nodes: nodeIds.length,
            down: [],
            replicationFactor,
            writes: writes.length,
            hints: 0,
            stored: [...state.stored].map(
                ([id, store]) => `${id}:${[...store].map(([key, value]) => `${key}=${value}`).join(",")}`,
            ),
        },
    };
}

/** The hinted-handoff module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "When a copy of the data is unavailable, do not block or forget the write. Leave a note for the missing copy describing what it missed. As soon as that copy comes back, it reads its notes and catches up. Clients keep writing during the outage, and the replicas agree again afterward.",
        invariants: [
            "A write reaches every replica that is up at the time it is issued.",
            "For a down replica, one hint per write is stored and addressed to that replica.",
            "Replaying a hint applies exactly the write that the replica missed.",
        ],
        correctness:
            "Consider any key and the last write to it. That write was delivered to every replica that was up, and a hint was queued for every replica that was down. Replaying all hints delivers the same last write to the recovered replicas; older hints are overwritten by later values in write order. Thus every replica in the preference list ends with the value of the last write, so the replicas converge and the hint store is empty.",
        complexityRationale:
            "Each of the W writes is sent to at most R replicas, so writes cost O(W * R) work and produce at most O(W * R) hints. Replaying touches every hint once, O(H) time. Storage is the hint backlog plus one value per key per replica, O(H + R * K).",
        uses: [
            "Write availability in wide-column stores during node outages",
            "Replica catch-up in eventually consistent key-value systems",
            "Reducing data loss during transient network partitions",
        ],
        references: [
            "DeCandia et al., Dynamo: Amazon's Highly Available Key-value Store, SOSP 2007",
            "Lakshman and Malik, Cassandra: A Decentralized Structured Storage System, 2010",
        ],
        workedExample:
            "With nodes 0 to 3, node 2 down, and replication factor 3, the key 'a' maps to replicas 2, 3, 0. Writing a=3 stores 3 on nodes 3 and 0 and queues a hint for node 2. When node 2 recovers, the hint applies a=3 there, so all three replicas agree.",
    },
    id: "hinted-handoff",
    name: "Hinted Handoff",
    category: "parallel-distributed",
    complexity: { time: "O(W*R + H)", space: "O(H + R*K)" },
    defaultInput: {
        nodes: [0, 1, 2, 3],
        down: [2],
        replicationFactor: 3,
        writes: [
            { key: "a", value: 1 },
            { key: "b", value: 2 },
            { key: "a", value: 3 },
            { key: "c", value: 4 },
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "choose replica nodes for the key from its preference list",
        "for each replica that is available, write the value locally",
        "for each replica that is down, store a hint for that node",
        "continue accepting writes while the node is unavailable",
        "when the node recovers, deliver every queued hint to it",
        "clear the hint store after successful replay",
        "done: all replicas hold the latest value for each key",
    ],
};

export default module;
