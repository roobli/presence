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

Pull a scroll view past its end and watch it overshoot, then settle. Trace an iPhone icon corner with your eye and notice there is no hard kink where line meets arc. Lift a MacBook lid with one hand and feel the base stay planted. Those moments get filed under "taste." They are closer to calibrated physics: a spring-mass-damper with a chosen damping ratio, a curvature-continuous corner instead of a G1 fillet, and a hinge torque kept inside a base restoring moment.

This essay argues two linked claims. First, Apple's "natural" aesthetics are often physical calibration made invisible. Second, the calm of the ecosystem is cognitive restraint with a product policy attached. The point is not mythology. It is a working map for people who ship motion, geometry, and hardware, and who keep mistaking timeline easings and `border-radius` for the whole job.

The through-line is the same in every section: what people feel, what model explains it, why that tradeoff won inside Apple's constraints, where copycats usually break, and what the cost of getting it right actually is.


## Fluid interfaces: stop timing animations, start modeling behavior

Most UI animation still begins with a duration and a curve. Linear, ease-in-out, or a cubic Bézier parked on a fixed timeline. Those curves invent acceleration breakpoints that matter to the timeline and not to the object. They can look polished in a screen recording and still feel mechanical under a finger.

What people feel, when motion is wrong, is a tiny lie about mass. The card eases in, then suddenly becomes "done." The sheet finishes its tween while your thumb is still moving. The rubber band at the scroll edge either never arrives or arrives like a cartoon. The complaint sounds aesthetic. The failure is behavioral: the interface refused to act like something with inertia.

Apple's public framing for this problem is older than most of the copycat spring libraries that followed it. The 2018 WWDC session *Designing Fluid Interfaces* (Chan Karunamuni and team) pushes designers away from "pick a duration" and toward continuous, interruptible response: motion as what a physical object would do if it had mass, a spring pulling toward a target, and friction draining energy. Duration becomes an emergent property of the ODE, not a slider you set first. System APIs grew up around that family of models. `CASpringAnimation` and `UISpringTimingParameters` are the documented surface. The designer-facing control knob is often the dimensionless damping ratio.

### Spring-mass-damper as the shared engine

Under the hood, much of that behavior collapses to the classic second-order linear spring-mass-damper:

$$m \frac{d^2x}{dt^2} + c \frac{dx}{dt} + kx = 0$$

Mass $m$ sets inertia. Damping $c$ is energy loss. Stiffness $k$ sets how hard the spring pulls toward equilibrium. Displacement $x$ is distance from the animation's rest position. None of this is mystical. It is the same second-order model control engineers have used for decades. Apple's contribution was to treat it as a first-class interaction primitive rather than a special effect.

The dimensionless knob is:

$$\zeta = \frac{c}{2\sqrt{km}}$$

<!-- interactive:spring-zeta -->

| Damping ratio | Physical regime | Visual behavior | Typical HCI use |
| --- | --- | --- | --- |
| $\zeta < 1$ | Underdamped | Overshoot and oscillation before settling (bounce) | Rubber-band overscroll, playful lock-screen gesture hints |
| $\zeta = 1$ | Critically damped | Fastest approach to rest with no oscillation | Navigation transitions, app open/close, system sheets |
| $\zeta > 1$ | Overdamped | Heavy, sluggish crawl toward the target | Avoid for high-frequency UI; reads as lag |

Why critically damped for most navigation? Because $\zeta = 1$ is the fastest settle that still refuses to oscillate. Underdamping is a deliberate affordance signal: the edge of a scroll view *should* tell you there is a boundary by bouncing. Overdamping is almost never what you want in high-frequency UI. It reads as lag even when the math is "correct."

In a true physical spring, rest is asymptotic. Production code therefore declares "done" with thresholds, often something like remaining displacement and remaining velocity both below a small epsilon, then snaps to the exact target. Thinking in duration fights that model. Thinking in $\zeta$, $k$, and rest thresholds matches it.

### What copycats get wrong about springs

Industry chatter around spring animation usually converges on the same three failure modes, and they are all tradeoff mistakes rather than "forgot the formula" mistakes.

First, teams ship underdamped bounce everywhere because bounce photographs well in marketing GIFs. Critical damping looks boring in a recording. It feels correct in the hand. If every sheet, every button press, and every page turn oscillates, the product starts to feel like a toy that cannot sit still.

