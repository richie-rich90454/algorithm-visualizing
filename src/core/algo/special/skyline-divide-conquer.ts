/**
 * skyline-divide-conquer.ts – Skyline (divide and conquer).
 * Buildings [1,4,3],[2,5,5],[6,2,7] split at the median: each half's
 * silhouette is solved recursively, then the merge walks both strips
 * keeping the higher contour and dropping redundant points.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type B = [number, number, number];
type Pt = [number, number];

function merge(a: Pt[], b: Pt[]): Pt[] {
    const out: Pt[] = [];
    let i = 0;
    let j = 0;
    let ha = 0;
    let hb = 0;
    let cur = -1;
    while (i < a.length || j < b.length) {
        const xa = i < a.length ? (a[i]?.[0] ?? Infinity) : Infinity;
        const xb = j < b.length ? (b[j]?.[0] ?? Infinity) : Infinity;
        const x = Math.min(xa, xb);
        if (xa <= xb) {
            ha = a[i]?.[1] ?? 0;
            i += 1;
        }
        if (xb <= xa) {
            hb = b[j]?.[1] ?? 0;
            j += 1;
        }
        const h = Math.max(ha, hb);
        if (h !== cur) {
            out.push([x, h]);
            cur = h;
        }
    }
    return out;
}

function solve(bs: B[]): Pt[] {
    if (bs.length === 0) return [];
    if (bs.length === 1) {
        const [l, h, r] = bs[0] as B;
        return [
            [l, h],
            [r, 0],
        ];
    }
    const m = Math.floor(bs.length / 2);
    return merge(solve(bs.slice(0, m)), solve(bs.slice(m)));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { buildings?: B[] } | null) ?? {};
    const bs: B[] = (
        Array.isArray(cfg.buildings) && cfg.buildings.length > 0
            ? cfg.buildings
            : [
                  [1, 4, 3],
                  [2, 5, 5],
                  [6, 2, 7],
              ]
    ).slice(0, 5) as B[];
    const xs: number[] = [];
    for (const [l, , r] of bs) for (let x = l; x <= r; x += 1) if (!xs.includes(x)) xs.push(x);
    xs.sort((p, q) => p - q);
    const heightAt = (x: number): number =>
        bs.reduce((m, [l, h, r]) => (x >= l && x < r ? Math.max(m, h) : m), 0);
    const left = solve(bs.slice(0, Math.ceil(bs.length / 2)));
    const right = solve(bs.slice(Math.ceil(bs.length / 2)));
    const full = solve(bs);
    let step = 0;
    const frame = (pts: Pt[], desc: string): VisualFrame => {
        const keys = new Set(pts.map(([x]) => x));
        const entities: VisualEntity[] = xs.map((x) => ({
            id: `x-${x}`,
            type: "bar" as const,
            label: String(heightAt(x)),
            value: heightAt(x),
            state: (keys.has(x) ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: x },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: step,
            layout: "array",
            meta: { keyPoints: pts.map(([x, h]) => `${x},${h}`) },
        };
    };
    yield frame(
        [],
        `${bs.length} buildings over x=[${xs.join(",")}]; split at the median building.`,
    );
    step += 1;
    yield frame(left, `Left half silhouette: [${left.map(([x, h]) => `(${x},${h})`).join(" ")}].`);
    step += 1;
    yield frame(
        right,
        `Right half silhouette: [${right.map(([x, h]) => `(${x},${h})`).join(" ")}].`,
    );
    step += 1;
    yield frame(
        full,
        `Merge: sweep x left→right, track both heights, keep the max, emit on change.`,
    );
    step += 1;
    yield frame(full, `Skyline [${full.map(([x, h]) => `(${x},${h})`).join(" ")}] in O(n log n).`);
}

const module: AlgorithmModule = {
    id: "skyline-divide-conquer",
    name: "Skyline Divide & Conquer",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        buildings: [
            [1, 4, 3],
            [2, 5, 5],
            [6, 2, 7],
        ],
    },
    visualType: "array",
    run,
};

export default module;
