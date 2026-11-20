/**
 * generalized-suffix-tree.ts - Generalized Suffix Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A generalized suffix tree indexes all suffixes of several strings at once.
 * Each string is terminated by its own unique sentinel, so a leaf identifies
 * both the document it belongs to and the position where its suffix starts.
 * The module inserts suffixes into a trie one by one, then compresses every
 * non-branching internal node into a compact tree.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L^2) for total input length L with the simple trie insertion
 *   Space: O(L^2) for the uncompressed trie before compaction
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are circles arranged by the tree layout; edge labels show substrings.
 *   - Leaves of the first document are GREEN, leaves of the second BLUE.
 *   - The final frame shows the compact tree with the compressed edge labels.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface TrieNode {
    id: number;
    edge: string;
    parent: number | null;
    children: Map<string, number>;
    leaf?: { doc: number; start: number };
}

interface ViewNode {
    id: number;
    edge: string;
    parent: number | null;
    children: ViewNode[];
    leaf?: { doc: number; start: number };
}

function chooseSentinels(strings: string[]): string[] {
    const pool = ["$", "#", "%", "&", "@", "~", "^", "!", "?", "="];
    const used = new Set(strings.join("").split(""));
    const available = pool.filter((char) => !used.has(char));
    return strings.map((_, i) => available[i] ?? `\u0001${i}`);
}

function insert(trie: TrieNode[], doc: number, start: number, suffix: string): void {
    let current = 0;
    for (const char of suffix) {
        const existing = trie[current]?.children.get(char);
        if (existing !== undefined) {
            current = existing;
            continue;
        }
        const id = trie.length;
        trie.push({ id, edge: char, parent: current, children: new Map() });
        trie[current]?.children.set(char, id);
        current = id;
    }
    const node = trie[current];
    if (node) node.leaf = { doc, start };
}

/** Copy the trie into a view tree, optionally merging single-child nodes. */
function toView(
    trie: TrieNode[],
    nodeId: number,
    incoming: string,
    parent: number | null,
    counter: { value: number },
    compress: boolean,
): ViewNode {
    const node = trie[nodeId];
    if (!node) {
        return { id: counter.value++, edge: incoming, parent, children: [] };
    }
    if (compress && node.children.size === 1 && node.leaf === undefined && node.parent !== null) {
        const [char, childId] = [...node.children.entries()][0] ?? ["", nodeId];
        return toView(trie, childId, incoming + char, parent, counter, compress);
    }
    const view: ViewNode = { id: counter.value++, edge: incoming, parent, children: [], leaf: node.leaf };
    for (const [char, childId] of node.children) {
        view.children.push(toView(trie, childId, char, view.id, counter, compress));
    }
    return view;
}

function flatten(root: ViewNode): ViewNode[] {
    const out: ViewNode[] = [];
    const walk = (node: ViewNode): void => {
        out.push(node);
        for (const child of node.children) walk(child);
    };
    walk(root);
    return out;
}

function leafPaths(root: ViewNode): { path: string; doc: number }[] {
    const out: { path: string; doc: number }[] = [];
    const walk = (node: ViewNode, prefix: string): void => {
        const next = prefix + node.edge;
        if (node.leaf) out.push({ path: next, doc: node.leaf.doc });
        for (const child of node.children) walk(child, next);
    };
    walk(root, "");
    return out;
}

