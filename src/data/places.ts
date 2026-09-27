import { getYourGuideSearch } from '../config/affiliates';
import { t } from '../i18n';

export type Category =
  | 'history'
  | 'museum'
  | 'jewish'
  | 'view'
  | 'food'
  | 'daytrip'
  | 'remembrance'
  | 'night';

export type Zone = 'old-town' | 'wawel' | 'kazimierz' | 'podgorze' | 'city' | 'out';

export interface Booking {
  label: string;
  url: string;
  affiliate: boolean;
}

/** whole-day trips the planner can add */
export type TripKind = 'standard' | 'mountains' | 'remembrance';

export interface Place {
  id: string;
  trip?: TripKind;
  name: string;
  local?: string;
  cat: Category;
  zone: Zone;
  lat: number;
  lon: number;
  /** street and number as in OpenStreetMap or the official website; street only when no number is known */
  address?: string;
  /** typical visit length in minutes */
  minutes: number;
  priority: 1 | 2 | 3;
  blurb: string;
  lensId?: string;
  booking?: Booking;
  /** food places for a coffee or a snack (cafés, markets): never offered as the day's dinner */
  noDinner?: true;
}

/** In the session's language (src/i18n). */
export const CATEGORY_LABEL: Record<Category, string> = {
  history: t('cat.history'),
  museum: t('cat.museum'),
  jewish: t('cat.jewish'),
  view: t('cat.view'),
  food: t('cat.food'),
  daytrip: t('cat.daytrip'),
  remembrance: t('cat.remembrance'),
  night: t('cat.night'),
};

export const ZONE_LABEL: Record<Zone, string> = {
  'old-town': t('zone.old-town'),
  wawel: t('zone.wawel'),
  kazimierz: t('zone.kazimierz'),
  podgorze: t('zone.podgorze'),
  city: t('zone.city'),
  out: t('zone.out'),
};

const tour = (q: string): Booking => ({ label: 'Tours on GetYourGuide', ...getYourGuideSearch(q) });
const official = (label: string, url: string): Booking => ({ label, url, affiliate: false });

