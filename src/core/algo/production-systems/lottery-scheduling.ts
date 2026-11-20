/**
 * lottery-scheduling.ts - Lottery Scheduling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lottery scheduling gives each runnable process a number of tickets. On every
 * decision one ticket is drawn uniformly at random, and the process holding it
 * runs for a single quantum. A process with twice the tickets wins about twice
 * as often, so the expected CPU share is proportional to ticket share. A
 * deterministic pseudo-random generator makes the replay reproducible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * p) for T quanta and p processes (linear scan of ticket spans)
 *   Space: O(p) for process state and the win log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per process shows its remaining burst and ticket count.
 *   - The winning process is CYAN, finished ones GREEN.
 *   - meta carries the ticket spans, the win log, and per-process win counts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Proc {
    id: string;
    tickets: number;
    burst: number;
}

function normalize(input: unknown): Proc[] {
    const task = (input as { processes?: Array<{ id?: string; tickets?: number; burst?: number }> } | null) ?? {};
    const specs = Array.isArray(task.processes) && task.processes.length > 0
        ? task.processes
        : [
              { id: "P1", tickets: 4, burst: 5 },
              { id: "P2", tickets: 2, burst: 3 },
              { id: "P3", tickets: 1, burst: 2 },
          ];
    return specs.map((spec, index) => ({
        id: String(spec.id ?? `P${index + 1}`),
        tickets: Math.max(1, Math.floor(Number(spec.tickets) || 1)),
        burst: Math.max(0, Math.floor(Number(spec.burst) || 0)),
    }));
}

function makeCells(procs: Proc[], remaining: number[], running: number): VisualEntity[] {
    return procs.map((proc, index) => {
        const left = remaining[index] ?? 0;
        let state: EntityState = "idle";
        if (left === 0) {
            state = "sorted";
        } else if (index === running) {
            state = "active";
        }
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${proc.id} (${proc.tickets}): ${left}`,
            value: left,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, id: proc.id, tickets: proc.tickets, remaining: left },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { seed?: number } | null) ?? {};
    const procs = normalize(input);
    const remaining = procs.map((proc) => proc.burst);
    const seed = Math.floor(Number(task.seed) || 7) >>> 0 || 1;
    let rng = seed;
    const wins = procs.map(() => 0);
    const winLog: string[] = [];
    const spanStarts: number[] = [];
    let cursor = 1;
    for (const proc of procs) {
        spanStarts.push(cursor);
        cursor += proc.tickets;
    }

    yield {
        stepNumber: 0,
        entities: makeCells(procs, remaining, -1),
        edges: [],
        description: `Lottery scheduling over ${procs.length} process(es) with ${cursor - 1} total ticket(s), using seed ${seed}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: procs.length,
            seed,
            totalTickets: cursor - 1,
            spans: spanStarts,
            tickets: procs.map((proc) => proc.tickets),
            wins,
            winLog,
        },
    };
    let step = 1;

    const maxQuanta = remaining.reduce((sum, value) => sum + value, 0);
    for (let tick = 0; tick < maxQuanta; tick += 1) {
        let total = 0;
        for (let i = 0; i < procs.length; i += 1) {
            if ((remaining[i] ?? 0) > 0) {
                total += procs[i]?.tickets ?? 0;
            }
        }
        if (total <= 0) {
            break;
        }
        rng = (Math.imul(1103515245, rng) + 12345) >>> 1;
        const ticket = (rng % total) + 1;
        let winner = -1;
        let lower = 1;
        for (let i = 0; i < procs.length; i += 1) {
            const tickets = procs[i]?.tickets ?? 0;
            if ((remaining[i] ?? 0) <= 0) {
                continue;
            }
            if (ticket >= lower && ticket < lower + tickets) {
                winner = i;
                break;
            }
            lower += tickets;
        }
        if (winner < 0) {
            break;
        }
        remaining[winner] = (remaining[winner] ?? 0) - 1;
        wins[winner] = (wins[winner] ?? 0) + 1;
        winLog.push(procs[winner]?.id ?? `P${winner}`);
        yield {
            stepNumber: step,
            entities: makeCells(procs, remaining, winner),
            edges: [],
            description: `Quantum ${tick + 1}: winning ticket ${ticket} belongs to ${procs[winner]?.id}; ${remaining[winner]} unit(s) left.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: 1,
                cols: procs.length,
                seed,
                totalTickets: total,
                spans: spanStarts,
                tickets: procs.map((proc) => proc.tickets),
                wins: [...wins],
                winLog: [...winLog],
                ticket,
                winner,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(procs, remaining, -1),
        edges: [],
        description: `Finished after ${winLog.length} quantum(q); win counts ${wins.join(", ")} track ticket shares.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: 1,
            cols: procs.length,
            seed,
            totalTickets: cursor - 1,
            spans: spanStarts,
            tickets: procs.map((proc) => proc.tickets),
            wins,
            winLog,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine every process owns a handful of raffle tickets and the scheduler draws one ticket at random for each slice of CPU time. More tickets mean more chances to win, so a process that needs more service can simply be given more tickets. Finished processes leave the raffle, and a fixed seed makes the whole sequence reproducible for study.",
        invariants: [
            "Each runnable process owns a contiguous, non-overlapping interval of ticket numbers.",
            "Every draw selects exactly one runnable process and consumes one unit of its remaining burst.",
            "A process leaves the ticket pool as soon as its remaining burst reaches zero.",
        ],
        correctness:
            "The ticket intervals are laid out end to end from one to the total, so every integer ticket belongs to exactly one runnable process and the interval scan finds the unique owner. Each quantum decrements only the winner, so the schedule terminates after exactly the sum of all bursts. The companion test reproduces the same linear-congruential draws and interval scan independently and compares the full win log and counts, and it checks that win frequencies track ticket proportions over a long run.",
        complexityRationale:
            "Drawing a ticket is constant time, but locating its owner scans up to p ticket intervals, so each quantum costs O(p) and the full run costs O(T * p) for T quanta. Only per-process counters and the win log are stored, giving O(p) space.",
        uses: [
            "Proportional-share CPU and network schedulers",
            "Weighted selection where a lottery stands in for expensive fair queuing",
            "A teaching model for randomized resource allocation",
        ],
        references: [
            "Waldspurger and Weihl, Lottery Scheduling: Flexible Proportional-Share Resource Management, 1994",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, CPU Scheduling chapter",
        ],
        workedExample:
            "With P1 holding 4 tickets, P2 holding 2, and P3 holding 1, the ticket spans are 1-4, 5-6, and 7. A draw of ticket 3 runs P1, a draw of 5 runs P2, and a draw of 7 runs P3, so over many draws P1 wins roughly four times as often as P3.",
    },
    id: "lottery-scheduling",
    name: "Lottery Scheduling",
    category: "production-systems",
    complexity: { time: "O(T * p)", space: "O(p)" },
    defaultInput: {
        processes: [
            { id: "P1", tickets: 4, burst: 5 },
            { id: "P2", tickets: 2, burst: 3 },
            { id: "P3", tickets: 1, burst: 2 },
        ],
        seed: 7,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "give each runnable process a number of lottery tickets",
        "sum the tickets held by all runnable processes",
        "draw a winning ticket uniformly from one to the total",
        "find the process whose ticket interval contains the winning ticket",
        "run that process for one quantum and decrement its remaining burst",
        "remove a process from the pool when its burst reaches zero",
        "repeat until every process has finished",
        "done: report the run sequence and each process's share of wins",
    ],
};

export default module;
