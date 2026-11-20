/**
 * envy-free-cake-cutting.ts - Envy-Free Cake Cutting (Selfridge-Conway)
 *
 * Three players with additive valuations divide a cake so that nobody prefers
 * another player's bundle to their own. Alice cuts three equal pieces, Bob
 * trims his favorite to tie his second favorite, Carol and Bob choose pieces,
 * and the trimmings are divided with the non-receiver cutting. This is the
 * classic Selfridge-Conway protocol for three players.
 *
 * Time O(k) for k cake segments; space O(k).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type MetaExtra = Record<string, number | string | boolean | number[]>;

interface Interval {
    lo: number;
    hi: number;
}

const NAMES = ["Alice", "Bob", "Carol"] as const;
type PlayerIndex = 0 | 1 | 2;

/** Scale a density vector to sum to one. */
function normalize(values: number[], k: number): number[] {
    const sum = values.reduce((acc, v) => acc + Math.max(0, v), 0);
    return sum > 0 ? values.map((v) => Math.max(0, v) / sum) : new Array<number>(k).fill(1 / k);
}

/** Value of the interval [lo, hi) for an additive, piecewise-uniform player. */
function valueOf(density: number[], lo: number, hi: number): number {
    if (hi <= lo) {
        return 0;
    }
    let total = 0;
    for (let i = 0; i < density.length; i += 1) {
        const overlap = Math.max(0, Math.min(hi, i + 1) - Math.max(lo, i));
        if (overlap > 0) {
            total += (density[i] ?? 0) * overlap;
        }
    }
    return total;
}

/** Value of a single interval for a player. */
function pieceValue(density: number[], piece: Interval): number {
    return valueOf(density, piece.lo, piece.hi);
}

/** Point x in [lo, hi] where the cumulative value from lo first reaches target. */
function cutAt(density: number[], lo: number, hi: number, target: number): number {
    let acc = 0;
    for (let i = 0; i < density.length; i += 1) {
        const segLo = Math.max(lo, i);
        const segHi = Math.min(hi, i + 1);
        if (segHi <= segLo) {
            continue;
        }
        const densityHere = density[i] ?? 0;
        const segmentValue = densityHere * (segHi - segLo);
        if (acc + segmentValue >= target - 1e-12) {
            if (densityHere <= 1e-15) {
                return segLo;
            }
            const needed = Math.max(0, target - acc);
            return segLo + Math.min(segHi - segLo, needed / densityHere);
        }
        acc += segmentValue;
    }
    return hi;
}

/** Index of the largest entry. */
function argmax(values: number[]): number {
    let best = 0;
    for (let i = 1; i < values.length; i += 1) {
        if ((values[i] ?? 0) > (values[best] ?? 0)) {
            best = i;
        }
    }
    return best;
}

/** Total value a player assigns to a bundle of intervals. */
function bundleValue(density: number[], bundle: Interval[]): number {
    return bundle.reduce((acc, piece) => acc + valueOf(density, piece.lo, piece.hi), 0);
}

/** Build one bar per player per segment. */
function makeBars(densities: number[][], states: Map<string, EntityState>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let player = 0; player < NAMES.length; player += 1) {
        const name = NAMES[player];
        const density = densities[player] ?? [];
        for (let i = 0; i < density.length; i += 1) {
            const id = `${name.toLowerCase()}-${i}`;
            entities.push({
                id,
                type: "bar" as const,
                label: `${name.charAt(0)}${i} ${((density[i] ?? 0) * 100).toFixed(0)}`,
                value: (density[i] ?? 0) * 100,
                state: states.get(id) ?? "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { player: name, segment: i, density: density[i] ?? 0 },
            });
        }
    }
    return entities;
}

/** Mark the bars whose segment midpoint lies in any of the given intervals. */
function markBundle(states: Map<string, EntityState>, densities: number[][], player: PlayerIndex, intervals: Interval[]): void {
    const name = NAMES[player];
    const count = (densities[player] ?? []).length;
    for (let i = 0; i < count; i += 1) {
        const center = i + 0.5;
        if (intervals.some((piece) => piece.lo <= center && center < piece.hi)) {
            states.set(`${name.toLowerCase()}-${i}`, "sorted");
        }
    }
}

