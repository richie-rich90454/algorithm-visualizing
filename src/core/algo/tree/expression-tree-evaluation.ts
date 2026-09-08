/**
 * expression-tree-evaluation.ts – build a tree from postfix, then
 * evaluate it postorder. (3 4 + 2 * 7 /) → ((3+4)*2)/7 = 2.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Edge = {
    id: string;
    sourceId: string;
    targetId: string;
    label: string;
    state: EntityState;
    directed: boolean;
};
const OPS = new Set(["+", "-", "*", "/"]);

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { postfix?: unknown } | null) ?? {};
    const postfix = Array.isArray(t.postfix)
        ? (t.postfix as unknown[]).map(String)
        : ["3", "4", "+", "2", "*", "7", "/"];

    let step = 0;
    const empty: VisualFrame = {
        stepNumber: step,
        entities: [],
        edges: [],
        description: "Empty postfix expression – nothing to evaluate.",
        codeLineNumber: 0,
        layout: "tree" as const,
        meta: { value: "none" },
    };
    if (postfix.length === 0) {
        yield empty;
        return;
    }

    // Stack build: operands push, operators pop two children.
    const isOp = (x: string): boolean => OPS.has(x) && x.length === 1;
    const parent = new Map<string, string | null>();
    const token = new Map<string, string>();
    const stack: string[] = [];
    let ok = true;
    postfix.forEach((tok, i) => {
        const id = `n${i}`;
        token.set(id, tok);
        if (!isOp(tok)) {
            parent.set(id, null);
            stack.push(id);
        } else if (stack.length >= 2) {
            const r = stack.pop() as string;
            const l = stack.pop() as string;
            parent.set(l, id);
            parent.set(r, id);
            parent.set(id, null);
            stack.push(id);
        } else {
            ok = false;
        }
    });
    if (!ok || stack.length !== 1) {
        yield { ...empty, description: "Malformed postfix – one value must remain on the stack." };
        return;
    }
    const root = stack[0] as string;

    const kids = new Map<string, string[]>();
    for (const id of token.keys()) kids.set(id, []);
    for (const [id, p] of parent) {
        if (p !== null) kids.get(p)?.push(id);
    }
    for (const id of token.keys()) {
        kids.get(id)?.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
    }

    const value = new Map<string, number>();
    const evalOrder: string[] = [];
    const calc = (id: string): number => {
        const tok = token.get(id) as string;
        if (!isOp(tok)) {
            const v = Number(tok);
            value.set(id, Number.isFinite(v) ? v : NaN);
            return value.get(id) as number;
        }
        const [l, r] = kids.get(id) as [string, string];
        const a = calc(l);
        const b = calc(r);
        let v = NaN;
        if (tok === "+") v = a + b;
        else if (tok === "-") v = a - b;
        else if (tok === "*") v = a * b;
        else if (tok === "/" && b !== 0) v = a / b;
        value.set(id, v);
        evalOrder.push(id);
        return v;
    };
    calc(root);
    const result = value.get(root) as number;

    const fmt = (v: number): string =>
        Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
    const treeEdges: Edge[] = [];
    for (const [id, p] of parent) {
        if (p !== null)
            treeEdges.push({
                id: `edge-${p}-${id}`,
                sourceId: `node-${p}`,
                targetId: `node-${id}`,
                state: "idle",
                label: "",
                directed: false,
            });
    }
    const emit = (
        states: Record<string, EntityState>,
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: [...token.keys()].map((id) => ({
            id: `node-${id}`,
            type: "node" as const,
            label:
                value.has(id) && states[id] !== "idle"
                    ? `${token.get(id)}=${fmt(value.get(id) as number)}`
                    : (token.get(id) as string),
            value: value.get(id) ?? 0,
            state: states[id] ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parent.get(id) ? `node-${parent.get(id)}` : "root" },
        })),
        edges: treeEdges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "tree" as const,
        meta,
    });

    yield emit({}, `Built expression tree from postfix ${postfix.join(" ")}.`, 0);
    step += 1;
    const show = evalOrder.length > 10 ? evalOrder.slice(0, 9) : evalOrder;
    for (const id of show) {
        const states: Record<string, EntityState> = {};
        for (const done of evalOrder.slice(0, evalOrder.indexOf(id))) states[done] = "visited";
        states[id] = "comparing";
        const [l, r] = kids.get(id) as [string, string];
        yield emit(
            states,
            `${fmt(value.get(l) as number)} ${token.get(id)} ${fmt(value.get(r) as number)} = ${fmt(value.get(id) as number)}.`,
            1,
        );
        step += 1;
    }
    const fstates: Record<string, EntityState> = {};
    for (const id of token.keys()) fstates[id] = "visited";
    fstates[root] = "sorted";
    yield emit(
        fstates,
        Number.isNaN(result)
            ? "Division by zero – result is NaN."
            : `Expression evaluates to ${fmt(result)}.`,
        2,
        { value: Number.isNaN(result) ? "NaN" : result },
    );
}

const module: AlgorithmModule = {
    id: "expression-tree-evaluation",
    name: "Expression Tree Evaluation",
    category: "tree",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { postfix: ["3", "4", "+", "2", "*", "7", "/"] },
    visualType: "tree",
    run,
};

export default module;
