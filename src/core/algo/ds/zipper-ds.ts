/**
 * zipper-ds.ts - Tree Zipper
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A zipper is a technique for navigating and editing an immutable tree in
 * constant time per step. It holds the current subtree in focus together with
 * a stack of breadcrumbs that record the path back to the root. Moving left,
 * right, or up only rebalances a single breadcrumb, and changing the focused
 * node rebuilds the path on the way back up, so no unrelated part of the tree
 * is copied.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * The tree is built from level-order values into a complete binary shape.
 * Moves are the strings L, R, U, and S:<value> for left, right, up, and set.
 * This models the pure functional zipper, not a mutable cursor over a stored
 * array or a database cursor.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Each move: O(1); rebuild to root: O(depth); space: O(depth) breadcrumbs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Tree nodes show stored values; the focused node is highlighted.
 *   - Ancestors on the breadcrumb trail are marked as the path to the root.
 *   - The final frame shows the rebuilt tree after all edits.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Tree {
    v: number;
    l: Tree | null;
    r: Tree | null;
    path: string;
}

interface Crumb {
    dir: "L" | "R";
    parentV: number;
    parentPath: string;
    sibling: Tree | null;
}

interface Zipper {
    focus: Tree | null;
    crumbs: Crumb[];
}

function buildTree(values: number[]): Tree | null {
    if (values.length === 0) {
        return null;
    }
    const nodes: Array<Tree | null> = values.map((v, i) => ({ v, l: null, r: null, path: `n${i}` }));
    for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (!node) {
            continue;
        }
        node.l = nodes[2 * i + 1] ?? null;
        node.r = nodes[2 * i + 2] ?? null;
    }
    return nodes[0] ?? null;
}

function goLeft(z: Zipper): Zipper {
    if (!z.focus || !z.focus.l) {
        return z;
    }
    return {
        focus: z.focus.l,
        crumbs: [
            ...z.crumbs,
            { dir: "L", parentV: z.focus.v, parentPath: z.focus.path, sibling: z.focus.r },
        ],
    };
}

function goRight(z: Zipper): Zipper {
    if (!z.focus || !z.focus.r) {
        return z;
    }
    return {
        focus: z.focus.r,
        crumbs: [
            ...z.crumbs,
            { dir: "R", parentV: z.focus.v, parentPath: z.focus.path, sibling: z.focus.l },
        ],
    };
}

function goUp(z: Zipper): Zipper {
    if (z.crumbs.length === 0) {
        return z;
    }
    const crumb = z.crumbs[z.crumbs.length - 1];
    if (!crumb) {
        return z;
    }
    const rebuilt: Tree = {
        v: crumb.parentV,
        path: crumb.parentPath,
        l: crumb.dir === "L" ? z.focus : crumb.sibling,
        r: crumb.dir === "R" ? z.focus : crumb.sibling,
    };
    return { focus: rebuilt, crumbs: z.crumbs.slice(0, -1) };
}

function setValue(z: Zipper, value: number): Zipper {
    if (!z.focus) {
        return z;
    }
    return { focus: { ...z.focus, v: value }, crumbs: [...z.crumbs] };
}

function rootOf(z: Zipper): Tree | null {
    let current = z;
    while (current.crumbs.length > 0) {
        current = goUp(current);
    }
    return current.focus;
}

function inorder(node: Tree | null, out: number[] = []): number[] {
    if (!node) {
        return out;
    }
    inorder(node.l, out);
    out.push(node.v);
    inorder(node.r, out);
    return out;
}

function frameFor(root: Tree | null, focusPath: string, done: boolean): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const nodes: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    const walk = (node: Tree, parentId: string | null, onPath: boolean): void => {
        const state: VisualEntity["state"] = done
            ? "sorted"
            : node.path === focusPath
              ? "active"
              : onPath
                ? "path"
                : "unvisited";
        nodes.push({
            id: node.path,
            type: "node" as const,
            label: String(node.v),
            value: node.v,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { value: node.v, ...(parentId === null ? {} : { parentId }) },
        });
        if (node.l) {
            edges.push({
                id: `edge-${node.path}-${node.l.path}`,
                sourceId: node.path,
                targetId: node.l.path,
                label: "L",
                state: "idle" as const,
                directed: false,
            });
            walk(node.l, node.path, onPath || node.l.path === focusPath);
        }
        if (node.r) {
            edges.push({
                id: `edge-${node.path}-${node.r.path}`,
                sourceId: node.path,
                targetId: node.r.path,
                label: "R",
                state: "idle" as const,
                directed: false,
            });
            walk(node.r, node.path, onPath || node.r.path === focusPath);
        }
    };
    if (root) {
        walk(root, null, root.path === focusPath);
    }
    return { nodes, edges };
}

function parseMove(move: string): { kind: "L" | "R" | "U" | "S"; value: number } {
    const text = String(move).trim().toUpperCase();
    if (text.startsWith("S:")) {
        const value = Number(text.slice(2));
        return { kind: "S", value: Number.isFinite(value) ? value : 0 };
    }
    if (text === "L" || text === "R" || text === "U") {
        return { kind: text, value: 0 };
    }
    return { kind: "U", value: 0 };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; moves?: string[] } | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0
        ? task.values.filter((v) => typeof v === "number")
        : [5, 3, 8, 1, 4, 7, 9];
    const moves: string[] = Array.isArray(task.moves) ? task.moves : ["R", "L", "S:6", "U"];

    let zipper: Zipper = { focus: buildTree(values), crumbs: [] };
    let step = 0;
    const first = frameFor(rootOf(zipper), zipper.focus?.path ?? "", false);
    yield {
        stepNumber: step,
        entities: first.nodes,
        edges: first.edges,
        description: `Place the zipper focus at the root of a ${values.length}-node tree with an empty breadcrumb stack.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { focusPath: zipper.focus?.path ?? "", depth: 0, move: "start" },
    };
    step += 1;

    for (const raw of moves) {
        const move = parseMove(raw);
        if (move.kind === "L") {
            zipper = goLeft(zipper);
        } else if (move.kind === "R") {
            zipper = goRight(zipper);
        } else if (move.kind === "U") {
            zipper = goUp(zipper);
        } else {
            zipper = setValue(zipper, move.value);
        }
        const frame = frameFor(rootOf(zipper), zipper.focus?.path ?? "", false);
        const label = move.kind === "S" ? `set to ${move.value}` : `move ${move.kind}`;
        yield {
            stepNumber: step,
            entities: frame.nodes,
            edges: frame.edges,
            description: `Apply ${label}; the breadcrumb stack now has ${zipper.crumbs.length} frame(s) and the focus is ${zipper.focus?.path ?? "none"}.`,
            codeLineNumber: move.kind === "S" ? 4 : 2,
            layout: "tree",
            meta: {
                move: raw,
                focusPath: zipper.focus?.path ?? "",
                focusValue: zipper.focus?.v ?? 0,
                depth: zipper.crumbs.length,
            },
        };
        step += 1;
    }

    const root = rootOf(zipper);
    const final = frameFor(root, "", true);
    yield {
        stepNumber: step,
        entities: final.nodes,
        edges: final.edges,
        description: `Rebuild the whole tree from the breadcrumbs; the in-order sequence is ${inorder(root).join(", ")}.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: {
            move: "done",
            inorder: inorder(root),
            nodeCount: values.length,
            focusPath: "",
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A zipper turns an immutable tree into a movable window. The window shows one subtree, and a stack of breadcrumbs remembers how to rebuild each parent once work is finished. Moving around and editing only rewires the window and the top breadcrumb, so a change deep in the tree does not copy nodes the user never touched.",
        invariants: [
            "The breadcrumbs always describe the exact path from the focused subtree back to the root.",
            "Rebuilding by popping every breadcrumb recreates a tree with the same shape and the edited values.",
            "A move that is impossible leaves the zipper unchanged.",
        ],
        correctness:
            "Each breadcrumb stores the parent value, the direction taken, and the sibling subtree, which is precisely the context missing from the focus. Going up rebuilds that parent by attaching the focus on the recorded side and the sibling on the other, and pops one breadcrumb. By induction over the stack, repeatedly going up reconstructs the original tree with only the focused edits applied, so the final in-order sequence matches applying those edits directly.",
        complexityRationale:
            "Left, right, up, and set each allocate one small breadcrumb or reuse the top one, giving constant time per move. The stack holds at most the tree depth, so the auxiliary space is O(depth) and a full rebuild is O(depth).",
        uses: [
            "Cursor navigation and editing in immutable document trees",
            "Purely functional editors and abstract syntax tree transformers",
            "State navigation in theorem provers and language servers",
        ],
        references: [
            "Huot, Functional Pearl: The Zipper (1997)",
            "Okasaki, Purely Functional Data Structures (1998)",
        ],
        workedExample:
            "On the level-order tree 5, 3, 8, 1, 4, 7, 9, the moves R, L, S:6, U focus node 8, then its left child 7, change it to 6, and return to node 8. Rebuilding upward yields the same tree with the left child of 8 equal to 6, and the in-order sequence reflects that single edit.",
    },
    id: "zipper-ds",
    name: "Tree Zipper",
    category: "data-structures",
    complexity: { time: "O(1) per move", space: "O(depth)" },
    defaultInput: { values: [5, 3, 8, 1, 4, 7, 9], moves: ["R", "L", "S:6", "U"] },
    visualType: "tree",
    run,
    pseudocode: [
        "build the tree and focus the root with no breadcrumbs",
        "for each navigation or edit move",
        "on left or right push a breadcrumb with the parent and sibling",
        "on up rebuild the parent from the top breadcrumb and pop it",
        "on set replace the value at the focus",
        "after all moves rebuild from the remaining breadcrumbs",
        "report the edited tree in order",
    ],
};

export default module;
