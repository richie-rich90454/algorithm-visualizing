/**
 * dekker-algorithm.ts - Dekker's Two-Process Mutual Exclusion Algorithm
 *
 * Dekker's algorithm is the classic software solution to mutual exclusion for
 * two processes sharing memory. Each process raises an intention flag, yields
 * politely by lowering and re-raising the flag when both are interested, and
 * uses a shared turn variable to break ties. The result is mutual exclusion,
 * progress, and bounded waiting without any hardware atomic instruction beyond
 * ordinary reads and writes.
 *
 * Limits of the demo: exactly two processes, atomic reads and writes of single
 * flags and the turn variable, sequential consistency with no compiler or
 * hardware reordering, one critical-section entry per process, and exhaustive
 * breadth-first exploration of the finite state space rather than real threads.
 *
 * Time: O(number of reachable states) for the verification. Space: O(states).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

export interface DekkerState {
    pc: [number, number];
    flag: [boolean, boolean];
    turn: number;
    actor: number;
}

function key(state: DekkerState): string {
    return `${state.pc[0]},${state.pc[1]},${state.flag[0] ? 1 : 0}${state.flag[1] ? 1 : 0},${state.turn}`;
}

/** Apply one atomic step of process i, returning the new program counters and flags. */
export function dekkerStep(state: DekkerState, i: number): { pc: [number, number]; flag: [boolean, boolean]; turn: number } {
    const other = 1 - i;
    const pc: [number, number] = [state.pc[0], state.pc[1]];
    const flag: [boolean, boolean] = [state.flag[0], state.flag[1]];
    let turn = state.turn;
    const at = pc[i] as number;
    if (at === 0) {
        flag[i] = true;
        pc[i] = 1;
    } else if (at === 1) {
        if (!flag[other]) {
            pc[i] = 5;
        } else if (turn === other) {
            pc[i] = 2;
        }
    } else if (at === 2) {
        flag[i] = false;
        pc[i] = 3;
    } else if (at === 3) {
        if (turn !== other) {
            pc[i] = 4;
        }
    } else if (at === 4) {
        flag[i] = true;
        pc[i] = 1;
    } else if (at === 5) {
        turn = other;
        flag[i] = false;
        pc[i] = 6;
    }
    return { pc, flag, turn };
}

/** Explore every reachable global state and check the safety property. */
export function dekkerExplore(): {
    states: number;
    bothInCritical: number;
    mutualExclusion: boolean;
    terminalReached: boolean;
} {
    const initial: DekkerState = { pc: [0, 0], flag: [false, false], turn: 0, actor: -1 };
    const seen = new Set<string>([key(initial)]);
    const queue: DekkerState[] = [initial];
    let bothInCritical = 0;
    let terminalReached = false;
    while (queue.length > 0) {
        const state = queue.shift() as DekkerState;
        if (state.pc[0] === 5 && state.pc[1] === 5) {
            bothInCritical += 1;
        }
        if (state.pc[0] === 6 && state.pc[1] === 6) {
            terminalReached = true;
        }
        for (const actor of [0, 1]) {
            const next = dekkerStep(state, actor);
            const candidate: DekkerState = { ...next, actor };
            const identifier = key(candidate);
            if (!seen.has(identifier)) {
                seen.add(identifier);
                queue.push(candidate);
            }
        }
    }
    return {
        states: seen.size,
        bothInCritical,
        mutualExclusion: bothInCritical === 0,
        terminalReached,
    };
}

/** A concrete fair schedule that walks both processes to completion. */
export function dekkerSchedule(): DekkerState[] {
    let state: DekkerState = { pc: [0, 0], flag: [false, false], turn: 0, actor: -1 };
    const trace: DekkerState[] = [state];
    let guard = 0;
    while (!(state.pc[0] === 6 && state.pc[1] === 6) && guard < 200) {
        guard += 1;
        const actor = guard % 2;
        const next = dekkerStep(state, actor);
        state = { ...next, actor };
        trace.push(state);
    }
    return trace;
}

