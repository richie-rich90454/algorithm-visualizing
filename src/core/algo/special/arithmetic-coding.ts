/**
 * arithmetic-coding.ts – Arithmetic coding.
 * "aaba" with P(a)=0.6, P(b)=0.4 narrows [0,1) symbol by symbol to
 * [0.216,0.3024); any number inside decodes back. Both directions run
 * for real; round-trip is verified, not assumed.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const PROBS = new Map<string, [number, number]>([
    ["a", [0, 0.6]],
    ["b", [0.6, 1]],
]);

function encode(msg: string): [number, number] {
    let lo = 0;
    let hi = 1;
    for (const ch of msg) {
        const [l, h] = PROBS.get(ch) ?? [0, 1];
        const w = hi - lo;
        hi = lo + w * h;
        lo = lo + w * l;
    }
    return [lo, hi];
}

function decode(code: number, n: number): string {
    let out = "";
    let [lo, hi] = [0, 1];
    for (let i = 0; i < n; i += 1) {
        const w = hi - lo;
        const v = (code - lo) / w;
        for (const [ch, [l, h]] of PROBS) {
            if (v >= l && v < h) {
                out += ch;
                hi = lo + w * h;
                lo = lo + w * l;
                break;
            }
        }
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { message?: string } | null) ?? {};
    const msg =
        typeof cfg.message === "string" && cfg.message.length > 0
            ? cfg.message.slice(0, 8)
            : "aaba";
    let step = 0;
    let lo = 0;
    let hi = 1;
    const frame = (desc: string, line: number): VisualFrame => {
        const r = (v: number): number => Math.round(v * 10000) / 10000;
        const entities: VisualEntity[] = [
            {
                id: "lo",
                type: "cell" as const,
                label: `lo=${r(lo)}`,
                value: r(lo),
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            },
            {
                id: "hi",
                type: "cell" as const,
                label: `hi=${r(hi)}`,
                value: r(hi),
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 1 },
            },
            {
                id: "sym",
                type: "cell" as const,
                label: [...msg].slice(0, line).join("") || "∅",
                value: [...msg].slice(0, line).join(""),
                state: "comparing" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 1, col: 0 },
            },
        ];
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "grid",
            meta: { lo: r(lo), hi: r(hi) },
        };
    };
    yield frame(`Message "${msg}": a→[0,0.6), b→[0.6,1); interval starts [0,1).`, 0);
    step += 1;
    for (let t = 0; t < msg.length; t += 1) {
        const snap = encode(msg.slice(0, t + 1));
        lo = snap[0];
        hi = snap[1];
        yield frame(
            `Symbol "${msg[t]}": zoom into its sub-range → [${lo.toFixed(4)},${hi.toFixed(4)}).`,
            t + 1,
        );
        step += 1;
    }
    const [flo, fhi] = encode(msg);
    const code = (flo + fhi) / 2;
    const back = decode(code, msg.length);
    yield frame(
        `Code ${code.toFixed(5)} lies inside; decoding gives "${back}" (match: ${back === msg}).`,
        msg.length + 1,
    );
}

const module: AlgorithmModule = {
    id: "arithmetic-coding",
    name: "Arithmetic Coding",
    category: "string",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { message: "aaba" },
    visualType: "grid",
    run,
};

export default module;