// Coordinates: OpenStreetMap (Overpass / Nominatim), 14.09.2026. Addresses: OSM / official websites, 17.09.2026. Blurbs: to be fact-checked (BK1).
export const places: Place[] = [
  // Old Town
  { id: 'main-square', name: 'Main Square', local: 'Rynek Główny', cat: 'history', zone: 'old-town', lat: 50.0615, lon: 19.93735, address: 'Rynek Główny, Kraków', minutes: 30, priority: 3, blurb: 'One of the largest medieval market squares in Europe, laid out after the town charter of 1257.', lensId: 'cloth-hall', booking: tour('Krakow Old Town walking tour') },
  { id: 'cloth-hall', name: 'Cloth Hall', local: 'Sukiennice', cat: 'history', zone: 'old-town', lat: 50.0617, lon: 19.93736, address: 'Rynek Główny 3, Kraków', minutes: 45, priority: 3, blurb: 'A trading hall since the Middle Ages, remodelled in the 1870s. Upstairs is a gallery of 19th-century Polish painting.', lensId: 'cloth-hall' },
  { id: 'st-marys', name: "St Mary's Basilica", local: 'Bazylika Mariacka', cat: 'history', zone: 'old-town', lat: 50.06165, lon: 19.93945, address: 'Plac Mariacki 5, Kraków', minutes: 45, priority: 3, blurb: "Home to Veit Stoss's carved wooden altarpiece. A trumpet call, the hejnał, sounds from the tower every hour." },
  { id: 'town-hall-tower', name: 'Town Hall Tower', local: 'Wieża Ratuszowa', cat: 'history', zone: 'old-town', lat: 50.06147, lon: 19.93641, address: 'Rynek Główny 1, Kraków', minutes: 30, priority: 2, lensId: 'town-hall', blurb: 'All that is left of the town hall, which was demolished in the 1820s.' },
  { id: 'rynek-underground', name: 'Rynek Underground', local: 'Rynek Podziemny', cat: 'museum', zone: 'old-town', lat: 50.062, lon: 19.93778, address: 'Rynek Główny 1, Kraków', minutes: 90, priority: 3, blurb: 'A museum under the square, built around excavated medieval stalls and streets.', booking: tour('Rynek Underground') },
  { id: 'st-adalbert', name: "St Adalbert's Church", local: 'Kościół św. Wojciecha', cat: 'history', zone: 'old-town', lat: 50.06089, lon: 19.93774, address: 'Rynek Główny, Kraków', minutes: 15, priority: 1, blurb: 'A small Romanesque church, older than the square around it.' },
  { id: 'florian-gate', name: "St Florian's Gate", local: 'Brama Floriańska', cat: 'history', zone: 'old-town', lat: 50.06486, lon: 19.94135, address: 'Pijarska, Kraków', minutes: 15, priority: 3, blurb: 'The main gate in the old city walls, where the Royal Route to Wawel begins.' },
  { id: 'florianska', name: 'Floriańska Street', local: 'ul. Floriańska', cat: 'history', zone: 'old-town', lat: 50.06342, lon: 19.94027, address: 'Floriańska, Kraków', minutes: 20, priority: 2, blurb: 'The pedestrian street from St Florian’s Gate to the Main Square, the first stretch of the Royal Route.' },
  { id: 'barbican', name: 'Barbican', local: 'Barbakan', cat: 'history', zone: 'old-town', lat: 50.06546, lon: 19.94163, address: 'Basztowa, Kraków', minutes: 20, priority: 2, blurb: 'A round brick outwork that once guarded the approach to the Florian Gate.' },
  { id: 'collegium-maius', name: 'Collegium Maius', cat: 'museum', zone: 'old-town', lat: 50.06165, lon: 19.9337, address: 'Jagiellońska 15, Kraków', minutes: 60, priority: 2, blurb: 'The oldest surviving building of the Jagiellonian University, where Copernicus studied.' },
  { id: 'czartoryski', name: 'Czartoryski Museum', local: 'Muzeum Książąt Czartoryskich', cat: 'museum', zone: 'old-town', lat: 50.06481, lon: 19.94023, address: 'Pijarska 15, Kraków', minutes: 90, priority: 3, blurb: "Home of Leonardo da Vinci's Lady with an Ermine." },
  { id: 'franciscan', name: 'Franciscan Basilica', local: 'Bazylika Franciszkanów', cat: 'history', zone: 'old-town', lat: 50.05921, lon: 19.9361, address: 'Plac Wszystkich Świętych 5, Kraków', minutes: 30, priority: 2, blurb: "Known for Stanisław Wyspiański's Art Nouveau stained glass and wall paintings." },
  { id: 'papal-window', name: 'Papal Window', local: 'Okno Papieskie', cat: 'history', zone: 'old-town', lat: 50.05948, lon: 19.93517, address: 'Franciszkańska 3, Kraków', minutes: 10, priority: 1, blurb: 'The window of the Archbishops’ Palace where Pope John Paul II greeted crowds on his visits to Kraków.' },
  { id: 'dominican', name: 'Dominican Basilica', local: 'Bazylika Dominikanów', cat: 'history', zone: 'old-town', lat: 50.0593, lon: 19.93943, address: 'Stolarska 12, Kraków', minutes: 30, priority: 1, blurb: 'A Gothic church and monastery on Stolarska Street.' },
  { id: 'sts-peter-paul', name: 'Church of Sts Peter and Paul', local: 'Kościół śś. Piotra i Pawła', cat: 'history', zone: 'old-town', lat: 50.05693, lon: 19.93906, address: 'Grodzka 52a, Kraków', minutes: 20, priority: 2, blurb: 'An early Baroque church on Grodzka Street, with statues of the apostles out front.' },
  { id: 'st-andrew', name: "St Andrew's Church", local: 'Kościół św. Andrzeja', cat: 'history', zone: 'old-town', lat: 50.05659, lon: 19.93843, address: 'Grodzka 54, Kraków', minutes: 15, priority: 1, blurb: 'A fortress-like Romanesque church from the late 11th century.' },
  { id: 'kanonicza', name: 'Kanonicza Street', local: 'ul. Kanonicza', cat: 'history', zone: 'old-town', lat: 50.05621, lon: 19.93738, address: 'Kanonicza, Kraków', minutes: 15, priority: 2, blurb: 'A quiet, curving street of old canons’ houses below Wawel Hill.' },
  { id: 'grodzka', name: 'Grodzka Street', local: 'ul. Grodzka', cat: 'history', zone: 'old-town', lat: 50.05653, lon: 19.93818, address: 'Grodzka, Kraków', minutes: 20, priority: 2, blurb: 'The last stretch of the Royal Route, running from the Main Square down towards Wawel Hill.' },
  { id: 'small-square', name: 'Small Market Square', local: 'Mały Rynek', cat: 'history', zone: 'old-town', lat: 50.06121, lon: 19.94032, address: 'Mały Rynek, Kraków', minutes: 10, priority: 1, blurb: "A calmer square just behind St Mary's." },
  { id: 'hipolit-house', name: 'Hipolit House', local: 'Kamienica Hipolitów', cat: 'museum', zone: 'old-town', lat: 50.06195, lon: 19.94012, address: 'Plac Mariacki 3, Kraków', minutes: 45, priority: 1, blurb: 'Rooms furnished as a wealthy Kraków home through the centuries.' },
  { id: 'pharmacy-museum', name: 'Museum of Pharmacy', local: 'Muzeum Farmacji UJ', cat: 'museum', zone: 'old-town', lat: 50.06323, lon: 19.94033, address: 'Floriańska 25, Kraków', minutes: 45, priority: 1, blurb: 'Old apothecaries recreated in a historic townhouse.' },
  { id: 'slowacki-theatre', name: 'Słowacki Theatre', local: 'Teatr im. Juliusza Słowackiego', cat: 'history', zone: 'old-town', lat: 50.06395, lon: 19.94305, address: 'Plac Świętego Ducha 1, Kraków', minutes: 10, priority: 1, blurb: 'An eclectic theatre opened in 1893, inspired by the Paris Opera.' },
  { id: 'planty', name: 'Planty Park', local: 'Planty', cat: 'view', zone: 'old-town', lat: 50.06021, lon: 19.94191, minutes: 20, priority: 2, blurb: 'A ring of parkland where the medieval walls once stood.' },
  // Museums added 15.09.2026: coordinates from the OSM export, blurbs from Wikipedia/Wikidata or the museum's own site (03_research/MUZEA_ZRODLA.md)
  { id: 'bunkier-sztuki', name: 'Bunkier Sztuki Gallery', local: 'Bunkier Sztuki', cat: 'museum', zone: 'old-town', lat: 50.06358, lon: 19.93445, address: 'Plac Szczepański 3a, Kraków', minutes: 45, priority: 1, blurb: 'A contemporary art gallery on Szczepański Square by the Planty, opened in 1965.' },
  { id: 'szolayski-house', name: 'Szołayski House', local: 'Kamienica Szołayskich', cat: 'museum', zone: 'old-town', lat: 50.06335, lon: 19.93596, address: 'Plac Szczepański 9, Kraków', minutes: 45, priority: 1, blurb: 'A National Museum branch in a corner townhouse on Szczepański Square, with permanent exhibitions on architecture and design.' },
  { id: 'archaeological-museum', name: 'Archaeological Museum', local: 'Muzeum Archeologiczne w Krakowie', cat: 'museum', zone: 'old-town', lat: 50.05756, lon: 19.93625, address: 'Senacka 3, Kraków', minutes: 60, priority: 1, blurb: 'Kraków’s archaeological museum, established in 1850.' },
  { id: 'ciolek-palace', name: 'Bishop Ciołek Palace', local: 'Pałac Biskupa Erazma Ciołka', cat: 'museum', zone: 'old-town', lat: 50.0563, lon: 19.93722, address: 'Kanonicza 17, Kraków', minutes: 60, priority: 1, blurb: 'A 16th-century palace on Kanonicza Street, a branch of the National Museum since 2007.' },
  { id: 'natural-history-museum', name: 'Natural History Museum', local: 'Muzeum Przyrodnicze PAN', cat: 'museum', zone: 'old-town', lat: 50.05547, lon: 19.94151, address: 'Świętego Sebastiana 9, Kraków', minutes: 45, priority: 1, blurb: 'Home to a woolly rhinoceros preserved whole, the only complete specimen of this extinct animal in the world.' },
  { id: 'krzysztofory', name: 'Krzysztofory Palace', local: 'Pałac Krzysztofory', cat: 'museum', zone: 'old-town', lat: 50.06277, lon: 19.9365, address: 'Rynek Główny 35, Kraków', minutes: 60, priority: 1, blurb: 'A historic palace on the corner of the Main Square, the main seat of the Museum of Kraków.' },
  // Wawel
  { id: 'wawel-castle', name: 'Wawel Royal Castle', local: 'Zamek Królewski na Wawelu', cat: 'museum', zone: 'wawel', lat: 50.05441, lon: 19.93656, address: 'Wawel 5, Kraków', minutes: 150, priority: 3, blurb: 'The residence of Polish kings, with state rooms, a treasury and an armoury.', lensId: 'wawel', booking: tour('Wawel Castle guided tour') },
  { id: 'wawel-cathedral', name: 'Wawel Cathedral', local: 'Katedra Wawelska', cat: 'history', zone: 'wawel', lat: 50.05464, lon: 19.93548, address: 'Wawel, Kraków', minutes: 60, priority: 3, blurb: 'Coronation and burial church of Polish kings. You can climb up to the Sigismund Bell.' },
  { id: 'dragons-den', name: "Dragon's Den", local: 'Smocza Jama', cat: 'history', zone: 'wawel', lat: 50.05342, lon: 19.93358, minutes: 20, priority: 2, blurb: 'A cave under Wawel Hill. At the exit stands a dragon statue that breathes fire.' },
  { id: 'boulevards', name: 'Vistula Boulevards', local: 'Bulwary Wiślane', cat: 'view', zone: 'wawel', lat: 50.05491, lon: 19.93168, minutes: 30, priority: 2, blurb: 'Riverside paths below Wawel, good for a sunset walk or a boat trip.', lensId: 'skyline', booking: tour('Krakow Vistula river cruise') },
  { id: 'cathedral-museum', name: 'Cathedral Museum', local: 'Muzeum Katedralne im. Jana Pawła II', cat: 'museum', zone: 'wawel', lat: 50.05466, lon: 19.9345, address: 'Wawel, Kraków', minutes: 30, priority: 1, blurb: 'The cathedral’s museum, in two 14th-century buildings beside the Vasa Gate on Wawel Hill.' },
  // Kazimierz
  { id: 'old-synagogue', name: 'Old Synagogue', local: 'Stara Synagoga', cat: 'jewish', zone: 'kazimierz', lat: 50.05137, lon: 19.94861, address: 'Szeroka 24, Kraków', minutes: 45, priority: 3, blurb: 'One of the oldest surviving synagogues in Poland, now a museum.' },
  { id: 'remuh', name: 'Remuh Synagogue and Cemetery', local: 'Synagoga Remuh', cat: 'jewish', zone: 'kazimierz', lat: 50.05265, lon: 19.94728, address: 'Szeroka 40, Kraków', minutes: 30, priority: 3, blurb: 'An active 16th-century synagogue with an old Jewish cemetery beside it.' },
  { id: 'schindler-stairs', name: 'Schindler’s List stairs', local: 'Schody z filmu „Lista Schindlera”', cat: 'history', zone: 'kazimierz', lat: 50.05091, lon: 19.94403, minutes: 10, priority: 1, blurb: 'A courtyard stairway in Kazimierz used as a film set for Steven Spielberg’s Schindler’s List (1993).' },
  { id: 'tempel', name: 'Tempel Synagogue', local: 'Synagoga Tempel', cat: 'jewish', zone: 'kazimierz', lat: 50.05294, lon: 19.94444, address: 'Miodowa 24, Kraków', minutes: 30, priority: 2, blurb: 'A 19th-century Reform synagogue with a richly painted interior.' },
  { id: 'plac-nowy', name: 'Plac Nowy', cat: 'food', zone: 'kazimierz', lat: 50.05174, lon: 19.94462, address: 'Plac Nowy, Kraków', minutes: 30, priority: 3, blurb: 'The market square of Kazimierz. The round hall sells zapiekanki, a local open baguette. Busy with bars at night.', booking: tour('Krakow food tour Kazimierz') },
  { id: 'galicia-museum', name: 'Galicia Jewish Museum', local: 'Żydowskie Muzeum Galicja', cat: 'jewish', zone: 'kazimierz', lat: 50.05086, lon: 19.94968, address: 'Dajwór 18, Kraków', minutes: 60, priority: 2, blurb: 'Photography and exhibitions about Jewish life and memory in southern Poland.' },
  { id: 'corpus-christi', name: 'Corpus Christi Basilica', local: 'Bazylika Bożego Ciała', cat: 'history', zone: 'kazimierz', lat: 50.04977, lon: 19.94498, address: 'Bożego Ciała 26, Kraków', minutes: 30, priority: 1, blurb: 'A large Gothic church founded when Kazimierz was still a separate town.' },
  { id: 'bernatka', name: 'Father Bernatek Footbridge', local: 'Kładka Ojca Bernatka', cat: 'view', zone: 'kazimierz', lat: 50.04656, lon: 19.9475, minutes: 10, priority: 2, blurb: 'A footbridge across the Vistula linking Kazimierz with Podgórze.' },
  { id: 'ethnographic-museum', name: 'Ethnographic Museum', local: 'Muzeum Etnograficzne im. Seweryna Udzieli', cat: 'museum', zone: 'kazimierz', lat: 50.04866, lon: 19.94349, address: 'Plac Wolnica 1, Kraków', minutes: 60, priority: 1, blurb: 'The Seweryn Udziela Ethnographic Museum in Kazimierz, first opened in 1911.' },
  { id: 'engineering-museum', name: 'Museum of Engineering and Technology', local: 'Muzeum Inżynierii i Techniki', cat: 'museum', zone: 'kazimierz', lat: 50.04951, lon: 19.9473, address: 'Świętego Wawrzyńca 15, Kraków', minutes: 90, priority: 2, blurb: 'Early trams, buses, motorcycles, radios and machines, in historic buildings on św. Wawrzyńca Street.' },
  // Podgórze
  { id: 'schindler', name: "Oskar Schindler's Factory", local: 'Fabryka Emalia Oskara Schindlera', cat: 'museum', zone: 'podgorze', lat: 50.04745, lon: 19.9617, address: 'Lipowa 4, Kraków', minutes: 120, priority: 3, blurb: 'A museum of Kraków under German occupation, 1939–1945, in Schindler’s former factory. Tickets often sell out.' },
  { id: 'mocak', name: 'MOCAK', local: 'Muzeum Sztuki Współczesnej', cat: 'museum', zone: 'podgorze', lat: 50.04788, lon: 19.96137, address: 'Lipowa 4, Kraków', minutes: 90, priority: 1, blurb: 'Museum of Contemporary Art, next door to Schindler’s Factory.' },
  { id: 'ghetto-heroes', name: 'Ghetto Heroes Square', local: 'Plac Bohaterów Getta', cat: 'remembrance', zone: 'podgorze', lat: 50.04672, lon: 19.95444, address: 'Plac Bohaterów Getta, Kraków', minutes: 20, priority: 2, blurb: 'A memorial of empty chairs on the square of the wartime ghetto.' },
  { id: 'eagle-pharmacy', name: 'Eagle Pharmacy', local: 'Apteka pod Orłem', cat: 'remembrance', zone: 'podgorze', lat: 50.04624, lon: 19.95415, address: 'Plac Bohaterów Getta 18, Kraków', minutes: 45, priority: 2, blurb: 'The pharmacy of Tadeusz Pankiewicz, who helped people in the ghetto. Now a museum.' },
  { id: 'krakus-mound', name: 'Krakus Mound', local: 'Kopiec Krakusa', cat: 'view', zone: 'podgorze', lat: 50.03808, lon: 19.95844, minutes: 40, priority: 2, blurb: 'An ancient mound with a wide view over the city.' },
  { id: 'podgorze-museum', name: 'Podgórze Museum', local: 'Muzeum Podgórza', cat: 'museum', zone: 'podgorze', lat: 50.04252, lon: 19.96098, address: 'Limanowskiego 51, Kraków', minutes: 45, priority: 1, blurb: 'The history of Podgórze, a free royal town from 1784, told in old merchant buildings at 51 Limanowskiego Street. A Museum of Kraków branch.' },
  // Greater Kraków
  { id: 'kosciuszko-mound', name: 'Kościuszko Mound', local: 'Kopiec Kościuszki', cat: 'view', zone: 'city', lat: 50.05492, lon: 19.89335, address: 'Aleja Waszyngtona 1, Kraków', minutes: 90, priority: 2, blurb: 'A mound raised in the 1820s to honour Tadeusz Kościuszko. On clear days you can see the Tatras.' },
  { id: 'national-museum', name: 'National Museum, Main Building', local: 'Muzeum Narodowe, Gmach Główny', cat: 'museum', zone: 'city', lat: 50.0604, lon: 19.9237, address: 'Aleja 3 Maja 1, Kraków', minutes: 120, priority: 1, blurb: 'The main building of the National Museum in Kraków.' },
  { id: 'manggha', name: 'Manggha Museum', local: 'Muzeum Manggha', cat: 'museum', zone: 'city', lat: 50.05087, lon: 19.93166, address: 'Marii Konopnickiej 26, Kraków', minutes: 60, priority: 1, blurb: 'Japanese art and technology, on the riverbank facing Wawel.' },
  { id: 'nowa-huta', name: 'Nowa Huta Central Square', local: 'Plac Centralny', cat: 'history', zone: 'city', lat: 50.07188, lon: 20.03807, address: 'Plac Centralny, Kraków', minutes: 60, priority: 2, blurb: 'The centre of a socialist-realist planned town built from 1949.', booking: tour('Nowa Huta communism tour') },
  { id: 'ark-of-the-lord', name: 'Ark of the Lord Church', local: 'Arka Pana', cat: 'history', zone: 'city', lat: 50.08404, lon: 20.02993, minutes: 30, priority: 1, blurb: 'A modernist church built by Nowa Huta residents and consecrated in 1977.' },
  { id: 'divine-mercy', name: 'Divine Mercy Sanctuary', local: 'Sanktuarium Bożego Miłosierdzia', cat: 'history', zone: 'city', lat: 50.01906, lon: 19.9375, address: 'Siostry Faustyny 3, Kraków', minutes: 60, priority: 1, blurb: 'A major pilgrimage site in Łagiewniki.' },
  { id: 'tyniec', name: 'Tyniec Abbey', local: 'Opactwo w Tyńcu', cat: 'history', zone: 'city', lat: 50.01845, lon: 19.8029, address: 'Benedyktyńska 37, Kraków', minutes: 120, priority: 1, blurb: 'A Benedictine abbey on a limestone cliff above the Vistula.' },
  { id: 'zakrzowek', name: 'Zakrzówek', cat: 'view', zone: 'city', lat: 50.04141, lon: 19.91833, minutes: 90, priority: 1, blurb: 'A former quarry lake with turquoise water and seasonal swimming pools.' },
  { id: 'aviation-museum', name: 'Polish Aviation Museum', local: 'Muzeum Lotnictwa Polskiego', cat: 'museum', zone: 'city', lat: 50.07885, lon: 19.99056, address: 'Aleja Jana Pawła II 39, Kraków', minutes: 120, priority: 1, blurb: 'Aircraft collection on the site of a former airfield.' },
  { id: 'mehoffer-house', name: 'Józef Mehoffer House', local: 'Dom Józefa Mehoffera', cat: 'museum', zone: 'city', lat: 50.06326, lon: 19.92842, address: 'Krupnicza 26, Kraków', minutes: 45, priority: 1, blurb: 'A National Museum branch devoted to the artist Józef Mehoffer, at 26 Krupnicza Street.' },
  { id: 'hutten-czapski', name: 'Emeryk Hutten-Czapski Museum', local: 'Muzeum im. Emeryka Hutten-Czapskiego', cat: 'museum', zone: 'city', lat: 50.05991, lon: 19.93017, address: 'Piłsudskiego 12, Kraków', minutes: 45, priority: 1, blurb: 'A branch of the National Museum in Kraków, also known as the Czapski Museum.' },
  { id: 'stained-glass-museum', name: 'Stained Glass Museum', local: 'Muzeum Witrażu', cat: 'museum', zone: 'city', lat: 50.05901, lon: 19.9257, address: 'Aleja Krasińskiego 23, Kraków', minutes: 45, priority: 1, blurb: 'A museum inside a working stained glass studio founded in 1902, in the house built for it in 1908. Wyspiański and Mehoffer worked with the studio.' },
  { id: 'mufo', name: 'MuFo Museum of Photography', local: 'MuFo Rakowicka', cat: 'museum', zone: 'city', lat: 50.0704, lon: 19.95353, address: 'Rakowicka 22A, Kraków', minutes: 60, priority: 1, blurb: 'The Walery Rzewuski Museum of Photography, a state-run museum and the only one of its kind when it was founded.' },
  { id: 'home-army-museum', name: 'Home Army Museum', local: 'Muzeum Armii Krajowej', cat: 'museum', zone: 'city', lat: 50.07239, lon: 19.94871, address: 'Wita Stwosza 12, Kraków', minutes: 90, priority: 2, blurb: 'A museum of the Polish Underground State and its army during World War II, opened in 2000.' },
  { id: 'cogiteon', name: 'Cogiteon Science Centre', local: 'Małopolskie Centrum Nauki Cogiteon', cat: 'museum', zone: 'city', lat: 50.08558, lon: 19.99044, address: 'Stefana Steca 1, Kraków', minutes: 120, priority: 1, blurb: 'Małopolska’s science centre, built around hands-on experiments you do yourself or in a team.' },
  { id: 'pomorska-street', name: 'Pomorska Street Museum', local: 'Ulica Pomorska', cat: 'remembrance', zone: 'city', lat: 50.07069, lon: 19.92493, address: 'Pomorska 2, Kraków', minutes: 45, priority: 1, blurb: 'The wartime Gestapo headquarters, where prisoners’ inscriptions survive on the walls of the basement cells. A Museum of Kraków branch.' },
  { id: 'celestat', name: 'Celestat', local: 'Celestat', cat: 'museum', zone: 'city', lat: 50.06545, lon: 19.94937, address: 'Lubicz 16, Kraków', minutes: 30, priority: 1, blurb: 'The small palace where Kraków’s Fowler Brotherhood practised shooting, now a Museum of Kraków branch on the brotherhood’s history.' },
  { id: 'rydlowka', name: 'Rydlówka', local: 'Rydlówka', cat: 'museum', zone: 'city', lat: 50.08785, lon: 19.87805, address: 'Tetmajera 28, Kraków', minutes: 45, priority: 1, blurb: 'The manor house in Bronowice where the poet Lucjan Rydel married in 1900, the wedding Wyspiański turned into his play The Wedding.' },
  { id: 'nowa-huta-underground', name: 'Nowa Huta Underground', local: 'Podziemna Nowa Huta', cat: 'museum', zone: 'city', lat: 50.07653, lon: 20.05041, address: 'os. Szkolne 37, Kraków', minutes: 60, priority: 1, blurb: 'One of the Museum of Kraków’s underground sites in Nowa Huta, at os. Szkolne 37, with the permanent exhibition State of Emergency.' },
  // Added 17.09.2026: coordinates and addresses from OpenStreetMap (Nominatim), blurbs from Wikipedia/Wikidata
  // or the official website (03_research/ATRAKCJE_AUDYT_2026-09-17.md). Bars & clubs never enter a planned loop.
  { id: 'st-anne', name: 'St Anne’s Church', local: 'Kolegiata św. Anny', cat: 'history', zone: 'old-town', lat: 50.0624, lon: 19.93356, address: 'Świętej Anny 13, Kraków', minutes: 20, priority: 1, blurb: 'The collegiate church of the Jagiellonian University, on St Anne Street in the Old Town.' },
  { id: 'matejko-house', name: 'Jan Matejko House', local: 'Dom Jana Matejki', cat: 'museum', zone: 'old-town', lat: 50.06383, lon: 19.941, address: 'Floriańska 41, Kraków', minutes: 45, priority: 1, blurb: 'A museum of the painter Jan Matejko, opened in 1895 and a branch of the National Museum since 1904.' },
  { id: 'wierzynek', name: 'Wierzynek', cat: 'food', zone: 'old-town', lat: 50.06038, lon: 19.93741, address: 'Rynek Główny 16, Kraków', minutes: 90, priority: 1, blurb: 'A restaurant on the Main Square, spread over four floors with eight dining rooms.' },
  { id: 'noworolski', name: 'Noworolski Café', local: 'Noworolski', cat: 'food', zone: 'old-town', lat: 50.06155, lon: 19.93747, address: 'Rynek Główny 1, Kraków', minutes: 45, priority: 1, blurb: 'A café in the Cloth Hall on the Main Square.', noDinner: true },
  { id: 'jama-michalika', name: 'Jama Michalika Café', local: 'Jama Michalika', cat: 'food', zone: 'old-town', lat: 50.06408, lon: 19.94093, address: 'Floriańska 45, Kraków', minutes: 45, priority: 1, blurb: 'A historic café on Floriańska Street, established in 1895.', noDinner: true },
  { id: 'milk-bar-temida', name: 'Pod Temidą Milk Bar', local: 'Bar Mleczny Pod Temidą', cat: 'food', zone: 'old-town', lat: 50.05773, lon: 19.93793, address: 'Grodzka 43, Kraków', minutes: 30, priority: 1, blurb: 'A milk bar, a cheap self-service canteen for simple Polish dishes, on Grodzka Street.' },
  { id: 'pod-jaszczurami', name: 'Pod Jaszczurami Club', local: 'Klub Pod Jaszczurami', cat: 'night', zone: 'old-town', lat: 50.06085, lon: 19.93819, address: 'Rynek Główny 8, Kraków', minutes: 120, priority: 1, blurb: 'One of the oldest student clubs in Poland, open since 1960 and known for jazz, in a townhouse on the Main Square.' },
  { id: 'piwnica-pod-baranami', name: 'Piwnica pod Baranami', cat: 'night', zone: 'old-town', lat: 50.0616, lon: 19.9354, address: 'Rynek Główny 27, Kraków', minutes: 120, priority: 1, blurb: 'A literary cabaret founded by Piotr Skrzynecki in 1956, still in its original cellar on the Main Square.' },
  { id: 'harris-jazz', name: 'Harris Piano Jazz Bar', cat: 'night', zone: 'old-town', lat: 50.06174, lon: 19.93554, address: 'Rynek Główny 28, Kraków', minutes: 120, priority: 1, blurb: 'A jazz bar on the Main Square.' },
  { id: 'u-muniaka', name: 'Jazz Club U Muniaka', cat: 'night', zone: 'old-town', lat: 50.06219, lon: 19.93959, address: 'Floriańska 3, Kraków', minutes: 120, priority: 1, blurb: 'A jazz club on Floriańska Street.' },
  { id: 'prozak', name: 'Prozak 2.0', cat: 'night', zone: 'old-town', lat: 50.059, lon: 19.9382, address: 'Plac Dominikański 6, Kraków', minutes: 180, priority: 1, blurb: 'A nightclub on Dominican Square.' },
  { id: 'house-of-beer', name: 'House of Beer', cat: 'night', zone: 'old-town', lat: 50.06191, lon: 19.94243, address: 'Świętego Tomasza 35, Kraków', minutes: 90, priority: 1, blurb: 'A beer pub on św. Tomasza Street.' },
  { id: 'multi-qlti', name: 'Multi Qlti Tap Bar', cat: 'night', zone: 'old-town', lat: 50.06291, lon: 19.93437, address: 'Szewska, Kraków', minutes: 90, priority: 1, blurb: 'A tap bar on Szewska Street.' },
  { id: 'wodka-bar', name: 'Wódka Café Bar', cat: 'night', zone: 'old-town', lat: 50.06125, lon: 19.94162, address: 'Mikołajska, Kraków', minutes: 60, priority: 1, blurb: 'A vodka bar on Mikołajska Street.' },
  { id: 'skalka', name: 'Skałka Church', local: 'Kościół na Skałce', cat: 'history', zone: 'kazimierz', lat: 50.04823, lon: 19.93763, address: 'Skałeczna 15, Kraków', minutes: 30, priority: 1, blurb: 'The Pauline Fathers’ church “on the Rock”, on Skałeczna Street in Kazimierz.' },
  { id: 'szeroka-street', name: 'Szeroka Street', local: 'ul. Szeroka', cat: 'jewish', zone: 'kazimierz', lat: 50.05159, lon: 19.94823, address: 'Szeroka, Kraków', minutes: 20, priority: 1, blurb: 'The broad street at the heart of Jewish Kazimierz, with the Old Synagogue and the Remuh Synagogue on it.' },
  { id: 'isaac-synagogue', name: 'Isaac Synagogue', local: 'Synagoga Izaaka', cat: 'jewish', zone: 'kazimierz', lat: 50.05167, lon: 19.94665, address: 'Kupa 18, Kraków', minutes: 20, priority: 1, blurb: 'A Baroque synagogue completed in 1644, named after its founder, the merchant Izaak Jakubowicz.' },
  { id: 'kupa-synagogue', name: 'Kupa Synagogue', local: 'Synagoga Kupa', cat: 'jewish', zone: 'kazimierz', lat: 50.05261, lon: 19.94574, address: 'Warszauera 8, Kraków', minutes: 20, priority: 1, blurb: 'A 17th-century synagogue, also called the Synagogue of the Poor.' },
  { id: 'high-synagogue', name: 'High Synagogue', local: 'Synagoga Wysoka', cat: 'jewish', zone: 'kazimierz', lat: 50.05136, lon: 19.94738, address: 'Józefa 38, Kraków', minutes: 20, priority: 1, blurb: 'Built in 1556–1563. Its name comes from the prayer hall on the upper floor.' },
  { id: 'new-jewish-cemetery', name: 'New Jewish Cemetery', local: 'Nowy Cmentarz Żydowski', cat: 'jewish', zone: 'kazimierz', lat: 50.05335, lon: 19.95238, address: 'Miodowa 55, Kraków', minutes: 45, priority: 1, blurb: 'A Jewish cemetery of about three hectares on Miodowa Street, a registered heritage monument since 1999.' },
  { id: 'judah-square', name: 'Judah Square food trucks', local: 'Skwer Judah', cat: 'food', zone: 'kazimierz', lat: 50.05028, lon: 19.94815, address: 'Świętego Wawrzyńca, Kraków', minutes: 30, priority: 1, blurb: 'Food trucks and outdoor tables on św. Wawrzyńca Street, under the large Judah mural.' },
  { id: 'alchemia', name: 'Alchemia', cat: 'night', zone: 'kazimierz', lat: 50.05215, lon: 19.94493, address: 'Estery 5, Kraków', minutes: 120, priority: 1, blurb: 'A bar on Estery Street, a few steps from Plac Nowy.' },
  { id: 'mleczarnia', name: 'Mleczarnia', cat: 'night', zone: 'kazimierz', lat: 50.05136, lon: 19.94393, address: 'Beera Meiselsa 20, Kraków', minutes: 90, priority: 1, blurb: 'A café-bar on Beera Meiselsa Street, with a garden across the road.' },
  { id: 'hevre', name: 'Hevre', cat: 'night', zone: 'kazimierz', lat: 50.05118, lon: 19.94338, address: 'Beera Meiselsa, Kraków', minutes: 90, priority: 1, blurb: 'A bar and restaurant on Beera Meiselsa Street.' },
  { id: 'eszeweria', name: 'Eszeweria', cat: 'night', zone: 'kazimierz', lat: 50.05053, lon: 19.94448, address: 'Józefa 9, Kraków', minutes: 90, priority: 1, blurb: 'A bar on Józefa Street.' },
  { id: 'piekny-pies', name: 'Piękny Pies', cat: 'night', zone: 'kazimierz', lat: 50.04893, lon: 19.94478, address: 'Plac Wolnica 9, Kraków', minutes: 90, priority: 1, blurb: 'A bar on Wolnica Square.' },
  { id: 'cricoteka', name: 'Cricoteka', cat: 'museum', zone: 'podgorze', lat: 50.04732, lon: 19.95135, address: 'Nadwiślańska 2-4, Kraków', minutes: 60, priority: 1, blurb: 'The centre documenting the art of Tadeusz Kantor, founded in 1980, in the former Podgórze power station.' },
  { id: 'drukarnia', name: 'Drukarnia', cat: 'night', zone: 'podgorze', lat: 50.04617, lon: 19.94922, address: 'Nadwiślańska 1, Kraków', minutes: 90, priority: 1, blurb: 'A bar near the Podgórze end of the Father Bernatek Footbridge.' },
  { id: 'ghetto-wall', name: 'Ghetto Wall Fragment', local: 'Mur getta', cat: 'remembrance', zone: 'podgorze', lat: 50.04286, lon: 19.95913, address: 'Limanowskiego 60, Kraków', minutes: 10, priority: 1, blurb: 'A surviving section of the wall the German occupiers built around the Kraków ghetto in Podgórze.' },
  { id: 'liban-quarry', name: 'Liban Quarry', local: 'Kamieniołom Liban', cat: 'remembrance', zone: 'podgorze', lat: 50.03634, lon: 19.95645, address: 'Za Torem 22, Kraków', minutes: 30, priority: 1, blurb: 'A former limestone quarry where the Germans ran a penal labour camp during the occupation. Now a nature reserve.' },
  { id: 'plaszow-memorial', name: 'Płaszów Camp Memorial', local: 'Pomnik Ofiar Faszyzmu, Płaszów', cat: 'remembrance', zone: 'podgorze', lat: 50.02955, lon: 19.96167, address: 'Abrahama, Kraków', minutes: 45, priority: 1, blurb: 'The grounds of the German Nazi Płaszów camp, marked by a large monument to its victims.' },
  { id: 'wyspianski-museum', name: 'Stanisław Wyspiański Museum', local: 'Muzeum Stanisława Wyspiańskiego', cat: 'museum', zone: 'city', lat: 50.06143, lon: 19.92914, address: 'Plac Sikorskiego 6, Kraków', minutes: 60, priority: 1, blurb: 'A National Museum branch devoted to the painter and playwright Stanisław Wyspiański.' },
  { id: 'massolit', name: 'Massolit Books & Café', local: 'Massolit', cat: 'food', zone: 'city', lat: 50.05845, lon: 19.9296, address: 'Felicjanek 4, Kraków', minutes: 45, priority: 1, blurb: 'A bookshop café on Felicjanek Street.', noDinner: true },
  { id: 'stary-kleparz', name: 'Stary Kleparz Market', local: 'Stary Kleparz', cat: 'food', zone: 'city', lat: 50.06738, lon: 19.94109, address: 'Rynek Kleparski 20, Kraków', minutes: 30, priority: 1, blurb: 'An open-air market on Kleparz Square, just north of the Old Town.', noDinner: true },
  { id: 'blonia', name: 'Błonia Meadow', local: 'Błonia', cat: 'view', zone: 'city', lat: 50.05979, lon: 19.91096, minutes: 30, priority: 1, blurb: 'A historic 48-hectare meadow, about 700 metres west of the Old Town.' },
  { id: 'jordan-park', name: 'Jordan Park', local: 'Park im. Henryka Jordana', cat: 'view', zone: 'city', lat: 50.06273, lon: 19.91607, address: 'Reymonta, Kraków', minutes: 30, priority: 1, blurb: 'Opened in 1889 as the first public playground in Kraków, beside the Błonia.' },
  { id: 'zoo', name: 'Kraków Zoo', local: 'Ogród Zoologiczny', cat: 'view', zone: 'city', lat: 50.05351, lon: 19.84951, address: 'Aleja Kasy Oszczędności Miasta Krakowa, Kraków', minutes: 180, priority: 1, blurb: 'A zoo founded in 1929 in the Wolski Forest, with about 1,500 animals.' },
  { id: 'pilsudski-mound', name: 'Piłsudski Mound', local: 'Kopiec Piłsudskiego', cat: 'view', zone: 'city', lat: 50.06005, lon: 19.84717, minutes: 90, priority: 1, blurb: 'A mound in the Wolski Forest raised in honour of Józef Piłsudski.' },
  { id: 'bielany-hermitage', name: 'Camaldolese Hermitage, Bielany', local: 'Klasztor Kamedułów na Bielanach', cat: 'history', zone: 'city', lat: 50.04599, lon: 19.8412, address: 'Aleja Konarowa, Kraków', minutes: 60, priority: 1, blurb: 'The monastery of the Camaldolese monks on a wooded hill in Bielany.' },
  { id: 'botanic-garden', name: 'Botanic Garden', local: 'Ogród Botaniczny UJ', cat: 'view', zone: 'city', lat: 50.06237, lon: 19.95805, address: 'Kopernika 27, Kraków', minutes: 60, priority: 1, blurb: 'The Jagiellonian University’s botanic garden on Kopernika Street.' },
  { id: 'rakowicki-cemetery', name: 'Rakowicki Cemetery', local: 'Cmentarz Rakowicki', cat: 'history', zone: 'city', lat: 50.07525, lon: 19.95246, address: 'Rakowicka 26, Kraków', minutes: 60, priority: 1, blurb: 'A historic cemetery and heritage monument on Rakowicka Street.' },
  { id: 'garden-of-experiences', name: 'Garden of Experiences', local: 'Ogród Doświadczeń im. Stanisława Lema', cat: 'museum', zone: 'city', lat: 50.06819, lon: 19.9973, address: 'Aleja Pokoju 68, Kraków', minutes: 90, priority: 1, blurb: 'An outdoor science park opened in 2007, a branch of the Museum of Engineering and Technology.' },
  { id: 'wanda-mound', name: 'Wanda Mound', local: 'Kopiec Wandy', cat: 'view', zone: 'city', lat: 50.07023, lon: 20.06808, minutes: 30, priority: 1, blurb: 'A mound in Mogiła, by legend the resting place of Princess Wanda, daughter of Krak.' },
  { id: 'klub-studio', name: 'Klub Studio', cat: 'night', zone: 'city', lat: 50.06803, lon: 19.90824, address: 'Witolda Budryka 4, Kraków', minutes: 180, priority: 1, blurb: 'A student club and concert venue run by a foundation of AGH students and graduates.' },
  { id: 'klub-kwadrat', name: 'Klub Kwadrat', cat: 'night', zone: 'city', lat: 50.08383, lon: 19.99602, address: 'Skarżyńskiego 1, Kraków', minutes: 180, priority: 1, blurb: 'A student club on Skarżyńskiego Street.' },
  // Outside Kraków
  { id: 'wieliczka', trip: 'standard', name: 'Wieliczka Salt Mine', local: 'Kopalnia Soli Wieliczka', cat: 'daytrip', zone: 'out', lat: 49.98089, lon: 20.06124, minutes: 240, priority: 3, blurb: 'A UNESCO-listed salt mine with chapels carved out of salt, about 15 km from the centre.', booking: tour('Wieliczka Salt Mine') },
  { id: 'zakopane', trip: 'mountains', name: 'Zakopane and the Tatras', local: 'Zakopane', cat: 'daytrip', zone: 'out', lat: 49.29691, lon: 19.95048, minutes: 600, priority: 2, blurb: 'A mountain town at the foot of the Tatras, about two hours from Kraków.', booking: tour('Zakopane day trip from Krakow') },
  { id: 'ojcow', name: 'Ojców National Park', local: 'Ojcowski Park Narodowy', cat: 'daytrip', zone: 'out', lat: 50.21071, lon: 19.80857, minutes: 300, priority: 1, blurb: 'Limestone valleys and castles, north of Kraków.', booking: tour('Ojcow National Park') },
  { id: 'energylandia', name: 'Energylandia', cat: 'daytrip', zone: 'out', lat: 49.9994, lon: 19.40982, address: 'Aleja 3 Maja 2, Zator', minutes: 480, priority: 1, blurb: 'One of the largest amusement parks in Poland, in Zator.', booking: tour('Energylandia from Krakow') },
  { id: 'auschwitz', trip: 'remembrance', name: 'Auschwitz-Birkenau Memorial', local: 'Państwowe Muzeum Auschwitz-Birkenau', cat: 'remembrance', zone: 'out', lat: 50.02934, lon: 19.20558, address: 'Więźniów Oświęcimia 55, Oświęcim', minutes: 420, priority: 3, blurb: 'The former German Nazi concentration and extermination camp, now a memorial and museum. Entry cards are issued only through the official website. Visits are not recommended for children under 14.', booking: official('Reserve on the official website', 'https://visit.auschwitz.org') },
  { id: 'wadowice', name: 'John Paul II Family Home, Wadowice', local: 'Dom Rodzinny Jana Pawła II', cat: 'daytrip', zone: 'out', lat: 49.88337, lon: 19.49391, address: 'Kościelna 7, Wadowice', minutes: 240, priority: 1, blurb: 'The birthplace and family home of Karol Wojtyła, Pope John Paul II, now a museum.' },
  { id: 'kalwaria', name: 'Kalwaria Zebrzydowska', cat: 'daytrip', zone: 'out', lat: 49.86082, lon: 19.67141, minutes: 240, priority: 1, blurb: 'A 17th-century Mannerist pilgrimage park of chapels and churches, a UNESCO World Heritage Site.' },
  { id: 'bochnia', name: 'Bochnia Salt Mine', local: 'Kopalnia Soli Bochnia', cat: 'daytrip', zone: 'out', lat: 49.97019, lon: 20.43144, address: 'Solna, Bochnia', minutes: 240, priority: 1, blurb: 'A historic salt mine in Bochnia, east of Kraków.' },
  { id: 'pieskowa-skala', name: 'Pieskowa Skała Castle', local: 'Zamek Pieskowa Skała', cat: 'daytrip', zone: 'out', lat: 50.24418, lon: 19.78008, minutes: 180, priority: 1, blurb: 'A Renaissance castle on a limestone cliff in Ojców National Park, 27 km from Kraków.' },
  { id: 'ogrodzieniec', name: 'Ogrodzieniec Castle', local: 'Zamek Ogrodzieniec', cat: 'daytrip', zone: 'out', lat: 50.45317, lon: 19.55289, address: 'Zamkowa, Podzamcze', minutes: 300, priority: 1, blurb: 'Ruins of a medieval castle on the highest hill of the Kraków-Częstochowa Upland, on the Trail of the Eagles’ Nests.' },
  { id: 'jasna-gora', name: 'Jasna Góra Monastery', local: 'Jasna Góra', cat: 'daytrip', zone: 'out', lat: 50.81276, lon: 19.09712, minutes: 480, priority: 1, blurb: 'A pilgrimage shrine in Częstochowa, home of the Black Madonna icon.' },
  { id: 'morskie-oko', name: 'Morskie Oko', cat: 'daytrip', zone: 'out', lat: 49.19738, lon: 20.07072, minutes: 600, priority: 1, blurb: 'The largest lake in the Tatra Mountains, inside Tatra National Park.' },
  { id: 'niedzica', name: 'Niedzica Castle', local: 'Zamek Dunajec', cat: 'daytrip', zone: 'out', lat: 49.42253, lon: 20.31966, minutes: 480, priority: 1, blurb: 'A castle in the Pieniny mountains, built in 1320–1326.' },
  { id: 'chocholow-termy', name: 'Chochołów Thermal Baths', local: 'Chochołowskie Termy', cat: 'daytrip', zone: 'out', lat: 49.35183, lon: 19.82391, minutes: 300, priority: 1, blurb: 'A thermal pool complex in Chochołów, near Zakopane.' },
];

