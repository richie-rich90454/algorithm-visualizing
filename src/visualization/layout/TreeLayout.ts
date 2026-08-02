/**
 * TreeLayout.ts – Tidy tree layout (Buchheim's algorithm).
 *
 * Trees are hierarchical, so a naive recursive positioning overlaps subtrees.
 * Buchheim's algorithm produces a "tidy" drawing: no two nodes overlap,
 * siblings sit at least one node-width apart, and parents are centred above
 * their children. It runs in O(n) using two traversals:
 *
 *   1. Post-order: assign a preliminary x and a "modifier" per node.
 *   2. Pre-order:  accumulate modifiers to compute the final x, y by depth.
 *
 * Nodes are drawn as 40×40 circles whose centre points this layout produces;
 * the root is centred horizontally at the top of the container.
 */

import type { VisualEntity, VisualFrame } from "@/types";

/** Fixed node size, in logical pixels. */
const NODE_SIZE = 40;

/** Vertical gap between adjacent tree levels. */
const VERTICAL_GAP = 30;

/** The minimum horizontal separation between sibling subtrees. */
const SIBLING_GAP = 16;

/** How much a parent's subtree can crowd its left neighbour before shifting. */
const SUBTREE_GAP = 24;

/** Work state carried through the two-pass algorithm. */
interface LayoutNode {
    entity: VisualEntity;
    children: LayoutNode[];
    preliminaryX: number;
    modifier: number;
    // Rightmost node of this subtree at each depth (contour tracking).
    thread?: LayoutNode;
    ancestor?: LayoutNode;
    // Change/changeAccumulated feed the contour-shifting bookkeeping.
    change: number;
    shift: number;
    // Which depth this node lives at (used to resolve contour neighbours).
    depth: number;
}

/**
 * Lay out a tree so it is centred, balanced, and overlap-free.
 *
 * @param frame The frame whose entities link via metadata.parentId.
 * @param width Logical container width in pixels.
 * @param height Logical container height in pixels.
 * @returns The same frame, with entity centres filled in.
 */
