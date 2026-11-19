/**
 * floyd-rivest-select.ts – Floyd-Rivest Selection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Floyd-Rivest selection finds the kth smallest value without sorting the
 * whole array. It draws a small sample, uses two sample quantiles as pivots,
 * and splits the data into a low region, a middle region, and a high region.
 * Only the region that contains the requested rank is kept, so the array
 * shrinks geometrically until it is small enough to sort directly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) expected
 *   Space: O(n) for the working regions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Values below the low pivot are YELLOW.
 *   - Values between the pivots are BLUE.
 *   - Values above the high pivot are IDLE.
 *   - The chosen pivots are PURPLE and the final answer is GREEN.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Returns the exact order statistic, not an approximation.
 *   - Terminates because each useful split strictly shrinks the working set.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(
    arr: number[],
    states: Map<number, EntityState> = new Map(),
    pivotValues: number[] = [],
): VisualEntity[] {
    return arr.map((value, index) => {
        const state: EntityState = pivotValues.includes(value)
            ? "pivot"
            : (states.get(index) ?? "idle");
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[]; k?: number } | null) ?? {};
    let work = Array.isArray(task.array) ? [...(task.array as number[])] : [9, 2, 6, 1, 8, 3, 7, 4, 5];
    const requested = typeof task.k === "number" ? task.k : 4;
    let k = Math.max(0, Math.min(requested, Math.max(work.length - 1, 0)));

    let step = 0;
    let rounds = 0;
    const frame = (
        description: string,
        states: Map<number, EntityState>,
        pivotValues: number[],
        codeLineNumber: number,
        result?: number,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeBars(work, states, pivotValues),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { rounds, k, result: result ?? -1, size: work.length },
    });

    yield frame(`Selecting the value of rank ${k} without sorting the whole array.`, new Map(), [], 0);

    let result = -1;
    while (work.length > 0) {
        if (work.length <= 8) {
            work.sort((a, b) => a - b);
            result = work[k] as number;
            yield frame(
                `Working set is small; sorted it and read rank ${k} = ${result}.`,
                new Map<number, EntityState>([[k, "sorted"]]),
                [],
                1,
                result,
            );
            break;
        }

        rounds += 1;
        const sampleSize = Math.max(2, Math.ceil(Math.sqrt(work.length)));
        const sample: number[] = [];
        for (let t = 0; t < sampleSize; t += 1) {
            const index = Math.floor((t * (work.length - 1)) / (sampleSize - 1));
            sample.push(work[index] as number);
        }
        sample.sort((a, b) => a - b);
        let low = sample[Math.floor(sampleSize * 0.25)] as number;
        let high = sample[Math.floor(sampleSize * 0.75)] as number;
        if (low > high) {
            const temp = low;
            low = high;
            high = temp;
        }

        const lowRegion: number[] = [];
        const middle: number[] = [];
        const highRegion: number[] = [];
        const states = new Map<number, EntityState>();
        work.forEach((value, index) => {
            if (value < low) {
                lowRegion.push(value);
                states.set(index, "comparing");
            } else if (value > high) {
                highRegion.push(value);
            } else {
                middle.push(value);
                states.set(index, "active");
            }
        });
        yield frame(
            `Round ${rounds}: sample pivots ${low} and ${high}; split sizes ${lowRegion.length}/${middle.length}/${highRegion.length}.`,
            states,
            [low, high],
            3,
        );

        if (middle.length === work.length) {
            work.sort((a, b) => a - b);
            result = work[k] as number;
            yield frame(
                `Pivots could not shrink the set, so sorted it directly: rank ${k} = ${result}.`,
                new Map<number, EntityState>([[k, "sorted"]]),
                [],
                1,
                result,
            );
            break;
        }

        if (k < lowRegion.length) {
            work = lowRegion;
        } else if (k < lowRegion.length + middle.length) {
            k -= lowRegion.length;
            work = middle;
        } else {
            k -= lowRegion.length + middle.length;
            work = highRegion;
        }
        yield frame(
            `Rank ${k} lies in the chosen region of size ${work.length}; continue there.`,
            new Map(),
            [],
            5,
        );
    }

    yield frame(
        `Selection complete: the value of rank ${requested} is ${result}.`,
        new Map<number, EntityState>([[0, "sorted"]]),
        [],
        7,
        result,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If you only need the median or the kth smallest value, sorting everything wastes work. Floyd-Rivest selection samples a few values, picks two of them as boundaries, and throws away the regions that cannot contain the target rank. It repeats on the surviving region until the answer is obvious.",
        invariants: [
            "The requested rank k is always measured inside the current working set.",
            "Every discarded value is strictly smaller or strictly larger than every retained region it is separated from.",
            "The kth order statistic of the original array equals the kth order statistic of the retained region.",
        ],
        correctness:
            "After partitioning by the two pivots, the low region contains exactly the smallest values, the middle the next block, and the high region the largest. Comparing k with the region sizes identifies which region must contain the target and by how much to adjust k. Because the regions are ordered, discarding the others preserves the kth order statistic; when the set is small, sorting gives the exact answer.",
        complexityRationale:
            "Each round samples O(sqrt n) values and scans O(n) elements, and the random-style pivots shrink the set by a constant factor in expectation, giving O(n) expected time. The working regions hold at most n values, so space is O(n).",
        uses: [
            "Finding medians and percentiles in large data sets",
            "Choosing a pivot for quick sort implementations",
            "Order-statistic queries in databases and streaming systems",
        ],
        references: [
            "Floyd and Rivest, Expected Time Bounds for Selection, 1975",
            "CLRS, Introduction to Algorithms, Chapter 9",
        ],
        workedExample:
            "To find rank 3 of [9, 2, 6, 1, 8, 3, 7, 4, 5], sample two pivots around 4 and 7 and split into low [2, 1, 3], middle [6, 4, 5], high [9, 8, 7]. Rank 3 lies in the middle with adjusted rank 0, so sorting [6, 4, 5] gives the answer 4.",
    },
    id: "floyd-rivest-select",
    name: "Floyd-Rivest Selection",
    category: "searching",
    complexity: { time: "O(n) expected", space: "O(n)" },
    defaultInput: { array: [9, 2, 6, 1, 8, 3, 7, 4, 5], k: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "start with the whole array and target rank k",
        "if the working set is small, sort it and return its kth value",
        "draw a small evenly spaced sample and sort it",
        "choose two sample quantiles as the low and high pivots",
        "split the set into below-low, between, and above-high",
        "if the pivots made no progress, sort the set directly",
        "keep only the region containing rank k and adjust k",
        "repeat until the answer is read from a sorted set",
        "done: return the kth smallest value",
    ],
};

export default module;
