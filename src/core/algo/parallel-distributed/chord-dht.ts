/**
 * chord-dht.ts - Chord Distributed Hash Table
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Chord maps nodes and keys onto a circular identifier space of 2^m slots.
 * Every node keeps a successor pointer and a finger table whose i-th entry is
 * the successor of (n + 2^i) mod 2^m. A lookup routes greedily to the closest
 * preceding finger, halving the remaining distance on each hop, so it finds a
 * key's successor in O(log N) hops with only O(log N) routing state per node.
 *
 * This simulation builds the ring, computes every finger table by brute force,
 * and routes a concrete key lookup. Identifiers are exact integers; no network
 * delay, churn, or failure is modeled.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N * m) to build tables; O(log N) hops per lookup
 *   Space: O(N * m) for all finger tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are circles; successor and finger links are directed edges.
 *   - The focus node's finger targets turn yellow during table construction.
 *   - Lookup hops turn green along the route to the key's successor.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

export interface ChordState {
    m: number;
    mod: number;
    nodeIds: number[];
    successors: Map<number, number>;
    fingers: Map<number, number[]>;
}

export interface ChordLookup {
    target: number;
    path: number[];
    hops: number;
}

/** Clockwise distance from a to b on an m-bit ring. */
function clockwise(a: number, b: number, mod: number): number {
    return (b - a + mod) % mod;
}

/** First node at or after key (key itself counts when it is a node). */
export function directSuccessor(nodeIds: number[], key: number, mod: number): number {
    let best = nodeIds[0] ?? 0;
    let bestDistance = clockwise(key, best, mod);
    for (const node of nodeIds) {
        const distance = clockwise(key, node, mod);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = node;
        }
    }
    return best;
}

/** First strictly clockwise node after n, or n itself for a singleton ring. */
function ringSuccessor(nodeIds: number[], n: number, mod: number): number {
    let best = n;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const node of nodeIds) {
        const distance = clockwise(n, node, mod);
        if (distance > 0 && distance < bestDistance) {
            bestDistance = distance;
            best = node;
        }
    }
    return best;
}

/** Build successor pointers and full finger tables for the ring. */
export function buildChord(nodeIds: number[], m: number): ChordState {
    const mod = 2 ** m;
    const unique = [...new Set(nodeIds)]
        .filter((id) => id >= 0 && id < mod)
        .sort((a, b) => a - b);
    if (unique.length === 0) unique.push(0);
    const successors = new Map<number, number>();
    const fingers = new Map<number, number[]>();
    for (const node of unique) {
        successors.set(node, ringSuccessor(unique, node, mod));
        const table: number[] = [];
        for (let i = 0; i < m; i += 1) {
            table.push(directSuccessor(unique, (node + 2 ** i) % mod, mod));
        }
        fingers.set(node, table);
    }
    return { m, mod, nodeIds: unique, successors, fingers };
}

/** Route a key lookup from a starting node to its successor. */
export function findSuccessorChord(state: ChordState, start: number, key: number): ChordLookup {
    const path: number[] = [state.nodeIds.includes(start) ? start : state.nodeIds[0]!];
    let n = path[0]!;
    const limit = state.nodeIds.length + 2;
    for (let step = 0; step < limit; step += 1) {
        if (n === key) return { target: n, path, hops: path.length - 1 };
        const successor = state.successors.get(n) ?? n;
        const remaining = clockwise(n, key, state.mod);
        const toSuccessor = clockwise(n, successor, state.mod);
        if (remaining > 0 && remaining <= toSuccessor) {
            path.push(successor);
            return { target: successor, path, hops: path.length - 1 };
        }
        const table = state.fingers.get(n) ?? [];
        let best = n;
        let bestDistance = 0;
        for (const finger of table) {
            const distance = clockwise(n, finger, state.mod);
            if (distance > 0 && distance < remaining && distance > bestDistance) {
                bestDistance = distance;
                best = finger;
            }
        }
        if (best === n) {
            path.push(successor);
            return { target: successor, path, hops: path.length - 1 };
        }
        n = best;
        path.push(n);
    }
    const target = directSuccessor(state.nodeIds, key, state.mod);
    return { target, path: [...path, target], hops: path.length };
}

/** Build node entities and the successor/finger edges of the ring. */
function makeFrameEntities(
    state: ChordState,
    focus: number,
    states: Map<number, EntityState>,
    highlightedEdges: Set<string>,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = state.nodeIds.map((id) => ({
        id: `node-${id}`,
        type: "node" as const,
        label: String(id),
        value: id,
        state: states.get(id) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { nodeId: id },
    }));
    const edges: VisualEdge[] = [];
    for (const node of state.nodeIds) {
        const successor = state.successors.get(node) ?? node;
        const id = `succ-${node}`;
        edges.push({
            id,
            sourceId: `node-${node}`,
            targetId: `node-${successor}`,
            label: "succ",
            state: highlightedEdges.has(id) ? "active" : "idle",
            directed: true,
        });
    }
    const table = state.fingers.get(focus) ?? [];
    for (let i = 0; i < table.length; i += 1) {
        const id = `finger-${i}`;
        edges.push({
            id,
            sourceId: `node-${focus}`,
            targetId: `node-${table[i]}`,
            label: `2^${i}`,
            state: highlightedEdges.has(id) ? "active" : "idle",
            directed: true,
        });
    }
    return { entities, edges };
}

