/**
 * made.ts - Masked Autoregressive Density Estimator
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MADE enforces autoregressive structure in a feed-forward network by zeroing
 * out weights that would let an output depend on a later input. Every unit is
 * assigned a degree from the range between one and dim minus one, and a hidden
 * weight from unit j to unit i is allowed only when the target degree reaches
 * the source degree. The output layer uses a strict comparison against the
 * ordering degrees, so output i can only use inputs ordered before i.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L * D^3) to compose L boolean masks of D by D
 *   Space: O(L * D^2) for the stored masks
 *
 *  ---------------------------------------------------------------------------
 * Visualization mapping
 *  ---------------------------------------------------------------------------
 *   - Cells show a mask matrix: a filled cell is a permitted connection.
 *   - The final frame shows the composed input-to-output dependency matrix.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MadeInput {
    order?: number[];
    degrees?: number[][];
}

/** Compose two boolean matrices with boolean multiplication. */
function compose(left: number[][], right: number[][]): number[][] {
    const rows = left.length;
    const inner = right.length;
    const cols = inner === 0 ? 0 : (right[0]?.length ?? 0);
    const result: number[][] = [];
    for (let i = 0; i < rows; i += 1) {
        const row: number[] = [];
        for (let j = 0; j < cols; j += 1) {
            let connected = 0;
            for (let k = 0; k < inner; k += 1) {
                if ((left[i]?.[k] ?? 0) === 1 && (right[k]?.[j] ?? 0) === 1) {
                    connected = 1;
                    break;
                }
            }
            row.push(connected);
        }
        result.push(row);
    }
    return result;
}

function maskFor(targetDegrees: number[], sourceDegrees: number[], strict: boolean): number[][] {
    return targetDegrees.map((target) =>
        sourceDegrees.map((source) => (strict ? (target > source ? 1 : 0) : (target >= source ? 1 : 0))),
    );
}

