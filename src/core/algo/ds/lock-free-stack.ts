/**
 * lock-free-stack.ts – Lock-Free Stack (Treiber)
 *
 * Treiber's CAS stack: push and pop each retry a single compare-and-swap
 * on the top pointer, so threads never block – this demo drives the
 * successful CAS path with reclamation notes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const nonEmpty = (list: VisualEntity[]): VisualEntity[] =>
    list.length > 0
        ? list
        : [
              {
                  id: "empty-note",
                  type: "cell" as const,
                  label: "(empty)",
                  value: 0,
                  state: "idle" as EntityState,
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  metadata: { row: 0, col: 0 },
              },
          ];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { ops?: Array<["push" | "pop", number?]> } | null) ?? {};
    const ops = task.ops ?? [["push", 1], ["push", 2], ["pop"], ["push", 3]];
    let step = 0;
    let cas = 0;

    const stack: number[] = [];
    const snap = (hot: number, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            [...stack].reverse().map((v, i) => ({
                id: `lfs-${i}`,
                type: "cell" as const,
                label: String(v),
                value: v,
                state: (i === hot ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: i },
            })),
        ),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { size: stack.length, cas },
    });

    yield snap(-1, "Empty Treiber stack – top pointer null.", 0);
    step += 1;
    for (const [op, v] of ops) {
        if (op === "push" && v !== undefined) {
            stack.push(v);
            cas += 1;
            yield snap(0, `push(${v}) – CAS ${cas} swung top to the new node.`, 1);
        } else {
            const d = stack.pop() ?? -1;
            cas += 1;
            yield snap(-1, `pop() – CAS ${cas} swung top down, returning ${d} (reclaimed).`, 2);
        }
        step += 1;
    }
    yield snap(
        -1,
        `Final stack (top first) [${[...stack].reverse().join(",")}] after ${cas} CAS steps.`,
        3,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "The Treiber stack is a lock-free LIFO where push and pop each perform a single compare-and-swap on the top pointer. On contention a thread simply retries with the updated top, so no thread blocks and the stack remains consistent. The demo drives the successful CAS path and notes reclamation.",
        "invariants": [
            "Top points to the most recently pushed live node.",
            "Each node's next pointer links to the previous top.",
            "CAS is the only writer of top, preventing torn updates."
        ],
        "correctness": "Push creates a node pointing to the current top and CAS-installs it; if another thread changed top, the CAS fails and the thread retries. Pop CAS-advances top to the next node and returns the old top's value, so the most recent push is always the first pop. Retries preserve LIFO order.",
        "complexityRationale": "Each operation is O(1) expected, with retries under contention. Nodes hold one value and one next pointer, O(n) space, plus deferred reclamation concerns.",
        "uses": [
            "Lock-free stacks in runtimes",
            "Memory reclamation research",
            "Nonblocking work queues with LIFO semantics"
        ],
        "references": [
            "R. K. Treiber, \"Systems Programming: Coping with Parallelism\", RJ5118, 1986",
            "Herlihy and Shavit, The Art of Multiprocessor Programming, Chapter 7"
        ],
        "workedExample": "Start with top null. Push 1 sets top to node 1; push 2 sets top to node 2 pointing to 1. Pop CAS-advances top back to node 1 and returns 2. A concurrent push that loses the CAS simply retries against the new top."
    },
    id: "lock-free-stack",
    name: "Lock-Free Stack",
    category: "data-structures",
    complexity: { time: "O(1) expected", space: "O(n)" },
    defaultInput: { ops: [["push", 1], ["push", 2], ["pop"], ["push", 3]] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize Treiber stack with null top pointer",
        "push value by CAS-linking node as new top",
        "compare top pointer to detect contention",
        "pop by CAS-advancing top to next node",
        "retry CAS loop on concurrent interference",
        "count pushes and pops for verification",
        "done: stack holds remaining values in LIFO order",
    ],
};

export default module;
