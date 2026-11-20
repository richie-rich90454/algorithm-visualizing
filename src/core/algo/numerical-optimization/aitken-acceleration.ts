/**
 * aitken-acceleration.ts - Aitken's Delta-Squared Process
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A linearly convergent sequence approaches its limit at a roughly constant
 * ratio. Aitken's delta-squared process cancels that dominant error term by
 * combining three consecutive iterates into a much better estimate of the
 * limit. It needs no knowledge of the underlying map, only the numbers.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a sequence of n terms (one estimate per triple)
 *   Space: O(n) for the emitted bars, O(1) working memory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per sequence term, with the current triple highlighted.
 *   - The final frame marks every term as sorted and reports the limit.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AitkenInput {
    sequence?: number[];
    limit?: number;
}

/** One Aitken estimate from a consecutive triple. */
function aitken(a0: number, a1: number, a2: number): { estimate: number; denominator: number } {
    const first = a1 - a0;
    const denominator = a2 - 2 * a1 + a0;
    if (Math.abs(denominator) < 1e-15) {
        return { estimate: a2, denominator: 0 };
    }
    return { estimate: a0 - (first * first) / denominator, denominator };
}

/** Build the sequence bars for one frame. */
function makeBars(
    sequence: number[],
    window: [number, number, number] | null,
    limitBar: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = sequence.map((value, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (window && index >= window[0] && index <= window[2]) {
            state = "comparing";
        }
        return {
            id: `term-${index}`,
            type: "bar" as const,
            label: value.toFixed(6),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, role: "iterate" },
        };
    });
    entities.push({
        id: "term-limit",
        type: "bar" as const,
        label: limitBar.toFixed(6),
        value: limitBar,
        state: done ? "sorted" : "active",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: sequence.length, role: "estimate" },
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AitkenInput | null) ?? {};
    const provided = Array.isArray(task.sequence)
        ? task.sequence.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
        : [];
    const sequence: number[] = provided.length >= 3
        ? provided
        : Array.from({ length: 10 }, (_, k) => 2 + Math.pow(0.5, k));
    const referenceLimit = typeof task.limit === "number" && Number.isFinite(task.limit)
        ? task.limit
        : 2;

    yield {
        stepNumber: 0,
        entities: makeBars(sequence, null, sequence[sequence.length - 1] ?? 0, false),
        edges: [],
        description: `Accelerating a sequence of ${sequence.length} terms with Aitken's delta-squared process.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { terms: sequence.length, estimate: sequence[sequence.length - 1] ?? 0, iteration: 0, converged: false },
    };

    let step = 1;
    let lastEstimate = sequence[0] ?? 0;
    for (let i = 0; i + 2 < sequence.length; i += 1) {
        const a0 = sequence[i]!;
        const a1 = sequence[i + 1]!;
        const a2 = sequence[i + 2]!;
        const { estimate, denominator } = aitken(a0, a1, a2);
        const stable = Math.abs(estimate - lastEstimate) < 1e-10;
        lastEstimate = estimate;
        yield {
            stepNumber: step,
            entities: makeBars(sequence, [i, i + 1, i + 2], estimate, false),
            edges: [],
            description: `Triple ${i}: first difference ${(a1 - a0).toFixed(6)}, second difference ${denominator.toFixed(6)}; accelerated estimate ${estimate.toFixed(9)}.`,
            codeLineNumber: denominator === 0 ? 5 : 6,
            layout: "array",
            meta: {
                terms: sequence.length,
                estimate,
                lastRaw: a2,
                denominator,
                iteration: i + 1,
                converged: stable,
                referenceLimit,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(sequence, null, lastEstimate, true),
        edges: [],
        description: `Aitken extrapolation gives a limit estimate of ${lastEstimate.toFixed(10)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: {
            terms: sequence.length,
            estimate: lastEstimate,
            iteration: sequence.length - 2,
            converged: true,
            referenceLimit,
            error: Math.abs(lastEstimate - referenceLimit),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A slowly converging sequence often approaches its limit like a shrinking geometric error. Three consecutive terms are enough to measure that shrinking factor and subtract the remaining error. Aitken's process replaces the last raw term with this extrapolated value, which can be far closer to the limit than any term computed so far.",
        invariants: [
            "Each estimate uses exactly three consecutive terms of the original sequence.",
            "When the second difference is zero the raw term is kept and no division is attempted.",
            "For a pure geometric error sequence every triple returns the exact limit.",
        ],
        correctness:
            "Model the iterates as a_n = L + c r^n with |r| less than one. The first difference is c r^n (r minus one) and the second difference is c r^n (r minus one) squared, so their ratio is exactly c r^n. Subtracting that ratio from a_n removes the error term and leaves L. For sequences whose error is a sum of terms, the dominant term is canceled first and repeated application accelerates the remainder.",
        complexityRationale:
            "The generator scans the sequence once, doing a constant number of arithmetic operations per triple, so time is O(n) for n terms. It stores the input terms to build bars and uses only the previous estimate as working state, giving O(1) auxiliary space.",
        uses: [
            "Speeding up fixed-point iterations in numerical analysis",
            "Estimating limits of slowly convergent series",
            "Shanks-style sequence transformations in signal processing",
        ],
        references: [
            "Brenstein and Phillips, Numerical Analysis, section on convergence acceleration",
            "Press et al., Numerical Recipes, Chapter 5",
        ],
        workedExample:
            "For the sequence 3, 2.5, 2.25 with limit 2, the first difference is minus 0.5 and the second difference is 0.25. Aitken's estimate is 3 minus 0.25 over 0.25, which is exactly 2, the true limit, obtained three terms before the raw sequence gets that close.",
    },
    id: "aitken-acceleration",
    name: "Aitken Acceleration",
    category: "numerical-optimization",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { limit: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "read the input sequence of successive approximations",
        "if fewer than three terms are available, stop with no estimate",
        "for each consecutive triple a_n, a_n+1, a_n+2",
        "set the first difference to a_n+1 minus a_n",
        "set the second difference to a_n+2 minus twice a_n+1 plus a_n",
        "if the second difference is zero keep the raw term",
        "otherwise set the estimate to a_n minus the first difference squared over the second difference",
        "done: report the final accelerated limit",
    ],
};

export default module;
