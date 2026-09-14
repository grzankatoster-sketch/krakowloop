# KrakowLoop, aplikacja

Expo SDK 57 z expo-router; działa na iOS, Androidzie i w przeglądarce (podgląd na komputerze).

## Podgląd na komputerze
```bash
cd Desktop/strona/app
npx expo start --web
```
Otwórz http://localhost:8081. Najlepiej w Chrome z włączonym widokiem telefonu (F12, potem ikona telefonu), bo aplikacja jest projektowana pod ekran telefonu.
Time Lens na komputerze używa kamerki internetowej; bez niej pokazuje zdjęcie referencyjne.

## Podgląd na telefonie (bez budowania aplikacji)
1. Zainstaluj **Expo Go** z App Store lub Google Play.
2. Na komputerze uruchom `npx expo start`.
3. Zeskanuj kod QR (iPhone: aparatem, Android: w Expo Go). Telefon i komputer muszą być w tej samej sieci Wi-Fi.

## Mapy
- Bez konfiguracji: MapLibre + OpenFreeMap (za darmo, bez konta).
- Wygląd premium (Mapbox Standard 3D): utwórz plik `.env` w tym folderze:
  ```
  EXPO_PUBLIC_MAPBOX_TOKEN=pk.twoj_publiczny_token
  ```
  Token ogranicz w panelu Mapbox do `com.krakowloop.app` i adresów podglądu. Pliku `.env` nie commituj.
- Audyt dostawców: `../03_research/AUDYT_API_MAP.md`.

## Linki partnerskie
`EXPO_PUBLIC_GYG_PARTNER_ID=...` w `.env`. Bez identyfikatora linki działają, ale nie są oznaczane jako afiliacyjne i nie przynoszą prowizji.

## Sprawdzanie
```bash
npm run typecheck
```

## Struktura
- `app/`: ekrany (start, mapa, planer, Time Lens)
- `src/data/`: miejsca (współrzędne z OSM), punkty Time Lens (obrazy z licencjami)
- `src/lib/planner.ts`: planer pętli (budżet czasu dnia, limit rozrzutu, przejazdy)
- `src/components/mapHtml.ts`: mapa (Mapbox albo MapLibre) w WebView lub iframe
- `assets/lens/`: ryciny i zdjęcia w domenie publicznej oraz na CC BY (metadane w `../02_dane/media_pd/media_assets.json`)

## Następne etapy
1. Development build (EAS) i natywny `@rnmapbox/maps` zamiast WebView.
2. Prawdziwe trasy piesze (OSRM lub GraphHopper) zamiast szacunku w linii prostej.
3. Time Lens etap TL2: automatyczne dopasowanie ryciny do fasady.
