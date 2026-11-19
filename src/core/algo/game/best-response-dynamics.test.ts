import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./best-response-dynamics";

type Payoffs = [[number, number], [number, number]];

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
        expect(f.layout).toBe("grid");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => {
            expect(e.metadata.row).toBeDefined();
            expect(e.metadata.col).toBeDefined();
            expect(Number.isFinite(e.x)).toBe(true);
        });
        f.edges.forEach((e) => {
            const ids = new Set(f.entities.map((n) => n.id));
            expect(ids.has(e.sourceId)).toBe(true);
            expect(ids.has(e.targetId)).toBe(true);
        });
    });
}

function isNash(A: Payoffs, B: Payoffs, a: number, b: number): boolean {
    return (A[a][b] >= A[1 - a][b]) && (B[a][b] >= B[a][1 - b]);
}

function makeRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 22695477 + 1) >>> 0;
        return s / 4294967296;
    };
}

describe("BestResponseDynamics", () => {
    it("only takes legal best-response steps and reports equilibrium correctly", () => {
        const rng = makeRandom(70707);
        for (let t = 0; t < 150; t += 1) {
            const A: Payoffs = [
                [Math.floor(rng() * 9) - 4, Math.floor(rng() * 9) - 4],
                [Math.floor(rng() * 9) - 4, Math.floor(rng() * 9) - 4],
            ];
            const B: Payoffs = [
                [Math.floor(rng() * 9) - 4, Math.floor(rng() * 9) - 4],
                [Math.floor(rng() * 9) - 4, Math.floor(rng() * 9) - 4],
            ];
            const fs = frames({ payoffsA: A, payoffsB: B, maxSteps: 12 });
            shapes(fs);
            const last = fs[fs.length - 1];
            const finalProfile = last?.meta.profile as number[];
            expect(Boolean(last?.meta.equilibrium)).toBe(isNash(A, B, finalProfile[0] ?? 0, finalProfile[1] ?? 0));

            for (const f of fs.slice(1, -1)) {
                const from = f.meta.from as number[];
                const to = f.meta.to as number[];
                const mover = Number(f.meta.mover);
                if (mover === 0) {
                    expect(to[1]).toBe(from[1]);
                    const payoffStay = A[from[0]][from[1]];
                    const payoffSwitch = A[1 - from[0]][from[1]];
                    if (payoffSwitch > payoffStay) expect(to[0]).toBe(1 - from[0]);
                    else expect(to[0]).toBe(from[0]);
                } else {
                    expect(to[0]).toBe(from[0]);
                    const payoffStay = B[from[0]][from[1]];
                    const payoffSwitch = B[from[0]][1 - from[1]];
                    if (payoffSwitch > payoffStay) expect(to[1]).toBe(1 - from[1]);
                    else expect(to[1]).toBe(from[1]);
                }
            }
            const path = last?.meta.path as number[];
            const keys: string[] = [];
            for (let i = 0; i + 1 < path.length; i += 2) keys.push(`${path[i]},${path[i + 1]}`);
            const repeated = new Set(keys).size !== keys.length;
            expect(Boolean(last?.meta.cycle)).toBe(repeated);
        }
    });

    it("converges in the prisoner's dilemma and cycles in matching pennies", () => {
        const pd = frames(mod.defaultInput);
        shapes(pd);
        expect(pd[pd.length - 1]?.meta.equilibrium).toBe(true);
        expect(pd[pd.length - 1]?.meta.profile).toEqual([1, 1]);

        const mp = frames({
            payoffsA: [[1, -1], [-1, 1]],
            payoffsB: [[-1, 1], [1, -1]],
            maxSteps: 12,
        });
        shapes(mp);
        expect(mp[mp.length - 1]?.meta.cycle).toBe(true);
        expect(mp[mp.length - 1]?.meta.equilibrium).toBe(false);
        expect(mp.length).toBeLessThan(20);
    });
});
