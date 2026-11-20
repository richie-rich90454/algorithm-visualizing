/** polar-code.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./polar-code";
import type { VisualFrame, MetaValue } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function asBits(value: MetaValue | undefined): number[] {
    return (value as number[]).map((bit) => (bit === 1 ? 1 : 0));
}

function kron(a: number[][], b: number[][]): number[][] {
    const rows = a.length * b.length;
    const cols = (a[0]?.length ?? 0) * (b[0]?.length ?? 0);
    const out = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
    for (let i = 0; i < a.length; i += 1)
        for (let j = 0; j < (a[i]?.length ?? 0); j += 1)
            for (let p = 0; p < b.length; p += 1)
                for (let q = 0; q < (b[p]?.length ?? 0); q += 1)
                    if (a[i]?.[j] && b[p]?.[q]) out[i * b.length + p]![j * (b[p]?.length ?? 0) + q] = 1;
    return out;
}

function referenceGenerator(): number[][] {
    let g = [
        [1, 0],
        [1, 1],
    ];
    g = kron(g, [
        [1, 0],
        [1, 1],
    ]);
    return kron(g, [
        [1, 0],
        [1, 1],
    ]);
}

function encode(u: number[], g: number[][]): number[] {
    return g.map((row) => row.reduce((parity, bit, i) => parity ^ (bit & (u[i] ?? 0)), 0));
}

const INFO = [5, 6, 7];
const FROZEN = [0, 1, 2, 3, 4];

function bruteDecode(x: number[], g: number[][]): number[] {
    for (let candidate = 0; candidate < 8; candidate += 1) {
        const u = new Array<number>(8).fill(0);
        INFO.forEach((pos, i) => {
            u[pos] = (candidate >> (2 - i)) & 1;
        });
        if (encode(u, g).every((bit, i) => bit === x[i])) {
            return INFO.map((pos) => u[pos] as number);
        }
    }
    return [-1, -1, -1];
}

describe("Polar Code", () => {
    it("encodes and decodes the default message correctly", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        const g = referenceGenerator();
        const x = asBits(last?.meta["x"]);
        const decoded = asBits(last?.meta["decoded"]);
        expect(x).toEqual(encode(asBits(last?.meta["u"]), g));
        expect(decoded).toEqual(bruteDecode(x, g));
        expect(decoded).toEqual([1, 0, 1]);
        expect(last?.meta["correct"]).toBe(true);
        const recoveredU = asBits(last?.meta["u"]);
        for (const pos of FROZEN) expect(recoveredU[pos]).toBe(0);
    });

    it("round-trips every possible three-bit message against brute force", () => {
        const g = referenceGenerator();
        for (let candidate = 0; candidate < 8; candidate += 1) {
            const message = [0, 1, 2].map((i) => (candidate >> (2 - i)) & 1);
            const frames = [...mod.run({ message })];
            const last = frames[frames.length - 1];
            const x = asBits(last?.meta["x"]);
            expect(x).toEqual(
                encode(
                    (() => {
                        const u = new Array<number>(8).fill(0);
                        INFO.forEach((pos, i) => {
                            u[pos] = message[i] as number;
                        });
                        return u;
                    })(),
                    g,
                ),
            );
            expect(asBits(last?.meta["decoded"])).toEqual(bruteDecode(x, g));
            expect(asBits(last?.meta["decoded"])).toEqual(message);
            expect(last?.meta["correct"]).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
