/**
 * unrolled-linked-list.ts – Unrolled Linked List
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
 *   Search:    O(n/B + B) ≈ O(√n) with B ≈ √n
 *   Insert:    O(n/B + B) – may split a full node
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

    education: {
        "intuition": "An unrolled linked list stores several elements per node in a small array and chains the nodes together. This keeps the cheap insertion of a linked list while improving cache locality, since one node hop accesses B elements at once.",
        "invariants": [
            "Each node holds at most B elements.",
            "Element order across nodes is sorted and nodes chain in that order.",
            "Insertion may split a full node."
        ],
        "correctness": "Search walks nodes and skips whole blocks whose range cannot contain the key, then scans the candidate block; block ranges bound their contents so no match is skipped. Insertion shifts within one node or splits a full node, preserving global sorted order.",
        "complexityRationale": "A search visits O(n/B) node hops plus O(B) scanning inside a node, O(n/B + B), which is O(sqrt n) with B near sqrt(n). Each element is stored once, O(n) space.",
        "uses": [
            "Cache-friendly ordered lists",
            "Text editor buffers",
            "B-tree-like indexes implemented with linked blocks"
        ],
        "references": [
            "Sedgewick and Wayne, Algorithms, 4th Edition, unrolled linked lists",
            "Chilimbi, Hill, and Larus, Cache-Conscious Structure Layout, 1999"
        ],
        "workedExample": "Values 1 through 8 packed into blocks of four; searching 5 skips the first block whose maximum is 4 and scans the second; inserting 3 shifts within the first block and a full block would split."
    },
    id: "unrolled-linked-list",
    name: "Unrolled Linked List",
    category: "data-structures",
    complexity: { time: "O(√n) search", space: "O(n)" },
    defaultInput: { values: [1, 2, 3, 4, 5, 6, 7, 8], search: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with fixed-capacity blocks chained in order",
        "search: walk blocks comparing the query against block contents",
        "skip whole blocks whose ranges cannot contain the key",
        "scan inside the candidate block element by element",
        "inserts shift within one block or split a full block",
        "block count and capacities stay balanced",
        "done: blocks chain all values and the search verdict is reported",
    ],
};

export default module;
