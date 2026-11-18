/**
 * outbox-pattern.ts - Transactional Outbox with a Polling Relay
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The transactional outbox solves the dual-write problem: a service must change
 * its own database and publish an event, but a database commit and a message
 * broker send cannot share one transaction. The outbox pattern writes the
 * business row and an outbox row holding the event in the same local
 * transaction, so they commit or roll back together. A separate relay polls the
 * outbox, publishes pending events in id order, and marks each one published.
 * A transient publish failure leaves the row pending for a later retry, which
 * gives at-least-once delivery; a consumer still needs idempotency for the rare
 * duplicate. This module is a deterministic teaching simulation on a fixed
 * event list, not a database or broker implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k + p * k) for k events and at most p relay passes
 *   Space: O(k) for the outbox rows and the published-order log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid row per outbox event: id, business commit, and delivery state.
 *   - A pending row is yellow, a failed publish is red, a published row is green.
 *   - The metadata records the committed rows, the publish order, and attempts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface OutboxInput {
    events?: Array<string | number>;
    rollback?: number[];
    failAttempts?: number[];
    maxPasses?: number;
}

type RowState = "pending" | "publishing" | "failed" | "published";

interface OutboxRow {
    id: number;
    name: string;
    state: RowState;
}

/** Build grid cells for the outbox table. */
function makeCells(rows: OutboxRow[], activeId: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (const row of rows) {
        const color: EntityState =
            row.state === "published" ? "sorted" : row.state === "failed" ? "error" : row.id === activeId ? "comparing" : "idle";
        const values = [`e${row.id}`, row.name, row.state];
        values.forEach((value, col) => {
            entities.push({
                id: `cell-${row.id}-${col}`,
                type: "cell" as const,
                label: value,
                value,
                state: color,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: row.id, col, state: row.state },
            });
        });
    }
    return entities;
}

