/**
 * junction-tree-algorithm.ts - Junction Tree Belief Propagation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The junction tree algorithm turns a graphical model into a tree of cliques
 * so that exact marginal probabilities can be computed by passing messages
 * once up and once down the tree. Each clique holds the product of the factor
 * tables it owns, a message sums out the variables outside a separator, and a
 * clique belief combines all incoming messages. For a decomposable model the
 * result equals brute-force enumeration of every joint assignment.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * 2^w) for T cliques of width w
 *   Space: O(T * 2^w) for clique potentials and separator messages
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are model variables; edges show which variables co-occur in a factor.
 *   - A node turns yellow while its clique messages are being passed.
 *   - The final frame shows each variable's computed probability of being 1.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Factor {
    scope: string[];
    table: number[];
}
interface Clique {
    vars: string[];
    potential: number[];
    neighbors: number[];
    incoming: Map<number, { vars: string[]; table: number[] }>;
}

const DEFAULT_MODEL: { variables: string[]; factors: Factor[] } = {
    variables: ["A", "B", "C", "D"],
    factors: [
        { scope: ["A"], table: [0.6, 0.4] },
        { scope: ["A", "B"], table: [0.5, 0.2, 0.1, 0.7] },
        { scope: ["B", "C"], table: [0.7, 0.1, 0.2, 0.6] },
        { scope: ["C", "D"], table: [0.4, 0.3, 0.3, 0.5] },
    ],
};

function bitAt(variables: string[], assignment: number, variable: string): number {
    const position = variables.indexOf(variable);
    return position < 0 ? 0 : (assignment >> position) & 1;
}

function expand(source: string[], table: number[], target: string[]): number[] {
    return Array.from({ length: 1 << target.length }, (_, assignment) => {
        let sourceIndex = 0;
        for (let i = 0; i < source.length; i += 1) {
            sourceIndex |= bitAt(target, assignment, source[i] ?? "") << i;
        }
        return table[sourceIndex] ?? 0;
    });
}

function product(tables: number[][]): number[] {
    if (tables.length === 0) return [1];
    const size = tables[0]?.length ?? 1;
    return Array.from({ length: size }, (_, i) => tables.reduce((acc, table) => acc * (table[i] ?? 0), 1));
}

function marginalize(vars: string[], table: number[], keep: string[]): { vars: string[]; table: number[] } {
    return {
        vars: keep,
        table: Array.from({ length: 1 << keep.length }, (_, assignment) => {
            let total = 0;
            for (let full = 0; full < table.length; full += 1) {
                let matches = true;
                for (let k = 0; k < keep.length; k += 1) {
                    if (bitAt(vars, full, keep[k] ?? "") !== ((assignment >> k) & 1)) {
                        matches = false;
                        break;
                    }
                }
                if (matches) total += table[full] ?? 0;
            }
            return total;
        }),
    };
}

function maximalCliques(adjacency: Map<string, Set<string>>, variables: string[]): string[][] {
    const cliques: string[][] = [];
    const expandClique = (current: string[], candidates: Set<string>): void => {
        if (candidates.size === 0) {
            if (current.length > 0) cliques.push([...current].sort());
            return;
        }
        for (const vertex of [...candidates]) {
            const next = new Set([...candidates].filter((n) => adjacency.get(vertex)?.has(n) || n === vertex));
            next.delete(vertex);
            expandClique([...current, vertex], next);
        }
    };
    expandClique([], new Set(variables));
    return cliques;
}

function buildEntities(
    variables: string[],
    factors: Factor[],
    active: Set<string>,
    marginals: number[] | null,
): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const nodes = variables.map((name, index) => {
        const probability = marginals?.[index];
        return {
            id: `node-${name}`,
            type: "node" as const,
            label: probability === undefined ? name : `${name}:${probability.toFixed(2)}`,
            value: probability === undefined ? name : probability,
            state: (active.has(name) ? "comparing" : probability === undefined ? "idle" : "sorted") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label: name, probability: probability ?? -1 },
        };
    });
    const edges: VisualEdge[] = [];
    const seen = new Set<string>();
    for (const factor of factors) {
        for (let i = 0; i < factor.scope.length; i += 1) {
            for (let j = i + 1; j < factor.scope.length; j += 1) {
                const a = factor.scope[i] ?? "";
                const b = factor.scope[j] ?? "";
                const key = a < b ? `${a}|${b}` : `${b}|${a}`;
                if (seen.has(key)) continue;
                seen.add(key);
                edges.push({
                    id: `edge-${key.replace("|", "-")}`,
                    sourceId: `node-${a}`,
                    targetId: `node-${b}`,
                    label: "",
                    state: active.has(a) && active.has(b) ? "active" : "idle",
                    directed: false,
                });
            }
        }
    }
    return { nodes, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { model?: { variables: string[]; factors: Factor[] } } | null) ?? {};
    const model = task.model ?? DEFAULT_MODEL;
    const variables = [...model.variables];
    const factors = (model.factors ?? []).map((f) => ({ scope: [...f.scope], table: [...f.table] }));
    let step = 0;

    const emit = (
        active: Set<string>,
        description: string,
        line: number,
        marginals: number[] | null,
        cliques: number,
        messages: number,
    ): VisualFrame => {
        const built = buildEntities(variables, factors, active, marginals);
        return {
            stepNumber: step,
            entities: built.nodes,
            edges: built.edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: { variables: variables.length, factors: factors.length, cliques, messages, marginals: marginals ?? [] },
        };
    };

    if (variables.length === 0) {
        yield emit(new Set(), "Empty model - no variables to infer.", 0, [], 0, 0);
        return;
    }

    yield emit(new Set(), `Junction tree inference on ${variables.length} binary variables and ${factors.length} factors.`, 0, null, 0, 0);
    step += 1;

    const adjacency = new Map<string, Set<string>>();
    for (const variable of variables) adjacency.set(variable, new Set());
    for (const factor of factors) {
        for (let i = 0; i < factor.scope.length; i += 1) {
            for (let j = i + 1; j < factor.scope.length; j += 1) {
                adjacency.get(factor.scope[i] ?? "")?.add(factor.scope[j] ?? "");
                adjacency.get(factor.scope[j] ?? "")?.add(factor.scope[i] ?? "");
            }
        }
    }
    for (const variable of variables) {
        const neighbors = [...(adjacency.get(variable) ?? [])];
        for (let i = 0; i < neighbors.length; i += 1) {
            for (let j = i + 1; j < neighbors.length; j += 1) {
                adjacency.get(neighbors[i] ?? "")?.add(neighbors[j] ?? "");
                adjacency.get(neighbors[j] ?? "")?.add(neighbors[i] ?? "");
            }
        }
    }
    const cliqueVars = maximalCliques(adjacency, variables);
    if (step < 200) {
        yield emit(new Set(), `Triangulated model has ${cliqueVars.length} maximal cliques.`, 2, null, cliqueVars.length, 0);
        step += 1;
    }

    const cliques: Clique[] = cliqueVars.map((vars) => ({
        vars,
        potential: Array.from({ length: 1 << vars.length }, () => 1),
        neighbors: [],
        incoming: new Map(),
    }));
    for (const factor of factors) {
        const target = cliques.findIndex((clique) => factor.scope.every((v) => clique.vars.includes(v)));
        if (target < 0) continue;
        const clique = cliques[target];
        if (!clique) continue;
        clique.potential = product([clique.potential, expand(factor.scope, factor.table, clique.vars)]);
    }

    const weight = (a: number, b: number): number => {
        const first = cliques[a];
        const second = cliques[b];
        if (!first || !second) return 0;
        return first.vars.filter((v) => second.vars.includes(v)).length;
    };
    if (cliques.length > 0) {
        const inTree = new Set([0]);
        while (inTree.size < cliques.length) {
            let bestA = -1;
            let bestB = -1;
            let bestWeight = -1;
            for (let a = 0; a < cliques.length; a += 1) {
                if (!inTree.has(a)) continue;
                for (let b = 0; b < cliques.length; b += 1) {
                    if (inTree.has(b)) continue;
                    const w = weight(a, b);
                    if (w > bestWeight) {
                        bestWeight = w;
                        bestA = a;
                        bestB = b;
                    }
                }
            }
            if (bestA < 0 || bestB < 0) break;
            cliques[bestA]?.neighbors.push(bestB);
            cliques[bestB]?.neighbors.push(bestA);
            inTree.add(bestB);
        }
    }

    const root = 0;
    const parent = new Map<number, number>();
    const order: number[] = [];
    const dfs = (node: number, from: number): void => {
        parent.set(node, from);
        order.push(node);
        for (const neighbor of cliques[node]?.neighbors ?? []) {
            if (neighbor !== from) dfs(neighbor, node);
        }
    };
    if (cliques.length > 0) dfs(root, -1);

    let messageCount = 0;
    function* send(from: number, to: number): Generator<VisualFrame, void, unknown> {
        const source = cliques[from];
        const target = cliques[to];
        if (!source || !target) return;
        const separator = source.vars.filter((v) => target.vars.includes(v));
        const tables: number[][] = [source.potential];
        for (const [neighbor, message] of source.incoming) {
            if (neighbor !== to) tables.push(expand(message.vars, message.table, source.vars));
        }
        const combined = product(tables);
        const message = marginalize(source.vars, combined, separator);
        target.incoming.set(from, message);
        messageCount += 1;
        if (step < 200) {
            yield emit(new Set(separator), `Pass message from clique ${from} to ${to} over separator {${separator.join(",")}}.`, 4, null, cliques.length, messageCount);
            step += 1;
        }
    }

    for (let i = order.length - 1; i >= 0; i -= 1) {
        const node = order[i] ?? -1;
        const up = parent.get(node) ?? -1;
        if (up >= 0) yield* send(node, up);
    }
    for (const node of order) {
        for (const neighbor of cliques[node]?.neighbors ?? []) {
            if ((parent.get(neighbor) ?? -2) === node) yield* send(node, neighbor);
        }
    }

    const marginals = variables.map(() => 0);
    for (const clique of cliques) {
        const tables: number[][] = [clique.potential];
        for (const message of clique.incoming.values()) {
            tables.push(expand(message.vars, message.table, clique.vars));
        }
        const belief = product(tables);
        const total = belief.reduce((acc, value) => acc + value, 0);
        if (total <= 0) continue;
        for (let k = 0; k < clique.vars.length; k += 1) {
            const variable = clique.vars[k] ?? "";
            const index = variables.indexOf(variable);
            if (index < 0) continue;
            let ones = 0;
            for (let assignment = 0; assignment < belief.length; assignment += 1) {
                if (((assignment >> k) & 1) === 1) ones += belief[assignment] ?? 0;
            }
            marginals[index] = ones / total;
        }
    }

    yield emit(
        new Set(variables),
        `Done: P(A)=${marginals[0]?.toFixed(3)}, P(B)=${marginals[1]?.toFixed(3)}, P(C)=${marginals[2]?.toFixed(3)}, P(D)=${marginals[3]?.toFixed(3)}.`,
        6,
        marginals,
        cliques.length,
        messageCount,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A junction tree groups variables into overlapping cliques and arranges those cliques as a tree so that information flows without cycles. Each message sums out the variables a clique does not share with its neighbor, and combining messages at a clique gives its belief. Because the clique graph is a tree, a single upward and downward pass is enough to make every marginal exact.",
        invariants: [
            "Each factor table is stored in exactly one clique that contains its scope.",
            "A message is a function only of the separator variables shared by two cliques.",
            "After the two passes, every clique belief combines all evidence from the whole model.",
        ],
        correctness:
            "The running intersection property keeps each variable's cliques connected in the tree, so summing messages corresponds to a valid factorization of the joint distribution. The upward pass summarizes each subtree and the downward pass distributes the remaining evidence; summing the resulting clique belief gives the exact marginal, matching enumeration of all assignments.",
        complexityRationale:
            "With T cliques whose largest scope has w variables, each table holds at most 2^w entries and each message sums over at most that many assignments, giving O(T*2^w) time and space.",
        uses: [
            "Exact inference in Bayesian networks and Markov random fields",
            "Fault diagnosis with noisy sensor networks",
            "Educationally, the exact counterpart of loopy belief propagation",
        ],
        references: [
            "Lauritzen and Spiegelhalter, Local Computations with Probabilities (1988)",
            "Koller and Friedman, Probabilistic Graphical Models, Chapter 10",
        ],
        workedExample:
            "For the chain A-B-C-D with tables in the default model, the cliques are A-B, B-C, and C-D. Messages travel from C-D to B-C to A-B and back, and the final marginals agree with multiplying all factor tables and summing over the other variables.",
    },
    id: "junction-tree-algorithm",
    name: "Junction Tree Algorithm",
    category: "graph",
    complexity: { time: "O(T * 2^w)", space: "O(T * 2^w)" },
    defaultInput: { model: DEFAULT_MODEL },
    visualType: "graph",
    run,
    pseudocode: [
        "connect variables that appear together in a factor",
        "triangulate the resulting graph and list maximal cliques",
        "assign each factor to a clique containing its scope",
        "join cliques by separator size into a spanning tree",
        "pass messages from leaves toward the root",
        "pass messages from the root back toward the leaves",
        "combine incoming messages into clique beliefs",
        "done: read exact single-variable marginals",
    ],
};

export default module;
