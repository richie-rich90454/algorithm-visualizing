/**
 * top-tree.ts – Top Tree
 *
 * A dynamic tree compressed into clusters: rake merges glue side
 * subtrees, compress merges glue path pieces. Path aggregates (here the
 * maximum edge weight) are maintained per cluster.
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
    const task = (input as { chain?: number[]; weights?: number[] } | null) ?? {};
    const chain = task.chain ?? [1, 2, 3, 4];
    const weights = task.weights ?? [5, 2, 7];
    let step = 0;

    const clusters: Array<{ members: number[]; max: number; kind: string }> = [];
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nonEmpty(
            clusters.map((c, i) => ({
                id: `cluster-${i}`,
                type: "cell" as const,
                label: `${c.kind}[${c.members.join(",")}]:${c.max}`,
                value: c.max,
                state: (hot.has(i) ? "comparing" : "idle") as EntityState,
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
        meta: { clusters: clusters.length },
    });

    yield snap(new Set(), `Path ${chain.join("-")} – every edge starts as its own cluster.`, 0);
    step += 1;
    for (let i = 0; i < weights.length; i += 1) {
        clusters.push({
            members: [chain[i] ?? 0, chain[i + 1] ?? 0],
            max: weights[i] ?? 0,
            kind: "e",
        });
        yield snap(
            new Set([i]),
            `Edge cluster (${chain[i]},${chain[i + 1]}) carries max ${weights[i]}.`,
            1,
        );
        step += 1;
    }
    while (clusters.length > 1) {
        const a = clusters.shift();
        const b = clusters.shift();
        if (a === undefined || b === undefined) {
            break;
        }
        const merged = {
            members: [...new Set([...a.members, ...b.members])],
            max: Math.max(a.max, b.max),
            kind: "c",
        };
        clusters.unshift(merged);
        yield snap(new Set([0]), `Compress merges two clusters – path max now ${merged.max}.`, 2);
        step += 1;
    }
    const answer = clusters[0]?.max ?? 0;
    yield snap(new Set([0]), `One root cluster remains – path maximum is ${answer}.`, 3);
}

const module: AlgorithmModule = {
    id: "top-tree",
    name: "Top Tree",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { chain: [1, 2, 3, 4], weights: [5, 2, 7] },
    visualType: "grid",
    run,
};

export default module;
