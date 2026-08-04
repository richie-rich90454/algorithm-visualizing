/**
 * tree-util.ts – Shared helpers for tree algorithm visualisations.
 *
 * Tree algorithms (diameter, LCA, traversals, …) all need to turn a
 * parent-child relationship into the node/edge entities consumed by the tree
 * layout engine. The tree layout positions nodes hierarchically using the
 * `parentId` metadata field on each node, so this helper wires that up
 * consistently.
 */

import type { VisualEdge, VisualEntity } from "@/types";

/**
 * Build node entities for a tree described by parent pointers.
 *
 * @param parentMap A map from child id → parent id. The root is any child
 *        whose parent is not itself present, or a node marked with parent
 *        `"root"` / `null`.
 * @param ids All node ids, in a stable order.
 * @returns Node entities with `metadata.parentId` set for the tree layout.
 */
export function makeTreeNodes(
    parentMap: Map<string, string | null>,
    ids: string[],
): VisualEntity[] {
    return ids.map((id) => {
        const parentId = parentMap.get(id) ?? null;
        return {
            id: `node-${id}`,
            type: "node" as const,
            label: id,
            value: id,
            state: "unvisited" as const,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                // Root nodes carry "root" so the tree layout knows where to
                // start the hierarchy; children reference the full entity id
                // (including the "node-" prefix) that the layout looks up.
                parentId: parentId === null ? "root" : `node-${parentId}`,
            },
        };
    });
}

/**
 * Build the visual edge for every parent→child link.
 *
 * @param parentMap A map from child id → parent id.
 * @param ids All node ids.
 * @returns Edge entities in `idle` state (undirected visualization).
 */
export function makeTreeEdges(parentMap: Map<string, string | null>, ids: string[]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (const id of ids) {
        const parent = parentMap.get(id);
        if (!parent) {
            continue;
        }
        edges.push({
            id: `edge-${parent}-${id}`,
            sourceId: `node-${parent}`,
            targetId: `node-${id}`,
            label: "",
            state: "idle",
            directed: false,
        });
    }
    return edges;
}
