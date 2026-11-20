/**
 * consistent-hashing-with-bounded-loads.ts - Consistent Hashing With Bounded Loads
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Classic consistent hashing maps a key to the first node clockwise on a hash
 * ring. That can leave one node holding far more keys than its neighbors. The
 * bounded-load variant gives each node a capacity; a key walks clockwise from
 * its hash to the first node that still has room. Adding or removing a node
 * disturbs only keys in the adjacent arc, while no node exceeds its capacity.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n + k * n) for n ring nodes and k keys with a linear scan
 *   Space: O(n + k) for the ring, keys, and assignment table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Ring nodes sit on the unit circle; keys sit just inside it.
 *   - An edge links each key to the node it was assigned to.
 *   - The highlighted edge is the assignment made in the current step.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface NodeSpec {
    id: string;
    position: number;
}
interface KeySpec {
    id: string;
    hash: number;
}

/** Assign each key to the first clockwise node with spare capacity. */
function assign(nodes: NodeSpec[], keys: KeySpec[], capacity: number): Map<string, string> {
    const ring = [...nodes].sort((a, b) => a.position - b.position);
    const load = new Map<string, number>();
    for (const node of ring) {
        load.set(node.id, 0);
    }
    const result = new Map<string, string>();
    const ordered = [...keys].sort((a, b) => a.hash - b.hash);
    for (const key of ordered) {
        let start = ring.findIndex((node) => node.position >= key.hash);
        if (start === -1) {
            start = 0;
        }
        for (let step = 0; step < ring.length; step += 1) {
            const candidate = ring[(start + step) % ring.length] as NodeSpec;
            if ((load.get(candidate.id) ?? 0) < capacity) {
                result.set(key.id, candidate.id);
                load.set(candidate.id, (load.get(candidate.id) ?? 0) + 1);
                break;
            }
        }
    }
    return result;
}

/** Build ring-node and key entities plus assignment edges for one frame. */
function makeFrame(
    step: number,
    nodes: NodeSpec[],
    keys: KeySpec[],
    assignment: Map<string, string>,
    upto: number,
    capacity: number,
): VisualFrame {
    const entities: VisualEntity[] = [];
    for (const node of nodes) {
        const load = [...assignment.values()].filter((id) => id === node.id).length;
        entities.push({
            id: `node-${node.id}`,
            type: "node",
            label: `${node.id} (${load}/${capacity})`,
            value: node.position,
            state: load >= capacity ? "error" : "sorted",
            x: Math.cos(2 * Math.PI * node.position),
            y: Math.sin(2 * Math.PI * node.position),
            width: 0,
            height: 0,
            metadata: { kind: "node", position: node.position, load },
        });
    }
    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i] as KeySpec;
        const placed = i <= upto;
        entities.push({
            id: `key-${key.id}`,
            type: "node",
            label: key.id,
            value: key.hash,
            state: i === upto ? "comparing" : placed ? "visited" : "idle",
            x: 0.78 * Math.cos(2 * Math.PI * key.hash),
            y: 0.78 * Math.sin(2 * Math.PI * key.hash),
            width: 0,
            height: 0,
            metadata: { kind: "key", hash: key.hash },
        });
    }
    const edges: VisualEdge[] = [];
    const ordered = [...keys].sort((a, b) => a.hash - b.hash);
    for (let i = 0; i < ordered.length && i <= upto; i += 1) {
        const key = ordered[i] as KeySpec;
        const node = assignment.get(key.id);
        if (node === undefined) {
            continue;
        }
        edges.push({
            id: `assign-${key.id}`,
            sourceId: `key-${key.id}`,
            targetId: `node-${node}`,
            label: "",
            state: i === upto ? "active" : "visited",
            directed: true,
        });
    }
    const loads: Record<string, number> = {};
    for (const node of nodes) {
        loads[node.id] = [...assignment.values()].filter((id) => id === node.id).length;
    }
    return {
        stepNumber: step,
        entities,
        edges,
        description:
            upto < 0
                ? `Hash ring with ${nodes.length} node(s), each of capacity ${capacity}; ${keys.length} keys await placement.`
                : `Key ${ordered[upto]?.id ?? ""} (hash ${(ordered[upto]?.hash ?? 0).toFixed(3)}) assigned to node ${assignment.get(ordered[upto]?.id ?? "") ?? "none"}.`,
        codeLineNumber: upto < 0 ? 0 : 2,
        layout: "point",
        meta: {
            nodes: nodes.map((n) => n.id),
            positions: nodes.map((n) => n.position),
            capacity,
            loads: JSON.stringify(loads),
            assigned: JSON.stringify([...assignment.entries()]),
            keys: keys.map((k) => k.id),
        },
    };
}

