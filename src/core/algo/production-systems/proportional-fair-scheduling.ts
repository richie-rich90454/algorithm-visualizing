/**
 * proportional-fair-scheduling.ts - Proportional Fair Packet Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A wireless base station can transmit to only one user at a time, and each
 * user sees a different achievable rate that changes with the channel. Proportional
 * fair scheduling gives every slot to the user with the largest ratio of its
 * current achievable rate to its own average throughput. Users with a temporarily
 * bad channel are not starved, because their average decays while they wait.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(slots * users)
 *   Space: O(users + slots)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One grid row per slot, one column per user; the chosen cell is the server.
 *   - A served cell is green, an idle cell is gray.
 *   - meta carries the serving index, averages, and ratios for each slot.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface PfStep {
    slot: number;
    served: number;
    ratios: number[];
    averages: number[];
}

/** Pick the user with the largest rate-to-average ratio; ties go to the lower index. */
export function pfArgmax(rates: number[], averages: number[]): number {
    let best = -1;
    let bestRatio = -1;
    for (let i = 0; i < rates.length; i += 1) {
        const ratio = (rates[i] ?? 0) / Math.max(1e-9, averages[i] ?? 1e-9);
        if (ratio > bestRatio) {
            bestRatio = ratio;
            best = i;
        }
    }
    return best;
}

/** Advance one proportional-fair slot and return the updated average throughputs. */
export function pfStep(slot: number, rates: number[], averages: number[], window: number): { averages: number[]; step: PfStep } {
    const served = pfArgmax(rates, averages);
    const next = averages.slice();
    const tau = Math.max(1, window);
    for (let i = 0; i < next.length; i += 1) {
        if (i === served) {
            next[i] = (1 - 1 / tau) * (next[i] ?? 0) + (1 / tau) * (rates[i] ?? 0);
        } else {
            next[i] = (1 - 1 / tau) * (next[i] ?? 0);
        }
    }
    const ratios = rates.map((rate, i) => rate / Math.max(1e-9, averages[i] ?? 1e-9));
    return { averages: next, step: { slot, served, ratios, averages: next.slice() } };
}

function makeCells(rates: number[][], steps: PfStep[]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    steps.forEach((step, row) => {
        rates[row]?.forEach((rate, col) => {
            const served = step.served === col;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: `u${col}:r${rate.toFixed(1)}`,
                value: rate,
                state: (served ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, user: col, served: served ? 1 : 0, ratio: step.ratios[col] ?? 0 },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { rates?: number[][]; window?: number } | null) ?? {};
    const rates = Array.isArray(task.rates) && task.rates.length > 0
        ? task.rates.map((row) => (Array.isArray(row) ? row.map((v) => Math.max(0, Number(v) || 0)) : []))
        : [
            [8, 1, 1],
            [2, 9, 1],
            [8, 1, 1],
            [1, 2, 10],
            [8, 2, 1],
            [1, 9, 2],
        ];
    const width = rates[0]?.length ?? 3;
    const window = Math.max(1, Math.floor(Number(task.window ?? 4)) || 4);
    let averages = Array.from({ length: width }, () => 1e-6);
    const steps: PfStep[] = [];
    let stepNumber = 0;

    yield {
        stepNumber: stepNumber,
        entities: [],
        edges: [],
        description: `Proportional fair scheduling for ${rates.length} slot(s) and ${width} user(s) with window ${window}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 0, cols: width, served: [], averages: [] },
    };
    stepNumber += 1;

    for (let slot = 0; slot < rates.length; slot += 1) {
        const row = rates[slot] ?? [];
        const result = pfStep(slot, row, averages, window);
        averages = result.averages;
        steps.push(result.step);
        const servedCount = steps.filter((s) => s.served >= 0).length;
        yield {
            stepNumber: stepNumber,
            entities: makeCells(rates, steps),
            edges: [],
            description: `Slot ${slot}: served user ${result.step.served}, ratios ${result.step.ratios.map((r) => r.toFixed(2)).join(", ")}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {
                rows: steps.length,
                cols: width,
                served: steps.map((s) => s.served),
                averages: result.averages,
                ratios: result.step.ratios,
                servedCount,
            },
        };
        stepNumber += 1;
    }

    const counts = Array.from({ length: width }, (_, user) => steps.filter((s) => s.served === user).length);
    yield {
        stepNumber: stepNumber,
        entities: makeCells(rates, steps),
        edges: [],
        description: `Scheduling finished with service counts ${counts.join(", ")} across ${width} user(s).`,
        codeLineNumber: 2,
        layout: "grid",
        meta: {
            rows: steps.length,
            cols: width,
            served: steps.map((s) => s.served),
            averages: averages,
            counts,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "At each moment give the channel to whoever would benefit most relative to how much service they have already received. Dividing the achievable rate by the running average throughput makes a user whose average is low look attractive even with a mediocre channel, so nobody is starved. The result is a balance between total throughput and fairness.",
        invariants: [
            "The served user at a slot is the one maximizing rate divided by average throughput.",
            "A served user's average moves toward its current rate; unserved averages decay.",
            "Every average stays nonnegative and is at least the smoothed contribution of served slots.",
        ],
        correctness:
            "Maximizing the rate-to-average ratio is the greedy step of maximizing the sum of logarithms of the average throughputs, a concave objective. Because a user left unserved has a decaying average, its ratio rises until it eventually wins a slot, giving bounded starvation. Hence every user with a positive achievable rate receives service infinitely often, which is the proportional-fair guarantee.",
        complexityRationale:
            "Each slot scans all users once to find the maximum and updates all averages once, costing O(users) per slot and O(slots times users) time overall. The service matrix and per-user averages use O(users plus slots) space.",
        uses: [
            "Downlink packet scheduling in cellular base stations",
            "Fair sharing of a time-varying wireless channel",
            "Teaching the throughput versus fairness trade-off",
        ],
        references: [
            "Viswanath, Tse, and Laroia, Opportunistic Transmission Mechanisms, 2002",
            "Andrews, Kumar, and Kalyan, Downlink Scheduling in Wireless Networks, 2007",
        ],
        workedExample:
            "With users A and B seeing rates 8 and 1 and both averages near zero, slot one goes to A. After A's average rises, its ratio falls; if B's channel improves to 9 while its average is still small, B wins the next slot. A user whose channel is always poor still wins occasionally once its average decays enough.",
    },
    id: "proportional-fair-scheduling",
    name: "Proportional Fair Scheduling",
    category: "production-systems",
    complexity: { time: "O(s * u)", space: "O(s + u)" },
    defaultInput: {
        rates: [
            [8, 1, 1],
            [2, 9, 1],
            [8, 1, 1],
            [1, 2, 10],
            [8, 2, 1],
            [1, 9, 2],
        ],
        window: 4,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize every user average to a small positive value",
        "for each scheduling slot read each user achievable rate",
        "compute each user ratio as rate divided by average",
        "give the slot to the user with the largest ratio",
        "move the served user average toward its rate",
        "decay the averages of all unserved users",
        "record the serving user and the ratios for this slot",
        "done: report how many slots each user received",
    ],
};

export default module;
