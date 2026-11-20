/**
 * matching-pennies.ts - Matching Pennies (exact 2 by 2 equilibrium solver)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Matching Pennies is the canonical zero-sum game: the row player wins when
 * the two coins match and the column player wins when they differ. There is no
 * pure Nash equilibrium, because each player always wants to outguess the
 * other. The unique mixed equilibrium makes both players randomize equally
 * between Heads and Tails, giving the game a value of zero.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an exact analysis of the one-shot normal-form game with payoffs
 * plus one and minus one. It enumerates pure best responses and solves the two
 * indifference equations in closed form. Repeated play, risk aversion, and
 * noisy observations are not modeled.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(1) for four profiles and two linear equations
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A 2 by 2 grid shows the row player's payoff for each coin profile.
 *   - Each scan highlights the best response to a fixed opponent action.
 *   - The final frame marks the mixed equilibrium probabilities.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const FACES = ["Heads", "Tails"] as const;

/** Row-player payoff matrix: +1 when the coins match, -1 otherwise. */
function payoffs(): number[][] {
    return [
        [1, -1],
        [-1, 1],
    ];
}

/** Collect action profiles where neither player has a profitable deviation. */
function pureEquilibria(pay: number[][]): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
            const rowNow = pay[i]?.[j] ?? 0;
            const rowSwap = pay[1 - i]?.[j] ?? 0;
            const colNow = -(pay[i]?.[j] ?? 0);
            const colSwap = -(pay[i]?.[1 - j] ?? 0);
            if (rowNow >= rowSwap && colNow >= colSwap) {
                out.push([i, j]);
            }
        }
    }
    return out;
}

function cells(pay: number[][], highlight: string, mixed: boolean): VisualEntity[] {
    const out: VisualEntity[] = [];
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
            const value = pay[i]?.[j] ?? 0;
            const id = `cell-${i}-${j}`;
            out.push({
                id,
                type: "cell" as const,
                label: `${FACES[i]} / ${FACES[j]}: ${value > 0 ? "+1" : "-1"}`,
                value,
                state: (mixed && i === j ? "sorted" : id === highlight ? "comparing" : "idle") as VisualEntity["state"],
                x: j,
                y: i,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, payoff: value },
            });
        }
    }
    return out;
}

/** Expected row payoff when the row player mixes with probability p. */
function rowExpected(p: number, q: number, pay: number[][]): number[] {
    const a = pay[0]?.[0] ?? 0;
    const b = pay[0]?.[1] ?? 0;
    const cc = pay[1]?.[0] ?? 0;
    const d = pay[1]?.[1] ?? 0;
    return [
        q * a + (1 - q) * b,
        q * cc + (1 - q) * d,
    ];
}

