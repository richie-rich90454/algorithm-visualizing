/**
 * plurality-voting.ts - Plurality Voting
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Plurality rule is the simplest voting method: each ballot names one
 * preferred candidate, and the candidate with the most first-place votes
 * wins. Lower rankings are ignored entirely. The method is easy to tally but
 * can elect a candidate who is beaten head to head by another, and it can
 * split the vote among similar candidates.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * A ballot is an ordered list of candidate indices and only its first entry
 * counts. Empty ballots are treated as invalid and skipped. Ties for the top
 * count produce multiple winners rather than a runoff.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(v + m) for v ballots and m candidates; Space: O(m)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the running first-place count for each candidate.
 *   - The bar receiving the current ballot is highlighted.
 *   - All candidates tied for the highest count turn green at the end.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function bars(counts: number[], active: number, winners: number[], done: boolean): VisualEntity[] {
    return counts.map((count, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `C${index}: ${count}`,
        value: count,
        state: (done && winners.includes(index) ? "sorted" : index === active ? "active" : "idle") as VisualEntity["state"],
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, count, candidate: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ballots?: number[][]; candidates?: number } | null) ?? {};
    const ballots: number[][] = Array.isArray(task.ballots)
        ? task.ballots.map((b) => (Array.isArray(b) ? b.filter((x) => Number.isInteger(x) && x >= 0) : []))
        : [[0, 1, 2], [1, 2, 0], [0, 2, 1], [2, 1, 0], [0, 1, 2]];
    let maxSeen = -1;
    for (const ballot of ballots) {
        for (const c of ballot) {
            maxSeen = Math.max(maxSeen, c);
        }
    }
    const m = Math.max(2, typeof task.candidates === "number" ? Math.floor(task.candidates) : maxSeen + 1);
    const counts = new Array<number>(m).fill(0);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(counts, -1, [], false),
        edges: [],
        description: `Tallying ${ballots.length} ballots over ${m} candidates using first-place votes only.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { candidates: m, ballots: ballots.length, counts: [...counts] },
    };
    step += 1;

    for (let i = 0; i < ballots.length; i += 1) {
        const top = ballots[i]?.[0];
        if (top !== undefined && top < m) {
            counts[top] = (counts[top] ?? 0) + 1;
        }
        yield {
            stepNumber: step,
            entities: bars(counts, top ?? -1, [], false),
            edges: [],
            description: top === undefined
                ? `Ballot ${i + 1} is invalid and is skipped.`
                : `Ballot ${i + 1} gives one first-place vote to candidate ${top}, whose count is now ${counts[top]}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { counts: [...counts], ballot: i + 1, top: top ?? -1 },
        };
        step += 1;
    }

    const best = Math.max(...counts);
    const winners = counts.map((count, index) => (count === best ? index : -1)).filter((i) => i >= 0);
    yield {
        stepNumber: step,
        entities: bars(counts, -1, winners, true),
        edges: [],
        description: `The highest first-place count is ${best}; winner${winners.length > 1 ? "s" : ""}: ${winners.join(", ")}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { counts: [...counts], winners, best, candidates: m },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Count only the top name on each ballot and give one point to that candidate. The candidate with the most points wins, even without a majority. The appeal is transparency, but the method ignores how voters rank everyone else and can reward a candidate who is broadly acceptable yet rarely anybody's first choice.",
        invariants: [
            "Each valid ballot contributes exactly one point to its first-ranked candidate.",
            "The sum of all counts equals the number of valid ballots.",
            "A winner is any candidate whose count equals the maximum count.",
        ],
        correctness:
            "The tally loop reads the first element of each ballot and increments exactly that candidate's counter, so after all ballots each counter is the number of ballots ranking that candidate first. The maximum of the counters is the highest first-place total, and selecting every candidate with that total yields precisely the set of candidates no one beats under plurality rule.",
        complexityRationale:
            "Reading one entry per ballot costs O(v), computing the maximum and scanning for winners costs O(m), and the m counters use O(m) space.",
        uses: [
            "Direct elections for a single seat in many countries",
            "Choosing a chair or a single winner in committees",
            "A baseline rule for comparing against ranked-choice methods",
        ],
        references: [
            "Arrow, Social Choice and Individual Values (1951)",
            "Manin, The Principles of Representative Government (1997)",
        ],
        workedExample:
            "With five ballots topped by candidates 0, 1, 0, 2, and 0, the counts are 3 for candidate 0, 1 for candidate 1, and 1 for candidate 2. Candidate 0 wins with a plurality of three votes, even though three other voters preferred someone else.",
    },
    id: "plurality-voting",
    name: "Plurality Voting",
    category: "game",
    complexity: { time: "O(v + m)", space: "O(m)" },
    defaultInput: { ballots: [[0, 1, 2], [1, 2, 0], [0, 2, 1], [2, 1, 0], [0, 1, 2]], candidates: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize a zero count for every candidate",
        "for each ballot take its first-ranked candidate",
        "increment that candidate's count by one",
        "after all ballots find the maximum count",
        "select every candidate with the maximum count",
        "report the winner or winners",
    ],
};

export default module;
