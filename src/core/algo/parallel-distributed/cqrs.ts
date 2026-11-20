/**
 * cqrs.ts - Command Query Responsibility Segregation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CQRS separates the model that handles writes (commands) from the model that
 * serves reads (queries). A command is validated against the current write
 * state, and if accepted it produces an immutable event appended to an event
 * log. A projection consumes those events to build a read model optimized for
 * queries. This module runs a small bank example: deposit and withdraw
 * commands are appended as events and projected into account balances; queries
 * read only the projected balances.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(c + e) for c commands and e produced events
 *   Space: O(e + a) for the event log and a account read-model entries
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Write-side event cells sit in one row; read-side balance cells in another.
 *   - The command currently processed is highlighted on the write side.
 *   - A rejected command (overdraft or unknown account) is marked as an error.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Command {
    type: "deposit" | "withdraw";
    account: string;
    amount: number;
}

interface Input {
    accounts?: string[];
    commands?: Command[];
    initialBalances?: Record<string, number>;
}

/** Build event-log cells and read-model balance cells for one frame. */
function makeEntities(
    accounts: string[],
    commands: Command[],
    balances: Map<string, number>,
    accepted: boolean[],
    upto: number,
    currentAccount: string | null,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < commands.length; i += 1) {
        const cmd = commands[i] as Command;
        let state: EntityState = "unvisited";
        if (i < upto) {
            state = accepted[i] ? "sorted" : "error";
        } else if (i === upto) {
            state = "comparing";
        }
        entities.push({
            id: `event-${i}`,
            type: "cell",
            label: `${cmd.type} ${cmd.account} ${cmd.amount}`,
            value: `${cmd.type}:${cmd.account}:${cmd.amount}`,
            state,
            x: i,
            y: 0,
            width: 1,
            height: 1,
            metadata: { row: 0, col: i, kind: "event", accepted: accepted[i] ?? false },
        });
    }
    for (let i = 0; i < accounts.length; i += 1) {
        const account = accounts[i] as string;
        entities.push({
            id: `read-${account}`,
            type: "cell",
            label: `${account}: ${balances.get(account) ?? 0}`,
            value: balances.get(account) ?? 0,
            state: currentAccount === account ? "comparing" : "idle",
            x: i,
            y: 2,
            width: 1,
            height: 1,
            metadata: { row: 2, col: i, kind: "balance", account },
        });
    }
    return entities;
}

