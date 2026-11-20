/**
 * moving-knife-cake-cutting.ts - Moving-Knife Cake Cutting (Dubins-Spanier)
 *
 * The moving-knife procedure divides a cake among n players without any player
 * cutting a piece their neighbor might envy. A knife slides from left to right;
 * the first player to see the piece on its left reach a fair fraction of the
 * whole cake calls out and takes that piece. The knife then continues from the
 * cut with one fewer player, and the last remaining player takes the rest.
 *
 * Each player who calls receives exactly one n-th of their total value, and
 * the remaining players still value the leftover enough to repeat the test, so
 * the final division is proportional. Value densities may differ from player
 * to player, which is what makes the protocol nontrivial.
 *
 * Time O(n * k * log precision) for n players and k cake segments;
 * space O(n * k) for the stored value densities.
 *
 * Visualization: bars show every player's density over the cake segments.
 * The caller of the current round is highlighted, and the final frame marks
 * the allocated pieces.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface KnifeInput {
    players?: number[][];
    alice?: number[];
    bob?: number[];
    carol?: number[];
}

/** Normalize raw densities to percentages summing to one hundred. */
function normalize(values: number[]): number[] {
    const sum = values.reduce((total, value) => total + Math.max(0, value), 0);
    return sum > 0 ? values.map((value) => (Math.max(0, value) * 100) / sum) : values.map(() => 100 / values.length);
}

/** Value of the cake interval from zero to x under a piecewise constant density. */
function valueUpTo(density: number[], x: number): number {
    const position = Math.max(0, Math.min(1, x)) * density.length;
    let total = 0;
    for (let index = 0; index < density.length; index += 1) {
        const cover = Math.max(0, Math.min(1, position - index));
        total += (density[index] ?? 0) * cover;
    }
    return total;
}

/** Find the leftmost point after start where the player reaches the threshold. */
function callPoint(density: number[], start: number, threshold: number): number {
    if (valueUpTo(density, 1) - valueUpTo(density, start) < threshold - 1e-9) return 1;
    let low = start;
    let high = 1;
    for (let iteration = 0; iteration < 60; iteration += 1) {
        const middle = (low + high) / 2;
        if (valueUpTo(density, middle) - valueUpTo(density, start) < threshold) low = middle;
        else high = middle;
    }
    return high;
}

