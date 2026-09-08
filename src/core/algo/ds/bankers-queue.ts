/**
 * bankers-queue.ts – Banker's Queue
 *
 * Okasaki's persistent queue: a front stream plus a reversed rear
 * stream. Appends are O(1); when the front empties, the rear rotates
 * forward – the rotation cost is prepaid by debits, hence amortized O(1).
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
    const task = (input as { ops?: Array<["snoc" | "tail", number?]> } | null) ?? {};
    const ops = task.ops ?? [["snoc", 1], ["snoc", 2], ["tail"], ["snoc", 3]];
    let step = 0;

    let front: number[] = [];
    let rear: number[] = [];
    const content = (): number[] => [...front, ...[...rear].reverse()];
    const snap = (hot: number, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            content().map((v, i) => ({
                id: `bq-${i}`,
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
        meta: { front: front.length, rear: rear.length },
    });

    yield snap(-1, "Empty banker queue – front stream plus reversed rear.", 0);
    step += 1;
    for (const [op, v] of ops) {
        if (op === "snoc" && v !== undefined) {
            rear.push(v);
            yield snap(content().length - 1, `snoc(${v}) onto the rear – O(1), debits prepaid.`, 1);
        } else {
            if (front.length === 0) {
                front = [...rear].reverse();
                rear = [];
                yield snap(-1, "Front empty – rear rotates forward (amortized by debits).", 2);
                step += 1;
            }
            const d = front.shift() ?? -1;
            yield snap(-1, `tail() drops ${d} from the front.`, 2);
        }
        step += 1;
    }
    yield snap(-1, `Final queue [${content().join(",")}].`, 3);
}

const module: AlgorithmModule = {
    id: "bankers-queue",
    name: "Banker's Queue",
    category: "data-structures",
    complexity: { time: "O(1) amortized", space: "O(n)" },
    defaultInput: { ops: [["snoc", 1], ["snoc", 2], ["tail"], ["snoc", 3]] },
    visualType: "grid",
    run,
};

export default module;
