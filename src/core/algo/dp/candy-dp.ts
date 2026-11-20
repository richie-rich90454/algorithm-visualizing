/**
 * candy-dp.ts - Candy Distribution (Two-Pass DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Children stand in a line and each has a rating. Every child must receive at
 * least one candy, and a child with a higher rating than an adjacent child must
 * receive more candies. Two sweeps enforce the constraints to the right and to
 * the left; taking the maximum at each position gives the unique minimal total.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)
 *   Space: O(n) for the candy counts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per child, height encoding the assigned candy count.
 *   - The bar under inspection is YELLOW; finalized bars are GREEN.
 *   - The final frame reports the minimal total.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(
    ratings: number[],
    candies: number[],
    active: number,
    final: boolean,
): VisualEntity[] {
    return ratings.map((rating, index) => {
        const value = candies[index] ?? 0;
        let state: EntityState = "unvisited";
        if (final) {
            state = "sorted";
        } else if (index === active) {
            state = "comparing";
        } else if (value > 1) {
            state = "visited";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `${value}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, rating, candies: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ratings?: number[] } | null) ?? {};
    const ratings = Array.isArray(task.ratings)
        ? task.ratings.map((v) => Number(v) || 0)
        : [1, 0, 2];
    const n = ratings.length;
    const candies: number[] = new Array(n).fill(1);
    let step = 0;

    const frame = (active: number, final: boolean, description: string, line: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeBars(ratings, candies, active, final),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "array",
        meta: {
            answer: candies.reduce((a, b) => a + b, 0),
            ratings: [...ratings],
            candies: [...candies],
        },
    });

    yield frame(-1, false, `Distributing candies to ${n} child(ren) by rating.`, 0);
    if (n === 0) {
        yield frame(-1, true, "No children, so zero candies are needed.", 7);
        return;
    }

    for (let i = 1; i < n; i += 1) {
        if ((ratings[i] ?? 0) > (ratings[i - 1] ?? 0)) {
            candies[i] = (candies[i - 1] ?? 0) + 1;
        }
        yield frame(i, false, `Left sweep at child ${i}: compare ratings ${ratings[i - 1]} and ${ratings[i]}.`, 2);
    }

    for (let i = n - 2; i >= 0; i -= 1) {
        if ((ratings[i] ?? 0) > (ratings[i + 1] ?? 0)) {
            candies[i] = Math.max(candies[i] ?? 1, (candies[i + 1] ?? 0) + 1);
        }
        yield frame(i, false, `Right sweep at child ${i}: keep the larger of both neighbor constraints.`, 4);
    }

    const total = candies.reduce((a, b) => a + b, 0);
    const finalFrame = frame(-1, true, `Minimum candies needed: ${total}.`, 6);
    finalFrame.meta["answer"] = total;
    yield finalFrame;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Give everyone one candy first. A single left-to-right pass makes every child with a higher rating than the left neighbor outrank that neighbor. A right-to-left pass does the same for the right neighbor, and taking the larger of the two requirements satisfies both at once.",
        invariants: [
            "After the left sweep, every increasing adjacent pair satisfies the candy rule.",
            "The right sweep never lowers a candy count already assigned.",
            "Each final count is exactly one more than the smaller valid neighbor when required.",
        ],
        correctness:
            "Any valid assignment must give a child at least one more candy than a lower-rated neighbor. The left sweep derives the strongest lower bound implied by the left neighbor, and the right sweep derives the strongest implied by the right neighbor. The pointwise maximum is therefore a lower bound on every valid assignment and also satisfies both constraints, so it is the unique minimum.",
        complexityRationale:
            "Each of the two sweeps touches every position a constant number of times, giving O(n) time. Only the candy array is kept, so the working space is O(n).",
        uses: [
            "Allocating a minimum resource under relative fairness rules",
            "Enforcing ordering constraints on a line of items",
            "A standard two-pass greedy and DP teaching example",
        ],
        references: [
            "HackerRank, Candies Problem",
            "Cormen et al., Introduction to Algorithms, Chapter 15",
        ],
        workedExample:
            "For ratings [1, 0, 2] start with [1, 1, 1]. The left sweep raises the last child to 2. The right sweep raises the first child to 2 because it outranks the zero-rated child. The result [2, 1, 2] sums to 5.",
    },
    id: "candy-dp",
    name: "Candy Distribution (DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { ratings: [1, 0, 2] },
    visualType: "array",
    run,
    pseudocode: [
        "read the ratings array of length n",
        "give every child one candy",
        "scan left to right and raise child i when its rating exceeds child i-1",
        "on a rise set candies[i] to candies[i-1] plus one",
        "scan right to left and raise child i when its rating exceeds child i+1",
        "on a rise set candies[i] to the maximum of its value and candies[i+1] plus one",
        "sum all candy counts for the answer",
        "report the final distribution",
    ],
};

export default module;
