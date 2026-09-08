/**
 * double-array-trie.ts – Double-Array Trie
 *
 * Two flat arrays encode a trie: base[s] + code leads to a slot whose
 * check entry must equal s. Lookup is two array reads per character.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeRows(base: number[], check: number[], hot: Set<string>): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < base.length; i += 1) {
        const b: EntityState = hot.has(`b${i}`) ? "comparing" : "idle";
        cells.push({
            id: `base-${i}`,
            type: "cell" as const,
            label: `b${i}=${base[i] ?? 0}`,
            value: base[i] ?? 0,
            state: b,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        });
        const c: EntityState = hot.has(`c${i}`) ? "comparing" : "idle";
        cells.push({
            id: `check-${i}`,
            type: "cell" as const,
            label: `c${i}=${check[i] ?? -1}`,
            value: check[i] ?? -1,
            state: c,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: i },
        });
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: string[]; lookup?: string } | null) ?? {};
    const keys = task.keys ?? ["cat", "car", "dog"];
    const lookup = task.lookup ?? "car";
    let step = 0;
    const code = (ch: string): number => ch.charCodeAt(0) - 96;

    if (keys.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "No keys – the trie is empty.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { keys: 0 },
        };
        return;
    }

    const children: Array<Map<number, number>> = [new Map()];
    const terminal: boolean[] = [false];
    for (const key of keys) {
        let s = 0;
        for (const ch of key) {
            const c = code(ch);
            let t = children[s]?.get(c);
            if (t === undefined) {
                t = children.length;
                children.push(new Map());
                terminal.push(false);
                children[s]?.set(c, t);
            }
            s = t;
        }
        terminal[s] = true;
    }

    const base: number[] = [0];
    const check: number[] = [-1];
    const ensure = (n: number): void => {
        while (base.length <= n) {
            base.push(0);
            check.push(-1);
        }
    };
    const snap = (hot: Set<string>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: makeRows(base, check, hot),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { keys: keys.length },
    });

    yield snap(new Set(), `Empty double-array for ${keys.length} key(s).`, 0);
    step += 1;

    const order: number[] = [0];
    for (let oi = 0; oi < order.length; oi += 1) {
        const s = order[oi] ?? 0;
        const kids = [...(children[s]?.entries() ?? [])];
        if (kids.length === 0) {
            continue;
        }
        let b = 1;
        for (;;) {
            ensure(b + 26);
            if (kids.every(([c]) => check[b + c] === -1)) {
                break;
            }
            b += 1;
        }
        base[s] = b;
        const hot = new Set<string>([`b${s}`]);
        for (const [c, t] of kids) {
            check[b + c] = s;
            hot.add(`c${b + c}`);
            order.push(t);
        }
        yield snap(hot, `State ${s} gets base ${b} – ${kids.length} transition(s) placed.`, 1);
        step += 1;
    }

    let state = 0;
    let ok = true;
    for (const ch of lookup) {
        const c = code(ch);
        const t = (base[state] ?? 0) + c;
        const good = t < check.length && check[t] === state;
        yield snap(
            new Set([`b${state}`, ...(good ? [`c${t}`] : [])]),
            good
                ? `Lookup "${lookup}": '${ch}' moves ${state} to ${children[state]?.get(c)}.`
                : `Lookup "${lookup}": '${ch}' has no transition from ${state} – absent.`,
            2,
        );
        step += 1;
        if (!good) {
            ok = false;
            break;
        }
        state = children[state]?.get(c) ?? -1;
    }
    const found = ok && (terminal[state] ?? false);
    yield snap(
        new Set([`b${state}`]),
        found
            ? `"${lookup}" found – terminal state ${state} reached.`
            : `"${lookup}" is not stored.`,
        3,
    );
}

const module: AlgorithmModule = {
    id: "double-array-trie",
    name: "Double-Array Trie",
    category: "data-structures",
    complexity: { time: "O(m)", space: "O(states)" },
    defaultInput: { keys: ["cat", "car", "dog"], lookup: "car" },
    visualType: "grid",
    run,
};

export default module;
