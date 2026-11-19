/**
 * consistency-enforcement-search.ts – Consistency Enforcement Search (MAC)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Consistency enforcement search is backtracking that never ignores a domain
 * change. After every guess it runs arc consistency over all still-open
 * inequality constraints, deleting values with no support anywhere. An empty
 * domain kills a branch immediately. This "maintaining arc consistency" style
 * prunes far more of the search tree than plain chronological backtracking.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d^n + propagation) - exponential search, each node runs AC
 *   Space: O(n·d) for the domains and the assignment stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The variable just assigned is PINK (highlight).
 *   - Variables whose domains shrink are RED (swapped).
 *   - The satisfying assignment turns GREEN (sorted); one cell per variable.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Domains = Record<string, number[]>;
type Assignment = Record<string, number>;

interface SearchEvent {
    kind: "assign" | "prune" | "backtrack" | "solution" | "fail";
    domains: Domains;
    assignment: Assignment;
    focus: string;
    value: number;
}

interface SearchResult {
    sat: boolean;
    solution: Assignment | null;
    events: SearchEvent[];
    propagations: number;
    backtracks: number;
}

/** Remove values from xi that have no supporter in xj under inequality. */
function revise(domains: Domains, xi: string, xj: string): number[] {
    const supporters = domains[xj] ?? [];
    return (domains[xi] ?? []).filter((x) => supporters.some((y) => y !== x));
}

/** Enforce arc consistency over every constraint; false means failure. */
function enforce(
    domains: Domains,
    assignment: Assignment,
    constraints: Array<[string, string]>,
    result: SearchResult,
): boolean {
    const arcs: Array<[string, string]> = [
        ...constraints,
        ...constraints.map(([a, b]) => [b, a] as [string, string]),
    ];
    let changed = true;
    while (changed) {
        changed = false;
        for (const [xi, xj] of arcs) {
            const assignedI = assignment[xi];
            const assignedJ = assignment[xj];
            if (assignedI !== undefined && assignedJ !== undefined) {
                if (assignedI === assignedJ) return false;
                continue;
            }
            // An assigned endpoint prunes its value from the other domain.
            const kept =
                assignedI !== undefined
                    ? (domains[xj] ?? []).filter((x) => x !== assignedI)
                    : assignedJ !== undefined
                      ? (domains[xi] ?? []).filter((x) => x !== assignedJ)
                      : revise(domains, xi, xj);
            const target = assignedI !== undefined ? xj : xi;
            if (kept.length === (domains[target] ?? []).length) continue;
            domains[target] = kept;
            result.propagations += 1;
            changed = true;
            if (kept.length === 0) return false;
        }
    }
    return true;
}

function solve(
    vars: string[],
    domains: Domains,
    constraints: Array<[string, string]>,
    result: SearchResult,
    assignment: Assignment,
): boolean {
    if (!enforce(domains, assignment, constraints, result)) return false;
    const open = vars.filter((v) => assignment[v] === undefined);
    if (open.length === 0) {
        result.sat = true;
        result.solution = { ...assignment };
        result.events.push({
            kind: "solution",
            domains: structuredClone(domains),
            assignment: { ...assignment },
            focus: "",
            value: 0,
        });
        return true;
    }
    // Minimum-remaining-values choice picks the most constrained variable.
    open.sort((a, b) => (domains[a]?.length ?? 0) - (domains[b]?.length ?? 0));
    const next = open[0] as string;
    for (const value of [...(domains[next] ?? [])]) {
        const childDomains: Domains = structuredClone(domains);
        const childAssign: Assignment = { ...assignment, [next]: value };
        childDomains[next] = [value];
        result.events.push({
            kind: "assign",
            domains: structuredClone(childDomains),
            assignment: { ...childAssign },
            focus: next,
            value,
        });
        if (solve(vars, childDomains, constraints, result, childAssign)) return true;
        result.backtracks += 1;
        result.events.push({
            kind: "backtrack",
            domains: structuredClone(domains),
            assignment: { ...assignment },
            focus: next,
            value,
        });
    }
    return false;
}

function runSearch(
    domains: Domains,
    constraints: Array<[string, string]>,
): SearchResult {
    const vars = Object.keys(domains);
    const result: SearchResult = { sat: false, solution: null, events: [], propagations: 0, backtracks: 0 };
    const ok = solve(vars, structuredClone(domains), constraints, result, {});
    if (!ok) {
        result.events.push({
            kind: "fail",
            domains: structuredClone(domains),
            assignment: {},
            focus: "",
            value: 0,
        });
    }
    return result;
}

