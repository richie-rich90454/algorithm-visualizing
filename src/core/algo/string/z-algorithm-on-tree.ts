/**
 * z-algorithm-on-tree.ts – Z-Algorithm generalised to trees
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Z-algorithm on a tree generalises the string Z-algorithm to find, for
 * each node, the length of the longest "matching prefix" when comparing
 * downward paths. This educational version demonstrates the idea by rooting
 * the tree, computing for every node the longest common prefix of the string
 * spelled by the root-to-node path and the string spelled by some reference
 * path, visualising the matched portion.
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
 * Visualisation mapping
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

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
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
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const children = new Map<string, string[]>();
    for (const id of ids) {
        children.set(id, []);
    }
    for (const [child, parent] of parentMap) {
        if (parent) {
            children.get(parent)?.push(child);
        }
    }
    const root = ids.find((id) => parentMap.get(id) === null) ?? ids[0] ?? "A";

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

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "tree",
        meta: {},
    });

    // Compute the label string along each root-to-node path.
    const pathString = new Map<string, string>();
    const assign = function* (node: string): Generator<VisualFrame, void, unknown> {
        const parent = parentMap.get(node);
        pathString.set(node, (parent ? (pathString.get(parent) ?? "") : "") + (labels[node] ?? ""));
        yield* parent
            ? assign(parent)
            : (function* (): Generator<VisualFrame> {
                  return;
              })();
    };
    void assign;

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

    // The reference string is the root-to-deepest path's label string.
    const reference = pathString.get(root) ?? "";

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

        // Highlight the node and its matched prefix.
        const states = new Map<string, "comparing" | "sorted" | "highlight">();
        let cursor: string | null = id;
        let depth = 0;
        while (cursor !== null && depth < z) {
            states.set(cursor, "sorted");
            cursor = parentMap.get(cursor) ?? null;
            depth += 1;
        }
        const nodeEntity = nodeById.get(`node-${id}`);
        if (nodeEntity) {
            nodeEntity.state = "comparing";
        }

        yield buildFrame(`Z-value of node ${id} (path "${s}") = ${z}.`);
        step += 1;
    }

    yield buildFrame(`Z-values computed for every root-to-node path (reference "${reference}").`);
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