/** Run the Selfridge-Conway three-player protocol. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { alice?: number[]; bob?: number[]; carol?: number[] } | null) ?? {};
    const rawAlice = Array.isArray(task.alice) ? task.alice : [1, 1, 1, 1, 1, 1];
    const k = Math.min(10, Math.max(2, rawAlice.length));
    const take = (values: number[] | undefined, fallback: number[]): number[] => {
        const source = Array.isArray(values) && values.length === k ? values : fallback;
        return Array.from({ length: k }, (_, i) => source[i] ?? 0);
    };
    const densities = [
        normalize(take(task.alice, [1, 1, 1, 1, 1, 1]), k),
        normalize(take(task.bob, [1, 1, 2, 2, 4, 4]), k),
        normalize(take(task.carol, [4, 4, 2, 2, 1, 1]), k),
    ];
    const alice = densities[0] as number[];
    const bob = densities[1] as number[];
    const carol = densities[2] as number[];

    // Step 1: Alice cuts three pieces she values at one third each.
    const firstCut = cutAt(alice, 0, k, 1 / 3);
    const secondCut = cutAt(alice, firstCut, k, 1 / 3);
    const pieces: Interval[] = [
        { lo: 0, hi: firstCut },
        { lo: firstCut, hi: secondCut },
        { lo: secondCut, hi: k },
    ];

    // Step 2: Bob trims his favorite piece down to his second-favorite value.
    const bobPieceValues = pieces.map((piece) => valueOf(bob, piece.lo, piece.hi));
    const favorite = argmax(bobPieceValues);
    const ranked = [...bobPieceValues].sort((a, b) => b - a);
    const secondValue = ranked[1] ?? 0;
    const favoriteInterval = pieces[favorite] as Interval;
    const trimmedHi = bobPieceValues[favorite]! - secondValue > 1e-12
        ? cutAt(bob, favoriteInterval.lo, favoriteInterval.hi, secondValue)
        : favoriteInterval.hi;
    const trimmings: Interval = { lo: trimmedHi, hi: favoriteInterval.hi };
    pieces[favorite] = { lo: favoriteInterval.lo, hi: trimmedHi };

    // Steps 3-5: Carol chooses first, Bob is forced to take the trimmed piece
    // if Carol did not, and Alice receives the last piece.
    const carolChoice = argmax(pieces.map((piece) => valueOf(carol, piece.lo, piece.hi)));
    let bobChoice: number;
    if (carolChoice !== favorite) {
        bobChoice = favorite;
    } else {
        const remaining = [0, 1, 2].filter((index) => index !== carolChoice);
        bobChoice = remaining.reduce((best, index) =>
            pieceValue(bob, pieces[index] as Interval) > pieceValue(bob, pieces[best] as Interval) ? index : best, remaining[0] as number);
    }
    const aliceChoice = [0, 1, 2].find((index) => index !== carolChoice && index !== bobChoice) ?? 0;

    // Among Bob and Carol, X received the trimmed piece and Y did not.
    const xPlayer: PlayerIndex = bobChoice === favorite ? 1 : 2;
    const yPlayer: PlayerIndex = xPlayer === 1 ? 2 : 1;
    const yDensity = densities[yPlayer] as number[];
    const xDensity = densities[xPlayer] as number[];

    // Step 6: Y cuts the trimmings into three pieces equal in Y's eyes.
    const trimmingValue = valueOf(yDensity, trimmings.lo, trimmings.hi);
    let thirds: Interval[] = [];
    let xTrim = -1;
    let aliceTrim = -1;
    let yTrim = -1;
    if (trimmingValue > 1e-12) {
        const t1 = cutAt(yDensity, trimmings.lo, trimmings.hi, trimmingValue / 3);
        const t2 = cutAt(yDensity, t1, trimmings.hi, trimmingValue / 3);
        thirds = [
            { lo: trimmings.lo, hi: t1 },
            { lo: t1, hi: t2 },
            { lo: t2, hi: trimmings.hi },
        ];
        xTrim = argmax(thirds.map((piece) => valueOf(xDensity, piece.lo, piece.hi)));
        const leftForAlice = [0, 1, 2].filter((index) => index !== xTrim);
        aliceTrim = leftForAlice.reduce((best, index) =>
            pieceValue(alice, thirds[index] as Interval) > pieceValue(alice, thirds[best] as Interval) ? index : best, leftForAlice[0] as number);
        yTrim = [0, 1, 2].find((index) => index !== xTrim && index !== aliceTrim) ?? 0;
    }

    const bundleOf = (player: PlayerIndex, pieceIndex: number, trimIndex: number): Interval[] => {
        const bundle: Interval[] = [pieces[pieceIndex] as Interval];
        if (trimIndex >= 0 && thirds[trimIndex]) {
            bundle.push(thirds[trimIndex] as Interval);
        }
        return bundle;
    };
    const bundles: Record<PlayerIndex, Interval[]> = {
        0: bundleOf(0, aliceChoice, aliceTrim),
        1: bundleOf(1, bobChoice, xPlayer === 1 ? xTrim : yTrim),
        2: bundleOf(2, carolChoice, xPlayer === 2 ? xTrim : yTrim),
    };
    const values: Record<PlayerIndex, number> = {
        0: bundleValue(alice, bundles[0]),
        1: bundleValue(bob, bundles[1]),
        2: bundleValue(carol, bundles[2]),
    };
    // Envy compares one player's value of their own bundle with that same
    // player's value of every other bundle, never across different players.
    const valueMatrix: number[][] = densities.map((density) =>
        NAMES.map((_name, q) => bundleValue(density, bundles[q as PlayerIndex])));
    const envyFree = NAMES.every((_name, p) =>
        NAMES.every((_other, q) =>
            (valueMatrix[p]?.[p] ?? 0) >= (valueMatrix[p]?.[q] ?? 0) - 1e-6));

    const frames: VisualFrame[] = [];
    let step = 0;
    const push = (states: Map<string, EntityState>, description: string, line: number, extra: MetaExtra): void => {
        frames.push({
            stepNumber: step,
            entities: makeBars(densities, states),
            edges: [],
            description,
            codeLineNumber: line,
            layout: "array",
            meta: {
                segments: k,
                cuts: [firstCut, secondCut],
                pieces: pieces.map((piece) => piece.hi - piece.lo),
                carolChoice,
                bobChoice,
                aliceChoice,
                xReceiver: NAMES[xPlayer],
                yCutter: NAMES[yPlayer],
                ...extra,
            },
        });
        step += 1;
    };

    push(new Map(), `Three players divide a ${k}-segment cake; Alice ${alice.map((v) => (v * 100).toFixed(0)).join("/")}, Bob ${bob.map((v) => (v * 100).toFixed(0)).join("/")}, Carol ${carol.map((v) => (v * 100).toFixed(0)).join("/")}.`, 0, { phase: "start" });

    const cutStates = new Map<string, EntityState>();
    for (let i = 0; i < k; i += 1) {
        if (Math.abs(i + 0.5 - firstCut) < 0.5 || Math.abs(i + 0.5 - secondCut) < 0.5) {
            cutStates.set(`alice-${i}`, "pivot");
        } else {
            cutStates.set(`alice-${i}`, "active");
        }
    }
    push(cutStates, `Alice cuts at ${firstCut.toFixed(2)} and ${secondCut.toFixed(2)}, making three pieces she values at one third each.`, 1, { phase: "cut", firstCut, secondCut });

    const trimStates = new Map<string, EntityState>();
    markBundle(trimStates, densities, 1, pieces);
    if (trimmings.hi > trimmings.lo) {
        markBundle(trimStates, densities, 1, [trimmings]);
        for (let i = 0; i < k; i += 1) {
            const center = i + 0.5;
            if (trimmings.lo <= center && center < trimmings.hi) {
                trimStates.set(`bob-${i}`, "swapped");
            }
        }
    }
    push(trimStates, `Bob trims his favorite piece ${favorite} so its value ties his second choice, leaving trimmings of width ${(trimmings.hi - trimmings.lo).toFixed(2)}.`, 2, { phase: "trim", favorite, trimmingWidth: trimmings.hi - trimmings.lo });

    const carolStates = new Map<string, EntityState>();
    markBundle(carolStates, densities, 2, [pieces[carolChoice] as Interval]);
    push(carolStates, `Carol chooses first and takes piece ${carolChoice}, the one she values most.`, 3, { phase: "carol" });

    const bobStates = new Map<string, EntityState>();
    markBundle(bobStates, densities, 1, [pieces[bobChoice] as Interval]);
    push(bobStates, carolChoice !== favorite
        ? `Carol left the trimmed piece, so Bob is required to take piece ${favorite}.`
        : `Bob takes his favorite of the remaining pieces, piece ${bobChoice}.`, 4, { phase: "bob" });

    const aliceStates = new Map<string, EntityState>();
    markBundle(aliceStates, densities, 0, [pieces[aliceChoice] as Interval]);
    push(aliceStates, `Alice receives the last original piece, number ${aliceChoice}, which she values at exactly one third.`, 5, { phase: "alice" });

    const yStates = new Map<string, EntityState>();
    markBundle(yStates, densities, yPlayer, thirds);
    push(yStates, `${NAMES[yPlayer]} did not receive the trimmed piece, so ${NAMES[yPlayer]} cuts the trimmings into three equal thirds.`, 6, { phase: "y-cuts" });

    const xStates = new Map<string, EntityState>();
    markBundle(xStates, densities, xPlayer, xTrim >= 0 ? [thirds[xTrim] as Interval] : []);
    push(xStates, `${NAMES[xPlayer]} received the trimmed piece and chooses a trimming third first${xTrim >= 0 ? ` (third ${xTrim})` : ""}.`, 7, { phase: "x-chooses" });

    const aliceTrimStates = new Map<string, EntityState>();
    markBundle(aliceTrimStates, densities, 0, aliceTrim >= 0 ? [thirds[aliceTrim] as Interval] : []);
    push(aliceTrimStates, `Alice chooses her favorite remaining trimming third${aliceTrim >= 0 ? ` (third ${aliceTrim})` : ""}.`, 7, { phase: "alice-chooses" });

    const yLastStates = new Map<string, EntityState>();
    markBundle(yLastStates, densities, yPlayer, yTrim >= 0 ? [thirds[yTrim] as Interval] : []);
    push(yLastStates, `${NAMES[yPlayer]} takes the last trimming third${yTrim >= 0 ? ` (third ${yTrim})` : ""}.`, 7, { phase: "y-chooses" });

    const finalStates = new Map<string, EntityState>();
    markBundle(finalStates, densities, 0, bundles[0]);
    markBundle(finalStates, densities, 1, bundles[1]);
    markBundle(finalStates, densities, 2, bundles[2]);
    push(
        finalStates,
        `Final bundles are worth ${(values[0] * 100).toFixed(1)}, ${(values[1] * 100).toFixed(1)} and ${(values[2] * 100).toFixed(1)} points to Alice, Bob and Carol; this division is ${envyFree ? "envy-free" : "not envy-free"}.`,
        8,
        {
            phase: "done",
            values: [values[0], values[1], values[2]],
            aliceBundle: bundles[0].map((piece) => [piece.lo, piece.hi]).flat(),
            bobBundle: bundles[1].map((piece) => [piece.lo, piece.hi]).flat(),
            carolBundle: bundles[2].map((piece) => [piece.lo, piece.hi]).flat(),
            envyFree,
        },
    );

    for (const frame of frames) {
        yield frame;
    }
}

/** The envy-free cake cutting module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Cut and choose gives two people an envy-free split, but three people need a cleverer dance. Alice makes three pieces she thinks are equal. Bob trims the piece he likes best until it ties his second favorite, setting the scraps aside. Carol picks first and Bob takes the trimmed piece if it is still there. The scraps are then split by a rule that gives the first choice to whoever received the trimmed piece.",
        invariants: [
            "Alice values all three original pieces at exactly one third.",
            "After trimming, Bob values the trimmed piece and his second favorite equally.",
            "The trimmed piece goes to Bob or Carol, never to Alice.",
        ],
        correctness:
            "Alice always receives an untrimmed piece worth one third to her and picks a trimming third before the cutter, so she values her bundle at least as much as either other bundle. Bob trimmed his favorite to tie his second favorite, so whichever of those he receives is tied for his top value, and as the trimming receiver he picks first among equal thirds. Carol chooses her favorite piece first. In every case each player's own bundle is worth at least what they assign to another bundle, so the division is envy-free.",
        complexityRationale:
            "Finding cuts and scanning trimmings each walks the k segments a constant number of times, giving O(k) time; storing the three density vectors and bundles uses O(k) space.",
        uses: [
            "Fair division of an indivisible-aside asset among three heirs or partners",
            "Introducing envy-free protocols beyond two players",
            "A building block for general n-player fair division procedures",
        ],
        references: [
            "Selfridge and Conway, cake cutting problem, unpublished solution described in Brams and Taylor (1996)",
            "Brams and Taylor, Fair Division: From Cake Cutting to Dispute Resolution (1996)",
        ],
        workedExample:
            "Alice values six equal segments uniformly and cuts at 2 and 4. Bob values the last three segments twice as much, trims his favorite third back to tie his second choice, and leaves a trimming strip. Carol takes her favored first third, Bob is forced to take the trimmed piece, and Alice takes the middle third. Carol divides the trimmings and the other two pick before her; every player ends up preferring their own bundle.",
    },
    id: "envy-free-cake-cutting",
    name: "Envy-Free Cake Cutting (Selfridge-Conway)",
    category: "game",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { alice: [1, 1, 1, 1, 1, 1], bob: [1, 1, 2, 2, 4, 4], carol: [4, 4, 2, 2, 1, 1] },
    visualType: "array",
    run,
    pseudocode: [
        "normalize each player's segment values to sum to one",
        "Alice cuts the cake into three pieces she values equally",
        "Bob trims his favorite piece to tie his second favorite; set trimmings aside",
        "Carol chooses a piece first among the three",
        "Bob chooses second, taking the trimmed piece if it remains",
        "Alice takes the last remaining piece",
        "the Bob-or-Carol player without the trimmed piece cuts trimmings into thirds",
        "the trimmed-piece receiver chooses a third, then Alice, then the cutter",
        "report each bundle's value and the envy-free verdict",
    ],
};

export default module;
