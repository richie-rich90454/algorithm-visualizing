/**
 * petersons-algorithm.ts - Peterson's Algorithm (Two-Process Mutual Exclusion)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Peterson's algorithm lets two processes share a critical section using only
 * shared reads and writes. Each process raises its intent flag and writes its
 * own id into a shared "turn" variable; it then waits only while the other
 * process is also interested and it is this process's turn to yield. The two
 * checks together guarantee mutual exclusion and bounded waiting.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) shared operations per entry into the critical section
 *   Space: O(1) for two flags and one turn variable
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Five bars show flag[0], flag[1], turn, and the two in-critical-section bits.
 *   - A waiting process is yellow, a process in the critical section is green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Machine {
    flag: [boolean, boolean];
    turn: number;
    inCS: [boolean, boolean];
    pc: [number, number];
    entries: [number, number];
}

/** Build the shared-state bars for one step of the interleaving. */
function makeStateBars(machine: Machine, actor: number): VisualEntity[] {
    const values: Array<{ label: string; value: number; state: EntityState }> = [
        { label: `flag0=${machine.flag[0] ? 1 : 0}`, value: machine.flag[0] ? 1 : 0, state: "idle" },
        { label: `flag1=${machine.flag[1] ? 1 : 0}`, value: machine.flag[1] ? 1 : 0, state: "idle" },
        { label: `turn=${machine.turn}`, value: machine.turn, state: "comparing" },
        { label: `cs0=${machine.inCS[0] ? 1 : 0}`, value: machine.inCS[0] ? 1 : 0, state: machine.inCS[0] ? "sorted" : "idle" },
        { label: `cs1=${machine.inCS[1] ? 1 : 0}`, value: machine.inCS[1] ? 1 : 0, state: machine.inCS[1] ? "sorted" : "idle" },
    ];
    return values.map((item, index) => ({
        id: `state-${index}`,
        type: "bar" as const,
        label: item.label,
        value: item.value,
        state: item.state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, actor, pc0: machine.pc[0], pc1: machine.pc[1] },
    }));
}

/** The six atomic statements each process executes, in program order. */
type Action = "flag" | "turn" | "check" | "enter" | "exit";
const PROGRAM: Action[] = ["flag", "turn", "check", "enter", "exit"];

interface Step {
    process: number;
    action: Action;
}

/** Execute one atomic statement of a process, returning true if the pc advanced. */
function execute(machine: Machine, process: number): boolean {
    const action = PROGRAM[machine.pc[process]];
    if (action === undefined) {
        return false;
    }
    const other = 1 - process;
    if (action === "flag") {
        machine.flag[process] = true;
    } else if (action === "turn") {
        machine.turn = other;
    } else if (action === "check") {
        if (machine.flag[other] && machine.turn === other) {
            return false;
        }
    } else if (action === "enter") {
        machine.inCS[process] = true;
        machine.entries[process] += 1;
    } else if (action === "exit") {
        machine.inCS[process] = false;
        machine.flag[process] = false;
    }
    machine.pc[process] += 1;
    return true;
}

