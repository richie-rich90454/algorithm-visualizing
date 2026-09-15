/**
 * min-conflicts-search.ts – Min-Conflicts Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Repairs a complete (but conflicted) assignment instead of building one
 * incrementally. It starts from a seeded random assignment for X≠Y, Y≠Z,
 * then repeats: pick a random conflicted variable and reassign it the value
 * that violates the fewest constraints. Conflicts usually melt away within a
 * few repairs; if they do not, a restart would follow.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations·n) – a few cheap repair rounds in practice
 *   Space: O(n) – the single current assignment
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each repaired variable flashes YELLOW (comparing).
 *   - A conflict-free assignment turns GREEN (sorted).
 *   - Getting stuck ends all IDLE; one cell per variable.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Incomplete but famously effective – cracked million-queens problems.
 *   - The seeded start keeps the demo deterministic and replayable.
 *   - Random restarts are the standard escape from local minima.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const VARS = ["X", "Y", "Z"];

function lcg(seed: number): () => number {
    let s = seed;
    return () => {
        s = (1103515245 * s + 12345) & 0x7fffffff;
        return s;
    };
}

function makeCells(
    assign: Map<string, number>,
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    return VARS.map((v) => ({
        id: `cell-${v}`,
        type: "cell" as const,
        label: assign.has(v) ? `${v}=${assign.get(v)}` : `${v}=?`,
        value: assign.get(v) ?? 0,
        state: states.get(v) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { variable: v, value: assign.get(v) ?? -1 },
    }));
}

function conflicts(assign: Map<string, number>): string[] {
    const bad: string[] = [];
    if (assign.get("X") === assign.get("Y")) bad.push("X", "Y");
    if (assign.get("Y") === assign.get("Z") && !bad.includes("Y")) bad.push("Y");
    if (assign.get("Y") === assign.get("Z") && !bad.includes("Z")) bad.push("Z");
    return [...new Set(bad)];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number } | null) ?? {};
    const seed = typeof task.seed === "number" ? task.seed : 42;
    const rand = lcg(seed);
    const assign = new Map<string, number>();
    for (const v of VARS) assign.set(v, (rand() % 2) + 1);
    let step = 0;
    let repairs = 0;

    yield {
        stepNumber: step,
        entities: makeCells(assign),
        edges: [],
        description: `Min-conflicts from seeded start ${VARS.map((v) => `${v}=${assign.get(v)}`).join(", ")}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { repairs },
    };
    step += 1;
    for (let iter = 0; iter < 4 && step < 13; iter += 1) {
        const bad = conflicts(assign);
        if (bad.length === 0) {
            const done = new Map<string, EntityState>(
                VARS.map((v) => [v, "sorted"] as [string, EntityState]),
            );
            yield {
                stepNumber: step,
                entities: makeCells(assign, done),
                edges: [],
                description: `Solved after ${repairs} repair(s): ${VARS.map((v) => `${v}=${assign.get(v)}`).join(", ")}.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { repairs, solution: [...assign.entries()].map(([k, v]) => `${k}=${v}`) },
            };
            return;
        }
        const variable = bad[rand() % bad.length] as string;
        let bestVal = assign.get(variable) as number;
        let bestCost = Number.POSITIVE_INFINITY;
        for (const value of [1, 2]) {
            assign.set(variable, value);
            const cost = conflicts(assign).length;
            if (cost < bestCost) {
                bestCost = cost;
                bestVal = value;
            }
        }
        assign.set(variable, bestVal);
        repairs += 1;
        yield {
            stepNumber: step,
            entities: makeCells(assign, new Map([[variable, "comparing"]])),
            edges: [],
            description: `Repair ${repairs}: ${variable}→${bestVal} leaves ${bestCost} conflict(s).`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { repairs },
        };
        step += 1;
    }
    const bad = conflicts(assign);
    if (bad.length === 0) {
        const done = new Map<string, EntityState>(
            VARS.map((v) => [v, "sorted"] as [string, EntityState]),
        );
        yield {
            stepNumber: step,
            entities: makeCells(assign, done),
            edges: [],
            description: `Solved after ${repairs} repair(s) on the final check.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: { repairs, solution: [...assign.entries()].map(([k, v]) => `${k}=${v}`) },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeCells(assign),
            edges: [],
            description: `Stuck with ${bad.length} conflicted variable(s) after ${repairs} repairs; a restart would follow.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { repairs },
        };
    }
}

const module: AlgorithmModule = {
    id: "min-conflicts-search",
    name: "Min-Conflicts Search",
    category: "searching",
    complexity: { time: "O(iterations × n)", space: "O(n)" },
    defaultInput: { seed: 42 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with a seeded random assignment for every variable",
        "while conflicted variables remain and repairs are left",
        "pick a random conflicted variable to repair next",
        "set it to the value minimizing violated constraints",
        "if no conflicts remain: return the assignment as solved",
        "done: return solution or report being stuck pending restart",
    ],
};

export default module;
