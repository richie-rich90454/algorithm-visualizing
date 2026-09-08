/**
 * Friends Pairing: f[i] = f[i-1] + (i-1) * f[i-2].
 * Time O(n), Space O(n). Default n = 4 -> 10.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(arr: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return arr.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? task.n : 4;
    let step = 0;
    if (n < 0) {
        yield {
            stepNumber: step,
            entities: makeBars([0]),
            edges: [],
            description: "Negative n \u2013 nothing to pair.",
            codeLineNumber: 0,
            layout: "array",
            meta: {},
        };
        return;
    }
    const f: number[] = new Array<number>(n + 1).fill(0);
    f[0] = 1;
    if (n >= 1) f[1] = 1;
    yield {
        stepNumber: step,
        entities: makeBars(f),
        edges: [],
        description: `Pair ${n} friends (single or pairs). f[0] = 1.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n },
    };
    step += 1;
    for (let i = 1; i <= n; i += 1) {
        if (i >= 2) f[i] = (f[i - 1] ?? 0) + (i - 1) * (f[i - 2] ?? 0);
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        const how = i < 2 ? "base" : `${f[i - 1]} + ${i - 1}*${f[i - 2]} = ${f[i]}`;
        yield {
            stepNumber: step,
            entities: makeBars(f, states),
            edges: [],
            description: `f[${i}] = ${how}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n },
        };
        step += 1;
    }
    const done = new Map<number, EntityState>([[n, "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeBars(f, done),
        edges: [],
        description: `Traceback: ${f[n]} ways to pair ${n} friends.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { answer: f[n] },
    };
}

const module: AlgorithmModule = {
    id: "friends-pairing-count",
    name: "Friends Pairing (Count)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { n: 4 },
    visualType: "array",
    run,
};

export default module;