/** Replay a fixed, contended interleaving of Peterson's two programs. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { schedule?: Step[] } | null) ?? {};
    const schedule: Step[] = Array.isArray(task.schedule)
        ? task.schedule.map((s) => ({ process: s.process === 1 ? 1 : 0, action: s.action }))
        : [
              { process: 0, action: "flag" },
              { process: 1, action: "flag" },
              { process: 0, action: "turn" },
              { process: 1, action: "turn" },
              { process: 0, action: "check" },
              { process: 1, action: "check" },
              { process: 0, action: "enter" },
              { process: 0, action: "exit" },
              { process: 1, action: "check" },
              { process: 1, action: "enter" },
              { process: 1, action: "exit" },
          ];

    const machine: Machine = {
        flag: [false, false],
        turn: 0,
        inCS: [false, false],
        pc: [0, 0],
        entries: [0, 0],
    };

    yield {
        stepNumber: 0,
        entities: makeStateBars(machine, -1),
        edges: [],
        description: "Both processes start with lowered flags and empty critical sections.",
        codeLineNumber: 0,
        layout: "array",
        meta: { turn: machine.turn, entries: machine.entries.slice(), waiting: false, mutualExclusion: true },
    };

    let step = 1;
    for (const s of schedule) {
        const before = machine.pc[s.process];
        const advanced = execute(machine, s.process);
        const waiting = s.action === "check" && !advanced;
        const desc = waiting
            ? `Process ${s.process} waits: the other process is interested and it is the other's turn.`
            : `Process ${s.process} executes ${s.action} (program counter ${before} to ${machine.pc[s.process]}).`;
        yield {
            stepNumber: step,
            entities: makeStateBars(machine, s.process),
            edges: [],
            description: desc,
            codeLineNumber:
                s.action === "flag"
                    ? 1
                    : s.action === "turn"
                      ? 2
                      : s.action === "check"
                        ? 3
                        : s.action === "enter"
                          ? 4
                          : 5,
            layout: "array",
            meta: {
                turn: machine.turn,
                entries: machine.entries.slice(),
                waiting,
                mutualExclusion: !(machine.inCS[0] && machine.inCS[1]),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeStateBars(machine, -1),
        edges: [],
        description: `Both processes finished; each entered the critical section ${machine.entries[0]} and ${machine.entries[1]} time(s) with no overlap.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { turn: machine.turn, entries: machine.entries.slice(), waiting: false, mutualExclusion: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Each process raises a flag saying it wants to enter, then politely gives the other process the turn. It enters only when the other process is not interested or when it is not its turn to yield. The flag catches a one-sided claim, and the turn variable breaks the tie when both processes are interested at once.",
        invariants: [
            "A process inside the critical section has its own flag raised.",
            "When both flags are raised, only the process whose id differs from turn may proceed.",
            "At most one process is ever inside the critical section.",
        ],
        correctness:
            "Suppose both processes were in the critical section. The last one to write turn set it to the other process, yet to have passed its check it must have seen either a lowered other flag or its own id in turn. Since the first process is inside with its flag raised, the second could only pass if turn named the second process, contradicting that the first process passed after the last write. Hence mutual exclusion holds. The loser of the tie also waits only a bounded number of steps because the winner clears its flag before re-entering, giving bounded waiting.",
        complexityRationale:
            "Entering and leaving uses a constant number of shared reads and writes, so each critical-section visit is O(1) time. The only shared storage is two boolean flags and one turn variable, which is O(1) space.",
        uses: [
            "Teaching the foundations of mutual exclusion without hardware atomic instructions",
            "User-level locking when an atomic test-and-set is unavailable",
            "Reasoning about interleavings and safety properties in concurrency courses",
        ],
        references: [
            "Peterson, Myths About the Mutual Exclusion Problem, 1981",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter 6",
        ],
        workedExample:
            "Process 0 raises flag0 and sets turn to 1; process 1 raises flag1 and sets turn to 0. Process 0 checks and proceeds because turn is 0, while process 1 checks and waits because turn is 0 and flag0 is raised. After process 0 leaves and lowers flag0, process 1 checks again, enters, and then leaves.",
    },
    id: "petersons-algorithm",
    name: "Peterson's Algorithm",
    category: "parallel-distributed",
    complexity: { time: "O(1) per entry", space: "O(1)" },
    defaultInput: {},
    visualType: "array",
    run,
    pseudocode: [
        "initialize both flags false and turn to zero",
        "process i raises flag[i] to signal interest",
        "process i writes its own id into the shared turn variable",
        "process i waits while flag[other] is true and turn equals other",
        "process i enters the critical section and does its work",
        "process i lowers flag[i] when leaving the section",
        "done: both processes completed with no overlap",
    ],
};

export default module;
