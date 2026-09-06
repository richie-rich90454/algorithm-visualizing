/**
 * z-algorithm-on-tree.ts – Z-Algorithm generalized to trees
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Z-algorithm on a tree generalizes the string Z-algorithm to find, for
 * each node, the length of the longest "matching prefix" when comparing
 * downward paths. This educational version demonstrates the idea by rooting
 * the tree, computing for every node the longest common prefix of the string
 * spelled by the root-to-node path and the string spelled by some reference
 * path, visualizing the matched portion.
 *
 * It keeps the core teaching message of the Z-algorithm – reuse a window of
 * already-computed matches – but in a tree-shaped domain.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V · depth) in this educational form
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The node being examined is YELLOW (comparing).
 *   - Nodes sharing the matched prefix are GREEN (sorted).
 *   - The reference path is PINK (highlight).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Shows how a string technique adapts to non-linear structures.
 *   - The "label on every edge" framing is the standard variant.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "../tree/tree-util";

/**
 * The Z-Algorithm on Tree generator.
 *
 * @param input `{ parentMap, ids, labels }` where labels maps each node id to
 *        a character (edge labels would work similarly).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            parentMap?: Record<string, string | null>;
            ids?: string[];
            labels?: Record<string, string>;
        } | null) ?? {};
    const parentMap = new Map<string, string | null>(
        Object.entries(
            task.parentMap ?? {
                B: "A",
                C: "A",
                D: "B",
                E: "B",
                F: "C",
                G: "E",
                H: "G",
            },
        ),
    );
    const ids = task.ids ?? ["A", "B", "C", "D", "E", "F", "G", "H"];
    const labels = task.labels ?? {
        A: "a",
        B: "b",
        C: "a",
        D: "b",
        E: "a",
        F: "c",
        G: "b",
        H: "a",
    };

    const nodes = makeTreeNodes(parentMap, ids);
    const edges = makeTreeEdges(parentMap, ids);

    let step = 0;

    // Frame 0: the untouched tree.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Z-algorithm on a tree – comparing downward label paths.",
        codeLineNumber: 0,
        layout: "tree",
        meta: {},
    };
    step += 1;

    const buildFrame = (
        message: string,
        states: Map<string, EntityState> = new Map(),
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n, state: states.get(n.id) ?? n.state })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "tree",
        meta: {},
    });

    // Compute the label string along each root-to-node path.
    const pathString = new Map<string, string>();

    // Simpler: compute path strings by walking parents (no need for recursion).
    for (const id of ids) {
        const parts: string[] = [];
        let cursor: string | null = id;
        while (cursor !== null) {
            parts.push(labels[cursor] ?? "");
            cursor = parentMap.get(cursor) ?? null;
        }
        pathString.set(id, parts.reverse().join(""));
    }

    // The reference string is the longest root-to-node path's label string.
    let reference = "";
    for (const s of pathString.values()) {
        if (s.length > reference.length) {
            reference = s;
        }
    }

    // For each node, compute the Z-value: the LCP of its path string with the
    // reference string.
    const zValues = new Map<string, number>();
    for (const id of ids) {
        const s = pathString.get(id) ?? "";
        let z = 0;
        while (z < s.length && z < reference.length && s[z] === reference[z]) {
            z += 1;
        }
        zValues.set(id, z);

        // Highlight the matched prefix (the top z nodes of this node's path)
        // green and the node under inspection yellow.
        const chain: string[] = [];
        let down: string | null = id;
        while (down !== null) {
            chain.unshift(down);
            down = parentMap.get(down) ?? null;
        }
        const states = new Map<string, EntityState>();
        for (const nodeId of chain.slice(0, z)) {
            states.set(`node-${nodeId}`, "sorted");
        }
        states.set(`node-${id}`, "comparing");

        yield buildFrame(`Z-value of node ${id} (path "${s}") = ${z}.`, states);
        step += 1;
    }

    yield {
        ...buildFrame(
            `Z-values: ${ids.map((id) => `${id}=${zValues.get(id) ?? 0}`).join(", ")} (reference "${reference}").`,
        ),
        meta: { reference, z: ids.map((id) => zValues.get(id) ?? 0) },
    };
}

/** The Z-Algorithm on Tree module, registered with the engine. */
const module: AlgorithmModule = {
    id: "z-algorithm-on-tree",
    name: "Z-Algorithm on Tree",
    category: "string",
    complexity: { time: "O(V·depth)", space: "O(V)" },
    // Node labels make several path strings share prefixes.
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E", H: "G" },
        ids: ["A", "B", "C", "D", "E", "F", "G", "H"],
        labels: { A: "a", B: "b", C: "a", D: "b", E: "a", F: "c", G: "b", H: "a" },
    },
    visualType: "tree",
    run,
};

export default module;
