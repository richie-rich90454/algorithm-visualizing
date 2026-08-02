/**
 * heavy-light-decomposition.ts – Heavy-Light Decomposition (HLD)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Heavy-light decomposition splits a tree into O(log V) "heavy paths" so that
 * any root-to-leaf route crosses at most O(log V) paths. Each node's heaviest
 * child (the child with the largest subtree) continues its heavy path; the
 * other children start new paths. Path queries then decompose into O(log V)
 * segment-tree-ish range operations, which is why HLD is the standard tool
 * for "path update / path query" tree problems.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V) to decompose; each path query is O(log² V)
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The node being processed is YELLOW (comparing).
 *   - Heavy-path edges are highlighted BLUE (active).
 *   - Nodes on a common heavy path share a colour.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The light/heavy split guarantees the O(log V) path bound.
 *   - Often paired with a segment tree for actual queries.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

/**
 * The Heavy-Light Decomposition generator.
 *
 * @param input `{ parentMap, ids }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { parentMap?: Record<string, string | null>; ids?: string[] } | null) ?? {};
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
        description: "Heavy-light decomposition – routing heavy children into shared paths.",
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
    // Pass 1: compute subtree sizes to identify each node's heavy child.
    // ------------------------------------------------------------------
    const subtreeSize = new Map<string, number>();

    const computeSizes = function* (node: string): Generator<VisualFrame, number, unknown> {
        let total = 1;
        for (const child of children.get(node) ?? []) {
            total += yield* computeSizes(child);
        }
        subtreeSize.set(node, total);
        return total;
    };
    yield* computeSizes(root);

    // Heavy child of each node = the child with the largest subtree.
    const heavyChild = new Map<string, string | null>();
    for (const id of ids) {
        let heaviest: string | null = null;
        let heaviestSize = -1;
        for (const child of children.get(id) ?? []) {
            const childSize = subtreeSize.get(child) ?? 0;
            if (childSize > heaviestSize) {
                heaviestSize = childSize;
                heaviest = child;
            }
        }
        heavyChild.set(id, heaviest);
    }

    // ------------------------------------------------------------------
    // Pass 2: decompose into heavy paths and colour them.
    // ------------------------------------------------------------------
    const pathColours = ["active", "path", "highlight", "visited"] as const;
    let pathIndex = 0;
    const pathOf = new Map<string, number>();

    const decompose = function* (node: string): Generator<VisualFrame, void, unknown> {
        // Walk down the chain of heavy children, assigning them to one path.
        let current: string | null = node;
        const pathMembers: string[] = [];
        while (current !== null) {
            pathMembers.push(current);
            current = heavyChild.get(current) ?? null;
        }

        const colour = pathColours[pathIndex % pathColours.length] ?? "active";
        pathIndex += 1;

        // Colour this heavy path's edges and nodes.
        for (let i = 0; i < pathMembers.length - 1; i += 1) {
            const a = pathMembers[i] as string;
            const b = pathMembers[i + 1] as string;
            pathOf.set(a, pathIndex);
            const edge = edges.find(
                (e) => e.sourceId === `node-${a}` && e.targetId === `node-${b}`,
            );
            if (edge) {
                edge.state = colour === "visited" ? "active" : colour;
            }
            const nodeEntity = nodeById.get(`node-${a}`);
            if (nodeEntity) {
                nodeEntity.state = colour;
            }
        }
        if (pathMembers.length > 0) {
            const last = pathMembers[pathMembers.length - 1] as string;
            const lastEntity = nodeById.get(`node-${last}`);
            if (lastEntity) {
                lastEntity.state = colour;
            }
        }

        yield buildFrame(`Heavy path #${pathIndex}: ${pathMembers.join(" → ")}.`);
        step += 1;

        // Recurse on every light child (they start their own paths).
        for (const member of pathMembers) {
            for (const child of children.get(member) ?? []) {
                if (heavyChild.get(member) !== child) {
                    yield* decompose(child);
                }
            }
        }
    };

    yield* decompose(root);

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `HLD complete – the tree is split into ${pathIndex} heavy path(s).`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { paths: pathIndex },
    };
}

/** The Heavy-Light Decomposition module, registered with the engine. */
const module: AlgorithmModule = {
    id: "heavy-light-decomposition",
    name: "Heavy-Light Decomposition",
    category: "tree",
    complexity: { time: "O(V)", space: "O(V)" },
    // The standard tree – B, E, G, H form one long heavy path.
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E", H: "G" },
        ids: ["A", "B", "C", "D", "E", "F", "G", "H"],
    },
    visualType: "tree",
    run,
};

export default module;
