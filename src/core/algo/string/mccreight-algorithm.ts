/**
 * mccreight-algorithm.ts - McCreight's Suffix Tree Construction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * McCreight's algorithm builds a suffix tree top-down by inserting suffixes
 * from longest to shortest (left to right through the text). Every internal
 * node carries a suffix link to the node representing its label without the
 * first character. After an insertion, the next one resumes from that link
 * instead of starting again at the root, which is what makes the full method
 * linear time.
 *
 * This teaching version splits edges explicitly so both the growing tree and
 * its suffix links are visible; the resulting suffix tree is exact.
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
 *   - Nodes created by the current insertion are ACTIVE.
 *   - Suffix links appear in the final frames as HIGHLIGHT edges.
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

    capture([], false, `McCreight construction for "${raw}": start with an empty tree (left-to-right).`, 0);

    for (let i = 0; i < text.length; i += 1) {
        const created = insert(root, text, i, nodes, nextId);
        capture(created, false, `Insert suffix starting at ${i}; top-down walk adds ${created.length} node(s).`, 2);
    }

    annotate(root);
    for (const node of nodes) {
        if (node.id === root.id || node.children.size === 0) {
            continue;
        }
        const locus = findLocus(root, text, node.string.slice(1));
        node.suffixLink = locus ? locus.id : root.id;
    }
    capture([], true, "McCreight suffix links let each internal node resume the next insertion one character shorter.", 5);

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
            "Add suffixes from longest to shortest and walk down from the root as far as the text matches, splitting an edge when a suffix diverges partway through. Whenever a new internal node appears, give it a suffix link to the node for the same label with the first character dropped. The next insertion follows that link to start near its destination rather than at the root.",
        invariants: [
            "After each insertion every processed suffix ends at a leaf, and no leaf is removed later.",
            "Root-to-leaf edge labels concatenate to exactly the suffixes of the text.",
            "An internal node's suffix link points to the locus of its label with the leading character removed.",
        ],
        correctness:
            "Top-down insertion with edge splitting is the canonical suffix-tree construction, so the final structure is a compact trie of all suffixes with shared prefixes merged. Every suffix therefore has exactly one leaf and every root-to-leaf string is a suffix. The test reconstructs all root-to-leaf strings from the emitted tree and checks they equal the suffix set, which is the suffix tree correctness criterion.",
        complexityRationale:
            "Explicit top-down matching may scan O(n) characters per suffix, so this teaching version runs in O(n^2) time. McCreight's full algorithm uses suffix links and the head/tail scanning trick to bound total work at O(n). Storage is O(n) for the nodes, edges, and links of the compact tree.",
        uses: [
            "Constructing suffix trees for exact string matching",
            "Computing longest common substrings between sequences",
            "Indexing biological sequences for repeated motif discovery",
        ],
        references: [
            "McCreight, A Space-Economical Suffix Tree Construction Algorithm, ACM TOPLAS, 1976",
            "Gusfield, Algorithms on Strings, Trees, and Sequences, Chapter 7",
        ],
        workedExample:
            "For 'aba$' the full suffix 'aba$' is inserted first as a single path. 'ba$' next branches at the root. 'a$' shares the leading 'a', forcing a split into internal node 'a' with one leaf for 'ba$' and another for 'a$'. That internal node links to the root locus for the empty string.",
    },
    id: "mccreight-algorithm",
    name: "McCreight Suffix Tree Construction",
    category: "string",
    complexity: { time: "O(n^2) teaching version", space: "O(n)" },
    defaultInput: { text: "banana" },
    visualType: "tree",
    run,
    pseudocode: [
        "create a root node and append a unique sentinel",
        "for suffix starts from first to last",
        "walk down from the root along the matching path",
        "split an edge at the first mismatch and add a leaf",
        "record an internal node when a split occurs",
        "link each internal node to the locus minus first character",
        "resume later insertions through these suffix links",
        "collect leaves in lexicographic order for the suffix array",
        "report the tree and all suffix links",
    ],
};

export default module;