function cells(matrix: number[][], layer: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < matrix.length; i += 1) {
        for (let j = 0; j < (matrix[i]?.length ?? 0); j += 1) {
            const enabled = (matrix[i]?.[j] ?? 0) === 1;
            entities.push({
                id: `mask-${layer}-cell-${i}-${j}`,
                type: "cell" as const,
                label: enabled ? "1" : "0",
                value: enabled ? 1 : 0,
                state: (enabled ? "active" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, layer, enabled },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MadeInput | null) ?? {};
    const order: number[] = Array.isArray(task.order) && task.order.length > 0 ? task.order.slice() : [3, 1, 4, 2];
    const dim = order.length;
    const degrees: number[][] = Array.isArray(task.degrees) && task.degrees.length > 0
        ? task.degrees.map((row) => row.slice())
        : [0, 1].map(() => Array.from({ length: dim }, (_, i) => 1 + (i % Math.max(1, dim - 1))));

    const masks: number[][][] = [];
    let sourceDegrees = order.slice();
    for (let layer = 0; layer < degrees.length; layer += 1) {
        const targetDegrees = degrees[layer] ?? [];
        masks.push(maskFor(targetDegrees, sourceDegrees, false));
        sourceDegrees = targetDegrees;
    }
    masks.push(maskFor(order, sourceDegrees, true));

    let dependency: number[][] = masks[0] ?? [];
    for (let layer = 1; layer < masks.length; layer += 1) {
        dependency = compose(masks[layer] ?? [], dependency);
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(masks[0] ?? [], 0),
        edges: [],
        description: `Build ${masks.length} degree masks over ${dim} ordered units.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { phase: "setup", order, degrees, dim, rows: (masks[0] ?? []).length, cols: (masks[0]?.[0] ?? []).length, masks: [masks[0] ?? []], dependency: [] },
    };
    step += 1;

    for (let layer = 0; layer < masks.length; layer += 1) {
        const matrix = masks[layer] ?? [];
        const isOutput = layer === masks.length - 1;
        yield {
            stepNumber: step,
            entities: cells(matrix, layer),
            edges: [],
            description: isOutput
                ? "Output edges use a strict degree test so a unit never reads itself."
                : `Hidden layer ${layer + 1} permits an edge when the target degree reaches the source.`,
            codeLineNumber: isOutput ? 2 : 1,
            layout: "matrix",
            meta: { phase: isOutput ? "output-mask" : "hidden-mask", order, degrees, dim, rows: matrix.length, cols: (matrix[0] ?? []).length, masks: masks.slice(0, layer + 1), dependency: [] },
        };
        step += 1;
    }

    const valid = dependency.every((row, i) =>
        row.every((value, j) => value === ((order[i] ?? 0) > (order[j] ?? 0) ? 1 : 0)),
    );
    yield {
        stepNumber: step,
        entities: cells(dependency, masks.length),
        edges: [],
        description: `Done: composed dependency matches the ordering: ${valid ? "yes" : "no"}.`,
        codeLineNumber: 5,
        layout: "matrix",
        meta: { phase: "done", order, degrees, dim, rows: dependency.length, cols: (dependency[0] ?? []).length, masks, dependency, expected: order.map((a) => order.map((b) => (a > b ? 1 : 0))), valid },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A normal feed-forward network lets every output look at every input, which breaks the left-to-right dependency an autoregressive density model needs. MADE assigns each unit a degree from a random ordering and deletes weights that would let an output see an input of equal or later rank. The composed network then predicts each feature using only features that come before it in that ordering.",
        invariants: [
            "Hidden edges are allowed only when the target degree is at least the source degree.",
            "Output edges are allowed only when the target degree strictly exceeds the source degree.",
            "The composed dependency says output i may read input j exactly when order i exceeds order j.",
        ],
        correctness:
            "Each mask is a threshold matrix on degrees. Composing threshold matrices with boolean multiplication keeps the transitive condition: a source of degree s reaches a target of degree t exactly when t is at least s. Because every hidden layer contains a unit of each degree from one to dim minus one, an input with ordering degree can always bridge to a hidden unit of that same degree, and the strict output test turns the condition into order i greater than order j. The final frame checks the boolean product against that greater-than matrix.",
        complexityRationale:
            "Building L masks of size D by D takes O(L D^2), and composing them with boolean matrix multiplication costs O(L D^3) with the straightforward implementation. The masks and the dependency matrix occupy O(L D^2) space.",
        uses: [
            "Autoregressive density estimation with masked feed-forward networks",
            "Neural autoregressive language and image models",
            "Ensembling multiple orderings into one model",
        ],
        references: [
            "Germain et al., MADE: Masked Autoencoder for Distribution Estimation, ICML 2015",
            "Larochelle and Murray, The Neural Autoregressive Distribution Estimator, AISTATS 2011",
        ],
        workedExample:
            "With ordering three, one, four, two and hidden degrees one, two, three, one, the first hidden layer keeps inputs whose order is at most their unit degree. The output mask keeps a connection only when the output order strictly exceeds the hidden degree. Composing the masks gives a dependency whenever one output order is larger than an input order, and no dependency otherwise.",
    },
    id: "made",
    name: "MADE Masked Autoregressive Model",
    category: "ml-ai",
    complexity: { time: "O(L * D^3)", space: "O(L * D^2)" },
    defaultInput: { order: [3, 1, 4, 2], degrees: [[1, 2, 3, 1], [2, 3, 1, 2]] },
    visualType: "matrix",
    run,
    pseudocode: [
        "read the unit ordering and the per-unit hidden degrees",
        "for each hidden layer allow an edge when target degree reaches source degree",
        "for the output layer require the target degree to strictly exceed the source",
        "compose the masks with boolean matrix multiplication",
        "compare the composition with the order greater-than matrix",
        "done: report the masks and the verified dependency matrix",
    ],
};

export default module;