function makeEntities(densities: number[][], caller: number, final: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    densities.forEach((density, player) => {
        density.forEach((value, segment) => {
            entities.push({
                id: `p${player}-seg${segment}`,
                type: "bar" as const,
                label: `${player}:${value.toFixed(0)}`,
                value,
                state: (final ? "sorted" : player === caller ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { player, segment, density: value, caller: player === caller },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as KnifeInput | null) ?? {};
    const raw = Array.isArray(task.players) && task.players.length >= 2 && task.players.length <= 5
        ? task.players
        : [task.alice ?? [10, 30, 40, 20], task.bob ?? [30, 20, 10, 40], task.carol ?? [20, 40, 30, 10]];
    const densities = raw.map(normalize);
    const segments = densities[0]?.length ?? 4;
    const players = densities.length;
    const allocation = densities.map(() => [0, 0]);
    const remaining = new Set(densities.map((_, index) => index));
    let start = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(densities, -1, false),
        edges: [],
        description: `Moving knife with ${players} players and ${segments} cake segments; each fair share is ${(100 / players).toFixed(1)} percent.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { round: 0, remaining: players, cut: start, caller: -1, allocations: allocation.map((piece) => piece[1] ?? 0), fairShare: 100 / players },
    };
    step += 1;

    let round = 0;
    while (remaining.size > 1) {
        const count = remaining.size;
        const threshold = 100 / players;
        let caller = -1;
        let cut = 1;
        for (const player of remaining) {
            const point = callPoint(densities[player] ?? [], start, threshold);
            if (point < cut - 1e-9) {
                cut = point;
                caller = player;
            }
        }
        if (caller < 0) caller = [...remaining][0] ?? 0;
        const piece: [number, number] = [start, cut];
        allocation[caller] = piece;
        remaining.delete(caller);

        yield {
            stepNumber: step,
            entities: makeEntities(densities, caller, false),
            edges: [],
            description: `Round ${round + 1}: player ${caller} calls when the knife reaches ${cut.toFixed(3)} and takes that piece.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                round: round + 1,
                remaining: count,
                cut,
                caller,
                allocations: allocation.map((interval) => interval[1] ?? 0),
                fairShare: 100 / players,
            },
        };
        step += 1;
        start = cut;
        round += 1;
    }

    const last = [...remaining][0] ?? 0;
    allocation[last] = [start, 1];
    const received = densities.map((density, player) => {
        const interval = allocation[player] ?? [0, 0];
        return valueUpTo(density, interval[1] ?? 0) - valueUpTo(density, interval[0] ?? 0);
    });
    yield {
        stepNumber: step,
        entities: makeEntities(densities, -1, true),
        edges: [],
        description: `Player ${last} takes the final piece; every player receives at least ${(100 / players).toFixed(1)} percent by their own value.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { round: round + 1, remaining: 0, cut: 1, caller: last, allocations: allocation.map((interval) => interval[1] ?? 0), received, fairShare: 100 / players, completed: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of asking players to draw cuts, let a knife move slowly and let each player shout when the piece to its left is worth a fair share to them. The earliest shout wins that piece, because waiting any longer would risk getting less than a fair share later. Repeating with fewer players keeps the same argument working all the way to the last player.",
        invariants: [
            "Each allocated piece is an interval of the cake and the intervals partition the whole cake in order.",
            "A caller receives a piece worth exactly one n-th of their total valuation.",
            "After a call the leftover is still worth the rest of the cake to every remaining player, so the same threshold can be used again.",
        ],
        correctness:
            "Normalizing each density makes every player value the whole cake at one hundred. In every round the first caller takes a piece worth one hundred over n. The leftover is then worth the remaining fraction of the cake to each survivor, which is enough for another call at that same threshold. After n minus one rounds the last player takes a remainder they value at exactly one hundred over n. The independent check in the test recomputes each player's received value from the raw densities.",
        complexityRationale:
            "Each of the n rounds scans the remaining players and binary-searches a piecewise linear cumulative value over k segments, costing O(k log precision) per player. Total time is O(n squared k log precision) with O(n k) space for the densities and allocation.",
        uses: [
            "Fair division of a single divisible resource among several agents",
            "Negotiation protocols where agents reveal only a stopping point",
            "Teaching the difference between proportional and envy-free divisions",
        ],
        references: [
            "Dubins and Spanier, How to Cut a Cake Fairly, 1961",
            "Brams and Taylor, Fair Division: From Cake-Cutting to Dispute Resolution, 1996",
        ],
        workedExample:
            "With three players the threshold is about 33.3 percent in every round. If Bob's density is concentrated near the left edge, he calls first at a small cut point and receives a short piece he values highly. The remaining two players keep the same threshold on the leftover, and the last player collects a remainder worth about 33.3 percent to them.",
    },
    id: "moving-knife-cake-cutting",
    name: "Moving-Knife Cake Cutting",
    category: "game",
    complexity: { time: "O(n^2 * k * log precision)", space: "O(n * k)" },
    defaultInput: {
        players: [
            [10, 30, 40, 20],
            [30, 20, 10, 40],
            [20, 40, 30, 10],
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "normalize each player's value density to one hundred",
        "place the knife at the left end of the cake",
        "for the remaining players keep the threshold at one hundred over the original count",
        "find where each player's accumulated value reaches the threshold",
        "let the earliest player call and receive that piece",
        "move the knife to the cut and remove that player",
        "give the remaining interval to the last player",
        "compute each player's received value from their own density",
        "done: report the proportional allocation",
    ],
};

export default module;