export function applyTreeLayout(frame: VisualFrame, width: number, height: number): VisualFrame {
    // ------------------------------------------------------------------
    // Pass 0: build the node graph from parentId metadata.
    // ------------------------------------------------------------------
    const byId = new Map<string, VisualEntity>();
    for (const entity of frame.entities) {
        byId.set(entity.id, entity);
    }

    const nodes = new Map<string, LayoutNode>();
    const createLayoutNode = (entity: VisualEntity, depth: number): LayoutNode => {
        const node: LayoutNode = {
            entity,
            children: [],
            preliminaryX: 0,
            modifier: 0,
            change: 0,
            shift: 0,
            depth,
        };
        nodes.set(entity.id, node);
        return node;
    };

    let root: LayoutNode | null = null;

    for (const entity of frame.entities) {
        const parentId = entity.metadata["parentId"];
        const node = nodes.get(entity.id) ?? createLayoutNode(entity, 0);

        if (parentId === undefined || parentId === "root") {
            root = node;
            continue;
        }

        const parent = byId.get(String(parentId));
        if (!parent) {
            root = node;
            continue;
        }
        const parentNode = nodes.get(parent.id) ?? createLayoutNode(parent, 0);
        parentNode.children.push(node);
        node.depth = parentNode.depth + 1;
    }

    if (!root) {
        return frame;
    }

    // ------------------------------------------------------------------
    // Pass 1: post-order assignment of preliminary positions.
    // ------------------------------------------------------------------

    /**
     * Find the rightmost node of a subtree on a given contour depth, used to
     * compare sibling subtree shapes when resolving overlaps.
     */
    const nextRight = (node: LayoutNode): LayoutNode | null => {
        const children = node.children;
        return children.length > 0
            ? (children[children.length - 1] ?? null)
            : (node.thread ?? null);
    };

    /** Find the leftmost node of a subtree on a given contour depth. */
    const nextLeft = (node: LayoutNode): LayoutNode | null => {
        return node.children[0] ?? node.thread ?? null;
    };

    /**
     * Move a node and every node in its subtree by the given delta by
     * adjusting the node's preliminary position and modifier.
     */
    const moveSubtree = (node: LayoutNode, delta: number): void => {
        node.preliminaryX += delta;
        node.modifier += delta;
        node.change -= delta;
        node.shift += delta;
    };

    /** Execute pending shifts along the contour between two siblings. */
    const executeShifts = (node: LayoutNode): void => {
        let shift = 0;
        let change = 0;
        const children = node.children;
        for (let i = children.length - 1; i >= 0; i -= 1) {
            const child = children[i];
            if (!child) {
                continue;
            }
            // Accumulate the total shift so far and apply it to this child.
            child.preliminaryX += shift;
            child.modifier += shift;
            change += child.change;
            shift += child.shift + change;
        }
    };

    // The ancestor map is keyed by the leftmost node's ancestor on each depth;
    // we track it explicitly so the contour comparison can climb correctly.
    const ancestorBy = new Map<LayoutNode, LayoutNode>();

    const postOrder = (node: LayoutNode): void => {
        const children = node.children;
        const n = children.length;

        // Visit children first (post-order) so their positions are final.
        for (const child of children) {
            postOrder(child);
        }

        if (n === 0) {
            // Leaf: preliminary x is the previous sibling's x plus the gap.
            const left = nextLeft(node);
            node.preliminaryX = left ? left.preliminaryX + SIBLING_GAP : 0;
            return;
        }

        // Internal node: walk the left and right contours of the children,
        // pushing the right subtree apart from the left one when they collide.
        const leftChild = children[0];
        const rightChild = children[n - 1];
        if (!leftChild || !rightChild) {
            return;
        }

        // Compare contour nodes from both children at each depth.
        let left: LayoutNode | null = leftChild;
        let right: LayoutNode | null = rightChild;
        ancestorBy.set(leftChild, leftChild);

        // Track the outermost nodes of each side as we descend.
        let leftContour: LayoutNode = leftChild;
        let rightContour: LayoutNode = rightChild;

        let leftAncestor: LayoutNode = leftChild;

        while (left && right) {
            leftAncestor = right;

            // If the right subtree's left contour overlaps the left subtree's
            // right contour, push the whole right subtree to the right.
            const distance = left.preliminaryX + SUBTREE_GAP - right.preliminaryX;
            if (distance > 0) {
                moveSubtree(right, distance);
                // The gap may have changed, so recompute the extremes.
                if (distance > node.shift) {
                    node.shift = distance;
                }
            }

            ancestorBy.set(right, leftAncestor);

            leftContour = left;
            rightContour = right;

            left = nextLeft(left);
            right = nextRight(right);
        }

        // One side bottomed out before the other; use threads to keep going.
        if (left) {
            leftContour.thread = left;
        } else if (right) {
            rightContour.thread = right;
            rightContour.modifier += node.preliminaryX - right.preliminaryX;
        }

        // Parent is centred above its children's combined span.
        node.preliminaryX = (leftChild.preliminaryX + rightChild.preliminaryX) / 2;

        // Clean up the ancestor map entries we created on this subtree walk.
        for (const child of children) {
            ancestorBy.delete(child);
        }
    };

    postOrder(root);

    // ------------------------------------------------------------------
    // Pass 2: pre-order accumulation of modifiers → final positions.
    // ------------------------------------------------------------------

    let minX = Infinity;
    let maxX = -Infinity;

    const preOrder = (node: LayoutNode, sum: number): void => {
        const x = node.preliminaryX + sum;
        node.entity.x = x;
        node.entity.y = node.depth * (NODE_SIZE + VERTICAL_GAP);
        node.entity.width = NODE_SIZE;
        node.entity.height = NODE_SIZE;

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);

        // The modifier applies to every descendant, so pass it down.
        for (const child of node.children) {
            preOrder(child, sum + node.modifier);
        }
    };

    preOrder(root, 0);

    // ------------------------------------------------------------------
    // Normalisation: centre the tree horizontally and clamp vertically.
    // ------------------------------------------------------------------
    const span = Math.max(1, maxX - minX);
    const offsetX = (width - span) / 2 - minX;
    const maxDepth = Math.max(0, ...frame.entities.map((e) => Number(e.metadata["depth"] ?? 0)));
    const totalHeight = maxDepth * (NODE_SIZE + VERTICAL_GAP) + NODE_SIZE;
    const offsetY = (height - totalHeight) / 2;

    for (const entity of frame.entities) {
        entity.x += offsetX;
        entity.y += offsetY;
    }

    return frame;
}
