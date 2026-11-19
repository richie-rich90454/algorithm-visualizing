/**
 * catenable-deque.ts - Catenable Deque
 *
 * A catenable deque supports the four end operations of a deque plus joining
 * two whole deques in constant time. It is built from a doubly linked list of
 * small chunks: catenation just splices one chunk chain onto the other, while
 * pushes and pops touch only an end chunk (creating or dropping a chunk when
 * one fills or empties). This is the simplest structure that makes concatenation
 * as cheap as a pointer update.
 *
 * Time:  O(1) amortized per operation, including catenate
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const CAP = 4;
interface Chunk {
    items: number[];
    prev: Chunk | null;
    next: Chunk | null;
}

class CatenableDeque {
    head: Chunk | null = null;
    tail: Chunk | null = null;

    constructor(values: number[] = []) {
        for (const value of values) this.pushBack(value);
    }

    pushBack(value: number): number {
        if (!this.tail || this.tail.items.length >= CAP) {
            const chunk: Chunk = { items: [], prev: this.tail, next: null };
            if (this.tail) this.tail.next = chunk;
            else this.head = chunk;
            this.tail = chunk;
        }
        this.tail.items.push(value);
        return this.tail.items.length - 1;
    }

    pushFront(value: number): number {
        if (!this.head || this.head.items.length >= CAP) {
            const chunk: Chunk = { items: [], prev: null, next: this.head };
            if (this.head) this.head.prev = chunk;
            else this.tail = chunk;
            this.head = chunk;
        }
        this.head.items.unshift(value);
        return 0;
    }

    popBack(): number | undefined {
        if (!this.tail) return undefined;
        const value = this.tail.items.pop();
        if (this.tail.items.length === 0) {
            const previous = this.tail.prev;
            if (previous) {
                previous.next = null;
                this.tail = previous;
            } else {
                this.head = null;
                this.tail = null;
            }
        }
        return value;
    }

    popFront(): number | undefined {
        if (!this.head) return undefined;
        const value = this.head.items.shift();
        if (this.head.items.length === 0) {
            const next = this.head.next;
            if (next) {
                next.prev = null;
                this.head = next;
            } else {
                this.head = null;
                this.tail = null;
            }
        }
        return value;
    }

    catenate(other: CatenableDeque): void {
        if (!other.head) return;
        if (!this.head) {
            this.head = other.head;
            this.tail = other.tail;
            return;
        }
        if (this.tail) this.tail.next = other.head;
        other.head.prev = this.tail;
        this.tail = other.tail;
    }

    toArray(): number[] {
        const result: number[] = [];
        let chunk = this.head;
        while (chunk) {
            result.push(...chunk.items);
            chunk = chunk.next;
        }
        return result;
    }
}

/** Chunk list for the current frame, with a highlighted slot encoded as row/col. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        left?: number[];
        right?: number[];
        operations?: unknown[];
    } | null) ?? {};
    const left = Array.isArray(task.left) ? task.left : [1, 2, 3];
    const right = Array.isArray(task.right) ? task.right : [4, 5, 6];
    const rawOps = Array.isArray(task.operations)
        ? task.operations
        : [["pushFront", 0], ["pushBack", 7], ["popFront"], ["popBack"]];
    const deque = new CatenableDeque(left);
    const other = new CatenableDeque(right);
    let step = 0;
    let hot: [number, number] = [-1, -1];

    const snapshot = (message: string, line: number, values: number[]): VisualFrame => {
        const entities: VisualEntity[] = [];
        let row = 0;
        let chunk = deque.head;
        while (chunk) {
            chunk.items.forEach((value, col) => {
                entities.push({
                    id: `cd-${row}-${col}`,
                    type: "cell" as const,
                    label: String(value),
                    value,
                    state: (hot[0] === row && hot[1] === col ? "comparing" : "idle") as EntityState,
                    x: 0, y: 0, width: 0, height: 0,
                    metadata: { row, col, chunk: row },
                });
            });
            chunk = chunk.next;
            row += 1;
        }
        if (entities.length === 0) {
            entities.push({
                id: "cd-empty",
                type: "cell" as const,
                label: "(empty)",
                value: 0,
                state: "unvisited" as EntityState,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { row: 0, col: 0, empty: true },
            });
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { chunks: row, values: [...values] },
        };
    };

    yield snapshot(`Two deques: [${left.join(",")}] and [${right.join(",")}].`, 0, deque.toArray());
    step += 1;

    deque.catenate(other);
    hot = [-1, -1];
    yield snapshot(`Catenate in one pointer splice: [${deque.toArray().join(",")}].`, 1, deque.toArray());
    step += 1;

    for (const raw of rawOps) {
        const op = Array.isArray(raw) ? String(raw[0]) : String(raw);
        const value = Array.isArray(raw) && typeof raw[1] === "number" ? raw[1] : 0;
        if (op === "pushFront" || op === "unshift") {
            deque.pushFront(value);
            hot = [0, 0];
            yield snapshot(`Push ${value} onto the front.`, 2, deque.toArray());
        } else if (op === "pushBack" || op === "push") {
            const at = deque.pushBack(value);
            let row = 0;
            let chunk = deque.head;
            while (chunk?.next) { chunk = chunk.next; row += 1; }
            hot = [row, at];
            yield snapshot(`Push ${value} onto the back.`, 3, deque.toArray());
        } else if (op === "popFront" || op === "shift") {
            const removed = deque.popFront();
            hot = [0, 0];
            yield snapshot(`Pop ${removed ?? "nothing"} from the front.`, 4, deque.toArray());
        } else if (op === "popBack" || op === "pop") {
            const removed = deque.popBack();
            hot = [-1, -1];
            yield snapshot(`Pop ${removed ?? "nothing"} from the back.`, 5, deque.toArray());
        } else {
            yield snapshot(`Skip unknown operation ${op}.`, 6, deque.toArray());
        }
        step += 1;
    }

    yield snapshot(`Done: final deque is [${deque.toArray().join(",")}].`, 7, deque.toArray());
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A catenable deque is a deque whose join operation is as cheap as its end operations. It stores the sequence as a short doubly linked chain of fixed-size chunks. Joining two deques only rewires the two chunks at the seam, so no elements are copied, while pushes and pops stay at an end chunk.",
        invariants: [
            "Every chunk except possibly the two ends stays full.",
            "The head and tail pointers bracket the whole chunk chain in order.",
            "Catenation preserves left-before-right order by splicing tails to heads.",
        ],
        correctness:
            "Splicing the right deque's head after the left deque's tail produces exactly the concatenation of the two sequences because each chunk chain is internally ordered. End pushes append to a non-full end chunk or start a new one; end pops remove from an end chunk and discard it when empty, so the flattened chunk chain always equals the mathematical deque.",
        complexityRationale:
            "Each operation touches one end chunk and performs O(1) pointer updates, with an occasional chunk allocation or deletion, giving amortized O(1) time including catenate. Storage is O(n/CAP) chunks for n elements.",
        uses: [
            "Functional sequence libraries with cheap append",
            "Work-stealing schedulers that merge task deques",
            "Text buffers that join large runs without copying",
        ],
        references: [
            "Chris Okasaki, Purely Functional Data Structures, Chapter 10",
            "Ralf Hinze and Ross Paterson, 'Finger Trees: A Simple General-Purpose Data Structure', JFP 2006",
        ],
        workedExample:
            "Deque A [1,2,3] and deque B [4,5,6] each occupy one chunk. Catenation sets A's tail chunk to point at B's head chunk, yielding [1,2,3,4,5,6] without copying. A pushFront of 0 then gives [0,1,2,3,4,5,6].",
    },
    id: "catenable-deque",
    name: "Catenable Deque",
    category: "data-structures",
    complexity: { time: "O(1) amortized", space: "O(n)" },
    defaultInput: {
        left: [1, 2, 3],
        right: [4, 5, 6],
        operations: [["pushFront", 0], ["pushBack", 7], ["popFront"], ["popBack"]],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "build two deques from their starting values as chunk chains",
        "catenate by linking the left tail to the right head",
        "push front: insert into the head chunk or prepend a chunk",
        "push back: insert into the tail chunk or append a chunk",
        "pop front: remove from the head chunk and drop it if empty",
        "pop back: remove from the tail chunk and drop it if empty",
        "flatten the chunk chain to read the sequence",
        "done: report the final deque contents",
    ],
};

export default module;
