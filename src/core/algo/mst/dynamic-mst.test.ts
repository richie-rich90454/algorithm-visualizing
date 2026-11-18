import { describe, expect, it } from "vitest";
import mod from "./dynamic-mst";

type E = [string, string, number];
type U =
    | { op: "insert"; a: string; b: string; w: number }
    | { op: "delete"; a: string; b: string }
    | { op: "setWeight"; a: string; b: string; w: number };

/** Independent from-scratch minimum spanning forest weight (Kruskal). */
function referenceWeight(vertices: string[], edges: E[]): number {
    const parent = new Map<string, string>();
    const find = (x: string): string => {
        const p = parent.get(x) ?? x;
        if (p !== x) {
            const r = find(p);
            parent.set(x, r);
            return r;
        }
        return x;
    };
    for (const v of vertices) {
        parent.set(v, v);
    }
    let total = 0;
    const sorted = [...edges].sort((a, b) => a[2] - b[2]);
    for (const [a, b, w] of sorted) {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) {
            parent.set(ra, rb);
            total += w;
        }
    }
    return total;
}

/** Apply an update to a plain edge list, mirroring the input contract. */
function apply(edges: E[], update: U): void {
    const idx = edges.findIndex(
        (e) => (e[0] === update.a && e[1] === update.b) || (e[0] === update.b && e[1] === update.a),
    );
    if (update.op === "insert") {
        if (idx >= 0) {
            edges[idx] = [update.a, update.b, update.w];
        } else {
            edges.push([update.a, update.b, update.w]);
        }
    } else if (update.op === "delete") {
        if (idx >= 0) {
            edges.splice(idx, 1);
        }
    } else if (idx >= 0) {
        edges[idx] = [update.a, update.b, update.w];
    }
}

