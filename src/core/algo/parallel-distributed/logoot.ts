/**
 * logoot.ts - Logoot Sequence CRDT
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Logoot is a sequence conflict-free replicated data type used for collaborative
 * editing. Every element carries an immutable identifier made of a fractional
 * position and the id of its originating site. Elements are ordered by position
 * and then by site id, so concurrent insertions at the same spot are ordered
 * deterministically and replicas that receive operations in different orders
 * converge to the same sequence. Deletions target an existing identifier.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L log L) to order a sequence of L elements after each operation
 *   Space: O(L) for the sequence of identified elements
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Current sequence characters are shown left to right as a text strip.
 *   - A newly inserted character is highlighted; a deleted one is marked red.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Op {
    type: "insert" | "delete";
    pos: number[];
    site: string;
    char: string;
}

interface Element {
    pos: number[];
    site: string;
    char: string;
}

/** Compare identifiers lexicographically by position, then by site id. */
function compareIds(a: Element, b: Element): number {
    const len = Math.max(a.pos.length, b.pos.length);
    for (let i = 0; i < len; i += 1) {
        const av = a.pos[i] ?? 0;
        const bv = b.pos[i] ?? 0;
        if (av !== bv) {
            return av - bv;
        }
    }
    return a.site < b.site ? -1 : a.site > b.site ? 1 : 0;
}

/** Build the character strip for the current sequence. */
function makeCharacters(elements: Element[], highlight: number, deleted: boolean): VisualEntity[] {
    const sorted = elements.slice().sort(compareIds);
    return sorted.map((element, index) => {
        const state: EntityState =
            index === highlight ? (deleted ? "error" : "active") : "idle";
        return {
            id: `char-${element.pos.join(".")}-${element.site}`,
            type: "character" as const,
            label: element.char,
            value: element.char,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, site: element.site },
        };
    });
}

/** Apply one Logoot operation to a replica's local sequence. */
function apply(elements: Element[], op: Op): number {
    const key = (element: Element): string => `${element.pos.join(".")}@${element.site}`;
    const target = elements.findIndex((element) => key(element) === `${op.pos.join(".")}@${op.site}`);
    if (op.type === "delete") {
        if (target >= 0) {
            elements.splice(target, 1);
        }
        return elements.findIndex((element) => element.char === op.char && element.site === op.site);
    }
    elements.push({ pos: op.pos.slice(), site: op.site, char: op.char });
    elements.sort(compareIds);
    return elements.findIndex((element) => key(element) === `${op.pos.join(".")}@${op.site}`);
}

/** Replay a delivery order of Logoot operations at one replica. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { operations?: Op[] } | null) ?? {};
    const operations: Op[] = Array.isArray(task.operations)
        ? task.operations.map((op) => ({
              type: op?.type === "delete" ? "delete" : "insert",
              pos: Array.isArray(op?.pos) ? op.pos.map((n) => Number(n) || 0) : [],
              site: String(op?.site ?? "A"),
              char: String(op?.char ?? "?"),
          }))
        : [
              { type: "insert", pos: [5], site: "B", char: "b" },
              { type: "insert", pos: [3], site: "A", char: "a" },
              { type: "insert", pos: [5], site: "A", char: "c" },
              { type: "insert", pos: [4], site: "C", char: "d" },
              { type: "delete", pos: [3], site: "A", char: "a" },
          ];

    const elements: Element[] = [];
    yield {
        stepNumber: 0,
        entities: [],
        edges: [],
        description: `Empty Logoot replica awaiting ${operations.length} operation(s).`,
        codeLineNumber: 0,
        layout: "text",
        meta: { sequence: "", length: 0, operation: 0 },
    };

    let step = 1;
    for (let index = 0; index < operations.length; index += 1) {
        const op = operations[index];
        if (!op) {
            continue;
        }
        const highlight = apply(elements, op);
        const sequence = elements.slice().sort(compareIds).map((element) => element.char).join("");
        yield {
            stepNumber: step,
            entities: makeCharacters(elements, highlight, op.type === "delete"),
            edges: [],
            description: `Operation ${index + 1}: site ${op.site} ${op.type}s '${op.char}' at position [${op.pos.join(",")}]; sequence is now '${sequence}'.`,
            codeLineNumber: op.type === "insert" ? 2 : 4,
            layout: "text",
            meta: { sequence, length: elements.length, operation: index + 1 },
        };
        step += 1;
    }

    const finalSequence = elements.slice().sort(compareIds).map((element) => element.char).join("");
    yield {
        stepNumber: step,
        entities: makeCharacters(elements, -1, false),
        edges: [],
        description: `Converged sequence '${finalSequence}' of length ${elements.length}.`,
        codeLineNumber: 6,
        layout: "text",
        meta: { sequence: finalSequence, length: elements.length, operation: operations.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Give every character an immutable address made of a fractional position plus the id of the computer that created it. To insert, choose a position between the neighbors; to delete, name the address you saw. Because replicas order characters by their addresses, two people typing in the same gap get a stable order decided by their site ids, and everyone ends up with the same document without locking.",
        invariants: [
            "Each element's identifier is immutable once created.",
            "The displayed order is always ascending by position and then by site id.",
            "A delete removes exactly the element whose identifier it names.",
        ],
        correctness:
            "Every insertion adds a unique (position, site) identifier, and the ordering rule is a strict total order on those identifiers. Insert and delete operations therefore commute: applying them in any delivery order yields the same set of surviving elements, which the same ordering rule arranges identically. Hence all replicas converge to the same sequence without a central arbiter.",
        complexityRationale:
            "Applying an operation scans the sequence to locate an identifier and re-sorts, costing O(L log L) for a sequence of L elements; a balanced index can reduce this to O(log L). Space is O(L) for the identified elements.",
        uses: [
            "Collaborative text editors and shared whiteboards",
            "Offline-first note taking that later synchronizes changes",
            "Any replicated list that must merge concurrent edits without a server",
        ],
        references: [
            "Weiss, Urso, and Molli, Logoot: A Scalable Optimistic Replication Algorithm for Collaborative Editing, 2009",
            "Shapiro, Preguica, Baquero, and Zawirski, Conflict-Free Replicated Data Types, 2011",
        ],
        workedExample:
            "Site B inserts 'b' at [5], site A inserts 'a' at [3] and 'c' at [5], and site C inserts 'd' at [4]. Ordering by position then site gives a, d, c, b. Deleting the [3] entry for 'a' leaves the convergent sequence d, c, b.",
    },
    id: "logoot",
    name: "Logoot Sequence CRDT",
    category: "parallel-distributed",
    complexity: { time: "O(L log L)", space: "O(L)" },
    defaultInput: {
        operations: [
            { type: "insert", pos: [5], site: "B", char: "b" },
            { type: "insert", pos: [3], site: "A", char: "a" },
            { type: "insert", pos: [5], site: "A", char: "c" },
            { type: "insert", pos: [4], site: "C", char: "d" },
            { type: "delete", pos: [3], site: "A", char: "a" },
        ],
    },
    visualType: "text",
    run,
    pseudocode: [
        "start with an empty sequence of identified elements",
        "for each delivered operation in arrival order",
        "on insert, append an element keyed by position and site",
        "on delete, remove the element with the named identifier",
        "sort all elements by position, breaking ties by site id",
        "emit the sequence after each operation",
        "done: report the converged sequence",
    ],
};

export default module;
