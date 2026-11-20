/**
 * last-diminisher-method.ts - Last Diminisher Method
 *
 * A proportional cake-cutting protocol for any number of players. The first
 * player cuts a piece they value at exactly one fair share. Each other
 * player in turn may trim it to their own fair share if they think it is too
 * large. The last player to trim takes the piece and leaves; the rest repeat
 * on what remains. Every player receives at least their fair share by their
 * own valuation.
 *
 * Time:  O(n^2 * iters * n) for binary-search trims; Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Interval = [number, number];

function overlap(a: number, b: number, l: number, r: number): number {
    return Math.max(0, Math.min(b, r) - Math.max(a, l));
}

function value(of: Interval, a: number, b: number): number {
    return overlap(a, b, of[0], of[1]) / (of[1] - of[0]);
}

function pointFor(of: Interval, from: number, target: number): number {
    let lo = from;
    let hi = 1;
    for (let i = 0; i < 60; i += 1) {
        const mid = (lo + hi) / 2;
        if (value(of, from, mid) < target) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { intervals?: Interval[] } | null) ?? {};
    const intervals: Interval[] = task.intervals ?? [
        [0, 0.5],
        [0.3, 0.9],
        [0.5, 1],
    ];
    const n = intervals.length;
    const share = n > 0 ? 1 / n : 0;
    let active = intervals.map((_, i) => i);
    let lo = 0;
    let step = 0;
    const assignments: Array<{ player: number; start: number; end: number; value: number }> = [];

    const frame = (message: string, line: number, hot: number): VisualFrame => {
        const entities: VisualEntity[] = assignments.map((a, i) => ({
            id: `piece-${i}`,
            type: "bar" as const,
            label: `p${a.player}: ${a.value.toFixed(3)}`,
            value: a.value,
            state: (i === hot ? "comparing" : "sorted") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { round: i, player: a.player, start: a.start, end: a.end },
        }));
        const values = assignments.map((a) => a.value);
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "array",
            meta: {
                assignments: JSON.stringify(assignments),
                values: values.slice(),
                remainingPlayers: active.length,
                share,
                minValue: values.length ? Math.min(...values) : 0,
            },
        };
    };

    yield frame(`${n} players cut a cake by the last diminisher method, share ${share.toFixed(3)}.`, 0, -1);
    step += 1;

    while (active.length > 0) {
        const claimant = active[0]!;
        let hi = pointFor(intervals[claimant]!, lo, share);
        let diminisher = claimant;
        yield frame(`Player ${claimant} cuts a piece from ${lo.toFixed(2)} worth one share.`, 1, assignments.length);
        step += 1;

        for (const j of active.slice(1)) {
            if (value(intervals[j]!, lo, hi) > share + 1e-9) {
                hi = pointFor(intervals[j]!, lo, share);
                diminisher = j;
                yield frame(`Player ${j} trims the piece down to one share.`, 3, assignments.length);
                step += 1;
            }
        }

        assignments.push({ player: diminisher, start: lo, end: hi, value: value(intervals[diminisher]!, lo, hi) });
        active = active.filter((k) => k !== diminisher);
        lo = hi;
        yield frame(`Player ${diminisher} is the last diminisher and takes the piece.`, 5, assignments.length - 1);
        step += 1;
    }

    yield frame(
        `Done: every player received at least ${share.toFixed(3)} by their own valuation.`,
        6,
        -1,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "One player cuts a piece they consider fair, and everyone else gets a chance to shave it down to what they consider fair. The person who trims last takes it home. Because anyone who thought the piece was too big trimmed it, the recipient is satisfied, and everyone who passed on it also considered it no more than fair, so the remaining cake still holds a fair share for each of them.",
        invariants: [
            "The current piece is worth at most one share to every player who passed on it.",
            "The last diminisher values the piece at exactly one share.",
            "The uncut remainder stays contiguous and is shared by the remaining players.",
        ],
        correctness:
            "The claimant cuts a piece worth exactly one share to themselves. Each player who trims reduces it to exactly one share by their own measure, so the final recipient, being the last trimmer or the original claimant, values it at exactly one share. Every player who declined to trim values the piece at no more than one share, so what remains is worth at least the sum of their fair shares. Induction on the number of players completes the proportionality proof.",
        complexityRationale:
            "Each round scans the remaining players once and each trim uses a binary search with a fixed number of iterations, so a round is O(n) and all rounds are O(n^2) up to the constant search depth. Only the current piece and the assignment list are stored, O(n) space.",
        uses: [
            "Fair division of inherited property",
            "Dividing chores or resources among teams",
            "Foundations of fair-division protocol design",
        ],
        references: [
            "Dubins and Spanier, How to Cut a Cake Fairly, 1961",
            "Moulin, Fair Division and Collective Welfare, 2004",
        ],
        workedExample:
            "Three players with different valued regions start with a piece cut at one third. If the second player considers it too large they trim it to exactly a third of their own value and take it. The two remaining players then repeat on the rest, each ending with at least a third by their own measure.",
    },
    id: "last-diminisher-method",
    name: "Last Diminisher Method",
    category: "game",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: {
        intervals: [[0, 0.5], [0.3, 0.9], [0.5, 1]],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize remaining cake as the whole interval",
        "first remaining player cuts one fair share",
        "each other player may trim it to their fair share",
        "the last trimmer takes the piece and leaves",
        "advance the cut and repeat with fewer players",
        "stop when every player holds a piece",
        "done: report each player's received value",
    ],
};

export default module;
