/**
 * monty-hall.ts - Monty Hall Problem
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Three doors hide one car and two goats. A contestant picks a door, the host
 * opens a different door that hides a goat, and the contestant may switch to
 * the remaining closed door. Switching wins exactly when the original pick was
 * wrong, which happens two times out of three. The module shows a few seeded
 * trials door by door, then aggregates a larger seeded sample and compares it
 * with the exact two-thirds result obtained by enumerating every case.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(t) for t simulated trials
 *   Space: O(1) beyond the displayed frames
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Three bars represent the doors; the car, the pick, and the opened door
 *     are marked with distinct states.
 *   - Each trial advances from placement to pick to reveal to outcome.
 *   - meta carries the switch and stay win counts for the aggregate sample.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Build three door bars, marking car, pick, and the door the host opened. */
function doorBars(car: number, pick: number, opened: number): VisualEntity[] {
    return [0, 1, 2].map((door) => {
        let state: EntityState = "idle";
        let label = `Door ${door + 1}`;
        if (door === car) {
            label += " car";
        } else if (door === opened) {
            label += " opened";
        }
        if (door === opened) {
            state = "error";
        } else if (door === car) {
            state = "sorted";
        } else if (door === pick) {
            state = "comparing";
        }
        return {
            id: `bar-${door}`,
            type: "bar" as const,
            label,
            value: door,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { door, isCar: door === car, isPick: door === pick, isOpened: door === opened },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { shownTrials?: number; sampleTrials?: number; seed?: number } | null) ?? {};
    const shownTrials = typeof task.shownTrials === "number" && Number.isInteger(task.shownTrials)
        ? Math.max(1, Math.min(8, task.shownTrials))
        : 3;
    const sampleTrials = typeof task.sampleTrials === "number" && Number.isInteger(task.sampleTrials)
        ? Math.max(1, Math.min(20000, task.sampleTrials))
        : 3000;
    const seed = typeof task.seed === "number" && Number.isFinite(task.seed) ? task.seed : 3;

    const rng = makeRng(seed);
    let switchWins = 0;
    let stayWins = 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: doorBars(-1, -1, -1),
        edges: [],
        description: `Monty Hall with ${shownTrials} shown trials and a ${sampleTrials}-trial sample from seed ${seed}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { shownTrials, sampleTrials, seed, phase: "setup", switchWins: 0, stayWins: 0 },
    };
    step += 1;

    for (let trial = 0; trial < shownTrials; trial += 1) {
        const car = Math.floor(rng() * 3) % 3;
        const pick = Math.floor(rng() * 3) % 3;
        const goatDoors = [0, 1, 2].filter((d) => d !== car && d !== pick);
        const hostOptions = goatDoors.length > 0 ? goatDoors : [0, 1, 2].filter((d) => d !== car);
        const opened = hostOptions[Math.floor(rng() * hostOptions.length) % hostOptions.length] as number;
        const switchDoor = [0, 1, 2].find((d) => d !== pick && d !== opened) as number;
        const switchWin = switchDoor === car;
        const stayWin = pick === car;
        if (switchWin) {
            switchWins += 1;
        }
        if (stayWin) {
            stayWins += 1;
        }

        const phases: Array<{ description: string; line: number; car: number; pick: number; opened: number }> = [
            { description: `Trial ${trial + 1}: the car is hidden behind door ${car + 1}.`, line: 1, car, pick: -1, opened: -1 },
            { description: `The contestant initially picks door ${pick + 1}.`, line: 2, car: -1, pick, opened: -1 },
            { description: `The host opens door ${opened + 1}, which hides a goat.`, line: 3, car, pick, opened },
            { description: `Switching to door ${switchDoor + 1} ${switchWin ? "wins" : "loses"}; staying ${stayWin ? "wins" : "loses"}.`, line: 4, car, pick, opened },
        ];
        for (const phase of phases) {
            yield {
                stepNumber: step,
                entities: doorBars(phase.car, phase.pick, phase.opened),
                edges: [],
                description: phase.description,
                codeLineNumber: phase.line,
                layout: "array",
                meta: {
                    shownTrials,
                    sampleTrials,
                    seed,
                    phase: "trial",
                    trial: trial + 1,
                    car,
                    pick,
                    opened,
                    switchDoor,
                    switchWin,
                    stayWin,
                    switchWins,
                    stayWins,
                },
            };
            step += 1;
        }
    }

    switchWins = 0;
    stayWins = 0;
    for (let trial = 0; trial < sampleTrials; trial += 1) {
        const car = Math.floor(rng() * 3) % 3;
        const pick = Math.floor(rng() * 3) % 3;
        if (pick === car) {
            stayWins += 1;
        } else {
            switchWins += 1;
        }
    }

    // Exact enumeration over all nine equally likely (car, pick) pairs.
    let exactSwitch = 0;
    let exactStay = 0;
    for (let car = 0; car < 3; car += 1) {
        for (let pick = 0; pick < 3; pick += 1) {
            if (pick === car) {
                exactStay += 1;
            } else {
                exactSwitch += 1;
            }
        }
    }

    yield {
        stepNumber: step,
        entities: doorBars(-1, -1, -1),
        edges: [],
        description: `Over ${sampleTrials} trials switching won ${switchWins} times (${((switchWins / sampleTrials) * 100).toFixed(1)} percent) versus staying ${stayWins} times; exact switch chance is 2/3.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            shownTrials,
            sampleTrials,
            seed,
            phase: "done",
            switchWins,
            stayWins,
            switchRate: switchWins / sampleTrials,
            stayRate: stayWins / sampleTrials,
            exactSwitchRate: exactSwitch / 9,
            exactStayRate: exactStay / 9,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The host's reveal does not make the two remaining doors equally likely. Your first pick had only a one-in-three chance of being the car, so two times out of three the car is behind one of the doors you did not pick. By opening a goat door the host concentrates that two-in-three chance onto the single unopened door, so switching is the better bet.",
        invariants: [
            "The host always opens a door that is neither the pick nor the car.",
            "Switching wins if and only if the initial pick was wrong.",
            "Across the nine equally likely (car, pick) pairs, switching wins six and staying wins three.",
        ],
        correctness:
            "Condition on the initial pick. If it is the car (probability one third), switching loses and staying wins. If it is a goat (probability two thirds), the host is forced to open the other goat, so the remaining closed door holds the car and switching wins. Switching therefore wins with probability two thirds and staying with one third. Enumerating all nine car-pick pairs confirms six switch wins and three stay wins, and the seeded sample converges to those exact rates.",
        complexityRationale:
            "Each simulated trial uses a constant number of random draws and comparisons, so t trials take O(t) time. Only a few counters are kept, giving O(1) working space aside from the displayed frames.",
        uses: [
            "A canonical example of conditional probability and updating beliefs",
            "Reasoning about information revealed by a knowledgeable agent",
            "A teaching tool for decision theory and expected value",
        ],
        references: [
            "von Savant, Ask Marilyn, Parade Magazine, 1990",
            "Gill, The Monty Hall Problem, in Probability and Statistics (Springer)",
        ],
        workedExample:
            "If the car is behind door 2 and you pick door 1, the host must open door 3 (the other goat), so switching to door 2 wins. If the car is behind door 1 and you pick door 1, the host opens either goat and switching loses. Since two of the three initial picks are wrong, switching wins twice as often.",
    },
    id: "monty-hall",
    name: "Monty Hall Problem",
    category: "statistics-probability",
    complexity: { time: "O(t)", space: "O(1)" },
    defaultInput: { shownTrials: 3, sampleTrials: 3000, seed: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "place the car uniformly at random behind one of three doors",
        "let the contestant pick a door uniformly at random",
        "the host opens a goat door distinct from the pick",
        "switching wins when the remaining closed door holds the car",
        "repeat over a seeded sample and tally switch and stay wins",
        "report the empirical rates and the exact two-thirds switch rate",
    ],
};

export default module;
