/**
 * tapestry.ts - Tapestry Overlay Routing (Plaxton Mesh)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Tapestry organizes nodes by their identifiers in a Plaxton mesh. Each node
 * keeps, for every digit position, a neighbor whose identifier matches a
 * target in one more leading digit than the current node does. Routing to a
 * target repeatedly hands the message to the neighbor that matches the longest
 * prefix of the target, so the number of hops grows with the identifier length
 * rather than with the size of the network. This module builds that neighbor
 * map from a small node set and routes between every pair of nodes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(L * n) to choose the next hop for L-digit identifiers and n nodes
 *   Space: O(n * L) for the per-digit neighbor maps
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Nodes are placed by the leading digits of their identifiers.
 *   - The current hop is yellow and the already visited hops are green.
 *   - meta carries the path, matched-prefix lengths, and the hop bound.
 *
 * This is a deterministic teaching model over octal-style identifiers of
 * length three. It assumes all nodes are present and healthy; it does not model
 * surrogate routing for missing prefixes, node churn, or network latency.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

interface Input {
    nodes?: string[];
    source?: string;
    target?: string;
}

const DEFAULT_NODES = ["000", "007", "070", "077", "700", "707", "770", "777"];
const DIGITS = 3;

/** Number of leading identifier digits two nodes share. */
function sharedPrefix(a: string, b: string): number {
    let count = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
        if (a[i] !== b[i]) {
            break;
        }
        count += 1;
    }
    return count;
}

/** Numeric value used for deterministic tie-breaking. */
function numericId(id: string): number {
    return parseInt(id, 8);
}

/** One Plaxton hop: take the table entry for the next target digit. */
function nextHop(current: string, target: string, nodes: string[]): string | null {
    const j = sharedPrefix(current, target);
    if (j >= Math.min(current.length, target.length)) {
        return null;
    }
    const wanted = target[j];
    let best: string | null = null;
    for (const candidate of nodes) {
        if (candidate === current || sharedPrefix(candidate, current) < j || candidate[j] !== wanted) {
            continue;
        }
        if (best === null || numericId(candidate) < numericId(best)) {
            best = candidate;
        }
    }
    return best;
}

/** Full route from source to target, or null if it cannot progress. */
function route(source: string, target: string, nodes: string[]): string[] {
    const path = [source];
    let current = source;
    const seen = new Set<string>([source]);
    while (current !== target) {
        const next = nextHop(current, target, nodes);
        if (next === null || seen.has(next)) {
            return path;
        }
        path.push(next);
        seen.add(next);
        current = next;
        if (path.length > nodes.length + 1) {
            return path;
        }
    }
    return path;
}

/** Build node entities positioned by their identifier digits. */
function makeNodes(nodes: string[], path: string[]): VisualEntity[] {
    return nodes.map((id, index) => {
        const position = path.indexOf(id);
        const state: EntityState = position === path.length - 1 && position >= 0
            ? "active"
            : position >= 0
                ? "sorted"
                : "idle";
        const d0 = Number(id[0] ?? 0);
        const d1 = Number(id[1] ?? 0);
        const d2 = Number(id[2] ?? 0);
        return {
            id: `node-${id}`,
            type: "node" as const,
            label: id,
            value: numericId(id),
            state,
            x: d0 * 140,
            y: d1 * 140 + d2 * 40,
            width: 0,
            height: 0,
            metadata: { index, id, hop: position, prefix: sharedPrefix(id, path[path.length - 1] ?? id) },
        };
    });
}

