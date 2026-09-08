/**
 * walksat-search.ts – WalkSAT Search
 *
 * Stochastic local search on 3 variables / 4 clauses: pick a random
 * unsatisfied clause with a seeded LCG, then flip a random variable in
 * it. One cell per variable (metadata.variable).
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
                codeLineNumber: 2,
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
            description: `Flip ${flips}: clause (${clause.join("∨")}) unsatisfied – flipping ${variable}.`,
            codeLineNumber: 1,
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
            description: `SAT after ${flips} flip(s).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { flips, solution: [...assign.entries()].map(([k, v]) => `${k}=${v}`) },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeCells(assign),
            edges: [],
            description: `Still ${unsatisfied(assign).length} unsatisfied clause(s) after ${flips} flips – restart would follow.`,
            codeLineNumber: 3,
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
};

export default module;