Second, they keep fixed-duration easings for the "serious" transitions and reserve springs for decoration. That splits the product into two physics regimes. The user's motor system notices. Interrupt a tween mid-flight and you get a teleport or a pause. Interrupt a spring and you retarget: keep velocity, change the equilibrium, let the same ODE absorb the new intent.

Third, they zero velocity on release. A flick is kinetic energy the finger already paid for. Capture release velocity $v_0$, project momentum, and blend into a damped settle. Picture-in-picture repositioning after a flick is the clean public example of this pattern on Apple platforms. Dropping $v_0$ to zero is how you get animations that look smooth and feel dead.

### Three traits that make motion feel fluid under the finger

Physical curves are necessary but not sufficient. Fluid touch interaction also depends on how input energy enters and leaves the simulation.

**Hysteresis, then 1:1 tracking.** On contact, the interface should respond immediately. To separate tremor from intentional drag, systems often use a small hysteresis band. Common engineering descriptions of iOS gesture plumbing put that band on the order of roughly ten points. Treat the exact figure as reported plumbing, not scripture. Once the finger clears the band, tracking should be one-to-one, and the grab point should stay glued to the original touch offset rather than recentering the view under the finger.

**Instant interruptibility.** Any nonlinear animation must be killable mid-flight. If an app is animating back to the home screen and the user touches it again, the exit animation should stop and hand control to the drag without a frame of teleport or pause. Interruptibility is a first-class requirement. It is also why spring solvers beat timeline tweens for interactive UI: retargeting a spring is a parameter change, not a reboot of a storyboard.

**Velocity transfer and projection.** On flick release, do not treat the release coordinate as the whole story. Seed the solver with measured $v_0$ and let damping do the rest.

Together: eliminate dead zones after intent is clear, never trap the user inside an uninterruptible tween, and conserve the kinetic energy the finger already put in.

The cost of this model is real. You give up the comfort of "animation finishes in 280 ms." Designers who live in duration-based tools have to learn a new vocabulary. Engineers have to care about integrator stability when stiffness climbs. QA has to test interruption paths, not only happy-path playthroughs. That cost is why so many products stop at "we added a spring library" and never reach fluid. The library was never the hard part. The hard part is making every interactive surface speak the same physics.

A critically damped interruptible spring is a short idea in code: integrate $a = (-k(x - target) - c v) / m$ each display tick, keep $v$ when you retarget, and snap when both position and velocity fall under rest thresholds. Semi-implicit Euler is usually fine at display rates if stiffness stays moderate. Stiffer springs need a more stable integrator. The implementation is not the essay. The argument is: once interruptibility and velocity transfer are non-negotiable, the spring ODE stops being an effect and becomes the interaction substrate.


## Geometry that does not fight the eye: G-continuity and squircles

Hardware bezels and software icon masks are praised for "refinement." A large part of that refinement is removing the optical kink of a classical rounded rectangle. People feel it as softness, quiet, or expensive calm. The model underneath is continuity of curvature.

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

On a G1 rounded rect, curvature jumps discontinuously at the tangent points. The visual system registers a faint hard fold or optical noise. Pack a home-screen grid with dozens of those joins and you invite repeated micro-corrections as the gaze travels the outlines. Claims that this reliably drives measurable micro-saccade load and cortical fatigue are a **plausible perceptual engineering story**, not a settled clinical finding. Treat them as motivation for G2, not as a published dosage effect you can put on a dashboard.

A G2 continuous corner (the family often called a **squircle** in product talk) replaces the jump with a gradual curvature ramp: $\kappa$ rises from $0$, peaks, then falls back. Gaze can slide along the silhouette without hitting a geometric discontinuity.

Apple's public software surface for this is explicit. `CALayerCornerCurve.continuous` and the Human Interface Guidelines language around continuous corners tell developers that circular `border-radius` is not the product default for primary silhouettes. That is a rare case of a differential-geometry choice leaking into a shipping API name. The tradeoff is clear: slightly harder path construction and tooling, in exchange for grids and hardware outlines that stop flickering with optical kinks.

### Lamé squircles and a three-segment cubic Bézier fit

Icon masks from iOS 7 onward (and related continuous corner APIs) sit in the Lamé / superellipse family:

$$\left|\frac{x}{a}\right|^n + \left|\frac{y}{b}\right|^n = 1$$

