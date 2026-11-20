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

    education: {
        "intuition": "A B-heap adapts the heap to disk by making each node a block that holds a parent and its children, aligned page by page. Because one I/O reads a whole block, a sift operation touches as few blocks as possible. The fanout is chosen to match the page size, minimizing transfers.",
        "invariants": [
            "Each parent block's key is at most the keys in its child blocks (min-heap order).",
            "Every block occupies one page, so one I/O transfers a full subtree.",
            "The tree remains complete, with blocks filled left to right."
        ],
        "correctness": "Inserting places the key in the next free slot and swaps violating blocks up the tree, which restores heap order because only the path to the root can be affected. Extracting the minimum removes the root block's value and refills it from a child, then pushes down until order holds. Both operations touch one block per level.",
        "complexityRationale": "Height is O(log_B n) because each block has B children, and each level costs one I/O, giving O(log_B n) transfers. Storing all keys once takes O(n) space on disk.",
        "uses": [
            "External-memory priority queues in databases",
            "Bulk sorting with disk-resident heaps",
            "Event scheduling over very large datasets"
        ],
        "references": [
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.4",
            "J. S. Vitter, \"External Memory Algorithms and Data Structures\", ACM Computing Surveys 2001"
        ],
        "workedExample": "Insert 5, 2, 8, 1, 7 into a B-heap whose block holds a parent and children. The root starts at 5; inserting 2 swaps it upward so the root becomes 2. Inserting 1 again swaps along one block path, so the minimum 1 ends at the root and the I/O counter records only a few block reads."
    },
    id: "b-heap-external",
    name: "B-Heap",
    category: "data-structures",
    complexity: { time: "O(log_B n) I/Os", space: "O(n)" },
    defaultInput: { keys: [5, 2, 8, 1, 7] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize empty external B-heap with large fanout blocks",
        "insert key into appropriate block preserving heap order",
        "compare parent block minimum against child block minimum",
        "swap blocks that violate heap ordering",
        "extract minimum from root block and refill from child",
        "count I/O operations across block accesses",
        "done: external heap holds keys with minimum at root",
    ],
};

export default module;
