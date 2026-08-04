/**
 * skip-list.ts â€?Skip List
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A skip list is a probabilistic alternative to balanced search trees. It is
 * a linked list where some nodes also have pointers that skip ahead by 2, 4,
 * 8, â€?positions. Searching starts at the topmost level and drops down a level
 * whenever the next pointer overshoots, visiting only O(log n) nodes on
 * average. Insertion randomly promotes new nodes to higher levels.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Search / insert / delete: O(log n) expected
 *   Space:                    O(n log n) worst, O(n) expected
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Levels are rows of nodes; skip pointers leap across them.
 *   - The search path is highlighted level by level.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Simpler to implement than a balanced tree and nearly as fast.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Skip List generator.
 *
 * @param input `{ values, search }` â€?values to insert and a value to search.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; search?: number } | null) ?? {};
    const values = task.values ?? [3, 6, 7, 9, 12, 19, 17];
    const search = task.search ?? 12;

    let step = 0;

    // Build a small deterministic skip list: level 1 = full list, level 2 =
    // every other element, level 3 = every fourth element.
    const level1 = values;
    const level2 = values.filter((_, i) => i % 2 === 0);
    const level3 = values.filter((_, i) => i % 4 === 0);

    const levels: number[][] = [level3, level2, level1];

    const entities: VisualEntity[] = [];
    const edges: VisualEdge[] = [];

    levels.forEach((level, levelIndex) => {
        const y = levelIndex * -2;
        level.forEach((value, index) => {
            entities.push({
                id: `n-${levelIndex}-${index}`,
                type: "node" as const,
                label: String(value),
                value,
                state: "unvisited",
                x: index * 2,
                y,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            });
        });
        for (let i = 0; i < level.length - 1; i += 1) {
            edges.push({
                id: `e-${levelIndex}-${i}`,
                sourceId: `n-${levelIndex}-${i}`,
                targetId: `n-${levelIndex}-${i + 1}`,
                label: levelIndex === 0 ? "skip" : "next",
                state: levelIndex === 0 ? "highlight" : "idle",
                directed: true,
            });
        }
    });

    // Frame 0: the skip list levels.
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `Skip list with ${values.length} values over ${levels.length} levels.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: {},
    };
    step += 1;

    // Search: start at the top level and drop down.
    for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
        const level = levels[levelIndex];
        if (!level) {
            continue;
        }
        const found = level.find((v) => v === search);
        const current = entities.map((e) => ({ ...e }));
        for (let i = 0; i < level.length; i += 1) {
            const node = current.find((e) => e.id === `n-${levelIndex}-${i}`);
            if (node) {
                node.state = "comparing";
            }
        }
        yield {
            stepNumber: step,
            entities: current,
            edges: edges.map((e) => ({ ...e })),
            description: `Searching level ${levelIndex} for ${search}${found ? " â€?FOUND!" : " â€?overshot, dropping down"}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { search },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `Skip list search visits only a few nodes â€?O(log n) expected.`,
        codeLineNumber: 3,
        layout: "graph",
        meta: { search },
    };
}

/** The Skip List module, registered with the engine. */
const module: AlgorithmModule = {
    id: "skip-list",
    name: "Skip List",
    category: "data-structures",
    complexity: { time: "O(log n) expected", space: "O(n) expected" },
    defaultInput: { values: [3, 6, 7, 9, 12, 19, 17], search: 12 },
    visualType: "graph",
    run,
};

export default module;
