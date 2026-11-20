/**
 * timestamp-ordering.ts - Basic Timestamp Ordering Concurrency Control
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Basic timestamp ordering assigns each transaction a timestamp and orders
 * conflicting operations by it. A data item remembers the newest timestamp of
 * any read and any accepted write. An older transaction arriving after a newer
 * conflict is rejected and must restart. Accepting only operations that respect
 * these timestamp rules yields a conflict-serializable schedule in timestamp
 * order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(m) for m operations, each checked in constant time
 *   Space: O(d) for d data items plus the verdict log
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One cell per data item shows its read and write timestamps.
 *   - The accessed item is highlighted; a rejected operation turns red.
 *   - meta carries per-operation verdicts and the final timestamp table.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Access {
    tx: number;
    op: "read" | "write";
    item: string;
}

/** A timestamp table entry for one data item. */
export interface ItemClock {
    read: number;
    write: number;
}

/** Decide an operation and return whether it is accepted. */
export function verdict(clocks: Record<string, ItemClock>, access: Access): boolean {
    const clock = clocks[access.item] ?? { read: 0, write: 0 };
    if (access.op === "read") {
        return access.tx >= clock.write;
    }
    return access.tx >= clock.read && access.tx >= clock.write;
}

/** Build one cell per data item showing its timestamp pair. */
function makeCells(
    items: string[],
    clocks: Record<string, ItemClock>,
    active: number,
    rejected: boolean,
): VisualEntity[] {
    return items.map((item, index) => {
        const clock = clocks[item] ?? { read: 0, write: 0 };
        let state: EntityState = "idle";
        if (index === active) {
            state = rejected ? "error" : "comparing";
        }
        return {
            id: `item-${index}`,
            type: "cell" as const,
            label: `${item}: r=${clock.read}, w=${clock.write}`,
            value: clock.write,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, item, read: clock.read, write: clock.write },
        };
    });
}