/** The bounded-load consistent hashing generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { nodes?: NodeSpec[]; keys?: KeySpec[]; capacity?: number } | null
    ) ?? {};
    const nodes: NodeSpec[] = Array.isArray(task.nodes)
        ? task.nodes.map((n, i) => ({ id: String(n.id ?? i), position: ((Number(n.position) % 1) + 1) % 1 }))
        : [
              { id: "A", position: 0.1 },
              { id: "B", position: 0.45 },
              { id: "C", position: 0.8 },
          ];
    const keys: KeySpec[] = Array.isArray(task.keys)
        ? task.keys.map((k, i) => ({ id: String(k.id ?? i), hash: ((Number(k.hash) % 1) + 1) % 1 }))
        : [0.05, 0.2, 0.3, 0.5, 0.6, 0.7, 0.85, 0.95].map((h, i) => ({ id: `k${i}`, hash: h }));
    const capacity = Math.max(1, Math.floor(Number(task.capacity ?? 3)) || 3);

    const finalAssignment = assign(nodes, keys, capacity);
    const ordered = [...keys].sort((a, b) => a.hash - b.hash);
    let step = 0;
    yield makeFrame(step, nodes, keys, new Map(), -1, capacity);
    step += 1;

    for (let i = 0; i < ordered.length; i += 1) {
        const partial = new Map<string, string>();
        for (let j = 0; j <= i; j += 1) {
            const key = ordered[j] as KeySpec;
            const node = finalAssignment.get(key.id);
            if (node !== undefined) {
                partial.set(key.id, node);
            }
        }
        yield makeFrame(step, nodes, keys, partial, i, capacity);
        step += 1;
    }

    const frame = makeFrame(step, nodes, keys, finalAssignment, ordered.length - 1, capacity);
    frame.description = `Placement complete: ${finalAssignment.size}/${keys.length} keys placed; no node exceeds capacity ${capacity}.`;
    frame.codeLineNumber = 5;
    yield frame;
}

/** The bounded-load consistent hashing module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Picture servers as points on a circle and keys as points on the same circle. A key normally goes to the first server clockwise, but each server may hold only a fixed number of keys. When that server is full, the key keeps walking clockwise until it finds one with room, so the work spreads evenly without scrambling the whole mapping.",
        invariants: [
            "A key is always assigned to a node at or after its hash in clockwise order, wrapping at the end of the ring.",
            "No node is assigned more than its capacity.",
            "Keys are processed in hash order so the assignment is deterministic.",
        ],
        correctness:
            "Processing keys in a fixed order and always choosing the first available clockwise node makes the assignment a deterministic greedy first-fit. A node is used only while its count is below capacity, so the load bound holds by construction. Because every candidate is examined in clockwise order, a key moves to a different node only when all nearer nodes are full, which is exactly what keeps disruption local when the ring changes.",
        complexityRationale:
            "Sorting n nodes and k keys costs O(n log n + k log k). For each key the scan visits at most n nodes, giving O(k n) assignment time and O(n + k) space for the ring, keys, and result table. Production systems replace the linear scan with an ordered map for logarithmic lookup.",
        uses: [
            "Sharding keys across cache nodes in a distributed hash table",
            "Load-balanced request routing in content delivery networks",
            "Partition placement in distributed storage systems",
        ],
        references: [
            "Karger et al., Consistent Hashing and Random Trees, 1997",
            "Mirror et al., Consistent Hashing with Bounded Loads, 2017",
        ],
        workedExample:
            "With nodes A at 0.1, B at 0.45, C at 0.8, capacity 2, and keys at 0.05, 0.2, 0.3, 0.5, 0.6, 0.85, the first three keys go to A and B, key 0.5 and 0.6 go to C, and key 0.85 wraps to A only if it has room. Once A and C are full, later keys skip them and land on the next node with capacity.",
    },
    id: "consistent-hashing-with-bounded-loads",
    name: "Consistent Hashing With Bounded Loads",
    category: "parallel-distributed",
    complexity: { time: "O(n log n + k * n)", space: "O(n + k)" },
    defaultInput: {
        nodes: [
            { id: "A", position: 0.1 },
            { id: "B", position: 0.45 },
            { id: "C", position: 0.8 },
        ],
        keys: [0.05, 0.2, 0.3, 0.5, 0.6, 0.7, 0.85, 0.95].map((hash, i) => ({ id: `k${i}`, hash })),
        capacity: 3,
    },
    visualType: "point",
    run,
    pseudocode: [
        "place each node at its position on the hash ring",
        "sort the keys by their hash value",
        "for each key in hash order",
        "walk clockwise to the first node below capacity",
        "assign the key to that node and increment its load",
        "done: report every key assignment and final loads",
    ],
};

export default module;
