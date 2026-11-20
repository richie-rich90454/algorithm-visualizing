/**
 * burnt-pancake-sorting.ts - Burnt Pancake Sorting
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Every pancake has a size and a burnt side. A move reverses a prefix of the
 * stack AND turns every pancake in that prefix over, so both order and
 * orientation change at once. The goal is a stack sorted small-to-large with
 * every burnt side facing down. This is the signed generalization of pancake
 * sort and is studied in genome rearrangement.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2)   Space: O(1) beyond the visualized stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A bar hanging below the baseline is burnt side down (negative value).
 *   - The label shows magnitude plus '+' (burnt up) or '-' (burnt down).
 *   - The pancake being placed is highlighted; finished ones turn green.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(stack: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return stack.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${Math.abs(value)}${value < 0 ? "-" : "+"}`,
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, magnitude: Math.abs(value), burntDown: value < 0 },
    }));
}

/** Reverse the first k pancakes and flip each one's orientation. */
function flipPrefix(stack: number[], k: number): void {
    for (let i = 0, j = k - 1; i < j; i += 1, j -= 1) {
        const tmp = stack[i] as number;
        stack[i] = stack[j] as number;
        stack[j] = tmp;
    }
    for (let i = 0; i < k; i += 1) {
        stack[i] = -(stack[i] as number);
    }
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { stack?: number[] } | null) ?? {};
    const stack = Array.isArray(task.stack) ? [...task.stack] : [3, -1, 2];
    const n = stack.length;
    let step = 0;
    let flips = 0;

    const snap = (
        description: string,
        codeLineNumber: number,
        states: Map<number, EntityState>,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(stack, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { flips, n },
    });

    yield snap("Initial stack: sizes with a sign for each burnt side.", 0, new Map());
    step += 1;

    for (let k = n; k >= 1; k -= 1) {
        let position = -1;
        for (let i = 0; i < k; i += 1) {
            if (Math.abs(stack[i] as number) === k) {
                position = i;
                break;
            }
        }
        if (position < 0) {
            continue;
        }

        const goal = k - 1;
        if (position === goal && (stack[position] as number) < 0) {
            const settled = new Map<number, EntityState>();
            for (let i = 0; i < n; i += 1) {
                settled.set(i, i >= goal ? "sorted" : "idle");
            }
            yield snap(`Pancake ${k} is already seated burnt side down.`, 3, settled);
            step += 1;
            continue;
        }

        yield snap(
            `Locating pancake ${k}: found at position ${position}, target ${goal}.`,
            2,
            new Map([[position, "highlight"]]),
        );
        step += 1;

        if (position !== 0) {
            flipPrefix(stack, position + 1);
            flips += 1;
            yield snap(`Flipping prefix of ${position + 1} to bring pancake ${k} to the top.`, 4, new Map([[0, "active"]]));
            step += 1;
        }

        if ((stack[0] as number) < 0) {
            flipPrefix(stack, 1);
            flips += 1;
            yield snap(`Burnt side up: flipping the top pancake to prepare the seat.`, 5, new Map([[0, "swapped"]]));
            step += 1;
        }

        if (k > 1) {
            flipPrefix(stack, k);
            flips += 1;
            const settled = new Map<number, EntityState>();
            for (let i = 0; i < n; i += 1) {
                settled.set(i, i >= goal ? "sorted" : "idle");
            }
            yield snap(`Flipping prefix of ${k} seats pancake ${k} burnt side down.`, 6, settled);
            step += 1;
        } else {
            flipPrefix(stack, 1);
            flips += 1;
            const settled = new Map<number, EntityState>();
            for (let i = 0; i < n; i += 1) {
                settled.set(i, "sorted");
            }
            yield snap("Flipping the last pancake leaves every burnt side down.", 7, settled);
            step += 1;
        }
    }

    const allSorted = new Map<number, EntityState>();
    for (let i = 0; i < n; i += 1) {
        allSorted.set(i, "sorted");
    }
    yield snap(`Sorted with ${flips} flip(s); every burnt side faces down.`, 8, allSorted);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Picture a stack of pancakes where one side of each is burnt. Your only tool is a spatula that flips the whole top portion and, in doing so, turns every pancake in that portion over. To sort, seat the largest pancake first: bring it to the top, make sure its burnt side is up, then flip it down to its final spot. Smaller pancakes are handled afterward, so they never disturb the ones already placed.",
        invariants: [
            "A prefix flip reverses order and negates the sign of every pancake it touches.",
            "After Pancake k is seated, pancakes k through n never move again.",
            "Each magnitude from 1 to n appears exactly once throughout the run.",
        ],
        correctness:
            "Proceed by induction on k from n down to 1. Before step k, pancakes of magnitude greater than k occupy positions k through n-1 with burnt side down. Pancake k lies in the unsorted prefix, so a flip brings it to the top. If it is burnt side up we flip the single top pancake, making it positive; a final flip of length k sends it to position k-1 and negates its sign to negative (burnt down). Later steps only flip prefixes of length at most k-1, so the seated suffix is untouched. When k reaches 1 the whole stack is sorted and every sign is negative.",
        complexityRationale:
            "For each of the n pancakes we scan up to n positions and perform at most three prefix flips, each costing O(n) reversals and sign changes, giving O(n^2) time. Only the stack itself is stored, so the extra space is O(1) beyond the visualization.",
        uses: [
            "Genome rearrangement distance for signed reversals in bioinformatics",
            "Puzzle solvers for the burnt pancake problem",
            "Teaching prefix-reversal sorting and signed permutations",
        ],
        references: [
            "Gates and Papadimitriou, Bounds for Sorting by Prefix Reversal, 1979",
            "Bulteau, Fertin and Rusu, The Complexities of Pancake Flipping, 2015",
        ],
        workedExample:
            "Start from [2, 1] with both burnt sides up. Flip the whole stack to get [-1, -2]. Pancake 2 is now at the bottom with its burnt side down; pancake 1 is already at the top burnt side down, so no further flip is needed. The stack is sorted in one flip.",
    },
    id: "burnt-pancake-sorting",
    name: "Burnt Pancake Sorting",
    category: "sorting",
    complexity: { time: "O(n^2)", space: "O(1)" },
    defaultInput: { stack: [3, -1, 2] },
    visualType: "array",
    run,
    pseudocode: [
        "represent each pancake by size with a sign for its burnt side",
        "for k from n down to 1",
        "find the position of pancake k",
        "if k is seated and burnt side down, continue",
        "flip the prefix ending at that position to bring k to the top",
        "if k is burnt side up, flip the single top pancake",
        "flip the prefix of length k to seat k burnt side down",
        "for k equal to 1, flip the top pancake if needed",
        "done: sorted stack with every burnt side down",
    ],
};

export default module;
