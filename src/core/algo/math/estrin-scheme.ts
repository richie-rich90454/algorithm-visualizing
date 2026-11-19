/**
 * estrin-scheme.ts - Estrin's Polynomial Evaluation Scheme
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Estrin's scheme evaluates a polynomial by grouping terms into pairs,
 * reducing the number of sequential multiplications compared with Horner's
 * method. At each level, adjacent coefficient groups are combined using the
 * current power x^(2^k), and the power is squared for the next level.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) additions and multiplications
 *   Space: O(n) for the working levels
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the coefficient pairs merged at each level.
 *   - The final frame reports the evaluated value in meta.value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(values: number[], labels: string[], active = -1): VisualEntity[] {
    return values.map((value, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: labels[i] ?? String(value),
        value,
        state: (i === active ? "comparing" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

/** Evaluate by Horner for an independent reference value. */
function horner(coeffs: number[], x: number): number {
    let acc = 0;
    for (let i = coeffs.length - 1; i >= 0; i -= 1) acc = acc * x + coeffs[i]!;
    return acc;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { coefficients?: number[]; x?: number } | null) ?? {};
    const coefficients: number[] = task.coefficients ?? [1, -2, 3, -4, 5];
    const x = typeof task.x === "number" ? task.x : 2;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(
            coefficients,
            coefficients.map((c, i) => `a${i}=${c}`),
        ),
        edges: [],
        description: `Evaluating a degree-${coefficients.length - 1} polynomial at x = ${x} with Estrin's scheme.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, degree: coefficients.length - 1, x },
    };
    step += 1;

    if (coefficients.length === 0) {
        yield {
            stepNumber: step,
            entities: makeCells([0], ["0"]),
            edges: [],
            description: "The empty polynomial evaluates to zero.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { step, value: 0 },
        };
        return;
    }

    // Each term is [coefficient, exponent-of-x].
    let level: Array<[number, number]> = coefficients.map((c, i) => [c, i]);
    let gap = 1;
    let levelIndex = 0;
    while (level.length > 1) {
        const next: Array<[number, number]> = [];
        const labels: string[] = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i]!;
            if (i + 1 < level.length) {
                const right = level[i + 1]!;
                const factor = Math.pow(x, right[1] - left[1]);
                const value = left[0] + right[0] * factor;
                next.push([value, left[1]]);
                labels.push(`${left[0]}+${right[0]}*x^${right[1] - left[1]}=${value}`);
            } else {
                next.push(left);
                labels.push(`carry ${left[0]}*x^${left[1]}`);
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(
                next.map((t) => t[0]),
                labels,
                0,
            ),
            edges: [],
            description: `Level ${levelIndex}: merge adjacent groups using x^${gap} to form ${next.length} group(s).`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { step, level: levelIndex, gap, groups: next.length },
        };
        step += 1;
        level = next;
        gap *= 2;
        levelIndex += 1;
    }

    const value = level[0]![0];
    const reference = horner(coefficients, x);
    yield {
        stepNumber: step,
        entities: makeCells([value], [`P(${x})=${value}`], 0),
        edges: [],
        description: `P(${x}) = ${value} (Horner reference: ${reference}).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { step, value, reference, x },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Horner's method folds one coefficient at a time, so each step waits on the previous multiplication. Estrin's scheme instead pairs neighboring coefficients first: a0 + a1*x, a2 + a3*x, and so on. Those pairs are independent and can be computed in parallel, then combined with x^2, then x^4, halving the number of groups at each level.",
        invariants: [
            "After each level, every group represents a contiguous block of the original terms with its correct power of x.",
            "The exponent gap doubles at each level because powers are squared.",
            "The final single group equals the polynomial value at x.",
        ],
        correctness:
            "At a given level each term is coefficient c times x^e for its exponent e, and adjacent terms have exponents differing by the current gap. Replacing a pair (c, x^e) and (d, x^(e+gap)) by c + d*x^gap at exponent e preserves the represented polynomial because c*x^e + d*x^(e+gap) = (c + d*x^gap)*x^e. Applying this identity level by level until one group remains yields exactly the original polynomial evaluated at x.",
        complexityRationale:
            "Each level handles each term once, and there are O(log n) levels, but the term count halves each time, so the total number of operations is O(n). Working storage is O(n) for the widest level.",
        uses: [
            "Vectorized polynomial evaluation on SIMD hardware",
            "Fast evaluation in computer graphics and signal processing",
            "Compiler optimization where independent multiplications hide latency",
        ],
        references: [
            "Estrin, Organization of Floating Point Digital Computers, 1960",
            "Knuth, The Art of Computer Programming Volume 2, Section 4.6.4",
        ],
        workedExample:
            "For coefficients 1, -2, 3, -4, 5 and x = 2, level one forms (1 - 4) = -3, (3 - 8) = -5, and a carried 5*x^4. Level two merges -3 + (-5)*4 = -23 and carries 5*x^4. The last level gives -23 + 5*16 = 57, which equals P(2) = 1 - 4 + 12 - 32 + 80 = 57.",
    },
    id: "estrin-scheme",
    name: "Estrin's Scheme",
    category: "math",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { coefficients: [1, -2, 3, -4, 5], x: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "input coefficients a[0..n-1] and point x",
        "form terms (a[i], exponent i) and set gap to one",
        "while more than one term remains",
        "merge pairs into left + right*x^gap keeping the left exponent",
        "double the gap for the next level",
        "done: the single remaining term is P(x)",
    ],
};

export default module;
