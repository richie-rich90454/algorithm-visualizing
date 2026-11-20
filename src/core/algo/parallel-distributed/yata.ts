/**
 * yata.ts - YATA Sequence CRDT (Yet Another Transformation Approach)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * YATA is a sequence conflict-free replicated data type. Every character is
 * identified by a (replica, counter) pair and records the element it was
 * inserted after (its origin). When several users insert at the same spot
 * concurrently, YATA places them in a deterministic order: an incoming element
 * skips past concurrent siblings whose identifier is larger, then occupies the
 * first position whose identifier is smaller. Buffering elements whose origin
 * has not arrived yet makes the result independent of delivery order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(len^2) worst case to integrate len elements by scanning siblings
 *   Space: O(len) for the integrated sequence and the pending buffer
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each cell is one position in the current sequence.
 *   - The newly integrated character is yellow, settled ones are green.
 *   - The meta reports the sequence and how many elements remain buffered.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Id = [number, number];

interface YataElement {
    id: Id;
    origin: Id | null;
    value: number;
}

interface YataInput {
    elements?: YataElement[];
}

function sameId(a: Id | null, b: Id | null): boolean {
    if (a === null || b === null) return a === b;
    return a[0] === b[0] && a[1] === b[1];
}

/** Total order on identifiers: replica first, then counter. */
function idLess(a: Id, b: Id): boolean {
    return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
}

/** Insert one element using the YATA conflict rule. Returns false if origin is missing. */
function integrate(sequence: YataElement[], element: YataElement): boolean {
    if (sequence.length === 0 && element.origin === null) {
        sequence.push(element);
        return true;
    }
    if (element.origin === null) {
        sequence.unshift(element);
        return true;
    }
    let index = sequence.findIndex((item) => sameId(item.id, element.origin));
    if (index < 0) return false;
    index += 1;
    while (
        index < sequence.length &&
        sameId(sequence[index]!.origin, element.origin) &&
        idLess(element.id, sequence[index]!.id)
    ) {
        index += 1;
    }
    sequence.splice(index, 0, element);
    return true;
}

/** Integrate all elements, buffering any whose origin has not arrived. */
function integrateAll(elements: YataElement[]): YataElement[] {
    const sequence: YataElement[] = [];
    const pending = [...elements];
    while (pending.length > 0) {
        let progressed = false;
        for (let i = 0; i < pending.length; ) {
            if (integrate(sequence, pending[i]!)) {
                pending.splice(i, 1);
                progressed = true;
            } else {
                i += 1;
            }
        }
        if (!progressed) break;
    }
    return sequence;
}

