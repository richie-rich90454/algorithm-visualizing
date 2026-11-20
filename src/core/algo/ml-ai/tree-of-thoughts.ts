/**
 * tree-of-thoughts.ts - Beam Search Over a Thought Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Tree of Thoughts explores a problem as a tree of partial solutions, or
 * thoughts, instead of a single chain. At each depth it generates child
 * thoughts, scores them with a heuristic, and keeps only the best beam to carry
 * forward. Search stops when a thought is marked as a goal. This module
 * implements the teachable core: breadth-first expansion with a fixed-width
 * beam and a deterministic score supplied for every thought. It is the search
 * and pruning logic, not an LLM prompt or an evaluator model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(V log V) to sort the children at each depth, V = number of thoughts
 *   Space: O(V) for the tree, scores, and beam
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Every thought is a tree node with a parentId edge to its predecessor.
 *   - The current beam is active, scored children are yellow, the solution path
 *     is green, and pruned thoughts dim out.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Thought {
    id: string;
    parent: string;
    score: number;
    goal?: boolean;
}

interface TotInput {
    nodes?: Thought[];
    beamWidth?: number;
}

function makeEntities(
    nodes: Thought[],
    frontier: Set<string>,
    candidates: Set<string>,
    visited: Set<string>,
    path: Set<string>,
): VisualEntity[] {
    return nodes.map((node, index) => {
        let state: EntityState = "unvisited";
        if (path.has(node.id)) {
            state = "path";
        } else if (frontier.has(node.id)) {
            state = "active";
        } else if (candidates.has(node.id)) {
            state = "comparing";
        } else if (visited.has(node.id)) {
            state = "visited";
        }
        return {
            id: `node-${node.id}`,
            type: "node" as const,
            label: node.goal ? `${node.id}*` : node.id,
            value: node.score,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                depth: 0,
                parentId: node.parent ? `node-${node.parent}` : "",
                score: node.score,
                goal: node.goal === true,
                index,
            },
        };
    });
}

function makeEdges(nodes: Thought[]): VisualEdge[] {
    return nodes
        .filter((node) => node.parent !== "")
        .map((node) => ({
            id: `edge-${node.parent}-${node.id}`,
            sourceId: `node-${node.parent}`,
            targetId: `node-${node.id}`,
            label: "",
            state: "visited" as EntityState,
            directed: true,
        }));
}

/** Default thought tree: root a, two children each level, goal at h. */
const DEFAULT_NODES: Thought[] = [
    { id: "a", parent: "", score: 0 },
    { id: "b", parent: "a", score: 3 },
    { id: "c", parent: "a", score: 1 },
    { id: "d", parent: "b", score: 4 },
    { id: "e", parent: "b", score: 2 },
    { id: "f", parent: "c", score: 5 },
    { id: "g", parent: "c", score: 0 },
    { id: "h", parent: "d", score: 9, goal: true },
    { id: "i", parent: "d", score: 2 },
    { id: "j", parent: "f", score: 1 },
    { id: "k", parent: "f", score: 8 },
];

