# Хуулгын студи (Wrap Studio)

The customer uploads a photo of their own car, clicks the areas to cover, and sees colour wrap
or PPF on the photo itself. They then order area by area. The order arrives in the dealer
dashboard as a `quote` lead.

```bash
npm run dev            # API on :4000 (needed for orders)
npm run dev:wrap       # this app → http://dealer-a.localhost:5175
npm test -w @showroom/wrap-studio
```

## How it works

| Step | Implementation |
|---|---|
| Selecting an area | SlimSAM (`Xenova/slimsam-77-uniform`, Apache-2.0) in a Web Worker via transformers.js. WebGPU if available, otherwise WASM. The photo is encoded once (~2 s on GPU, ~20 s on CPU) and each click then takes ~0.1 s. Shift/right-click removes an area. **Гараар зурах** (draw by hand) is the polygon fallback. |
| Skipping glass, tyres and lights | `paintWeights()`: pixels much darker than the paint, or of a clearly different hue, are faded out of the mask. |
| Colour preview | `applyFilm()`: shading = luminance ÷ paint median, and reflections = light above that are added back as white. Gloss, satin, matte and metallic are modelled as different reflection and shading strengths. Clear and matte (stealth) PPF keep the paint colour. |
| Order | `POST /api/public/leads` (`type: quote`, area/film/price lines in `message`) |

Everything runs on the device. The photo isn't uploaded anywhere (the model weights download
once from Hugging Face and are then cached by the browser).

## Known limitations / next steps

- **Prices are placeholders** (`src/lib/catalog.ts`). They should be moved to the API so each dealership/installer sets its own.
- **The photo isn't attached to the order.** The API has no file storage yet. Add object storage, or at least the preview PNG.
- The preview can't add reflections the original photo didn't have. For example, a white car in flat light shown as gloss black looks more satin-like. A generative (diffusion) pass could be offered as an optional "realistic render".
- On very dark cars, glass and paint can't be told apart by brightness, so the user removes glass with Shift-click.
- Area prices are per-zone presets. They don't use the mask area or the vehicle size class.
- Brand film catalogues (3M 2080, Avery SW900, XPEL…) can replace the demo palette.