/** The timestamp ordering generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { items?: string[]; operations?: Access[] } | null) ?? {};
    const items: string[] = Array.isArray(task.items) && task.items.length > 0
        ? task.items.map((item) => String(item))
        : ["X", "Y"];
    const operations: Access[] = Array.isArray(task.operations) && task.operations.length > 0
        ? task.operations.map((access) => ({
              tx: Math.floor(access.tx),
              op: access.op === "write" ? ("write" as const) : ("read" as const),
              item: String(access.item),
          }))
        : [
              { tx: 10, op: "read", item: "X" },
              { tx: 20, op: "write", item: "X" },
              { tx: 15, op: "write", item: "X" },
              { tx: 5, op: "read", item: "X" },
              { tx: 30, op: "write", item: "Y" },
              { tx: 20, op: "read", item: "Y" },
          ];

    const clocks: Record<string, ItemClock> = {};
    for (const item of items) {
        clocks[item] = { read: 0, write: 0 };
    }
    yield {
        stepNumber: 0,
        entities: makeCells(items, clocks, -1, false),
        edges: [],
        description: `Timestamp ordering over ${items.length} item(s) with ${operations.length} operation(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: items.length,
            readTS: items.map((item) => clocks[item]?.read ?? 0),
            writeTS: items.map((item) => clocks[item]?.write ?? 0),
            accepted: 0,
            rejected: 0,
            verdicts: [] as string[],
        },
    };

    const verdicts: string[] = [];
    let accepted = 0;
    let rejected = 0;
    let step = 1;
    for (const access of operations) {
        const allowed = verdict(clocks, access);
        const index = items.indexOf(access.item);
        if (allowed) {
            accepted += 1;
            const clock = clocks[access.item];
            if (clock) {
                if (access.op === "read") {
                    clock.read = Math.max(clock.read, access.tx);
                } else {
                    clock.write = access.tx;
                }
            }
        } else {
            rejected += 1;
        }
        const tag = `T${access.tx}:${access.op}:${access.item}=${allowed ? "ok" : "reject"}`;
        verdicts.push(tag);
        yield {
            stepNumber: step,
            entities: makeCells(items, clocks, index, !allowed),
            edges: [],
            description: `T${access.tx} ${access.op} ${access.item}: ${allowed ? "accepted" : "rejected and restarted"}.`,
            codeLineNumber: access.op === "read" ? 2 : 4,
            layout: "grid",
            meta: {
                rows: 1,
                cols: items.length,
                readTS: items.map((item) => clocks[item]?.read ?? 0),
                writeTS: items.map((item) => clocks[item]?.write ?? 0),
                accepted,
                rejected,
                verdicts: verdicts.slice(),
                request: tag,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(items, clocks, -1, false),
        edges: [],
        description: `Done: ${accepted} accepted, ${rejected} rejected; schedule follows timestamp order.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: 1,
            cols: items.length,
            readTS: items.map((item) => clocks[item]?.read ?? 0),
            writeTS: items.map((item) => clocks[item]?.write ?? 0),
            accepted,
            rejected,
            verdicts,
            done: true,
        },
    };
}

/** The timestamp ordering module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Stamp every transaction with its start time and let older transactions win conflicts. Each data item records the newest reader and writer. If a transaction tries to read something a newer transaction already wrote, or write something a newer transaction touched, it is too late and must restart. The accepted operations then line up in timestamp order.",
        invariants: [
            "An item's write timestamp is the largest timestamp of any accepted write to it.",
            "An item's read timestamp never decreases.",
            "An accepted operation never conflicts with a strictly newer operation already applied.",
        ],
        correctness:
            "A read is accepted only when the transaction is not older than the item's newest writer, so it cannot observe a value overwritten in its past. A write is accepted only when the transaction is newer than every prior read and write, so it cannot invalidate work that an older transaction already performed. Therefore every accepted conflicting pair is ordered by timestamp, which is a total order, and the resulting schedule is conflict serializable. Rejected transactions simply restart with a fresh timestamp.",
        complexityRationale:
            "Each operation performs a constant number of comparisons and updates against one item's timestamp pair, so m operations take O(m) time. Storing a pair per data item uses O(d) space, plus O(m) for the verdict log shown in the frames.",
        uses: [
            "Optimistic concurrency control in database systems",
            "Multiversion schemes that order versions by transaction timestamp",
            "Teaching conflict serializability in transaction processing courses",
        ],
        references: [
            "Bernstein, Hadzilacos, and Goodman, Concurrency Control and Recovery in Database Systems, Chapter 3",
            "Silberschatz, Korth, and Sudarshan, Database System Concepts, Chapter on Concurrency Control",
        ],
        workedExample:
            "T10 reads X, setting its read timestamp to 10. T20 writes X and sets the write timestamp to 20. T15 now tries to write X but is older than its writer, so it is rejected. T5 tries to read X but is older than the writer, so it is also rejected. Every accepted operation on X follows timestamp order.",
    },
    id: "timestamp-ordering",
    name: "Timestamp Ordering",
    category: "production-systems",
    complexity: { time: "O(m)", space: "O(d)" },
    defaultInput: {
        items: ["X", "Y"],
        operations: [
            { tx: 10, op: "read", item: "X" },
            { tx: 20, op: "write", item: "X" },
            { tx: 15, op: "write", item: "X" },
            { tx: 5, op: "read", item: "X" },
            { tx: 30, op: "write", item: "Y" },
            { tx: 20, op: "read", item: "Y" },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize every item read and write timestamp to zero",
        "for each operation by transaction T",
        "on a read reject when T is older than the item write timestamp",
        "otherwise advance the item read timestamp to the maximum",
        "on a write reject when T is older than any reader or writer",
        "otherwise set the item write timestamp to T",
        "record the verdict and restart rejected transactions",
        "done: report accepted and rejected counts",
    ],
};

export default module;
