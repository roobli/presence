---
title: Apple product design as physics — springs, squircles, and hinge torque
lang: en
# omit alt until zh exists
description: "Rubber-band bounce, continuous corners, and one-handed MacBook open are not taste. They are damping ratios, G2 curvature, and rigid-body torque inequalities you can model."
date: 2026-09-11
tags:
  - design
  - hci
  - industrial-design
  - motion
---

Pull a scroll view past its end and watch it overshoot, then settle. Trace an iPhone icon corner with your eye and notice there is no hard kink where line meets arc. Lift a MacBook lid with one hand and feel the base stay planted. Those moments feel like taste. They are closer to calibrated physics: a spring-mass-damper with a chosen damping ratio, a curvature-continuous corner instead of a G1 fillet, and a hinge torque kept inside a base restoring moment.

This essay unpacks two pillars that show up again and again in Apple's hardware and software: **natural aesthetics as physical calibration**, and **ecosystem order as cognitive restraint**. The goal is not mythology. It is a working map for industrial designers, HCI engineers, and anyone who wants system-level motion and geometry rather than timeline easings and `border-radius`.


## Fluid interfaces: stop timing animations, start modeling behavior

Most UI animation still begins with a duration and a curve. Linear, ease-in-out, or a cubic Bézier on a fixed timeline. Those curves invent acceleration breakpoints that matter and objects do not. They can look polished and still feel mechanical.

Apple's Fluid Interfaces framing (and the system APIs that grew with it) pushes the other way. Treat motion as **behavior**: what would a physical object do if it had mass, a spring pulling toward a target, and friction draining energy? Duration becomes an emergent property of the ODE, not a slider you set first.

### Spring-mass-damper as the shared engine

Under the hood, much of that behavior collapses to the classic second-order linear spring-mass-damper:

$$m \frac{d^2x}{dt^2} + c \frac{dx}{dt} + kx = 0$$

Where:

