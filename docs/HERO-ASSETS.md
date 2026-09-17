# Hero image assets

AI-generated hero imagery for PumpStock marketing and empty states. Files live in `public/hero/`.

## Assets

| File | Fallback SVG | Used on |
|------|--------------|---------|
| `hero-station.webp` | `hero-station-fallback.svg` | Landing page hero (desktop right column) |
| `hero-dashboard.webp` | `hero-dashboard-fallback.svg` | Login brand panel background |
| `empty-shift.webp` | `empty-shift-fallback.svg` | Worker dashboard empty state |

Source PNGs are kept for regeneration; WebP variants are served in the app (&lt; 200 KB each).

## Regeneration prompts

**hero-station.webp** — Modern Indian petrol filling station at golden hour, clean professional photography, fuel pumps under warm sunset light, no readable brand logos or text.

**hero-dashboard.webp** — Petrol station manager viewing operations dashboard on tablet, blurred pump background, professional business photography, no readable text on screen.

**empty-shift.webp** — Friendly petrol pump attendant at work station, operational context, warm natural lighting, no logos or readable text.

## Usage

```tsx
import { HeroImage } from '@/components/ui/HeroImage';

<HeroImage
  webpSrc="/hero/hero-station.webp"
  fallbackSvg="/hero/hero-station-fallback.svg"
  alt=""
/>
```

Decorative heroes use `alt=""`. Provide meaningful alt text only when the image conveys information.
