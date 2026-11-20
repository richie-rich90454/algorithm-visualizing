/**
 * bit-slice-tree.ts - Bit-Slice Tree (Multi-bit Trie)
 *
 * A bit-slice tree groups several key bits into each trie level. Instead of
 * branching on one bit at a time, a node of stride s selects one of 2^s
 * children using the next s bits of the key. Longest-prefix matching walks the
 * tree and remembers the most specific prefix seen, which is how IP routers
 * find the best routing entry. Larger strides trade table size for fewer
 * memory lookups.
 *
 * Time:  O(W / s + p) for W-bit keys, prefix count p at visited nodes
 * Space: O(total prefix bits / s)
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface SliceNode {
    id: number;
    children: Map<number, SliceNode>;
    prefixes: Array<{ value: number; length: number }>;
    chunk: number; // bits used to reach this node from its parent
}

/** Top `length` bits of value equal top `length` bits of query. */
function prefixMatches(value: number, length: number, query: number, width: number): boolean {
    if (length === 0) return true;
    const shift = width - length;
    return ((value >>> shift) & ((1 << length) - 1)) === ((query >>> shift) & ((1 << length) - 1));
}

/** Longest-prefix result: { value, length } or null when nothing matches. */
export function lookup(
    root: SliceNode,
    query: number,
    width: number,
    slice: number,
): { value: number; length: number } | null {
    let node = root;
    let depth = 0;
    let best: { value: number; length: number } | null = null;
    while (node && depth <= width) {
        for (const prefix of node.prefixes) {
            if (prefixMatches(prefix.value, prefix.length, query, width)) {
                if (!best || prefix.length > best.length) best = { ...prefix };
            }
        }
        if (depth >= width) break;
        const take = Math.min(slice, width - depth);
        const shift = width - depth - take;
        const chunk = (query >>> shift) & ((1 << take) - 1);
        const next = node.children.get(chunk);
        if (!next) break;
        node = next;
        depth += take;
    }
    return best;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { width?: number; slice?: number; prefixes?: unknown[]; query?: number } | null) ?? {};
    const width = typeof task.width === "number" ? Math.max(1, Math.floor(task.width)) : 8;
    const slice = typeof task.slice === "number" ? Math.max(1, Math.min(width, Math.floor(task.slice))) : 2;
    const raw = Array.isArray(task.prefixes) ? task.prefixes : [[0, 2], [16, 4], [18, 6], [128, 1]];
    const prefixes = raw
        .filter((p): p is [number, number] =>
            Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number" &&
            p[1] >= 0 && p[1] <= width,
        )
        .map(([value, length]) => [value & ((1 << width) - 1), length] as [number, number]);
    const query = typeof task.query === "number" ? task.query & ((1 << width) - 1) : 19;

    let nextId = 0;
    const make = (chunk: number): SliceNode => ({ id: nextId++, children: new Map(), prefixes: [], chunk });
    const root = make(0);
    for (const [value, length] of prefixes) {
        let node = root;
        const levels = Math.floor(length / slice);
        for (let level = 0; level < levels; level += 1) {
            const pos = level * slice;
            const shift = width - pos - slice;
            const chunk = (value >>> shift) & ((1 << slice) - 1);
            let child = node.children.get(chunk);
            if (!child) {
                child = make(chunk);
                node.children.set(chunk, child);
            }
            node = child;
        }
        node.prefixes.push({ value, length });
    }

    let step = 0;
    let path = new Set<number>([root.id]);
    let bestId = -1;

    const collect = (): SliceNode[] => {
        const all: SliceNode[] = [];
        const walk = (node: SliceNode): void => {
            all.push(node);
            for (const child of node.children.values()) walk(child);
        };
        walk(root);
        return all;
    };

    const snapshot = (message: string, line: number, answer: string): VisualFrame => {
        const all = collect();
        const parentOf = new Map<number, string>();
        for (const node of all) {
            for (const child of node.children.values()) parentOf.set(child.id, `bs-${node.id}`);
        }
        const entities: VisualEntity[] = all.map((node) => ({
            id: `bs-${node.id}`,
            type: "node" as const,
            label: node.id === root.id ? "root" : `${node.chunk}`,
            value: node.prefixes.length,
            state: (node.id === bestId ? "highlight" : path.has(node.id) ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parentOf.get(node.id) ?? "root", prefixes: node.prefixes.length },
        }));
        const edges: VisualEdge[] = [];
        for (const node of all) {
            for (const [chunk, child] of node.children) {
                edges.push({
                    id: `bs-${node.id}-${child.id}`,
                    sourceId: `bs-${node.id}`,
                    targetId: `bs-${child.id}`,
                    label: String(chunk),
                    state: "idle" as EntityState,
                    directed: true,
                });
            }
        }
        return {
            stepNumber: step,
            entities,
            edges,
            description: message,
            codeLineNumber: line,
            layout: "tree",
            meta: { width, slice, prefixes: prefixes.length, answer },
        };
    };

    yield snapshot(`Built a stride-${slice} bit-slice tree over ${prefixes.length} prefix(es).`, 0, "pending");
    step += 1;

    let node = root;
    let depth = 0;
    let best = lookup(root, query, width, slice);
    path = new Set([root.id]);
    yield snapshot(`Query key ${query} (${query.toString(2).padStart(width, "0")}): start at root.`, 3, "pending");
    step += 1;
    while (node && depth <= width) {
        for (const prefix of node.prefixes) {
            if (prefixMatches(prefix.value, prefix.length, query, width)) {
                if (!best || prefix.length > best.length) best = { value: prefix.value, length: prefix.length };
            }
        }
        bestId = -1;
        for (const cand of node.prefixes) {
            if (best && cand.value === best.value && cand.length === best.length) bestId = node.id;
        }
        if (depth >= width) break;
        const take = Math.min(slice, width - depth);
        const shift = width - depth - take;
        const chunk = (query >>> shift) & ((1 << take) - 1);
        const next = node.children.get(chunk);
        if (!next) break;
        node = next;
        path = new Set([...path, node.id]);
        yield snapshot(`Slice bits [${depth}, ${depth + take}) = ${chunk}: descend to child.`, 4, "pending");
        step += 1;
        depth += take;
    }

    const answer = best ? `${best.value}/${best.length}` : "none";
    yield snapshot(
        `Done: longest matching prefix is ${answer} with ${slice} bits per level.`,
        7,
        answer,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A bit-slice tree reads a group of key bits at once instead of one bit per level. With stride s each node has up to 2^s children selected by the next s bits, so a lookup touches about W/s nodes. Routers use this trade of extra table entries for fewer memory accesses when doing longest-prefix matching.",
        invariants: [
            "Each edge consumes exactly one slice of key bits, except possibly a shorter final slice.",
            "A prefix is stored at the deepest node whose path matches its leading bits.",
            "Along any search path, stored prefixes are visited in increasing specificity.",
        ],
        correctness:
            "Traversing by consecutive bit slices reconstructs the key's leading bits at each depth, so a stored prefix matches exactly when its leading bits equal the query's. Keeping the matching prefix with the greatest length therefore returns the longest prefix, and an absent child means no longer prefix can match.",
        complexityRationale:
            "A query descends W/s levels plus time to inspect prefixes at visited nodes, so O(W/s + p). Storage is one node per distinct slice path, bounded by the total number of prefix bits divided by the stride.",
        uses: [
            "IP longest-prefix forwarding tables",
            "Multi-bit tries in high-speed routers",
            "Fixed-stride indexes over machine words",
        ],
        references: [
            "Keith Sklower, 'A Tree-based Routing Table for Berkeley Unix', 1993",
            "Srihari Seshan et al., 'Fast IP Lookups', SIGCOMM 1997",
        ],
        workedExample:
            "With 8-bit keys, stride 2, and prefixes 0/2, 16/4, 18/6 and 128/1, query 19 (00010011) matches 0/2, 16/4 and 18/6. The longest is 18/6 because its top six bits 000100 equal the query's, so the search reports 18/6.",
    },
    id: "bit-slice-tree",
    name: "Bit-Slice Tree",
    category: "data-structures",
    complexity: { time: "O(W/s + p)", space: "O(total prefix bits / s)" },
    defaultInput: { width: 8, slice: 2, prefixes: [[0, 2], [16, 4], [18, 6], [128, 1]], query: 19 },
    visualType: "tree",
    run,
    pseudocode: [
        "choose a stride s and split keys into s-bit slices",
        "insert each prefix by following slices of its leading bits",
        "store the prefix at the node reached last",
        "start a query at the root with the best match empty",
        "at each node update the best match from stored prefixes",
        "extract the next slice of query bits and take that child",
        "stop when no child exists or all bits are consumed",
        "done: report the longest matching prefix",
    ],
};

export default module;
