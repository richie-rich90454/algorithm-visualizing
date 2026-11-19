/**
 * ao-star.ts - AO* Search over an AND-OR Graph
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AO* searches a problem reduction graph. An OR node chooses one operator;
 * an AND operator requires all of its children to be solved. The algorithm
 * keeps an explicit graph of nodes it has generated, estimates the cost of the
 * best partial solution with admissible heuristics at the unexpanded tips,
 * follows that cheapest partial solution to a tip, expands the tip, and
 * revises the costs back up the graph. It stops when the best solution graph
 * contains no unexpanded tip.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V * A) for V generated nodes and A operators, on a DAG
 *   Space: O(V + E) for the explicit graph and its cost labels
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes on the current best solution graph are GREEN (path).
 *   - The tip selected for expansion is PINK (highlight).
 *   - Already expanded nodes are BLUE (visited).
 *   - Edges on the chosen solution are GREEN; other generated edges are idle.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Operator {
    cost: number;
    children: string[];
}

interface NodeDef {
    h: number;
    goal?: boolean;
    ops?: Operator[];
}

interface AoInput {
    root?: string;
    nodes?: Record<string, NodeDef>;
}

const DEFAULT_NODES: Record<string, NodeDef> = {
    S: { h: 0, ops: [{ cost: 1, children: ["A", "B"] }, { cost: 2, children: ["E"] }] },
    A: { h: 1, ops: [{ cost: 3, children: ["G1"] }] },
    B: { h: 1, ops: [{ cost: 3, children: ["G2"] }] },
    E: { h: 2, ops: [{ cost: 2, children: ["G3"] }] },
    G1: { h: 0, goal: true, ops: [] },
    G2: { h: 0, goal: true, ops: [] },
    G3: { h: 0, goal: true, ops: [] },
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AoInput | null) ?? {};
    const defs = task.nodes && Object.keys(task.nodes).length > 0 ? task.nodes : DEFAULT_NODES;
    const root = typeof task.root === "string" && defs[task.root] ? task.root : "S";
    const expanded = new Set<string>();
    let step = 0;
    let expansions = 0;

    const cost = (id: string, path: Set<string>): number => {
        const def = defs[id];
        if (!def) {
            return Number.POSITIVE_INFINITY;
        }
        if (def.goal) {
            return 0;
        }
        if (!expanded.has(id)) {
            return def.h;
        }
        let best = Number.POSITIVE_INFINITY;
        for (const op of def.ops ?? []) {
            if (op.children.some((c) => path.has(c))) {
                continue;
            }
            const nextPath = new Set(path);
            nextPath.add(id);
            let total = op.cost;
            let valid = true;
            for (const child of op.children) {
                const sub = cost(child, nextPath);
                if (!Number.isFinite(sub)) {
                    valid = false;
                    break;
                }
                total += sub;
            }
            if (valid && total < best) {
                best = total;
            }
        }
        return best;
    };

    // Reconstruct the cheapest partial solution graph: node set, edge set and
    // the operator chosen at each node.
    const bestGraph = (): { nodes: Set<string>; edges: string[]; plan: string[]; cost: number } => {
        const nodes = new Set<string>();
        const edgeSet = new Set<string>();
        const plan: string[] = [];
        const visit = (id: string, path: Set<string>): number => {
            nodes.add(id);
            const def = defs[id];
            if (!def || def.goal || !expanded.has(id)) {
                return def?.h ?? 0;
            }
            let best = Number.POSITIVE_INFINITY;
            let bestOp: Operator | undefined;
            for (const op of def.ops ?? []) {
                if (op.children.some((c) => path.has(c))) {
                    continue;
                }
                const nextPath = new Set(path);
                nextPath.add(id);
                let total = op.cost;
                for (const child of op.children) {
                    total += visit(child, nextPath);
                }
                if (total < best) {
                    best = total;
                    bestOp = op;
                }
            }
            if (bestOp) {
                plan.push(`${id}->${bestOp.children.join(",")}`);
                for (const child of bestOp.children) {
                    edgeSet.add(`${id}-${child}`);
                }
            }
            return best;
        };
        const total = visit(root, new Set<string>());
        return { nodes, edges: [...edgeSet], plan, cost: total };
    };

    const knownNodes = (): string[] => {
        const ids = new Set<string>([root]);
        for (const id of [...expanded]) {
            for (const op of defs[id]?.ops ?? []) {
                for (const child of op.children) {
                    ids.add(child);
                }
            }
        }
        return [...ids].sort();
    };

    const frame = (
        description: string,
        codeLineNumber: number,
        graph: { nodes: Set<string>; edges: string[] },
        tip: string,
        extra: Record<string, number | string | boolean | string[]> = {},
    ): VisualFrame => {
        const ids = knownNodes();
        const nodes: VisualEntity[] = ids.map((id) => {
            let state: EntityState = "unvisited";
            if (defs[id]?.goal) {
                state = "sorted";
            } else if (expanded.has(id)) {
                state = "visited";
            }
            if (graph.nodes.has(id)) {
                state = "path";
            }
            if (id === tip) {
                state = "highlight";
            }
            return {
                id: `node-${id}`,
                type: "node" as const,
                label: id,
                value: id,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { label: id, heuristic: defs[id]?.h ?? 0 },
            };
        });
        const edges: VisualEdge[] = [];
        const seen = new Set<string>();
        for (const id of ids) {
            for (const op of defs[id]?.ops ?? []) {
                for (const child of op.children) {
                    const key = `${id}-${child}`;
                    if (seen.has(key) || !ids.includes(child)) {
                        continue;
                    }
                    seen.add(key);
                    edges.push({
                        id: `edge-${key}`,
                        sourceId: `node-${id}`,
                        targetId: `node-${child}`,
                        label: String(op.cost),
                        state: graph.edges.includes(key) ? "path" : "idle",
                        directed: true,
                    });
                }
            }
        }
        return {
            stepNumber: step,
            entities: nodes,
            edges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                expansions,
                bestCost: graph.nodes.has(root) ? cost(root, new Set<string>()) : 0,
                tip,
                generatedNodes: ids.length,
                ...extra,
            },
        };
    };

    yield frame(`AO* begins at ${root}; only the root is in the explicit graph so far.`, 0, bestGraph(), "");
    step += 1;

    while (expansions < 100) {
        const graph = bestGraph();
        const tips = [...graph.nodes].filter((id) => !expanded.has(id) && !defs[id]?.goal);
        yield frame(
            `Cheapest partial solution costs ${graph.cost}; ${tips.length} unexpanded tip(s) remain.`,
            2,
            graph,
            tips[0] ?? "",
            { partialCost: graph.cost },
        );
        step += 1;
        if (tips.length === 0) {
            break;
        }
        tips.sort((a, b) => cost(a, new Set<string>()) - cost(b, new Set<string>()) || a.localeCompare(b));
        const tip = tips[0] as string;
        expanded.add(tip);
        expansions += 1;
        yield frame(
            `Expanding tip ${tip} adds ${(defs[tip]?.ops ?? []).length} operator(s) and their children; costs are recomputed upward.`,
            5,
            bestGraph(),
            tip,
        );
        step += 1;
    }

    const graph = bestGraph();
    yield frame(
        `Solution graph found with cost ${graph.cost} after ${expansions} expansion(s): ${graph.plan.join("; ")}.`,
        7,
        graph,
        "",
        { plan: graph.plan, done: true },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "AO* is A* adapted to problems where an operator decomposes a task into several subtasks that all have to succeed. It solves only the cheapest partial plan seen so far. When a tip of that plan is expanded and turns out to be expensive, the estimates propagate back up and the search may switch to a completely different operator.",
        invariants: [
            "Every node in the explicit graph is either goal, expanded, or an unexpanded tip with a heuristic estimate.",
            "Heuristic values never exceed the true cheapest solution cost from that node.",
            "The chosen solution graph is always the minimum-cost graph over the currently generated nodes.",
        ],
        correctness:
            "With admissible estimates the cost labeled on a partially expanded node is a lower bound on its true cost, so following the cheapest partial graph can never discard a better complete solution. Expanding a tip makes its estimate exact or better, and recomputing upward restores the minimum over all generated graphs. When no unexpanded tip remains, every cost on the chosen graph is exact, so its total is the true optimum.",
        complexityRationale:
            "Each of the V generated nodes is expanded once and each of its A operators is scanned during cost propagation, giving O(V times A) time on an acyclic reduction graph. The explicit graph, its cost labels, and the open tips require O(V + E) space.",
        uses: [
            "Automated planning where an action decomposes into several subgoals",
            "And-or proof search in theorem provers and logic programming",
            "Game-tree and problem-reduction systems with heuristic guidance",
        ],
        references: [
            "Nilsson, Problem-Solving Methods in Artificial Intelligence, Chapter on AO*",
            "Pearl, Heuristics: Intelligent Search Strategies for Computer Problem Solving",
        ],
        workedExample:
            "At S, operator one costs 1 plus estimates 1 and 1 for A and B, totaling 3, while operator two costs 2 plus estimate 2 for E, totaling 4, so AO* expands A first. Expanding A reveals a real cost of 3, raising operator one to 5; the search switches to E, whose expansion confirms cost 2, and the final plan costs 4.",
    },
    id: "ao-star",
    name: "AO* Search",
    category: "searching",
    complexity: { time: "O(V * A)", space: "O(V + E)" },
    defaultInput: { root: "S", nodes: DEFAULT_NODES },
    visualType: "graph",
    run,
    pseudocode: [
        "place the root in the explicit graph with its heuristic estimate",
        "compute costs bottom up using estimates at unexpanded tips",
        "follow the cheapest operator to form the current solution graph",
        "if that graph has no unexpanded tip, stop",
        "choose the tip with the smallest estimated cost",
        "expand the tip and add every child of every operator",
        "recompute costs upward and revise the chosen operators",
        "done: report the minimum-cost AND-OR solution graph",
    ],
};

export default module;