export type ExperienceKind = 'extreme' | 'sightseeing' | 'food' | 'water' | 'night';

export interface Experience {
  id: string;
  name: string;
  note: string;
  /** Discover filter group; 'extreme' also covers games and adrenaline (paintball, karts, escape rooms) */
  kind: ExperienceKind;
  /** typical length, only where the note states it ("half-day" = 240) */
  minutes?: number;
  /** true only where the note says hotel pickup is included */
  pickup?: boolean;
  season?: string;
  booking: Booking;
}

export const experiences: Experience[] = [
  { id: 'shooting', name: 'Shooting range', note: 'Usually with hotel pickup.', kind: 'extreme', pickup: true, booking: tour('Krakow shooting range') },
  { id: 'quads', name: 'Quad biking off-road', note: 'Half-day trips outside the city.', kind: 'extreme', minutes: 240, booking: tour('Krakow quad bike tour') },
  { id: 'pierogi', name: 'Pierogi cooking class', note: 'Make and eat Polish dumplings.', kind: 'food', booking: tour('Krakow pierogi cooking class') },
  { id: 'chopin', name: 'Chopin concert', note: 'Evening recitals in the Old Town.', kind: 'night', booking: tour('Chopin concert Krakow') },
  { id: 'rafting', name: 'Dunajec River rafting', note: 'Wooden rafts through the Pieniny gorge.', kind: 'water', season: 'Spring to autumn', booking: tour('Dunajec rafting from Krakow') },
  { id: 'balloon', name: 'Hot air balloon flight', note: 'Weather dependent, early starts.', kind: 'extreme', booking: tour('Krakow hot air balloon') },
  { id: 'sleigh', name: 'Sleigh ride with bonfire', note: 'In the mountains near Zakopane.', kind: 'sightseeing', season: 'Winter', booking: tour('Zakopane sleigh ride') },
  // added 21.09.2026 from 02_dane/LISTA_ATRAKCJI_KURATORSKA.md; notes say only what the activity is, not prices or pickups
  { id: 'paintball', name: 'Paintball', note: 'Team games on an outdoor field.', kind: 'extreme', booking: tour('Krakow paintball') },
  { id: 'karting', name: 'Go-karting', note: 'Races on a kart track.', kind: 'extreme', booking: tour('Krakow go karting') },
  { id: 'escape-room', name: 'Escape room', note: 'Solve puzzles against the clock, in a team.', kind: 'extreme', booking: tour('Krakow escape room') },
  { id: 'pub-crawl', name: 'Pub crawl', note: 'An evening round of bars with a guide and a group.', kind: 'night', booking: tour('Krakow pub crawl') },
  { id: 'vodka-tasting', name: 'Vodka tasting', note: 'Polish vodkas with snacks. Adults only.', kind: 'food', booking: tour('Krakow vodka tasting') },
  { id: 'food-tour', name: 'Food tour', note: 'Polish dishes tasted with a local guide.', kind: 'food', booking: tour('Krakow food tour') },
  { id: 'jewish-tour', name: 'Jewish Kraków with a guide', note: 'Kazimierz and Podgórze, their history and people.', kind: 'sightseeing', booking: tour('Jewish Krakow guided tour') },
  { id: 'nowa-huta-tour', name: 'Nowa Huta communism tour', note: 'The socialist-era district, often by Trabant.', kind: 'sightseeing', booking: tour('Nowa Huta communism tour') },
  { id: 'river-cruise', name: 'Vistula river cruise', note: 'Past Wawel by boat from the Vistula Boulevards.', kind: 'water', booking: tour('Krakow Vistula river cruise') },
  // added 23.09.2026 for the Discover screen: GetYourGuide searches only, no prices, no durations
  { id: 'golf-cart', name: 'Golf cart city tour', note: 'Old Town and Kazimierz by electric cart with a guide.', kind: 'sightseeing', booking: tour('Krakow golf cart tour') },
  { id: 'wieliczka-tour', name: 'Wieliczka Salt Mine guided tour', note: 'Guided route through the UNESCO-listed salt mine near Kraków.', kind: 'sightseeing', booking: tour('Wieliczka Salt Mine guided tour from Krakow') },
];

export const placeById = (id: string) => places.find((p) => p.id === id);
