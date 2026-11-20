/**
 * pastry-dht.ts - Pastry Distributed Hash Table Routing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Pastry assigns every node and every key an identifier in a circular space.
 * Node ids are written as a fixed number of base-b digits. Each node keeps a
 * routing table indexed by prefix length and next digit, plus a leaf set of the
 * numerically closest nodes. To route a key, a node forwards the message to a
 * peer that shares one more leading digit with the key whenever such a peer
 * exists; when the prefix can no longer be extended it forwards to the leaf
 * whose id is numerically closest to the key. Each hop fixes at least one more
 * digit or lands closer in the leaf set, so the message reaches the node with
 * the closest id to the key in O(log of the id space) hops.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log_b N) routing hops for N nodes
 *   Space: O((b-1) * 2^b + L) per node for the table and leaf set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are peers on a circle, labeled with their base-4 ids.
 *   - GREEN marks the node closest to the key, amber the current hop.
 *   - meta carries the key, current node, path, and hop count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

interface Input {
    nodes?: number[];
    key?: number;
    start?: number;
}

const BASE = 4;
const DIGITS = 4;
const SPACE = BASE ** DIGITS;
const LEAF = 8;

const defaultNodes = [3, 18, 37, 62, 91, 118, 140, 166, 191, 214, 238, 251];

function digitsOf(id: number): number[] {
    const out: number[] = [];
    let x = ((id % SPACE) + SPACE) % SPACE;
    for (let i = DIGITS - 1; i >= 0; i -= 1) {
        out[i] = x % BASE;
        x = Math.floor(x / BASE);
    }
    return out;
}

function digitAt(id: number, pos: number): number {
    return digitsOf(id)[pos] ?? 0;
}

function commonPrefix(a: number, b: number): number {
    const da = digitsOf(a);
    const db = digitsOf(b);
    let p = 0;
    while (p < DIGITS && da[p] === db[p]) p += 1;
    return p;
}

function circularDist(a: number, b: number): number {
    const d = Math.abs(a - b) % SPACE;
    return Math.min(d, SPACE - d);
}

function closestTo(target: number, nodes: number[]): number {
    let best = nodes[0]!;
    let bestD = circularDist(best, target);
    for (const n of nodes) {
        const d = circularDist(n, target);
        if (d < bestD || (d === bestD && n < best)) {
            best = n;
            bestD = d;
        }
    }
    return best;
}

interface Tables {
    routing: Map<number, Array<Array<number | null>>>;
    leaves: Map<number, number[]>;
}

function buildTables(nodes: number[]): Tables {
    const routing = new Map<number, Array<Array<number | null>>>();
    const leaves = new Map<number, number[]>();
    for (const n of nodes) {
        const table: Array<Array<number | null>> = [];
        for (let pos = 0; pos < DIGITS; pos += 1) {
            const row: Array<number | null> = [];
            for (let d = 0; d < BASE; d += 1) {
                let best: number | null = null;
                let bestDist = Infinity;
                for (const m of nodes) {
                    if (m === n) continue;
                    let matches = true;
                    for (let p = 0; p < pos; p += 1) {
                        if (digitAt(m, p) !== digitAt(n, p)) {
                            matches = false;
                            break;
                        }
                    }
                    if (matches && digitAt(m, pos) === d && circularDist(m, n) < bestDist) {
                        best = m;
                        bestDist = circularDist(m, n);
                    }
                }
                row.push(best);
            }
            table.push(row);
        }
        routing.set(n, table);
        const sorted = [...nodes].filter((m) => m !== n).sort((x, y) => circularDist(x, n) - circularDist(y, n) || x - y);
        leaves.set(n, sorted.slice(0, LEAF));
    }
    return { routing, leaves };
}

function routePath(nodes: number[], key: number, start: number, tables: Tables): number[] {
    const target = closestTo(key, nodes);
    let cur = nodes.includes(start) ? start : nodes[0]!;
    const path: number[] = [cur];
    const maxHops = DIGITS + LEAF + 4;
    for (let hop = 0; hop < maxHops && cur !== target; hop += 1) {
        const prefix = commonPrefix(cur, key);
        let next: number | null = null;
        if (prefix < DIGITS) next = tables.routing.get(cur)?.[prefix]?.[digitAt(key, prefix)] ?? null;
        if (next === null || next === cur) next = closestTo(key, tables.leaves.get(cur) ?? nodes);
        if (next === null || next === cur) break;
        cur = next;
        path.push(cur);
    }
    return path;
}

function nodePosition(id: number): [number, number] {
    const angle = (2 * Math.PI * id) / SPACE - Math.PI / 2;
    return [Math.round(210 * Math.cos(angle)), Math.round(210 * Math.sin(angle))];
}

function makeNodes(nodes: number[], cur: number, target: number): VisualEntity[] {
    return nodes.map((n, i) => {
        const [x, y] = nodePosition(n);
        const state: EntityState = n === target ? "sorted" : n === cur ? "active" : "idle";
        return {
            id: `node-${n}`,
            type: "node" as const,
            label: n.toString(BASE).padStart(DIGITS, "0"),
            value: n,
            state,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { id: n, index: i, current: n === cur, target: n === target },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const nodes: number[] = Array.isArray(task.nodes) && task.nodes.length >= 2
        ? [...new Set(task.nodes.map((v) => ((Math.floor(v) % SPACE) + SPACE) % SPACE))]
        : [...defaultNodes];
    nodes.sort((a, b) => a - b);
    const key = ((Math.floor(task.key ?? 100) % SPACE) + SPACE) % SPACE;
    const start = Math.floor(task.start ?? nodes[0] ?? 0);
    const tables = buildTables(nodes);
    const target = closestTo(key, nodes);
    const path = routePath(nodes, key, start, tables);
    let step = 0;

    const meta = (index: number, last: string) => ({
        nodes: [...nodes],
        key,
        keyDigits: digitsOf(key).join(""),
        current: path[Math.min(index, path.length - 1)]!,
        target,
        path: [...path],
        hops: Math.max(0, Math.min(index, path.length - 1)),
        last,
    });

    yield {
        stepNumber: step++,
        entities: makeNodes(nodes, path[0]!, target),
        edges: [],
        description: `Pastry overlay with ${nodes.length} nodes; route key ${key} (base-4 ${digitsOf(key).join("")}) from node ${path[0]}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: meta(0, "initialized"),
    };

    for (let i = 1; i < path.length; i += 1) {
        const from = path[i - 1]!;
        const to = path[i]!;
        const prefix = commonPrefix(from, key);
        const desc = `Hop ${i}: node ${from} forwards toward ${to}; shared prefix with key grew to ${commonPrefix(to, key)} digit(s).`;
        yield {
            stepNumber: step++,
            entities: makeNodes(nodes, to, target),
            edges: [{
                id: `hop-${i}`,
                sourceId: `node-${from}`,
                targetId: `node-${to}`,
                label: String(prefix),
                state: "active",
                directed: true,
            }],
            description: desc,
            codeLineNumber: 2,
            layout: "point",
            meta: meta(i, desc),
        };
    }

    const arrived = path[path.length - 1] === target;
    const done = arrived
        ? `Reached node ${target}, whose id is numerically closest to key ${key} in ${path.length - 1} hop(s).`
        : `Routing stopped at node ${path[path.length - 1]}; closest is ${target}.`;
    yield {
        stepNumber: step,
        entities: makeNodes(nodes, target, target),
        edges: [],
        description: done,
        codeLineNumber: 5,
        layout: "point",
        meta: meta(path.length - 1, done),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of each node's id as a string of digits and the key as another such string. Starting from some node, Pastry hands the message to a peer that matches one more leading digit of the key, like narrowing a phone prefix. When no peer extends the prefix, it hands the message to the numerically nearest neighbor. Every step either fixes another digit or closes the remaining numeric gap, so the message quickly homes in on the node whose id is closest to the key.",
        invariants: [
            "Each routing-table entry shares the current prefix and the requested next digit.",
            "A successful prefix hop increases the shared prefix with the key by at least one.",
            "When the prefix cannot grow, the leaf set contains a node at least as close to the key.",
        ],
        correctness:
            "At a node whose id shares p leading digits with the key, the routing-table row p holds, for the key's next digit, a node sharing the first p digits of the current node and that exact next digit, hence sharing p+1 digits with the key. Therefore a prefix hop strictly increases the matched prefix. If no such entry exists, the leaf set contains the numerically nearest nodes, and forwarding to the leaf closest to the key strictly reduces circular distance unless the current node is already closest. Since the prefix is bounded and the distance strictly decreases in the leaf phase, the route terminates at the node with minimum circular id distance to the key.",
        complexityRationale:
            "Each prefix hop fixes one of the DIGITS base-b digits, so at most DIGITS = log_b of the id space prefix hops are needed, plus O(1) leaf hops, giving O(log_b N) expected routing. Each node stores (b-1) entries per digit position plus a constant-size leaf set, O(b * 2^b + L) space.",
        uses: [
            "Peer-to-peer lookup and content-addressed storage overlays",
            "Locating the replica responsible for a key in a distributed key-value store",
            "Application-level routing in decentralised file-sharing networks",
        ],
        references: [
            "Rowstron and Druschel, Pastry: Scalable, Decentralized Object Location and Routing, 2001",
            "Balakrishnan and Karger, Looking Up Data in P2P Systems, 2003",
        ],
        workedExample:
            "With base-4 ids 03, 12, 33 and key 30, node 03 shares no leading digit with the key, so it uses its routing-table entry whose first digit is 3 and forwards to node 33. Node 33 now shares the first digit 3 with key 30; no entry extends the second digit, so it consults its leaf set and stops at 33, the node closest to the key.",
    },
    id: "pastry-dht",
    name: "Pastry DHT Routing",
    category: "parallel-distributed",
    complexity: { time: "O(log N) hops", space: "O(b * 2^b + L)" },
    defaultInput: { nodes: defaultNodes, key: 100, start: 3 },
    visualType: "point",
    run,
    pseudocode: [
        "write node and key ids as fixed base-b digit strings",
        "build each node's prefix routing table and leaf set",
        "set the current node to the start peer",
        "while the current node is not the closest to the key",
        "if a routing entry extends the key's matched prefix, use it",
        "otherwise forward to the leaf closest to the key",
        "append the hop and continue",
        "done: report the closest node and hop count",
    ],
};

export default module;
