/**
 * patience-diff.ts – Patience Diff.
 * Tiny deterministic default; 5-15 frames.
 *  time: "O(n log n) avg", space: "O(n)"
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

function tx(t: string, st: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(t).map((c) => {
        const i = Number((c.metadata as Record<string, unknown>)["index"]);
        return { ...c, state: st.get(i) ?? "idle" };
    });
}
function stAt(pos: number[], s: EntityState): Map<number, EntityState> {
    return new Map(pos.map((p) => [p, s] as [number, EntityState]));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: string[]; b?: string[] } | null) ?? {};
    const a = t.a ?? ["a", "b", "c"];
    const b = t.b ?? ["a", "c", "b"];
    let step = 0;
    const F = (
        entities: VisualEntity[],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber,
        layout: "text",
        meta,
    });
    yield F(tx(a.join("")), "Patience diff: unique lines as anchors.", 0);
    step += 1;
    const cb = new Map(b.map((x, i) => [x, i] as [string, number]));
    const seq: number[] = [];
    for (const x of a)
        if (
            cb.has(x) &&
            a.filter((y) => y === x).length === 1 &&
            b.filter((y) => y === x).length === 1
        )
            seq.push(cb.get(x) as number);
    yield F(
        tx(
            a.join(""),
            stAt(
                seq.map((_, i) => i),
                "comparing",
            ),
        ),
        `Unique-common positions: [${seq.join(", ")}].`,
        1,
    );
    step += 1;
    const piles: number[] = [];
    for (const x of seq) {
        let lo = 0,
            hi = piles.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if ((piles[mid] as number) < x) lo = mid + 1;
            else hi = mid;
        }
        piles[lo] = x;
        if (step < 10) {
            yield F(tx(a.join("")), `Patience pile ${lo} ← line ${x}.`, 2);
            step += 1;
        }
    }
    const lcsLen = piles.length;
    const ops: string[] = [];
    let i = 0,
        j = 0;
    while (i < a.length || j < b.length) {
        if (i < a.length && j < b.length && a[i] === b[j]) {
            ops.push(` ${a[i]}`);
            i += 1;
            j += 1;
        } else if (j < b.length && (i >= a.length || !a.slice(i).includes(b[j] as string))) {
            ops.push(`+${b[j]}`);
            j += 1;
        } else {
            ops.push(`-${a[i]}`);
            i += 1;
        }
    }
    yield F(tx(a.join("")), `LCS length ${lcsLen}; script:${ops.join(" ")}.`, 3, { ops });
    step += 1;
    yield F(tx(b.join("")), "Done.", 4, { ops });
}

const module: AlgorithmModule = {
    id: "patience-diff",
    name: "Patience Diff",
    category: "string",
    complexity: { time: "O(n log n) avg", space: "O(n)" },
    defaultInput: { a: ["a", "b", "c"], b: ["a", "c", "b"] },
    visualType: "text",
    run,
};

export default module;
