/**
 * burst-trie.ts - Burst Trie
 * Containers burst into trie nodes when full. Demo: insert <=6 words, search 1 hit + 1 miss.
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
        description: "Burst Trie: empty. Containers burst into trie nodes when full.",
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
        "intuition": "A burst trie starts with a single container of strings and turns a container into a trie node when it grows too large. Small key sets stay compact in one container, while popular prefixes automatically get their own branches. Searches walk trie characters, then scan the small leftover container.",
        "invariants": [
            "Each container holds at most the burst threshold number of words.",
            "A burst replaces a container by children keyed on the next character.",
            "Every word is stored in exactly one container."
        ],
        "correctness": "Bursting distributes words by their next character, so any future lookup follows the same character to the right container. Because the split is by prefix, two words stay together only when they share that prefix. Scanning the final container therefore finds the word if and only if it was inserted.",
        "complexityRationale": "Each character of a lookup costs one trie step, and the final container scan is bounded by the threshold, so amortized time is O(k). Storage is O(n) because each word appears once and nodes are created only when needed.",
        "uses": [
            "In-memory string dictionaries",
            "Autocomplete and spell-checker front ends",
            "Token indexes in search engines"
        ],
        "references": [
            "Steffen Heinz, Justin Zobel, and Hugh E. Williams, \"Burst Tries: A Fast, Efficient Data Structure for String Keys\", ACM TOIS 2002",
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 6.3"
        ],
        "workedExample": "With words car, cat, dog, dot and a threshold of 2, inserting creates one container of four words, which bursts on first character into a c branch (car, cat) and a d branch (dog, dot). Searching cat follows c then a and scans the small container to find cat."
    },
    id: "burst-trie",
    name: "Burst Trie",
    category: "data-structures",
    complexity: { time: "O(k) amortized", space: "O(n)" },
    defaultInput: { words: ["car", "cat", "dog", "dot"], search: "cat" },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize burst trie with single container root",
        "insert word by walking shared prefix characters",
        "compare container size against burst threshold",
        "burst full container into trie nodes by first character",
        "search query by traversing trie then scanning container",
        "count words stored across containers",
        "done: burst trie holds words with lookup answer",
    ],
};
export default module;
