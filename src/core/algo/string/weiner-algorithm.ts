/**
 * weiner-algorithm.ts - Weiner's Suffix Tree Construction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Weiner's algorithm builds a suffix tree by inserting suffixes from shortest
 * to longest (right to left through the text). Whenever an edge must be split,
 * a link is recorded from the new internal node to the locus of its label with
 * the first character removed. Those links let the next insertion resume near
 * where the previous one stopped, which is the source of the linear-time bound
 * in the full method.
 *
 * This teaching version performs explicit edge splitting so the structure and
 * the links are both visible; the suffix tree it produces is exact.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) teaching version with explicit splits, O(n) in the full form
 *   Space: O(n) nodes and links
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are laid out as a tree, edge labels are substrings of the text.
 *   - The nodes created by the current insertion are ACTIVE.
 *   - Suffix links appear in the final frames as dashed-style HIGHLIGHT edges.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

const SENTINEL = "\u0000";

interface STNode {
    id: number;
    start: number;
    end: number;
    parent: number | null;
    suffixStart: number;
    children: Map<string, STNode>;
    suffixLink: number | null;
    label: string;
    string: string;
    depth: number;
}

interface NodeSnap {
    id: number;
    parent: number | null;
    suffixStart: number;
    label: string;
    depth: number;
    isLeaf: boolean;
    isRoot: boolean;
    suffixLink: number | null;
}

interface Snap {
    nodes: NodeSnap[];
    newIds: number[];
    showLinks: boolean;
    description: string;
    line: number;
}

/** Create a node and register it in the shared array. */
function makeNode(
    id: number,
    start: number,
    end: number,
    parent: number | null,
    suffixStart: number,
    label: string,
    nodes: STNode[],
): STNode {
    const node: STNode = {
        id,
        start,
        end,
        parent,
        suffixStart,
        children: new Map(),
        suffixLink: null,
        label,
        string: "",
        depth: 0,
    };
    nodes.push(node);
    return node;
}

/** Insert one suffix, splitting edges as needed; return ids of new nodes. */
function insert(root: STNode, text: string, suffixStart: number, nodes: STNode[], nextId: { value: number }): number[] {
    const created: number[] = [];
    let node = root;
    let pos = suffixStart;
    while (pos < text.length) {
        const ch = text[pos] as string;
        const child = node.children.get(ch);
        if (!child) {
            const leaf = makeNode(nextId.value++, pos, text.length, node.id, suffixStart, text.slice(pos, text.length), nodes);
            node.children.set(ch, leaf);
            created.push(leaf.id);
            return created;
        }
        const edgeLen = child.end - child.start;
        let matched = 0;
        while (matched < edgeLen && pos + matched < text.length && text[child.start + matched] === text[pos + matched]) {
            matched += 1;
        }
        if (matched === edgeLen) {
            node = child;
            pos += edgeLen;
            continue;
        }
        const split = makeNode(nextId.value++, child.start, child.start + matched, node.id, -1, text.slice(child.start, child.start + matched), nodes);
        created.push(split.id);
        child.start += matched;
        child.parent = split.id;
        child.label = text.slice(child.start, child.end);
        split.children.set(text[child.start] as string, child);
        node.children.set(ch, split);
        const leaf = makeNode(nextId.value++, pos + matched, text.length, split.id, suffixStart, text.slice(pos + matched, text.length), nodes);
        split.children.set(text[pos + matched] as string, leaf);
        created.push(leaf.id);
        return created;
    }
    return created;
}

/** Follow a string from the root to its locus; null if it ends inside an edge. */
function findLocus(root: STNode, text: string, value: string): STNode | null {
    let node = root;
    let i = 0;
    while (i < value.length) {
        const child = node.children.get(value[i] as string);
        if (!child) {
            return null;
        }
        const edgeLen = child.end - child.start;
        let matched = 0;
        while (matched < edgeLen && i + matched < value.length && text[child.start + matched] === value[i + matched]) {
            matched += 1;
        }
        if (matched < edgeLen) {
            return null;
        }
        node = child;
        i += edgeLen;
    }
    return node;
}