/** The CQRS generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const accounts: string[] = Array.isArray(task.accounts)
        ? task.accounts.map(String)
        : ["checking", "savings"];
    const commands: Command[] = Array.isArray(task.commands)
        ? task.commands.map((c) => ({ type: c.type, account: String(c.account), amount: Number(c.amount) }))
        : [
              { type: "deposit", account: "checking", amount: 100 },
              { type: "deposit", account: "savings", amount: 50 },
              { type: "withdraw", account: "checking", amount: 30 },
              { type: "withdraw", account: "savings", amount: 80 },
              { type: "deposit", account: "checking", amount: 20 },
          ];
    const writeState = new Map<string, number>();
    const readModel = new Map<string, number>();
    for (const account of accounts) {
        const start = Number(task.initialBalances?.[account] ?? 0);
        writeState.set(account, start);
        readModel.set(account, start);
    }
    const events: string[] = [];
    const accepted: boolean[] = [];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(accounts, commands, readModel, accepted, -1, null),
        edges: [],
        description: `CQRS initialized with ${accounts.length} account(s) and ${commands.length} command(s); write state and read model both start at zero.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3, cols: Math.max(accounts.length, commands.length), writeState: JSON.stringify(Object.fromEntries(writeState)), readModel: JSON.stringify(Object.fromEntries(readModel)), events: [], processed: 0 },
    };
    step += 1;

    for (let i = 0; i < commands.length; i += 1) {
        const cmd = commands[i] as Command;
        let ok = false;
        const before = writeState.get(cmd.account);
        if (before !== undefined && Number.isFinite(cmd.amount) && cmd.amount >= 0) {
            if (cmd.type === "deposit") {
                writeState.set(cmd.account, before + cmd.amount);
                ok = true;
            } else if (cmd.type === "withdraw" && before >= cmd.amount) {
                writeState.set(cmd.account, before - cmd.amount);
                ok = true;
            }
        }
        accepted.push(ok);
        if (ok) {
            events.push(`${cmd.type}:${cmd.account}:${cmd.amount}`);
            readModel.set(cmd.account, writeState.get(cmd.account) ?? 0);
        }

        yield {
            stepNumber: step,
            entities: makeEntities(accounts, commands, readModel, accepted, i + 1, cmd.account),
            edges: [],
            description: ok
                ? `Command ${i} "${cmd.type} ${cmd.account} ${cmd.amount}" accepted: event appended and projected into the read model.`
                : `Command ${i} "${cmd.type} ${cmd.account} ${cmd.amount}" rejected: insufficient funds or unknown account.`,
            codeLineNumber: ok ? 3 : 2,
            layout: "grid",
            meta: {
                rows: 3,
                cols: Math.max(accounts.length, commands.length),
                writeState: JSON.stringify(Object.fromEntries(writeState)),
                readModel: JSON.stringify(Object.fromEntries(readModel)),
                events: [...events],
                processed: i + 1,
                accepted: ok,
                command: `${cmd.type}:${cmd.account}:${cmd.amount}`,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(accounts, commands, readModel, accepted, commands.length, null),
        edges: [],
        description: `CQRS complete: ${events.length}/${commands.length} commands produced events; queries read balances only from the read model.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 3,
            cols: Math.max(accounts.length, commands.length),
            writeState: JSON.stringify(Object.fromEntries(writeState)),
            readModel: JSON.stringify(Object.fromEntries(readModel)),
            events: [...events],
            processed: commands.length,
            balances: JSON.stringify(Object.fromEntries(readModel)),
            done: true,
        },
    };
}

/** The CQRS module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Writing and reading are different jobs, so use different models for them. Commands go to a write model that checks business rules and records what happened as immutable events. A projection turns that event stream into a read model shaped for fast queries. The two sides can then evolve and scale independently.",
        invariants: [
            "Only commands mutate the write state; queries never do.",
            "An accepted command appends exactly one immutable event to the log.",
            "The read model is derived solely from the event stream, so it can be rebuilt from scratch.",
        ],
        correctness:
            "The write model validates each command against its current state and emits an event only when the command is legal, so the event log is a faithful, ordered record of every state transition. The projection folds those events in order into the read model; since folding is deterministic, replaying the same log from an empty read model reconstructs identical balances. Queries read only this projected state, so they observe a consistent view.",
        complexityRationale:
            "Each command is validated in O(1) and produces at most one event, while each event is projected once, giving O(c + e) total time. Space is O(e + a) for the append-only log and one read-model entry per account.",
        uses: [
            "Systems with different read and write workloads, such as event-sourced services",
            "Applications needing an audit trail of every state change",
            "Architectures that rebuild read models from events for new query needs",
        ],
        references: [
            "Young, CQRS Documents, 2010",
            "Fowler, CQRS, 2011",
        ],
        workedExample:
            "Starting from zero, deposit 100 into checking and deposit 50 into savings append two events. A withdraw of 30 from checking is accepted and projected to a balance of 70, but a withdraw of 80 from savings is rejected because only 50 is present, so no event is appended and the savings balance stays 50.",
    },
    id: "cqrs",
    name: "Command Query Responsibility Segregation (CQRS)",
    category: "parallel-distributed",
    complexity: { time: "O(c + e)", space: "O(e + a)" },
    defaultInput: {
        accounts: ["checking", "savings"],
        commands: [
            { type: "deposit", account: "checking", amount: 100 },
            { type: "deposit", account: "savings", amount: 50 },
            { type: "withdraw", account: "checking", amount: 30 },
            { type: "withdraw", account: "savings", amount: 80 },
            { type: "deposit", account: "checking", amount: 20 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the write state and the read model",
        "for each incoming command",
        "validate the command against the current write state",
        "on success append an event describing the change",
        "project the event into the read model",
        "on failure reject the command and emit no event",
        "serve queries only from the read model",
        "done: report the final event log and balances",
    ],
};

export default module;
