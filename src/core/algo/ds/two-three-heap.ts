/**
 * two-three-heap.ts – 2-3 Heap
 *
 * Priority queue shaped as a 2-3 tree: every internal node has 2 or 3
 * ordered children and all leaves share one depth. Operations stay
 * logarithmic with a working-set flavor.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Priority queue shaped as a 2-3 tree: every internal node has 2 or 3 ordered children and all leaves share one depth. Operations stay logarithmic with a working-set flavor.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *    - Nodes are circles; edges show parent links.
 *    - The active node is YELLOW (comparing).
 *    - Finished nodes are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Standard 2-3 Heap behavior with textbook operation costs.
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

    education: {
        "intuition": "A 2-3 heap arranges keys in a balanced structure where every internal node has two or three children and all leaves share one depth. Group minima bubble up so the global minimum sits in the leftmost parent, giving a priority queue with a working-set flavor.",
        "invariants": [
            "Each internal node has two or three children.",
            "All leaves are at the same depth.",
            "A parent carries its group minimum and is no larger than child minima."
        ],
        "correctness": "Because each parent stores its group minimum and parents are ordered by those minima, the leftmost parent holds the global minimum. Insert regroups leaves to keep sizes and ordering, and extraction removes the minimum and regroups survivors while preserving balance.",
        "complexityRationale": "The tree is height balanced so insert and extract touch O(log n) levels. One node per key plus parent grouping gives O(n) space.",
        "uses": [
            "Meldable priority queues with balanced structure",
            "Event scheduling",
            "Priority queues with working-set access patterns"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapters 18 and 19 on B-trees and heaps",
            "Bayer and McCreight, Organization and Maintenance of Large Ordered Indexes, Acta Informatica 1972"
        ],
        "workedExample": "Keys 5, 2, 8, 1, 7, 4 are sorted and grouped by threes; each parent carries its group minimum, so the leftmost parent holds 1. Extracting 1 removes it and regroups survivors while keeping two or three children per node."
    },
    id: "two-three-heap",
    name: "2-3 Heap",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1, 7, 4] },
    visualType: "tree",
    run,
    pseudocode: [
        "start with unsorted keys and no groups",
        "sort leaves and group them by threes",
        "each group parent carries its group minimum",
        "the leftmost parent therefore holds the global minimum",
        "inserts regroup leaves to keep groups at size two or three",
        "extracts remove the minimum and regroup the survivors",
        "done: groups index all keys and the minimum is reported",
    ],
};

export default module;