With $a = b = r$ and $n$ around $4$–$5$, you get a shape between square and circle with a soft, continuous feel. Exact superellipse evaluation is awkward for GPU-accelerated path rasterizers and CNC toolpaths, so engineering practice approximates with **cubic Bézier** segments.

Fitting one G2 corner of characteristic radius $r$ typically means **three** cubic segments per corner, not a single circular arc. For a normalized corner with $r = 1$ (upper-right, starting from the top axis), one published control-point layout used in continuous-corner engineering notes is:

| Segment | Role | P0 | P1 | P2 | P3 |
| --- | --- | --- | --- | --- | --- |
| 1 | Entry: curvature climbs from 0 | $[0.000,\ 0.000]$ | $[0.300,\ 0.000]$ | $[0.473,\ 0.000]$ | $[0.619,\ 0.039]$ |
| 2 | Apex: peak curvature, turn | $[0.619,\ 0.039]$ | $[0.804,\ 0.088]$ | $[0.912,\ 0.196]$ | $[0.961,\ 0.381]$ |
| 3 | Exit: curvature falls to 0 | $[0.961,\ 0.381]$ | $[1.000,\ 0.527]$ | $[1.000,\ 0.700]$ | $[1.000,\ 1.000]$ |

Twelve control points (counting shared anchors once per join) give a reproducible G2-ish corner you can drop into a 2D engine or a CNC planner. Treat the table as a concrete fitting recipe from the engineering literature around continuous corners, not as Apple's only internal path.

### What copycats get wrong about corners

The failure mode is almost always "we rounded it." Teams take `border-radius: 22px`, ship a marketing site full of soft rectangles, and wonder why the product still feels cheap next to an iPhone icon grid. Soft is not the same as continuous. A large G1 radius is still a curvature jump. On a single card the jump can hide. In a dense grid, or on a specular metal bevel after anodize, it does not.

The other failure mode is over-squircle. Not every rectangle in an interface deserves a continuous corner. Secondary chrome, hairline dividers, and tiny controls can look mushy if every join is G2. Apple's restraint is selective: primary silhouettes and hardware outlines get the expensive continuity. Everything else stays boring on purpose.

### True Tone, briefly: matching white point to the room

True Tone leans on **color constancy**: the visual system adapts to the illuminant's chromaticity. A display locked at a cool white (often discussed around $6500\text{K}$ D65-class white) in a warm room can look harshly blue after your eyes have adapted to the room. Multi-channel ambient sensors estimate scene illuminance and chromaticity. The display pipeline shifts white point so the panel feels closer to a reflective surface than to a glowing brick. That is the sensory claim. Keep Night Shift and accessibility contrast as separate knobs. True Tone is specifically about ambient-matched white point. The cost is another sensor, another calibration pipeline, and another place where "accurate" and "comfortable" disagree. Apple chose comfort that tracks the room. Photographers who need locked white point turn it off. That is the tradeoff working as designed.


## One-handed open: hinge torque inside a rigid-body budget

A MacBook that opens cleanly with one hand is not magic. It is torque balance under gravity, friction, and base mass distribution. What people feel is trust: the machine stays put while the lid rises. What they are evaluating, without knowing the vocabulary, is whether hinge torque plus lid gravity stayed inside the base's restoring moment.

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

Exact trig form depends on how you measure $\theta$ and CG location. The important structure is a gravity term that varies with angle.

Hinge damping torque $\tau_{hinge}$ comes from friction packs (spring washers and friction plates under controlled preload). A vertical lift force $F_{lift}$ at the front of the lid produces:

$$\tau_{lift} = F_{lift} \cdot L_{lid} \cdot \cos(\theta)$$

again geometry-dependent. The design inequalities matter more than any one trig convention.

Two conditions must hold through the open:

1. **Open condition (user can lift):** $\tau_{lift} \ge \tau_{hinge} + \tau_{gravity}(\theta)$.
2. **Base stays down:** if $d_{CG\_base}$ is the horizontal lever arm from hinge to base CG, the restoring moment is $\tau_{base\_restore} = M_{base} \cdot g \cdot d_{CG\_base}$. For the chassis not to lift:

$$\tau_{hinge} + \tau_{gravity}(\theta) < M_{base} \cdot g \cdot d_{CG\_base}$$

