/**
 * tree-isomorphism.ts – Tree Isomorphism (rooted tree equivalence)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Two rooted trees are isomorphic if there is a bijection between their
 * vertices that preserves the parent-child relationship. The classic way to
 * test this is *tree hashing / canonical forms*: assign each subtree a code
 * built from the sorted codes of its children, and compare the two roots'
 * codes. Two rooted trees are isomorphic iff their root codes match.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) (sorting child codes at each node)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The two trees are drawn side by side.
 *   - The node being hashed is YELLOW (comparing).
 *   - Matching structures are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The hashing trick reduces structural comparison to string comparison.
 *   - Generalizes to unrooted trees by rooting at the tree center.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

/**
 * The Tree Isomorphism generator.
 *
 * @param input `{ treeA, treeB }` – two trees, each `{ parentMap, ids }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            treeA?: { parentMap?: Record<string, string | null>; ids?: string[] };
            treeB?: { parentMap?: Record<string, string | null>; ids?: string[] };
        } | null) ?? {};
    const treeA = task.treeA ?? {
        parentMap: { B: "A", C: "A", D: "B", E: "B" } as Record<string, string | null>,
        ids: ["A", "B", "C", "D", "E"],
    };
    const treeB = task.treeB ?? {
        parentMap: { X: "R", Y: "R", Z: "X", W: "X" } as Record<string, string | null>,
        ids: ["R", "X", "Y", "Z", "W"],
    };

    // Rename tree B's labels so both trees can share the canvas.
    const nodesA = makeTreeNodes(new Map(Object.entries(treeA.parentMap ?? {})), treeA.ids ?? []);
    const edgesA = makeTreeEdges(new Map(Object.entries(treeA.parentMap ?? {})), treeA.ids ?? []);
    const nodesB = makeTreeNodes(new Map(Object.entries(treeB.parentMap ?? {})), treeB.ids ?? []);
    const edgesB = makeTreeEdges(new Map(Object.entries(treeB.parentMap ?? {})), treeB.ids ?? []);

    const nodes = [...nodesA, ...nodesB];
    const edges = [...edgesA, ...edgesB];

    let step = 0;

    // Frame 0: both trees.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Testing whether two rooted trees are isomorphic.",
        codeLineNumber: 0,
        layout: "tree",
        meta: {},
    };
    step += 1;

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "tree",
        meta: { step, treeACount: treeA.ids?.length ?? 0, treeBCount: treeB.ids?.length ?? 0 },
    });

    // ------------------------------------------------------------------
    // Compute canonical codes for each tree.
    // ------------------------------------------------------------------
    const computeCode = (parentMap: Map<string, string | null>, ids: string[]): string => {
        const children = new Map<string, string[]>();
        for (const id of ids) {
            children.set(id, []);
        }
        for (const [child, parent] of parentMap) {
            if (parent) {
                children.get(parent)?.push(child);
            }
        }
        const root = ids.find((id) => parentMap.get(id) === null) ?? ids[0] ?? "";

        const codeOf = new Map<string, string>();
        const hash = (node: string): string => {
            const childCodes = (children.get(node) ?? []).map(hash).sort();
            const code = `(${childCodes.join("")})`;
            codeOf.set(node, code);
            return code;
        };
        return hash(root);
    };

    const codeA = computeCode(new Map(Object.entries(treeA.parentMap ?? {})), treeA.ids ?? []);
    yield buildFrame(`Tree A root code: ${codeA}.`);
    step += 1;

    const codeB = computeCode(new Map(Object.entries(treeB.parentMap ?? {})), treeB.ids ?? []);
    yield buildFrame(`Tree B root code: ${codeB}.`);
    step += 1;

    // Compare the codes.
    const isomorphic = codeA === codeB;
    const state = isomorphic ? "sorted" : "swapped";
    for (const node of nodes) {
        node.state = state;
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: isomorphic
            ? "The trees ARE isomorphic – their canonical codes match."
            : "The trees are NOT isomorphic – their canonical codes differ.",
        codeLineNumber: 4,
        layout: "tree",
        meta: { isomorphic: isomorphic ? 1 : 0 },
    };
}

/** The Tree Isomorphism module, registered with the engine. */
const module: AlgorithmModule = {
    education: {
        "intuition": "Two rooted trees are isomorphic when a relabeling of vertices preserves the parent-child structure. The classic test assigns each subtree a canonical code built recursively from the sorted codes of its children; two rooted trees are isomorphic exactly when their root codes match.",
        "invariants": [
            "A leaf has the same canonical code everywhere.",
            "A node's code is the sorted concatenation of its children's codes wrapped in delimiters.",
            "Isomorphic subtrees always produce identical codes."
        ],
        "correctness": "If two subtrees are isomorphic, their children pair up into isomorphic subtrees, which by induction have equal codes; sorting removes any child-order difference, so the parent codes are equal. Conversely equal parent codes imply the same multiset of child codes, and by induction the child subtrees are isomorphic, so a structure-preserving bijection exists. Rooting at the center extends the test to unrooted trees.",
        "complexityRationale": "Sorting child codes at every node costs O(n log n) total with O(n) space for the codes. Hash-based versions reduce string handling but keep the same broad bound.",
        "uses": [
            "Comparing parse trees in compilers",
            "Detecting duplicate structures in chemical graphs",
            "Canonicalizing XML or JSON tree documents"
        ],
        "references": [
            "Aho, Sagiv, Szymanski, and Ullman, Finding and Identifying Trees in Linear Time, 1981",
            "CLRS, Introduction to Algorithms, Chapter 22 (tree isomorphism exercises)"
        ],
        "workedExample": "Two rooted trees whose roots each have two leaf children both produce a code with two identical child codes and compare equal, so they are isomorphic. A root with three leaf children produces a different code and is rejected."
    },

    id: "tree-isomorphism",
    name: "Tree Isomorphism",
    category: "tree",
    complexity: { time: "O(n log n)", space: "O(n)" },
    // Tree A (root A) and tree B (root R) are actually isomorphic shapes.
    defaultInput: {
        treeA: {
            parentMap: { B: "A", C: "A", D: "B", E: "B" },
            ids: ["A", "B", "C", "D", "E"],
        },
        treeB: {
            parentMap: { X: "R", Y: "R", Z: "X", W: "X" },
            ids: ["R", "X", "Y", "Z", "W"],
        },
    },
    visualType: "tree",
    run,
    pseudocode: [
        "set up both rooted trees side by side",
        "compute canonical code from sorted child codes",
        "hash tree A root into nested parenthesis code",
        "hash tree B root into nested parenthesis code",
        "return whether root codes match as the answer",
    ],
};

export default module;