function makeCells(
    vars: string[],
    domains: Domains,
    assignment: Assignment,
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    return vars.map((v) => ({
        id: `cell-${v}`,
        type: "cell" as const,
        label: assignment[v] !== undefined ? `${v}=${assignment[v]}` : `${v}={${(domains[v] ?? []).join(",")}}`,
        value: assignment[v] ?? (domains[v] ?? []).length,
        state: states.get(v) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { variable: v, domain: (domains[v] ?? []).join(",") },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { domains?: Record<string, number[]>; constraints?: Array<[string, string]> } | null
    ) ?? {};
    const defaults: Domains = { X: [1, 2, 3], Y: [1, 2], Z: [1, 2, 3], W: [1, 2, 3] };
    const domains: Domains = {};
    for (const [v, d] of Object.entries(defaults)) {
        const provided = task.domains?.[v];
        domains[v] = Array.isArray(provided) && provided.length > 0 ? [...(provided as number[])] : [...d];
    }
    const constraints: Array<[string, string]> = Array.isArray(task.constraints)
        ? task.constraints.filter((c) => Array.isArray(c) && c.length === 2)
        : [
              ["X", "Y"],
              ["Y", "Z"],
              ["Z", "W"],
          ];
    const vars = Object.keys(domains);
    const result = runSearch(domains, constraints);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(vars, domains, {}),
        edges: [],
        description: `Consistency enforcement search over ${vars.length} variables with ${constraints.length} inequality constraints.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { propagations: 0, backtracks: 0, sat: result.sat },
    };
    step += 1;

    for (const event of result.events) {
        const states = new Map<string, EntityState>();
        if (event.kind === "assign") states.set(event.focus, "highlight");
        else if (event.kind === "backtrack") states.set(event.focus, "swapped");
        else if (event.kind === "solution") for (const v of vars) states.set(v, "sorted");
        else if (event.kind === "fail") for (const v of vars) states.set(v, "error");
        const label =
            event.kind === "assign"
                ? `Assigned ${event.focus}=${event.value}; enforcing arc consistency prunes unsupported values.`
                : event.kind === "backtrack"
                  ? `${event.focus}=${event.value} led to a conflict – backtracking and restoring domains.`
                  : event.kind === "solution"
                    ? `Consistent solution found: ${vars.map((v) => `${v}=${(event.assignment as Assignment)[v]}`).join(", ")}.`
                    : "Every branch failed – the constraint problem is unsatisfiable.";
        yield {
            stepNumber: step,
            entities: makeCells(vars, event.domains, event.assignment, states),
            edges: [],
            description: label,
            codeLineNumber: event.kind === "assign" ? 2 : event.kind === "solution" ? 5 : 4,
            layout: "grid",
            meta: {
                propagations: result.propagations,
                backtracks: result.backtracks,
                sat: result.sat,
                assignment: Object.entries(event.assignment).map(([k, v]) => `${k}=${v}`),
            },
        };
        step += 1;
        if (step > 60) break;
    }

    const finalStates = new Map<string, EntityState>(
        vars.map((v) => [v, result.sat ? "sorted" : "error"] as [string, EntityState]),
    );
    yield {
        stepNumber: step,
        entities: makeCells(vars, domains, result.solution ?? {}, finalStates),
        edges: [],
        description: result.sat
            ? `Solved after ${result.backtracks} backtrack(s) and ${result.propagations} domain revision(s).`
            : `No solution after ${result.propagations} domain revision(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            sat: result.sat,
            solution: result.solution
                ? Object.entries(result.solution).map(([k, v]) => `${k}=${v}`)
                : "none",
            backtracks: result.backtracks,
            propagations: result.propagations,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain backtracking assigns a variable and hopes for the best. Consistency enforcement search looks at the consequences immediately: after each guess it removes from every neighbor domain any value that cannot be matched by a supporter elsewhere. If a domain empties, the guess is impossible and the branch dies without exploring further.",
        invariants: [
            "Every remaining domain value has support in each open neighbor after propagation.",
            "Assignments on the current branch satisfy all constraints seen so far.",
            "Pruning only removes values; it never adds one back within a branch.",
        ],
        correctness:
            "Arc consistency is sound: a removed value cannot appear in any solution of the current branch, so discarding it loses no answer. When all variables are assigned consistently a full solution exists. When a branch fails, restoring domains and trying another value explores every surviving possibility, so completeness matches plain backtracking with far fewer nodes.",
        complexityRationale:
            "In the worst case the search still visits O(d^n) assignments. Each node runs arc consistency over a constant number of arcs with domains of size d, adding polynomial propagation work per node. Domains and the assignment stack use O(n·d) space.",
        uses: [
            "Constraint solvers for scheduling and configuration",
            "Map coloring and puzzle solving with strong pruning",
            "The MAC inner loop of modern CP and SAT engines",
        ],
        references: [
            "Mackworth, Consistency in Networks of Relations, Artificial Intelligence, 1977",
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, Chapter 6",
        ],
        workedExample:
            "With X in {1,2,3}, Y in {1}, and constraints X not equal Y, assigning Y=1 lets propagation delete 1 from X, leaving {2,3}. If a later constraint empties a domain, the search backtracks to that last guess instead of trying hopeless values.",
    },
    id: "consistency-enforcement-search",
    name: "Consistency Enforcement Search",
    category: "searching",
    complexity: { time: "O(d^n + propagation)", space: "O(n·d)" },
    defaultInput: {
        domains: { X: [1, 2, 3], Y: [1, 2], Z: [1, 2, 3], W: [1, 2, 3] },
        constraints: [
            ["X", "Y"],
            ["Y", "Z"],
            ["Z", "W"],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with all domains and an empty assignment",
        "run arc consistency: drop values with no support in a neighbor",
        "if any domain empties, discard this branch",
        "pick the unassigned variable with the fewest remaining values",
        "try each of its values, assigning it and re-enforcing consistency",
        "if all variables are assigned consistently, return the solution",
        "otherwise backtrack and restore the previous domains",
        "done: report the solution or that none exists",
    ],
};

export default module;