Violate the second inequality and the whole notebook pivots up with the lid. One-handed open fails. That single inequality is why "make the hinge stiffer so the lid holds angle" is not a free parameter. Stiffer hinge helps hold. Too stiff, and you steal margin from the base.

### Structural choices that protect the inequality

**Keep the lid light.** A touch digitizer (cover glass, ITO stack) raises $M_{lid}$, which raises $\tau_{gravity}$ and forces a stronger $\tau_{hinge}$ to stop lid wobble. That combination can punch through $\tau_{base\_restore}$. Refusing a touchscreen on MacBook-class lids is, among other reasons, a mass-budget decision. Public discourse loves the software and market explanations. The rigid-body explanation is quieter and still binding.

**Bias base mass forward.** Dense battery packs stacked away from the hinge (under the palm-rest / trackpad region) lengthen $d_{CG\_base}$ and raise restoring moment. Lighter logic board and I/O sit nearer the hinge. The machine looks symmetric. The mass budget is not.

**Torsion-bar assist near closed.** Pure friction hinges often show static friction much higher than kinetic friction (breakaway stick). Public patent literature commonly associated with Apple notebook hinges describes torsion-bar assist: a preloaded bar stores energy when closed, helps through the first part of the open, then hands control back to the friction pack so the lid holds any angle. Treat inventor attributions and exact angle bands as **reported patent / teardown narrative**, not as lab measurements you must copy. The design idea is what matters: split regimes so breakaway and hold are not the same spring.

### Magnets, sensing, and the quiet parts of the feel

Rare-earth magnets near the front edge provide a closing bias and fight long-term hinge looseness. Field shaping is often described so peak pull is concentrated in the first millimeter or so of separation, after which lift force drops quickly into the friction-dominated regime. Exact "anti-double-well" language in internal notes is a model of that decay, not a universal physics law.

A lid-angle sensor near the hinge feeds firmware. Below a small closed threshold, microphone lines can be hardware-gated. Wake-on-open and sleep-on-close typically use asymmetric thresholds so micro-vibration does not chatter the machine awake. Treat specific degree cutoffs as **commonly cited engineering figures**, not guarantees across every generation. Verify per product.

Footpads matter too. Static friction must beat the horizontal component of lift:

$$\mu_s \cdot M_{base} \cdot g > F_{lift\_horizontal}$$

Microcellular polyurethane pads are a common material choice for contact area and grip. Copycats that nail hinge torque and still skate across a desk forgot that the inequality is three-dimensional.

### What copycats get wrong about hinges

They optimize for the demo. Lid holds at any angle in a boardroom video. Base lifts on a real desk with a light chassis. Or they add a touch panel to a notebook lid for competitive parity and discover, late, that the mass budget was the product. Or they copy magnet placement without the pull curve, so the lid either slams or feels dead through the last centimeter.

The cost of getting this right is interdisciplinary. Industrial design, hinge suppliers, battery packaging, and firmware hysteresis all share one inequality. That is harder than shipping a "premium hinge" SKU. It is also why one-handed open reads as taste when it is really systems engineering with a tactile last mile.


## Cognitive load and Dieter Rams as product policy

Aggressive platform consistency and slow, selective feature adoption map cleanly onto John Sweller's **cognitive load theory** (1988). Working memory is narrow. Miller's $7 \pm 2$ chunks remains a classical rule of thumb, not a modern measurement standard, but the qualitative claim holds: UI chaos burns the budget before the user reaches the task.

Total load is often decomposed as:

$$\text{working memory load} = \text{intrinsic} + \text{extraneous} + \text{germane}$$

Apple's Human Interface Guidelines and shared system gestures attack each term.

**Extraneous load** gets cut by standardization. Buttons, navigation, edge-swipe back, alerts. Third-party apps that follow HIG patterns do not force a fresh hunt for Back and Confirm on every install. The cost is less expressive chrome for apps that want to look unique. Apple accepts that cost on purpose.

**Germane load** gets aimed at schema building. Reuse metaphors across iPhone, iPad, Mac, and spatial products (depth via materials, springs as boundary physics) so prior motor and visual learning transfers. The cost is slower surface innovation. A new gesture has to earn its place in a shared grammar, not only in a single app's delight reel.

**Intrinsic load** gets protected by progressive disclosure. Hide rare power features until context demands them so the default path stays inside working-memory limits. The cost is expert frustration. Power users will always want more visible density. Apple's bet is that most sessions are not expert sessions.

