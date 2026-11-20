/**
 * do-calculus.ts - Pearl's Do-Calculus Back-Door Identification
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Do-calculus answers whether a causal effect P(Y | do(X)) can be computed from
 * observational data. This module implements the back-door criterion, a direct
 * consequence of the do-calculus rules. It rejects adjustment sets containing a
 * descendant of the treatment, then removes the treatment's outgoing edges and
 * enumerates every remaining path to the outcome. A path is blocked when it has
 * a conditioned non-collider or an unconditioned collider with no conditioned
 * descendant. If all such back-door paths are blocked, the adjustment formula
 * gives the causal effect by averaging the conditional outcome over the
 * covariates.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V * (E + P * L)) for V nodes, E edges, P simple paths of length L
 *   Space: O(V + E) for the adjacency structures and path stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The treatment is PIVOT, the outcome is HIGHLIGHT, adjustment nodes are BLUE.
 *   - Edges leaving the treatment are marked SWAPPED because do-calculus deletes them.
 *   - The final frame reports the criterion verdict and the adjusted effect.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "../graph/graph-util";

type Edge = [string, string];

interface Input {
    edges?: Edge[];
    treatment?: string;
    outcome?: string;
    adjust?: string[];
    pYGivenXZ?: Record<string, Record<string, number>>;
    pZ?: Record<string, number>;
}

const DEFAULT_INPUT: Required<Input> = {
    edges: [
        ["Z", "X"],
        ["Z", "Y"],
        ["X", "Y"],
    ],
    treatment: "X",
    outcome: "Y",
    adjust: ["Z"],
    pYGivenXZ: {
        "1": { Z: 0.9 },
        "0": { Z: 0.3 },
    },
    pZ: { Z: 1 },
};

function descendants(edges: Edge[], start: string): Set<string> {
    const adjacency = new Map<string, string[]>();
    for (const [from, to] of edges) {
        const list = adjacency.get(from) ?? [];
        list.push(to);
        adjacency.set(from, list);
    }
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
        const node = stack.pop();
        if (node === undefined) {
            continue;
        }
        for (const next of adjacency.get(node) ?? []) {
            if (next !== start && !seen.has(next)) {
                seen.add(next);
                stack.push(next);
            }
        }
    }
    return seen;
}

/** Enumerate all simple undirected paths between two nodes in a graph. */
function allSimplePaths(undirected: Map<string, string[]>, from: string, to: string): string[][] {
    const paths: string[][] = [];
    const stack: string[][] = [[from]];
    while (stack.length > 0) {
        const path = stack.pop();
        if (path === undefined) {
            continue;
        }
        const current = path[path.length - 1];
        if (current === to) {
            paths.push(path);
            continue;
        }
        for (const next of undirected.get(current) ?? []) {
            if (!path.includes(next)) {
                stack.push([...path, next]);
            }
        }
    }
    return paths;
}

function pathBlocked(path: string[], edges: Edge[], adjust: Set<string>): boolean {
    const directed = new Set(edges.map(([from, to]) => `${from}->${to}`));
    for (let i = 1; i < path.length - 1; i += 1) {
        const previous = path[i - 1];
        const node = path[i];
        const next = path[i + 1];
        if (previous === undefined || node === undefined || next === undefined) {
            continue;
        }
        const arrowFromPrevious = directed.has(`${previous}->${node}`);
        const arrowFromNext = directed.has(`${next}->${node}`);
        const collider = arrowFromPrevious && arrowFromNext;
        if (collider) {
            const conditioned = adjust.has(node);
            const conditionedDescendant = [...descendants(edges, node)].some((d) => adjust.has(d));
            if (!conditioned && !conditionedDescendant) {
                return true;
            }
        } else if (adjust.has(node)) {
            return true;
        }
    }
    return false;
}

