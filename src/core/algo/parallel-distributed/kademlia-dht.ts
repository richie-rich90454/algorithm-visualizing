/**
 * kademlia-dht.ts - Kademlia XOR Distance and Iterative Node Lookup
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Kademlia organizes a peer-to-peer overlay by a XOR distance metric and keeps
 * a routing table of k-buckets: one bucket per bit position, each holding up to
 * k peers whose identifiers share a prefix with the owner. A lookup for a
 * target id iteratively queries the closest known peers, absorbs the peers they
 * return, and stops when the closest candidates have all been contacted. The
 * result is the k peers with the smallest XOR distance to the target.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(q * (n + k)) for q queried peers in an overlay of n nodes
 *   Space: O(n * k) for all routing tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Overlay peers are graph nodes; a query is a directed edge.
 *   - The initiating peer is highlighted, queried peers are marked visited,
 *     and the k closest peers found are green in the final frame.
 *   - Metadata reports the target, the result ids, and their XOR distances.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface KademliaInput {
    ids?: number[];
    target?: number;
    source?: number;
    k?: number;
    alpha?: number;
    bitWidth?: number;
}

interface QueryEvent {
    queried: number;
    discovered: number[];
}

function xorDistance(a: number, b: number): number {
    return (a ^ b) >>> 0;
}

function bucketOf(a: number, b: number, bitWidth: number): number {
    const d = xorDistance(a, b);
    if (d === 0) return 0;
    return Math.min(bitWidth - 1, Math.floor(Math.log2(d)));
}

/** Keep up to k closest peers per XOR bucket of the owner. */
function buildTable(owner: number, all: number[], k: number, bitWidth: number): Map<number, number[]> {
    const buckets = new Map<number, number[]>();
    for (const peer of all) {
        if (peer === owner) continue;
        const b = bucketOf(owner, peer, bitWidth);
        const list = buckets.get(b) ?? [];
        list.push(peer);
        buckets.set(b, list);
    }
    for (const [b, list] of buckets) {
        list.sort((x, y) => xorDistance(owner, x) - xorDistance(owner, y));
        buckets.set(b, list.slice(0, k));
    }
    return buckets;
}

function flattenTable(table: Map<number, number[]>): number[] {
    const result: number[] = [];
    for (const list of table.values()) result.push(...list);
    return result;
}

function closestKnown(known: Iterable<number>, target: number, k: number): number[] {
    return [...new Set(known)]
        .sort((a, b) => xorDistance(a, target) - xorDistance(b, target))
        .slice(0, k);
}

/** Normalize the overlay into unique masked ids plus the query parameters. */
function normalize(input: unknown) {
    const task = (input as KademliaInput | null) ?? {};
    const bitWidth = Math.min(16, Math.max(2, Math.floor(Number(task.bitWidth ?? 8)) || 8));
    const mask = bitWidth >= 32 ? 0xffffffff : (1 << bitWidth) - 1;
    const raw = Array.isArray(task.ids) ? task.ids : [1, 7, 12, 40, 90, 130, 200, 255];
    const ids = [...new Set(raw.map((v) => Math.abs(Math.floor(Number(v) || 0)) & mask))]
        .sort((a, b) => a - b)
        .slice(0, 16);
    if (ids.length === 0) ids.push(0);
    const target = Math.abs(Math.floor(Number(task.target ?? 77) || 0)) & mask;
    const source = ids.includes(Number(task.source)) ? Number(task.source) : ids[0]!;
    const k = Math.min(ids.length, Math.max(1, Math.floor(Number(task.k ?? 2)) || 2));
    const alpha = Math.max(1, Math.floor(Number(task.alpha ?? 2)) || 2);
    return { ids, target, source, k, alpha, bitWidth };
}

/** Run the iterative lookup and record one event per batch of queries. */
function lookup(all: number[], tables: Map<number, Map<number, number[]>>, target: number, source: number, k: number, alpha: number) {
    const queried = new Set<number>();
    const discovered = new Set<number>(flattenTable(tables.get(source) ?? new Map()));
    discovered.add(source);
    const events: QueryEvent[] = [];

    for (let guard = 0; guard < all.length + 2; guard += 1) {
        const frontier = [...discovered]
            .filter((n) => !queried.has(n))
            .sort((a, b) => xorDistance(a, target) - xorDistance(b, target))
            .slice(0, alpha);
        if (frontier.length === 0) break;
        for (const peer of frontier) {
            queried.add(peer);
            const around = new Set(flattenTable(tables.get(peer) ?? new Map()));
            around.add(peer);
            const returned = closestKnown(around, target, k);
            const fresh: number[] = [];
            for (const node of returned) {
                if (!discovered.has(node)) {
                    discovered.add(node);
                    fresh.push(node);
                }
            }
            events.push({ queried: peer, discovered: fresh });
        }
    }

    const result = closestKnown(discovered, target, k);
    return { result, queried: [...queried], discovered: [...discovered], events };
}

function makeEntities(
    all: number[],
    source: number,
    queried: Set<number>,
    result: Set<number>,
    current: number | null,
    bitWidth: number,
): VisualEntity[] {
    return all.map((id, index) => {
        let state: EntityState = "idle";
        if (result.has(id)) state = "sorted";
        else if (current === id) state = "active";
        else if (queried.has(id)) state = "visited";
        else if (source === id) state = "pivot";
        return {
            id: `node-${id}`,
            type: "node" as const,
            label: String(id),
            value: id,
            state,
            x: index,
            y: bucketOf(source, id, bitWidth) % 2,
            width: 0,
            height: 0,
            metadata: { id, bucket: bucketOf(source, id, bitWidth), role: id === source ? "source" : "peer" },
        };
    });
}

