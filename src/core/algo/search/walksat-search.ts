/**
 * walksat-search.ts – WalkSAT Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Hunts a satisfying assignment with stochastic local search on the same
 * 3-variable, 4-clause formula DPLL solves exactly. From the all-false
 * assignment it repeats: pick a random unsatisfied clause (seeded LCG, so
 * the walk replays), then flip a random variable inside it. Satisfying all
 * clauses stops the walk SAT; leftover clauses after the flip budget mean a
 * restart would follow.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(flips·clauses) – a bounded random walk, no complete guarantee
 *   Space: O(n) – the single current assignment
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each flipped variable flashes YELLOW (comparing).
 *   - A satisfying assignment turns GREEN (sorted).
 *   - An unfinished walk ends all IDLE; one cell per variable.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Incomplete but often shockingly fast on satisfiable formulas.
 *   - Randomness is seeded, so the demo flips identically every run.
 *   - The local-search counterpart to systematic DPLL – compare the two.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const VARS = ["x1", "x2", "x3"];
const CLAUSES: number[][] = [
    [1, 2],
    [-1, 3],
    [-2, -3],
    [1, -3],
];

function lcg(seed: number): () => number {
    let s = seed;
    return () => {
        s = (1103515245 * s + 12345) & 0x7fffffff;
        return s;
    };
}

function makeCells(
    assign: Map<string, boolean>,
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    return VARS.map((v) => ({
        id: `cell-${v}`,
        type: "cell" as const,
        label: assign.has(v) ? `${v}=${assign.get(v) === true ? "T" : "F"}` : `${v}=?`,
        value: assign.get(v) ? 1 : 0,
        state: states.get(v) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { variable: v, value: assign.get(v) ?? false },
    }));
}

function unsatisfied(assign: Map<string, boolean>): number[][] {
    return CLAUSES.filter(
        (clause) =>
            !clause.some((lit) => {
                const val = assign.get(VARS[Math.abs(lit) - 1] as string);
                return val !== undefined && (lit > 0 ? val : !val);
            }),
    );
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number } | null) ?? {};
    const seed = typeof task.seed === "number" ? task.seed : 7;
    const rand = lcg(seed);
    const assign = new Map<string, boolean>(VARS.map((v) => [v, false]));
    let step = 0;
    let flips = 0;

    yield {
        stepNumber: step,
        entities: makeCells(assign),
        edges: [],
        description: `WalkSAT from all-false (seed ${seed}) on ${CLAUSES.length} clauses.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { flips },
    };
    step += 1;
    for (let iter = 0; iter < 5 && step < 13; iter += 1) {
        const bad = unsatisfied(assign);
        if (bad.length === 0) {
            const done = new Map<string, EntityState>(
                VARS.map((v) => [v, "sorted"] as [string, EntityState]),
            );
            yield {
                stepNumber: step,
                entities: makeCells(assign, done),
                edges: [],
                description: `SAT after ${flips} flip(s): ${VARS.map((v) => `${v}=${assign.get(v) === true ? "T" : "F"}`).join(", ")}.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { flips, solution: [...assign.entries()].map(([k, v]) => `${k}=${v}`) },
            };
            return;
        }
        const clause = bad[rand() % bad.length] as number[];
        const lit = clause[rand() % clause.length] as number;
        const variable = VARS[Math.abs(lit) - 1] as string;
        assign.set(variable, !(assign.get(variable) as boolean));
        flips += 1;
        yield {
            stepNumber: step,
            entities: makeCells(assign, new Map([[variable, "comparing"]])),
            edges: [],
            description: `Flip ${flips}: clause (${clause.join("∨")}) unsatisfied, so flip ${variable} to ${assign.get(variable) === true ? "T" : "F"}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { flips },
        };
        step += 1;
    }
    if (unsatisfied(assign).length === 0) {
        const done = new Map<string, EntityState>(
            VARS.map((v) => [v, "sorted"] as [string, EntityState]),
        );
        yield {
            stepNumber: step,
            entities: makeCells(assign, done),
            edges: [],
            description: `SAT after ${flips} flip(s) on the final check.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { flips, solution: [...assign.entries()].map(([k, v]) => `${k}=${v}`) },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeCells(assign),
            edges: [],
            description: `Still ${unsatisfied(assign).length} unsatisfied clause(s) after ${flips} flips; a restart would follow.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { flips },
        };
    }
}

const module: AlgorithmModule = {
    id: "walksat-search",
    name: "WalkSAT Search",
    category: "searching",
    complexity: { time: "O(flips × clauses)", space: "O(n)" },
    defaultInput: { seed: 7 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with the all-false assignment and flips ← 0",
        "while unsatisfied clauses remain and flips are left",
        "pick a random unsatisfied clause with the seeded generator",
        "flip a random variable inside that clause and count the flip",
        "if every clause is satisfied: return the assignment as SAT",
        "done: return SAT assignment or report restart would follow",
    ],
};

export default module;
