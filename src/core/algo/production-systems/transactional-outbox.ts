/**
 * transactional-outbox.ts - Transactional Outbox Relay
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The transactional outbox pattern avoids the dual-write problem by recording
 * a business change and its outgoing event in the same database transaction.
 * A separate relay polls unpublished outbox rows, publishes each one, and
 * marks it published. If a publish fails, the row stays unpublished and is
 * retried on the next sweep; a deduplication key guarantees that a retry after
 * a partial success cannot deliver the event twice.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(s * n) for s relay sweeps and n outbox rows
 *   Space: O(n) for the event states and deduplication ledger
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row per event with commit flag, publish flag, and attempts.
 *   - A committed but unpublished row is highlighted during relay sweeps.
 *   - The final frame reports exactly-once delivery.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    orders?: number[];
    failAt?: number[];
}

type Event = { order: number; committed: boolean; published: boolean; attempts: number; successes: number };

function makeCells(events: Event[], current: number, phase: "commit" | "relay" | "done"): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < events.length; row += 1) {
        const event = events[row];
        const columns = [event?.order ?? 0, event?.committed ? 1 : 0, event?.published ? 1 : 0, event?.attempts ?? 0];
        for (let col = 0; col < columns.length; col += 1) {
            let state: EntityState = "idle";
            if (phase === "done") state = "sorted";
            else if (row === current) state = phase === "commit" ? "active" : "comparing";
            else if (event?.committed && !event.published) state = "visited";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(columns[col] ?? 0),
                value: columns[col] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const orders = Array.isArray(task.orders) && task.orders.length > 0
        ? task.orders.map((v) => Math.floor(Number(v)))
        : [1, 2, 3, 4];
    const failAt = new Set(Array.isArray(task.failAt) ? task.failAt.map((v) => Math.floor(Number(v))) : [2]);
    const maxSweeps = 10;

    const events: Event[] = orders.map((order) => ({ order, committed: false, published: false, attempts: 0, successes: 0 }));
    const publishedIds: number[] = [];
    const delivered = new Set<number>();

    const metaBase = { family: "transactional-outbox", rows: events.length, cols: 4, orders: [...orders] };
    const snapshot = (phase: string, current: number, sweep: number, attempt: number) => ({
        ...metaBase,
        phase,
        current,
        sweep,
        attempt,
        committed: events.map((e) => (e.committed ? 1 : 0)),
        published: events.map((e) => (e.published ? 1 : 0)),
        attempts: events.map((e) => e.attempts),
        successes: events.map((e) => e.successes),
        publishedIds: [...publishedIds],
    });

    yield {
        stepNumber: 0,
        entities: makeCells(events, -1, "commit"),
        edges: [],
        description: `Transactional outbox with ${orders.length} orders and publish failures at attempts [${[...failAt].join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: snapshot("commit", -1, 0, 0),
    };

    let step = 1;
    for (let i = 0; i < events.length; i += 1) {
        const event = events[i];
        if (!event) continue;
        event.committed = true;
        yield {
            stepNumber: step,
            entities: makeCells(events, i, "commit"),
            edges: [],
            description: `Transaction committed order ${event.order} and inserted its outbox row atomically.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: snapshot("commit", i, 0, 0),
        };
        step += 1;
    }

    let attempt = 0;
    let sweep = 0;
    while (sweep < maxSweeps && events.some((e) => e.committed && !e.published)) {
        sweep += 1;
        for (let i = 0; i < events.length; i += 1) {
            const event = events[i];
            if (!event || !event.committed || event.published) continue;
            attempt += 1;
            event.attempts += 1;
            if (failAt.has(attempt)) {
                yield {
                    stepNumber: step,
                    entities: makeCells(events, i, "relay"),
                    edges: [],
                    description: `Sweep ${sweep}: publish attempt ${attempt} for order ${event.order} failed; row stays unpublished.`,
                    codeLineNumber: 4,
                    layout: "grid",
                    meta: { ...snapshot("relay", i, sweep, attempt), failedAttempt: attempt },
                };
                step += 1;
                continue;
            }
            if (!delivered.has(event.order)) {
                delivered.add(event.order);
                publishedIds.push(event.order);
                event.successes += 1;
            }
            event.published = true;
            yield {
                stepNumber: step,
                entities: makeCells(events, i, "relay"),
                edges: [],
                description: `Sweep ${sweep}: published order ${event.order} with dedup key and marked its row published.`,
                codeLineNumber: 5,
                layout: "grid",
                meta: snapshot("relay", i, sweep, attempt),
            };
            step += 1;
        }
    }

    const exactlyOnce = events.every((e) => e.published && e.successes === 1);
    yield {
        stepNumber: step,
        entities: makeCells(events, -1, "done"),
        edges: [],
        description: exactlyOnce
            ? `All ${orders.length} events delivered exactly once after ${sweep} sweep(s).`
            : `Relay finished ${sweep} sweep(s) with ${events.filter((e) => !e.published).length} event(s) undelivered.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { ...snapshot("done", -1, sweep, attempt), exactlyOnce, sweeps: sweep, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Writing a row to a database and sending a message to a broker cannot be one atomic action across two systems. The outbox trick writes the message into a table inside the same transaction as the business row. A relay later reads that table, publishes the messages, and marks them done, so a crash between the two steps only causes a retry, not a lost or duplicated event.",
        invariants: [
            "An event row is inserted in the same transaction as its order.",
            "The relay only considers rows that are committed and not yet published.",
            "A deduplication key ensures a successful publish is recorded once.",
        ],
        correctness:
            "Because the order row and outbox row commit together, there is no state where the business change exists without its event. The relay skips unpublished rows only after a confirmed publish, so a failure before confirmation leaves the row eligible for retry. The deduplication key makes a retry after an ambiguous success idempotent, and a published row is never selected again. Therefore every committed event is delivered at least once and, with the dedup ledger, exactly once, which the final ledger check verifies.",
        complexityRationale:
            "Each sweep scans the n outbox rows and attempts those still unpublished, costing O(n) per sweep. The event list, published flags, and deduplication set use O(n) space.",
        uses: [
            "Publishing domain events after database transactions in microservices",
            "Guaranteeing cache invalidation messages accompany data changes",
            "Reliable order-created notifications in commerce systems",
        ],
        references: [
            "Richardson, Microservices Patterns, Chapter 3",
            "Debezium documentation, Reliable Microservices Data Exchange with the Outbox Pattern",
        ],
        workedExample:
            "Committing order 7 inserts an outbox row in the same transaction. The relay's first sweep publishes it, but the acknowledgement for another event fails. On the next sweep the failed row is retried while the already-published row is skipped, and the dedup ledger shows each of the two events delivered once.",
    },
    id: "transactional-outbox",
    name: "Transactional Outbox",
    category: "production-systems",
    complexity: { time: "O(s * n)", space: "O(n)" },
    defaultInput: { orders: [1, 2, 3, 4], failAt: [2] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the orders and the publish attempts that should fail",
        "for each order commit the row and outbox event together",
        "repeat relay sweeps while unpublished rows remain",
        "pick each committed unpublished outbox row",
        "attempt publication, leaving the row unchanged on failure",
        "on success use the dedup key and mark the row published",
        "stop when every row is published or sweeps run out",
        "done: verify exactly-once delivery across all events",
    ],
};

export default module;