function makeEdges(events: QueryEvent[], upto: number, source: number): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 0; i <= upto && i < events.length; i += 1) {
        const event = events[i]!;
        if (event.queried === source) continue;
        edges.push({
            id: `query-${i}-${event.queried}`,
            sourceId: `node-${source}`,
            targetId: `node-${event.queried}`,
            label: `k=${event.discovered.length}`,
            state: "active",
            directed: true,
        });
    }
    return edges;
}

/** The Kademlia lookup generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const { ids, target, source, k, alpha, bitWidth } = normalize(input);
    const tables = new Map<number, Map<number, number[]>>();
    for (const id of ids) tables.set(id, buildTable(id, ids, k, bitWidth));
    const outcome = lookup(ids, tables, target, source, k, alpha);
    const resultSet = new Set(outcome.result);
    const queriedSoFar = new Set<number>();

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(ids, source, queriedSoFar, new Set(), null, bitWidth),
        edges: [],
        description: `Overlay of ${ids.length} peers; peer ${source} looks up the ${k} closest peers to target ${target} under XOR distance.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: {
            source,
            target,
            k,
            alpha,
            bitWidth,
            result: [],
            resultDistances: [],
            queried: [],
            discovered: [source],
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(ids, source, queriedSoFar, new Set(), null, bitWidth),
        edges: [],
        description: `Routing tables built: each peer keeps up to ${k} closest contacts per XOR bucket (${bitWidth} buckets).`,
        codeLineNumber: 1,
        layout: "graph",
        meta: {
            source,
            target,
            k,
            alpha,
            bitWidth,
            result: [],
            resultDistances: [],
            queried: [],
            discovered: [source],
            tableSize: flattenTable(tables.get(source) ?? new Map()).length,
        },
    };
    step += 1;

    for (let i = 0; i < outcome.events.length; i += 1) {
        const event = outcome.events[i]!;
        queriedSoFar.add(event.queried);
        yield {
            stepNumber: step,
            entities: makeEntities(ids, source, queriedSoFar, new Set(), event.queried, bitWidth),
            edges: makeEdges(outcome.events, i, source),
            description: `Query peer ${event.queried}: it returned ${event.discovered.length} new closer contact(s).`,
            codeLineNumber: 2,
            layout: "graph",
            meta: {
                source,
                target,
                k,
                alpha,
                bitWidth,
                result: [],
                resultDistances: [],
                queried: [...queriedSoFar],
                discovered: [],
                lastQuery: event.queried,
                newContacts: event.discovered,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(ids, source, queriedSoFar, resultSet, null, bitWidth),
        edges: makeEdges(outcome.events, outcome.events.length - 1, source),
        description: `Lookup complete: ${outcome.result.join(", ") || "no peers"} are the ${resultSet.size} closest to ${target} (XOR distances listed).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: {
            source,
            target,
            k,
            alpha,
            bitWidth,
            result: [...outcome.result],
            resultDistances: outcome.result.map((id) => xorDistance(id, target)),
            queried: outcome.queried,
            discovered: outcome.discovered,
            done: true,
        },
    };
}

/** The Kademlia DHT module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Give every peer an identifier and measure closeness by XOR, which makes peers that share a long binary prefix close together. Each peer keeps k-buckets of contacts at each bit distance. To find a target, ask the closest peers you know; each reply reveals peers even closer, so the search homes in on the target without any global map.",
        invariants: [
            "XOR distance is symmetric: distance(a,b) equals distance(b,a).",
            "A k-bucket for bit i holds only peers whose XOR distance to its owner has leading bit i.",
            "The discovered set only grows, and a queried peer is never queried twice.",
        ],
        correctness:
            "Because XOR distance is a metric on identifiers and every reply contains the closest contacts known to the queried peer, each round strictly expands the set of discovered peers with nodes no farther from the target. When the closest known peers have all been queried, no unqueried peer can be closer than the result, so the returned set is the k nearest peers under XOR distance.",
        complexityRationale:
            "Each of the q queries scans a routing table of at most n peers and keeps the k closest, costing O(q times (n + k)) time. Storing k-buckets for every peer uses O(n times k) space.",
        uses: [
            "Peer-to-peer file sharing overlays such as BitTorrent's DHT",
            "Distributed key-value stores and content-addressed networks",
            "Decentralized service discovery without a central registry",
        ],
        references: [
            "Maymounkov and Mazieres, Kademlia: A Peer-to-Peer Information System Based on the XOR Metric, 2002",
            "Balakrishnan et al., Looking up nodes in structured overlays, 2005",
        ],
        workedExample:
            "With peers 1, 7, 12, 40, 90, 130, 200, 255 and target 77, peer 1 first asks its closest contacts under XOR. Their replies reveal peers sharing more leading bits with 77, and the search converges on the peers with the smallest XOR distances to 77.",
    },
    id: "kademlia-dht",
    name: "Kademlia DHT",
    category: "parallel-distributed",
    complexity: { time: "O(q * (n + k))", space: "O(n * k)" },
    defaultInput: {
        ids: [1, 7, 12, 40, 90, 130, 200, 255],
        target: 77,
        k: 2,
        alpha: 2,
        bitWidth: 8,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "assign each peer a fixed-width binary identifier",
        "build k-buckets of closest contacts for every peer",
        "seed candidates from the initiating peer's buckets",
        "query the closest unqueried peers, alpha at a time",
        "absorb the closest contacts returned by each peer",
        "repeat until the closest candidates are all queried",
        "done: return the k peers nearest the target in XOR distance",
    ],
};

export default module;
