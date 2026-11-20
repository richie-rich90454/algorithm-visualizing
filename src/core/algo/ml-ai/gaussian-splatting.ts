/**
 * gaussian-splatting.ts - 3D Gaussian Splatting Projection and Blending
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * 3D Gaussian splatting represents a scene as many oriented 3D Gaussians with
 * color and opacity. Each Gaussian is projected to an elliptical 2D splash by
 * pushing its covariance through the perspective Jacobian. The splats are then
 * sorted by depth and alpha-composited front to back to produce a pixel color,
 * all in a rasterizer-friendly order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for depth sorting plus O(n) per composited pixel
 *   Space: O(n) for the projected splats
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row of the grid is one splat, ordered from nearest to farthest.
 *   - Cells show projected center, depth, opacity, and color channels.
 *   - Frame meta exposes every projected splat and the composited color.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface Gaussian {
    mean: [number, number, number];
    scale: [number, number, number];
    color: [number, number, number];
    opacity: number;
}

interface SplattingInput {
    gaussians?: Gaussian[];
    focal?: number;
    center?: [number, number];
}

export interface ProjectedSplat {
    u: number;
    v: number;
    depth: number;
    covariance: [number, number, number];
    color: [number, number, number];
    opacity: number;
}

/** Perspective projection of an axis-aligned 3D Gaussian to a 2D ellipse. */
export function projectGaussian(g: Gaussian, focal: number, cx: number, cy: number): ProjectedSplat {
    const [x, y, z] = g.mean;
    const depth = Math.max(1e-6, z);
    const u = (focal * x) / depth + cx;
    const v = (focal * y) / depth + cy;
    const sx = g.scale[0] ?? 0;
    const sy = g.scale[1] ?? 0;
    const sz = g.scale[2] ?? 0;
    const duX = focal / depth;
    const duZ = (-focal * x) / (depth * depth);
    const dvY = focal / depth;
    const dvZ = (-focal * y) / (depth * depth);
    const c11 = duX * duX * sx * sx + duZ * duZ * sz * sz;
    const c12 = duZ * dvZ * sz * sz;
    const c22 = dvY * dvY * sy * sy + dvZ * dvZ * sz * sz;
    return {
        u,
        v,
        depth,
        covariance: [c11, c12, c22],
        color: [...g.color],
        opacity: g.opacity,
    };
}

/** Front-to-back alpha compositing of depth-sorted splats. */
export function alphaBlend(splats: ProjectedSplat[]): [number, number, number] {
    let transmittance = 1;
    const result: [number, number, number] = [0, 0, 0];
    for (const splat of splats) {
        const alpha = Math.max(0, Math.min(1, splat.opacity)) * transmittance;
        for (let c = 0; c < 3; c += 1) {
            result[c] += alpha * (splat.color[c] ?? 0);
        }
        transmittance *= 1 - alpha;
    }
    return result;
}

/** Project, sort near to far, and composite all Gaussians at one pixel. */
export function splatScene(gaussians: Gaussian[], focal: number, cx: number, cy: number): { splats: ProjectedSplat[]; color: [number, number, number] } {
    const projected = gaussians.map((g) => projectGaussian(g, focal, cx, cy));
    projected.sort((a, b) => a.depth - b.depth);
    return { splats: projected, color: alphaBlend(projected) };
}

/** Plain records for frame meta. */
function metaSplats(splats: ProjectedSplat[]): Array<Record<string, number | number[]>> {
    return splats.map((splat) => ({
        u: splat.u,
        v: splat.v,
        depth: splat.depth,
        covariance: [...splat.covariance],
        color: [...splat.color],
        opacity: splat.opacity,
    }));
}

