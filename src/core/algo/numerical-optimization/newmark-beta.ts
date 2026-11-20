/**
 * newmark-beta.ts - Newmark-Beta Time Integration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Newmark-beta family integrates the second-order equation of motion
 * m*u'' + c*u' + k*u = f one time step at a time. It expresses the new
 * displacement and velocity in terms of the unknown new acceleration using two
 * parameters beta and gamma, then solves the equation of motion at the new
 * time for that acceleration. With beta = 1/4 and gamma = 1/2 (the average
 * acceleration rule) the scheme is unconditionally stable for a linear
 * oscillator and conserves energy when there is no damping.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps) for a single degree of freedom
 *   Space: O(steps) for the displacement history in the frames
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the displacement at each recorded time step.
 *   - The current step is yellow; the final step is green.
 *   - meta carries displacement, velocity, acceleration, and the exact answer
 *     for the undamped case.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface NewmarkInput {
    mass?: number;
    stiffness?: number;
    damping?: number;
    displacement?: number;
    velocity?: number;
    dt?: number;
    steps?: number;
    beta?: number;
    gamma?: number;
}

function makeBars(values: number[], active: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => {
        const state: EntityState = done && index === values.length - 1
            ? "sorted"
            : index === active
                ? "active"
                : "visited";
        return {
            id: `disp-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, step: index, displacement: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as NewmarkInput | null) ?? {};
    const mass = Math.max(1e-6, Number(task.mass ?? 1) || 1);
    const stiffness = Math.max(0, Number(task.stiffness ?? 4) || 4);
    const damping = Math.max(0, Number(task.damping ?? 0) || 0);
    const dt = Math.max(1e-6, Number(task.dt ?? 0.05) || 0.05);
    const steps = Math.min(400, Math.max(1, Math.floor(Number(task.steps ?? 40)) || 40));
    const beta = Number.isFinite(Number(task.beta)) ? Number(task.beta) : 0.25;
    const gamma = Number.isFinite(Number(task.gamma)) ? Number(task.gamma) : 0.5;
    let displacement = Number(task.displacement ?? 1);
    let velocity = Number(task.velocity ?? 0);
    let acceleration = (-damping * velocity - stiffness * displacement) / mass;
    const omega = Math.sqrt(stiffness / mass);
    const history: number[] = [displacement];
    let step = 0;

    const energy = () => 0.5 * mass * velocity * velocity + 0.5 * stiffness * displacement * displacement;

    yield {
        stepNumber: step,
        entities: makeBars(history, 0, false),
        edges: [],
        description: `Initial state: displacement ${displacement.toFixed(4)}, velocity ${velocity.toFixed(4)}, dt ${dt}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { time: 0, displacement, velocity, acceleration, analytic: displacement, energy: energy(), beta, gamma, steps },
    };
    step += 1;

    for (let iteration = 0; iteration < steps; iteration += 1) {
        const displacementPredictor = displacement + dt * velocity + dt * dt * (0.5 - beta) * acceleration;
        const velocityPredictor = velocity + dt * (1 - gamma) * acceleration;
        const denominator = mass + damping * dt * gamma + stiffness * dt * dt * beta;
        acceleration = -(damping * velocityPredictor + stiffness * displacementPredictor) / denominator;
        displacement = displacementPredictor + dt * dt * beta * acceleration;
        velocity = velocityPredictor + dt * gamma * acceleration;
        history.push(displacement);
        const time = (iteration + 1) * dt;
        const analytic = damping === 0
            ? (task.displacement ?? 1) * Math.cos(omega * time) + ((task.velocity ?? 0) / (omega || 1)) * Math.sin(omega * time)
            : NaN;
        yield {
            stepNumber: step,
            entities: makeBars(history, history.length - 1, false),
            edges: [],
            description: `Step ${iteration + 1} at t = ${time.toFixed(3)}: acceleration ${acceleration.toFixed(4)}, displacement ${displacement.toFixed(6)}.`,
            codeLineNumber: iteration === 0 ? 2 : 5,
            layout: "array",
            meta: {
                time,
                displacement,
                velocity,
                acceleration,
                analytic: Number.isFinite(analytic) ? analytic : 0,
                exactAvailable: damping === 0,
                energy: energy(),
                beta,
                gamma,
                steps,
            },
        };
        step += 1;
    }

    const finalTime = steps * dt;
    const finalAnalytic = damping === 0
        ? (task.displacement ?? 1) * Math.cos(omega * finalTime) + ((task.velocity ?? 0) / (omega || 1)) * Math.sin(omega * finalTime)
        : 0;
    yield {
        stepNumber: step,
        entities: makeBars(history, history.length - 1, true),
        edges: [],
        description: `After ${steps} steps the displacement is ${displacement.toFixed(6)} at t = ${finalTime.toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            time: finalTime,
            displacement,
            velocity,
            acceleration,
            analytic: finalAnalytic,
            exactAvailable: damping === 0,
            energy: energy(),
            beta,
            gamma,
            steps,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A second-order equation of motion can be integrated by assuming how acceleration varies across one time step. Newmark-beta approximates the new displacement and velocity with two weighting parameters, substitutes them into the equation of motion at the new time, and solves for the new acceleration. The average acceleration choice is a trapezoidal rule that stays stable even for large steps.",
        invariants: [
            "The displacement and velocity updates use the same new acceleration value.",
            "The equation of motion is satisfied exactly at every new time.",
            "With beta one quarter, gamma one half, and no damping, the scheme is equivalent to the trapezoidal rule and conserves a discrete energy.",
        ],
        correctness:
            "Substituting the Newmark update formulas into m*u'' + c*u' + k*u = 0 at the new time yields one linear equation for the unknown acceleration, and its coefficient is positive for the average acceleration parameters, so the step is well defined. The local truncation error is second order in dt. For an undamped linear oscillator the composite scheme is symplectic, which is why the numerical displacement tracks the analytic cosine closely over many steps.",
        complexityRationale:
            "A single degree of freedom needs a constant number of arithmetic operations per step, so the run is O(steps) time. Storing the displacement history for the visualization uses O(steps) space.",
        uses: [
            "Structural dynamics and earthquake engineering simulations",
            "Finite-element transient analysis in mechanical design",
            "Computer animation of springs and flexible bodies",
        ],
        references: [
            "Newmark, A Method of Computation for Structural Dynamics, 1959",
            "Hughes, The Finite Element Method, chapter on time integration",
        ],
        workedExample:
            "Take m = 1, k = 4, c = 0, u0 = 1, v0 = 0 and dt = 0.05. The natural frequency is 2, so the exact answer is cos(2t). After 40 steps the Newmark displacement at t = 2 is within a few thousandths of cos(4), while the discrete energy stays nearly constant.",
    },
    id: "newmark-beta",
    name: "Newmark-Beta Integration",
    category: "numerical-optimization",
    complexity: { time: "O(steps)", space: "O(steps)" },
    defaultInput: {
        mass: 1,
        stiffness: 4,
        damping: 0,
        displacement: 1,
        velocity: 0,
        dt: 0.05,
        steps: 40,
        beta: 0.25,
        gamma: 0.5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "compute the initial acceleration from the equation of motion",
        "for each time step form displacement and velocity predictors",
        "solve the equation of motion at the new time for acceleration",
        "correct the displacement using the new acceleration",
        "correct the velocity using the new acceleration",
        "record the state and advance time by dt",
        "done: report the final displacement and energy",
    ],
};

export default module;
