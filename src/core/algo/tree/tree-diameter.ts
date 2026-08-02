/**
 * tree-diameter.ts – Tree Diameter (two BFS/DFS passes)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The diameter of a tree is the length of the longest path between any two
 * vertices. There is a beautiful trick to find it in two passes:
 *
 *   1. From any vertex, find the farthest vertex A (a BFS/DFS).
 *   2. From A, find the farthest vertex B (another BFS/DFS).
 *
 * The path A→B is a diameter. This works for trees (not general graphs)
 * because of the tree's unique-path structure.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V) – two traversals
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - Pass 1 vertices are visited in ORANGE (visited).
 *   - The farthest vertex A is YELLOW (comparing).
 *   - Pass 2 marks the diameter path CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - One of the cleanest "two-pass trick" algorithms in graph theory.
 *   - The same trick appears in problems about tree centres and radii.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

/**
 * The Tree Diameter generator.
 *
 * @param input `{ parentMap, ids }` – child→parent map plus ordered ids.
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

    // Build the undirected adjacency for the traversals.
    const adjacency = new Map<string, string[]>();
    for (const id of ids) {
        adjacency.set(id, []);
    }
    for (const [child, parent] of parentMap) {
        if (parent) {
            adjacency.get(child)?.push(parent);
            adjacency.get(parent)?.push(child);
        }
    }

    let step = 0;
    const diameter: string[] = [];

    // Frame 0: the untouched tree.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Tree diameter – pass 1: find the farthest vertex from an arbitrary start.",
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
    // Pass 1: BFS from an arbitrary vertex (use the first id).
    // ------------------------------------------------------------------
    const start = ids[0] ?? "A";

    const bfs = (root: string): { farthest: string; parent: Map<string, string | null> } => {
        const parent = new Map<string, string | null>([[root, null]]);
        const queue: string[] = [root];
        let farthest = root;
        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            farthest = current;
            for (const neighbour of adjacency.get(current) ?? []) {
                if (!parent.has(neighbour)) {
                    parent.set(neighbour, current);
                    queue.push(neighbour);
                }
            }
        }
        return { farthest, parent };
    };

    const pass1 = bfs(start);

    // Colour everything visited in pass 1.
    for (const id of pass1.parent.keys()) {
        const node = nodeById.get(`node-${id}`);
        if (node) {
            node.state = "visited";
        }
    }
    const aNode = nodeById.get(`node-${pass1.farthest}`);
    if (aNode) {
        aNode.state = "comparing";
    }
    yield buildFrame(`Pass 1 complete – farthest vertex from ${start} is ${pass1.farthest}.`);
    step += 1;

    // ------------------------------------------------------------------
    // Pass 2: BFS from A; the farthest vertex B completes the diameter.
    // ------------------------------------------------------------------
    for (const node of nodes) {
        node.state = "unvisited";
    }

    const pass2 = bfs(pass1.farthest);

    // Reconstruct the A→B path.
    let cursor: string | null = pass2.farthest;
    while (cursor !== null) {
        diameter.push(cursor);
        cursor = pass2.parent.get(cursor) ?? null;
    }

    // Colour the diameter path cyan.
    for (const node of nodes) {
        node.state = "visited";
    }
    for (let i = 0; i < diameter.length - 1; i += 1) {
        const edge = edges.find(
            (e) =>
                (e.sourceId === `node-${diameter[i]}` &&
                    e.targetId === `node-${diameter[i + 1]}`) ||
                (e.sourceId === `node-${diameter[i + 1]}` && e.targetId === `node-${diameter[i]}`),
        );
        if (edge) {
            edge.state = "path";
        }
    }
    for (const id of diameter) {
        const node = nodeById.get(`node-${id}`);
        if (node) {
            node.state = "path";
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Diameter is ${diameter.length - 1} edges along ${diameter.join(" → ")}.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { diameter: diameter.length - 1 },
    };
}

/** The Tree Diameter module, registered with the engine. */
const module: AlgorithmModule = {
    id: "tree-diameter",
    name: "Tree Diameter",
    category: "tree",
    complexity: { time: "O(V)", space: "O(V)" },
    // A tree whose longest path runs D–B–E–G–H (4 edges).
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E", H: "G" },
        ids: ["A", "B", "C", "D", "E", "F", "G", "H"],
    },
    visualType: "tree",
    run,
};

export default module;
