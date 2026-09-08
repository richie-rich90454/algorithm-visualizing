/**
 * b-heap-external.ts – B-Heap (External Memory)
 *
 * Heap-ordered pages: each disk page holds a parent with its block-aligned
 * children, so one I/O fetches a whole subtree and transfers stay minimal.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const PAGE = 3;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[] } | null) ?? {};
    const keys = task.keys ?? [5, 2, 8, 1, 7];
    let step = 0;

    const heap = [...keys].sort((a, b) => a - b);
    const pages: number[][] = [];
    for (let i = 0; i < heap.length; i += PAGE) {
        pages.push(heap.slice(i, i + PAGE));
    }
    const snap = (hotPage: number, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: pages.flatMap((p, pi) =>
            p.map((k, ki) => ({
                id: `bhp-${pi}-${ki}`,
                type: "cell" as const,
                label: String(k),
                value: k,
                state: (pi === hotPage ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: pi, col: ki },
            })),
        ),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { pages: pages.length, pageSize: PAGE },
    });

    yield snap(-1, `B-heap over [${keys.join(",")}] – ${pages.length} pages of ${PAGE}.`, 0);
    step += 1;
    for (let pi = 0; pi < pages.length; pi += 1) {
        yield snap(pi, `Page ${pi} fetched in one I/O: [${(pages[pi] ?? []).join(",")}].`, 1);
        step += 1;
    }
    const mn = pages[0]?.[0] ?? -1;
    yield snap(0, `Root page holds the minimum ${mn} – one more I/O to extract.`, 2);
}

const module: AlgorithmModule = {
    id: "b-heap-external",
    name: "B-Heap",
    category: "data-structures",
    complexity: { time: "O(log_B n) I/Os", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1, 7] },
    visualType: "grid",
    run,
};

export default module;
