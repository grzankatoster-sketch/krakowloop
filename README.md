# KrakowLoop, aplikacja

Expo SDK 57 z expo-router; działa na iOS, Androidzie i w przeglądarce (podgląd na komputerze).

## Pierwsze uruchomienie
```bash
cd Desktop/strona/app
npm install
cp .env.example .env      # uzupełnij tokeny, patrz „Klucze”
npx expo start --web      # http://localhost:8081
```
Najlepiej w Chrome z włączonym widokiem telefonu (F12, potem ikona telefonu).

## Podgląd na telefonie
**Szybko, bez budowania (Expo Go):**
1. Zainstaluj **Expo Go** z App Store lub Google Play.
2. Na komputerze `npx expo start`, zeskanuj kod QR. Telefon i komputer w tej samej sieci Wi-Fi.

**Jak prawdziwa aplikacja (Android, plik APK przez EAS):**
```bash
npm install -g eas-cli
eas login
eas init                    # jednorazowo, łączy projekt z kontem Expo
eas env:create --environment preview --name EXPO_PUBLIC_MAPBOX_TOKEN --value pk.... --visibility plaintext
eas build --profile preview --platform android
```
Plik `.env` nie trafia do builda EAS (jest w `.gitignore`), dlatego tokeny trzeba dodać przez `eas env:create`.
iPhone wymaga konta Apple Developer (99 USD/rok).

## Klucze (`.env`, nigdy w gicie)
| Zmienna | Po co | Bez niej |
|---|---|---|
| `EXPO_PUBLIC_MAPBOX_TOKEN` | mapa Mapbox Standard 3D i prawdziwe trasy piesze (Mapbox Directions) | MapLibre + OpenFreeMap, czasy przejść szacowane |
| `EXPO_PUBLIC_GYG_PARTNER_ID` | prowizja z linków GetYourGuide (bezpośredni program partnerski GYG) | linki działają bez prowizji i bez oznaczenia |

Oba klucze trafiają do paczki aplikacji, więc to muszą być klucze **publiczne**. Token Mapbox ogranicz w panelu do `com.krakowloop.app` i adresów podglądu. Klucze tajne (np. Claude API) wymagają serwera pośredniczącego.

## Sprawdzanie
```bash
npm run check        # typecheck + ESLint + testy
npm test             # same testy (jest-expo)
```

## Dane
| Plik | Źródło | Odświeżanie |
|---|---|---|
| `src/data/places.ts` | kuratorska lista, współrzędne z OSM | ręcznie, każdy fakt ze źródłem |
| `src/data/hours.json` | godziny z OSM (`../02_dane/poi_krakow_osm.geojson`), przypisanie miejsce→obiekt OSM w `scripts/build-hours.mjs` | `npm run data:hours` |
| `src/data/transit.json` | rozkład tramwajów ZTP Kraków (GTFS) | pobierz i rozpakuj `https://gtfs.ztp.krakow.pl/GTFS_KRK_T.zip` do `../02_dane/gtfs_ztp/T`, potem `npm run data:transit` |
| `assets/lens/` | ryciny i zdjęcia w domenie publicznej i na CC BY (metadane w `../02_dane/media_pd/media_assets.json`) | ręcznie, z licencją |

Rozkład ZTP obowiązuje w okresach (obecny do 9.12.2026), więc trzeba go odświeżać przed końcem okresu.

## Struktura
- `app/`: ekrany (start, mapa z listą i wyszukiwarką, planer, Time Lens, „About, sources and privacy”)
- `src/lib/planner.ts`: planer pętli (budżet czasu, rozrzut, punkt startu, daty i godziny otwarcia, pomijanie przystanków)
- `src/lib/legs.ts`, `transit.ts`: odcinek pieszo, tramwajem (rozkład ZTP) albo taksówką
- `src/lib/directions.ts`: trasy piesze Mapbox Directions z pamięcią podręczną
- `src/lib/planParams.ts`: plan zapisany w adresie (powrót i udostępnianie linkiem)
- `src/lib/useMyLocation.ts`: lokalizacja na żądanie, tylko na pierwszym planie
- `src/components/mapHtml.ts`: mapa (Mapbox albo MapLibre) w WebView lub iframe; `mapMessages.ts`: protokół mapa↔aplikacja
- `__tests__/`: testy planera, tramwajów, godzin, parametrów i protokołu mapy

## Następne etapy
1. Development build (EAS) i natywny `@rnmapbox/maps` zamiast WebView (rozliczanie według MAU zamiast wczytań web).
2. Opóźnienia tramwajów na żywo (GTFS-Realtime ZTP) i przesiadki.
3. Baza (Supabase) zamiast danych w kodzie, ok. 120 miejsc z datą weryfikacji (BK1).
4. Time Lens etap TL2: automatyczne dopasowanie ryciny do fasady.
