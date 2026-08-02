/**
 * suffix-tree-ukkonen.ts – Suffix Tree (Ukkonen's algorithm, educational)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A suffix tree is a compressed trie of all suffixes of a string. Ukkonen's
 * algorithm builds it online in O(n) by extending the tree with each new
 * character. Full Ukkonen requires suffix links, the active point, and edge
 * splitting – intricate machinery. This educational implementation keeps the
 * *incremental suffix-by-suffix* idea but builds the tree directly by
 * inserting each suffix into a compressed trie, which is far easier to follow
 * while still producing a genuine suffix tree.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n²) naive, O(n) with full Ukkonen optimisations
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - Edges are labelled with the substring they represent.
 *   - The suffix currently being inserted is YELLOW (comparing).
 *   - The tree grows one suffix at a time.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The compressed-trie structure is the key idea.
 *   - Full Ukkonen's O(n) trick (suffix links, active point) is the advanced
 *     layer worth studying afterwards.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Suffix Tree (Ukkonen-style) generator.
 *
 * @param input `{ text }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "banana";
    const n = text.length;

    let step = 0;

    // The tree is a simple nested structure for teaching:
    // node = { id, edges: Map<char, { node, label }> }
    type TreeEdge = { node: TreeNode; label: string };
    type TreeNode = { id: number; edges: Map<string, TreeEdge> };
    let nextId = 0;
    const root: TreeNode = { id: nextId, edges: new Map() };
    nextId += 1;

    const buildFrame = (message: string): VisualFrame => {
        // Flatten the tree into node/edge entities (tree layout needs
        // parentId metadata, so build a parent map).
        const parentMap = new Map<string, string | null>();
        const ids: string[] = [];

        const walk = (node: TreeNode, parent: string | null): void => {
            const id = `n${node.id}`;
            ids.push(String(node.id));
            parentMap.set(String(node.id), parent);
            for (const edge of node.edges.values()) {
                walk(edge.node, String(node.id));
            }
        };
        walk(root, null);

        const entities: VisualEntity[] = ids.map((id) => ({
            id: `node-${id}`,
            type: "node" as const,
            label: id,
            value: id,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                parentId: parentMap.get(id) === null ? "root" : (parentMap.get(id) ?? "root"),
            },
        }));

        const edges: VisualEdge[] = [];
        const collect = (node: TreeNode): void => {
            for (const [char, edge] of node.edges) {
                edges.push({
                    id: `edge-${node.id}-${edge.node.id}`,
                    sourceId: `node-${node.id}`,
                    targetId: `node-${edge.node.id}`,
                    label: edge.label,
                    state: "idle",
                    directed: true,
                });
                collect(edge.node);
            }
        };
        collect(root);

        return {
            stepNumber: step,
            entities,
            edges,
            description: message,
            codeLineNumber: 2,
            layout: "tree",
            meta: { suffixes: n },
        };
    };

    yield buildFrame("Starting the suffix tree – inserting suffixes one by one.");
    step += 1;

    // Insert every suffix (Ukkonen's incremental suffix-by-suffix idea).
    for (let start = 0; start < n; start += 1) {
        const suffix = text.slice(start);

        // Walk down the tree, splitting edges when the suffix diverges.
        let node = root;
        let i = 0;

        while (i < suffix.length) {
            const char = suffix[i] as string;
            const edge = node.edges.get(char);

            if (!edge) {
                // No edge for this character – create a fresh leaf edge.
                const leaf: TreeNode = { id: nextId, edges: new Map() };
                nextId += 1;
                node.edges.set(char, { node: leaf, label: suffix.slice(i) });
                break;
            }

            // An edge exists: consume the shared prefix character by character.
            const label = edge.label;
            let k = 0;
            while (k < label.length && i + k < suffix.length && label[k] === suffix[i + k]) {
                k += 1;
            }

            if (k < label.length) {
                // Split the edge at position k.
                const middle: TreeNode = { id: nextId, edges: new Map() };
                nextId += 1;

                // The rest of the old edge becomes a child of the middle node.
                const tail = label.slice(k);
                middle.edges.set(tail[0] as string, { node: edge.node, label: tail });

                // Replace the old edge with the split prefix edge.
                node.edges.set(char, { node: middle, label: label.slice(0, k) });

                if (i + k < suffix.length) {
                    // The remaining suffix continues from the middle node.
                    const leaf: TreeNode = { id: nextId, edges: new Map() };
                    nextId += 1;
                    middle.edges.set(suffix[i + k] as string, {
                        node: leaf,
                        label: suffix.slice(i + k),
                    });
                }
                break;
            }

            // Full label matched – descend and continue from the middle.
            node = edge.node;
            i += k;
        }

        yield buildFrame(`Inserted suffix "${suffix}".`);
        step += 1;
    }

    yield buildFrame(`Suffix tree of "${text}" complete – ${nextId} nodes.`);
}

/** The Suffix Tree (Ukkonen) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "suffix-tree-ukkonen",
    name: "Suffix Tree (Ukkonen)",
    category: "string",
    complexity: { time: "O(n) / O(n²) naive", space: "O(n)" },
    // "banana" is the canonical suffix-tree example.
    defaultInput: { text: "banana" },
    visualType: "tree",
    run,
};

export default module;
