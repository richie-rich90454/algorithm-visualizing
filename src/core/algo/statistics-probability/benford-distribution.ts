/**
 * benford-distribution.ts - Benford's First-Digit Law
 *
 * For many naturally occurring data sets the leading decimal digit d follows
 * P(d) = log10(1 + 1/d) rather than a uniform distribution. This module tabulates
 * the nine digit probabilities, reveals them one at a time, and reports their
 * total and the implied probabilities for the first two digits.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BenfordInput {
    digits?: number;
}

/** First-digit probability under Benford's law. */
function firstDigit(d: number): number {
    return Math.log10(1 + 1 / d);
}

/** First-two-digit probability under the generalized law, for 10 through 99. */
function firstTwoDigits(n: number): number {
    return Math.log10(1 + 1 / n);
}

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((p, index) => {
        const digit = index + 1;
        let state: EntityState = "idle";
        if (done) state = "sorted";
        else if (index === active) state = "comparing";
        else if (index < active) state = "visited";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${digit}: ${p.toFixed(4)}`,
            value: p,
            state,
            x: index,
            y: 0,
            width: 0,
            height: 0,
            metadata: { digit, probability: p },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BenfordInput | null) ?? {};
    const digits = Math.min(9, Math.max(1, Math.floor(Number(task.digits ?? 9)) || 9));
    const probabilities = Array.from({ length: digits }, (_, i) => firstDigit(i + 1));
    const total = probabilities.reduce((a, b) => a + b, 0);
    const twoDigitTotal = Array.from({ length: 90 }, (_, i) => firstTwoDigits(i + 10))
        .reduce((a, b) => a + b, 0);

    yield {
        stepNumber: 0,
        entities: makeBars(probabilities.map(() => 0), -1, false),
        edges: [],
        description: `Benford's law: the leading digit d has probability log10(1 + 1/d) for d = 1 through ${digits}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { digits, probabilities: probabilities.map(() => 0), total: 0, twoDigitTotal: 0 },
    };

    let step = 1;
    for (let i = 0; i < digits; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(probabilities, i, false),
            edges: [],
            description: `Digit ${i + 1} occurs with probability log10(1 + 1/${i + 1}) = ${probabilities[i]!.toFixed(5)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                digits,
                probabilities: probabilities.slice(0, i + 1),
                total: probabilities.slice(0, i + 1).reduce((a, b) => a + b, 0),
                twoDigitTotal: 0,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(probabilities, -1, true),
        edges: [],
        description: `The nine probabilities sum to ${total.toFixed(9)}; the first two digits 10..99 also sum to ${twoDigitTotal.toFixed(9)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            digits,
            probabilities: [...probabilities],
            total,
            twoDigitTotal,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "In data that span several orders of magnitude, small leading digits are far more common than large ones. About thirty percent of values start with one, while only about five percent start with nine. Benford's law captures this by taking logarithms, because a value's leading digit depends on the fractional part of its base-ten logarithm.",
        invariants: [
            "Probabilities decrease strictly as the digit increases.",
            "The nine probabilities sum to one because the logarithms telescope to log10(10).",
            "The generalized two-digit law also sums to one over 10 through 99.",
        ],
        correctness:
            "A value has leading digit d exactly when its base-ten logarithm has fractional part in the interval from log10(d) to log10(d plus one). If those fractional parts are uniformly distributed, the interval length is log10(d plus one) minus log10(d), which equals log10(1 plus one over d). Summing over d from one to nine telescopes to log10(10) equal to one. The same interval argument for two-digit prefixes gives the generalized formula and the same telescoping total.",
        complexityRationale:
            "Computing one logarithm per digit is constant time, so producing all nine probabilities is O(1) with O(1) storage beyond the displayed bars.",
        uses: [
            "Detecting anomalies in accounting and tax data",
            "Checking the distribution of scientific measurements",
            "A sanity check for fraud auditing and data quality",
        ],
        references: [
            "Benford, The Law of Anomalous Numbers, 1938",
            "Hill, A Statistical Derivation of the Significant-Digit Law, 1995",
        ],
        workedExample:
            "For digit one the probability is log10(2) about 0.3010, and for digit nine it is log10(10/9) about 0.0458. Adding all nine values gives log10(10) exactly, so the law defines a proper probability distribution.",
    },
    id: "benford-distribution",
    name: "Benford's Law",
    category: "statistics-probability",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { digits: 9 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the leading digits to display",
        "for each digit d from one to nine",
        "compute the probability as log10(1 + 1/d)",
        "reveal the digit probability in the histogram",
        "sum all nine probabilities to check normalization",
        "also sum the two-digit law over 10 through 99",
        "done: report the leading-digit distribution",
    ],
};

export default module;
