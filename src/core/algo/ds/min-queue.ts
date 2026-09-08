/**
 * min-queue.ts – Min Queue
 *
 * A FIFO queue that also reports its minimum: two stacks each track
 * their own minima, and the queue minimum is the smaller stack top.
 * Everything stays amortized O(1).
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
    const ops = task.ops ?? [["enq", 4], ["enq", 2], ["enq", 7], ["deq"], ["enq", 1]];
    let step = 0;

    const inStack: Array<{ v: number; m: number }> = [];
    const outStack: Array<{ v: number; m: number }> = [];
    const content = (): number[] =>
        [...outStack]
            .reverse()
            .map((e) => e.v)
            .concat(inStack.map((e) => e.v));
    const minNow = (): number => {
        const a = outStack.length > 0 ? (outStack[outStack.length - 1]?.m ?? Infinity) : Infinity;
        const b = inStack.length > 0 ? (inStack[inStack.length - 1]?.m ?? Infinity) : Infinity;
        return Math.min(a, b);
    };
    const snap = (hot: string, message: string, line: number): VisualFrame => {
        const items = content();
        const mn = items.length > 0 ? minNow() : -1;
        return {
            stepNumber: step,
            entities: nonEmpty(
                items.map((v, i) => ({
                    id: `mq-${i}`,
                    type: "cell" as const,
                    label: String(v),
                    value: v,
                    state: (hot === `q${i}`
                        ? "comparing"
                        : v === mn
                          ? "highlight"
                          : "idle") as EntityState,
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
            meta: { size: items.length, min: mn },
        };
    };

    yield snap("", "Empty min-queue.", 0);
    step += 1;
    for (const [op, v] of ops) {
        if (op === "enq" && v !== undefined) {
            const m = inStack.length > 0 ? Math.min(v, inStack[inStack.length - 1]?.m ?? v) : v;
            inStack.push({ v, m });
            yield snap(`q${content().length - 1}`, `Enqueued ${v} – minimum now ${minNow()}.`, 1);
        } else {
            if (outStack.length === 0) {
                while (inStack.length > 0) {
                    const e = inStack.pop();
                    if (e === undefined) {
                        break;
                    }
                    const m =
                        outStack.length > 0
                            ? Math.min(e.v, outStack[outStack.length - 1]?.m ?? e.v)
                            : e.v;
                    outStack.push({ v: e.v, m });
                }
                yield snap("", "Out-stack empty – drained the in-stack over (amortized).", 2);
                step += 1;
            }
            const d = outStack.pop()?.v ?? -1;
            const rest = content();
            yield snap("", `Dequeued ${d} – minimum now ${rest.length > 0 ? minNow() : "n/a"}.`, 2);
        }
        step += 1;
    }
    yield snap(
        "",
        `Final queue [${content().join(",")}] with minimum ${content().length > 0 ? minNow() : "n/a"}.`,
        3,
    );
}

const module: AlgorithmModule = {
    id: "min-queue",
    name: "Min Queue",
    category: "data-structures",
    complexity: { time: "O(1) amortized", space: "O(n)" },
    defaultInput: { ops: [["enq", 4], ["enq", 2], ["enq", 7], ["deq"], ["enq", 1]] },
    visualType: "grid",
    run,
};

export default module;