- $m$ (mass) sets inertia. Larger mass means slower starts and slower stops for the same forces.
- $c$ (damping) is energy loss: friction, viscous drag, whatever removes kinetic energy from the system.
- $k$ (stiffness) sets how strongly the spring pulls toward equilibrium. Higher $k$ means snappier response.
- $x$ is displacement from the target (the animation's rest position).

System frameworks such as `CASpringAnimation` and `UISpringTimingParameters` are built around this family of models (with API-specific parameterizations). The designer-facing control knob is often the dimensionless **damping ratio**:

$$\zeta = \frac{c}{2\sqrt{km}}$$

<!-- interactive:spring-zeta -->

| Damping ratio | Physical regime | Visual behavior | Typical HCI use |
| --- | --- | --- | --- |
| $\zeta < 1$ | Underdamped | Overshoot and oscillation before settling (bounce) | Rubber-band overscroll, playful lock-screen gesture hints |
| $\zeta = 1$ | Critically damped | Fastest approach to rest with no oscillation | Navigation transitions, app open/close, system sheets |
| $\zeta > 1$ | Overdamped | Heavy, sluggish crawl toward the target | Avoid for high-frequency UI; reads as lag |

In a true physical spring, rest is asymptotic. Production code therefore declares "done" with thresholds: commonly cited engineering defaults are `restDelta` around $0.01$ px of remaining displacement and `restSpeed` around $0.01$ px/s of remaining velocity, then snap the value to the exact target. Thinking in duration fights that model. Thinking in $\zeta$, $k$, and rest thresholds matches it.

### Three traits that make motion feel fluid under the finger

Physical curves are necessary but not sufficient. Fluid touch interaction also depends on how input energy enters and leaves the simulation.

1. **Hysteresis, then 1:1 tracking.** On contact, the interface should respond immediately. To separate tremor from intentional drag, systems often use a small hysteresis band (on the order of ~10 points in common engineering descriptions of iOS gesture plumbing). Once the finger clears that band, tracking should be one-to-one, and the grab point should stay glued to the original touch offset rather than recentering the view under the finger.
2. **Instant interruptibility.** Any nonlinear animation must be killable mid-flight. If an app is animating back to the home screen and the user touches it again, the exit animation should stop and hand control to the drag without a frame of teleport or pause. Interruptibility is a first-class requirement, not a nice-to-have.
3. **Velocity transfer and projection.** On flick release, do not treat the release coordinate as the whole story. Capture release velocity $v_0$ (in px/s), project momentum, and blend into a damped settle. Picture-in-picture repositioning after a flick is a clear example of this pattern.

Together: eliminate dead zones after intent is clear, never trap the user inside an uninterruptible tween, and conserve the kinetic energy the finger already put in.

## Geometry that does not fight the eye: G-continuity and squircles

Hardware bezels and software icon masks are praised for "refinement." A large part of that refinement is removing the optical kink of a classical rounded rectangle.

### Continuity grades G0–G3

In CAD and differential geometry, how two curve pieces meet at a join decides how smooth the join looks:

```
G0 (positional continuity):
  Endpoints meet. Tangents need not. Sharp corner possible.

G1 (tangent continuity):
  Shared tangent at the join (classic CSS border-radius:
  straight segment spliced to a circular arc).
  Curvature:
    straight ────  (κ = 0)
    join      |    ← jump: κ leaps from 0 to 1/r
    arc     ⌒⌒⌒⌒  (κ = 1/r)

G2 (curvature continuity):
  Shared tangent and matching curvature at the join.
  Curvature:
    straight ────  (κ = 0)
    blend     ＼   (κ rises smoothly from 0 toward κ_max)
    peak      ⌒⌒   (κ_max)
```

G3 adds continuity of the derivative of curvature. For UI icons and many industrial fillets, G2 is the threshold that removes the most obvious optical breakpoint.

<!-- interactive:squircle-compare -->

On a G1 rounded rect, curvature jumps discontinuously at the tangent points. The visual system registers a faint "hard fold" or optical noise. Pack a home-screen grid with dozens of those joins and you invite repeated micro-corrections as the gaze travels the outlines. The note's stronger claim (that this reliably drives measurable micro-saccade load and cortical fatigue) is a **plausible perceptual engineering story**, not a settled clinical finding. Treat it as motivation for G2, not as a published dosage effect.

A G2 continuous corner (the family often called a **squircle** in product talk) replaces the jump with a gradual curvature ramp: $\kappa$ rises from $0$, peaks, then falls back. Gaze can slide along the silhouette without hitting a geometric discontinuity.

### Lamé squircles and a three-segment cubic Bézier fit

Icon masks from iOS 7 onward (and related continuous corner APIs) sit in the Lamé / superellipse family:

$$\left|\frac{x}{a}\right|^n + \left|\frac{y}{b}\right|^n = 1$$

With $a = b = r$ and $n$ around $4$–$5$, you get a shape between square and circle with a soft, continuous feel. Exact superellipse evaluation is awkward for GPU-accelerated path rasterizers and CNC toolpaths, so engineering practice approximates with **cubic Bézier** segments. On Apple platforms, continuous corners surface in APIs such as `CALayerCornerCurve.continuous` and related path helpers.

Fitting one G2 corner of characteristic radius $r$ typically means **three** cubic segments per corner, not a single circular arc. For a normalized corner with $r = 1$ (upper-right, starting from the top axis), one published control-point layout used in the source note is:

| Segment | Role | P0 | P1 | P2 | P3 |
| --- | --- | --- | --- | --- | --- |
| 1 | Entry: curvature climbs from 0 | $[0.000,\ 0.000]$ | $[0.300,\ 0.000]$ | $[0.473,\ 0.000]$ | $[0.619,\ 0.039]$ |
| 2 | Apex: peak curvature, turn | $[0.619,\ 0.039]$ | $[0.804,\ 0.088]$ | $[0.912,\ 0.196]$ | $[0.961,\ 0.381]$ |
| 3 | Exit: curvature falls to 0 | $[0.961,\ 0.381]$ | $[1.000,\ 0.527]$ | $[1.000,\ 0.700]$ | $[1.000,\ 1.000]$ |

Twelve control points (counting shared anchors once per join) give a reproducible G2-ish corner you can drop into a 2D engine or a CNC planner. Treat the table as a concrete fitting recipe from the engineering literature around continuous corners, not as Apple's only internal path.

### True Tone, briefly: matching white point to the room

True Tone leans on **color constancy**: the visual system adapts to the illuminant's chromaticity. A display locked at a cool white (often discussed around $6500\text{K}$ D65-class white) in a warm room can look harshly blue after your eyes have adapted to the room. Multi-channel ambient sensors estimate scene illuminance and chromaticity; the display pipeline shifts white point so the panel feels closer to a reflective surface than to a glowing brick. That is the sensory claim. Keep Night Shift and accessibility contrast as separate knobs; True Tone is specifically about ambient-matched white point.

## One-handed open: hinge torque inside a rigid-body budget

A MacBook that opens cleanly with one hand is not magic. It is torque balance under gravity, friction, and base mass distribution.

<!-- interactive:hinge-diagram -->

```
                 [lid]  mass M_lid, CG at CG_lid
                  /
                 /  opening angle θ (0 = fully closed)
                /
               o  hinge torque τ_hinge
              / \
  ===========[===]===========  desk
  [base]  mass M_base, CG at CG_base
```

### Torque equations

Let $d_{CG\_lid}$ be the distance from hinge axis to the lid center of mass (for a roughly uniform lid, on the order of half the lid length $L_{lid}$). With $\theta = 0$ fully closed, the gravity torque on the lid is commonly modeled as:

$$\tau_{gravity}(\theta) = M_{lid} \cdot g \cdot d_{CG\_lid} \cdot \cos(\theta)$$

(Exact trig form depends on how you measure $\theta$ and CG location; the important structure is a gravity term that varies with angle.)

Hinge damping torque $\tau_{hinge}$ comes from friction packs (spring washers and friction plates under controlled preload). A vertical lift force $F_{lift}$ at the front of the lid produces:

$$\tau_{lift} = F_{lift} \cdot L_{lid} \cdot \cos(\theta)$$

(again, geometry-dependent; the design inequalities matter more than any one trig convention.)

Two conditions must hold through the open:

1. **Open condition (user can lift):** $\tau_{lift} \ge \tau_{hinge} + \tau_{gravity}(\theta)$.
2. **Base stays down:** if $d_{CG\_base}$ is the horizontal lever arm from hinge to base CG, the restoring moment is $\tau_{base\_restore} = M_{base} \cdot g \cdot d_{CG\_base}$. For the chassis not to lift:

$$\tau_{hinge} + \tau_{gravity}(\theta) < M_{base} \cdot g \cdot d_{CG\_base}$$

Violate the second inequality and the whole notebook pivots up with the lid. One-handed open fails.

### Structural choices that protect the inequality

- **Keep the lid light.** A touch digitizer (cover glass, ITO stack) raises $M_{lid}$, which raises $\tau_{gravity}$ and forces a stronger $\tau_{hinge}$ to stop lid wobble. That combination can punch through $\tau_{base\_restore}$. Refusing a touchscreen on MacBook-class lids is, among other reasons, a mass-budget decision.
- **Bias base mass forward.** Dense battery packs stacked away from the hinge (under the palm-rest / trackpad region) lengthen $d_{CG\_base}$ and raise restoring moment. Lighter logic board and I/O sit nearer the hinge.
- **Torsion-bar assist near closed.** Pure friction hinges often show static friction much higher than kinetic friction (breakaway stick). Public patent literature commonly associated with Apple notebook hinges (including work attributed to Scott Krahn and collaborators) describes torsion-bar assist: a preloaded bar stores energy when closed, helps through the first ~$0^\circ$–$15^\circ$, then hands control back to the friction pack past roughly ~$30^\circ$ so the lid holds any angle. Treat inventor names and exact angle bands as **reported patent / teardown narrative**, not as lab measurements you must copy.

### Magnets and lid-angle sensing (engineering model)

Rare-earth magnets near the front edge provide a closing bias and fight long-term hinge looseness. Field shaping is often described so peak pull is concentrated in the first ~$1\text{mm}$ of separation, after which lift force drops quickly into the friction-dominated regime. Exact "anti-double-well" language in internal notes is a model of that decay, not a universal physics law.

A lid-angle sensor near the hinge feeds firmware:

- **Hard mute / privacy cut:** below a small closed threshold (commonly cited around $\theta < 1.5^\circ$), microphone lines can be hardware-gated. Treat the exact angle as a **commonly cited engineering figure**, not a guarantee across every generation.
- **Asymmetric wake hysteresis:** wake on open at a higher threshold than sleep on close (figures often quoted near $\ge 5.0^\circ$ wake and $\le 2.0^\circ$ sleep) avoids chatter from micro-vibration. Again: reported control logic, verify per product.

Footpads matter too. Static friction must beat the horizontal component of lift:

$$\mu_s \cdot M_{base} \cdot g > F_{lift\_horizontal}$$

Microcellular polyurethane pads are a common material choice for contact area and grip.

## Cognitive load and Dieter Rams as product policy

<!-- interactive:none -->

Aggressive platform consistency and slow, selective feature adoption map cleanly onto John Sweller's **cognitive load theory** (1988). Working memory is narrow (Miller's $7 \pm 2$ chunks as a classical rule of thumb). UI chaos burns that budget before the user reaches the task.

