/**
 * noisy-binary-search.ts - Noisy Binary Search with Majority Voting
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Ordinary binary search assumes every comparison is correct. Noisy binary
 * search allows a comparison to return the wrong answer with small probability.
 * This version queries the same comparison several times and takes a majority
 * vote before deciding which half of the array to keep. As long as fewer than
 * half of the repeats are wrong at each probe, every decision agrees with the
 * true comparison and the target is found in the usual logarithmic number of
 * rounds. The noise pattern is supplied explicitly so playback is deterministic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(repeats * log n) comparisons
 *   Space: O(n) for the displayed bars, O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The probed bar is YELLOW while votes are counted.
 *   - The surviving search window is PINK; a match turns GREEN.
 *   - `meta.votes` records the raw and majority results of each round.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(arr: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return arr.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { array?: number[]; target?: number; repeats?: number; noise?: number[] } | null
    ) ?? {};
    const arr = Array.isArray(task.array)
        ? [...(task.array as number[])]
        : [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const target = typeof task.target === "number" ? task.target : 13;
    const repeats = typeof task.repeats === "number" && task.repeats >= 3 && task.repeats % 2 === 1
        ? task.repeats
        : 3;
    const noise = Array.isArray(task.noise) ? task.noise : [1, 0, 1, 0, 1, 0, 1, 0];

    let step = 0;
    let comparisons = 0;
    let round = 0;
    const votesLog: number[] = [];

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Noisy binary search for ${target} with ${repeats} repeated comparisons and majority voting.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons: 0, repeats, target, votes: [] },
    };
    step += 1;

    let lo = 0;
    let hi = arr.length - 1;
    let found = -1;

    while (lo <= hi) {
        const mid = lo + Math.floor((hi - lo) / 2);
        const value = arr[mid];
        if (value === undefined) break;

        // Issue `repeats` comparisons; `flips` of them return the opposite
        // answer. A strict majority decides the direction this round.
        const truth = value < target;
        const flips = Math.max(0, Math.min(repeats, Math.round(noise[round] ?? 0)));
        let lessVotes = 0;
        for (let k = 0; k < repeats; k += 1) {
            const reportedLess = k < flips ? !truth : truth;
            if (reportedLess) lessVotes += 1;
        }
        const wrongVotes = flips;
        const decidedLess = lessVotes > repeats / 2;
        votesLog.push(flips, decidedLess ? 1 : 0);
        comparisons += repeats;

        const states = new Map<number, EntityState>();
        for (let i = lo; i <= hi; i += 1) states.set(i, "highlight");
        states.set(mid, "comparing");
        if (value === target) states.set(mid, "sorted");

        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Round ${round + 1}: probed index ${mid} (${value}) with ${flips} flipped vote(s); majority says ${decidedLess ? "go left" : "go right"}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                comparisons,
                repeats,
                target,
                mid,
                flips,
                decidedLess,
                lessVotes,
                wrongVotes,
                votes: [...votesLog],
            },
        };
        step += 1;

        if (value === target) {
            found = mid;
            break;
        }
        if (decidedLess) lo = mid + 1;
        else hi = mid - 1;
        round += 1;
    }

    const finalStates = new Map<number, EntityState>();
    if (found >= 0) finalStates.set(found, "sorted");
    yield {
        stepNumber: step,
        entities: makeBars(arr, finalStates),
        edges: [],
        description: found >= 0
            ? `Found ${target} at index ${found} after ${round + 1} noisy round(s) and ${comparisons} comparisons.`
            : `${target} is absent after ${round + 1} noisy round(s) and ${comparisons} comparisons.`,
        codeLineNumber: found >= 0 ? 5 : 6,
        layout: "array",
        meta: {
            comparisons,
            repeats,
            target,
            foundIndex: found,
            rounds: round + 1,
            votes: [...votesLog],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When a comparison can lie, a single answer is not trustworthy. Ask the same question several times and let the majority decide. If at most one answer in three is wrong, the majority always agrees with the true comparison, so the rest of the search proceeds exactly as ordinary binary search does.",
        invariants: [
            "Each round issues an odd number of repeated comparisons.",
            "When fewer than half the votes are flipped, the majority matches the true comparison.",
            "A correct decision keeps the target inside the shrinking search window.",
        ],
        correctness:
            "With repeats an odd number and at most (repeats minus one) over two flipped votes, the number of truthful votes exceeds the flipped votes, so the majority result equals the real comparison between the probed value and the target. Every decision therefore matches ordinary binary search, whose correctness by sortedness guarantees the target is found exactly when it is present.",
        complexityRationale:
            "Binary search probes O(log n) positions, and each probe costs `repeats` comparisons, giving O(repeats * log n) total comparisons. Only the displayed bars need O(n) space; the search itself uses O(1) extra space.",
        uses: [
            "Searching data whose comparisons come from noisy sensors or crowdsourced labels",
            "Fault-tolerant lookup when a comparison oracle occasionally fails",
            "A gentle introduction to algorithms that tolerate unreliable primitives",
        ],
        references: [
            "Feige, Kilian and Repetti, Noisy Binary Search and Its Applications (SODA 2014)",
            "Knuth, The Art of Computer Programming, Volume 3: Sorting and Searching",
        ],
        workedExample:
            "In [1, 3, 5, 7, 9, 11, 13, 15, 17, 19] searching for 13 with three repeats, the first probe at index 4 sees value 9. Even if one of the three comparisons is flipped, two truthful votes say 'go right', so the search continues over indices 5 through 9 and eventually lands on 13 at index 6.",
    },
    id: "noisy-binary-search",
    name: "Noisy Binary Search",
    category: "searching",
    complexity: { time: "O(repeats * log n)", space: "O(1)" },
    defaultInput: {
        array: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19],
        target: 13,
        repeats: 3,
        noise: [1, 0, 1, 0, 1, 0, 1, 0],
    },
    visualType: "array",
    run,
    pseudocode: [
        "set lo to zero and hi to the last index",
        "while lo is at most hi choose the middle index mid",
        "compare A[mid] with target repeats times and count votes",
        "let the majority vote decide which half can contain the target",
        "if A[mid] equals target record the match and stop",
        "if majority says A[mid] is smaller set lo to mid plus one",
        "otherwise set hi to mid minus one",
        "report the found index or absence and the comparison count",
    ],
};

export default module;