/** Expected column payoff (the negative of the row payoff) by column action. */
function colExpected(p: number, q: number, pay: number[][]): number[] {
    const a = pay[0]?.[0] ?? 0;
    const b = pay[0]?.[1] ?? 0;
    const cc = pay[1]?.[0] ?? 0;
    const d = pay[1]?.[1] ?? 0;
    return [
        -(p * a + (1 - p) * cc),
        -(p * b + (1 - p) * d),
    ];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const pay = payoffs();
    const pure = pureEquilibria(pay);

    // Row indifference: p*a + (1-p)*b = p*c + (1-p)*d.
    const a = pay[0]?.[0] ?? 0;
    const b = pay[0]?.[1] ?? 0;
    const cc = pay[1]?.[0] ?? 0;
    const d = pay[1]?.[1] ?? 0;
    const pDen = a - cc + d - b;
    const qDen = a - b + d - cc;
    const p = pDen === 0 ? 0.5 : (d - b) / pDen;
    const q = qDen === 0 ? 0.5 : (d - cc) / qDen;

    const rowPays = rowExpected(p, q, pay);
    const colPays = colExpected(p, q, pay);
    const value = p * q * a + p * (1 - q) * b + (1 - p) * q * cc + (1 - p) * (1 - q) * d;

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(pay, "", false),
        edges: [],
        description: "Matching Pennies: the row player earns +1 when the coins match and -1 when they differ.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols: 2, pureNE: pure.length },
    };
    step += 1;

    for (let opponent = 0; opponent < 2; opponent += 1) {
        const best = (pay[0]?.[opponent] ?? 0) >= (pay[1]?.[opponent] ?? 0) ? 0 : 1;
        yield {
            stepNumber: step,
            entities: cells(pay, `cell-${best}-${opponent}`, false),
            edges: [],
            description: `When the column player shows ${FACES[opponent]}, the row player's unique best response is ${FACES[best]}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: 2, cols: 2, opponent, bestResponse: best },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: cells(pay, "", false),
        edges: [],
        description: `No profile survives a unilateral deviation, so there are ${pure.length} pure Nash equilibria.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: 2, cols: 2, pureNE: pure.length },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(pay, "", true),
        edges: [],
        description: `Row indifference gives p = ${p.toFixed(3)}; column indifference gives q = ${q.toFixed(3)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 2, cols: 2, p, q, rowHeads: rowPays[0] ?? 0, rowTails: rowPays[1] ?? 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(pay, "", true),
        edges: [],
        description: `At this profile both pure actions pay ${rowPays[0]?.toFixed(3)} for the row player and ${colPays[0]?.toFixed(3)} for the column player, so neither can gain by deviating.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 2,
            cols: 2,
            p,
            q,
            rowHeads: rowPays[0] ?? 0,
            rowTails: rowPays[1] ?? 0,
            colHeads: colPays[0] ?? 0,
            colTails: colPays[1] ?? 0,
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(pay, "", true),
        edges: [],
        description: `The unique mixed Nash equilibrium is heads with probability ${p.toFixed(3)} for both players, with game value ${value.toFixed(3)}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: 2, cols: 2, p, q, value, pureNE: pure.length, equilibriumCount: 1 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two players secretly choose heads or tails. One wins when the choices match and the other wins when they differ, so whatever the opponent does there is a best action to exploit it. That means no fixed pair of actions can be stable. Stability appears only when both players randomize enough that the opponent cannot predict an edge.",
        invariants: [
            "The row payoff is the negative of the column payoff, so the game is zero-sum.",
            "A pure profile is an equilibrium only if neither player can gain by switching action alone.",
            "At a mixed equilibrium every action in the support gives the same expected payoff.",
        ],
        correctness:
            "Testing each of the four profiles against both unilateral deviations yields no pure equilibrium. For the mixed strategy, let p be the chance the row player shows heads and q the chance for the column player. The row player is indifferent when q times one plus one minus q times minus one equals q times minus one plus one minus q times one, which gives q equal to one half; the symmetric equation for the column player gives p equal to one half. Substituting those values makes both players' pure actions pay zero, satisfying the equilibrium condition, and the minimax value is therefore zero.",
        complexityRationale:
            "Four payoff entries, four best-response checks, and two divisions are constant work, and the algorithm stores only a constant-size matrix, so both bounds are constant.",
        uses: [
            "Teaching mixed strategies and zero-sum equilibrium in game theory courses",
            "Modeling penalty kicks and other hidden simultaneous-choice contests",
            "A benchmark for arbitrary 2 by 2 normal-form game solvers",
        ],
        references: [
            "von Neumann and Morgenstern, Theory of Games and Economic Behavior (1944)",
            "Myerson, Game Theory: Analysis of Conflict (1991), Chapter 3",
        ],
        workedExample:
            "Write the row payoff matrix as plus one on the diagonal and minus one off it. If the column player shows heads, the row player prefers heads; if the column player shows tails, the row player prefers tails. No fixed pair survives. Setting the two expected row payoffs equal gives q equals one half, and the column equation gives p equals one half, so each player is indifferent and the value is zero.",
    },
    id: "matching-pennies",
    name: "Matching Pennies Equilibrium",
    category: "game",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: {},
    visualType: "grid",
    run,
    pseudocode: [
        "write the two by two row payoff matrix",
        "for each profile test both players' unilateral deviations",
        "collect profiles with no profitable deviation as pure equilibria",
        "solve the row indifference equation for the mixing probability p",
        "solve the column indifference equation for the mixing probability q",
        "compute the expected game value from p and q",
        "verify that each player is indifferent between the pure actions",
        "report the equilibria and the value of the game",
    ],
};

export default module;
