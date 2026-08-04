/**
 * ternary-search-trie.ts – Ternary Search Trie (TST)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A ternary search trie is a space-saving trie: each node has only three
 * children (less, equal, greater) instead of a full alphabet. A search walks
 * down comparing characters, branching left/right for mismatches and down the
 * equal child for matches. It combines the speed of a trie with the memory of
 * a BST.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Search / insert: O(L + log n) where L is the word length
 *   Space:           O(total characters) – 3 pointers per node
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are circles labelled with characters.
 *   - The three edges (LT, EQ, GT) are colored distinctly.
 *   - The search path is YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Three children instead of the whole alphabet" is the idea.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Ternary Search Trie generator.
 *
 * @param input `{ words, search }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { words?: string[]; search?: string } | null) ?? {};
    const words = task.words ?? ["cat", "car", "cup", "dog"];
    const search = task.search ?? "car";

    let step = 0;

    // Build a TST node structure.
    type TNode = {
        char: string;
        lt: TNode | null;
        eq: TNode | null;
        gt: TNode | null;
        end: boolean;
        id: number;
    };
    let nextId = 0;
    let root: TNode | null = null;

    const insert = (node: TNode | null, word: string, depth: number): TNode => {
        const char = word[depth] as string;
        if (!node) {
            node = { char, lt: null, eq: null, gt: null, end: false, id: nextId };
            nextId += 1;
        }
        if (char < node.char) {
            node.lt = insert(node.lt, word, depth);
        } else if (char > node.char) {
            node.gt = insert(node.gt, word, depth);
        } else if (depth + 1 < word.length) {
            node.eq = insert(node.eq, word, depth + 1);
        } else {
            node.end = true;
        }
        return node;
    };

    for (const word of words) {
        root = insert(root, word, 0);
    }

    // Flatten to entities.
    const nodes: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    const walk = (node: TNode, parentId: string | null): void => {
        const id = `n-${node.id}`;
        nodes.push({
            id,
            type: "node" as const,
            label: node.char,
            value: node.char,
            state: node.end ? "sorted" : "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parentId ?? "root" },
        });
        const link = (child: TNode | null, kind: string): void => {
            if (child) {
                edges.push({
                    id: `e-${node.id}-${child.id}`,
                    sourceId: id,
                    targetId: `n-${child.id}`,
                    label: kind,
                    state: kind === "EQ" ? "path" : kind === "LT" ? "active" : "highlight",
                    directed: true,
                });
                walk(child, id);
            }
        };
        link(node.lt, "LT");
        link(node.eq, "EQ");
        link(node.gt, "GT");
    };
    if (root) {
        walk(root, null);
    }

    // Frame 0: the TST.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Ternary search trie for [${words.join(", ")}] – searching "${search}".`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { words: words.length },
    };
    step += 1;

    // Search the TST.
    let node = root;
    let depth = 0;
    let found = true;
    const matchedChars: string[] = [];

    while (node && depth < search.length) {
        const char = search[depth] as string;
        if (char < node.char) {
            node = node.lt;
        } else if (char > node.char) {
            node = node.gt;
        } else {
            matchedChars.push(char);
            depth += 1;
            if (depth < search.length) {
                node = node.eq;
            } else {
                found = node.end;
                break;
            }
        }

        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Matched so far: "${matchedChars.join("")}".`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { words: words.length },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: found
            ? `"${search}" found in the TST.`
            : `"${search}" is not present (or only a prefix).`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { words: words.length, found },
    };
}

/** The Ternary Search Trie module, registered with the engine. */
const module: AlgorithmModule = {
    id: "ternary-search-trie",
    name: "Ternary Search Trie",
    category: "data-structures",
    complexity: { time: "O(L + log n)", space: "O(total chars)" },
    defaultInput: { words: ["cat", "car", "cup", "dog"], search: "car" },
    visualType: "tree",
    run,
};

export default module;