function adjustedEffect(input: Required<Input>, treatmentValue: string): number {
    const table = input.pYGivenXZ[treatmentValue] ?? {};
    let total = 0;
    let weight = 0;
    for (const [z, probabilityZ] of Object.entries(input.pZ)) {
        const conditional = table[z] ?? 0;
        total += conditional * probabilityZ;
        weight += probabilityZ;
    }
    return weight > 0 ? total / weight : 0;
}

function buildEntities(
    input: Required<Input>,
    nodes: VisualEntity[],
    edges: VisualEdge[],
): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const adjust = new Set(input.adjust);
    const styledNodes = nodes.map((node) => {
        let state: EntityState = "unvisited";
        if (node.value === input.treatment) {
            state = "pivot";
        } else if (node.value === input.outcome) {
            state = "highlight";
        } else if (adjust.has(String(node.value))) {
            state = "active";
        }
        return { ...node, state };
    });
    const styledEdges = edges.map((edge) => {
        const source = edge.sourceId.replace("node-", "");
        const deleted = source === input.treatment;
        const relevant = adjust.has(source) || edge.targetId.replace("node-", "") === input.outcome;
        return { ...edge, state: (deleted ? "swapped" : relevant ? "active" : "idle") as EntityState };
    });
    return { nodes: styledNodes, edges: styledEdges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const raw = (input as Input | null) ?? {};
    const task: Required<Input> = {
        edges: raw.edges ?? DEFAULT_INPUT.edges,
        treatment: raw.treatment ?? DEFAULT_INPUT.treatment,
        outcome: raw.outcome ?? DEFAULT_INPUT.outcome,
        adjust: raw.adjust ?? DEFAULT_INPUT.adjust,
        pYGivenXZ: raw.pYGivenXZ ?? DEFAULT_INPUT.pYGivenXZ,
        pZ: raw.pZ ?? DEFAULT_INPUT.pZ,
    };

    const vertices: string[] = [];
    for (const [from, to] of task.edges) {
        if (!vertices.includes(from)) {
            vertices.push(from);
        }
        if (!vertices.includes(to)) {
            vertices.push(to);
        }
    }
    const baseNodes = makeGraphNodes(vertices);
    const adjacency: Record<string, string[]> = {};
    for (const vertex of vertices) {
        adjacency[vertex] = [];
    }
    for (const [from, to] of task.edges) {
        adjacency[from]?.push(to);
    }
    const baseEdges = makeGraphEdges(adjacency);
    const styled = buildEntities(task, baseNodes, baseEdges);

    const adjust = new Set(task.adjust);
    const desc = descendants(task.edges, task.treatment);
    const hasDescendantInAdjust = [...desc].some((node) => adjust.has(node));

    const undirected = new Map<string, string[]>();
    for (const [from, to] of task.edges) {
        if (from === task.treatment) {
            continue;
        }
        const a = undirected.get(from) ?? [];
        const b = undirected.get(to) ?? [];
        if (!a.includes(to)) {
            a.push(to);
        }
        if (!b.includes(from)) {
            b.push(from);
        }
        undirected.set(from, a);
        undirected.set(to, b);
    }
    const paths = allSimplePaths(undirected, task.treatment, task.outcome);
    const blocked = paths.map((path) => pathBlocked(path, task.edges, adjust));
    const satisfied = !hasDescendantInAdjust && blocked.every((value) => value);

    const effect1 = adjustedEffect(task, "1");
    const effect0 = adjustedEffect(task, "0");
    const ace = effect1 - effect0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: styled.nodes.map((n) => ({ ...n })),
        edges: styled.edges.map((e) => ({ ...e })),
        description: `Causal graph with ${vertices.length} node(s): treatment ${task.treatment}, outcome ${task.outcome}, adjustment set {${task.adjust.join(", ")}}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { nodes: vertices.length, treatment: task.treatment, outcome: task.outcome, adjust: task.adjust },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: styled.nodes.map((n) => ({ ...n })),
        edges: styled.edges.map((e) => ({ ...e })),
        description: `Descendant check: ${hasDescendantInAdjust ? "the adjustment set contains a descendant of the treatment" : "no adjustment node is a descendant of the treatment"}.`,
        codeLineNumber: 1,
        layout: "graph",
        meta: { hasDescendantInAdjust, descendants: [...desc] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: styled.nodes.map((n) => ({ ...n })),
        edges: styled.edges.map((e) => ({ ...e })),
        description: `Back-door paths after deleting outgoing treatment edges: ${paths.length} path(s), ${blocked.filter(Boolean).length} blocked.`,
        codeLineNumber: 2,
        layout: "graph",
        meta: { pathCount: paths.length, blockedCount: blocked.filter(Boolean).length, paths: paths.map((path) => path.join("-")), blocked: blocked.map((value) => (value ? 1 : 0)) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: styled.nodes.map((n) => ({ ...n })),
        edges: styled.edges.map((e) => ({ ...e })),
        description: `Adjusted outcome under treatment 1 is ${effect1.toFixed(4)} and under treatment 0 is ${effect0.toFixed(4)}; the effect is ${ace.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "graph",
        meta: { effect1, effect0, ace },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: styled.nodes.map((n) => ({ ...n })),
        edges: styled.edges.map((e) => ({ ...e })),
        description: `Back-door criterion ${satisfied ? "holds, so P(Y | do(X)) is identified" : "fails, so this adjustment set cannot identify the effect"}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { satisfied, ace, effect1, effect0, pathCount: paths.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Observational correlation is not causation because shared causes create back-door paths into the treatment. Do-calculus gives rules for deleting or rewriting those paths until the intervention distribution is expressed in ordinary probabilities. The back-door criterion is the simplest rule: block every non-causal route from treatment to outcome by conditioning on the right covariates, then average the outcome over them.",
        invariants: [
            "All outgoing edges of the treatment are deleted before back-door paths are searched.",
            "A conditioned non-collider blocks a path, while conditioning on a collider can open one.",
            "No adjustment variable may be a descendant of the treatment.",
        ],
        correctness:
            "The do-operator removes incoming edges to the treatment, replacing its parents by an external intervention. In the graph with outgoing treatment edges removed, every remaining path from treatment to outcome is a back-door (non-causal) route. D-separation characterizes exactly when a conditioning set blocks all such routes. When it does, the back-door adjustment formula sums the observed conditional outcome over the distribution of the covariates and equals the interventional distribution, a direct corollary of the do-calculus rules.",
        complexityRationale:
            "Descendants are found by a graph traversal, and path enumeration visits simple paths in the modified graph, which is exponential only in graph size but constant for the small diagrams used here. Adjustment averages one entry per covariate state.",
        uses: [
            "Deciding whether an observational study identifies a causal effect",
            "Choosing covariates for adjustment in epidemiology",
            "Teaching the identification step before causal effect estimation",
        ],
        references: [
            "Pearl, Causality: Models, Reasoning and Inference, Chapter 3, 2009",
            "Shpitser and Pearl, Complete Identification Methods for the Causal Hierarchy, 2008",
        ],
        workedExample:
            "With edges Z to X, Z to Y and X to Y, and adjustment set {Z}, Z is not a descendant of X and the only back-door path X <- Z -> Y is blocked at the non-collider Z. If P(Y=1|X=1,Z)=0.9 and P(Y=1|X=0,Z)=0.3, the adjusted causal effect is 0.9 minus 0.3, or 0.6.",
    },
    id: "do-calculus",
    name: "Do-Calculus (Back-Door Identification)",
    category: "statistics-probability",
    complexity: { time: "O(V * (E + P * L))", space: "O(V + E)" },
    defaultInput: DEFAULT_INPUT,
    visualType: "graph",
    run,
    pseudocode: [
        "build the directed causal graph from the given edges",
        "delete every edge leaving the treatment variable",
        "reject adjustment nodes that are descendants of the treatment",
        "enumerate simple treatment-to-outcome paths in the modified graph",
        "mark a path blocked by a conditioned non-collider or closed collider",
        "if all paths are blocked the back-door criterion holds",
        "average the conditional outcome over covariates to get the effect",
    ],
};

export default module;
