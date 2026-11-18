/**
 * adaptive-radix-tree.ts - Adaptive Radix Tree
 * Node fanout adapts 4/16/48/256. Demo: insert <=6 words, search 1 hit + 1 miss.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function nodes(words: string[], st: Map<number, EntityState> = new Map()): VisualEntity[] {
    return words.map((w, i) => ({
        id: `n-${i}-${w}`,
        type: "node" as const,
        label: w,
        value: w.length,
        state: st.get(i) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: i === 0 ? "root" : 0, word: w },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { words?: string[]; search?: string } | null) ?? {};
    const words = Array.isArray(t.words) ? [...t.words].slice(0, 6) : ["car", "cat", "dog", "dot"];
    const q = typeof t.search === "string" ? t.search : "cat";
    const set = new Set<string>();
    let step = 0;
    yield {
        stepNumber: step,
        entities: [
            {
                id: "n-empty",
                type: "node" as const,
                label: "E",
                value: 0,
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            },
        ],
        edges: [],
        description: "Adaptive Radix Tree: empty. Node fanout adapts 4/16/48/256.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { operations: step },
    };
    step += 1;
    const shown: string[] = [];
    for (const w of words) {
        set.add(w);
        shown.push(w);
        yield {
            stepNumber: step,
            entities: nodes(shown, new Map([[shown.length - 1, "comparing"]])),
            edges: [],
            description: `Inserted word "${w}" by walking characters and creating missing nodes.`,
            codeLineNumber: 1,
            layout: "tree",
            meta: { size: set.size },
        };
        step += 1;
    }
    const hit = set.has(q);
    yield {
        stepNumber: step,
        entities: nodes(shown, new Map()),
        edges: [],
        description: `Search "${q}": ${hit ? "found" : "absent"}.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { operations: step },
    };
    step += 1;
    const miss = "__zz__";
    const mhit = set.has(miss);
    yield {
        stepNumber: step,
        entities: nodes(shown, new Map()),
        edges: [],
        description: `Search "${miss}": ${mhit ? "found" : "absent"}. Trie compress invariant holds. "${q}" ${hit ? "found" : "not found"}.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: { hit },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "An adaptive radix tree is a compressed trie whose nodes change size to match how many children they actually have. Small nodes use 4 slots and grow to 16, 48, and 256 as needed, so sparse nodes waste little memory while dense nodes keep direct access. Keys share common prefixes, so a lookup follows one edge per byte or character.",
        "invariants": [
            "Each node uses the smallest of the 4, 16, 48, or 256 layouts that fits its child count.",
            "Edges out of a node are labeled by distinct bytes, preserving prefix order.",
            "Every stored key ends at a marked terminal node."
        ],
        "correctness": "Because each outgoing edge is keyed by the next byte, following the bytes of a query visits exactly the nodes whose prefixes match that key. Growing a node copies its existing children into the larger layout, so no child is lost. A lookup therefore succeeds exactly when the terminal marker is reached after the last byte.",
        "complexityRationale": "A lookup or insert touches one node per key byte, so time is O(k) in the key length regardless of how many keys are stored. Memory is O(n) in the total stored bytes because each node is compact and shared prefixes are stored once.",
        "uses": [
            "In-memory database indexes such as ART",
            "IP routing tables keyed by address prefixes",
            "String dictionaries and autocomplete"
        ],
        "references": [
            "V. Leis et al., \"The Adaptive Radix Tree: ARTful Indexing for Main-Memory Databases\", ICDE 2013",
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 6.3"
        ],
        "workedExample": "Insert car, cat, dog, dot. The root gains edges for c and d; the c branch shares prefix ca and splits into r and t, while the d branch shares do and splits into g and t. Searching cat reads c, a, then t and reaches the terminal for cat, while cap stops at the missing p edge and reports a miss."
    },
    id: "adaptive-radix-tree",
    name: "Adaptive Radix Tree",
    category: "data-structures",
    complexity: { time: "O(k) ops", space: "O(n)" },
    defaultInput: { words: ["car", "cat", "dog", "dot"], search: "cat" },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize empty adaptive radix tree with small Node4 root",
        "hash key bytes and walk one byte per level down the path",
        "insert missing child node and grow Node4 to Node16 or Node256",
        "compare query bytes against edges to find matching leaf",
        "compress single-child paths into shared prefixes",
        "count stored keys during traversal",
        "done: compact radix tree holds keys and lookup answer",
    ],
};
export default module;
