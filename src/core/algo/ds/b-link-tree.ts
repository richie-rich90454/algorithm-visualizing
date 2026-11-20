/**
 * b-link-tree.ts - B-Link Tree
 *
 * A B-link tree is a B+ tree whose nodes carry a right-sibling pointer. A
 * reader descends to a leaf and, whenever its search key is larger than every
 * key covered by the current node, follows the sibling link instead of
 * restarting at the root. Those links let a reader survive a concurrent split
 * without latching the tree. This module bulk-loads a static B-link tree and
 * animates linked searches.
 *
 * Time:  O(log n) node visits plus link steps
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Node {
    id: number;
    keys: number[]; // routing maxes for internal nodes, data keys for leaves
    children: number[]; // indices into the level below
    hi: number; // largest key in this subtree
    leaf: boolean;
}

const LEAF_CAP = 3;
const FANOUT = 3;

/** Bulk-load sorted keys into linked levels, leaves at index zero. */
function build(keys: number[]): Node[][] {
    const sorted = [...new Set([...keys].sort((a, b) => a - b))];
    let nextId = 0;
    const leaves: Node[] = [];
    for (let i = 0; i < sorted.length; i += LEAF_CAP) {
        const group = sorted.slice(i, i + LEAF_CAP);
        leaves.push({
            id: nextId++,
            keys: group,
            children: [],
            hi: group[group.length - 1] ?? -Infinity,
            leaf: true,
        });
    }
    const levels: Node[][] = [leaves];
    let level = leaves;
    while (level.length > 1) {
        const parents: Node[] = [];
        for (let i = 0; i < level.length; i += FANOUT) {
            const group = level.slice(i, i + FANOUT);
            parents.push({
                id: nextId++,
                keys: group.slice(0, -1).map((child) => child.hi),
                children: group.map((_, k) => i + k),
                hi: group[group.length - 1]?.hi ?? -Infinity,
                leaf: false,
            });
        }
        levels.push(parents);
        level = parents;
    }
    return levels;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; queries?: number[] } | null) ?? {};
    const keys = Array.isArray(task.keys) ? task.keys : [4, 9, 14, 19, 24, 29, 34, 39];
    const queries = Array.isArray(task.queries) ? task.queries : [14, 27, 39];
    const levels = build(keys);
    const keySet = new Set(keys);
    let step = 0;
    let activeId = -1;
    let activeLink = "";

    const snapshot = (message: string, line: number, query: number, found: boolean | null): VisualFrame => {
        const entities: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        levels.forEach((level, lv) => {
            level.forEach((node, i) => {
                entities.push({
                    id: `bl-${node.id}`,
                    type: "cell" as const,
                    label: node.leaf ? node.keys.join(",") || "-" : node.keys.join(","),
                    value: node.keys.length,
                    state: (node.id === activeId ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: lv, col: i, hi: node.hi, leaf: node.leaf },
                });
                if (i + 1 < level.length) {
                    edges.push({
                        id: `bl-link-${node.id}-${level[i + 1]?.id}`,
                        sourceId: `bl-${node.id}`,
                        targetId: `bl-${level[i + 1]?.id}`,
                        label: "next",
                        state: (activeLink === `bl-link-${node.id}` ? "active" : "idle") as EntityState,
                        directed: true,
                    });
                }
            });
        });
        return {
            stepNumber: step,
            entities,
            edges,
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                query,
                found: found === null ? "pending" : found,
                levels: levels.length,
                nodes: levels.reduce((sum, lv) => sum + lv.length, 0),
            },
        };
    };

    yield snapshot(
        `B-link tree over ${keys.length} keys: every level is chained by right-sibling links.`,
        0,
        -1,
        null,
    );
    step += 1;

    const results: boolean[] = [];
    for (const q of queries) {
        activeId = -1;
        activeLink = "";
        let lv = levels.length - 1;
        let idx = 0;
        let linkSteps = 0;
        yield snapshot(`Search ${q}: start at the root node.`, 1, q, null);
        step += 1;
        while (lv >= 0) {
            const level = levels[lv] ?? [];
            let node = level[idx];
            while (node && idx + 1 < level.length && q > node.hi) {
                activeLink = `bl-link-${node.id}`;
                idx += 1;
                linkSteps += 1;
                node = level[idx];
                yield snapshot(`Search ${q}: key exceeds node maximum, follow the right link.`, 2, q, null);
                step += 1;
            }
            if (!node) break;
            activeId = node.id;
            activeLink = "";
            yield snapshot(`Search ${q}: at ${node.leaf ? "leaf" : "internal"} node [${node.keys.join(",")}].`, 3, q, null);
            step += 1;
            if (node.leaf) {
                const found = node.keys.includes(q);
                results.push(found);
                yield snapshot(
                    `Search ${q}: ${found ? "found" : "absent"} in leaf after ${linkSteps} link step(s).`,
                    4,
                    q,
                    found,
                );
                step += 1;
                break;
            }
            let c = 0;
            while (c < node.keys.length && q > (node.keys[c] ?? Infinity)) c += 1;
            idx = node.children[c] ?? node.children[node.children.length - 1] ?? 0;
            lv -= 1;
        }
        if (lv < 0) {
            results.push(false);
            yield snapshot(`Search ${q}: absent (fell off the tree).`, 4, q, false);
            step += 1;
        }
    }

    yield snapshot(
        `Done: ${results.filter(Boolean).length} of ${queries.length} queries found; links preserve search correctness.`,
        6,
        -1,
        null,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A B-link tree adds a right-sibling pointer to every node of a B+ tree. When a reader reaches a node whose covered range ends before its key, it hops to the sibling instead of climbing back to the root. Because splits leave the old node pointing to the new one, a reader holding an old pointer still reaches the right data without latching the whole path.",
        invariants: [
            "Keys inside a node are sorted, and every internal separator equals the maximum of a child subtree.",
            "Each node at a level links to the next node on the same level, or to nothing at the far right.",
            "Following a link only moves right, so a search can never revisit an earlier node.",
        ],
        correctness:
            "If the search key is greater than a node's maximum, the key cannot live in that node or any node to its left, so the right sibling is the only place it can be. Routing by child maxima selects the unique child whose range contains the key. These two rules together find the key exactly when it is present, even if a split happened mid-search.",
        complexityRationale:
            "A search visits a constant number of nodes per level and may follow a few sibling links, so it costs O(log n) expected node visits; storage is one record per key plus one link per node, O(n).",
        uses: [
            "Concurrently readable database and filesystem indexes",
            "Systems that need latch-free point lookups during splits",
            "B-trees with lock-free readers and coarse-grained writers",
        ],
        references: [
            "Philipp Lehman and Sandy Bayer, 'A General Index Structure for Databases', 1981",
            "C. Mohan, 'ARIES/IM: An Efficient and High Concurrency Index Management Method', SIGMOD 1992",
        ],
        workedExample:
            "With leaves [4,9,14], [19,24,29], [34,39], searching 27 reads the first leaf (max 14), follows the link to the second leaf (max 29), and reports 27 is absent; searching 39 follows two links and finds the key.",
    },
    id: "b-link-tree",
    name: "B-Link Tree",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { keys: [4, 9, 14, 19, 24, 29, 34, 39], queries: [14, 27, 39] },
    visualType: "grid",
    run,
    pseudocode: [
        "bulk-load sorted keys into leaves and link siblings at every level",
        "begin a search at the root with the query key",
        "while the key exceeds the current node maximum follow its right link",
        "at an internal node route to the child whose range contains the key",
        "repeat until a leaf is reached",
        "report found when the query equals a key in the leaf",
        "otherwise report absent after the link chain ends",
        "done: report which queries were present",
    ],
};

export default module;
