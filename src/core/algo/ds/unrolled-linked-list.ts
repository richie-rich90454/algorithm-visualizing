/**
 * unrolled-linked-list.ts â€?Unrolled Linked List
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An unrolled linked list is a hybrid of an array and a linked list: a list
 * of nodes, each holding a small *array* of up to B elements. This combines
 * the cache-friendliness of arrays with the cheap insertions of linked lists.
 * Search is O(n/B) node hops plus O(B) within a node.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Search:    O(n/B + B) â‰?O(âˆšn) with B â‰?âˆšn
 *   Insert:    O(n/B + B) â€?may split a full node
 *   Space:     O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each node is a box containing up to B cells.
 *   - The node being searched is YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The "array inside a node" hybrid is the conceptual idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Maximum elements per node. */
const BLOCK = 3;

/**
 * Build a grid of cells grouped into blocks.
 *
 * @param blocks The blocks (each an array of values).
 * @param activeBlock The block being searched (or -1).
 * @returns Cell entities with row/col metadata.
 */
function makeGrid(blocks: number[][], activeBlock = -1): VisualEntity[] {
    const cells: VisualEntity[] = [];
    blocks.forEach((block, blockIndex) => {
        block.forEach((value, index) => {
            cells.push({
                id: `cell-${blockIndex}-${index}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: (blockIndex === activeBlock ? "comparing" : "unvisited") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: blockIndex, col: index },
            });
        });
    });
    return cells;
}

/**
 * The Unrolled Linked List generator.
 *
 * @param input `{ values, search }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; search?: number } | null) ?? {};
    const values = task.values ?? [1, 2, 3, 4, 5, 6, 7, 8];
    const search = typeof task.search === "number" ? task.search : 5;

    let step = 0;

    // Group the values into blocks of size BLOCK.
    const blocks: number[][] = [];
    for (let i = 0; i < values.length; i += BLOCK) {
        blocks.push(values.slice(i, i + BLOCK));
    }

    // Frame 0: the blocks.
    yield {
        stepNumber: step,
        entities: makeGrid(blocks),
        edges: [],
        description: `Unrolled linked list: ${blocks.length} node(s), each holding up to ${BLOCK} elements.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { blocks: blocks.length },
    };
    step += 1;

    // Search block by block.
    let foundInBlock = -1;
    for (let b = 0; b < blocks.length; b += 1) {
        yield {
            stepNumber: step,
            entities: makeGrid(blocks, b),
            edges: [],
            description: `Searching node ${b}: [${(blocks[b] ?? []).join(", ")}].`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { blocks: blocks.length },
        };
        step += 1;
        if ((blocks[b] ?? []).includes(search)) {
            foundInBlock = b;
            break;
        }
    }

    // Highlight the found block.
    const finalStates = new Map<number, EntityState>();
    if (foundInBlock >= 0) {
        const block = blocks[foundInBlock];
        if (block) {
            block.forEach((_, index) => {
                finalStates.set(foundInBlock * 100 + index, "sorted");
            });
        }
    }

    const finalGrid = makeGrid(blocks).map((cell) => {
        const idParts = cell.id.split("-");
        const blockIndex = Number(idParts[1]);
        const colIndex = Number(idParts[2]);
        if (finalStates.has(blockIndex * 100 + colIndex)) {
            return { ...cell, state: "sorted" as EntityState };
        }
        return cell;
    });

    yield {
        stepNumber: step,
        entities: finalGrid,
        edges: [],
        description:
            foundInBlock >= 0 ? `Found ${search} in node ${foundInBlock}.` : `${search} not found.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { blocks: blocks.length },
    };
}

/** The Unrolled Linked List module, registered with the engine. */
const module: AlgorithmModule = {
    id: "unrolled-linked-list",
    name: "Unrolled Linked List",
    category: "data-structures",
    complexity: { time: "O(âˆšn) search", space: "O(n)" },
    defaultInput: { values: [1, 2, 3, 4, 5, 6, 7, 8], search: 5 },
    visualType: "grid",
    run,
};

export default module;