/** Beam-search a thought tree for a goal thought. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TotInput | null) ?? {};
    const nodes: Thought[] = Array.isArray(task.nodes) && task.nodes.length > 0 ? task.nodes : DEFAULT_NODES;
    const beamWidth = Math.max(1, typeof task.beamWidth === "number" ? Math.trunc(task.beamWidth) : 2);

    const byId = new Map<string, Thought>();
    for (const node of nodes) {
        byId.set(node.id, node);
    }
    const childrenOf = new Map<string, Thought[]>();
    for (const node of nodes) {
        if (node.parent === "") {
            continue;
        }
        const list = childrenOf.get(node.parent) ?? [];
        list.push(node);
        childrenOf.set(node.parent, list);
    }

    const root = nodes.find((node) => node.parent === "") ?? nodes[0]!;
    let frontier: string[] = [root.id];
    const visited = new Set<string>();
    const frontierSet = new Set<string>(frontier);
    const candidates = new Set<string>();
    const path = new Set<string>();
    let solution = "";
    let depth = 0;

    yield {
        stepNumber: 0,
        entities: makeEntities(nodes, frontierSet, candidates, visited, path),
        edges: makeEdges(nodes),
        description: `Tree of Thoughts: ${nodes.length} thoughts, beam width ${beamWidth}; the root is ${root.id}.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { beamWidth, depth: 0, frontier: [], solution: "", found: false },
    };
    let step = 1;

    while (frontier.length > 0) {
        frontierSet.clear();
        for (const id of frontier) {
            frontierSet.add(id);
        }
        yield {
            stepNumber: step,
            entities: makeEntities(nodes, frontierSet, candidates, visited, path),
            edges: makeEdges(nodes),
            description: `Depth ${depth}: the beam holds ${frontier.join(", ")} with scores ${frontier.map((id) => byId.get(id)?.score ?? 0).join(", ")}.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { beamWidth, depth, frontier: frontier.slice(), solution: "", found: false },
        };
        step += 1;

        const goal = frontier.find((id) => byId.get(id)?.goal === true);
        if (goal !== undefined) {
            solution = goal;
            let cursor: string | undefined = goal;
            while (cursor !== undefined && cursor !== "") {
                path.add(cursor);
                cursor = byId.get(cursor)?.parent;
            }
            break;
        }

        candidates.clear();
        const next: Thought[] = [];
        for (const id of frontier) {
            visited.add(id);
            for (const child of childrenOf.get(id) ?? []) {
                candidates.add(child.id);
                next.push(child);
            }
        }
        if (next.length === 0) {
            break;
        }
        next.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
        frontier = next.slice(0, beamWidth).map((node) => node.id);
        depth += 1;
    }

    const found = solution !== "";
    yield {
        stepNumber: step,
        entities: makeEntities(nodes, new Set(), new Set(), visited, path),
        edges: makeEdges(nodes),
        description: found
            ? `Done: goal thought ${solution} reached at depth ${depth} along path ${[...path].join(" -> ")}.`
            : `Done: no goal thought survived the beam; explored depth ${depth}.`,
        codeLineNumber: 7,
        layout: "tree",
        meta: { beamWidth, depth, frontier: [], solution, found, path: [...path] },
    };
}

/** The Tree of Thoughts module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of committing to one line of reasoning, keep several candidate partial solutions and expand the most promising ones. At each level you generate children, rank them with a score, and throw away all but the best few. That beam is small enough to manage yet wide enough to recover from an early wrong turn, and a goal check ends the search as soon as a complete solution appears.",
        invariants: [
            "A thought is expanded only after it has entered the beam at an earlier depth.",
            "Children are ranked by score with ties broken consistently by id.",
            "Search stops immediately when a beam member is marked as a goal.",
        ],
        correctness:
            "The procedure is a breadth-first traversal in which each level's frontier is the top-k children of the previous level by the supplied score. Inductively the beam after depth d is exactly the set that an exhaustive sort of that level's children would keep, so no higher-scoring child is ever discarded in favor of a lower one. If a goal survives pruning it is reported together with the unique parent chain back to the root, which is a valid solution path.",
        complexityRationale:
            "Each depth generates every child of the current beam and sorts the candidates, costing O(V log V) across all levels for V thoughts. The tree, the score map, and the beam all use O(V) space.",
        uses: [
            "Deliberate multi-step reasoning in language model agents",
            "Puzzle solving and planning with heuristic scoring",
            "Any search where keeping a few alternatives beats a single greedy path",
        ],
        references: [
            "Yao et al., Tree of Thoughts: Deliberate Problem Solving with Large Language Models, 2023",
            "Newell and Simon, Human Problem Solving, 1972",
        ],
        workedExample:
            "Starting at root a with beam width 2, children b score 3 and c score 1 both survive. Expanding b gives d (4) and e (2); expanding c gives f (5) and g (0). The next beam is f and d. Expanding d reveals child h marked as a goal with score 9, so search stops and reports the path a to b to d to h.",
    },
    id: "tree-of-thoughts",
    name: "Tree of Thoughts (Beam Search Core)",
    category: "ml-ai",
    complexity: { time: "O(V log V)", space: "O(V)" },
    defaultInput: { nodes: DEFAULT_NODES, beamWidth: 2 },
    visualType: "tree",
    run,
    pseudocode: [
        "index every thought by id and group children by parent",
        "place the root in the initial beam at depth zero",
        "while the beam is not empty",
        "if a beam thought is a goal, report it and its parent chain",
        "expand each beam thought and collect its scored children",
        "sort children by score and keep the top beam width",
        "record the new beam and advance the depth",
        "done: report the goal path or that none was found",
    ],
};

export default module;
