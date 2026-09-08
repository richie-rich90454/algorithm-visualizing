/**
 * min-conflicts-search.ts – Min-Conflicts Search
 *
 * Starts from a seeded-LCG random assignment for X≠Y, Y≠Z, then
 * repeatedly repairs the conflicted variable with the least-conflicting
 * value. One cell per variable (metadata.variable).
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
                codeLineNumber: 2,
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
            codeLineNumber: 1,
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
            description: `Solved after ${repairs} repair(s).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { repairs, solution: [...assign.entries()].map(([k, v]) => `${k}=${v}`) },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeCells(assign),
            edges: [],
            description: `Stuck after ${repairs} repairs – restarting would follow.`,
            codeLineNumber: 3,
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
};

export default module;
