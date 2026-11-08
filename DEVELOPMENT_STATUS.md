# DriveX 0.1.0 — development status

## Handling, HUD and environment pass — 2026-11-07

- Reduced peak engine force from 7500 to 3200 and softened throttle application. A horizontal stability assist now applies in proportion to wheel contact during ordinary steering; it is weaker under handbrake, and does not act in the air. Handbrake force was reduced, and combining it with the service brake cannot reduce braking. This is an arcade assist, not validated tire physics; aggressive handbrake use can still produce large slides. The existing speed-sensitive steering curve and Cannon solver remain in place.
- A flat-road simulation before the change measured up to 12.3 m/s lateral speed during six seconds of steering; the new automated test bounds the same scenario below 3 m/s and checks steering release, smooth acceleration, contacts, airborne gravity, handbrake sliding and combined braking. Historic physics tests that assumed a fixed, very fast acceleration were updated for the deliberately changed acceleration, while turn-radius and rollover checks remain. Real-world subjective handling and all conditions are not verified.
- HUD speed uses horizontal movement rather than suspension bounce, with a small stop/start hysteresis and no repeated DOM write for an unchanged value. Controls hints use saved bindings. Adjusted small-screen spacing and contrast; free-roam minimap adds a map boundary and shelter landmark. Three generated English junction signs help distinguish grid routes; the map remains a small flat prototype with decorative non-colliding signs.
- Engine tone mixes softer harmonics and bounded RPM/load/speed targets with slower audio parameter smoothing; the noise loop is longer. Browser audio parameters were observed to remain finite and use smoothing during scripted driving, but audible quality and transitions have not been assessed by a listener. Preview controls, preset messages, import errors and newly generated player names are English; existing saved names remain untouched.
- Latest typecheck, Pages-base production build and **80 tests across 15 files** pass. The production build in software-rendered Chromium showed 0 km/h with no speed DOM changes over a five-second settled idle sample; acceleration and steering moved the car with four contacts at the sampled endpoint. Desktop and 390×720 HUD screenshots: `verification/handling-desktop.png` and `verification/handling-mobile.png`; sampled HUD panels did not overlap at that size. The preview and home text sampled in the browser were English; no console/page/HTTP errors. A scripted 420 m practice lap completed with no collisions, 11,230 wheel-contact observations over 2,894 samples and minimum up Y 0.99965. The lap and browser pass preceded a final change ensuring combined braking never weakens the service brake; that change is covered by the automated suite but has not been separately browser-driven.
- Hardware performance, real Windows/GT 710 compatibility, deployed Pages, subjective audio and user handling assessment are still unverified. The automated tests do not prove the game is realistic or that every steering/drift scenario is controlled.


## Latest visual reconstruction pass — 2026-11-07

**Status: partial, not the requested finished visual reconstruction.** The free-roam map is still a small flat procedural prototype with repeated low-detail buildings; the circuit remains sparse. This pass does not achieve photorealism or a finished Kerala environment. The historical entries below describe earlier milestones and are superseded where they conflict with this section.

