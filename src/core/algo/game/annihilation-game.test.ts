import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./annihilation-game";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThanOrEqual(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("text");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => {
            expect(e.type).toBe("character");
            expect(Number.isFinite(e.x)).toBe(true);
            expect(Number.isFinite(e.y)).toBe(true);
        });
        f.edges.forEach((e) => {
            const ids = new Set(f.entities.map((n) => n.id));
            expect(ids.has(e.sourceId)).toBe(true);
            expect(ids.has(e.targetId)).toBe(true);
        });
    });
}

// Independent win/lose search with no Grundy numbers: the position is a list of
// rows because a removal splits a row into two disjoint subgames.
function bruteWin(rows: string[]): boolean {
    for (let r = 0; r < rows.length; r += 1) {
        const row = rows[r] ?? "";
        for (let i = 0; i + 1 < row.length; i += 1) {
            if (row[i] !== row[i + 1]) continue;
            const next = rows.slice();
            next.splice(r, 1, row.slice(0, i), row.slice(i + 2));
            if (!bruteWin(next)) return true;
        }
    }
    return false;
}

function makeRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 22695477 + 1) >>> 0;
        return s / 4294967296;
    };
}

describe("AnnihilationGame", () => {
    it("matches an independent win/lose solver on random rows", () => {
        const rng = makeRandom(98123);
        for (let t = 0; t < 100; t += 1) {
            const len = 2 + (t % 7);
            const tokens = Array.from({ length: len }, () => (rng() < 0.5 ? "R" : "B"));
            const fs = frames({ tokens });
            shapes(fs);
            const expected = bruteWin([tokens.join("")]);
            const last = fs[fs.length - 1];
            expect(Boolean(last?.meta.winning)).toBe(expected);
            expect(Number(last?.meta.rootSG) !== 0).toBe(expected);
        }
    });

    it("selects a genuinely winning first move and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        const tokens = last?.meta.tokens as string[];
        const key = tokens.join("");
        const idx = Number(last?.meta.firstWinningMove);
        if (Boolean(last?.meta.winning)) {
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(tokens[idx]).toBe(tokens[idx + 1]);
            const after = [key.slice(0, idx), key.slice(idx + 2)];
            expect(bruteWin(after)).toBe(false);
        }
        expect(fs.length).toBeLessThan(30);
    });
});
