/**
 * sam-2.ts - Mask Propagation With Memory (SAM 2 Teaching Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SAM 2 segments objects across video frames using a memory of past masks and
 * a promptable segmentation model. Its teachable algorithmic core is mask
 * propagation: a prompt seeds a few pixels with labels, and a propagation step
 * grows the mask by assigning each unlabeled pixel the majority label of its
 * already-labeled four-neighbors. Repeating the step spreads the object through
 * the grid. This is a deterministic teaching model of the memory-propagation
 * idea, not the real transformer-based SAM 2 model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * rows * cols) for the grid propagation
 *   Space: O(rows * cols) for one mask
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells form the grid mask, positioned by row and column.
 *   - Prompt seeds are SORTED, newly propagated pixels are ACTIVE.
 *   - The iteration, labeled count, and full mask are reported in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Sam2Input {
    rows?: number;
    cols?: number;
    prompt?: Array<[number, number, number]>;
    iterations?: number;
}

type Label = -1 | 0 | 1;

/** Build the grid mask cells for a frame. */
function makeCells(labels: Label[][], seeds: Set<number>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < labels.length; r += 1) {
        for (let c = 0; c < (labels[r]?.length ?? 0); c += 1) {
            const value = labels[r]?.[c] ?? -1;
            const index = r * (labels[0]?.length ?? 0) + c;
            let state: EntityState = "idle";
            if (seeds.has(index)) {
                state = "sorted";
            } else if (value !== -1) {
                state = "active";
            }
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: value === -1 ? "?" : String(value),
                value: value === -1 ? 0 : value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return entities;
}

/** Run the mask propagation generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Sam2Input | null) ?? {};
    const rows = typeof task.rows === "number" && task.rows > 0 ? Math.floor(task.rows) : 4;
    const cols = typeof task.cols === "number" && task.cols > 0 ? Math.floor(task.cols) : 4;
    const iterations = typeof task.iterations === "number" && task.iterations >= 0
        ? Math.floor(task.iterations)
        : 3;
    const prompt = Array.isArray(task.prompt) ? task.prompt : [[0, 0, 1], [0, 1, 1], [3, 3, 0]];

    const labels: Label[][] = Array.from({ length: rows }, () => new Array<Label>(cols).fill(-1));
    const seeds = new Set<number>();
    for (const entry of prompt) {
        const r = entry?.[0] ?? -1;
        const c = entry?.[1] ?? -1;
        const label = entry?.[2] ?? -1;
        if (r >= 0 && r < rows && c >= 0 && c < cols && (label === 0 || label === 1)) {
            labels[r]![c] = label;
            seeds.add(r * cols + c);
        }
    }
    const seedLabels = new Map<number, Label>();
    for (const index of seeds) {
        seedLabels.set(index, labels[Math.floor(index / cols)]?.[index % cols] ?? -1);
    }

    let step = 0;
    let iteration = 0;
    const frame = (description: string, codeLineNumber: number): VisualFrame => {
        let labeled = 0;
        for (const row of labels) {
            for (const value of row) {
                if (value !== -1) {
                    labeled += 1;
                }
            }
        }
        return {
            stepNumber: step++,
            entities: makeCells(labels, seeds),
            edges: [],
            description,
            codeLineNumber,
            layout: "grid",
            meta: {
                rows,
                cols,
                iteration,
                labeled,
                maskFlat: labels.flatMap((row) => row),
            },
        };
    };

    yield frame(`Prompt seeds ${seeds.size} pixel(s) in a ${rows} by ${cols} mask.`, 0);

    for (let it = 0; it < iterations; it += 1) {
        const snapshot = labels.map((row) => [...row]);
        for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) {
                if (snapshot[r]?.[c] !== -1) {
                    continue;
                }
                const neighbors = [
                    snapshot[r - 1]?.[c],
                    snapshot[r + 1]?.[c],
                    snapshot[r]?.[c - 1],
                    snapshot[r]?.[c + 1],
                ];
                let ones = 0;
                let zeros = 0;
                for (const neighbor of neighbors) {
                    if (neighbor === 1) {
                        ones += 1;
                    } else if (neighbor === 0) {
                        zeros += 1;
                    }
                }
                if (ones > zeros) {
                    labels[r]![c] = 1;
                } else if (zeros > ones) {
                    labels[r]![c] = 0;
                }
            }
        }
        iteration = it + 1;
        yield frame(`Propagation ${iteration}: unlabeled pixels take the majority label of their seeded neighbors.`, 2);
    }

    for (const [index, label] of seedLabels) {
        labels[Math.floor(index / cols)]![index % cols] = label;
    }
    yield frame(`Mask propagation finished after ${iterations} iteration(s); seeds remain fixed.`, 5);
}

/** The SAM 2 teaching-core module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Video segmentation carries a mask from one frame to the next through memory. A user prompt marks a few pixels as object or background, and a propagation step labels neighboring pixels by majority vote. Repeating the step grows a coherent region, and the prompted pixels are treated as fixed ground truth throughout.",
        invariants: [
            "Prompt seeds keep their original label after every propagation step.",
            "An unlabeled pixel changes label only when one label strictly outnumbers the other among its four-neighbors.",
            "Assignments within one step use a snapshot, so results do not depend on scan order.",
        ],
        correctness:
            "Because each step reads the previous snapshot, the update is a well-defined simultaneous majority operator. A pixel can only adopt a label already present among its neighbors, so labels spread by local growth from the seeds and cannot appear from nowhere. A test compares the final mask to an independent reference and confirms the seeds are unchanged.",
        complexityRationale:
            "Each iteration visits every cell and inspects four neighbors, a constant amount of work, so O(iterations * rows * cols) time. One mask plus a snapshot are stored, giving O(rows * cols) space.",
        uses: [
            "Propagating a segmentation mask through a video sequence",
            "Interactive segmentation tools that refine a prompt across frames",
            "A teaching model for memory-based object tracking",
        ],
        references: [
            "Ravi et al., SAM 2: Segment Anything in Images and Videos, 2024",
            "Kirillov et al., Segment Anything, 2023",
        ],
        workedExample:
            "On a 4 by 4 grid with object seeds at (0,0) and (0,1) and a background seed at (3,3), the first propagation labels the pixels adjacent to the two object seeds as object and the pixel next to the background seed as background. Later iterations fill the remaining cells where a strict majority exists, while the three seeds never change.",
    },
    id: "sam-2",
    name: "SAM 2 (Mask Propagation Core)",
    category: "ml-ai",
    complexity: { time: "O(iterations * rows * cols)", space: "O(rows * cols)" },
    defaultInput: { rows: 4, cols: 4, prompt: [[0, 0, 1], [0, 1, 1], [3, 3, 0]], iterations: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "place prompt seeds on the grid with their labels",
        "snapshot the current mask for a simultaneous update",
        "for each unlabeled pixel inspect its four neighbors",
        "count object and background labels among those neighbors",
        "assign the strict majority label when one exists",
        "repeat propagation for the chosen number of iterations",
        "done: report the propagated mask with seeds unchanged",
    ],
};

export default module;
