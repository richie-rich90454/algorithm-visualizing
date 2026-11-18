/**
 * saga-compensating-transaction.ts - Saga with Compensating Transactions
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A saga is a sequence of local transactions T1..Tn, each with a compensating
 * action C1..Cn that undoes it. If a step fails, the coordinator runs the
 * compensations for the already committed steps in reverse order, bringing the
 * system back to its starting state. If every step succeeds, the saga commits.
 *
 * This deterministic model gives each Ti the effect +i and each Ci the effect
 * -i. The exact step shown is the undo invariant: after a failure at step k the
 * compensation order is k-1, k-2, ..., 1 and the final balance is zero.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) local transactions plus at most O(n) compensations
 *   Space: O(n) for the step ledger and the balance
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per step shows its net contribution to the balance.
 *   - A committed step is green, a failed step is red, a compensated step is
 *     yellow, and a step that never ran is idle.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface SagaData {
    steps: number;
    failAt: number;
    failed: boolean;
    balance: number;
    contributions: number[];
    states: EntityState[];
    log: string[];
    compensatedOrder: number[];
}

/** Deterministic saga simulation. `failAt = 0` means no failure. */
export function simulateSaga(steps: number, failAt: number): SagaData {
    const n = Math.max(1, Math.floor(steps));
    const failure = failAt >= 1 && failAt <= n ? Math.floor(failAt) : 0;
    const contributions = Array<number>(n).fill(0);
    const states: EntityState[] = Array<EntityState>(n).fill("idle");
    const log: string[] = [];
    const compensatedOrder: number[] = [];
    let balance = 0;

    for (let i = 1; i <= n; i += 1) {
        if (i === failure) {
            states[i - 1] = "error";
            log.push(`T${i} failed, start compensating`);
            break;
        }
        balance += i;
        contributions[i - 1] = i;
        states[i - 1] = "sorted";
        log.push(`T${i} committed (+${i}), balance ${balance}`);
    }

    if (failure !== 0) {
        for (let i = failure - 1; i >= 1; i -= 1) {
            if (states[i - 1] === "sorted") {
                balance -= i;
                contributions[i - 1] = 0;
                states[i - 1] = "swapped";
                compensatedOrder.push(i);
                log.push(`C${i} compensated (-${i}), balance ${balance}`);
            }
        }
    }
    return { steps: n, failAt: failure, failed: failure !== 0, balance, contributions, states, log, compensatedOrder };
}

/** Build the step bars for a simulation prefix. */
function makeBars(contributions: number[], states: EntityState[]): VisualEntity[] {
    return contributions.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${states[index] === "swapped" ? "C" : "T"}${index + 1}:${value}`,
        value,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, step: index + 1 },
    }));
}

/** The saga generator: reveal the ledger one action at a time. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { steps?: number; failAt?: number } | null) ?? {};
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 5;
    const failAt = typeof task.failAt === "number" ? Math.floor(task.failAt) : 3;
    const data = simulateSaga(steps, failAt);

    let step = 0;
    const show = (count: number, line: number, description: string, final = false): VisualFrame => {
        const contributions = Array<number>(steps).fill(0);
        const states: EntityState[] = Array<EntityState>(steps).fill("idle");
        for (let i = 0; i < Math.min(count, steps); i += 1) {
            contributions[i] = data.contributions[i] ?? 0;
            states[i] = data.states[i] ?? "idle";
        }
        return {
            stepNumber: step++,
            entities: makeBars(contributions, states),
            edges: [],
            description,
            codeLineNumber: line,
            layout: "array",
            meta: {
                steps,
                failAt: data.failAt,
                balance: final ? data.balance : data.contributions.slice(0, count).reduce((a, b) => a + b, 0),
                log: data.log.slice(0, final ? data.log.length : count),
                compensatedOrder: final ? data.compensatedOrder : [],
                failed: data.failed,
            },
        };
    };

    yield show(0, 0, `Starting a ${steps}-step saga${data.failed ? ` with step ${data.failAt} set to fail` : " with no failures"}.`);

    for (let i = 1; i <= steps; i += 1) {
        if (i === data.failAt) {
            break;
        }
        yield show(i, 2, `Local transaction T${i} commits, adding ${i} to the balance.`);
    }
    if (data.failed) {
        yield show(data.failAt, 3, `Transaction T${data.failAt} fails, so compensations must undo committed steps.`);
        for (let k = 0; k < data.compensatedOrder.length; k += 1) {
            yield show(steps, 5, `Compensation C${data.compensatedOrder[k]} runs in reverse order.`);
        }
    }
    yield show(
        steps,
        7,
        data.failed
            ? `Saga rolled back: compensations [${data.compensatedOrder.join(", ")}] restored balance to ${data.balance}.`
            : `Saga committed: all ${steps} transactions succeeded, final balance ${data.balance}.`,
        true,
    );
}

/** The saga module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A long-running business process is split into local transactions that each can commit or undo. If one step fails, you do not roll back a global database lock; instead you run each committed step's compensating action in reverse order, like replaying a ledger backward to cancel entries.",
        invariants: [
            "Only committed steps have a positive contribution to the balance.",
            "Compensation for step i appears only after step i committed and only when a later step failed.",
            "The balance equals the sum of all current step contributions.",
        ],
        correctness:
            "For a failure at step k, the committed steps are exactly 1 through k-1. The compensation loop walks i from k-1 down to 1 and subtracts i once for each committed step, so the final balance is the forward sum minus the same sum, which is zero. In reverse order each compensation undoes the most recent commit first, so no intermediate state double-counts a step. With no failure no compensation runs and the balance is the total sum.",
        complexityRationale:
            "The forward pass runs at most n local transactions and the rollback runs at most n-1 compensations, so time is O(n). Storing the contribution and state per step plus the log is O(n) space.",
        uses: [
            "Booking flows that cancel a hotel or flight after a payment failure",
            "Order processing across independent microservices",
            "Long-running workflows where two-phase commit is impractical",
        ],
        references: [
            "Garcia-Molina and Salem, Sagas, SIGMOD 1987",
            "Richardson, Microservices Patterns, Chapter 4",
        ],
        workedExample:
            "With five steps and step 3 failing, T1 and T2 commit for a balance of 3. T3 fails, then C2 subtracts 2 and C1 subtracts 1, leaving balance zero. The compensation order is [2, 1], the exact reverse of the committed prefix.",
    },
    id: "saga-compensating-transaction",
    name: "Saga Compensating Transaction",
    category: "parallel-distributed",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { steps: 5, failAt: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "list the local transactions T1 through Tn",
        "for each step from one to n",
        "execute the step and add its effect to the balance",
        "if the step fails, stop the forward pass",
        "for each committed step in reverse order",
        "run its compensating action and subtract its effect",
        "report a committed saga or a fully rolled back one",
        "done: emit the final balance and the ledger",
    ],
};

export default module;
