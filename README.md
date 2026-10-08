# Pokémon prijsdalers

Houdt elke dag de Cardmarket-prijzen (EUR) bij van alle Engelstalige
**Illustration Rares** en **Special Illustration Rares**, via de gratis
[TCGdex API](https://tcgdex.dev).

## Hoe het werkt

- `.github/workflows/prijzen.yml` draait elke ochtend automatisch.
- `scripts/fetch-prices.mjs` haalt de prijzen op en bewaart ze in `data/snapshots/`.
- `scripts/build-app-data.mjs` berekent de prijs van 1, 2 en 3 maanden geleden en
  schrijft `app-data.json`, dat de app gebruikt.

Na 30, 60 en 90 dagen zijn de vergelijkingen over 1, 2 en 3 maanden beschikbaar.
Tot die tijd toont de app voor 1 maand een indicatie op basis van het 30-daags
gemiddelde van Cardmarket.

## Handmatig starten

Tabblad **Actions** → **Dagelijkse prijzen** → **Run workflow**.