Total load is often decomposed as:

$$\text{working memory load} = \text{intrinsic} + \text{extraneous} + \text{germane}$$

Apple's Human Interface Guidelines and shared system gestures attack each term:

1. **Extraneous load (reduce):** standardize buttons, navigation, edge-swipe back, alerts. Third-party apps that follow HIG patterns do not force a fresh hunt for "Back" and "Confirm" on every install.
2. **Germane load (accelerate schema building):** reuse metaphors across iPhone, iPad, Mac, and spatial products (depth via materials, springs as boundary physics) so prior motor and visual learning transfers.
3. **Intrinsic load (protect):** progressive disclosure. Hide rare power features until context demands them so the default path stays within working-memory limits.

### Rams' ten principles, mapped without mystique

Jony Ive's industrial language and much of Apple's UI rhetoric sit downstream of Dieter Rams' "less, but better." A compact mapping:

| Rams principle | How it shows up in Apple-like product work |
| --- | --- |
| Innovative | Innovate inside "it should already work this way," not feature theater (e.g. retiring an immature Touch Bar in favor of physical function keys). |
| Useful | Utility includes aesthetic and emotional trust, not only throughput. Physical motion that feels warm is part of usefulness. |
| Aesthetic | Avoid barren fake-minimalism. Restraint still leaves room for color temperature, micro-damping, and finish. |
| Understandable | Form follows function so closely that manuals are optional: pinch to scale, rubber-band at edges. |
| Unobtrusive | UI deference: chrome yields to content. |
| Honest | Do not costume latency as delight. Haptics can report real system state instead of decorating it. |
| Long-lasting | Prefer stable perceptual principles (Gestalt, spatial memory) over fashion cycles of flat vs skeuomorphic skin. |
| Thorough | Detail as care: Force Touch / trackpad click feel, chamfer tolerances, continuous corners. |
| Environmentally friendly | Recycled aluminum narratives matter, but so does durable hardware that resists forced churn. |
| As little design as possible | Minimalism as subtraction of noise until the essential interaction remains. |

