/**
 * generalized-euclidean.ts - Generalized Euclidean Algorithm
 *
 * Extends the Euclidean algorithm from two integers to an entire list: it
 * computes the greatest common divisor of all inputs together with Bezout
 * coefficients expressing that gcd as an integer combination of the inputs.
 * Each new input is folded in with a two-number extended gcd step.
 *
 *   Time:  O(k * log M) for k inputs bounded by M
 *   Space: O(k) for the Bezout coefficients
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GeneralizedEuclidInput {
    values?: number[];
}

function egcd(a: number, b: number): [number, number, number] {
    let oldR = a;
    let r = b;
    let oldS = 1;
    let s = 0;
    let oldT = 0;
    let t = 1;
    while (r !== 0) {
        const q = Math.trunc(oldR / r);
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
        [oldT, t] = [t, oldT - q * t];
    }
    if (oldR < 0) return [-oldS, -oldT, -oldR];
    return [oldS, oldT, oldR];
}

function makeEntities(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (done ? "sorted" : index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GeneralizedEuclidInput | null) ?? {};
    const raw = Array.isArray(task.values) && task.values.length > 0 ? task.values : [6, 10, 15];
    const values = raw.map((v) => Math.trunc(v));

    let gcd = Math.abs(values[0] ?? 0);
    let coefficients = [values[0]! < 0 ? -1 : 1];
    if (gcd === 0) coefficients = [0];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(values, -1, false),
        edges: [],
        description: `Compute the gcd and Bezout coefficients of ${values.length} integers.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: 1, cols: values.length, values: values.slice(), gcd, coefficients: coefficients.slice(), steps: 0 },
    };
    step += 1;

    for (let i = 1; i < values.length; i += 1) {
        const next = Math.abs(values[i] ?? 0);
        const [s, t, combined] = egcd(gcd, next);
        coefficients = coefficients.map((coef) => coef * s);
        coefficients.push((values[i] ?? 0) < 0 ? -t : t);
        gcd = combined;
        yield {
            stepNumber: step,
            entities: makeEntities(values, i, false),
            edges: [],
            description: `Fold in ${values[i]}: gcd of the first ${i + 1} values is ${gcd}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { rows: 1, cols: values.length, values: values.slice(), gcd, coefficients: coefficients.slice(), steps: i },
        };
        step += 1;
    }

    const check = values.reduce((sum, value, i) => sum + value * (coefficients[i] ?? 0), 0);
    yield {
        stepNumber: step,
        entities: makeEntities(values, -1, true),
        edges: [],
        description: `Done: gcd = ${gcd}, and the Bezout combination evaluates to ${check}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { rows: 1, cols: values.length, values: values.slice(), gcd, coefficients: coefficients.slice(), check, steps: values.length - 1 },
    };
}

const module: AlgorithmModule = {
    id: "generalized-euclidean",
    name: "Generalized Euclidean Algorithm",
    category: "math",
    complexity: { time: "O(k log M)", space: "O(k)" },
    defaultInput: { values: [6, 10, 15] },
    visualType: "array",
    run,
    pseudocode: [
        "set g to the absolute value of the first input and its coefficient to one",
        "for each remaining input a",
        "run extended gcd on g and a to get s, t, and new g",
        "multiply every existing coefficient by s",
        "append t as the coefficient of a",
        "done: report g and the coefficients with sum of coefficient times input equal to g",
    ],
    education: {
        intuition:
            "The Euclidean algorithm finds the gcd of two numbers, but a list of numbers has a gcd too. Compute it incrementally: keep the gcd of everything seen so far, then combine it with the next number using the extended Euclidean algorithm. The Bezout coefficients are updated at the same time so the gcd stays expressible as a combination of all inputs.",
        invariants: [
            "After each fold the running gcd is the gcd of the inputs processed so far.",
            "The Bezout combination of processed inputs always equals the running gcd.",
            "All coefficients remain integers.",
        ],
        correctness:
            "For two integers the extended Euclidean algorithm returns s and t with s*a + t*b equal to their gcd. Folding in a new input replaces g and a by s*g + t*a, which equals the gcd of the previous prefix and the new value; multiplying the old coefficients by s preserves their combination of the prefix, and appending t adds the correct contribution of the new input. Induction over the list proves that the final gcd and coefficients satisfy both the gcd definition and the Bezout identity.",
        complexityRationale:
            "Each of the k folds runs an extended gcd costing O(log M) division steps for inputs bounded by M, giving O(k log M) time. Storing one coefficient per input uses O(k) space.",
        uses: [
            "Solving a system of linear Diophantine equations",
            "Computing generators of ideals in integer rings",
            "Reducing rational numbers and fractions with many terms",
        ],
        references: [
            "Knuth, The Art of Computer Programming Volume 2, Section 4.5.2",
            "Wikipedia, Extended Euclidean algorithm, generalization to more than two numbers",
        ],
        workedExample:
            "For the list 6, 10, 15, folding 6 and 10 gives gcd 2 with coefficients 2 and minus one. Combining 2 with 15 gives gcd 1 with s = 8 and t = minus one, so the coefficients become 16, minus 8, and minus one, and 16*6 minus 8*10 minus 1*15 equals 1.",
    },
};

export default module;
