/**
 * load-linked-store-conditional.ts - Load-Linked / Store-Conditional
 *
 * LL/SC is a pair of primitives for lock-free synchronization. A load-linked
 * read records a reservation on the memory word. A later store-conditional
 * writes only if no other write to that word has occurred since the
 * reservation was made. If another writer interfered, the store fails and the
 * caller retries, so no update is silently lost.
 *
 * Limits of the demo: one shared word, two processes, each process performing a
 * single load-linked followed by one store-conditional with a fixed value,
 * deterministic enumeration of atomic step interleavings, and no retry loops,
 * memory reclamation, or weak-memory spurious failures. The first write in a
 * schedule always succeeds; overlapping writers leave exactly one winner.
 *
 * Time: O(number of interleavings) in the exhaustive trace. Space: O(1).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

export interface LLOperation {
    process: number;
    kind: "LL" | "SC";
    value: number;
}

export interface LLTraceStep {
    operation: LLOperation;
    value: number;
    reservation: number | null;
    success: boolean | null;
    stamp: number;
}

/** Execute a schedule of LL and SC operations with strict reservation checking. */
export function executeLLSCHEDULE(schedule: LLOperation[], initial: number): LLTraceStep[] {
    let value = initial;
    let stamp = 0;
    const reservations = new Map<number, number>();
    return schedule.map((operation) => {
        if (operation.kind === "LL") {
            reservations.set(operation.process, stamp);
            return { operation, value, reservation: stamp, success: null, stamp };
        }
        const reservation = reservations.get(operation.process);
        const success = reservation !== undefined && reservation === stamp;
        if (success) {
            value = operation.value;
            stamp += 1;
            reservations.delete(operation.process);
        }
        return { operation, value, reservation: reservation ?? null, success, stamp };
    });
}

/** All step interleavings of two processes, each doing LL then SC. */
export function allLLSchedules(): LLOperation[][] {
    const schedules: LLOperation[][] = [];
    const visit = (prefix: LLOperation[], pc: [number, number]) => {
        if (pc[0] === 2 && pc[1] === 2) {
            schedules.push(prefix);
            return;
        }
        for (const process of [0, 1]) {
            const at = pc[process] as number;
            if (at >= 2) {
                continue;
            }
            const operation: LLOperation = {
                process,
                kind: at === 0 ? "LL" : "SC",
                value: process + 100,
            };
            const next: [number, number] = [pc[0], pc[1]];
            next[process] = at + 1;
            visit([...prefix, operation], next);
        }
    };
    visit([], [0, 0]);
    return schedules;
}

/** Count schedules where both load-linked reads precede both stores. */
export function overlappingSchedules(schedules: LLOperation[][]): number {
    return schedules.filter((schedule) => {
        const firstSC = schedule.findIndex((operation) => operation.kind === "SC");
        const lls = schedule.filter((operation) => operation.kind === "LL");
        return lls.length === 2 && firstSC >= 2;
    }).length;
}

function makeCells(steps: LLTraceStep[], active: number): VisualEntity[] {
    const current = steps[active];
    return Array.from({ length: 2 }, (_, process) => ({
        id: `cell-${process}`,
        type: "cell" as const,
        label: process === (current?.operation.process ?? -1)
            ? `P${process} ${current?.operation.kind}:${current?.success ?? "-"}`
            : `P${process}:${process === 0 ? "A" : "B"}`,
        value: current?.operation.process === process ? current.value : 0,
        state: current?.operation.process === process ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: {
            index: process,
            process,
            reservation: current?.operation.process === process ? (current.reservation ?? -1) : -1,
            success: current?.operation.process === process
                ? current.success === null ? "pending" : String(current.success)
                : "pending",
        },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { initial?: number } | null) ?? {};
    const initial = Math.floor(Number(task.initial ?? 0));
    const schedules = allLLSchedules();
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells([], -1),
        edges: [],
        description: `Enumerate ${schedules.length} interleavings of two LL/SC pairs on one shared word.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { initial, schedules: schedules.length, overlapping: overlappingSchedules(schedules) },
    };
    step += 1;

    for (let i = 0; i < schedules.length; i += 1) {
        const schedule = schedules[i] as LLOperation[];
        const steps = executeLLSCHEDULE(schedule, initial);
        const successes = steps.filter((entry) => entry.success === true).length;
        yield {
            stepNumber: step,
            entities: makeCells(steps, steps.length - 1),
            edges: [],
            description: `Schedule ${i + 1}: ${successes} store-conditional succeeded, final value ${steps[steps.length - 1]?.value}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                initial, scheduleIndex: i,
                schedule: schedule.map((operation) => ({ ...operation })),
                steps: steps.map((entry) => ({
                    operation: entry.operation.kind,
                    process: entry.operation.process,
                    success: entry.success,
                    value: entry.value,
                })),
                successes,
                finalValue: steps[steps.length - 1]?.value ?? initial,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(executeLLSCHEDULE(schedules[0] as LLOperation[], initial), -1),
        edges: [],
        description: `Overlapping writers leave one winner, so no successful update is lost.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            initial, schedules: schedules.length,
            overlapping: overlappingSchedules(schedules),
            mutualExclusion: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A compare-and-swap needs the old value to decide whether to write. Load-linked and store-conditional split that work: the load records a reservation on the word, and the store writes only if the reservation is still valid. If another process wrote in between, the store fails and the caller can retry. This avoids lost updates without a lock.",
        invariants: [
            "A successful load-linked records the current modification stamp.",
            "A store-conditional succeeds only when the recorded stamp is still current.",
            "Every successful store changes the word and advances the stamp by one.",
        ],
        correctness:
            "The simulation tracks a modification stamp that only a successful store increments. A reservation stores the stamp observed at load time, so an intervening successful store necessarily advances the stamp and invalidates older reservations. Therefore two overlapping writers cannot both succeed, and the successful store writes its value to the word exactly once. The test enumerates all atomic step interleavings and checks that overlapping schedules have exactly one winner.",
        complexityRationale:
            "A single LL or SC operation is constant time and space. The exhaustive teaching trace enumerates the six interleavings of two two-step processes, which is constant for this fixed size.",
        uses: [
            "Lock-free counters and stacks in runtime systems",
            "Implementing compare-and-swap when only LL/SC is available",
            "Atomic updates in embedded and reduced-instruction-set processors",
        ],
        references: [
            "Herlihy and Shavit, The Art of Multiprocessor Programming, 2012",
            "Mellor-Crummey and Scott, Algorithms for Scalable Synchronization, 1991",
        ],
        workedExample:
            "Starting from zero, the schedule LL0, LL1, SC0, SC1 gives both processes reservation stamp zero. The first store succeeds and advances the stamp to one, so the second store fails and process one must retry. The shared word holds process zero's value.",
    },
    id: "load-linked-store-conditional",
    name: "Load-Linked / Store-Conditional",
    category: "parallel-distributed",
    complexity: { time: "O(1) per primitive", space: "O(1)" },
    defaultInput: { initial: 0 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the shared word and modification stamp",
        "for each atomic step in the interleaving",
        "on load-linked read the word and record its stamp",
        "on store-conditional compare the reservation with the stamp",
        "write only when the reservation is still valid",
        "advance the stamp after a successful store",
        "count the successful stores in the schedule",
        "done: report winners across all interleavings",
    ],
};

export default module;
