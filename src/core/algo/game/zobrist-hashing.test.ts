import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./zobrist-hashing";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("grid");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

function recompute(board: number[], xKeys: number[], oKeys: number[], sideKey: number): number {
    let h = 0;
    for (let sq = 0; sq < 9; sq += 1) {
        if (board[sq] === 1) h ^= xKeys[sq] ?? 0;
        else if (board[sq] === -1) h ^= oKeys[sq] ?? 0;
    }
    return (h ^ sideKey) >>> 0;
}

describe("ZobristHashing", () => {
    it("incremental hashes match an independent from-scratch recomputation", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const first = fs[0];
        const xKeys = first?.meta.xKeys as number[];
        const oKeys = first?.meta.oKeys as number[];
        const sideKey = Number(first?.meta.sideKey);
        expect(xKeys.length).toBe(9);
        expect(oKeys.length).toBe(9);
        expect(Number(first?.meta.hash)).toBe(recompute(new Array(9).fill(0), xKeys, oKeys, sideKey));
        for (const f of fs) {
            if (!Array.isArray(f.meta.board)) continue;
            const board = f.meta.board as number[];
            expect(Number(f.meta.finalHash)).toBe(recompute(board, xKeys, oKeys, sideKey));
        }
    });
    it("XOR is its own inverse and different boards hash differently", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const first = fs[0];
        const xKeys = first?.meta.xKeys as number[];
        const oKeys = first?.meta.oKeys as number[];
        const sideKey = Number(first?.meta.sideKey);
        expect(xKeys[0]! ^ xKeys[0]!).toBe(0);
        expect(recompute([1, 0, 0, 0, 0, 0, 0, 0, 0], xKeys, oKeys, sideKey))
            .not.toBe(recompute([0, 1, 0, 0, 0, 0, 0, 0, 0], xKeys, oKeys, sideKey));
        const final = fs[fs.length - 1];
        expect(String(final?.meta.hash)).toBe(String(final?.meta.finalHash));
        expect(Number(final?.meta.moves)).toBe(4);
    });
});
