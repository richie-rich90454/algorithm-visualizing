/**
 * two-stack-queue.ts – Two-Stack Queue
 *
 * Amortized FIFO from two LIFOs: pushes pile onto the in-stack, and a
 * pop drains it into the out-stack only when the out-stack runs dry –
 * so each element moves at most twice.
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
    const task = (input as { ops?: Array<["enq" | "deq", number?]> } | null) ?? {};
    const ops = task.ops ?? [["enq", 1], ["enq", 2], ["deq"], ["enq", 3], ["deq"]];
    let step = 0;

    const inStack: number[] = [];
    const outStack: number[] = [];
    const content = (): number[] => [...outStack].reverse().concat(inStack);
    const snap = (hot: number, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            content().map((v, i) => ({
                id: `tsq-${i}`,
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
        meta: { inStack: inStack.length, outStack: outStack.length },
    });

    yield snap(-1, "Empty two-stack queue.", 0);
    step += 1;
    for (const [op, v] of ops) {
        if (op === "enq" && v !== undefined) {
            inStack.push(v);
            yield snap(content().length - 1, `Enqueued ${v} onto the in-stack.`, 1);
        } else {
            if (outStack.length === 0) {
                while (inStack.length > 0) {
                    const e = inStack.pop();
                    if (e !== undefined) {
                        outStack.push(e);
                    }
                }
                yield snap(
                    -1,
                    "Out-stack dry – drained the in-stack over (each element moves once).",
                    2,
                );
                step += 1;
            }
            const d = outStack.pop() ?? -1;
            yield snap(-1, `Dequeued ${d} from the out-stack.`, 2);
        }
        step += 1;
    }
    yield snap(-1, `Final queue [${content().join(",")}].`, 3);
}

const module: AlgorithmModule = {
    id: "two-stack-queue",
    name: "Two-Stack Queue",
    category: "data-structures",
    complexity: { time: "O(1) amortized", space: "O(n)" },
    defaultInput: { ops: [["enq", 1], ["enq", 2], ["deq"], ["enq", 3], ["deq"]] },
    visualType: "grid",
    run,
};

export default module;