## Practice guide: checklists, not toy demos

Building this quality is a research and calibration pipeline, not a Figma skin.

### 1. Motion engineering checklist

- [ ] Replace fixed-duration easings for interactive motion with spring (or equivalent second-order) solvers.
- [ ] Prefer $\zeta \approx 1$ for navigation and sheets; reserve $\zeta < 1$ for intentional bounce affordances.
- [ ] Implement interruptibility: new touch retargets or cancels the active spring without teleport.
- [ ] On release, seed the solver with measured $v_0$; do not zero velocity unless the gesture truly stopped.
- [ ] Define `restDelta` / `restSpeed` (or equivalent) and snap to target when both pass.
- [ ] Align the integration loop to display refresh (including ProMotion-class variable refresh where relevant).

Minimal critically damped sketch (Swift-shaped pseudocode). Note: the `start` callback must be retained and invoked; the incomplete sample in many notes forgets that.

```swift
final class CriticallyDampedSpring {
    private var displayLink: CADisplayLink?
    private var x: CGFloat
    private var v: CGFloat = 0
    private var target: CGFloat
    private var onUpdate: ((CGFloat) -> Void)?

    // ζ ≈ 1: c = 2 * sqrt(k * m)
    private let mass: CGFloat = 1.0
    private let stiffness: CGFloat = 320.0
    private var damping: CGFloat { 2 * sqrt(stiffness * mass) }

    init(from: CGFloat, to: CGFloat) {
        x = from
        target = to
    }

    func start(onUpdate: @escaping (CGFloat) -> Void) {
        self.onUpdate = onUpdate
        let link = CADisplayLink(target: self, selector: #selector(tick))
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    func retarget(to newTarget: CGFloat) {
        target = newTarget  // keep v: interruptibility
    }

    @objc private func tick(_ link: CADisplayLink) {
        let dt = CGFloat(link.duration)
        guard dt > 0 else { return }

        let a = (-stiffness * (x - target) - damping * v) / mass
        v += a * dt
        x += v * dt

        if abs(x - target) < 0.01, abs(v) < 0.01 {
            x = target
            v = 0
            link.invalidate()
            displayLink = nil
        }
        onUpdate?(x)
    }
}
```

