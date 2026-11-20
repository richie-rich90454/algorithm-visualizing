/**
 * crdt-rga-sequence.ts - RGA Replicated Sequence CRDT (Toy Simulation)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Replicated Growable Array is a conflict-free replicated sequence. Each
 * character is identified by a unique site and counter pair and remembers the
 * element it was inserted after. Concurrent insertions after the same element
 * are ordered by their identifiers, so every replica that has seen the same
 * operations converges to the same text regardless of delivery order. This is
 * a deterministic integration-rule simulation, not a full production CRDT with
 * tombstones and network delivery.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(m log m) for m insertions with sorted sibling lists
 *   Space: O(m) for the element tree and identifier map
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Each character in the converged sequence is a text box.
 *   - The newest insertion is yellow; the final sequence is green.
 *   - The identifier order and insertion index appear in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Operation {
    site: number;
    counter: number;
    after: number | null;
    char: string;
}

interface Element {
    id: string;
    site: number;
    counter: number;
    char: string;
    children: Element[];
}

/** True when a outranks b in the deterministic sibling order. */
function precedes(a: Element, b: Element): boolean {
    if (a.counter !== b.counter) {
        return a.counter > b.counter;
    }
    return a.site > b.site;
}

/** Build character boxes from the current DFS sequence. */
function makeCharacters(sequence: Element[], newestId: string, state: EntityState): VisualEntity[] {
    return sequence.map((element, index) => ({
        id: `char-${element.id}`,
        type: "character" as const,
        label: element.char,
        value: element.char,
        state: element.id === newestId ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, id: element.id, site: element.site, counter: element.counter },
    }));
}

/** The RGA integration generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { operations?: Operation[] } | null) ?? {};
    const operations: Operation[] = Array.isArray(task.operations) && task.operations.length > 0
        ? task.operations.map((op) => ({
            site: Math.floor(op.site),
            counter: Math.floor(op.counter),
            after: op.after === null || op.after === undefined ? null : Math.floor(op.after),
            char: typeof op.char === "string" && op.char.length > 0 ? op.char.slice(0, 1) : "?",
        }))
        : [
            { site: 0, counter: 0, after: null, char: "a" },
            { site: 1, counter: 0, after: 0, char: "b" },
            { site: 1, counter: 1, after: 0, char: "c" },
            { site: 0, counter: 1, after: 1, char: "d" },
            { site: 2, counter: 0, after: 2, char: "e" },
        ];

    const root: Element = { id: "root", site: -1, counter: -1, char: "", children: [] };
    const byId = new Map<string, Element>([["root", root]]);
    const ids = operations.map((op) => `${op.site}-${op.counter}`);
    const flatten = (): Element[] => {
        const result: Element[] = [];
        const stack = [...root.children].reverse();
        while (stack.length > 0) {
            const element = stack.pop();
            if (!element) {
                continue;
            }
            result.push(element);
            for (let i = element.children.length - 1; i >= 0; i -= 1) {
                stack.push(element.children[i]!);
            }
        }
        return result;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `Integrating ${operations.length} uniquely identified insertions into a replicated sequence.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { length: 0, sequence: "", applied: 0, newest: "" },
    };
    step += 1;

    for (let i = 0; i < operations.length; i += 1) {
        const op = operations[i]!;
        const parentId = op.after === null ? "root" : ids[op.after] ?? "root";
        const parent = byId.get(parentId) ?? root;
        const element: Element = {
            id: ids[i]!,
            site: op.site,
            counter: op.counter,
            char: op.char,
            children: [],
        };
        parent.children.push(element);
        parent.children.sort((a, b) => (precedes(a, b) ? -1 : precedes(b, a) ? 1 : 0));
        byId.set(element.id, element);
        const sequence = flatten();
        yield {
            stepNumber: step,
            entities: makeCharacters(sequence, element.id, "idle"),
            edges: [],
            description: `Inserted ${op.char} with id ${element.id} after ${parentId}; sequence is now ${sequence.map((e) => e.char).join("")}.`,
            codeLineNumber: op.after === null ? 1 : 3,
            layout: "text",
            meta: { length: sequence.length, sequence: sequence.map((e) => e.char).join(""), applied: i + 1, newest: element.id },
        };
        step += 1;
    }

    const sequence = flatten();
    yield {
        stepNumber: step,
        entities: makeCharacters(sequence, "", "sorted"),
        edges: [],
        description: `All replicas converge to "${sequence.map((e) => e.char).join("")}" for the same set of operations.`,
        codeLineNumber: 6,
        layout: "text",
        meta: { length: sequence.length, sequence: sequence.map((e) => e.char).join(""), applied: operations.length, newest: "" },
    };
}

/** The RGA sequence CRDT module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Give every inserted character a unique name made from its site and a local counter, and remember which character it followed. When two users insert at the same place, sort the competing insertions by their names. Because the rule is deterministic, all replicas arrange the same operations the same way even if the network delivers them in different orders.",
        invariants: [
            "Every element has a unique identifier of the form site-counter.",
            "Siblings under the same parent are always stored in descending identifier order.",
            "An element is only integrated after its referenced parent is present.",
        ],
        correctness:
            "The sequence is the preorder traversal of an insertion tree. A child is placed immediately after its parent and before later siblings of the parent, so concurrent edits at the same spot have a single deterministic order. Since the tree is defined only by element identifiers and their parents, any delivery order that respects parent-before-child builds the identical tree, and therefore the identical sequence.",
        complexityRationale:
            "Each insertion finds its parent in constant time and inserts into a sorted sibling list, costing O(log m) comparisons for a balanced view or O(m) in the worst case. Storing one node per insertion uses O(m) space.",
        uses: [
            "Collaborative text editors that merge edits from many users",
            "Shared lists and outlines in offline-first applications",
            "A teaching model for conflict-free replicated data types",
        ],
        references: [
            "Roh, Lee, and Lee, Replicated Abstract Data Types, 2011",
            "Shapiro et al., Conflict-Free Replicated Data Types, 2011",
        ],
        workedExample:
            "Site 0 inserts a, site 1 concurrently inserts b and then c after a, and site 2 inserts e after c. Identifiers order c before b because its counter is larger, so every replica renders a, c, e, b regardless of the order the four insertions arrived.",
    },
    id: "crdt-rga-sequence",
    name: "RGA Sequence CRDT (Toy Simulation)",
    category: "parallel-distributed",
    complexity: { time: "O(m log m)", space: "O(m)" },
    defaultInput: {
        operations: [
            { site: 0, counter: 0, after: null, char: "a" },
            { site: 1, counter: 0, after: 0, char: "b" },
            { site: 1, counter: 1, after: 0, char: "c" },
            { site: 0, counter: 1, after: 1, char: "d" },
            { site: 2, counter: 0, after: 2, char: "e" },
        ],
    },
    visualType: "text",
    run,
    pseudocode: [
        "assign each insertion a unique site and counter identifier",
        "record the identifier of the element it follows",
        "find the parent element in the local tree",
        "add the new element to the parent's child list",
        "sort siblings by descending identifier",
        "traverse the tree in preorder to render the sequence",
        "repeat until every operation has been integrated",
        "done: all replicas share the same character sequence",
    ],
};

export default module;
