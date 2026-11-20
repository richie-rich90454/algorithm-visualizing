/**
 * fetch-and-add.ts - Atomic Fetch-and-Add Counter
 *
 * Fetch-and-add is an atomic read-modify-write primitive. Each process supplies
 * an increment, receives the previous value of the shared counter, and leaves
 * the counter increased by that increment. Because the three substeps are
 * indivisible, concurrent callers receive distinct consecutive tickets and the
 * final counter equals the initial value plus the sum of all increments.
 *
 * Limits of the demo: a single shared integer counter, processes that perform
 * exactly one fetch-and-add each, increments of one, and a deterministic
 * enumeration of interleavings rather than real threads. No overflow, memory
 * model details, or hardware cache-coherence protocol is modeled.
 *
 * Time: O(n!) interleavings in the exhaustive teaching trace. Space: O(n).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Call {
    process: number;
    oldValue: number;
    newValue: number;
}

/** Execute one full interleaving of single fetch-and-add calls. */
export function executeInterleaving(order: number[], initial: number): Call[] {
    let counter = initial;
    return order.map((process) => {
        const oldValue = counter;
        counter += 1;
        return { process, oldValue, newValue: counter };
    });
}

/** Generate all permutations of the process identifiers. */
export function allOrders(n: number): number[][] {
    const result: number[][] = [];
    const visit = (prefix: number[], remaining: number[]) => {
        if (remaining.length === 0) {
            result.push(prefix);
            return;
        }
        for (let i = 0; i < remaining.length; i += 1) {
            const next = remaining[i] as number;
            visit([...prefix, next], remaining.filter((_, k) => k !== i));
        }
    };
    visit([], Array.from({ length: n }, (_, i) => i));
    return result;
}

/** Verify the linearizability invariants across every interleaving. */
export function fetchAddInvariants(n: number, initial: number): {
    interleavings: number;
    uniqueTickets: boolean;
    correctFinal: boolean;
    finalCounter: number;
} {
    const orders = allOrders(n);
    let uniqueTickets = true;
    let correctFinal = true;
    let finalCounter = initial;
    for (const order of orders) {
        const calls = executeInterleaving(order, initial);
        const tickets = calls.map((call) => call.oldValue);
        if (new Set(tickets).size !== n) {
            uniqueTickets = false;
        }
        finalCounter = calls[calls.length - 1]?.newValue ?? initial;
        if (finalCounter !== initial + n) {
            correctFinal = false;
        }
    }
    return { interleavings: orders.length, uniqueTickets, correctFinal, finalCounter };
}

function makeCells(calls: Call[], active: number, initial: number): VisualEntity[] {
    const cells: VisualEntity[] = [{
        id: "cell-counter",
        type: "cell" as const,
        label: `counter=${calls[active]?.newValue ?? initial}`,
        value: calls[active]?.newValue ?? initial,
        state: "pivot" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: -1, role: "counter" },
    }];
    for (let i = 0; i < calls.length; i += 1) {
        const call = calls[i] as Call;
        cells.push({
            id: `cell-${i}`,
            type: "cell" as const,
            label: `P${call.process} got ${call.oldValue}`,
            value: call.oldValue,
            state: i === active ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, process: call.process, ticket: call.oldValue },
        });
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { processes?: number; initial?: number } | null) ?? {};
    const processes = Math.min(5, Math.max(1, Math.floor(Number(task.processes ?? 3)) || 3));
    const initial = Math.floor(Number(task.initial ?? 10));
    const orders = allOrders(processes);
    const invariants = fetchAddInvariants(processes, initial);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells([], -1, initial),
        edges: [],
        description: `Examine all ${orders.length} interleavings of ${processes} fetch-and-add calls from ${initial}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { processes, initial, ...invariants },
    };
    step += 1;

    for (let i = 0; i < orders.length; i += 1) {
        const order = orders[i] as number[];
        const calls = executeInterleaving(order, initial);
        yield {
            stepNumber: step,
            entities: makeCells(calls, i === orders.length - 1 ? calls.length - 1 : -1, initial),
            edges: [],
            description: `Interleaving ${i + 1}: order ${order.join(",")} issues tickets ${calls.map((call) => call.oldValue).join(",")}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                processes, initial, order,
                calls: calls.map((call) => ({ ...call })),
                tickets: calls.map((call) => call.oldValue),
                finalCounter: calls[calls.length - 1]?.newValue ?? initial,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(executeInterleaving(orders[0] as number[], initial), -1, initial),
        edges: [],
        description: `Every interleaving gives ${invariants.uniqueTickets ? "distinct" : "repeated"} tickets and final counter ${invariants.finalCounter}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            processes, initial,
            ...invariants,
            correct: invariants.uniqueTickets && invariants.correctFinal,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Fetch-and-add fuses a read and a write into one indivisible operation. Several processes can ask for a ticket at the same time and the hardware orders them in some sequence, but each one sees a different previous value. That makes it a simple way to hand out unique identifiers or build a shared counter without a lock.",
        invariants: [
            "The operation returns the counter value immediately before its own increment.",
            "No two successful calls can return the same value when increments are positive.",
            "The final counter equals the initial value plus the sum of all increments.",
        ],
        correctness:
            "Atomicity means each call's read and write happen as a single indivisible event, so any execution is equivalent to some serial order of the calls. In that serial order the returned values are the initial counter plus the running sum of earlier increments, which are strictly increasing for positive increments and therefore distinct. The final value accumulates every increment. The teaching simulation enumerates every serial order and checks both properties.",
        complexityRationale:
            "A single fetch-and-add is constant time and constant space. The exhaustive teaching trace enumerates all n factorial interleavings to demonstrate the invariant, which is only practical for the small process counts used here.",
        uses: [
            "Handing out unique task or request identifiers",
            "Implementing lock-free counters and ticket locks",
            "Aggregating statistics in concurrent programs",
        ],
        references: [
            "Herlihy and Shavit, The Art of Multiprocessor Programming, 2012",
            "Mellor-Crummey and Scott, Algorithms for Scalable Synchronization, 1991",
        ],
        workedExample:
            "Starting from ten with three processes, an interleaving 0, 1, 2 returns tickets 10, 11 and 12, while 2, 0, 1 returns 10, 11 and 12 to a different process order. In every case the counter ends at thirteen and all three tickets are distinct.",
    },
    id: "fetch-and-add",
    name: "Fetch-and-Add",
    category: "parallel-distributed",
    complexity: { time: "O(1) per call", space: "O(1)" },
    defaultInput: { processes: 3, initial: 10 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the process count and initial counter value",
        "enumerate every ordering of the process calls",
        "for each call read the current counter value",
        "increase the counter by one atomically",
        "return the old value as the process ticket",
        "collect all tickets from the interleaving",
        "check uniqueness and the final counter value",
        "done: report the invariants over all interleavings",
    ],
};

export default module;
