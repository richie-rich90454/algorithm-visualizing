/**
 * real-nvp.ts - Real-valued Non-Volume Preserving Affine Coupling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RealNVP builds an invertible transformation by splitting the input into two
 * halves, leaving one half unchanged and applying an affine map to the other:
 * y = x * exp(s(x_copy)) + t(x_copy). The Jacobian is triangular, so its
 * determinant is the product of the exp(s) terms and the log determinant is
 * simply the sum of the scales. The inverse is just as cheap to evaluate.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(layers * d) for d dimensions
 *   Space: O(d) for the running vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per coordinate of the running vector.
 *   - The copied half is GRAY, the transformed half turns GREEN.
 *   - The final frame reports the log determinant and inverse error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CouplingLayer {
    scale: number;
    shift: number;
    flip: boolean;
}

interface Input {
    x?: number[];
    layers?: CouplingLayer[];
}

function bars(values: number[], states: EntityState[], labels?: string[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: labels?.[index] ?? value.toFixed(3),
        value,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const x = (task.x ?? [1, 2]).slice(0, 2);
    while (x.length < 2) {
        x.push(0);
    }
    const layers: CouplingLayer[] = (task.layers ?? [
        { scale: 0.4, shift: 0.2, flip: false },
        { scale: -0.3, shift: 0.5, flip: true },
    ]).slice();

    let vector = x.slice();
    let logDet = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(vector, ["idle", "idle"]),
        edges: [],
        description: `Start with vector (${vector[0]?.toFixed(3)}, ${vector[1]?.toFixed(3)}) and ${layers.length} affine coupling layer(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { vector: vector.slice(), logDet, layer: 0 },
    };
    step += 1;

    for (let i = 0; i < layers.length; i += 1) {
        const layer = layers[i];
        if (!layer) {
            continue;
        }
        const copyIndex = layer.flip ? 1 : 0;
        const transformIndex = layer.flip ? 0 : 1;
        const copied = vector[copyIndex] ?? 0;
        const s = layer.scale * copied;
        const t = layer.shift * copied;
        vector[transformIndex] = (vector[transformIndex] ?? 0) * Math.exp(s) + t;
        logDet += s;
        const states: EntityState[] = ["idle", "idle"];
        states[copyIndex] = "comparing";
        states[transformIndex] = "active";

        yield {
            stepNumber: step,
            entities: bars(vector, states),
            edges: [],
            description: `Layer ${i + 1}: copied value ${copied.toFixed(3)} gives scale ${s.toFixed(3)} and shift ${t.toFixed(3)}; log determinant now ${logDet.toFixed(3)}.`,
            codeLineNumber: i % 2 === 0 ? 3 : 4,
            layout: "array",
            meta: { vector: vector.slice(), logDet, layer: i + 1, scale: s, shift: t },
        };
        step += 1;
    }

    // Recover the input by reversing the layers in opposite order.
    let inverse = vector.slice();
    for (let i = layers.length - 1; i >= 0; i -= 1) {
        const layer = layers[i];
        if (!layer) {
            continue;
        }
        const copyIndex = layer.flip ? 1 : 0;
        const transformIndex = layer.flip ? 0 : 1;
        const copied = inverse[copyIndex] ?? 0;
        const s = layer.scale * copied;
        const t = layer.shift * copied;
        inverse[transformIndex] = ((inverse[transformIndex] ?? 0) - t) * Math.exp(-s);
    }
    const inverseError = Math.max(
        Math.abs((inverse[0] ?? 0) - (x[0] ?? 0)),
        Math.abs((inverse[1] ?? 0) - (x[1] ?? 0)),
    );

    yield {
        stepNumber: step,
        entities: bars(vector, ["sorted", "sorted"]),
        edges: [],
        description: `Transformed (${vector[0]?.toFixed(3)}, ${vector[1]?.toFixed(3)}); log determinant ${logDet.toFixed(3)}, inverse error ${inverseError.toExponential(2)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { vector: vector.slice(), logDet, inverseError, converged: inverseError < 1e-8 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A coupling layer changes only part of a vector, and the amount of change depends on the part it leaves alone. Because one half is copied unchanged, the transformation matrix is triangular and its determinant is easy to read off. Stacking layers that copy alternating halves lets every coordinate eventually influence every other while keeping the whole map reversible.",
        invariants: [
            "The copied half of each layer is identical in the input and the output.",
            "The log determinant changes by exactly the scale s at every layer.",
            "Applying the inverse layers in reverse order reconstructs the original vector.",
        ],
        correctness:
            "For a coupling layer the Jacobian with respect to the transformed half is diag(exp(s)), with the copied half contributing an identity block, so the matrix is triangular and its determinant is the product of the exp(s) entries. Taking logs turns that product into the sum of the scales, which is what the algorithm accumulates. The inverse subtracts the shift and multiplies by exp(-s), algebraically undoing the forward affine map, so inversion is exact up to floating-point rounding.",
        complexityRationale:
            "Each coupling layer reads the two coordinates, forms one scale, one shift, one exponential and one affine update: constant work per dimension. With L layers the time is O(L times d), and only the current vector and running log determinant are stored, so space is O(d).",
        uses: [
            "Density estimation with invertible normalizing flows",
            "Exact likelihood evaluation in generative models",
            "Reversible feature transforms that preserve information",
        ],
        references: [
            "Dinh, Sohl-Dickstein and Bengio, Density Estimation Using Real NVP, ICLR 2017",
            "Dinh, Krueger and Bengio, Nice: Non-linear Independent Components Estimation, ICLR 2015",
        ],
        workedExample:
            "Start from (1, 2). With no flip, scale 0.4 and shift 0.2, the copied value is 1, so s is 0.4 and t is 0.2. The second coordinate becomes 2 times exp(0.4) plus 0.2, about 3.184, and the log determinant grows by 0.4. A flipped second layer copies that new second coordinate and updates the first; reversing both layers returns (1, 2).",
    },
    id: "real-nvp",
    name: "RealNVP Affine Coupling",
    category: "ml-ai",
    complexity: { time: "O(layers * d)", space: "O(d)" },
    defaultInput: {
        x: [1, 2],
        layers: [
            { scale: 0.4, shift: 0.2, flip: false },
            { scale: -0.3, shift: 0.5, flip: true },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the vector and the log determinant to zero",
        "for each affine coupling layer",
        "split the vector into a copied half and a transformed half",
        "compute the scale s and shift t from the copied half",
        "set the transformed half to its value times exp(s) plus t",
        "add the scale s to the accumulated log determinant",
        "alternate which half is copied in the next layer",
        "done: report the output vector and its log determinant",
    ],
};

export default module;