/** Check a set of edges really is a minimum spanning forest. */
function isMinimumForest(vertices: string[], edges: E[], chosen: E[]): boolean {
    const parent = new Map<string, string>();
    const find = (x: string): string => {
        const p = parent.get(x) ?? x;
        if (p !== x) {
            const r = find(p);
            parent.set(x, r);
            return r;
        }
        return x;
    };
    for (const v of vertices) {
        parent.set(v, v);
    }
    for (const [a, b] of chosen) {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb) {
            return false;
        }
        parent.set(ra, rb);
    }
    const graphParent = new Map<string, string>();
    const gfind = (x: string): string => {
        const p = graphParent.get(x) ?? x;
        if (p !== x) {
            const r = gfind(p);
            graphParent.set(x, r);
            return r;
        }
        return x;
    };
    for (const v of vertices) {
        graphParent.set(v, v);
    }
    for (const [a, b] of edges) {
        graphParent.set(gfind(a), gfind(b));
    }
    const roots = new Set(vertices.map(gfind));
    const usedRoots = new Map<string, Set<string>>();
    for (const [a] of chosen) {
        const r = gfind(a);
        if (!usedRoots.has(r)) {
            usedRoots.set(r, new Set());
        }
        (usedRoots.get(r) as Set<string>).add(a);
    }
    for (const r of roots) {
        const covered = usedRoots.get(r);
        if (!covered) {
            continue;
        }
        const group = vertices.filter((v) => gfind(v) === r);
        const localParent = new Map<string, string>();
        for (const v of group) {
            localParent.set(v, v);
        }
        const lfind = (x: string): string => {
            const p = localParent.get(x) ?? x;
            if (p !== x) {
                const rr = lfind(p);
                localParent.set(x, rr);
                return rr;
            }
            return x;
        };
        for (const [a, b] of chosen) {
            if (group.includes(a) && group.includes(b)) {
                localParent.set(lfind(a), lfind(b));
            }
        }
        if (new Set(group.map(lfind)).size !== 1) {
            return false;
        }
    }
    return true;
}

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("Dynamic MST", () => {
    it("matches a reference MST after every update in the default scenario", () => {
        const input = mod.defaultInput as {
            vertices: string[];
            edges: E[];
            updates: U[];
        };
        const frames = [...mod.run(input)];
        expect(frames.length).toBeGreaterThan(input.updates.length);

        const edges = input.edges.map((e) => [...e] as E);
        expect(frames[0]?.meta.totalWeight).toBe(referenceWeight(input.vertices, edges));

        input.updates.forEach((update, i) => {
            apply(edges, update);
            const expected = referenceWeight(input.vertices, edges);
            const matching = frames.filter(
                (f) => f.meta.update === i + 1 && f.meta.totalWeight === expected,
            );
            expect(matching.length, `update ${i + 1} should reach reference weight ${expected}`).toBeGreaterThan(0);
        });

        const last = frames[frames.length - 1];
        expect(last?.meta.totalWeight).toBe(referenceWeight(input.vertices, edges));
    });

    it("matches brute force on seeded random insertion, deletion, and reweight sequences", () => {
        const random = seeded(20261119);
        for (let trial = 0; trial < 24; trial += 1) {
            const vertices = ["A", "B", "C", "D", "E"];
            const edges: E[] = [];
            for (let i = 0; i < vertices.length - 1; i += 1) {
                edges.push([vertices[i] as string, vertices[i + 1] as string, 1 + Math.floor(random() * 9)]);
            }
            const pair = (): [string, string] => {
                const a = vertices[Math.floor(random() * vertices.length)] as string;
                const b = vertices[Math.floor(random() * vertices.length)] as string;
                return a === b ? [a, vertices[(vertices.indexOf(a) + 1) % vertices.length] as string] : [a, b];
            };
            const updates: U[] = [];
            const live: E[] = edges.map((e) => [...e] as E);
            for (let k = 0; k < 6; k += 1) {
                const [a, b] = pair();
                const w = 1 + Math.floor(random() * 12);
                const roll = random();
                if (roll < 0.4 || live.length === 0) {
                    updates.push({ op: "insert", a, b, w });
                    apply(live, updates[updates.length - 1] as U);
                } else if (roll < 0.7) {
                    updates.push({ op: "delete", a, b });
                    apply(live, updates[updates.length - 1] as U);
                } else {
                    updates.push({ op: "setWeight", a, b, w });
                    apply(live, updates[updates.length - 1] as U);
                }
            }
            const frames = [...mod.run({ vertices, edges, updates })];
            let current = edges.map((e) => [...e] as E);
            expect(frames[0]?.meta.totalWeight, `trial ${trial} initial`).toBe(referenceWeight(vertices, current));
            updates.forEach((update, i) => {
                apply(current, update);
                const expected = referenceWeight(vertices, current);
                const ok = frames.some(
                    (f) => f.meta.update === i + 1 && f.meta.totalWeight === expected,
                );
                expect(ok, `trial ${trial} update ${i + 1} expected weight ${expected}`).toBe(true);
            });
        }
    });

    it("the final frame is a valid acyclic spanning forest", () => {
        const input = mod.defaultInput as { vertices: string[]; edges: E[]; updates: U[] };
        const frames = [...mod.run(input)];
        const tracked = input.edges.map((e, i) => ({ id: i, a: e[0], b: e[1], w: e[2] }));
        let nextId = input.edges.length;
        for (const u of input.updates) {
            const idx = tracked.findIndex(
                (e) => (e.a === u.a && e.b === u.b) || (e.a === u.b && e.b === u.a),
            );
            if (u.op === "insert") {
                if (idx >= 0) {
                    (tracked[idx] as { w: number }).w = u.w;
                } else {
                    tracked.push({ id: nextId++, a: u.a, b: u.b, w: u.w });
                }
            } else if (u.op === "delete") {
                if (idx >= 0) {
                    tracked.splice(idx, 1);
                }
            } else if (idx >= 0) {
                (tracked[idx] as { w: number }).w = u.w;
            }
        }
        const byId = new Map(tracked.map((e) => [e.id, e]));
        const last = frames[frames.length - 1];
        const chosen = (last?.edges ?? [])
            .filter((e) => e.state === "sorted")
            .map((e) => byId.get(Number((e.id as string).split("-")[1])))
            .filter((e): e is { id: number; a: string; b: string; w: number } => e !== undefined)
            .map((e) => [e.a, e.b, e.w] as E);
        const finalEdges = tracked.map((e) => [e.a, e.b, e.w] as E);
        expect(chosen.length).toBeGreaterThan(0);
        expect(isMinimumForest(input.vertices, finalEdges, chosen)).toBe(true);
        expect(chosen.reduce((sum, e) => sum + e[2], 0)).toBe(last?.meta.totalWeight);
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(0);
        frames.forEach((frame, i) => {
            expect(frame.stepNumber).toBe(i);
            expect(typeof frame.description).toBe("string");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber as number).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber as number).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("graph");
            expect(typeof frame.meta.totalWeight).toBe("number");
            const ids = new Set(frame.entities.map((e) => e.id));
            expect(ids.size).toBe(frame.entities.length);
            for (const e of frame.entities) {
                expect(typeof e.id).toBe("string");
                expect(typeof e.label).toBe("string");
                expect(Number.isFinite(e.x)).toBe(true);
                expect(Number.isFinite(e.y)).toBe(true);
                expect(Number.isFinite(e.width)).toBe(true);
                expect(Number.isFinite(e.height)).toBe(true);
            }
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });

    it("handles an empty graph without throwing", () => {
        const frames = [...mod.run({ vertices: [], edges: [], updates: [] })];
        expect(frames.length).toBe(1);
        expect(frames[0]?.entities.length).toBe(0);
        expect(frames[0]?.description.length).toBeGreaterThanOrEqual(10);
    });
});
