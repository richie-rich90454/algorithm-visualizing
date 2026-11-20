/**
 * painting-fence-dp.ts - Painting Fence (DP)
 *
 * Counts the ways to paint a row of posts with k colors so that no more than
 * two adjacent posts share a color. The recurrence distinguishes a post that
 * matches its immediate predecessor (which forces the predecessor to differ
 * from the one before it) from a post that takes any of the other k-1 colors.
 *
 * Time: O(n). Space: O(1) beyond the visualization's result table.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function countWays(posts: number, colors: number): number[] {
    if (posts <= 0 || colors <= 0) return [0];
    const dp: number[] = [colors];
    if (posts === 1) return dp;
    dp.push(colors * colors);
    for (let i = 2; i < posts; i += 1) {
        dp.push((colors - 1) * ((dp[i - 1] ?? 0) + (dp[i - 2] ?? 0)));
    }
    return dp;
}

function makeBars(
    dp: number[],
    computedUpTo: number,
    final: boolean = false,
): VisualEntity[] {
    return dp.map((value, index) => {
        let state: EntityState = "idle";
        if (final) {
            state = index === dp.length - 1 ? "sorted" : "visited";
        } else if (index <= computedUpTo) {
            state = index === computedUpTo ? "comparing" : "visited";
        }
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
            metadata: { index, post: index + 1, ways: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { posts?: number; colors?: number } | null) ?? {};
    const posts = Math.min(30, Math.max(0, Math.floor(typeof task.posts === "number" ? task.posts : 5)));
    const colors = Math.max(0, Math.floor(typeof task.colors === "number" ? task.colors : 3));
    const dp = countWays(posts, colors);
    const answer = dp[dp.length - 1] ?? 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(dp, -1),
        edges: [],
        description: `Counting valid colorings of ${posts} post(s) with ${colors} color(s) and at most two equal neighbors in a row.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { posts, colors, answer, dp: [...dp] },
    };
    step += 1;

    if (posts > 0) {
        yield {
            stepNumber: step,
            entities: makeBars(dp, 0),
            edges: [],
            description: `One post has exactly ${colors} color choices.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { posts, colors, answer, dp: [...dp] },
        };
        step += 1;
    }
    if (posts > 1) {
        yield {
            stepNumber: step,
            entities: makeBars(dp, 1),
            edges: [],
            description: `Two posts are independent, giving ${colors} squared = ${dp[1]} colorings.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { posts, colors, answer, dp: [...dp] },
        };
        step += 1;
    }
    for (let i = 2; i < dp.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(dp, i),
            edges: [],
            description: `Post ${i + 1}: (${colors} - 1) times (${dp[i - 1]} + ${dp[i - 2]}) = ${dp[i]} valid colorings.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { posts, colors, answer, dp: [...dp] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(dp, dp.length - 1, true),
        edges: [],
        description: `Final answer: ${answer} ways to paint ${posts} post(s) with ${colors} color(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { posts, colors, answer, dp: [...dp] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Split valid colorings of the first i posts by what happens at the last post. If it differs from the previous post there are k-1 choices for it and any valid coloring of i-1 posts. If it matches the previous post, the post before that must differ, which is exactly a valid coloring of i-2 posts repeated with k-1 choices for the new color.",
        invariants: [
            "dp[i] counts colorings of the first i+1 posts with no three equal neighbors.",
            "The last two posts either share a color or they do not; those cases are disjoint and exhaustive.",
            "Every recurrence step only reads already finalized smaller values.",
        ],
        correctness:
            "For i >= 2, partition valid colorings of i+1 posts by whether the final post matches its neighbor. The differing case contributes (k-1) times dp[i-1]. The matching case forces the third-last post to differ from the pair, so deleting the final post leaves a valid coloring of i-1 posts and contributes (k-1) times dp[i-2]. Summing gives the recurrence, and the base cases dp[0]=k and dp[1]=k squared are immediate, so induction proves dp[i] is correct.",
        complexityRationale:
            "The loop computes one value per post with constant work, so the running time is O(n). Only a fixed number of previous values is needed arithmetically, giving O(1) working space; the frame table stores O(n) values for replay.",
        uses: [
            "Counting constrained color assignments in scheduling",
            "Estimating configuration counts in statistical mechanics",
            "A compact example of case-split DP for combinatorics",
        ],
        references: [
            "GeeksforGeeks, Painting Fence Algorithm",
            "Cormen et al., Introduction to Algorithms, Chapter 15",
        ],
        workedExample:
            "With five posts and three colors, dp starts 3, 9, then 2*(9+3)=24, 2*(24+9)=66, and 2*(66+24)=180, so there are 180 valid paintings.",
    },
    id: "painting-fence-dp",
    name: "Painting Fence (DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { posts: 5, colors: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "read the number of posts n and the number of colors k",
        "if n is zero answer zero and stop",
        "set dp[0] to k for a single post",
        "set dp[1] to k squared for two posts",
        "for post i from two to n-1 set dp[i] to (k-1) times (dp[i-1] plus dp[i-2])",
        "the answer is dp[n-1]",
        "report the full table and the final count",
    ],
};

export default module;
