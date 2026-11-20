/**
 * lseq-crdt.ts - LSEQ-Style Sequence CRDT (Simplified Identifier Allocation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A sequence CRDT lets several sites insert characters concurrently and still
 * converge on one order without a central lock. Each insert receives an
 * identifier built from the identifier of its anchor plus the site number and
 * operation number. Identifiers are compared lexicographically, so a character
 * inserted after an anchor always follows it, and concurrent inserts at the
 * same anchor are ordered by site. Every replica sorts by identifier and sees
 * the same final string.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is an EXACT SIMULATION of identifier generation and merge for a small
 * operation log. It uses a compact tree identifier with a fixed site digit
 * rather than LSEQ's full boundary-and-step exponential tree, so allocation is
 * deterministic and collision-free but not space-optimal. It does not simulate
 * network delivery, tombstones, or deletes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m log m) to sort m operation identifiers
 *   Space: O(m * depth) for the identifiers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Characters of the merged sequence are shown in order.
 *   - The most recently inserted character is active; earlier ones are idle.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type InsertOp = { op: number; site: number; anchor: number; char: string };
type CrdtInput = { ops?: InsertOp[] };

function resolve(op: InsertOp, byId: Map<number, InsertOp>, memo: Map<number, number[]>): number[] {
    const cached = memo.get(op.op);
    if (cached) {
        return cached;
    }
    if (op.anchor < 0 || !byId.has(op.anchor)) {
        const id = [op.site, op.op];
        memo.set(op.op, id);
        return id;
    }
    const parent = byId.get(op.anchor) as InsertOp;
    const id = [...resolve(parent, byId, memo), op.site, op.op];
    memo.set(op.op, id);
    return id;
}

function compareIds(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
        if ((a[i] as number) !== (b[i] as number)) {
            return (a[i] as number) - (b[i] as number);
        }
    }
    return a.length - b.length;
}

function mergedSequence(ops: InsertOp[]): Array<{ char: string; id: number[]; op: InsertOp }> {
    const byId = new Map(ops.map((op) => [op.op, op]));
    const memo = new Map<number, number[]>();
    return ops
        .map((op) => ({ char: op.char, id: resolve(op, byId, memo), op }))
        .sort((a, b) => compareIds(a.id, b.id));
}

function makeCharacters(sequence: Array<{ char: string; op: InsertOp }>, active: number): VisualEntity[] {
    return sequence.map((entry, index) => ({
        id: `char-${index}`,
        type: "character" as const,
        label: entry.char,
        value: entry.char,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, op: entry.op.op, site: entry.op.site },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CrdtInput | null) ?? {};
    const ops: InsertOp[] = Array.isArray(task.ops) && task.ops.length > 0
        ? task.ops.map((op) => ({ ...op }))
        : [
              { op: 1, site: 0, anchor: -1, char: "c" },
              { op: 2, site: 1, anchor: 1, char: "a" },
              { op: 3, site: 2, anchor: 1, char: "t" },
              { op: 4, site: 0, anchor: 2, char: "s" },
          ];

    const finalOrder = mergedSequence(ops);
    let step = 0;

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `${ops.length} concurrent insert operation(s) from ${new Set(ops.map((o) => o.site)).size} site(s) awaiting merge.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { operations: ops.length, sites: new Set(ops.map((o) => o.site)).size, sequence: "", applied: 0 },
    };
    step += 1;

    const byId = new Map(ops.map((op) => [op.op, op]));
    const memo = new Map<number, number[]>();
    const applied = new Set<number>();
    const canonical = [...ops].sort((a, b) => resolve(a, byId, memo).length - resolve(b, byId, memo).length || a.op - b.op);

    for (const op of canonical) {
        applied.add(op.op);
        const visible = mergedSequence(ops.filter((candidate) => applied.has(candidate.op)));
        const active = visible.findIndex((entry) => entry.op.op === op.op);
        yield {
            stepNumber: step,
            entities: makeCharacters(visible, active),
            edges: [],
            description: `Apply insert ${op.op} from site ${op.site}: place '${op.char}' after anchor ${op.anchor} by identifier order.`,
            codeLineNumber: 2,
            layout: "text",
            meta: {
                operations: ops.length,
                sites: new Set(ops.map((o) => o.site)).size,
                sequence: visible.map((entry) => entry.char).join(""),
                applied: applied.size,
                identifier: resolve(op, byId, memo),
            },
        };
        step += 1;
    }

    const finalChars = finalOrder.map((entry) => entry.char).join("");
    yield {
        stepNumber: step,
        entities: makeCharacters(finalOrder, -1),
        edges: [],
        description: `Merge complete: every replica converges on '${finalChars}'.`,
        codeLineNumber: 5,
        layout: "text",
        meta: {
            operations: ops.length,
            sites: new Set(ops.map((o) => o.site)).size,
            sequence: finalChars,
            applied: ops.length,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Give every character an address made of the address of the character it follows, its author, and its operation number. Sorting addresses is the same on every machine, so no matter what order updates arrive, all replicas reconstruct the same text. Concurrent inserts at the same spot are separated automatically by the author digit.",
        invariants: [
            "An insert's identifier strictly extends its anchor's identifier.",
            "Identifiers are unique across all operations.",
            "Sorting identifiers is deterministic and independent of delivery order.",
        ],
        correctness:
            "The identifier of an operation depends only on its anchor chain, site, and operation number, never on when a replica receives it. Lexicographic sorting therefore produces the same sequence everywhere. Since a child identifier begins with its parent's identifier, an anchored character always appears after its anchor, so causal order is preserved.",
        complexityRationale:
            "Resolving each identifier follows its anchor chain, and sorting m identifiers costs O(m log m) comparisons of O(depth) digits. Storing the identifiers uses O(m * depth) space.",
        uses: [
            "Collaborative editors that merge concurrent typing offline",
            "Replicated lists and outlines in local-first applications",
            "Teaching causality and convergence without operational transform",
        ],
        references: [
            "Baptista, LSEQ: An Adaptive Structure for Sequences in Distributed Collaborative Editing, 2013",
            "Shapiro, Preguica, Baquero, and Zawirski, Conflict-Free Replicated Data Types, 2011",
        ],
        workedExample:
            "Site 0 inserts 'c' at the start. Sites 1 and 2 concurrently insert 'a' and 't' after it. Their identifiers share the prefix for 'c' but differ in the site digit, so every replica sorts to 'cat' regardless of which insertion arrived first.",
    },
    id: "lseq-crdt",
    name: "LSEQ-Style Sequence CRDT (Simplified Allocation)",
    category: "parallel-distributed",
    complexity: { time: "O(m log m)", space: "O(m*depth)" },
    defaultInput: {
        ops: [
            { op: 1, site: 0, anchor: -1, char: "c" },
            { op: 2, site: 1, anchor: 1, char: "a" },
            { op: 3, site: 2, anchor: 1, char: "t" },
            { op: 4, site: 0, anchor: 2, char: "s" },
        ],
    },
    visualType: "text",
    run,
    pseudocode: [
        "each insert references the operation it follows",
        "build its identifier from the anchor identifier and site",
        "append the operation number to keep identifiers unique",
        "on merge sort all identifiers lexicographically",
        "a child identifier follows its parent's identifier",
        "read the characters in sorted order",
        "done: every replica shows the same sequence",
    ],
};

export default module;
