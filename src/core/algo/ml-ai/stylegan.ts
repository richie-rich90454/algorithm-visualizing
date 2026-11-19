/**
 * stylegan.ts - StyleGAN Mapping Network and Style Mixing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * StyleGAN does not feed a latent code directly into the generator. A mapping
 * network first transforms the random input into an intermediate style vector,
 * and that style controls the synthesis network at each resolution level.
 * Style mixing draws two different latents and uses the first style for early
 * layers and the second for later layers, producing an image that combines
 * coarse and fine traits from two sources. This demo shows the mapping and the
 * per-layer crossover.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(layers + d^2) for the affine mapping and per-layer selection
 *   Space: O(layers * d) for the mixed style table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the two latent inputs, their mapped styles, and the per-layer
 *     style signature.
 *   - Layers below the crossover use a sorted state and later layers a swapped
 *     state, making the mixing boundary visible.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    z1?: number[];
    z2?: number[];
    map?: number[];
    bias?: number[];
    layers?: number;
    crossover?: number;
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
    const z1 = (task.z1 ?? [1, -1]).slice(0, 2);
    while (z1.length < 2) {
        z1.push(0);
    }
    const z2 = (task.z2 ?? [-0.5, 2]).slice(0, 2);
    while (z2.length < 2) {
        z2.push(0);
    }
    const map = (task.map ?? [0.8, 0.2, -0.3, 0.9]).slice(0, 4);
    while (map.length < 4) {
        map.push(0);
    }
    const bias = (task.bias ?? [0.1, -0.1]).slice(0, 2);
    while (bias.length < 2) {
        bias.push(0);
    }
    const layers = typeof task.layers === "number" ? Math.max(1, Math.floor(task.layers)) : 6;
    const crossover = typeof task.crossover === "number"
        ? Math.max(0, Math.min(layers, Math.floor(task.crossover)))
        : 3;

    const encode = (z: number[]): number[] => [
        (map[0] ?? 0) * (z[0] ?? 0) + (map[1] ?? 0) * (z[1] ?? 0) + (bias[0] ?? 0),
        (map[2] ?? 0) * (z[0] ?? 0) + (map[3] ?? 0) * (z[1] ?? 0) + (bias[1] ?? 0),
    ];
    const w1 = encode(z1);
    const w2 = encode(z2);

    const mixed: number[][] = [];
    for (let layer = 0; layer < layers; layer += 1) {
        mixed.push((layer < crossover ? w1 : w2).slice());
    }
    const signature = mixed.map((style) => (style[0] ?? 0) + (style[1] ?? 0));

    yield {
        stepNumber: 0,
        entities: bars(z1, ["idle", "idle"]),
        edges: [],
        description: `First latent z1 = (${z1[0]?.toFixed(3)}, ${z1[1]?.toFixed(3)}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { layers, crossover, w1: w1.slice(), w2: w2.slice() },
    };

    yield {
        stepNumber: 1,
        entities: bars(z2, ["comparing", "comparing"]),
        edges: [],
        description: `Second latent z2 = (${z2[0]?.toFixed(3)}, ${z2[1]?.toFixed(3)}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { layers, crossover, w1: w1.slice(), w2: w2.slice() },
    };

    yield {
        stepNumber: 2,
        entities: bars(w1, ["active", "active"]),
        edges: [],
        description: `Mapping network produces style w1 = (${w1[0]?.toFixed(3)}, ${w1[1]?.toFixed(3)}).`,
        codeLineNumber: 1,
        layout: "array",
        meta: { layers, crossover, w1: w1.slice(), w2: w2.slice() },
    };

    yield {
        stepNumber: 3,
        entities: bars(w2, ["active", "active"]),
        edges: [],
        description: `Mapping network produces style w2 = (${w2[0]?.toFixed(3)}, ${w2[1]?.toFixed(3)}).`,
        codeLineNumber: 2,
        layout: "array",
        meta: { layers, crossover, w1: w1.slice(), w2: w2.slice() },
    };

    const layerStates: EntityState[] = new Array<EntityState>(layers)
        .fill("swapped")
        .map((state, layer) => (layer < crossover ? "sorted" : state));
    yield {
        stepNumber: 4,
        entities: bars(signature, layerStates),
        edges: [],
        description: `Style mixing uses w1 for layers 0..${crossover - 1} and w2 from layer ${crossover} onward.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { layers, crossover, w1: w1.slice(), w2: w2.slice(), mixed: mixed.flat(), signature },
    };

    yield {
        stepNumber: 5,
        entities: bars(signature, layerStates),
        edges: [],
        description: `Per-layer style signatures across ${layers} synthesis layers with crossover ${crossover}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { layers, crossover, w1: w1.slice(), w2: w2.slice(), mixed: mixed.flat(), signature },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "StyleGAN separates deciding what an image should look like from drawing it. A mapping network turns random noise into a style vector, and that style is injected at several resolution levels, from coarse shape to fine texture. By drawing two different latents and switching styles partway through the layers, the generator combines large-scale features from one source with small-scale details from another.",
        invariants: [
            "The mapping network is a fixed affine transform in this demo.",
            "Layers before the crossover use the first style and later layers use the second.",
            "Setting the crossover to zero or the layer count removes mixing entirely.",
        ],
        correctness:
            "The mapping is a linear transform followed by a bias, so each style component is a weighted sum of the latent components plus a constant. The per-layer selection chooses exactly one of the two style vectors based on the crossover index, which partitions the layer range into a prefix and a suffix. When crossover equals zero every layer takes the second style, and when it equals the number of layers every layer takes the first style, so mixing is controlled precisely by a single boundary.",
        complexityRationale:
            "The affine mapping costs a fixed number of multiplications, and selecting a style for each of L layers is linear, so time is O(L plus d squared). Storing the mixed style per layer uses O(L times d) space.",
        uses: [
            "High-resolution controllable image synthesis",
            "Interpolating coarse and fine attributes between samples",
            "Understanding disentanglement inside modern generators",
        ],
        references: [
            "Karras, Laine and Aila, A Style-Based Generator Architecture for Generative Adversarial Networks, CVPR 2019",
            "Karras, Laine, Aittala, Hellsten and Lehtinen, Analyzing and Improving the Image Quality of StyleGAN, CVPR 2020",
        ],
        workedExample:
            "With mapping matrix entries 0.8, 0.2, -0.3, 0.9 and bias (0.1, -0.1), latent (1, -1) maps to about (0.7, -1.3) and latent (-0.5, 2) maps to about (-0.1, 1.75). With six layers and crossover three, the first three layers receive the first style and the last three receive the second, so coarse structure and fine detail come from different sources.",
    },
    id: "stylegan",
    name: "StyleGAN Style Mixing",
    category: "ml-ai",
    complexity: { time: "O(layers + d^2)", space: "O(layers * d)" },
    defaultInput: {
        z1: [1, -1],
        z2: [-0.5, 2],
        map: [0.8, 0.2, -0.3, 0.9],
        bias: [0.1, -0.1],
        layers: 6,
        crossover: 3,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read two latent codes, the mapping matrix, and the crossover layer",
        "map the first latent into style w1",
        "map the second latent into style w2",
        "for each synthesis layer choose w1 before the crossover and w2 after",
        "record the per-layer style signature",
        "done: report the mapped styles and the mixing boundary",
    ],
};

export default module;