function render(root: ViewNode, activeDoc: number | null, step: number, description: string, codeLineNumber: number, extra: Record<string, number | string | boolean | number[] | string[]>): VisualFrame {
    const nodes = flatten(root);
    const entities: VisualEntity[] = nodes.map((node) => {
        let state: EntityState = "idle";
        if (node.leaf && activeDoc !== null) state = node.leaf.doc === activeDoc ? "sorted" : "visited";
        return {
            id: node.id === root.id ? "node-root" : `node-${node.id}`,
            type: "node" as const,
            label: node.id === root.id ? "root" : node.leaf ? `d${node.leaf.doc}:${node.leaf.start}` : node.edge,
            value: node.id,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                parentId: node.parent === null ? "root" : node.id === root.id ? "root" : `node-${node.parent}`,
                doc: node.leaf ? node.leaf.doc : -1,
                start: node.leaf ? node.leaf.start : -1,
            },
        };
    });
    const edges: VisualEdge[] = [];
    const collect = (node: ViewNode): void => {
        for (const child of node.children) {
            edges.push({
                id: `edge-${node.id}-${child.id}`,
                sourceId: node.id === root.id ? "node-root" : `node-${node.id}`,
                targetId: `node-${child.id}`,
                label: child.edge,
                state: "idle",
                directed: true,
            });
            collect(child);
        }
    };
    collect(root);
    const paths = leafPaths(root);
    return {
        stepNumber: step,
        entities,
        edges,
        description,
        codeLineNumber,
        layout: "tree",
        meta: {
            nodes: nodes.length,
            edges: edges.length,
            leaves: paths.length,
            leafPaths: paths.map((p) => p.path),
            leafOwners: paths.map((p) => p.doc),
            ...extra,
        },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { strings?: string[] } | null) ?? {};
    const strings: string[] = Array.isArray(task.strings)
        ? task.strings.filter((s): s is string => typeof s === "string" && s.length > 0)
        : ["banana", "bandana"];
    const sentinels = chooseSentinels(strings);
    const trie: TrieNode[] = [{ id: 0, edge: "", parent: null, children: new Map() }];
    let inserted = 0;
    let step = 0;

    const rawView = (): ViewNode => toView(trie, 0, "", null, { value: 0 }, false);
    yield render(rawView(), null, step, `Building a generalized suffix tree for ${strings.length} string(s).`, 0, { docs: strings.length, suffixes: 0 });
    step += 1;

    for (let doc = 0; doc < strings.length; doc += 1) {
        const text = strings[doc] ?? "";
        const sentinel = sentinels[doc] ?? "$";
        for (let start = 0; start < text.length; start += 1) {
            insert(trie, doc, start, text.slice(start) + sentinel);
            inserted += 1;
            yield render(
                rawView(),
                doc,
                step,
                `Inserted suffix ${start} of document ${doc}: "${text.slice(start)}${sentinel}".`,
                3,
                { docs: strings.length, suffixes: inserted },
            );
            step += 1;
        }
    }

    const compact = toView(trie, 0, "", null, { value: 0 }, true);
    const nodes = flatten(compact);
    yield render(compact, 0, step, `Compressed ${trie.length} trie nodes into ${nodes.length} compact tree nodes.`, 6, {
        docs: strings.length,
        suffixes: inserted,
        internalNodes: nodes.filter((n) => !n.leaf).length,
    });
}

/** The generalized suffix tree module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A suffix tree for one string can be reused for several if each string gets a unique end marker. Inserting every suffix of every document into one trie makes shared prefixes share a path, and a leaf then carries a document number and a start position. Collapsing chains of single-child nodes turns the trie into a compact tree whose edges spell out whole substrings.",
        invariants: [
            "Each inserted suffix produces exactly one leaf labeled with its document and start position.",
            "The unique sentinel for a document never appears in that document's text.",
            "Compressing single-child nodes never removes a leaf or changes any root-to-leaf label.",
        ],
        correctness:
            "Insertion walks the trie character by character, creating a node only when no matching edge exists, so every suffix gets a distinct terminal node whose path label is that suffix including its sentinel. Because sentinels are unique, no suffix can be a prefix of a suffix from another document. Compressing a node with one child concatenates their edge labels and preserves the label on every root-to-leaf path, so the compact tree represents exactly the same set of suffixes as the trie.",
        complexityRationale:
            "Inserting each of the L total suffixes can traverse O(L) characters, giving O(L^2) time and trie space for small inputs. The final compaction visits each node once, which is linear in the trie size.",
        uses: [
            "Finding repeated substrings shared by several genomes",
            "Supporting longest common substring queries across documents",
            "Building compressed full-text indexes for collections of documents",
        ],
        references: [
            "Gusfield, Algorithms on Strings, Trees and Sequences, Chapter 8",
            "Ukkonen, On-Line Construction of Suffix Trees, 1995",
        ],
        workedExample:
            "For the strings ab and ba with sentinels $ and #, the tree has four leaves for ab$, b$, ba#, and a#. The paths sharing the leading a or b merge, so the compact tree has a branching root and one edge labeled ab$ leading to a leaf for document zero at position zero.",
    },
    id: "generalized-suffix-tree",
    name: "Generalized Suffix Tree",
    category: "string",
    complexity: { time: "O(L^2)", space: "O(L^2)" },
    defaultInput: { strings: ["banana", "bandana"] },
    visualType: "tree",
    run,
    pseudocode: [
        "choose a distinct sentinel character for each input string",
        "create a root node for the shared trie",
        "for each string and each start position insert its suffixed string into the trie",
        "mark the reached node as a leaf with its document and start position",
        "compress every non-root node that has a single child into that child",
        "label the merged edge with the concatenated substrings",
        "done: report the compact generalized suffix tree",
    ],
};

export default module;
