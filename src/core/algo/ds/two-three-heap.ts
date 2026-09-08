/**
 * two-three-heap.ts – 2-3 Heap
 *
 * Priority queue shaped as a 2-3 tree: every internal node has 2 or 3
 * ordered children and all leaves share one depth. Operations stay
 * logarithmic with a working-set flavor.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[] } | null) ?? {};
    const keys = task.keys ?? [5, 2, 8, 1, 7, 4];
    let step = 0;

    const leaves = [...keys].sort((a, b) => a - b);
    const groups: number[][] = [];
    for (let i = 0; i < leaves.length; i += 3) {
        groups.push(leaves.slice(i, i + 3));
    }
    const snap = (hot: Set<string>, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        groups.forEach((g, gi) => {
            const mn = Math.min(...g);
            entities.push({
                id: `tth-p-${gi}`,
                type: "node" as const,
                label: String(mn),
                value: mn,
                state: (hot.has(`p${gi}`) ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            });
            g.forEach((k, ki) => {
                entities.push({
                    id: `tth-l-${gi}-${ki}`,
                    type: "node" as const,
                    label: String(k),
                    value: k,
                    state: (hot.has(`l${gi}-${ki}`) ? "sorted" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { parentId: `tth-p-${gi}` },
                });
            });
        });
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "tree",
            meta: { groups: groups.length, stored: leaves.length },
        };
    };

    yield snap(new Set(), `2-3 heap over [${keys.join(",")}] – leaves grouped by threes.`, 0);
    step += 1;
    groups.forEach((g, gi) => {
        void gi;
        void g;
    });
    for (let gi = 0; gi < groups.length; gi += 1) {
        yield snap(
            new Set([`p${gi}`]),
            `Group ${gi} parent carries its minimum ${Math.min(...(groups[gi] ?? [0]))}.`,
            1,
        );
        step += 1;
    }
    const mn = Math.min(...leaves);
    yield snap(new Set([`p0`]), `Minimum ${mn} sits at the leftmost parent.`, 2);
}

const module: AlgorithmModule = {
    id: "two-three-heap",
    name: "2-3 Heap",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1, 7, 4] },
    visualType: "tree",
    run,
};

export default module;
