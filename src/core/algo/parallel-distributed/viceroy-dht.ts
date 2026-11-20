/**
 * viceroy-dht.ts - Viceroy Butterfly Overlay Routing (Exact Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Viceroy organizes peers in a butterfly network with d+1 levels of 2^d nodes.
 * A node at level ell stores the low ell bits of its key and the remaining high
 * bits from its insertion point. Routing to a target key walks upward one level
 * per hop, fixing the next bit of the key at each step, so a lookup takes d
 * hops regardless of where it starts. Ring links along each level provide
 * neighbor maintenance and fault-tolerant alternatives.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an EXACT SIMULATION of the butterfly routing topology for a small
 * power-of-two key space. It does not simulate network latency, churn, joins,
 * leaves, or the randomized emulated butterfly of the full Viceroy protocol.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d) hops for d = log2(N) key bits
 *   Space: O(N * d) for the butterfly nodes and their links
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each node is labelled by its level and position; links are butterfly
 *     and ring edges.
 *   - The current hop is active, visited nodes are yellow, and the target is
 *     green.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type ViceroyInput = { dimensions?: number; source?: number; target?: number };

function nodeId(level: number, position: number): string {
    return `v-${level}-${position}`;
}

function makeNodes(dimensions: number, size: number, states: Map<string, EntityState>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let level = 0; level <= dimensions; level += 1) {
        for (let position = 0; position < size; position += 1) {
            const id = nodeId(level, position);
            entities.push({
                id,
                type: "node" as const,
                label: `L${level}:${position}`,
                value: { level, position },
                state: states.get(id) ?? "unvisited",
                x: position,
                y: level,
                width: 0,
                height: 0,
                metadata: { level, position, key: position },
            });
        }
    }
    return entities;
}

function makeEdges(dimensions: number, size: number, hot: Set<string>): VisualEdge[] {
    const edges: VisualEdge[] = [];
    const push = (source: string, target: string, label: string): void => {
        const id = `edge-${source}-${target}`;
        edges.push({
            id,
            sourceId: source,
            targetId: target,
            label,
            state: hot.has(id) ? "active" : "idle",
            directed: true,
        });
    };
    for (let level = 0; level <= dimensions; level += 1) {
        for (let position = 0; position < size; position += 1) {
            const next = (position + 1) % size;
            if (next !== position) {
                push(nodeId(level, position), nodeId(level, next), "ring");
            }
            if (level < dimensions) {
                push(nodeId(level, position), nodeId(level + 1, position), "straight");
                push(nodeId(level, position), nodeId(level + 1, position ^ (1 << level)), "cross");
            }
        }
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ViceroyInput | null) ?? {};
    const dimensions = typeof task.dimensions === "number" ? Math.max(1, Math.min(4, task.dimensions)) : 2;
    const size = 1 << dimensions;
    const source = typeof task.source === "number" ? ((task.source % size) + size) % size : 1;
    const target = typeof task.target === "number" ? ((task.target % size) + size) % size : 3;

    const path: Array<{ level: number; position: number }> = [{ level: 0, position: source }];
    let position = source;
    for (let level = 0; level < dimensions; level += 1) {
        const bit = (target >> level) & 1;
        const currentBit = (position >> level) & 1;
        if (currentBit !== bit) {
            position ^= 1 << level;
        }
        path.push({ level: level + 1, position });
    }

    const visited = new Set<string>([nodeId(0, source)]);
    const hot = new Set<string>();
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(dimensions, size, new Map()),
        edges: makeEdges(dimensions, size, hot),
        description: `Viceroy butterfly with ${dimensions} dimensions and ${size} positions per level; routing from key ${source} to key ${target}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { dimensions, size, source, target, hops: 0, path: [], complete: false },
    };
    step += 1;

    for (let hop = 0; hop < path.length - 1; hop += 1) {
        const from = path[hop] as { level: number; position: number };
        const to = path[hop + 1] as { level: number; position: number };
        hot.clear();
        hot.add(`edge-${nodeId(from.level, from.position)}-${nodeId(to.level, to.position)}`);
        visited.add(nodeId(to.level, to.position));
        const states = new Map<string, EntityState>();
        for (const id of visited) {
            states.set(id, "visited");
        }
        states.set(nodeId(to.level, to.position), "active");
        states.set(nodeId(dimensions, target), "sorted");

        yield {
            stepNumber: step,
            entities: makeNodes(dimensions, size, states),
            edges: makeEdges(dimensions, size, hot),
            description: `Hop ${hop + 1}: fix bit ${hop} of the key and move to level ${to.level}, position ${to.position}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { dimensions, size, source, target, hops: hop + 1, path: path.slice(0, hop + 2).map((n) => nodeId(n.level, n.position)), complete: false },
        };
        step += 1;
    }

    const finalStates = new Map<string, EntityState>();
    for (const node of path) {
        finalStates.set(nodeId(node.level, node.position), "visited");
    }
    finalStates.set(nodeId(dimensions, target), "sorted");
    yield {
        stepNumber: step,
        entities: makeNodes(dimensions, size, finalStates),
        edges: makeEdges(dimensions, size, new Set()),
        description: `Key ${target} reached at level ${dimensions} in ${dimensions} hop(s) from key ${source}.`,
        codeLineNumber: 5,
        layout: "graph",
        meta: {
            dimensions,
            size,
            source,
            target,
            hops: dimensions,
            path: path.map((n) => nodeId(n.level, n.position)),
            complete: path[path.length - 1]?.position === target,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A butterfly is a layered graph where each upward edge fixes one more bit of a key. Start at the bottom with the source key and, at each level, cross to the neighbor whose bit matches the target. After fixing all log N bits the packet is at the target's top-level node, so the route length depends only on the key space size.",
        invariants: [
            "After level ell, the low ell bits of the current position equal the target's low ell bits.",
            "Every hop increases the level by exactly one.",
            "A hop moves either straight up or across a single bit position.",
        ],
        correctness:
            "At each level the routing sets the next target bit and leaves higher bits untouched, so by induction after d levels all d bits match the target position. Since the level increases once per hop, the path has exactly d hops and ends at the node representing the target key.",
        complexityRationale:
            "With a key space of N = 2^d there are (d+1) * N nodes and O(d * N) butterfly and ring links. Routing fixes one bit per hop, giving O(d) = O(log N) hops.",
        uses: [
            "Peer-to-peer lookup with predictable route length",
            "Explaining the butterfly pattern behind Viceroy and pastry-style overlays",
            "Routing in network-on-chip and parallel interconnection networks",
        ],
        references: [
            "Malkhi and Reiter, Viceroy: A Scalable and Dynamic Emulation of the Butterfly, 2002",
            "Leighton, Introduction to Parallel Algorithms and Architectures, Chapter 3",
        ],
        workedExample:
            "With two dimensions and four positions per level, route from key 1 to key 3 (binary 11). Level 0 fixes the low bit by crossing from position 1 to 3; level 1 keeps the high bit at 3. The packet reaches node L2:3 in two hops.",
    },
    id: "viceroy-dht",
    name: "Viceroy DHT Butterfly Routing",
    category: "parallel-distributed",
    complexity: { time: "O(log N) hops", space: "O(N log N)" },
    defaultInput: { dimensions: 2, source: 1, target: 3 },
    visualType: "graph",
    run,
    pseudocode: [
        "place nodes in d plus 1 levels of 2 to the d positions",
        "start at the level zero node for the source key",
        "for each level ell from zero to d minus 1",
        "set bit ell of the position to the target's bit",
        "move straight up or cross one butterfly edge",
        "after d hops the low d bits equal the target key",
        "done: report the path and hop count",
    ],
};

export default module;
