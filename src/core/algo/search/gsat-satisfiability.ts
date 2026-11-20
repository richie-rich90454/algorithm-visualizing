/**
 * gsat-satisfiability.ts - GSAT Satisfiability Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * GSAT is a greedy local-search solver for propositional satisfiability. From
 * a random assignment it repeatedly flips the variable that satisfies the
 * most clauses, with a small noise setting that occasionally flips a variable
 * in an unsatisfied clause to escape a local maximum. Random restarts follow a
 * flip budget. Unlike DPLL it is incomplete, but it is often fast on large
 * satisfiable formulas.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(restarts * maxFlips * variables * clauses)
 *   Space: O(variables + clauses) for the assignment and clause states
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Variable cells show T or F; the flipped one flashes YELLOW (comparing).
 *   - Satisfied clauses turn GREEN (sorted), unsatisfied ones RED (error).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Every flip is chosen from the current assignment and clause states.
 *   - A reported satisfying assignment truly satisfies every clause.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function lcg(seed: number): () => number {
    let s = seed | 0;
    return () => {
        s = (1103515245 * s + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

function clauseTrue(clause: number[], assign: boolean[]): boolean {
    for (const lit of clause) {
        const variable = Math.abs(lit);
        const value = assign[variable] ?? false;
        if ((lit > 0 && value) || (lit < 0 && !value)) return true;
    }
    return false;
}

function satFlags(clauses: number[][], assign: boolean[]): boolean[] {
    return clauses.map((clause) => clauseTrue(clause, assign));
}

function makeCells(
    variables: number,
    clauses: number[][],
    assign: boolean[],
    flags: boolean[],
    flipped: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let v = 1; v <= variables; v += 1) {
        entities.push({
            id: `var-${v}`,
            type: "cell" as const,
            label: `x${v}=${assign[v] === true ? "T" : "F"}`,
            value: assign[v] === true ? 1 : 0,
            state: (v === flipped ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: v - 1, variable: v },
        });
    }
    clauses.forEach((clause, index) => {
        entities.push({
            id: `clause-${index}`,
            type: "cell" as const,
            label: `C${index} ${clause.map((l) => (l > 0 ? `x${l}` : `!x${-l}`)).join("v")}`,
            value: flags[index] === true ? 1 : 0,
            state: (flags[index] === true ? "sorted" : "error") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: index, clause: index },
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            clauses?: number[][];
            variables?: number;
            maxFlips?: number;
            restarts?: number;
            seed?: number;
            noise?: number;
        } | null
    ) ?? {};
    const clauses: number[][] = Array.isArray(task.clauses)
        ? task.clauses.map((c) => [...c])
        : [
              [1, 2],
              [-1, 3],
              [-2, -3],
              [1, -3],
          ];
    const variables =
        typeof task.variables === "number"
            ? Math.max(1, Math.floor(task.variables))
            : Math.max(1, ...clauses.flat().map((l) => Math.abs(l)));
    const maxFlips = typeof task.maxFlips === "number" ? Math.max(1, Math.floor(task.maxFlips)) : 30;
    const restarts = typeof task.restarts === "number" ? Math.max(1, Math.floor(task.restarts)) : 3;
    const seed = typeof task.seed === "number" ? task.seed : 11;
    const noise = typeof task.noise === "number" ? Math.min(0.5, Math.max(0, task.noise)) : 0.1;
    const rand = lcg(seed);
    let step = 0;

    let assign: boolean[] = [];
    let flags: boolean[] = [];
    let found = false;
    let totalFlips = 0;
    let restartCount = 0;

    for (let restart = 0; restart < restarts && !found; restart += 1) {
        restartCount = restart + 1;
        assign = new Array<boolean>(variables + 1).fill(false);
        for (let v = 1; v <= variables; v += 1) assign[v] = rand() < 0.5;
        flags = satFlags(clauses, assign);
        let satisfied = flags.filter(Boolean).length;

        yield {
            stepNumber: step,
            entities: makeCells(variables, clauses, assign, flags, -1),
            edges: [],
            description: `Restart ${restart + 1} from a random assignment satisfying ${satisfied} of ${clauses.length} clauses.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {
                rows: 2,
                cols: Math.max(variables, clauses.length),
                variables,
                satCount: satisfied,
                total: clauses.length,
                flips: totalFlips,
                restarts: restartCount,
                found: false,
                assignment: assign.slice(1).map((b) => (b ? 1 : 0)),
                satFlags: flags.map((b) => (b ? 1 : 0)),
            },
        };
        step += 1;

        for (let flip = 0; flip < maxFlips && satisfied < clauses.length; flip += 1) {
            const unsatisfied: number[] = [];
            flags.forEach((ok, index) => {
                if (!ok) unsatisfied.push(index);
            });
            let chosen = -1;
            if (unsatisfied.length > 0 && rand() < noise) {
                const clause = clauses[unsatisfied[Math.floor(rand() * unsatisfied.length)] as number] ?? [];
                chosen = Math.abs(clause[Math.floor(rand() * clause.length)] as number);
            } else {
                let bestGain = Number.NEGATIVE_INFINITY;
                for (let v = 1; v <= variables; v += 1) {
                    assign[v] = !(assign[v] === true);
                    const trial = satFlags(clauses, assign).filter(Boolean).length;
                    assign[v] = !assign[v];
                    const gain = trial - satisfied;
                    if (gain > bestGain) {
                        bestGain = gain;
                        chosen = v;
                    }
                }
            }
            if (chosen < 1) break;
            assign[chosen] = !(assign[chosen] === true);
            flags = satFlags(clauses, assign);
            satisfied = flags.filter(Boolean).length;
            totalFlips += 1;

            yield {
                stepNumber: step,
                entities: makeCells(variables, clauses, assign, flags, chosen),
                edges: [],
                description: `Flipped x${chosen}; now ${satisfied} of ${clauses.length} clauses are satisfied.`,
                codeLineNumber: satisfied === clauses.length ? 7 : 4,
                layout: "grid",
                meta: {
                    rows: 2,
                    cols: Math.max(variables, clauses.length),
                    variables,
                    satCount: satisfied,
                    total: clauses.length,
                    flips: totalFlips,
                    restarts: restartCount,
                    found: satisfied === clauses.length,
                    assignment: assign.slice(1).map((b) => (b ? 1 : 0)),
                    satFlags: flags.map((b) => (b ? 1 : 0)),
                },
            };
            step += 1;
        }
        found = satisfied === clauses.length;
    }

    yield {
        stepNumber: step,
        entities: makeCells(variables, clauses, assign, flags, -1),
        edges: [],
        description: found
            ? `Done: found a satisfying assignment after ${totalFlips} flip(s).`
            : `Done: no satisfying assignment found within the flip budget (${satisfiedCount(flags)} of ${clauses.length} clauses).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: 2,
            cols: Math.max(variables, clauses.length),
            variables,
            satCount: satisfiedCount(flags),
            total: clauses.length,
            flips: totalFlips,
            restarts: restartCount,
            found,
            assignment: assign.slice(1).map((b) => (b ? 1 : 0)),
            satFlags: flags.map((b) => (b ? 1 : 0)),
        },
    };
}

function satisfiedCount(flags: boolean[]): number {
    return flags.filter(Boolean).length;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of building an assignment variable by variable, start with a complete guess and repair it. At each step flip the variable that makes the most clauses true, and when the search stalls in a local maximum use a little randomness or a fresh random start. It is a search in the space of assignments rather than a deduction procedure.",
        invariants: [
            "The current assignment assigns a truth value to every variable.",
            "A flip always changes exactly one variable's value.",
            "When the search reports success, every clause evaluates to true.",
        ],
        correctness:
            "GSAT is incomplete: it never proves unsatisfiability, but any assignment it reports as satisfying is checked directly against every clause, so a positive answer is always sound. Random restarts and noise reduce the chance of missing an existing solution, while the flip budget guarantees termination.",
        complexityRationale:
            "Each candidate flip reevaluates all clauses for each variable, costing O(variables * clauses); with a budget of restarts times maxFlips flips, the time is O(restarts * maxFlips * variables * clauses), and only the assignment and clause flags are stored.",
        uses: [
            "Satisfiability solvers for large industrial-scale instances",
            "Configuration and scheduling problems encoded as SAT",
            "A local-search counterpart to systematic DPLL and CDCL solvers",
        ],
        references: [
            "Selman, Levesque and Mitchell, A New Method for Solving Hard Satisfiability Problems, 1992",
            "Gusfield, Algorithms on Strings, Trees and Sequences, local-search discussion",
        ],
        workedExample:
            "On clauses (x1 or x2), (!x1 or x3), (!x2 or !x3), (x1 or !x3), an assignment such as x1 true, x2 false, x3 true satisfies all four clauses; the greedy flip count reaches four and the search stops.",
    },
    id: "gsat-satisfiability",
    name: "GSAT Satisfiability Search",
    category: "searching",
    complexity: { time: "O(restarts * flips * vars * clauses)", space: "O(vars + clauses)" },
    defaultInput: {
        clauses: [
            [1, 2],
            [-1, 3],
            [-2, -3],
            [1, -3],
        ],
        variables: 3,
        maxFlips: 30,
        restarts: 3,
        seed: 11,
        noise: 0.1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a random initial assignment and count satisfied clauses",
        "repeat up to a bounded number of restarts",
        "while the flip budget remains and clauses are unsatisfied",
        "with small noise flip a variable in an unsatisfied clause",
        "otherwise flip the variable with the largest clause gain",
        "recompute which clauses are satisfied",
        "stop the run early when every clause is satisfied",
        "done: report the assignment or that none was found",
    ],
};

export default module;