/** Edges for the hops taken so far. */
function makeEdges(path: string[]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 1; i < path.length; i += 1) {
        edges.push({
            id: `hop-${i}-${path[i - 1]}-${path[i]}`,
            sourceId: `node-${path[i - 1]}`,
            targetId: `node-${path[i]}`,
            label: `prefix ${sharedPrefix(path[i] ?? "", path[path.length - 1] ?? "")}`,
            state: i === path.length - 1 ? ("active" as EntityState) : ("path" as EntityState),
            directed: true,
        });
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const provided = Array.isArray(task.nodes) ? task.nodes.filter((id): id is string => typeof id === "string" && /^[0-7]{3}$/.test(id)) : [];
    const nodes = provided.length >= 2 ? [...new Set(provided)] : DEFAULT_NODES;
    const source = typeof task.source === "string" && nodes.includes(task.source) ? task.source : (nodes[0] ?? "000");
    const target = typeof task.target === "string" && nodes.includes(task.target) ? task.target : (nodes[nodes.length - 1] ?? "777");

    const path = route(source, target, nodes);
    const prefixes = path.map((id) => sharedPrefix(id, target));
    const reached = path[path.length - 1] === target;

    const meta = (hopsShown: number, done: boolean) => ({
        digits: DIGITS,
        nodeCount: nodes.length,
        nodes: [...nodes],
        source,
        target,
        path: [...path],
        prefixes,
        hops: Math.max(0, hopsShown - 1),
        hopBound: DIGITS,
        reached,
        prefixStrictlyIncreasing: prefixes.slice(0, hopsShown).every((value, i) => i === 0 || value > (prefixes[i - 1] ?? 0)),
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeNodes(nodes, [source]),
        edges: [],
        description: `Tapestry overlay with ${nodes.length} nodes; routing ${source} to ${target} by matching identifier prefixes.`,
        codeLineNumber: 0,
        layout: "point",
        meta: meta(1, false),
    };

    let step = 1;
    for (let i = 1; i < path.length; i += 1) {
        const shown = path.slice(0, i + 1);
        yield {
            stepNumber: step++,
            entities: makeNodes(nodes, shown),
            edges: makeEdges(shown),
            description: `Hop ${i}: from ${path[i - 1]} to ${path[i]}, which shares ${sharedPrefix(path[i] ?? "", target)} leading digit(s) with ${target}.`,
            codeLineNumber: i === path.length - 1 ? 4 : 3,
            layout: "point",
            meta: meta(i + 1, false),
        };
    }

    yield {
        stepNumber: step,
        entities: makeNodes(nodes, path),
        edges: makeEdges(path),
        description: reached
            ? `Reached ${target} in ${path.length - 1} hop(s), within the ${DIGITS}-digit bound.`
            : `Routing stopped at ${path[path.length - 1]} without reaching ${target}.`,
        codeLineNumber: 6,
        layout: "point",
        meta: meta(path.length, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a library where the shelf location is encoded in the book's label. To find a book you first go to any shelf whose label shares one digit, then one that shares two, and so on, until the whole label matches. Tapestry does exactly this with node identifiers: each hop fixes one more digit of the destination, so the route is short even in a huge network.",
        invariants: [
            "Each hop strictly increases the number of leading identifier digits matching the target.",
            "Every hop ends at a node that exists in the overlay.",
            "A route uses at most as many hops as the identifier has digits.",
        ],
        correctness:
            "At a node with a matched prefix of length j, the routing table contains a neighbor for every possible next digit, so a node whose prefix matches the target in j+1 digits always exists when the target is present. Choosing that neighbor increases the matched prefix by one. After at most L hops, where L is the identifier length, the prefix is the whole identifier and the message is at the target. Because the prefix only grows and a node is visited once, the route cannot cycle.",
        complexityRationale:
            "Finding a next hop scans the n nodes and compares L digits, O(n L) per hop, with at most L hops. Storing one neighbor per digit position at each node uses O(n L) space.",
        uses: [
            "Peer-to-peer lookup services with identifier-based routing",
            "Wide-area decentralized storage and content delivery overlays",
            "Teaching the Plaxton mesh behind Tapestry-style DHTs",
        ],
        references: [
            "Zhao, Kubiatowicz, and Joseph, Tapestry: An Infrastructure for Fault-Tolerant Wide-Area Location and Routing, 2001",
            "Plaxton, Rajaraman, and Richa, Accessing Nearby Copies of Replicated Objects in a Distributed Environment, 1997",
        ],
        workedExample:
            "From 000 to 777 with nodes 000, 007, 070, 077, 700, 707, 770, 777, the first digit is 7 so the first hop goes to 700, the smallest node starting with 7. The next digit is 7, so the route goes to 770, and the final digit sends it to 777. The three hops equal the identifier length.",
    },
    id: "tapestry",
    name: "Tapestry Overlay Routing",
    category: "parallel-distributed",
    complexity: { time: "O(n L) per hop", space: "O(n L)" },
    defaultInput: { nodes: DEFAULT_NODES, source: "000", target: "777" },
    visualType: "point",
    run,
    pseudocode: [
        "assign each node a fixed-length digit identifier",
        "for each position keep neighbors matching every digit",
        "at a node count the prefix shared with the target",
        "choose the neighbor that shares the longest prefix",
        "forward the message to that neighbor and repeat",
        "stop when the full identifier matches the target",
        "verify the number of hops is at most the identifier length",
        "done: report the route and matched-prefix lengths",
    ],
};

export default module;
