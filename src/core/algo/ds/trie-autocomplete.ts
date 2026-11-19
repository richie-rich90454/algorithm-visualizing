/**
 * trie-autocomplete.ts - Trie Autocomplete
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Autocomplete walks a prefix down a trie and then enumerates every word that
 * lives in the subtree below that prefix node. Each completion carries a
 * frequency, so results can be ranked by popularity with a deterministic
 * tie-break. Walking to the prefix costs time proportional to the prefix
 * length; collecting results costs time proportional to the number of emitted
 * characters in that subtree.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(|prefix| + C) where C is the total length of the emitted words
 *   Space: O(total characters) for the trie plus O(r) for ranked results
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each trie node is a circle; an edge label is the character it consumes.
 *   - The prefix path is YELLOW (comparing) while it is walked.
 *   - Nodes inside the matching subtree are ACTIVE (active).
 *   - Word-ending nodes that become suggestions are GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Task = { words?: string[]; prefix?: string; frequencies?: Record<string, number> };

interface TrieNode {
    id: string;
    children: Map<string, TrieNode>;
    word?: string;
    count: number;
}

function buildTrie(words: string[], frequencies: Record<string, number>): TrieNode {
    const root: TrieNode = { id: "", children: new Map(), count: 0 };
    for (const word of words) {
        let node = root;
        for (const char of word) {
            let child = node.children.get(char);
            if (!child) {
                child = { id: `${node.id}${char}`, children: new Map(), count: 0 };
                node.children.set(char, child);
            }
            node = child;
        }
        node.word = word;
        node.count = frequencies[word] ?? 1;
    }
    return root;
}

function allNodes(root: TrieNode): TrieNode[] {
    const nodes: TrieNode[] = [];
    const walk = (node: TrieNode): void => {
        nodes.push(node);
        for (const child of node.children.values()) {
            walk(child);
        }
    };
    walk(root);
    return nodes;
}

function buildEntities(
    nodes: TrieNode[],
    states: Map<string, EntityState>,
    activeEdges: Set<string>,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = nodes.map((node) => ({
        id: `node-${node.id}`,
        type: "node" as const,
        label: node.id === "" ? "*" : node.id.slice(-1),
        value: node.id,
        state: states.get(node.id) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: {
            parentId: node.id === "" ? "root" : `node-${node.id.slice(0, -1)}`,
            depth: node.id.length,
            word: node.word ?? "",
            count: node.count,
        },
    }));
    const edges: VisualEdge[] = [];
    for (const node of nodes) {
        if (node.id === "") {
            continue;
        }
        const parentId = node.id.slice(0, -1);
        const key = `${parentId}>${node.id}`;
        edges.push({
            id: `edge-${key}`,
            sourceId: `node-${parentId}`,
            targetId: `node-${node.id}`,
            label: node.id.slice(-1),
            state: activeEdges.has(key) ? "path" : "idle",
            directed: true,
        });
    }
    return { entities, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const words = (task.words ?? ["cat", "car", "cart", "dog", "door", "data", "date"]).filter(
        (s): s is string => typeof s === "string",
    );
    const prefix = typeof task.prefix === "string" ? task.prefix : "da";
    const frequencies = task.frequencies ?? {};
    const root = buildTrie(words, frequencies);
    const nodes = allNodes(root);
    let step = 0;

    yield {
        stepNumber: step,
        ...buildEntities(nodes, new Map(), new Set()),
        description: `Built a trie of ${words.length} word(s); autocompleting the prefix "${prefix}".`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { wordCount: words.length, prefix, nodeCount: nodes.length },
    };
    step += 1;

    const wordStates = new Map<string, EntityState>();
    for (const node of nodes) {
        if (node.word !== undefined) {
            wordStates.set(node.id, "sorted");
        }
    }
    yield {
        stepNumber: step,
        ...buildEntities(nodes, wordStates, new Set()),
        description: "Word-ending nodes are marked so a completion can be recognized.",
        codeLineNumber: 1,
        layout: "tree",
        meta: { prefix, markedWords: words.length },
    };
    step += 1;

    let node = root;
    let matched = true;
    const prefixStates = new Map<string, EntityState>();
    const prefixEdges = new Set<string>();
    for (const char of prefix) {
        const child = node.children.get(char);
        if (!child) {
            matched = false;
            break;
        }
        prefixStates.set(child.id, "comparing");
        prefixEdges.add(`${node.id}>${child.id}`);
        node = child;
        yield {
            stepNumber: step,
            ...buildEntities(nodes, prefixStates, prefixEdges),
            description: `Walked character "${char}"; now at trie node "${node.id}".`,
            codeLineNumber: 3,
            layout: "tree",
            meta: { prefix, currentNode: node.id, matchedSoFar: true },
        };
        step += 1;
    }

    if (!matched) {
        yield {
            stepNumber: step,
            ...buildEntities(nodes, new Map(), new Set()),
            description: `Done: the prefix "${prefix}" is not present in the trie, so there are no completions.`,
            codeLineNumber: 8,
            layout: "tree",
            meta: { prefix, suggestions: [], suggestionCounts: [], scores: [] },
        };
        return;
    }

    const subtreeNodes: TrieNode[] = [];
    const collect = (current: TrieNode): void => {
        subtreeNodes.push(current);
        for (const child of current.children.values()) {
            collect(child);
        }
    };
    collect(node);
    const activeStates = new Map<string, EntityState>();
    for (const item of subtreeNodes) {
        activeStates.set(item.id, "active");
    }
    yield {
        stepNumber: step,
        ...buildEntities(nodes, activeStates, prefixEdges),
        description: `Prefix found; scanning the ${subtreeNodes.length} node(s) in its subtree.`,
        codeLineNumber: 5,
        layout: "tree",
        meta: { prefix, subtreeSize: subtreeNodes.length },
    };
    step += 1;

    const found = subtreeNodes
        .filter((item) => item.word !== undefined)
        .map((item) => ({ word: item.word as string, score: item.count }))
        .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
    const suggestionStates = new Map<string, EntityState>();
    for (const item of found) {
        suggestionStates.set(item.word, "sorted");
    }
    yield {
        stepNumber: step,
        ...buildEntities(nodes, suggestionStates, prefixEdges),
        description: `Done: ${found.length} completion(s) ranked by frequency: ${found.map((f) => f.word).join(", ")}.`,
        codeLineNumber: 8,
        layout: "tree",
        meta: {
            prefix,
            suggestions: found.map((f) => f.word),
            suggestionCounts: found.map((f) => f.score),
            scores: found.map((f) => f.score),
        },
    };
}

/** The Trie Autocomplete module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A trie stores words one character per node, so every word sharing a prefix shares the same path down the tree. To autocomplete, walk the prefix and then list every word-ending node below where you land. Ranking by stored frequency puts the most likely completions first.",
        invariants: [
            "The path from the root to a word node spells that word.",
            "Every word in the prefix subtree starts with the requested prefix.",
            "Completions are ordered by descending frequency with a lexicographic tie-break.",
        ],
        correctness:
            "Trie insertion creates exactly one node per distinct prefix, so a word ending node is reachable from a prefix node precisely when the word starts with that prefix. Collecting all word nodes in the prefix subtree therefore returns every valid completion and no others. Sorting by count with a lexicographic tie-break produces a deterministic ranking.",
        complexityRationale:
            "Walking the prefix visits at most |prefix| nodes. Enumerating the subtree touches each emitted word node once, so the total is O(|prefix| + C) for C characters of output. The trie itself stores one node per distinct prefix, O(total characters).",
        uses: [
            "Search-box suggestions and command-line completion",
            "Spell-checker candidate generation",
            "IP routing longest-prefix matching interfaces",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 3, Section 6.3 on tries",
            "Fredkin, Trie Memory, 1960",
        ],
        workedExample:
            'With words cat, car, cart, dog, door, data, date and prefix "da", the walk reaches node "da" and its subtree contains data and date. With frequencies 5 for date and 2 for data, the ranked result is date then data.',
    },
    id: "trie-autocomplete",
    name: "Trie Autocomplete",
    category: "data-structures",
    complexity: { time: "O(|prefix| + C)", space: "O(total characters)" },
    defaultInput: {
        words: ["cat", "car", "cart", "dog", "door", "data", "date"],
        prefix: "da",
        frequencies: { date: 5, data: 2 },
    },
    visualType: "tree",
    run,
    pseudocode: [
        "insert every word into a trie, one node per character",
        "store a frequency at each word-ending node",
        "walk one node per character of the query prefix",
        "if a character is missing the prefix has no completions",
        "collect all word-ending nodes in the prefix subtree",
        "sort completions by descending frequency then by word",
        "mark the chosen suggestion nodes in the trie",
        "record each completion with its frequency score",
        "done: report the ranked completion list",
    ],
};

export default module;
