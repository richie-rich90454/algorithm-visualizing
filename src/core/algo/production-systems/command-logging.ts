/**
 * command-logging.ts - Logical Command Logging and Replay
 *
 * A command log records high-level operations (set, increment, delete, append)
 * instead of raw page changes. Replaying the log from an empty state rebuilds
 * exactly the same state as executing the commands live. This is the logical
 * counterpart to physical journaling and keeps the log small and readable.
 *
 * Time: O(commands); Space: O(commands + state).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Value = number | string;
interface Command { op: string; key: string; value?: Value }

function apply(state: Record<string, Value>, command: Command): void {
    switch (command.op) {
        case "set":
            state[command.key] = command.value ?? 0;
            break;
        case "incr":
            state[command.key] = Number(state[command.key] ?? 0) + Number(command.value ?? 1);
            break;
        case "append":
            state[command.key] = `${String(state[command.key] ?? "")}${String(command.value ?? "")}`;
            break;
        case "del":
            delete state[command.key];
            break;
        default:
            break;
    }
}

function makeEntities(state: Record<string, Value>, activeKey: string | null): VisualEntity[] {
    const keys = Object.keys(state).sort();
    return keys.map((key, index) => {
        const value = state[key] ?? 0;
        return {
            id: `key-${index}`,
            type: "bar" as const,
            label: `${key}=${value}`,
            value: typeof value === "number" ? value : value.length,
            state: key === activeKey ? "active" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { key },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { commands?: Command[] } | null) ?? {};
    const commands: Command[] = (task.commands ?? [
        { op: "set", key: "counter", value: 0 },
        { op: "incr", key: "counter", value: 5 },
        { op: "incr", key: "counter", value: 3 },
        { op: "set", key: "name", value: "ada" },
        { op: "append", key: "name", value: " lovelace" },
        { op: "del", key: "counter" },
    ]).map((command) => ({ ...command }));

    const live: Record<string, Value> = {};
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(live, null),
        edges: [],
        description: `Starting with an empty state; ${commands.length} commands will be logged and replayed.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "start", state: {}, logLength: 0 },
    };
    step += 1;

    for (let i = 0; i < commands.length; i += 1) {
        const command = commands[i];
        if (!command) { continue; }
        apply(live, command);
        yield {
            stepNumber: step,
            entities: makeEntities(live, command.key),
            edges: [],
            description: `Logged and applied command ${i + 1}: ${command.op} on ${command.key}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { phase: "apply", state: { ...live }, logLength: i + 1 },
        };
        step += 1;
    }

    const replayed: Record<string, Value> = {};
    for (const command of commands) {
        apply(replayed, command);
    }
    const matches = JSON.stringify(replayed) === JSON.stringify(live);

    yield {
        stepNumber: step,
        entities: makeEntities(replayed, null),
        edges: [],
        description: `Replayed the ${commands.length}-command log from empty; state matches the live run: ${matches}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { phase: "done", state: { ...replayed }, logLength: commands.length, matches },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of recording every byte that changed, a command log records the operation the caller asked for. Replaying those operations from the beginning reconstructs the same state with far less log volume. The key requirement is that commands be deterministic, so replay gives the same answer.",
        invariants: [
            "Each command is appended to the log before it changes live state.",
            "Commands are deterministic functions of the current state and their arguments.",
            "Replaying the full log from an empty state reproduces the live state.",
        ],
        correctness:
            "Because each command's effect depends only on the state at that point and its arguments, applying the same sequence from the same initial state yields identical results by induction on the command index. The comparison of replayed and live state verifies this directly.",
        complexityRationale:
            "Live execution and replay each apply every command once, so both are O(commands) in time and O(commands plus state) in space.",
        uses: [
            "Replication of state machines across servers",
            "Audit trails and point-in-time reconstruction in databases",
            "Event sourcing where the log is the source of truth",
        ],
        references: [
            "Lamport, Time, Clocks, and the Ordering of Events in a Distributed System, 1978",
            "Kleppmann, Designing Data-Intensive Applications, chapter on replication logs",
        ],
        workedExample:
            "Setting a counter to zero, incrementing it by five and then three, appending lovelace to a name, and deleting the counter produces a name of ada lovelace; replaying the same six commands from empty gives the same result.",
    },
    id: "command-logging",
    name: "Logical Command Logging",
    category: "production-systems",
    complexity: { time: "O(commands)", space: "O(commands + state)" },
    defaultInput: {
        commands: [
            { op: "set", key: "counter", value: 0 },
            { op: "incr", key: "counter", value: 5 },
            { op: "incr", key: "counter", value: 3 },
            { op: "set", key: "name", value: "ada" },
            { op: "append", key: "name", value: " lovelace" },
            { op: "del", key: "counter" },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the ordered list of logical commands",
        "initialize an empty state for live execution",
        "for each command append it to the log",
        "apply the command to the live state",
        "replay the whole log onto a second empty state",
        "compare the replayed state with the live state",
        "report the rebuilt state and replay result",
    ],
};

export default module;
