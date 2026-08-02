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
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The two trees are drawn side by side.
 *   - The node being hashed is YELLOW (comparing).
 *   - Matching structures are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The hashing trick reduces structural comparison to string comparison.
 *   - Generalises to unrooted trees by rooting at the tree centre.
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
        meta: {},
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
        meta: { isomorphic },
    };
}

/** The Tree Isomorphism module, registered with the engine. */
const module: AlgorithmModule = {
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
};

export default module;