Semi-implicit Euler is fine for interactive UI at display rates if stiffness stays moderate. For stiffer springs, prefer a more stable integrator.

### 2. Hinge / lid calibration checklist

- [ ] Measure $M_{base}$, $d_{CG\_base}$, and compute $\tau_{base\_restore}$.
- [ ] Choose $\tau_{hinge}(\theta)$ so open feels light **and** $\tau_{hinge} + \tau_{gravity}(\theta) < \tau_{base\_restore}$ at every $\theta$.
- [ ] Split regimes: assist near closed (breakaway), constant friction in the working range (~$30^\circ$–$135^\circ$).
- [ ] Verify footpad $\mu_s$ against horizontal lift components on target desk materials.
- [ ] Validate magnet pull curve: strong in the first millimeter, then out of the way.
- [ ] If shipping a lid-angle sensor, define asymmetric wake/sleep thresholds and a hard privacy cut when closed.

### 3. Curvature QC checklist

- [ ] Prefer continuous-corner paths over circular `border-radius` for dense iconography and primary product silhouettes.
- [ ] In CAD, run **zebra striping**: broken stripes at the fillet join ⇒ still G1; smooth parabolic flow ⇒ candidate G2/G3.
- [ ] Inspect **curvature combs**: a sawtooth jump at the join predicts specular highlight kinks after anodize or polish.
- [ ] For 2D UI, compare G1 vs continuous corner at final pixel size on retina-class densities; the difference is most visible in grids.

### 4. Cognitive / perceptual eval checklist

- [ ] A/B a HIG-aligned prototype against a nonstandard control layout on the same task.
- [ ] If you have eye tracking ($\ge 250\text{Hz}$ is a common lab floor for micro-saccade work), log fixation-path entropy and edge micro-saccades as **exploratory** metrics. Do not treat a round "30% fewer micro-saccades" claim as a universal pass/fail gate unless you replicate it.
- [ ] Score extraneous load with task-level measures (time to first correct action, error rate on Back/Confirm) before claiming cognitive wins.

## Closing

Rubber-band bounce is underdamping you chose on purpose. The quiet icon grid is curvature continuity. The planted MacBook base is an inequality on torque. Cognitive calm is load you refused to invent. Apple's reputation for "taste" is, in these layers, a reputation for treating sensory outcomes as the last mile of models you can write down, simulate, and fail in a lab.

If you only take one practice shift: stop asking "what duration feels right?" Ask "what $\zeta$, what continuity class, and what torque budget make the wrong durations impossible?"
