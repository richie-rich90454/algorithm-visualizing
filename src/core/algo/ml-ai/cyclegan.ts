/**
 * cyclegan.ts - CycleGAN Cycle Consistency Objective
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CycleGAN learns to translate between two domains without paired examples. It
 * uses two generators that map in opposite directions and enforces that going
 * from one domain to the other and back returns the original sample. This demo
 * uses affine generators so the forward cycle, backward cycle, identity loss,
 * and total objective can all be computed exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n scalar samples in each domain
 *   Space: O(n) for the translated vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show each domain, its translation, and the round-trip result.
 *   - The final frame reports the three loss terms and their weighted sum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    a?: number[];
    b?: number[];
    sAB?: number;
    bAB?: number;
    sBA?: number;
    bBA?: number;
    lambda?: number;
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
    const a = (task.a ?? [1, 2, 3]).slice();
    const b = (task.b ?? [0.5, 1, 1.5]).slice();
    const sAB = typeof task.sAB === "number" ? task.sAB : 2;
    const bAB = typeof task.bAB === "number" ? task.bAB : 0.3;
    const sBA = typeof task.sBA === "number" ? task.sBA : 0.5;
    const bBA = typeof task.bBA === "number" ? task.bBA : -0.2;
    const lambda = typeof task.lambda === "number" ? task.lambda : 10;

    const gAB = (x: number): number => sAB * x + bAB;
    const gBA = (y: number): number => sBA * y + bBA;

    const ab = a.map(gAB);
    const aba = ab.map(gBA);
    const ba = b.map(gBA);
    const bab = ba.map(gAB);
    const identityA = a.map(gBA);
    const identityB = b.map(gAB);

    const cycleLossA = aba.reduce((sum, v, i) => sum + Math.abs(v - (a[i] ?? 0)), 0);
    const cycleLossB = bab.reduce((sum, v, i) => sum + Math.abs(v - (b[i] ?? 0)), 0);
    const identityLoss = identityA.reduce((sum, v, i) => sum + Math.abs(v - (a[i] ?? 0)), 0)
        + identityB.reduce((sum, v, i) => sum + Math.abs(v - (b[i] ?? 0)), 0);
    const total = cycleLossA + cycleLossB + lambda * identityLoss;

    yield {
        stepNumber: 0,
        entities: bars(a, new Array<EntityState>(a.length).fill("idle")),
        edges: [],
        description: `Domain A sample (${a.map((v) => v.toFixed(2)).join(", ")}); weight on identity loss is ${lambda}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { cycleLossA, cycleLossB, identityLoss, total },
    };

    yield {
        stepNumber: 1,
        entities: bars(b, new Array<EntityState>(b.length).fill("comparing")),
        edges: [],
        description: `Domain B sample (${b.map((v) => v.toFixed(2)).join(", ")}).`,
        codeLineNumber: 1,
        layout: "array",
        meta: { cycleLossA, cycleLossB, identityLoss, total },
    };

    yield {
        stepNumber: 2,
        entities: bars(ab, new Array<EntityState>(ab.length).fill("active")),
        edges: [],
        description: `Translate A to B: (${ab.map((v) => v.toFixed(2)).join(", ")}).`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ab: ab.slice(), cycleLossA, cycleLossB, identityLoss, total },
    };

    yield {
        stepNumber: 3,
        entities: bars(aba, new Array<EntityState>(aba.length).fill("swapped")),
        edges: [],
        description: `Translate back B to A: (${aba.map((v) => v.toFixed(2)).join(", ")}); forward cycle loss ${cycleLossA.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ab: ab.slice(), aba: aba.slice(), cycleLossA, cycleLossB, identityLoss, total },
    };

    yield {
        stepNumber: 4,
        entities: bars(bab, new Array<EntityState>(bab.length).fill("swapped")),
        edges: [],
        description: `Backward cycle B to A to B has loss ${cycleLossB.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ba: ba.slice(), bab: bab.slice(), cycleLossA, cycleLossB, identityLoss, total },
    };

    yield {
        stepNumber: 5,
        entities: bars([cycleLossA, cycleLossB, identityLoss, total], [
            "comparing",
            "comparing",
            "comparing",
            "sorted",
        ]),
        edges: [],
        description: `Total objective = forward ${cycleLossA.toFixed(3)} + backward ${cycleLossB.toFixed(3)} + ${lambda} times identity ${identityLoss.toFixed(3)} = ${total.toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ab: ab.slice(), aba: aba.slice(), ba: ba.slice(), bab: bab.slice(), cycleLossA, cycleLossB, identityLoss, total },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Without paired examples there is no direct target for translating an image from one domain to another. CycleGAN gets around this by requiring a round trip: translate an image to the other style and back again, then demand that the result looks like the original. That cycle constraint is strong enough to learn useful translations while an identity term stops the generators from changing everything.",
        invariants: [
            "Each generator is applied independently to every scalar sample.",
            "Cycle consistency compares the round trip with the original sample.",
            "The total objective is the sum of both cycle losses and a weighted identity loss.",
        ],
        correctness:
            "For affine generators, composing B to A after A to B gives s_BA times (s_AB times x plus b_AB) plus b_BA, which equals x exactly when s_AB times s_BA is one and b_BA is minus s_BA times b_AB. In that case every cycle residual is zero and the cycle loss vanishes, so the objective rewards generators that are mutual inverses. The identity term compares each generator output on its own domain against the input, discouraging unnecessary changes.",
        complexityRationale:
            "Translating n scalars in each direction and accumulating absolute differences is linear work, so the time is O(n). The translated vectors in the final frame occupy O(n) space.",
        uses: [
            "Unpaired image-to-image translation such as horse to zebra",
            "Style transfer without aligned training photographs",
            "Domain adaptation by translating data into a common style",
        ],
        references: [
            "Zhu, Park, Isola and Efros, Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks, ICCV 2017",
            "Isola, Zhu, Zhou and Efros, Image-to-Image Translation with Conditional Adversarial Networks, CVPR 2017",
        ],
        workedExample:
            "With generators g_AB(x)=2x+0.3 and g_BA(y)=0.5y-0.2, a value 1 becomes 2.3 then 0.95, so the forward cycle residual is -0.05. Over samples the absolute residuals sum into the forward cycle loss; the backward cycle and identity terms are computed the same way and combined into the total objective.",
    },
    id: "cyclegan",
    name: "CycleGAN Cycle Consistency",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        a: [1, 2, 3],
        b: [0.5, 1, 1.5],
        sAB: 2,
        bAB: 0.3,
        sBA: 0.5,
        bBA: -0.2,
        lambda: 10,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read samples from both domains and the affine generator parameters",
        "translate domain A samples into domain B",
        "translate them back and measure the forward cycle loss",
        "translate domain B samples back and forth for the backward cycle loss",
        "apply each generator to its own domain for the identity loss",
        "sum both cycle losses plus lambda times the identity loss",
        "done: report the three losses and the total objective",
    ],
};

export default module;
