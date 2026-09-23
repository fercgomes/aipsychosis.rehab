# aipsychosis.rehab

A small meadow for a break from the infinite scroll. React, Vite, and Three.js, deployed as static assets on Cloudflare Workers.

## Develop

Requires Node.js 22.12+ (Node.js 24 recommended).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Move over the grass to brush it; hold the pointer down to press deeper. Touchscreens support dragging. Keyboard users can focus the field, move with the arrow keys, and hold space to press. Escape releases the hand.

The controls adjust breeze strength, enable background wind and soft grass-rustling audio, and pause the scene. Turn sound on to hear the background wind, then click or drag through the grass to hear the rustle. Touch presses and keyboard space presses work too. Faster strokes sound slightly stronger, with stereo position following the hand. The rustle fades when movement stops and cuts off gently on release; hovering does not trigger it. The breeze slider adjusts the background wind volume. Muting or pausing fades out both sounds. Reduced-motion preferences disable ambient wind movement. The scene requires WebGL 2 and shows a recovery message if it is unavailable.

## Build and deploy

```sh
npm run build
npm run preview
```

Check the Workers bundle without publishing:

```sh
npm run check:deploy
```

Authenticate and publish to Cloudflare:

```sh
npx wrangler login
npm run deploy
```

`wrangler.jsonc` serves `dist/` using [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) with SPA fallback. No Worker script, database, secrets, or paid API is required. The default Worker name is `aipsychosis-rehab`; attach `aipsychosis.rehab` as a custom domain in Cloudflare after deployment if desired.

For Cloudflare Workers Builds, use `npm run build` as the build command and `npx wrangler deploy` as the deploy command.

## Scene

`src/meadow.js` renders instanced, tapered grass blades with procedural lighting, terrain, distance haze, and wind. `src/grass.js` applies damped spring motion to each blade and samples the swept path of the hand so fast movements still bend the grass. A press increases the contact radius and force. Roots stay fixed while the blades bend and settle. This is an interactive approximation, not a full plant or hand collision simulation.

The app self-hosts its font and generates the scene and audio locally. [PostHog's browser SDK](https://posthog.com/docs/libraries/js) initializes once in `src/main.jsx` with the project's public token and US ingestion endpoint (`https://us.i.posthog.com`), capturing pageviews and automatic interactions. There are no accounts or tests.
