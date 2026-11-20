/**
 * journaling-file-system.ts - Journaling File System Recovery
 *
 * A journaling file system records an intent in a write-ahead log before
 * changing on-disk pages. After a crash, recovery replays every committed
 * transaction and ignores incomplete ones, leaving the file system in a
 * consistent state. This model demonstrates the write-ahead and replay phases.
 *
 * Time: O(records); Space: O(records + pages).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Operation { page: string; value: number }
interface Transaction {
    id: string;
    committed: boolean;
    ops: Operation[];
}

function makeEntities(pages: Record<string, number>, activePage: string | null): VisualEntity[] {
    return Object.keys(pages).map((key, index) => ({
        id: `page-${index}`,
        type: "bar" as const,
        label: `${key}:${pages[key] ?? 0}`,
        value: pages[key] ?? 0,
        state: key === activePage ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { name: key },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        pages?: Record<string, number>;
        transactions?: Transaction[];
    } | null) ?? {};
    const onDisk: Record<string, number> = { ...(task.pages ?? { A: 1, B: 2, C: 0 }) };
    const transactions: Transaction[] = (task.transactions ?? [
        { id: "T1", committed: true, ops: [{ page: "A", value: 5 }, { page: "B", value: 8 }] },
        { id: "T2", committed: false, ops: [{ page: "C", value: 9 }] },
    ]).map((tx) => ({ id: tx.id, committed: tx.committed, ops: tx.ops.map((op) => ({ ...op })) }));

    const journal: string[] = [];
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(onDisk, null),
        edges: [],
        description: `Starting with ${Object.keys(onDisk).length} on-disk pages before any journal writes.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "start", pages: { ...onDisk }, records: 0, committed: 0 },
    };
    step += 1;

    for (const tx of transactions) {
        journal.push(`BEGIN ${tx.id}`);
        for (const op of tx.ops) {
            journal.push(`UPDATE ${tx.id} ${op.page}=${op.value}`);
            yield {
                stepNumber: step,
                entities: makeEntities(onDisk, op.page),
                edges: [],
                description: `Journaled update ${tx.id}: page ${op.page} will become ${op.value}; disk is not yet changed.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { phase: "journal", pages: { ...onDisk }, records: journal.length, committed: 0 },
            };
            step += 1;
        }
        if (tx.committed) {
            journal.push(`COMMIT ${tx.id}`);
        }
        yield {
            stepNumber: step,
            entities: makeEntities(onDisk, null),
            edges: [],
            description: `Transaction ${tx.id} recorded as ${tx.committed ? "committed" : "incomplete"} in the journal.`,
            codeLineNumber: tx.committed ? 3 : 2,
            layout: "array",
            meta: { phase: "journal", pages: { ...onDisk }, records: journal.length, committed: transactions.filter((t) => t.committed).length },
        };
        step += 1;
    }

    let inRecovery = { ...onDisk };
    const committed = transactions.filter((tx) => tx.committed);
    for (const tx of committed) {
        for (const op of tx.ops) {
            inRecovery[op.page] = op.value;
            yield {
                stepNumber: step,
                entities: makeEntities(inRecovery, op.page),
                edges: [],
                description: `Recovery replays committed ${tx.id}: page ${op.page} set to ${op.value}.`,
                codeLineNumber: 5,
                layout: "array",
                meta: { phase: "recover", pages: { ...inRecovery }, records: journal.length, committed: committed.length },
            };
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeEntities(inRecovery, null),
        edges: [],
        description: `Recovery complete: ${committed.length} committed transaction(s) replayed, incomplete ones discarded.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { phase: "done", pages: { ...inRecovery }, records: journal.length, committed: committed.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Writing a note about a change before making the change is the core of journaling. If the machine crashes, a recovery pass reads the notes, keeps only the ones marked committed, and re-applies them. Transactions that never reached their commit marker are thrown away, so partial writes never appear.",
        invariants: [
            "Every update is written to the journal before the on-disk page image changes.",
            "A transaction's commit marker appears only after all of its update records.",
            "Recovery applies exactly the updates belonging to committed transactions.",
        ],
        correctness:
            "Replaying committed updates in journal order reconstructs the same page state that an uninterrupted run would have produced, because each update is a deterministic assignment. Incomplete transactions have no commit marker, so skipping them leaves no partial effects, which the test checks against brute force.",
        complexityRationale:
            "Writing the journal and replaying it each scan every record once, giving O(records) time and O(records plus pages) space.",
        uses: [
            "Crash consistency in file systems such as ext4 and NTFS",
            "Write-ahead logs in database storage engines",
            "Teaching the difference between journaled and in-place writes",
        ],
        references: [
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, chapter on file systems",
            "Ramabadran, Journaling File Systems, 2002",
        ],
        workedExample:
            "With pages A equals one, B equals two, C equals zero, a committed transaction sets A to five and B to eight while an incomplete one would set C to nine. Recovery replays only the committed writes, ending at A five, B eight, C zero.",
    },
    id: "journaling-file-system",
    name: "Journaling File System Recovery",
    category: "production-systems",
    complexity: { time: "O(records)", space: "O(records + pages)" },
    defaultInput: {
        pages: { A: 1, B: 2, C: 0 },
        transactions: [
            { id: "T1", committed: true, ops: [{ page: "A", value: 5 }, { page: "B", value: 8 }] },
            { id: "T2", committed: false, ops: [{ page: "C", value: 9 }] },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read initial page images and the transaction list",
        "for each transaction write a begin record to the journal",
        "write each update record before touching the page",
        "append a commit record only when the transaction finishes",
        "on recovery scan the journal for committed transactions",
        "replay their updates in order onto the page images",
        "report the recovered page state",
    ],
};

export default module;