/** Fill in root-to-node strings and depths. */
function annotate(root: STNode): void {
    const walk = (node: STNode, prefix: string, depth: number): void => {
        node.string = prefix + node.label;
        node.depth = depth;
        for (const child of node.children.values()) {
            walk(child, node.string, depth + 1);
        }
    };
    walk(root, "", 0);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const raw = typeof task.text === "string" && task.text.length > 0 ? task.text : "banana";
    const text = raw.replace(/\u0000/g, "").slice(0, 18) + SENTINEL;
    const lines = 9;
    const nodes: STNode[] = [];
    const root = makeNode(0, -1, -1, null, -1, "", nodes);
    const nextId = { value: 1 };
    const snapshots: Snap[] = [];

    const capture = (newIds: number[], showLinks: boolean, description: string, line: number): void => {
        const records: NodeSnap[] = nodes.map((node) => ({
            id: node.id,
            parent: node.parent,
            suffixStart: node.suffixStart,
            label: node.label,
            depth: node.depth,
            isLeaf: node.children.size === 0,
            isRoot: node.id === root.id,
            suffixLink: node.suffixLink,
        }));
        snapshots.push({ nodes: records, newIds: [...newIds], showLinks, description, line });
    };

    capture([], false, `Weiner construction for "${raw}": start with an empty tree (right-to-left).`, 0);

    for (let i = text.length - 1; i >= 0; i -= 1) {
        const created = insert(root, text, i, nodes, nextId);
        capture(created, false, `Insert suffix starting at ${i === text.length - 1 ? "the sentinel" : i}; split edges and add ${created.length} node(s).`, 2);
    }

    annotate(root);
    for (const node of nodes) {
        if (node.id === root.id || node.children.size === 0) {
            continue;
        }
        const locus = findLocus(root, text, node.string.slice(1));
        node.suffixLink = locus ? locus.id : root.id;
    }
    capture([], true, "Weiner suffix links now point from each internal node to its label without the first character.", 5);

    const suffixArray: number[] = [];
    const collect = (node: STNode): void => {
        const children = [...node.children.values()].sort((a, b) => (a.label[0] as string).localeCompare(b.label[0] as string));
        for (const child of children) {
            if (child.children.size === 0) {
                suffixArray.push(child.suffixStart);
            } else {
                collect(child);
            }
        }
    };
    collect(root);

    let step = 0;
    const frameFor = (snap: Snap): VisualFrame => {
        const entities: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        const fresh = new Set(snap.newIds);
        for (const node of snap.nodes) {
            const metadata: Record<string, number | string | boolean> = {
                depth: node.depth,
                isLeaf: node.isLeaf,
                isRoot: node.isRoot,
                fullLabel: node.label,
                suffixStart: node.suffixStart,
            };
            if (node.parent !== null) {
                metadata.parentId = `node-${node.parent}`;
            }
            let state: EntityState = "idle";
            if (fresh.has(node.id)) {
                state = "active";
            } else if (snap.showLinks) {
                state = "sorted";
            }
            entities.push({
                id: `node-${node.id}`,
                type: "node",
                label: node.isRoot ? "root" : node.label.length > 6 ? `${node.label.slice(0, 5)}...` : node.label,
                value: node.label,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata,
            });
            if (node.parent !== null) {
                edges.push({
                    id: `tree-edge-${node.id}`,
                    sourceId: `node-${node.parent}`,
                    targetId: `node-${node.id}`,
                    label: node.label,
                    state: fresh.has(node.id) ? "active" : "idle",
                    directed: true,
                });
            }
            if (snap.showLinks && node.suffixLink !== null) {
                edges.push({
                    id: `link-edge-${node.id}-${node.suffixLink}`,
                    sourceId: `node-${node.id}`,
                    targetId: `node-${node.suffixLink}`,
                    label: "link",
                    state: "highlight",
                    directed: true,
                });
            }
        }
        return {
            stepNumber: step,
            entities,
            edges,
            description: snap.description,
            codeLineNumber: Math.min(snap.line, lines - 1),
            layout: "tree",
            meta: {
                text: raw,
                nodeCount: snap.nodes.length,
                showLinks: snap.showLinks,
                suffixArray: suffixArray.join(","),
                suffixes: snap.nodes.filter((n) => n.isLeaf).length,
            },
        };
    };

    for (const snap of snapshots) {
        yield frameFor(snap);
        step += 1;
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Build the suffix tree by adding the shortest suffix first and walking leftward. When a new suffix shares only part of an existing edge, split that edge and create a fresh internal node. Weiner's key idea is to link every new internal node to the place reached by deleting the first character of its label, so the next insertion can jump close to where it belongs.",
        invariants: [
            "Every inserted suffix ends at a distinct leaf, so the leaf count equals the text length including the sentinel.",
            "Each edge label is a substring of the text, and root-to-leaf labels spell exactly one suffix.",
            "A suffix link from a node whose label is alpha points to the locus of alpha with its first character removed.",
        ],
        correctness:
            "Inserting a suffix by walking from the root and splitting at the first mismatch is the standard suffix-tree insertion rule, so after all insertions every root-to-leaf path spells a suffix and every suffix has a path. Edges never overlap because a split reuses the matched prefix. The suffix link is defined by an explicit locus search, and the test verifies that all root-to-leaf strings are exactly the suffixes, which is the defining property of a suffix tree.",
        complexityRationale:
            "With explicit matching from the root, inserting one suffix can scan O(n) characters, so the teaching version takes O(n^2) time. The full Weiner algorithm uses the links to avoid rescanning and achieves O(n) for a constant alphabet. The tree stores O(n) nodes, edges, and links.",
        uses: [
            "Full-text indexing and pattern matching in linear time",
            "Finding the longest repeated substring and other repeat queries",
            "Bioinformatics sequence analysis on large genomes",
        ],
        references: [
            "Weiner, Linear Pattern Matching Algorithms, Switching and Automata Theory, 1973",
            "Gusfield, Algorithms on Strings, Trees, and Sequences, Chapter 7",
        ],
        workedExample:
            "For 'ana$' the first suffix '$' becomes a root leaf. Inserting 'a$' creates the root child 'a'. Inserting 'na$' adds 'na'. Inserting 'ana$' shares the leading 'a', splitting it so the internal node 'a' has children 'na$' and 'na$'-per-suffix leaves. The internal node 'a' links to the root locus of the empty string.",
    },
    id: "weiner-algorithm",
    name: "Weiner Suffix Tree Construction",
    category: "string",
    complexity: { time: "O(n^2) teaching version", space: "O(n)" },
    defaultInput: { text: "banana" },
    visualType: "tree",
    run,
    pseudocode: [
        "create a root node and an empty tree",
        "append a unique sentinel to the text",
        "for suffix starts from last to first",
        "walk down from the root matching the suffix",
        "split an edge at the first mismatch and add a leaf",
        "after all insertions label each node by its path string",
        "link each internal node to the locus minus its first character",
        "collect leaves in lexicographic order for the suffix array",
        "report the tree and its suffix links",
    ],
};

export default module;
