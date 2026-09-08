/**
 * lock-free-queue-michael-scott.ts – Lock-Free Queue (Michael-Scott)
 *
 * The classic CAS queue: enqueue swings the tail's next pointer, dequeue
 * swings the head – each helped along by lagging-pointer fixes, so both
 * ends progress without locks.
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
    const ops = task.ops ?? [["enq", 1], ["enq", 2], ["deq"], ["enq", 3]];
    let step = 0;
    let cas = 0;

    const queue: number[] = [];
    const snap = (hot: number, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            queue.map((v, i) => ({
                id: `msq-${i}`,
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
        meta: { size: queue.length, cas },
    });

    yield snap(-1, "Empty Michael-Scott queue – head and tail share a dummy.", 0);
    step += 1;
    for (const [op, v] of ops) {
        if (op === "enq" && v !== undefined) {
            queue.push(v);
            cas += 2;
            yield snap(
                queue.length - 1,
                `enq(${v}) – tail-next CAS then tail swing (${cas} CAS total).`,
                1,
            );
        } else {
            const d = queue.shift() ?? -1;
            cas += 1;
            yield snap(
                -1,
                d >= 0
                    ? `deq() – head CAS swings forward, returning ${d}.`
                    : "deq() on empty – head CAS retries.",
                2,
            );
        }
        step += 1;
    }
    yield snap(-1, `Final queue [${queue.join(",")}] after ${cas} successful CAS steps.`, 3);
}

const module: AlgorithmModule = {
    id: "lock-free-queue-michael-scott",
    name: "Lock-Free Queue",
    category: "data-structures",
    complexity: { time: "O(1) expected", space: "O(n)" },
    defaultInput: { ops: [["enq", 1], ["enq", 2], ["deq"], ["enq", 3]] },
    visualType: "grid",
    run,
};

export default module;