- Replaced the generated road noise and flat grass with locally bundled Poly Haven CC0 surface maps (asphalt color/normal and leafy grass); added batched shoulders, verandas, columns, varied house colors and a small shelter with collidable posts. Introduced a textured CC0 palm model, loaded asynchronously and instanced, with the old shapes retained as a failure/loading fallback. Palm placement is visual and palms do not have collision bodies. Houses are still simple box/hip-roof procedural shapes, terrain is still flat, and buildings remain repetitive. Attribution and source details are in `ASSET_PROVENANCE.md`.
- Kept the licensed concept car and physics coupling; its brake-light material now responds to brake/handbrake input. This is emissive visual feedback, not projected headlight illumination. The existing three camera modes now support a saved near/standard/far chase-distance setting. No cockpit, controllable headlights, indicators, weather, day/night, traffic, shops, realistic landscape or new playable modes were added.
- Four real Low/Medium/High/Ultra driving-render presets control antialiasing, pixel-ratio cap and shadow enablement/size; shadow size is capped by the graphics device limit. These are not a guarantee of performance on any machine. Garage and menu preview renderers have separate settings and do not currently follow the driving preset. No streaming/chunk loading or large-world LOD is implemented.
- TypeScript check passed, **74 tests across 13 files passed**, and the Pages-base production build passed. The tests include lap progress, wheel contact, collision and transmission regressions, and preset fallback/scaling. Chromium software rendering served the built `/DriveX/` path and loaded the model, palm and textures with HTTP 200 and no page/console/HTTP errors. `verification/rebuild-{menu,garage,car-closeup,free-roam,bonnet,time-trial}.png` are screenshots from that build. A separate controls test confirmed Ultra and far-camera choices persisted across reload.
- The scripted free-roam test observed boundary collisions, recovery with four contacts, manual shifting, reverse and clutch input. Software-headless Low measured roughly 3.5 FPS in that run; this is **not** a target-GPU benchmark. A scripted practice-oval lap completed the 420 m distance with zero collisions, minimum up-vector Y 0.99937, and 9,143 accumulated wheel contacts across 2,480 samples; no browser errors. It is not a human driving or handling assessment.
- Untested: Windows 11 Chrome/Edge on i3-10100/GT 710, real FPS and memory limits, audio quality, human steering feel, all preset GPU combinations, deployed GitHub Pages, full offline install, and comprehensive accessibility. There is no claim that this pass meets the requested final graphics quality. See **Running locally** below for the run commands.


This is an early **circuit time-trial prototype**, not the complete DriveX requested. It adapts the MIT Racing Games foundation (see `ASSET_PROVENANCE.md`). LibreCorsa was inspected, but its track-coupled solver and asset restrictions made a wholesale import unsuitable for this small first slice; this project uses only cannon-es RaycastVehicle as the authoritative player-vehicle solver. See `DRIVEX_FOUNDATION_COMPARISON.txt` for the source audit.

## Current milestone — 7 November 2026

This section supersedes the historical notes below.

### Shipped

- A 3D garage uses the same concept model as driving, with orbit and front/rear/left/right/elevated views, paint and auto/manual selection saved to the existing local settings, and a button to drive. There is **one vehicle**, not a collection or economy.
- A small **free-roam prototype**: a finite 600 m × 600 m procedural road grid with nine junctions, lane markings and crossings, simple houses with collision, palms, decorative streetlights, a minimap and recovery onto left-side lanes. It is not a realistic or geographically accurate Kerala map. There is no traffic, signals, pedestrians or city-scale streaming.
- A 420 m Practice Oval time-trial circuit; corrected lap progress to subtract reverse movement rather than allowing oscillation to accumulate distance.
- Fixed a critical Cannon integration issue: calling `updateWheelTransform()` for rendering cleared `isInContact`, so the next update could lose contact-sensitive stability/suspension logic. Wheel transform reads now preserve the contact flag; a regression test covers it. Reverse has a dedicated approximate ratio, auto-shifting is inhibited while reversing or disengaged, and drive torque ramps back in after a shift. Added a third, bonnet-height driving view. These are still game-physics approximations, not certified realism.
- Car and track geometry/material disposal on navigation and garage orbit; scene reuse avoids rebuilding the car for paint adjustments. Track surface texture remains shared.

### Actual verification

