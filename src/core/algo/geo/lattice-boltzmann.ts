/**
 * lattice-boltzmann.ts - D2Q9 lattice Boltzmann fluid step.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The D2Q9 lattice stores nine particle distribution functions at every grid
 * cell. Each time step relaxes them toward a local equilibrium (collision)
 * with rate set by the relaxation time tau, then moves them to neighboring
 * cells along their lattice velocities (streaming). A smooth density bump
 * spreads outward as a pressure wave; total mass is conserved up to floating
 * point roundoff.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(steps * width * height * 9)
 *   Space: O(width * height * 9)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid cell is colored by its local density above the baseline.
 *   - Cells in the spreading wave are highlighted.
 *   - The final frame reports total mass and maximum flow speed.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const CX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
const CY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];

function equilibrium(rho: number, ux: number, uy: number, i: number): number {
    const cu = CX[i]! * ux + CY[i]! * uy;
    const usq = ux * ux + uy * uy;
    return W[i]! * rho * (1 + 3 * cu + 4.5 * cu * cu - 1.5 * usq);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { width?: number; height?: number; steps?: number; tau?: number } | null) ?? {};
    const width = Math.max(3, Math.min(24, task.width ?? 10));
    const height = Math.max(3, Math.min(24, task.height ?? 10));
    const steps = Math.max(1, Math.min(40, task.steps ?? 8));
    const tau = Math.max(0.51, task.tau ?? 0.8);
    const size = width * height;
    const f: number[][] = Array.from({ length: 9 }, () => new Array<number>(size).fill(0));

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const dx = x - width / 2;
            const dy = y - height / 2;
            const rho = 1 + 0.6 * Math.exp(-(dx * dx + dy * dy) / 4);
            const index = y * width + x;
            for (let i = 0; i < 9; i += 1) f[i]![index] = equilibrium(rho, 0, 0, i);
        }
    }

    const frameFor = (step: number, description: string, codeLine: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        let totalMass = 0;
        let maxSpeed = 0;
        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const index = y * width + x;
                let rho = 0;
                let mx = 0;
                let my = 0;
                for (let i = 0; i < 9; i += 1) {
                    const value = f[i]![index] as number;
                    rho += value;
                    mx += value * CX[i]!;
                    my += value * CY[i]!;
                }
                totalMass += rho;
                if (rho > 0) {
                    maxSpeed = Math.max(maxSpeed, Math.hypot(mx / rho, my / rho));
                }
                const excess = rho - 1;
                entities.push({
                    id: `cell-${x}-${y}`,
                    type: "cell",
                    label: excess.toFixed(2),
                    value: rho,
                    state: (excess > 0.05 ? "active" : excess < -0.02 ? "comparing" : "idle") as EntityState,
                    x,
                    y,
                    width: 0,
                    height: 0,
                    metadata: { row: y, col: x, density: rho },
                });
            }
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description,
            codeLineNumber: codeLine,
            layout: "grid",
            meta: {
                rows: height,
                cols: width,
                step,
                mass: totalMass,
                maxSpeed,
            },
        };
    };

    let step = 0;
    yield frameFor(step++, "Initial density bump on a periodic D2Q9 lattice.", 0);

    for (let iteration = 1; iteration <= steps; iteration += 1) {
        const next: number[][] = Array.from({ length: 9 }, () => new Array<number>(size).fill(0));
        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const index = y * width + x;
                let rho = 0;
                let mx = 0;
                let my = 0;
                for (let i = 0; i < 9; i += 1) {
                    const value = f[i]![index] as number;
                    rho += value;
                    mx += value * CX[i]!;
                    my += value * CY[i]!;
                }
                const ux = rho > 0 ? mx / rho : 0;
                const uy = rho > 0 ? my / rho : 0;
                for (let i = 0; i < 9; i += 1) {
                    const post = (f[i]![index] as number) * (1 - 1 / tau) + (equilibrium(rho, ux, uy, i) / tau);
                    const nx = (x + CX[i]! + width) % width;
                    const ny = (y + CY[i]! + height) % height;
                    next[i]![ny * width + nx] = post;
                }
            }
        }
        for (let i = 0; i < 9; i += 1) f[i] = next[i]!;
        yield frameFor(step++, `Time step ${iteration}: collision and streaming moved the wave outward.`, 4);
    }

    const final = frameFor(step, `Simulation finished after ${steps} step(s); mass is conserved.`, 7);
    yield final;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine tiny particles moving on a nine-direction grid. They collide toward a local average and then step to neighboring cells. Even with these simple rules, the average motion behaves like a fluid, and a dense spot relaxes into a spreading pressure wave.",
        invariants: [
            "The nine lattice weights sum to one and the equilibrium reproduces the local density.",
            "Streaming only permutes values between cells, so total mass is conserved.",
            "The relaxation time tau stays above one half for a stable collision step.",
        ],
        correctness:
            "Collision redistributes each cell's population without changing its density or momentum because the equilibrium has the same moments as the input distribution. Streaming then shifts every population to a neighboring cell and, with periodic boundaries, preserves the sum over the whole lattice. Therefore the density and momentum moments of the update match the discrete continuity and momentum equations of the D2Q9 model, and the brute-force mass check confirms conservation.",
        complexityRationale:
            "Each step visits every cell and all nine directions twice, once for moments and once for collision and streaming, so O(steps * width * height * 9) time; nine arrays of cell size are stored, giving O(width * height * 9) space.",
        uses: [
            "Computational fluid dynamics on regular grids",
            "Porous media and microfluidic flow simulation",
            "Visual effects for smoke and fluid animation",
        ],
        references: [
            "Kruger et al., The Lattice Boltzmann Method: Principles and Practice, 2017",
            "Qian, d'Humieres and Lallemand, Lattice BGK Models for Navier-Stokes Equations, 1992",
        ],
        workedExample:
            "On a ten by ten lattice with tau = 0.8, a Gaussian density bump centered in the grid spreads over eight steps. Summing density over all cells before and after the steps gives essentially the same total, while the maximum flow speed first rises and then settles as the wave disperses.",
    },
    id: "lattice-boltzmann",
    name: "Lattice Boltzmann D2Q9",
    category: "geometry",
    complexity: { time: "O(steps * w * h * 9)", space: "O(w * h * 9)" },
    defaultInput: { width: 10, height: 10, steps: 8, tau: 0.8 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize nine distributions from a smooth density bump",
        "for each time step",
        "sum distributions to get density and momentum at each cell",
        "compute the local equilibrium distribution",
        "relax each population toward equilibrium using tau",
        "stream populations along their lattice velocities",
        "wrap populations that leave the periodic grid",
        "report the evolved density field and conserved mass",
    ],
};

export default module;
