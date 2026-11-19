/**
 * time-warp-protocol.ts - Time Warp Optimistic Synchronization
 *
 * Logical processes simulate events in local timestamp order but may receive a
 * straggler, an event older than their current simulated time. Time Warp rolls
 * the process back, cancels the events it sent after that point with antimessages,
 * and replays the still-pending events in timestamp order until the state again
 * reflects every delivered event.
 *
 * Time:  O(k log k) per straggler for k pending events, amortized over arrivals
 * Space: O(total events) for histories and pending queues
 *
 * Visualization: bars show each logical process's accumulated state; a rollback
 * frame marks the affected process red and reports the antimessages sent.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type SimEvent = { id: string; time: number; lp: number; value: number };

/** Independent reference: sum every event per process in timestamp order. */
export function sequentialReference(events: SimEvent[], lps: number): number[] {
    const state = new Array<number>(lps).fill(0);
    const sorted = events.slice().sort((a, b) => a.lp - b.lp || a.time - b.time || a.id.localeCompare(b.id));
    for (const e of sorted) {
        if (e.lp >= 0 && e.lp < lps) state[e.lp] = (state[e.lp] as number) + e.value;
    }
    return state;
}

/** Build one bar per logical process. */
function makeBars(states: number[], times: number[], highlight: number | null, rolledBack: boolean): VisualEntity[] {
    return states.map((value, i) => ({
        id: `lp-${i}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: (i === highlight ? (rolledBack ? "error" : "comparing") : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { lp: i, localTime: times[i] ?? 0 },
    }));
}

/** The Time Warp generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { lps?: number; events?: SimEvent[] } | null) ?? {};
    const lps = typeof task.lps === "number" && task.lps > 0 ? Math.floor(task.lps) : 2;
    const events: SimEvent[] = Array.isArray(task.events)
        ? task.events.filter((e) => e && typeof e.time === "number").map((e, i) => ({
            id: typeof e.id === "string" ? e.id : `e${i}`,
            time: Number(e.time),
            lp: Math.max(0, Math.min(lps - 1, Number(e.lp) || 0)),
            value: Number(e.value) || 0,
        }))
        : [
            { id: "e0", time: 10, lp: 0, value: 1 },
            { id: "e1", time: 20, lp: 0, value: 2 },
            { id: "e2", time: 5, lp: 0, value: 4 },
            { id: "e3", time: 15, lp: 1, value: 3 },
            { id: "e4", time: 12, lp: 1, value: 5 },
        ];

    const state = new Array<number>(lps).fill(0);
    const localTime = new Array<number>(lps).fill(0);
    const history: SimEvent[][] = Array.from({ length: lps }, () => []);
    const pending: SimEvent[][] = Array.from({ length: lps }, () => []);
    let rollbacks = 0;
    let antimessages = 0;
    let step = 0;

    const drain = (p: number): void => {
        const queue = pending[p] as SimEvent[];
        queue.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
        while (queue.length > 0) {
            const e = queue.shift() as SimEvent;
            (history[p] as SimEvent[]).push(e);
            state[p] = (state[p] as number) + e.value;
            localTime[p] = e.time;
        }
    };

    yield {
        stepNumber: step,
        entities: makeBars(state, localTime, null, false),
        edges: [],
        description: `${lps} logical process(es) start at virtual time 0 with empty event histories.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "init", lps, states: [...state], localTimes: [...localTime], rollbacks: 0, antimessages: 0 },
    };
    step += 1;

    for (const event of events) {
        const p = event.lp;
        let rolledBack = false;
        if (event.time < (localTime[p] as number)) {
            const removed = (history[p] as SimEvent[]).filter((e) => e.time >= event.time);
            const kept = (history[p] as SimEvent[]).filter((e) => e.time < event.time);
            for (const rolled of removed) (pending[p] as SimEvent[]).push(rolled);
            history[p] = kept;
            let sum = 0;
            for (const e of kept) sum += e.value;
            state[p] = sum;
            localTime[p] = kept.length > 0 ? (kept[kept.length - 1] as SimEvent).time : 0;
            rollbacks += 1;
            antimessages += removed.length;
            rolledBack = true;
        }
        (pending[p] as SimEvent[]).push(event);
        drain(p);
        yield {
            stepNumber: step,
            entities: makeBars(state, localTime, p, rolledBack),
            edges: [],
            description: rolledBack
                ? `Straggler ${event.id} at time ${event.time} reached LP${p} (now ${localTime[p]}); rolled back and sent ${antimessages} antimessage(s) in total.`
                : `LP${p} processed event ${event.id} at time ${event.time}; local state is now ${state[p]}.`,
            codeLineNumber: rolledBack ? 2 : 1,
            layout: "array",
            meta: {
                phase: rolledBack ? "rollback" : "process",
                lps,
                states: [...state],
                localTimes: [...localTime],
                rollbacks,
                antimessages,
                event: [event.id, event.time, p, event.value],
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(state, localTime, null, false),
        edges: [],
        description: `Simulation complete after ${rollbacks} rollback(s); final states match sequential timestamp order.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { phase: "done", lps, states: [...state], localTimes: [...localTime], rollbacks, antimessages },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Conservative simulation waits until it is sure no earlier event can arrive. Time Warp takes the opposite bet: process events immediately in timestamp order, and if a late event arrives from the past, undo the work that depended on the future, cancel the messages that were sent, and replay correctly. Optimism buys parallelism, with rollback as the price of a wrong guess.",
        invariants: [
            "A logical process's committed history is always ordered by nondecreasing timestamp.",
            "A straggler triggers rollback only when its timestamp is below that process's current virtual time.",
            "After replay, the state equals the sum of every delivered event for that process.",
        ],
        correctness:
            "Rollback removes exactly the history entries with timestamp at or beyond the straggler, restoring the state to what it was before those events. Replaying the pending queue in timestamp order reintroduces them together with the straggler in the correct global order. By induction over arrivals, each process's final state equals the state obtained by processing all its events in timestamp order, which is the sequential reference, so optimism does not change the result.",
        complexityRationale:
            "A normal arrival is drained in O(k log k) for the pending queue, typically O(1). A straggler scans and sorts its pending events, O(k log k) for k events after the rollback point, and sends one antimessage per canceled event; the seen work is bounded by the number of events replayed, giving amortized near-linear behavior.",
        uses: [
            "Parallel discrete-event simulation of networks and circuits",
            "Optimistic distributed database replication",
            "Large-scale agent-based and queuing simulations",
        ],
        references: [
            "Jefferson, Virtual Time, ACM Transactions on Programming Languages and Systems, 1985",
            "Fujimoto, Parallel and Distributed Simulation Systems, Chapter 4",
        ],
        workedExample:
            "LP0 receives events at times 10 (value 1) and 20 (value 2), reaching state 3. A straggler at time 5 with value 4 arrives; LP0 rolls back past times 10 and 20, sends two antimessages, then replays 5, 10, and 20. Its final state is 1 + 2 + 4 = 7, exactly what sequential timestamp order gives.",
    },
    id: "time-warp-protocol",
    name: "Time Warp Protocol",
    category: "parallel-distributed",
    complexity: { time: "O(k log k) per rollback", space: "O(total events)" },
    defaultInput: {
        lps: 2,
        events: [
            { id: "e0", time: 10, lp: 0, value: 1 },
            { id: "e1", time: 20, lp: 0, value: 2 },
            { id: "e2", time: 5, lp: 0, value: 4 },
            { id: "e3", time: 15, lp: 1, value: 3 },
            { id: "e4", time: 12, lp: 1, value: 5 },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize each process state and virtual time to zero",
        "deliver the next event to its destination process",
        "if event time is below local virtual time roll back",
        "cancel later sent events with antimessages and restore state",
        "insert the event in the pending queue and replay in timestamp order",
        "otherwise process the event immediately in local time order",
        "repeat until every event has been delivered",
        "done: report final states and rollback statistics",
    ],
};

export default module;