- Production build served locally at `/DriveX/`. Typecheck passed, production build passed and **73 automated tests** passed across 12 files (including world recovery, wheel contacts, lap anti-oscillation and drivetrain tests). The minimum preset-length test was updated to admit the deliberate 420 m oval.
- On the practice oval, a scripted keyboard driver in software-rendered headless Chromium completed a full lap and showed the results screen. It used an opt-in read-only `?diagnostics=1` telemetry view for steering decisions; this is automated gameplay, not a human handling assessment. In the recorded run, 420 m was completed in 3:36.97 wall time with no collision events, wheel contacts mostly present and minimum up-vector Y approximately 0.9994. Because the software-rendered sandbox was slow and the simulation caps per-frame delta, this is not a real-world lap-time or performance claim.
- Production-browser free-roam test: spawned on a road with four wheel contacts; clutch + reverse held at 0 km/h; reverse drove to the boundary and produced collision events; R recovered onto a road with four contacts; manual shift to second and the bonnet camera were exercised. No page, console or HTTP asset errors were observed in that run. Screenshots: `verification/free-roam.png`, `verification/free-roam-collision.png`, `verification/bonnet.png`, `verification/lap-test.png` and `verification/garage-*.png`.
- Garage paint and transmission values survived a reload and the selected transmission appeared in the game. Front/rear/both sides/elevated views were captured in headless Chromium. The visual result and wheel alignment still require human inspection during real driving.
- One 5-second sample in the software-rendered sandbox at 900×560 on Low was approximately **4.5 FPS**. This is an environment-specific headless software result, **not** a GT 710/Windows/Chrome benchmark or a prediction of hardware performance. No deployed GitHub Pages URL, human gameplay session, audible sound quality, AI traffic/racing, or target-PC compatibility has been verified.

### Still incomplete

Kerala-scale detailed environment and terrain, traffic AI and left-hand rule enforcement, road signals, opponents and race positions, garage collection/economy/upgrades, drag and rally, weather, ambient audio, individual graphics controls, full drivetrain and driving-assist realism, performance optimization and hardware testing. The present village is an early blockout and the garage contains only the one licensed car.

## Historical status (earlier builds)

## Visual and handling update — 6 November 2026

The earlier status below records the first slice; this section supersedes it where different.

### Audit priorities and changes

1. **Preview / startup:** Vite was responding on 5173, but its prior preview attachment had gone stale. It was restarted as a managed preview. Startup now waits for track initialization, avoids a costly unnecessary GLB export, handles storage initialization errors, and prevents a disposed page from starting a second WebGL preview.
2. **Vehicle and scene:** The Kenney truck was replaced in play with an adapted CC BY 4.0 Car Concept by Eric Chadwick / Darmstadt Graphics Group, based on Unity Fan's CC0 work. License-plate and steering-emblem nodes were removed. Wheels are separate meshes driven by Cannon transforms. Glass is simplified to avoid expensive transmission passes. See `ASSET_PROVENANCE.md`; the original truck remains in the repository. The 12 MB model and simple procedural surroundings still need further optimization and art work.
3. **Driving feel:** The audit found full keyboard steering was arbitrarily cutting drive force by 45%, steering while coasting engaged heavy braking, reverse-turning boosted drive to all wheels, and the clutch did not cut reverse drive. Removed those discontinuities, used speed-sensitive steering in reverse, made S brake only and Z reverse, and added a smoothed speed-sensitive chase camera and focus-loss key clearing. These are targeted changes, not proof of realistic handling. Automated physics tests were adjusted where they explicitly required the old reverse boost / speed behavior, and two regressions for steering power and reverse clutch were added. The existing physics solver and collision bodies were retained.
4. **Presentation:** New menu and telemetry HUD, improved edge lines, asphalt texture, muted concrete barriers and instanced palms. This remains a sparse, generated circuit—not a Kerala open world. Settings now expose working separate engine and tire/collision levels; the old engine slider had not been connected to the audio graph.

### Latest verification

- Typecheck and production build passed; 65 tests passed across 11 files. Existing collision tests passed but this is not a human validation of collision feel.
- Headless Chromium, software rendering, served actual production files at `/DriveX/`: no page, console or failed HTTP errors. Scripted driving showed acceleration, steering input, braking to 0 without unwanted reverse, dedicated reverse with R shown, manual toggle/shift, reset, camera toggle and pause/resume. A further steering/collision attempt did **not** observe a collision-flash event; browser collision behavior is not verified by that attempt. Automatic upshift is unit-tested, not proven by a full real drive.
- Settings values and keybinding conflict/persistence were checked across reloads. AudioContext reached `running` and audio volume values persist; actual audible quality, channel balance and audible volume changes were **not** tested. `verification/` holds browser screenshots of menu, gameplay, moving view, second camera and settings; there is no separate garage screen yet.
- No GPU/GT 710 benchmark, realistic handling assessment, full lap, multiplayer/AI race, weather, deployed GitHub Pages URL or offline caching was verified.