/** The transactional outbox generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as OutboxInput | null) ?? {};
    const events: Array<string | number> = Array.isArray(task.events) && task.events.length > 0
        ? task.events.slice(0, 12)
        : ["order-created", "payment-charged", "email-queued", "audit-logged"];
    const rollback = new Set<number>(
        Array.isArray(task.rollback) ? task.rollback.filter((i) => Number.isInteger(i)) : [],
    );
    const failAttempts = new Set<number>(
        Array.isArray(task.failAttempts) ? task.failAttempts.filter((i) => Number.isInteger(i)) : [],
    );
    const maxPasses = typeof task.maxPasses === "number" && task.maxPasses >= 1
        ? Math.floor(task.maxPasses)
        : 5;

    const rows: OutboxRow[] = [];
    const committed: number[] = [];
    const publishedOrder: number[] = [];
    let attempt = 0;
    let step = 0;

    const frame = (
        description: string,
        line: number,
        activeId: number,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: makeCells(rows, activeId),
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            rows: Math.max(1, rows.length),
            cols: 3,
            committed: [...committed],
            outbox: JSON.stringify(rows.map((r) => ({ id: r.id, name: r.name, state: r.state }))),
            publishedOrder: [...publishedOrder],
            attempts: attempt,
            pending: rows.filter((r) => r.state !== "published").length,
        },
    });

    yield frame(
        `Outbox is empty; ${events.length} business events will be written in local transactions.`,
        0,
        -1,
    );

    // Phase 1: atomic local transactions write the business row and outbox row together.
    for (let i = 0; i < events.length; i += 1) {
        if (rollback.has(i)) {
            yield frame(
                `Transaction ${i} for "${events[i]}" rolled back: neither the business row nor the outbox row was written.`,
                2,
                -1,
            );
            continue;
        }
        const id = i + 1;
        rows.push({ id, name: String(events[i]), state: "pending" });
        committed.push(id);
        yield frame(
            `Transaction ${i} committed: business row and outbox row e${id} were written atomically.`,
            1,
            id,
        );
    }

    // Phase 2: the relay publishes pending rows in id order, retrying failures.
    let pass = 0;
    while (rows.some((r) => r.state !== "published") && pass < maxPasses) {
        pass += 1;
        yield frame(`Relay pass ${pass}: scanning the outbox for pending rows in id order.`, 3, -1);
        for (const row of rows) {
            if (row.state === "published") {
                continue;
            }
            row.state = "publishing";
            yield frame(`Relay attempts to publish e${row.id} ("${row.name}").`, 4, row.id);
            attempt += 1;
            if (failAttempts.has(attempt)) {
                row.state = "failed";
                yield frame(
                    `Publish attempt ${attempt} for e${row.id} failed transiently; the row stays in the outbox for retry.`,
                    5,
                    row.id,
                );
                // Stop this pass at a failure so later rows cannot overtake an earlier id.
                break;
            } else {
                row.state = "published";
                publishedOrder.push(row.id);
                yield frame(`Published e${row.id}; the relay marks it published in the same local transaction.`, 6, row.id);
            }
        }
    }

    const allPublished = rows.length > 0 && rows.every((r) => r.state === "published");
    yield frame(
        allPublished
            ? `All ${rows.length} outbox rows were published in id order after ${pass} pass(es); ${attempt} attempt(s) total.`
            : `Relay stopped after ${pass} pass(es) with ${rows.filter((r) => r.state !== "published").length} row(s) still pending.`,
        7,
        -1,
    );
}

/** The transactional outbox module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "You cannot atomically commit a database change and send a message to a broker, because they are two separate systems. The outbox trick writes the message as a row in the same local transaction as the business change. A background relay then reads those rows and publishes them. If publishing fails, the row is simply retried, so no committed change is silently lost.",
        invariants: [
            "An outbox row exists if and only if its local transaction committed.",
            "The relay considers rows in ascending id order within each pass.",
            "A row is marked published only after a successful publish attempt.",
            "A transient failure stops the current relay pass, so later ids cannot overtake an earlier one.",
        ],
        correctness:
            "Because the business row and the outbox row are written in one local transaction, either both persist or neither does, so a committed change always leaves a durable record of the event to send. The relay scans pending rows and only clears a row after a successful publish, so every committed event is delivered at least once. Ordering within a worker follows the ascending id scan; stopping a pass at a failure keeps a delayed row from being overtaken. A publish failure leaves the row pending, so it is retried on a later pass rather than dropped.",
        complexityRationale:
            "Writing k events does O(k) transactional work. Each of at most p relay passes scans k rows and publishes the pending ones, so the relay costs O(p * k) time. Storing the rows and the publish log uses O(k) space.",
        uses: [
            "Publishing integration events after a database commit in microservices",
            "Reliable event delivery without a distributed transaction",
            "Building an auditable log of domain events",
        ],
        references: [
            "Kleppmann, Designing Data-Intensive Applications, Chapter 11",
            "Newman, Building Microservices, chapter on events and messaging",
        ],
        workedExample:
            "An order service commits an order row and an outbox row e1 in one transaction. The relay publishes e1 and marks it published. A later publish attempt for e2 fails, so e2 stays pending; on the next pass the relay republishes e2 and then clears it, so both events are delivered in order.",
    },
    id: "outbox-pattern",
    name: "Transactional Outbox Pattern",
    category: "parallel-distributed",
    complexity: { time: "O(k + p * k)", space: "O(k)" },
    defaultInput: {
        events: ["order-created", "payment-charged", "email-queued", "audit-logged"],
        rollback: [],
        failAttempts: [3],
        maxPasses: 5,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty outbox table",
        "for each business event begin a local transaction",
        "write the business row and the outbox row, then commit together",
        "on a failed transaction roll back both writes",
        "repeat relay passes while pending rows remain",
        "scan pending rows in ascending id order",
        "attempt to publish each pending row",
        "on success mark the row published, on failure leave it pending",
        "done: all committed events were published at least once",
    ],
};

export default module;
