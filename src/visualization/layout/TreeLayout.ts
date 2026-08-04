/**
 * TreeLayout.ts – Tidy tree layout.
 *
 * Positions a rooted tree level by level: parents are centered above their
 * children, siblings sit side by side with a fixed gap, and the whole tree
 * is centered in the container (scaled down if it would overflow).
 *
 * It runs in O(n): one post-order pass computes each subtree's width, a
 * second pass assigns x positions, and the depth of every node fixes y.
 * Entities link to their parent via `metadata.parentId`; nodes without a
 * parent (or whose parent is missing from the frame) become roots.
 */

import type { VisualEntity, VisualFrame } from "@/types";

/** Fixed node size, in logical pixels. */
const NODE_SIZE = 40;

/** Drawn node diameter at full scale; matches the renderer's node radius. */
const NODE_DIAMETER = 28;

/** Vertical gap between adjacent tree levels. */
const VERTICAL_GAP = 30;

/** The minimum horizontal separation between sibling subtrees. */
const SIBLING_GAP = 16;

/** Margin kept between the tree and the container edge. */
const MARGIN = 40;

/**
 * Lay out a tree so it is centered, balanced, and overlap-free.
 *
 * @param frame The frame whose entities link via metadata.parentId.
 * @param width Logical container width in pixels.
 * @param height Logical container height in pixels.
 * @returns The same frame, with entity centers filled in.
 */
export function applyTreeLayout(frame: VisualFrame, width: number, height: number): VisualFrame {
    const entities = frame.entities;
    if (entities.length === 0) {
        return frame;
    }

    // ------------------------------------------------------------------
    // Pass 0: build the parent → children graph from parentId metadata.
    // ------------------------------------------------------------------
    const byId = new Map<string, VisualEntity>();
    for (const entity of entities) {
        byId.set(entity.id, entity);
    }

    const children = new Map<string, VisualEntity[]>();
    const roots: VisualEntity[] = [];

    // Resolve a parentId against the entity ids. Most algorithms emit the
    // exact id; some emit the bare key while ids carry a "node-" prefix, so
    // both forms are accepted here.
    const resolveParent = (parentId: string | number | boolean): string | null => {
        const pid = String(parentId);
        if (byId.has(pid)) {
            return pid;
        }
        const prefixed = `node-${pid}`;
        return byId.has(prefixed) ? prefixed : null;
    };

    for (const entity of entities) {
        const parentId = entity.metadata["parentId"];
        const pid = parentId === undefined || parentId === "root" ? null : resolveParent(parentId);
        if (pid === null) {
            roots.push(entity);
        } else {
            const list = children.get(pid) ?? [];
            list.push(entity);
            children.set(pid, list);
        }
    }

    // A frame with no recognized root still lays out; fall back to the first
    // entity so a degenerate tree is visible rather than silently dropped.
    if (roots.length === 0) {
        roots.push(entities[0]);
    }

    // ------------------------------------------------------------------
    // Pass 1: depth of every node (BFS from the roots).
    // ------------------------------------------------------------------
    const depthOf = new Map<string, number>();
    const queue: Array<[VisualEntity, number]> = roots.map((r) => [r, 0]);
    while (queue.length > 0) {
        const [node, depth] = queue.shift() as [VisualEntity, number];
        depthOf.set(node.id, depth);
        for (const kid of children.get(node.id) ?? []) {
            queue.push([kid, depth + 1]);
        }
    }

    // ------------------------------------------------------------------
    // Pass 2: assign x by subtree width (post-order), y by depth.
    // ------------------------------------------------------------------
    const subtreeWidth = (node: VisualEntity): number => {
        const kids = children.get(node.id) ?? [];
        if (kids.length === 0) {
            return NODE_SIZE;
        }
        return (
            kids.reduce((sum, kid) => sum + subtreeWidth(kid), 0) + SIBLING_GAP * (kids.length - 1)
        );
    };

    const place = (node: VisualEntity, left: number, gap: number): number => {
        const kids = children.get(node.id) ?? [];
        const depth = depthOf.get(node.id) ?? 0;
        node.width = NODE_SIZE;
        node.height = NODE_SIZE;
        node.y = depth * (NODE_SIZE + VERTICAL_GAP);

        if (kids.length === 0) {
            node.x = left + NODE_SIZE / 2;
            return NODE_SIZE;
        }

        let cursor = left;
        let rightEdge = left;
        for (const kid of kids) {
            const w = place(kid, cursor, gap);
            rightEdge = cursor + w;
            cursor = rightEdge + gap;
        }
        node.x = (left + rightEdge) / 2;
        return rightEdge - left;
    };

    const placeAll = (gap: number): void => {
        let cursor = 0;
        for (const root of roots) {
            const w = place(root, cursor, gap);
            cursor = cursor + w + gap;
        }
    };

    const spanOf = (): number => {
        let minX = Infinity;
        let maxX = -Infinity;
        for (const entity of entities) {
            minX = Math.min(minX, entity.x);
            maxX = Math.max(maxX, entity.x);
        }
        return Math.max(1, maxX - minX);
    };

    const availW = Math.max(1, width - 2 * MARGIN);

    // Lay out at the natural gap; if the tree is too wide, pack siblings
    // tightly (leaves stay NODE_SIZE apart, so nodes never overlap) before
    // scaling anything down.
    placeAll(SIBLING_GAP);
    let span = spanOf();
    if (span > availW) {
        placeAll(0);
        span = spanOf();
    }
    const scale = Math.min(1, availW / span);

    // ------------------------------------------------------------------
    // Normalization: center the tree, scaling down only if it overflows.
    // ------------------------------------------------------------------
    let maxDepth = 0;
    for (const entity of entities) {
        maxDepth = Math.max(maxDepth, depthOf.get(entity.id) ?? 0);
    }

    const totalHeight = maxDepth * (NODE_SIZE + VERTICAL_GAP) + NODE_SIZE;
    const offsetY = MARGIN + Math.max(0, (height - 2 * MARGIN - totalHeight) / 2);

    // Recompute minX after any re-placement so the tree is centered exactly.
    let minX = Infinity;
    for (const entity of entities) {
        minX = Math.min(minX, entity.x);
    }
    const finalOffsetX = (width - span * scale) / 2 - minX * scale;

    // When the tree was scaled down, shrink the drawn node size along with
    // it so densely packed nodes keep their clearance instead of overlapping.
    const nodeDiameter = Math.max(8, NODE_DIAMETER * scale);

    for (const entity of entities) {
        entity.x = entity.x * scale + finalOffsetX;
        entity.y += offsetY;
        entity.width = nodeDiameter;
        entity.height = nodeDiameter;
    }

    return frame;
}