### Remaining highest priorities

Connected Kerala-inspired open world, left-side traffic/signals, opponents and race management, proper garage/dealership, additional cars, rally and drag, richer roadside assets, actual weather, environment audio, thorough audio and human playtesting, physically calibrated drivetrain/handling, further rendering and asset optimization. Disabled mode labels are informative, not playable modes. The current rendering is improved but not photorealistic, and the car's suspension alignment and collision envelope require further visual/physical tuning.

## Running locally

Requires Node 22 and pnpm 11.17.0. From the repository root:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev --host 0.0.0.0
```

Open the URL printed by Vite in a desktop browser. Alternatively, build with `pnpm build` and serve `dist` with a static HTTP server. For the GitHub Pages subpath, build with `GITHUB_REPOSITORY=Asif4517-git/DriveX pnpm build`. The included Actions workflow is configured for Pages on main or manual dispatch; Pages must be enabled/configured in the repository. **It has not been deployed or verified on GitHub Pages.**

## Implemented

- Procedural circuit/time-trial foundation, Cannon collision and vehicle physics, one adapted Car Concept vehicle, chase cameras, timer, penalties, minimap, lap result and locally stored records inherited/adapted from upstream. No claim that a complete lap was manually played in this session.
- WASD or arrows to drive; S brakes, Z reverses, Space handbrake, C camera, R reset, Escape pause, M toggle transmission, Q/E shift, left Shift clutch. Controls page remaps these actions, checks conflicts and offers individual/all reset; fixed arrow-key alternatives are reserved. Bindings are stored locally and gameplay ignores input/select/textarea targets. Headlights and indicators are not implemented.
- Simple five-ratio automatic/manual drivetrain: wheel-speed-based RPM, gear-dependent drive force, shift thresholds, clutch disengagement and a rev limiter. It is an approximation, not a validated physical transmission or clutch model.
- Procedural engine sound reflects speed, RPM and throttle; the existing mute button and engine and tire/collision volume controls are available. Environment and UI audio channels are not yet implemented. Audio has not been audibly verified; playback is subject to browser autoplay rules.
- Low/medium/high graphics presets alter pixel ratio, antialiasing and shadows, effective on the next session. No performance target has been measured.
- Home and About pages, creator links, controls, basic local settings, and static Pages build configuration. No backend is required during play; there is no service worker/offline-install guarantee.

## Verification performed

- TypeScript typecheck and production build passed (the deprecated chunk setting has been replaced).
- 65 automated tests passed across 11 files, including three drivetrain unit tests; upstream tests do not establish full interactive play.
- Headless Chromium with software rendering, serving the actual production build at `/DriveX/`: home, About, asset loading and navigation loaded without browser console/page or HTTP errors. A scripted W press raised displayed speed; pause/resume, reset, manual transmission toggle/shift, keybinding conflict detection and persistence worked. Camera toggle was invoked but not visually compared. A screenshot showed the low-poly vehicle and track. No full lap, race, audible output, human usability or real GPU benchmark was verified.
- Portfolio link responded; Instagram returned HTTP 403 to the page-fetch tool, so its destination could not be independently verified. Links and safe new-tab attributes were inspected in the DOM. Mail link uses the requested mailto address.
- No Windows/Chrome/Edge test on the requested i3-10100 / GT 710 machine, no FPS claim, and no deployed Pages verification.

## Major missing work

Kerala-inspired open world, connected left-hand traffic and AI, race countdown/laps/opponents/standings, drag and rally, real vehicle collection, environment/effects/UI audio and separate volumes, comprehensive sound validation, fully validated powertrain and clutch, versioned unified save migration, full graphics tuning and device optimization, robust offline caching, accessible polished in-game menus and settings. Track generation, driving feel, visual wheel alignment and collision behavior still need extensive human playtesting. This prototype should not be marketed as the finished game.
