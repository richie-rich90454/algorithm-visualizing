/**
 * lone-divider-method.ts - Lone Divider Method (Moving Knife)
 *
 * A proportional cake-cutting protocol for any number of players. A knife
 * sweeps from left to right; the first player for whom the piece to the left
 * reaches a fair share calls out and receives that piece. The process repeats
 * on the remainder with the remaining players. Because the caller stops at
 * their own fair-share point and no one else stopped earlier, every piece
 * handed out is worth at most a fair share to each player still waiting.
 *
 * Time:  O(n^2 * iters * n) for the share searches; Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Interval = [number, number];

function value(of: Interval, a: number, b: number): number {
    return Math.max(0, Math.min(b, of[1]) - Math.max(a, of[0])) / (of[1] - of[0]);
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
        [0, 0.6],
        [0.2, 1],
        [0.4, 0.8],
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

    yield frame(`${n} players use the lone divider moving-knife method, share ${share.toFixed(3)}.`, 0, -1);
    step += 1;

    while (active.length > 0) {
        let winner = active[0]!;
        let winnerStop = pointFor(intervals[winner]!, lo, share);
        for (const j of active.slice(1)) {
            const stop = pointFor(intervals[j]!, lo, share);
            if (stop < winnerStop) {
                winner = j;
                winnerStop = stop;
            }
        }
        yield frame(`Knife sweeps; player ${winner} calls first at ${winnerStop.toFixed(2)}.`, 2, assignments.length);
        step += 1;

        assignments.push({
            player: winner,
            start: lo,
            end: winnerStop,
            value: value(intervals[winner]!, lo, winnerStop),
        });
        active = active.filter((k) => k !== winner);
        lo = winnerStop;
        yield frame(`Player ${winner} takes the piece and leaves the rest.`, 4, assignments.length - 1);
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
            "Imagine a knife sliding slowly across the cake. The moment the slice on the left looks like a fair share to somebody, that person shouts and takes it. Since they were the first to shout, everyone else thought that slice was still smaller than their own fair share, so the leftovers remain generous enough for everybody who is still waiting.",
        invariants: [
            "The first caller values the piece at exactly one fair share.",
            "Every other remaining player values the handed-out piece at no more than one share.",
            "The remaining cake is worth at least the combined fair shares of the players still waiting.",
        ],
        correctness:
            "Each player's calling point is where the piece to the left first reaches one share of their own value. The smallest calling point belongs to the winner, so for every other player that piece is worth at most one share. The winner receives exactly one share, and the others are left with a remainder worth at least their combined fair shares. Repeating the argument inductively proves the method is proportional.",
        complexityRationale:
            "Each round evaluates one calling point per remaining player, and each point uses a fixed-depth binary search, so a round is O(n) and the whole protocol is O(n^2). Storing the calling points and the assignment list needs O(n) space.",
        uses: [
            "Moving-knife fair division demonstrations",
            "Real-time division of a single divisible resource",
            "Teaching proportional division protocols",
        ],
        references: [
            "Dubins and Spanier, How to Cut a Cake Fairly, 1961",
            "Moulin, Fair Division and Collective Welfare, 2004",
        ],
        workedExample:
            "Three players with different liked regions watch a knife move from the left. The player whose fair-share point is closest to zero calls first, takes that slice, and leaves. The remaining two repeat on the rest, with the share now one half of what is left relative to their original valuations.",
    },
    id: "lone-divider-method",
    name: "Lone Divider Method",
    category: "game",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: {
        intervals: [[0, 0.6], [0.2, 1], [0.4, 0.8]],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize remaining cake and active player set",
        "for each active player find their fair-share call point",
        "the player with the smallest call point wins",
        "assign the piece from the cut to that call point",
        "remove the winner and advance the cut",
        "repeat until all players are served",
        "done: report each player's received value",
    ],
};

export default module;
