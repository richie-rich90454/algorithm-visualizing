/**
 * simpson-three-eighths.ts - Composite Simpson 3/8 Rule
 *
 * Approximates a definite integral by fitting a cubic through each group of
 * four equally spaced samples and summing the resulting panel areas. The rule
 * is exact for polynomials of degree three or less and uses the weights
 * 3, 3, 2 repeating across interior nodes.
 *
 *   Time:  O(n) sample evaluations
 *   Space: O(n) stored samples
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type FunctionId = "poly2" | "poly3" | "sin" | "exp";

interface SimpsonInput {
    a?: number;
    b?: number;
    n?: number;
    f?: FunctionId;
}

const FUNCTIONS: Record<FunctionId, (x: number) => number> = {
    poly2: (x) => x * x,
    poly3: (x) => x * x * x - 2 * x + 1,
    sin: (x) => Math.sin(x),
    exp: (x) => Math.exp(x),
};

function exactIntegral(f: FunctionId, a: number, b: number): number {
    switch (f) {
        case "poly2":
            return (b * b * b - a * a * a) / 3;
        case "poly3":
            return (b ** 4 - a ** 4) / 4 - (b * b - a * a) + (b - a);
        case "sin":
            return Math.cos(a) - Math.cos(b);
        case "exp":
            return Math.exp(b) - Math.exp(a);
    }
}

function makeEntities(
    a: number,
    h: number,
    values: number[],
    activeIndex: number,
    showAll: boolean,
): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (showAll) {
            state = "sorted";
        } else if (index === activeIndex) {
            state = "active";
        }
        return {
            id: `sample-${index}`,
            type: "node" as const,
            label: value.toFixed(3),
            value,
            state,
            x: a + h * index,
            y: value,
            width: 0,
            height: 0,
            metadata: { index, x: a + h * index, y: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SimpsonInput | null) ?? {};
    const a = typeof task.a === "number" && Number.isFinite(task.a) ? task.a : 0;
    const b = typeof task.b === "number" && Number.isFinite(task.b) && task.b > a ? task.b : 3;
    const f: FunctionId = task.f === "poly2" || task.f === "poly3" || task.f === "sin" || task.f === "exp" ? task.f : "poly3";
    const requested = typeof task.n === "number" && task.n >= 3 ? Math.trunc(task.n) : 12;
    const n = requested + ((3 - (requested % 3)) % 3);
    const h = (b - a) / n;
    const fn = FUNCTIONS[f];
    const values: number[] = [];
    for (let i = 0; i <= n; i += 1) values.push(fn(a + h * i));

    let weighted = values[0] ?? 0;
    for (let i = 1; i < n; i += 1) {
        weighted += (i % 3 === 0 ? 2 : 3) * (values[i] ?? 0);
    }
    weighted += values[n] ?? 0;
    const estimate = (3 * h * weighted) / 8;
    const exact = exactIntegral(f, a, b);
    const error = Math.abs(estimate - exact);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(a, h, values, -1, false),
        edges: [],
        description: `Sample ${f} at ${n + 1} equally spaced points on [${a}, ${b}] for the 3/8 rule.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { rows: 1, cols: n + 1, a, b, n, h, f, estimate: 0 },
    };
    step += 1;

    const preview = Math.min(n - 1, 11);
    for (let panel = 0; panel < preview; panel += 1) {
        const node = 3 * panel + 1;
        yield {
            stepNumber: step,
            entities: makeEntities(a, h, values, node, false),
            edges: [],
            description: `Panel ${panel + 1}: weights 3, 3, 2 give contribution ${((3 * h) / 8 * (3 * (values[node] ?? 0) + 3 * (values[node + 1] ?? 0) + 2 * (values[node + 2] ?? 0))).toFixed(6)}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: { rows: 1, cols: n + 1, a, b, n, h, f, panel, nodes: panel * 3 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(a, h, values, -1, true),
        edges: [],
        description: `Done: the composite 3/8 estimate is ${estimate.toFixed(8)} with error ${error.toExponential(2)}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { rows: 1, cols: n + 1, a, b, n, h, f, estimate, exact, error, panels: n / 3 },
    };
}

const module: AlgorithmModule = {
    id: "simpson-three-eighths",
    name: "Simpson Three Eighths Rule",
    category: "math",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { a: 0, b: 3, n: 12, f: "poly3" },
    visualType: "point",
    run,
    pseudocode: [
        "choose n as a multiple of three and set h = (b - a) / n",
        "for each panel of three subintervals use weights 3, 3, 2 on interior nodes",
        "add the two endpoints with weight one",
        "multiply the weighted sum by 3h / 8",
        "done: report the integral estimate and its error",
    ],
    education: {
        intuition:
            "Simpson's 3/8 rule replaces each group of three subintervals with a cubic that passes through the four sample points, then integrates that cubic exactly. Adding the panel areas approximates the whole integral, and repeating weights keep the work linear in the number of samples.",
        invariants: [
            "The number of subintervals is a multiple of three.",
            "All sample points are equally spaced by h = (b - a) / n.",
            "Interior weights repeat 3, 3, 2 while endpoints carry weight one.",
        ],
        correctness:
            "On one panel the interpolating cubic through four equally spaced nodes can be integrated exactly, and its integral is 3h/8 times the weighted sample sum with weights 1, 3, 3, 1. Summing panels telescopes shared endpoints into the repeating 3, 3, 2 pattern. Because a cubic is reproduced exactly on each panel, any polynomial of degree at most three is integrated with zero error.",
        complexityRationale:
            "Each of the n subintervals needs one function evaluation and a constant amount of accumulation, giving O(n) time. Storing the sample values for the plot uses O(n) space.",
        uses: [
            "Numerical integration when a smooth function has no closed-form antiderivative",
            "Engineering quadrature with a fixed even-by-three sample count",
            "Teaching Newton-Cotes formulas alongside the 1/3 rule",
        ],
        references: [
            "Burden and Faires, Numerical Analysis, Numerical Integration chapter",
            "Wikipedia, Simpson's rule, Simpson's 3/8 rule",
        ],
        workedExample:
            "Integrating x cubed minus two x plus one on [0, 3] with n = 3 gives h = 1 and samples 1, 0, 5, 22. The weighted sum is 1 + 3*0 + 3*5 + 2*0 + 22... using the panel weights 1, 3, 3, 1 yields 1*1 + 3*0 + 3*5 + 1*22 = 38, and 3h/8 times 38 is 14.25, the exact integral.",
    },
};

export default module;