function makeCells(state: DekkerState): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < 2; i += 1) {
        cells.push({
            id: `cell-flag-${i}`,
            type: "cell" as const,
            label: `flag${i}=${state.flag[i] ? "T" : "F"}`,
            value: state.flag[i] ? 1 : 0,
            state: state.flag[i] ? "active" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, role: "flag", value: state.flag[i] },
        });
        cells.push({
            id: `cell-pc-${i}`,
            type: "cell" as const,
            label: `P${i} pc=${state.pc[i]}`,
            value: state.pc[i] as number,
            state: state.pc[i] === 5 ? "path" : state.actor === i ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, role: "pc", value: state.pc[i] },
        });
    }
    cells.push({
        id: "cell-turn",
        type: "cell" as const,
        label: `turn=${state.turn}`,
        value: state.turn,
        state: "pivot" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: 0, role: "turn", value: state.turn },
    });
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    void input;
    const result = dekkerExplore();
    const schedule = dekkerSchedule();
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(schedule[0] as DekkerState),
        edges: [],
        description: `Verify Dekker's algorithm over all reachable states of two contending processes.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...result, scheduleLength: schedule.length },
    };
    step += 1;

    for (let i = 1; i < schedule.length; i += 1) {
        const state = schedule[i] as DekkerState;
        yield {
            stepNumber: step,
            entities: makeCells(state),
            edges: [],
            description: `Step ${i}: process ${state.actor} moves to pc ${state.pc[state.actor] as number}; flags ${state.flag[0] ? 1 : 0}${state.flag[1] ? 1 : 0}, turn ${state.turn}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { ...result, stepIndex: i, state: { ...state, pc: [...state.pc], flag: [...state.flag] } },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(schedule[schedule.length - 1] as DekkerState),
        edges: [],
        description: `No reachable state has both processes in the critical section; ${result.states} states explored.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            ...result,
            scheduleLength: schedule.length,
            correct: result.mutualExclusion && result.terminalReached,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Dekker's algorithm solves mutual exclusion with nothing but shared flags and a turn variable. A process raises its flag to announce interest. If both are interested, the turn variable says who should back off, and the loser lowers its flag briefly so the other can proceed. The polite yielding prevents both deadlock and starvation while guaranteeing that only one process enters at a time.",
        invariants: [
            "A process enters the critical section only when the other's flag is lowered.",
            "When both flags are raised, the turn variable grants priority to exactly one process.",
            "A process always lowers its flag before leaving the critical section.",
        ],
        correctness:
            "Mutual exclusion holds because a process can enter only after observing the other flag false, and a process keeps its flag true throughout its critical section. The flag-lowering step ensures that if both processes are interested, at least one makes progress: the process favored by turn can observe the lowered flag and enter. Because turn alternates on every exit, each process is favored infinitely often, giving bounded waiting. Exhaustive breadth-first exploration confirms that no reachable state places both processes in the critical section and that a terminal state is reachable.",
        complexityRationale:
            "The finite state space has a constant number of program counters, flags and turn values, so verification is O(states) time and space, independent of the number of schedule steps. Each individual protocol step is constant work.",
        uses: [
            "Foundational example in operating-system synchronization courses",
            "Historical software lock before atomic instructions were common",
            "Model-checking benchmark for mutual exclusion protocols",
        ],
        references: [
            "Dijkstra, Cooperating Sequential Processes, 1965",
            "Herlihy and Shavit, The Art of Multiprocessor Programming, 2012",
        ],
        workedExample:
            "If both processes raise their flags and turn favors process zero, process one lowers its flag and waits. Process zero sees the lowered flag and enters, then sets turn to one and lowers its flag on exit. Process one now re-raises its flag, sees process zero's flag low, and enters, so no state ever has both inside.",
    },
    id: "dekker-algorithm",
    name: "Dekker's Algorithm",
    category: "parallel-distributed",
    complexity: { time: "O(reachable states)", space: "O(reachable states)" },
    defaultInput: {},
    visualType: "grid",
    run,
    pseudocode: [
        "initialize both flags to false and turn to zero",
        "each process raises its own intention flag",
        "if the other flag is down enter the critical section",
        "otherwise yield to the process favored by turn",
        "lower the flag briefly then re-raise it after the turn changes",
        "on exit set turn to the other process and lower the flag",
        "explore all reachable states for mutual exclusion",
        "done: report safety and termination of the protocol",
    ],
};

export default module;
