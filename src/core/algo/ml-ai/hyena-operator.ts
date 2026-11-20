/**
 * hyena-operator.ts - Hyena Operator (Teachable Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Hyena replaces the quadratic attention matrix with long convolutions that
 * are gated by the input itself. This module implements the order-two
 * recurrence exactly: a first causal convolution of the input with filter h1,
 * an elementwise multiplication of that result by the input (the data
 * control), and a second causal convolution with filter h2. Every summation
 * is computed directly, so the result is reproducible and easy to verify.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) with direct causal convolutions (implicit O(n log n) forms exist)
 *   Space: O(n) for the intermediate sequences
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar chart per stage: input, first convolution, gated signal, output.
 *   - The description names the stage and reports the current values.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface HyenaInput {
    x?: number[];
    h1?: number[];
    h2?: number[];
}

function bars(values: number[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: "comparing" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function causalConv(x: number[], h: number[]): number[] {
    const n = x.length;
    return Array.from({ length: n }, (_unused, t) => {
        let sum = 0;
        for (let s = 0; s <= t; s += 1) {
            sum += (x[s] ?? 0) * (h[t - s] ?? 0);
        }
        return sum;
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as HyenaInput | null) ?? {};
    const x = Array.isArray(task.x) && task.x.length > 0 ? [...task.x] : [1, 2, 3, 1];
    const h1 = Array.isArray(task.h1) && task.h1.length > 0 ? [...task.h1] : [0.5, 0.25, 0.125, 0.0625];
    const h2 = Array.isArray(task.h2) && task.h2.length > 0 ? [...task.h2] : [0.25, 0.5, 0.25, 0.125];
    const n = x.length;
    const first = causalConv(x, h1);
    const gated = x.map((value, t) => value * (first[t] ?? 0));
    const output = causalConv(gated, h2);

    const base = { n };
    yield {
        stepNumber: 0,
        entities: bars(x),
        edges: [],
        description: `Input sequence of length ${n} enters the order-two Hyena operator.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, phase: "input", x, first: [], gated: [], output: [] },
    };
    yield {
        stepNumber: 1,
        entities: bars(first),
        edges: [],
        description: `First causal convolution: a[t] = sum over s of h1[t-s] times x[s].`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...base, phase: "convolve1", x, first, gated: [], output: [] },
    };
    yield {
        stepNumber: 2,
        entities: bars(gated),
        edges: [],
        description: `Input gating multiplies each convolved value by the current input: b[t] = x[t] times a[t].`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...base, phase: "gate", x, first, gated, output: [] },
    };
    yield {
        stepNumber: 3,
        entities: bars(output),
        edges: [],
        description: `Second causal convolution gives y[t] = sum over s of h2[t-s] times b[s].`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...base, phase: "output", x, first, gated, output, h1, h2 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Attention compares every token with every other token, which becomes expensive for long sequences. Hyena instead applies a long convolution whose filter is fixed or generated, and multiplies the result by the input so the operation depends on the data. Repeating this convolution-and-gate pattern builds a subquadratic sequence mixer that behaves like a weighted view of the past.",
        invariants: [
            "Each convolution is causal: the output at time t uses only inputs up to t.",
            "The gating step multiplies the convolved signal by the original input at the same position.",
            "With an identity second filter the output equals the gated signal exactly.",
        ],
        correctness:
            "The first stage is a direct evaluation of a causal convolution, summing h1 at lag t minus s against x at s for every s no greater than t. The gate applies the input pointwise, and the second stage is the same convolution formula applied to the gated sequence with h2. Because each stage is computed by the defining summation, the reported output equals the order-two Hyena recurrence for these filters.",
        complexityRationale:
            "Each of the two convolutions performs about n squared over two multiply-adds when evaluated directly, giving O(n squared) time and O(n) space for the intermediate sequences. Implicit convolution algorithms can reduce the time for long filters, but the direct form is used here for clarity.",
        uses: [
            "Language modeling with long sequences",
            "Audio and time-series modeling where long-range convolutions help",
            "Subquadratic alternatives to attention in large sequence models",
        ],
        references: [
            "Poli et al., Hyena Hierarchy: Towards Larger Convolutional Language Models, 2023",
            "Fu et al., Hungry Hungry Hippos: Towards Language Modeling with State Space Models, 2022",
        ],
        workedExample:
            "With input (1, 2, 3), filter h1 = (0.5, 0.25, 0.125), and h2 = (1, 0, 0), the first convolution gives (0.5, 1.25, 2.125). Gating by the input gives (0.5, 2.5, 6.375), and because h2 keeps only lag zero the output is that same gated sequence.",
    },
    id: "hyena-operator",
    name: "Hyena Operator (Teachable Core)",
    category: "ml-ai",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: {
        x: [1, 2, 3, 1],
        h1: [0.5, 0.25, 0.125, 0.0625],
        h2: [0.25, 0.5, 0.25, 0.125],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the input sequence and the two convolution filters",
        "compute a[t] as the causal convolution of x with h1",
        "gate the result by multiplying a[t] with x[t]",
        "compute y[t] as the causal convolution of the gated signal with h2",
        "done: report the output sequence and every stage",
    ],
};

export default module;