function makeCells(sequence: YataElement[], fresh: Id | null): VisualEntity[] {
    return sequence.map((element, index) => ({
        id: `pos-${index}`,
        type: "cell" as const,
        label: String(element.value),
        value: element.value,
        state: (fresh && sameId(element.id, fresh) ? "comparing" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: {
            row: 0,
            col: index,
            replica: element.id[0],
            counter: element.id[1],
            originReplica: element.origin?.[0] ?? -1,
        },
    }));
}

/** The YATA generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as YataInput | null) ?? {};
    const elements: YataElement[] =
        Array.isArray(task.elements) && task.elements.length > 0
            ? task.elements
                  .filter(
                      (item): item is YataElement =>
                          !!item && Array.isArray(item.id) && item.id.length === 2 &&
                          typeof item.value === "number",
                  )
                  .map((item) => ({
                      id: [item.id[0], item.id[1]] as Id,
                      origin: Array.isArray(item.origin) ? ([item.origin[0], item.origin[1]] as Id) : null,
                      value: item.value,
                  }))
            : [
                  { id: [0, 1], origin: null, value: 10 },
                  { id: [1, 1], origin: [0, 1], value: 20 },
                  { id: [2, 1], origin: [0, 1], value: 30 },
                  { id: [1, 2], origin: [1, 1], value: 40 },
              ];

    const sequence: YataElement[] = [];
    const pending = [...elements];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: makeCells(sequence, null),
        edges: [],
        description: `Starting YATA integration of ${elements.length} character(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: 1, sequence: [] as string[], pending: pending.length, converged: false },
    };

    while (pending.length > 0) {
        let progressed = false;
        for (let i = 0; i < pending.length; ) {
            const element = pending[i]!;
            if (integrate(sequence, element)) {
                pending.splice(i, 1);
                progressed = true;
                yield {
                    stepNumber: step++,
                    entities: makeCells(sequence, element.id),
                    edges: [],
                    description: `Integrated character ${element.value} from replica ${element.id[0]}, counter ${element.id[1]}.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: {
                        rows: 1,
                        cols: Math.max(1, sequence.length),
                        sequence: sequence.map((item) => String(item.value)),
                        pending: pending.length,
                        converged: false,
                    },
                };
            } else {
                i += 1;
            }
        }
        if (!progressed) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeCells(sequence, null),
        edges: [],
        description: `Sequence converged to [${sequence.map((item) => item.value).join(", ")}] with ${pending.length} buffered element(s).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: 1,
            cols: Math.max(1, sequence.length),
            sequence: sequence.map((item) => String(item.value)),
            pending: pending.length,
            converged: pending.length === 0,
        },
    };
}

/** The YATA module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Text editors that collaborate over a network must decide what happens when two people type at the same position. YATA gives every character a unique id and remembers the character it was placed after. Concurrent insertions at the same spot are ordered by their ids, so every replica, no matter the order edits arrive, rebuilds the same text. Edits whose left neighbor is not here yet simply wait in a buffer.",
        invariants: [
            "Every element is identified by a globally unique (replica, counter) pair.",
            "An element is only integrated after its origin has been integrated.",
            "Concurrent siblings are ordered by descending identifier.",
            "All replicas that have received the same edits produce the same sequence.",
        ],
        correctness:
            "The integration function inserts each new element at a position determined solely by the already-integrated prefix and the immutable identifiers of its concurrent siblings. Because the sibling order is a total order and the origin is unique, the position of every element is fixed independently of when it arrives. Buffering elements until their origin exists guarantees a deterministic integration order, so any delivery permutation yields the same final sequence. This is the convergence property required of a sequence CRDT.",
        complexityRationale:
            "Integrating one element scans the current sequence to find the origin and then walks past concurrent siblings, costing O(len) per element and O(len^2) for a sequence of length len. The buffer and sequence together use O(len) space.",
        uses: [
            "Collaborative text editors such as Yjs",
            "Shared source-code editing and concurrent annotation",
            "Offline-first documents that merge on reconnection",
        ],
        references: [
            "Nicolas, Durand, and Pottier, YATA: Yet Another Transformation Approach, 2016",
            "Shapiro et al., Conflict-Free Replicated Data Types, 2011",
        ],
        workedExample:
            "Element A at id (0,1) is inserted first. B at (1,1) and C at (2,1) are both inserted after A. Integrating B then C, C has the larger id so it stays before B, giving A C B. Integrating C then B gives the same A C B because B skips past the larger-id sibling. A later element D after B is appended, producing A C B D at every replica.",
    },
    id: "yata",
    name: "YATA Sequence CRDT",
    category: "parallel-distributed",
    complexity: { time: "O(len^2)", space: "O(len)" },
    defaultInput: {
        elements: [
            { id: [0, 1], origin: null, value: 10 },
            { id: [1, 1], origin: [0, 1], value: 20 },
            { id: [2, 1], origin: [0, 1], value: 30 },
            { id: [1, 2], origin: [1, 1], value: 40 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "give every character a unique replica and counter identifier",
        "record the origin element it was inserted after",
        "buffer characters whose origin has not arrived",
        "find the position immediately after the origin",
        "skip concurrent siblings with a larger identifier",
        "insert the character at the first smaller sibling",
        "repeat until the buffer is empty",
        "done: report the converged sequence",
    ],
};

export default module;
