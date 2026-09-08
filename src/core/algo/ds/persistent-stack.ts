/**
 * persistent-stack.ts – Persistent Stack
 *
 * Immutable versions branch by sharing: pushing creates one new node
 * pointing at the old top, so every past version stays intact and
 * readable through its own root.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const nonEmpty = (list: VisualEntity[]): VisualEntity[] =>
    list.length > 0
        ? list
        : [
              {
                  id: "empty-node",
                  type: "node" as const,
                  label: "(empty)",
                  value: 0,
                  state: "idle" as EntityState,
                  x: 0,
                  y: 0,
                  width: 0,
                  height: 0,
                  metadata: { parentId: "root" },
              },
          ];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pushes?: number[]; branchFrom?: number } | null) ?? {};
    const pushes = task.pushes ?? [1, 2, 3];
    const branchFrom = task.branchFrom ?? 1;
    let step = 0;

    const nodes: Array<{ value: number; parent: number }> = [];
    const versions: number[] = [];
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            nodes.map((n, i) => ({
                id: `ps-${i}`,
                type: "node" as const,
                label: String(n.value),
                value: n.value,
                state: (hot.has(i) ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: n.parent < 0 ? "root" : `ps-${n.parent}` },
            })),
        ),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "tree",
        meta: { versions: versions.length, nodes: nodes.length },
    });

    const chain = (top: number): number[] => {
        const out: number[] = [];
        let cur = top;
        while (cur >= 0) {
            const n = nodes[cur];
            if (n === undefined) {
                break;
            }
            out.push(n.value);
            cur = n.parent;
        }
        return out;
    };

    yield snap(new Set(), "Empty persistent stack – version 0 is the void.", 0);
    step += 1;
    let top = -1;
    for (const v of pushes) {
        nodes.push({ value: v, parent: top });
        top = nodes.length - 1;
        versions.push(top);
        yield snap(
            new Set([top]),
            `push(${v}) – version ${versions.length} shares the old top.`,
            1,
        );
        step += 1;
    }
    const base = versions[branchFrom] ?? -1;
    nodes.push({ value: 99, parent: base });
    versions.push(nodes.length - 1);
    yield snap(
        new Set([nodes.length - 1]),
        `Branch: push(99) onto version ${branchFrom + 1} – old versions untouched.`,
        2,
    );
    step += 1;
    yield snap(
        new Set(),
        `Versions read [${versions.map((t) => `[${chain(t).join(",")}]`).join(" ")}].`,
        3,
    );
}

const module: AlgorithmModule = {
    id: "persistent-stack",
    name: "Persistent Stack",
    category: "data-structures",
    complexity: { time: "O(1) per version", space: "O(versions)" },
    defaultInput: { pushes: [1, 2, 3], branchFrom: 1 },
    visualType: "tree",
    run,
};

export default module;
