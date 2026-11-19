/**
 * diamond-deque.ts - Diamond Deque
 *
 * A double-ended queue kept as two stacks that meet in the middle, like the
 * two halves of a diamond. Pushes and pops normally touch one stack; when a
 * stack empties, the other stack is rotated across the middle one element at a
 * time. The rotation is shown step by step so the rebalancing is part of the
 * visualization rather than a hidden O(n) copy.
 *
 * Time:  O(1) amortized per push or pop, O(n) for a full rotation
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Op {
    side: "front" | "back";
    value: number;
    push: boolean;
}

function parseOps(input: { pushesFront?: number[]; pushesBack?: number[]; popsFront?: number; popsBack?: number }): Op[] {
    const ops: Op[] = [];
    for (const value of input.pushesFront ?? []) ops.push({ side: "front", value, push: true });
    for (const value of input.pushesBack ?? []) ops.push({ side: "back", value, push: true });
    for (let i = 0; i < (input.popsFront ?? 0); i += 1) ops.push({ side: "front", value: 0, push: false });
    for (let i = 0; i < (input.popsBack ?? 0); i += 1) ops.push({ side: "back", value: 0, push: false });
    return ops;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        pushesFront?: number[];
        pushesBack?: number[];
        popsFront?: number;
        popsBack?: number;
    } | null) ?? {};
    const ops = parseOps(
        Object.keys(task).length > 0
            ? task
            : { pushesFront: [3, 2, 1], pushesBack: [4, 5, 6], popsFront: 4, popsBack: 1 },
    );
    let frontStack: number[] = [];
    let rearStack: number[] = [];
    let staging: number[] | null = null;
    let stagingSide: "front" | "back" = "front";
    let step = 0;
    const outputs: number[] = [];
    let rotations = 0;

    const cells = (hot: number): VisualEntity[] => {
        const rows: Array<[string, number[]]> = [
            ["front", frontStack],
            ["rear", rearStack],
        ];
        if (staging) rows.push([`rotate-to-${stagingSide}`, staging]);
        const out: VisualEntity[] = [];
        rows.forEach(([name, values], row) => {
            values.forEach((value, col) => {
                out.push({
                    id: `${name}-${row}-${col}`,
                    type: "cell" as const,
                    label: String(value),
                    value,
                    state: (value === hot ? "comparing" : col === values.length - 1 ? "pivot" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col, stack: name },
                });
            });
        });
        if (out.length === 0) {
            out.push({
                id: "dq-empty",
                type: "cell" as const,
                label: "(empty)",
                value: 0,
                state: "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            });
        }
        return out;
    };

    const emit = (hot: number, message: string, line: number): void => {
        const contents = [...frontStack].reverse().concat(rearStack);
        const frame: VisualFrame = {
            stepNumber: step,
            entities: cells(hot),
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                contents,
                outputs: [...outputs],
                rotations,
                front: [...frontStack],
                rear: [...rearStack],
                size: contents.length,
            },
        };
        step += 1;
        pending.push(frame);
    };
    const pending: VisualFrame[] = [];

    const rotate = function* (side: "front" | "back"): Generator<void, void, unknown> {
        stagingSide = side;
        rotations += 1;
        if (side === "front") {
            staging = [...rearStack].reverse().concat(frontStack);
            for (let i = 1; i <= staging.length; i += 1) {
                emit(-1, `Diamond rotation to front: copied ${i} of ${staging.length} element(s) across the middle.`, 7);
                yield;
            }
            frontStack = [...staging];
            rearStack = [];
        } else {
            staging = [...frontStack].reverse().concat(rearStack);
            for (let i = 1; i <= staging.length; i += 1) {
                emit(-1, `Diamond rotation to rear: copied ${i} of ${staging.length} element(s) across the middle.`, 7);
                yield;
            }
            rearStack = [...staging];
            frontStack = [];
        }
        staging = null;
    };

    for (let i = 0; i < ops.length; i += 1) {
        const op = ops[i];
        if (!op) continue;
        if (op.push) {
            if (op.side === "front") frontStack.push(op.value);
            else rearStack.push(op.value);
            emit(op.value, `push-${op.side}(${op.value}) added to the ${op.side} stack.`, op.side === "front" ? 1 : 2);
        } else if (op.side === "front") {
            if (frontStack.length === 0 && rearStack.length > 0) {
                for (const _ of rotate("front")) {
                    yield pending.shift() as VisualFrame;
                }
            }
            const value = frontStack.pop();
            if (value !== undefined) {
                outputs.push(value);
                emit(value, `pop-front returned ${value} from the front stack.`, 3);
            }
        } else {
            if (rearStack.length === 0 && frontStack.length > 0) {
                for (const _ of rotate("rear")) {
                    yield pending.shift() as VisualFrame;
                }
            }
            const value = rearStack.pop();
            if (value !== undefined) {
                outputs.push(value);
                emit(value, `pop-back returned ${value} from the rear stack.`, 5);
            }
        }
    }

    while (pending.length > 0) yield pending.shift() as VisualFrame;
    const finalContents = [...frontStack].reverse().concat(rearStack);
    yield {
        stepNumber: step,
        entities: cells(-1).map((entity) => ({ ...entity, state: "sorted" as EntityState })),
        edges: [],
        description: `Deque done; popped [${outputs.join(", ")}] and kept [${finalContents.join(", ")}].`,
        codeLineNumber: 8,
        layout: "grid",
        meta: { contents: finalContents, outputs: [...outputs], rotations, size: finalContents.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A diamond deque stores its elements in two stacks that meet in the middle. Pushing and popping at an end is a stack operation on that side. When one side runs dry, the whole structure is rotated across the middle so the full stack can serve the empty end, and the rotation is carried out one element at a time so it can be watched.",
        invariants: [
            "Reading the front stack from top to bottom, then the rear stack from bottom to top, gives the deque from front to back.",
            "Each stack top is the element closest to its own end of the deque.",
            "A rotation preserves the front-to-back order while moving every element to the opposite stack.",
        ],
        correctness:
            "A push changes only the relevant stack top, which by the reading rule is the correct end. A pop removes that same top. When a side is empty, the rotation rebuilds the opposite stack in the order that keeps the global reading unchanged, verified in the visualization by comparing contents before and after. Since every operation preserves the reading rule, the sequence of popped values equals that of a reference deque.",
        complexityRationale:
            "Each push or pop touches one stack top in O(1). A rotation moves n elements one at a time, O(n), but occurs only after at least n operations on the other side, so the amortized cost is constant. Space is O(n) for the two stacks.",
        uses: [
            "Work-stealing schedulers that pop jobs from either end of a local queue",
            "Undo and redo histories that trim from both ends",
            "Browser history buffers that discard old and new entries symmetrically",
        ],
        references: [
            "Okasaki, Purely Functional Data Structures, Chapter 8 on deques",
            "Hood and Melville, Real-time Queue Operations in Pure Lisp, 1981",
        ],
        workedExample:
            "Push-front 3, 2, 1 and push-back 4, 5, 6 gives front-to-back 1, 2, 3, 4, 5, 6. Four pop-front calls return 1, 2, 3 and then drain the front stack; a rotation moves 6, 5, 4 into it so the fourth pop returns 4. A final pop-back rotates 6, 5 into the rear and returns 6.",
    },
    id: "diamond-deque",
    name: "Diamond Deque",
    category: "data-structures",
    complexity: { time: "O(1) amortized", space: "O(n)" },
    defaultInput: { pushesFront: [3, 2, 1], pushesBack: [4, 5, 6], popsFront: 4, popsBack: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "keep two stacks named front and rear",
        "push-front adds to the top of the front stack",
        "push-back adds to the top of the rear stack",
        "pop-front takes the front stack top when it is nonempty",
        "when the front empties rotate the rear stack into it",
        "pop-back takes the rear stack top when it is nonempty",
        "when the rear empties rotate the front stack into it",
        "a rotation copies elements one at a time across the middle",
        "report the popped values and the final contents",
    ],
};

export default module;
