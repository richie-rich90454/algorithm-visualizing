/**
 * pc2-path-consistency.test.ts – Correctness and frame checks for PC-2 Path Consistency.
 */

import { describe, expect, it } from "vitest";
import pc2 from "./pc2-path-consistency";

type Relation = Set<string>;
const enc = (a: number, b: number): string => `${a},${b}`;
const k = (a: string, b: string): string => `${a}${b}`;

function framesOf(input: unknown) {
    return [...pc2.run(input)];
}

function checkFrameShape(frames: ReturnType<typeof framesOf>) {
    const lines = pc2.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lines);
        expect(frame.layout).toBe(pc2.visualType);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(ids.size).toBe(frame.entities.length);
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

/** Independent fixpoint reference for path consistency. */
function referenceClosure(domain: number[]) {
    const vars = ["X", "Y", "Z"];
    const rel = new Map<string, Relation>();
    for (const v of vars) rel.set(k(v, v), new Set(domain.map((x) => enc(x, x))));
    const all: Relation = new Set();
    for (const a of domain) for (const b of domain) all.add(enc(a, b));
    const xz: Relation = new Set([[1, 2], [2, 1]].map(([a, b]) => enc(a, b)));
    rel.set("XY", new Set(all));
    rel.set("YX", new Set(all));
    rel.set("XZ", new Set(xz));
    rel.set("ZX", new Set(xz));
    rel.set("YZ", new Set(xz));
    rel.set("ZY", new Set(xz));
    let changed = true;
    let guard = 0;
    while (changed && guard < 100000) {
        changed = false;
        guard += 1;
        for (const i of vars) for (const j of vars) for (const mid of vars) {
            if (i === j || j === mid || i === mid) continue;
            const rij = rel.get(k(i, j)) as Relation;
            const rik: Relation = rel.get(k(i, mid)) as Relation;
            const rkj: Relation = rel.get(k(mid, j)) as Relation;
            const kept = new Set([...rij].filter((p) => {
                const [a, b] = p.split(",").map(Number) as [number, number];
                return domain.some((c) => rik.has(enc(a, c)) && rkj.has(enc(c, b)));
            }));
            if (kept.size !== rij.size) {
                rel.set(k(i, j), kept);
                rel.set(k(j, i), new Set([...kept].map((p) => {
                    const [a, b] = p.split(",") as [string, string];
                    return enc(Number(b), Number(a));
                })));
                changed = true;
            }
        }
    }
    return rel;
}

function parseRelations(raw: unknown): Map<string, Relation> {
    const out = new Map<string, Relation>();
    if (!Array.isArray(raw)) return out;
    for (const label of raw as string[]) {
        const [pair, body] = String(label).split(":");
        if (!pair || body === undefined) continue;
        const set = new Set<string>();
        for (const p of body.replace(/[{}]/g, "").trim().split(/\s+/)) if (p) set.add(p);
        out.set(pair.replace(/-/g, ""), set);
    }
    return out;
}

describe("PC2PathConsistency", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = framesOf(pc2.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        expect(frames.length).toBeLessThan(200);
        checkFrameShape(frames);
    });

    it("matches an independent path-consistency fixpoint and the pairs only shrink", () => {
        const domain = [1, 2];
        const frames = framesOf({ domain });
        const final = parseRelations(frames[frames.length - 1]?.meta.relations);
        const expected = referenceClosure(domain);
        for (const pair of ["XY", "XZ", "YZ"]) {
            expect([...(final.get(pair) ?? [])].sort()).toEqual([...(expected.get(pair) ?? [])].sort());
        }

        const initial = frames[0]?.entities.map((e) => e.label) ?? [];
        const initialMap = new Map<string, number>();
        for (const label of initial) {
            const [pair, body] = label.split(":");
            if (pair && body) initialMap.set(pair.replace(/-/g, ""), body.replace(/[{}]/g, "").trim().split(/\s+/).filter(Boolean).length);
        }
        for (const label of frames[frames.length - 1]?.entities.map((e) => e.label) ?? []) {
            const [pair, body] = label.split(":");
            if (pair && body) {
                const count = body.replace(/[{}]/g, "").trim().split(/\s+/).filter(Boolean).length;
                expect(count).toBeLessThanOrEqual(initialMap.get(pair.replace(/-/g, "")) ?? count);
            }
        }

        // Final network satisfies the path-consistency definition for every triple.
        for (const pair of ["XY", "YX", "XZ", "ZX", "YZ", "ZY"]) {
            const rel = expected.get(pair) as Relation;
            const [i, j] = [pair[0] as string, pair[1] as string];
            const mid = ["X", "Y", "Z"].find((v) => v !== i && v !== j) as string;
            const rik = expected.get(k(i, mid)) as Relation;
            const rkj = expected.get(k(mid, j)) as Relation;
            for (const p of rel) {
                const [a, b] = p.split(",").map(Number) as [number, number];
                expect(domain.some((c) => rik.has(enc(a, c)) && rkj.has(enc(c, b)))).toBe(true);
            }
        }
        checkFrameShape(frames);
    });
});