function makeCells(splats: ProjectedSplat[], active: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const values = (splat: ProjectedSplat): number[] => [
        splat.u, splat.v, splat.depth, splat.opacity, ...splat.color,
    ];
    for (let row = 0; row < splats.length; row += 1) {
        values(splats[row]!).forEach((value, col) => {
            entities.push({
                id: `splat-${row}-${col}`,
                type: "cell",
                label: value.toFixed(2),
                value,
                state: row === active ? "active" : row < active ? "visited" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, field: col },
            });
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SplattingInput | null) ?? {};
    const gaussians: Gaussian[] = (task.gaussians ?? [
        { mean: [-1, 0, 3], scale: [0.2, 0.3, 0.1], color: [1, 0, 0], opacity: 0.8 },
        { mean: [0, 0.5, 2], scale: [0.3, 0.2, 0.2], color: [0, 1, 0], opacity: 0.6 },
        { mean: [1, -0.4, 4], scale: [0.4, 0.1, 0.3], color: [0, 0, 1], opacity: 0.5 },
        { mean: [0.2, 0.1, 5], scale: [0.2, 0.2, 0.2], color: [1, 1, 0], opacity: 0.3 },
    ]).map((g) => ({ mean: [...g.mean], scale: [...g.scale], color: [...g.color], opacity: g.opacity }));
    const focal = typeof task.focal === "number" ? task.focal : 2;
    const cx = task.center?.[0] ?? 0;
    const cy = task.center?.[1] ?? 0;
    const { splats, color } = splatScene(gaussians, focal, cx, cy);
    const cols = 7;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(splats, -1),
        edges: [],
        description: `Projecting ${gaussians.length} 3D Gaussians and sorting them from nearest to farthest.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: splats.length, cols, focal, cx, cy, splats: metaSplats(splats), color: [0, 0, 0] },
    };
    step += 1;

    let transmittance = 1;
    let accumulated: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < splats.length; i += 1) {
        const splat = splats[i]!;
        const alpha = Math.max(0, Math.min(1, splat.opacity)) * transmittance;
        accumulated = [
            accumulated[0] + alpha * splat.color[0],
            accumulated[1] + alpha * splat.color[1],
            accumulated[2] + alpha * splat.color[2],
        ];
        transmittance *= 1 - alpha;
        yield {
            stepNumber: step,
            entities: makeCells(splats, i),
            edges: [],
            description: `Splat ${i} at depth ${splat.depth.toFixed(2)}: effective alpha ${alpha.toFixed(3)}, accumulated color (${accumulated.map((v) => v.toFixed(2)).join(",")}).`,
            codeLineNumber: i === 0 ? 2 : 4,
            layout: "grid",
            meta: { rows: splats.length, cols, focal, cx, cy, splats: metaSplats(splats), color: accumulated, transmittance, composited: i + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(splats, splats.length - 1),
        edges: [],
        description: `Composited ${splats.length} splats; final color (${color.map((v) => v.toFixed(3)).join(",")}).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: splats.length, cols, focal, cx, cy, splats: metaSplats(splats), color },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of drawing meshes, represent a scene as fuzzy colored blobs. Each blob is a 3D Gaussian that becomes an ellipse when seen through a camera. Sorting blobs from near to far and blending their colors and opacities recreates the image, and the whole process is friendly to parallel graphics hardware.",
        invariants: [
            "Projection uses the perspective Jacobian, so the 2D covariance is symmetric and positive semidefinite.",
            "Splats are composited in increasing depth order, nearest first.",
            "The transmittance starts at one and only decreases as opaque splats are accumulated.",
        ],
        correctness:
            "Pushing the 3D covariance through the Jacobian of the projection map gives the exact first-order 2D covariance of the projected Gaussian. Alpha compositing implements the volume rendering integral for discrete samples: each splat contributes its opacity times the remaining transmittance, and transmittance is multiplied by one minus that opacity. Sorting by depth is required because the integral is ordered along the viewing ray.",
        complexityRationale:
            "Projecting each Gaussian and building its covariance is constant work, depth sorting costs O(n log n), and one pixel's color needs O(n) blending operations, giving O(n) space for the splat list.",
        uses: [
            "Real-time photorealistic novel-view synthesis",
            "3D scene reconstruction from photographs",
            "Interactive virtual and augmented reality rendering",
        ],
        references: [
            "Kerbl, Kopanas, Leimkuehler, Drettakis, 3D Gaussian Splatting for Real-Time Radiance Field Rendering, SIGGRAPH 2023",
            "Zwicker et al., Surface Splatting, SIGGRAPH 2001",
        ],
        workedExample:
            "A red Gaussian with opacity 0.8 in front of a green one with opacity 0.6 gives transmittance 0.2 after the first splat. The final color is 0.8*red plus 0.2*0.6*green, leaving 0.08 of the background visible.",
    },
    id: "gaussian-splatting",
    name: "3D Gaussian Splatting",
    category: "ml-ai",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        gaussians: [
            { mean: [-1, 0, 3], scale: [0.2, 0.3, 0.1], color: [1, 0, 0], opacity: 0.8 },
            { mean: [0, 0.5, 2], scale: [0.3, 0.2, 0.2], color: [0, 1, 0], opacity: 0.6 },
            { mean: [1, -0.4, 4], scale: [0.4, 0.1, 0.3], color: [0, 0, 1], opacity: 0.5 },
            { mean: [0.2, 0.1, 5], scale: [0.2, 0.2, 0.2], color: [1, 1, 0], opacity: 0.3 },
        ],
        focal: 2,
        center: [0, 0],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each 3D Gaussian compute the perspective Jacobian",
        "push its covariance through the Jacobian to get a 2D ellipse",
        "project the mean to image coordinates and record depth",
        "sort all splats by increasing depth",
        "initialize transmittance to one and color to zero",
        "for each splat in sorted order accumulate alpha times color",
        "multiply transmittance by one minus the splat alpha",
        "done: return the composited pixel color",
    ],
};

export default module;