/** The Chord DHT generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { m?: number; nodes?: number[]; key?: number } | null) ?? {};
    const m = Math.min(8, Math.max(2, typeof task.m === "number" ? Math.floor(task.m) : 4));
    const state = buildChord(
        Array.isArray(task.nodes) ? task.nodes : [1, 4, 9, 12],
        m,
    );
    const key = Math.min(state.mod - 1, Math.max(0, typeof task.key === "number" ? Math.floor(task.key) : 11));
    const focus = state.nodeIds[0]!;

    let step = 0;
    const initial = makeFrameEntities(state, focus, new Map([[focus, "active"]]), new Set());
    yield {
        stepNumber: step++,
        entities: initial.entities,
        edges: initial.edges,
        description: `Building a ${m}-bit Chord ring of ${state.nodeIds.length} node(s) in ${state.mod} slots.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { m, mod: state.mod, key, nodeCount: state.nodeIds.length, fingerSize: m, hops: 0 },
    };

    const table = state.fingers.get(focus) ?? [];
    for (let i = 0; i < table.length; i += 1) {
        const highlighted = new Set([`finger-${i}`]);
        const frame = makeFrameEntities(
            state,
            focus,
            new Map([
                [focus, "active"],
                [table[i]!, "comparing"],
            ]),
            highlighted,
        );
        yield {
            stepNumber: step++,
            entities: frame.entities,
            edges: frame.edges,
            description: `Finger ${i} of node ${focus} points to ${table[i]}, the successor of ${focus} + 2^${i}.`,
            codeLineNumber: 1,
            layout: "graph",
            meta: { m, mod: state.mod, key, fingerIndex: i, fingerTarget: table[i], hops: 0 },
        };
    }

    const lookup = findSuccessorChord(state, focus, key);
    for (let i = 0; i < lookup.path.length; i += 1) {
        const current = lookup.path[i]!;
        const states = new Map<number, EntityState>();
        for (let j = 0; j <= i; j += 1) states.set(lookup.path[j]!, j === i ? "active" : "visited");
        const highlighted = new Set<string>();
        if (i > 0) highlighted.add(`succ-${lookup.path[i - 1]}`);
        const frame = makeFrameEntities(state, focus, states, highlighted);
        yield {
            stepNumber: step++,
            entities: frame.entities,
            edges: frame.edges,
            description:
                i === 0
                    ? `Starting lookup of key ${key} at node ${current}.`
                    : `Hop ${i}: routed from ${lookup.path[i - 1]} to ${current}, closer to key ${key}.`,
            codeLineNumber: i === 0 ? 3 : 4,
            layout: "graph",
            meta: {
                m,
                mod: state.mod,
                key,
                current,
                hops: i,
                target: lookup.target,
                path: lookup.path,
            },
        };
    }

    const done = makeFrameEntities(
        state,
        focus,
        new Map(lookup.path.map((node, i) => [node, i === lookup.path.length - 1 ? "sorted" : "visited"])),
        new Set(),
    );
    yield {
        stepNumber: step,
        entities: done.entities,
        edges: done.edges,
        description: `Key ${key} is owned by successor ${lookup.target}, reached in ${lookup.hops} hop(s).`,
        codeLineNumber: 6,
        layout: "graph",
        meta: { m, mod: state.mod, key, target: lookup.target, hops: lookup.hops, path: lookup.path },
    };
}

/** The Chord DHT module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Place every node and key on one big circle. Each node remembers a handful of shortcuts called fingers that jump to successors of doubling distances around the ring. To find who owns a key, forward the query to the finger closest to the key but still before it. Each hop covers at least half the remaining distance, so the query arrives quickly.",
        invariants: [
            "A node's successor is the first node strictly clockwise from it.",
            "Finger i of node n is the successor of (n + 2^i) mod 2^m.",
            "Each lookup hop moves to a node strictly closer to the key in clockwise distance.",
        ],
        correctness:
            "For a query at node n with key k, let s be the successor of n. If k lies in the half-open arc (n, s], then s owns k and the search stops there. Otherwise the closest preceding finger f is the node with the largest clockwise distance from n that is still less than the distance to k. Every node between n and f is skipped, so the remaining arc at least halves. The arc distance strictly decreases, so the loop terminates, and it can only stop at the true successor because the stopping condition is exactly the ownership rule.",
        complexityRationale:
            "Building one finger table takes m lookups of a successor and O(N) work each by brute force, giving O(N * m) total. A route halves the remaining arc each hop, so it uses O(log N) hops; each node stores m fingers, so O(log N) space per node and O(N * m) overall.",
        uses: [
            "Peer-to-peer key-value overlays and content distribution",
            "Decentralized service discovery in distributed systems",
            "A teaching basis for consistent-hashing overlays",
        ],
        references: [
            "Stoica, Morris, Karger, Kaashoek, and Balakrishnan, Chord: A Scalable Peer-to-peer Lookup Service, SIGCOMM 2001",
            "Balakrishnan and Morris, Chord DHT design notes, MIT",
        ],
        workedExample:
            "On a 4-bit ring with nodes 1, 4, 9, 12, the fingers of node 1 are the successors of 2, 3, 5, and 9, namely 4, 4, 9, and 9. A lookup of key 11 from node 1 jumps to 9, then to 12, which owns 11 after wrapping around the ring.",
    },
    id: "chord-dht",
    name: "Chord DHT",
    category: "parallel-distributed",
    complexity: { time: "O(log N) lookup", space: "O(N log N)" },
    defaultInput: { m: 4, nodes: [1, 4, 9, 12], key: 11 },
    visualType: "graph",
    run,
    pseudocode: [
        "map node ids and keys onto a ring of 2 to the m slots",
        "for each node set finger i to successor of n plus 2 to the i",
        "start the lookup of key k at node n",
        "if k is in the arc from n to successor n, return successor n",
        "otherwise jump to the closest preceding finger of n",
        "repeat from that node until the owner is reached",
        "done: report the successor that owns the key",
    ],
};

export default module;