This is where "ecosystem" stops being a marketing noun. An ecosystem that shares springs, corners, and navigation grammar is doing cognitive work. An ecosystem that only shares a logo is not.

### Four Rams principles that actually bind

Jony Ive's industrial language and much of Apple's UI rhetoric sit downstream of Dieter Rams' "less, but better." The full ten-principle list is easy to reprint as a brochure. Four of them do real argumentative work here.

**Useful** includes trust, not only throughput. A spring that settles without lying about mass is usefulness. A hinge that keeps the base planted is usefulness. Warmth in the hand is not decoration on top of function. It is part of whether the tool disappears.

**Honest** means do not costume latency as delight. Haptics that fire because something finished are reporting state. Haptics that fire because a marketing deck asked for "premium feedback" are costume. Users may not articulate the difference. They feel it as noise.

**Thorough to the last detail** is where continuous corners and critically damped sheets stop being polish and become policy. Detail as care only works if the same standard reaches firmware hysteresis, footpad compound, and icon mask curvature. Selective thoroughness reads as inconsistency.

**As little design as possible** is subtraction until the essential interaction remains. It is not barren fake-minimalism. Restraint still leaves room for color temperature, micro-damping, and finish. The test is whether removing one more thing would break comprehension or trust. If yes, stop. If no, keep cutting.

The other Rams principles (innovative, aesthetic, understandable, unobtrusive, long-lasting, environmentally friendly) still matter. They matter less as a checklist to score against and more as pressure against feature theater, fashion skins, and forced churn. Long-lasting, in this framing, prefers stable perceptual principles (Gestalt grouping, spatial memory, physical metaphor) over cycles of flat versus skeuomorphic costume.


## What to steal (and what not to)

If you are shipping a product and trying to learn from this stack, steal the models. Do not steal the costume.

Steal the spring as interaction substrate: interruptible, velocity-aware, critically damped by default, underdamped only when bounce is the message. Do not steal decorative bounce on every surface. Do not keep timeline tweens for "important" flows and springs for garnish.

Steal continuous corners for primary silhouettes and dense grids. Do not replace every `border-radius` with a superellipse and call the product Apple-like. Soft is not continuous. Selective continuity is the actual move.

Steal the hinge inequality as a way of thinking about hardware tradeoffs: lid mass, base CG, friction regimes, magnet pull curves, footpad friction. Do not copy a patent figure's angle bands and declare victory. Do not add a touch lid without reopening the mass budget.

Steal cognitive restraint: shared grammar, progressive disclosure, honesty about system state. Do not confuse a sparse UI with a calm one. Empty chrome plus novel gestures is still high extraneous load.

| Steal this | Not this |
| --- | --- |
| $\zeta \approx 1$ as default settle; bounce as signal | Bounce as brand personality on every transition |
| G2 / continuous corners on primary shapes | Large G1 radii sold as "soft UI" |
| Torque budget shared across ID, hinge, battery, firmware | "Premium hinge" as a single SKU claim |
| HIG-level shared grammar to cut extraneous load | Unique chrome that forces relearning each screen |

Failure modes cluster. Motion teams overfit to screen recordings. Visual teams overfit to single-card mockups. Hardware teams overfit to lid-hold demos. Cognitive claims get made without task-level measures (time to first correct action, error rate on Back/Confirm). Eye tracking, if you have it, is exploratory. Do not treat a round "fewer micro-saccades" number as a universal gate unless you replicate it under your own conditions.

The limit of stealing Apple's physics is that Apple also steals time. These calibrations assume long platform tenure, supplier relationships, and the willingness to refuse features that punch through a budget. If your org cannot refuse, you will get the costume. The models above still help you see which refusal you skipped.


## Closing

Taste is what observers call a system after the inequalities are no longer visible.

Rubber-band bounce is underdamping chosen on purpose. The quiet icon grid is curvature continuity. The planted MacBook base is a torque budget that survived battery packaging and a rejected touch lid. Cognitive calm is load someone refused to invent. None of that is a style guide. It is a set of models that make wrong durations, wrong joins, and wrong hinges hard to ship by accident.

The memorable practice shift is small. Stop asking what duration feels right. Ask what $\zeta$, what continuity class, and what torque budget make the wrong durations impossible. Then accept the cost of that question: shared physics across surfaces, selective thoroughness, and the occasional feature you will not ship because the inequality said no.
