/**
 * generic-cell-rate-algorithm.ts - GCRA (Virtual Scheduling)
 *
 * The Generic Cell Rate Algorithm enforces a traffic contract with an arrival
 * interval T = 1/rate and a burst tolerance tau. Its virtual-scheduling form
 * keeps a theoretical arrival time (TAT). A cell is conforming when it arrives
 * no earlier than TAT minus tau; a conforming cell pushes TAT forward by T
 * from the later of the actual and theoretical arrival times.
 *
 * Time O(n) for n cells, space O(n) for the recorded decisions.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GcraInput {
    arrivals?: number[];
    rate?: number;
    tolerance?: number;
}

export interface GcraStep {
    arrival: number;
    tatBefore: number;
    tatAfter: number;
    conforming: boolean;
}

/** Run GCRA virtual scheduling over a sequence of arrival times. */
export function gcraSchedule(arrivals: number[], interval: number, tolerance: number): GcraStep[] {
    let tat = 0;
    return arrivals.map((arrival) => {
        const tatBefore = tat;
        const conforming = arrival >= tat - tolerance;
        if (conforming) {
            tat = Math.max(tat, arrival) + interval;
        }
        return { arrival, tatBefore, tatAfter: tat, conforming };
    });
}

const COLUMNS = ["arrival", "TAT before", "TAT after", "decision"];

function makeCells(steps: GcraStep[], revealed: number, active: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    steps.forEach((step, row) => {
        const values = [step.arrival, step.tatBefore, step.tatAfter, step.conforming ? "conforming" : "early"];
        COLUMNS.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === active
                ? "comparing"
                : shown ? (step.conforming ? "sorted" : "error") : "idle";
            const value = values[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? `${column} ${typeof value === "string" ? value : value.toFixed(2)}` : "?",
                value: shown ? value : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GcraInput | null) ?? {};
    const arrivals: number[] = Array.isArray(task.arrivals) && task.arrivals.length > 0
        ? task.arrivals
        : [0, 1, 2, 2.4, 3, 4, 4.2, 5, 6];
    const rate = Math.max(1e-6, Number(task.rate ?? 1));
    const interval = 1 / rate;
    const tolerance = Math.max(0, Number(task.tolerance ?? 0.5));
    const steps = gcraSchedule(arrivals, interval, tolerance);
    const conforming = steps.filter((s) => s.conforming).length;
    const base = { rows: steps.length, cols: COLUMNS.length, interval, tolerance, rate, conforming };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(steps, -1, -1),
        edges: [],
        description: `GCRA with interval ${interval.toFixed(3)} and tolerance ${tolerance.toFixed(3)} checks ${steps.length} cell arrival(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, decisions: steps.map((s) => (s.conforming ? 1 : 0)), tatAfter: steps.map((s) => s.tatAfter) },
    };
    step += 1;

    for (let i = 0; i < steps.length; i += 1) {
        const s = steps[i]!;
        yield {
            stepNumber: step,
            entities: makeCells(steps, i, i),
            edges: [],
            description: `Cell ${i} at ${s.arrival.toFixed(2)}: TAT ${s.tatBefore.toFixed(2)}, ${s.conforming ? "conforming, TAT becomes " + s.tatAfter.toFixed(2) : "early arrival, discarded"}.`,
            codeLineNumber: s.conforming ? 3 : 2,
            layout: "grid",
            meta: { ...base, active: i, decisions: steps.map((x) => (x.conforming ? 1 : 0)), tatAfter: steps.map((x) => x.tatAfter) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(steps, steps.length - 1, -1),
        edges: [],
        description: `Done: ${conforming} of ${steps.length} cell(s) conformed to the rate and burst tolerance.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...base, done: true, decisions: steps.map((s) => (s.conforming ? 1 : 0)), tatAfter: steps.map((s) => s.tatAfter) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A network link promises a maximum rate and a small allowed burst. GCRA imagines an ideal schedule in which cells arrive exactly one interval apart and keeps the theoretical arrival time of the last conforming cell. If a cell arrives too early relative to that schedule, it violates the contract and is discarded; otherwise the schedule advances. The tolerance decides how much early arrival is excused as a burst.",
        invariants: [
            "The arrival interval T equals one over the configured rate.",
            "A conforming cell leaves the theoretical arrival time at least as large as the actual arrival time plus T.",
            "A discarded cell never changes the theoretical arrival time.",
        ],
        correctness:
            "The admission test arrival >= TAT minus tau is exactly the virtual-scheduling condition from the ATM forum: a cell is early only when it precedes the ideal schedule by more than the tolerance. Advancing TAT to max(TAT, arrival) plus T makes the next ideal slot one interval after whichever is later, so a burst of up to tau early cells is absorbed without increasing the long-term rate. The tests recompute the schedule independently, check that discarded cells freeze TAT, and verify that with zero tolerance two cells closer than one interval cannot both conform.",
        complexityRationale:
            "Each cell needs constant work to test admission and update the theoretical arrival time, so n cells cost O(n) time and the decision arrays use O(n) space.",
        uses: [
            "ATM and frame-relay traffic contract enforcement",
            "Token-bucket rate limiting in routers and switches",
            "Leaky-bucket traffic shaping and policing",
        ],
        references: [
            "ITU-T Recommendation I.371, Traffic Control and Congestion Control in B-ISDN",
            "McDysan and Spohn, ATM Theory and Application, Chapter 10",
        ],
        workedExample:
            "With rate one cell per second and tolerance 0.5, cells at times 0 and 0.5 both conform because the second is exactly at TAT minus tau. Its TAT advances to 2. A cell at time 1 would be early, since 1 is less than 2 minus 0.5, so it is discarded and TAT stays at 2.",
    },
    id: "generic-cell-rate-algorithm",
    name: "Generic Cell Rate Algorithm (GCRA)",
    category: "production-systems",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { arrivals: [0, 1, 2, 2.4, 3, 4, 4.2, 5, 6], rate: 1, tolerance: 0.5 },
    visualType: "grid",
    run,
    pseudocode: [
        "set the cell interval to one over the committed rate",
        "initialize the theoretical arrival time to zero",
        "for each arriving cell at time t",
        "if t is earlier than the theoretical arrival time minus tolerance, discard it",
        "otherwise advance the theoretical arrival time to the later of t and itself plus one interval",
        "record whether the cell conformed and the new theoretical arrival time",
        "done: report the total conforming cells",
    ],
};

export default module;
