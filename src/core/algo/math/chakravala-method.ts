/**
 * chakravala-method.ts - Chakravala Method for Pell's Equation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Chakravala method solves Pell's equation x^2 - D*y^2 = 1 for a
 * nonsquare D. It keeps a triple (a, b, k) satisfying a^2 - D*b^2 = k and
 * repeatedly composes it with a carefully chosen integer m: m is the residue
 * that makes a + b*m divisible by k while keeping |m^2 - D| as small as
 * possible. Each composition drives k toward 1, at which point (a, b) solves
 * the equation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(t * sqrt(D)) for t compositions with a local search for m
 *   Space: O(1) for the triple
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each (a, b, k) triple is shown as three bars.
 *   - The chosen m bar is ACTIVE during a composition.
 *   - Reaching k = 1 paints the solution bars SORTED.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** One bar entity. */
function bar(index: number, label: string, value: number, state: EntityState): VisualEntity {
    return {
        id: `bar-${index}`,
        type: "bar" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    };
}

/** Build bars for a triple and optional chosen m. */
function makeBars(a: number, b: number, k: number, m = 0): VisualEntity[] {
    return [
        bar(0, `a=${a}`, a, k === 1 ? "sorted" : "idle"),
        bar(1, `b=${b}`, b, k === 1 ? "sorted" : "idle"),
        bar(2, `k=${k}`, k, k === 1 ? "sorted" : "comparing"),
        bar(3, `m=${m}`, m, m !== 0 ? "active" : "idle"),
    ];
}

/** The Chakravala method generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { D?: number } | null) ?? {};
    const D = typeof task.D === "number" ? Math.trunc(task.D) : 61;
    let step = 0;

    if (!Number.isFinite(D) || D < 2) {
        yield {
            stepNumber: 0,
            entities: makeBars(0, 0, 0),
            edges: [],
            description: "Chakravala needs a nonsquare D >= 2.",
            codeLineNumber: 0,
            layout: "array",
            meta: { D, x: 0, y: 0, k: 0 },
        };
        return;
    }

    let a = Math.ceil(Math.sqrt(D));
    let b = 1;
    let k = a * a - D;

    yield {
        stepNumber: step,
        entities: makeBars(a, b, k),
        edges: [],
        description: `Start with a=${a}, b=1, k=${a} squared minus ${D} = ${k}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { D, x: a, y: b, k, iteration: 0 },
    };
    step += 1;

    // A perfect square D has the trivial solution b = 0.
    if (k === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(a, 0, 1),
            edges: [],
            description: `${D} is a perfect square: the trivial solution is x=${a}, y=0.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { D, x: a, y: 0, k: 1 },
        };
        return;
    }

    for (let iteration = 0; iteration < 10000 && k !== 1; iteration += 1) {
        const modulus = Math.abs(k);

        // Find the residue r with a + b*r congruent to 0 modulo k.
        let residue = -1;
        for (let m = 0; m < modulus; m += 1) {
            if ((((a + b * m) % k) + k) % k === 0) {
                residue = m;
                break;
            }
        }
        if (residue < 0) {
            break;
        }

        // Among m = residue + t*modulus choose the one minimizing |m^2 - D|.
        let bestM = residue;
        let bestDistance = Number.POSITIVE_INFINITY;
        const sqrtD = Math.sqrt(D);
        for (let t = -200; t <= 200; t += 1) {
            const candidate = residue + t * modulus;
            if (candidate <= 0) {
                continue;
            }
            const distance = Math.abs(candidate * candidate - D);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestM = candidate;
            }
        }

        const newA = Math.round((a * bestM + D * b) / modulus);
        const newB = Math.round((a + b * bestM) / modulus);
        const newK = Math.round((bestM * bestM - D) / k);

        yield {
            stepNumber: step,
            entities: makeBars(a, b, k, bestM),
            edges: [],
            description:
                `Composition ${iteration + 1}: choose m=${bestM} so a + b*m is divisible by ${k}; ` +
                `invariant a squared minus ${D} b squared = ${k}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { D, x: a, y: b, k, m: bestM, iteration: iteration + 1 },
        };
        step += 1;

        a = newA;
        b = newB;
        k = newK;

        yield {
            stepNumber: step,
            entities: makeBars(a, b, k),
            edges: [],
            description: `New triple (${a}, ${b}, ${k}) still satisfies a squared minus ${D} b squared = ${k}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { D, x: a, y: b, k, iteration: iteration + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(a, b, k),
        edges: [],
        description:
            k === 1
                ? `Reached k=1: x=${a}, y=${b} solves ${D} Pell equation since ${a} squared minus ${D} times ${b} squared = 1.`
                : `No solution reached within the iteration limit for D=${D}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { D, x: a, y: b, k, solved: k === 1 },
    };
}

/** The Chakravala method module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Pell's equation asks for integers x and y with x squared minus D times y squared equal to 1. The Chakravala method keeps a triple (a, b, k) whose value is k and composes it with a chosen m that makes the next triple integral. Choosing m near the square root of D keeps the numbers small, so k shrinks to 1 and the triple becomes the answer.",
        invariants: [
            "At every step a squared minus D times b squared equals k.",
            "The chosen m satisfies a + b*m congruent to 0 modulo k, keeping the new triple integral.",
            "The magnitude of k trends downward because m is selected near the square root of D.",
        ],
        correctness:
            "Composing (a, b, k) with m gives a' = (a*m + D*b)/|k| and b' = (a + b*m)/|k|, and algebra shows a' squared minus D times b' squared equals (m squared minus D)/k, the new k. Divisibility by k is exactly the congruence condition on m, so the triple stays integral. Choosing m to minimize |m squared minus D| makes |new k| smaller, and the process terminates at k = 1, which is the required solution.",
        complexityRationale:
            "Each composition performs a local search over m values spaced by |k| around the square root of D, costing O(sqrt(D)) in the worst case; with t compositions the time is O(t * sqrt(D)). Only the triple and a few counters are stored, so space is O(1).",
        uses: [
            "Solving Pell equations in elementary number theory",
            "Generating solutions to certain Diophantine equations",
            "Producing very close rational approximations to square roots",
        ],
        references: [
            "Niven and Zuckerman, An Introduction to the Theory of Numbers, Chapter 7",
            "Weisstein, Chakravala Method, MathWorld",
        ],
        workedExample:
            "For D = 61 the method starts at a = 8, b = 1, k = 3. A valid m near the square root of 61 is 7, giving (a, b, k) = (63, 8, -13). Continuing with m = 5 and further compositions eventually reaches k = 1 with x = 1766319049 and y = 226153980, the famous smallest solution for 61.",
    },
    id: "chakravala-method",
    name: "Chakravala Method",
    category: "math",
    complexity: { time: "O(t * sqrt(D))", space: "O(1)" },
    defaultInput: { D: 61 },
    visualType: "array",
    run,
    pseudocode: [
        "set a = ceil(sqrt(D)), b = 1, k = a squared minus D",
        "while k is not 1",
        "choose m with a + b*m divisible by k, minimizing |m squared minus D|",
        "set a = (a*m + D*b)/|k| and b = (a + b*m)/|k|",
        "set k = (m squared minus D)/k",
        "repeat until k = 1",
        "done: x = a and y = b solve the Pell equation",
    ],
};

export default module;
