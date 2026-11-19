/**
 * hawk-dove.ts - Hawk-Dove Game
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Hawk-Dove is a symmetric two-player game that models contest over a resource
 * of value V. A Hawk fights and pays cost C if it meets another Hawk, while a
 * Dove retreats from a Hawk and shares with another Dove. The game has two
 * asymmetric pure Nash equilibria and, when the cost exceeds the value, one
 * symmetric mixed equilibrium in which a player chooses Hawk with probability
 * V divided by C.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * Payoffs are the standard additive form with no noise, repeated play, or
 * asymmetric roles. The analysis covers the four pure profiles and the unique
 * symmetric mixed profile of the one-shot normal-form game.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time: O(1) for the four profiles; Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A 2 by 2 grid shows the payoff pair for each action profile.
 *   - Each scan highlights the best response to a fixed opponent action.
 *   - The final frame marks every Nash equilibrium profile in green.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const ACTIONS = ["Hawk", "Dove"] as const;

function payoffs(v: number, c: number): number[][][] {
    const hh = (v - c) / 2;
    const hd = v;
    const dh = 0;
    const dd = v / 2;
    return [
        [
            [hh, hh],
            [hd, 0],
        ],
        [
            [dh, hd],
            [dd, dd],
        ],
    ];
}

function pureEquilibria(pay: number[][][]): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
            const mine = pay[i]?.[j]?.[0] ?? 0;
            const altRow = pay[1 - i]?.[j]?.[0] ?? 0;
            const myOther = pay[i]?.[j]?.[1] ?? 0;
            const altCol = pay[i]?.[1 - j]?.[1] ?? 0;
            if (mine >= altRow && myOther >= altCol) {
                out.push([i, j]);
            }
        }
    }
    return out;
}

function cells(pay: number[][][], highlight: string, equilibria: number[][]): VisualEntity[] {
    const out: VisualEntity[] = [];
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
            const pair = pay[i]?.[j] ?? [0, 0];
            const id = `cell-${i}-${j}`;
            const isNE = equilibria.some((e) => e[0] === i && e[1] === j);
            out.push({
                id,
                type: "cell" as const,
                label: `${pair[0]}, ${pair[1]}`,
                value: pair[0],
                state: (isNE ? "sorted" : id === highlight ? "comparing" : "idle") as VisualEntity["state"],
                x: j,
                y: i,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, p1: pair[0], p2: pair[1] },
            });
        }
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { v?: number; c?: number } | null) ?? {};
    const v = typeof task.v === "number" ? task.v : 2;
    const c = typeof task.c === "number" ? task.c : 4;
    const pay = payoffs(v, c);
    const pure = pureEquilibria(pay);

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(pay, "", []),
        edges: [],
        description: `Hawk-Dove with resource value ${v} and contest cost ${c}; each cell lists the row player's payoff first.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols: 2, v, c },
    };
    step += 1;

    for (let opponent = 0; opponent < 2; opponent += 1) {
        const best = (pay[0]?.[opponent]?.[0] ?? 0) >= (pay[1]?.[opponent]?.[0] ?? 0) ? 0 : 1;
        yield {
            stepNumber: step,
            entities: cells(pay, `cell-${best}-${opponent}`, []),
            edges: [],
            description: `Against ${ACTIONS[opponent]}, the row player's best response is ${ACTIONS[best]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: 2, cols: 2, opponent, bestResponse: best },
        };
        step += 1;
    }

    const mixedP = c > 0 ? Math.min(1, Math.max(0, v / c)) : 1;
    const hawkPay = mixedP * (pay[0]?.[0]?.[0] ?? 0) + (1 - mixedP) * (pay[0]?.[1]?.[0] ?? 0);
    const dovePay = mixedP * (pay[1]?.[0]?.[0] ?? 0) + (1 - mixedP) * (pay[1]?.[1]?.[0] ?? 0);
    const mixedPayoff = Math.abs(hawkPay - dovePay) < 1e-12 ? hawkPay : (hawkPay + dovePay) / 2;

    yield {
        stepNumber: step,
        entities: cells(pay, "", pure),
        edges: [],
        description: `The symmetric mixed strategy plays Hawk with probability ${mixedP.toFixed(3)} and yields expected payoff ${mixedPayoff.toFixed(3)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: 2,
            cols: 2,
            mixedP,
            mixedPayoff,
            hawkPay,
            dovePay,
            pureNE: pure.flat(),
        },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(pay, "", pure),
        edges: [],
        description: `Nash equilibria: ${pure.map((e) => `(${ACTIONS[e[0] ?? 0]}, ${ACTIONS[e[1] ?? 0]})`).join(" and ")} plus the symmetric mixed profile.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 2,
            cols: 2,
            pureNE: pure.flat(),
            equilibriumCount: pure.length + 1,
            mixedP,
            mixedPayoff,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two animals contest a resource. Escalating wins the resource but risks an expensive fight, while yielding avoids the fight but gives up the prize. If nobody ever escalates, a mutant escalator takes everything, but if everybody escalates the fighting cost can make yielding attractive. The balance is a mixed strategy: escalate just often enough to make the opponent indifferent.",
        invariants: [
            "The payoff matrix is symmetric, so both players face the same incentives.",
            "A profile is a Nash equilibrium only when neither player gains by changing action alone.",
            "At the symmetric mixed equilibrium the expected payoffs of Hawk and Dove are equal.",
        ],
        correctness:
            "Testing all four pure profiles against the two possible deviations finds exactly the pure Nash equilibria. For the mixed strategy, the row player's expected payoff from Hawk is p times the Hawk-Hawk payoff plus one minus p times the Hawk-Dove payoff, and from Dove it is p times the Dove-Hawk payoff plus one minus p times the Dove-Dove payoff. Equating those expressions gives p equal to V over C when C exceeds V, and clipping handles the case where escalation dominates. An opponent using that p makes the player indifferent, which is the defining condition of a mixed Nash equilibrium.",
        complexityRationale:
            "Both players have two actions, so enumerating the four pure profiles and solving the single mixed equation take constant time and constant space.",
        uses: [
            "Modeling animal conflict and territorial contests in evolutionary biology",
            "Teaching mixed strategies and the Nash equilibrium concept",
            "Analyzing price wars between two competing firms",
        ],
        references: [
            "Smith and Price, The Logic of Animal Conflict (1973)",
            "Myerson, Game Theory: Analysis of Conflict (1991)",
        ],
        workedExample:
            "With V equal to 2 and C equal to 4, the Hawk-Hawk payoff is minus 1, Hawk-Dove gives 2 to the Hawk, and Dove-Dove gives 1 each. The pure equilibria are Hawk-Dove and Dove-Hawk. The mixed probability is 2 over 4, so each player escalates half the time and earns an expected payoff of 1.",
    },
    id: "hawk-dove",
    name: "Hawk-Dove Game",
    category: "game",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { v: 2, c: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the resource value V and contest cost C",
        "fill the two by two symmetric payoff matrix",
        "for each action profile test both unilateral deviations",
        "collect the profiles with no profitable deviation",
        "solve for the probability that equalizes Hawk and Dove",
        "clip that probability into the valid zero to one range",
        "report pure and mixed Nash equilibria",
    ],
};

export default module;
