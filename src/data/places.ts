import { getYourGuideSearch } from '../config/affiliates';

export type Category =
  | 'history'
  | 'museum'
  | 'jewish'
  | 'view'
  | 'food'
  | 'daytrip'
  | 'remembrance';

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
  /** typical visit length in minutes */
  minutes: number;
  priority: 1 | 2 | 3;
  blurb: string;
  lensId?: string;
  booking?: Booking;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  history: 'Sights',
  museum: 'Museums',
  jewish: 'Jewish heritage',
  view: 'Views & parks',
  food: 'Food & nights',
  daytrip: 'Day trips',
  remembrance: 'Remembrance',
};

export const ZONE_LABEL: Record<Zone, string> = {
  'old-town': 'Old Town',
  wawel: 'Wawel',
  kazimierz: 'Kazimierz',
  podgorze: 'Podgórze',
  city: 'Greater Kraków',
  out: 'Outside Kraków',
};

const tour = (q: string): Booking => ({ label: 'Tours on GetYourGuide', ...getYourGuideSearch(q) });
const official = (label: string, url: string): Booking => ({ label, url, affiliate: false });

// Coordinates: OpenStreetMap (Overpass / Nominatim), 14.09.2026. Blurbs: to be fact-checked (BK1).
export const places: Place[] = [
  // Old Town
  { id: 'main-square', name: 'Main Square', local: 'Rynek Główny', cat: 'history', zone: 'old-town', lat: 50.0615, lon: 19.93735, minutes: 30, priority: 3, blurb: 'One of the largest medieval market squares in Europe, laid out after the town charter of 1257.', lensId: 'cloth-hall', booking: tour('Krakow Old Town walking tour') },
  { id: 'cloth-hall', name: 'Cloth Hall', local: 'Sukiennice', cat: 'history', zone: 'old-town', lat: 50.0617, lon: 19.93736, minutes: 45, priority: 3, blurb: 'A trading hall since the Middle Ages, remodelled in the 1870s. Upstairs is a gallery of 19th-century Polish painting.', lensId: 'cloth-hall' },
  { id: 'st-marys', name: "St Mary's Basilica", local: 'Bazylika Mariacka', cat: 'history', zone: 'old-town', lat: 50.06165, lon: 19.93945, minutes: 45, priority: 3, blurb: "Home to Veit Stoss's carved wooden altarpiece. A trumpet call, the hejnał, sounds from the tower every hour." },
  { id: 'town-hall-tower', name: 'Town Hall Tower', local: 'Wieża Ratuszowa', cat: 'history', zone: 'old-town', lat: 50.06147, lon: 19.93641, minutes: 30, priority: 2, blurb: 'All that is left of the town hall, which was demolished in the 1820s.' },
  { id: 'rynek-underground', name: 'Rynek Underground', local: 'Rynek Podziemny', cat: 'museum', zone: 'old-town', lat: 50.062, lon: 19.93778, minutes: 90, priority: 3, blurb: 'A museum under the square, built around excavated medieval stalls and streets.', booking: tour('Rynek Underground') },
  { id: 'st-adalbert', name: "St Adalbert's Church", local: 'Kościół św. Wojciecha', cat: 'history', zone: 'old-town', lat: 50.06089, lon: 19.93774, minutes: 15, priority: 1, blurb: 'A small Romanesque church, older than the square around it.' },
  { id: 'florian-gate', name: "St Florian's Gate", local: 'Brama Floriańska', cat: 'history', zone: 'old-town', lat: 50.06486, lon: 19.94135, minutes: 15, priority: 3, blurb: 'The main gate in the old city walls, where the Royal Route to Wawel begins.' },
  { id: 'barbican', name: 'Barbican', local: 'Barbakan', cat: 'history', zone: 'old-town', lat: 50.06546, lon: 19.94163, minutes: 20, priority: 2, blurb: 'A round brick outwork that once guarded the approach to the Florian Gate.' },
  { id: 'collegium-maius', name: 'Collegium Maius', cat: 'museum', zone: 'old-town', lat: 50.06165, lon: 19.9337, minutes: 60, priority: 2, blurb: 'The oldest surviving building of the Jagiellonian University, where Copernicus studied.' },
  { id: 'czartoryski', name: 'Czartoryski Museum', local: 'Muzeum Książąt Czartoryskich', cat: 'museum', zone: 'old-town', lat: 50.06481, lon: 19.94023, minutes: 90, priority: 3, blurb: "Home of Leonardo da Vinci's Lady with an Ermine." },
  { id: 'franciscan', name: 'Franciscan Basilica', local: 'Bazylika Franciszkanów', cat: 'history', zone: 'old-town', lat: 50.05921, lon: 19.9361, minutes: 30, priority: 2, blurb: "Known for Stanisław Wyspiański's Art Nouveau stained glass and wall paintings." },
  { id: 'dominican', name: 'Dominican Basilica', local: 'Bazylika Dominikanów', cat: 'history', zone: 'old-town', lat: 50.0593, lon: 19.93943, minutes: 30, priority: 1, blurb: 'A Gothic church and monastery on Stolarska Street.' },
  { id: 'sts-peter-paul', name: 'Church of Sts Peter and Paul', local: 'Kościół śś. Piotra i Pawła', cat: 'history', zone: 'old-town', lat: 50.05693, lon: 19.93906, minutes: 20, priority: 2, blurb: 'An early Baroque church on Grodzka Street, with statues of the apostles out front.' },
  { id: 'st-andrew', name: "St Andrew's Church", local: 'Kościół św. Andrzeja', cat: 'history', zone: 'old-town', lat: 50.05659, lon: 19.93843, minutes: 15, priority: 1, blurb: 'A fortress-like Romanesque church from the late 11th century.' },
  { id: 'kanonicza', name: 'Kanonicza Street', local: 'ul. Kanonicza', cat: 'history', zone: 'old-town', lat: 50.05621, lon: 19.93738, minutes: 15, priority: 2, blurb: 'A quiet, curving street of old canons’ houses below Wawel Hill.' },
  { id: 'small-square', name: 'Small Market Square', local: 'Mały Rynek', cat: 'history', zone: 'old-town', lat: 50.06121, lon: 19.94032, minutes: 10, priority: 1, blurb: "A calmer square just behind St Mary's." },
  { id: 'hipolit-house', name: 'Hipolit House', local: 'Kamienica Hipolitów', cat: 'museum', zone: 'old-town', lat: 50.06195, lon: 19.94012, minutes: 45, priority: 1, blurb: 'Rooms furnished as a wealthy Kraków home through the centuries.' },
  { id: 'pharmacy-museum', name: 'Museum of Pharmacy', local: 'Muzeum Farmacji UJ', cat: 'museum', zone: 'old-town', lat: 50.06323, lon: 19.94033, minutes: 45, priority: 1, blurb: 'Old apothecaries recreated in a historic townhouse.' },
  { id: 'slowacki-theatre', name: 'Słowacki Theatre', local: 'Teatr im. Juliusza Słowackiego', cat: 'history', zone: 'old-town', lat: 50.06395, lon: 19.94305, minutes: 10, priority: 1, blurb: 'An eclectic theatre opened in 1893, inspired by the Paris Opera.' },
  { id: 'planty', name: 'Planty Park', local: 'Planty', cat: 'view', zone: 'old-town', lat: 50.06021, lon: 19.94191, minutes: 20, priority: 2, blurb: 'A ring of parkland where the medieval walls once stood.' },
  // Museums added 15.09.2026: coordinates from the OSM export, blurbs from Wikipedia/Wikidata or the museum's own site (03_research/MUZEA_ZRODLA.md)
  { id: 'bunkier-sztuki', name: 'Bunkier Sztuki Gallery', local: 'Bunkier Sztuki', cat: 'museum', zone: 'old-town', lat: 50.06358, lon: 19.93445, minutes: 45, priority: 1, blurb: 'A contemporary art gallery on Szczepański Square by the Planty, opened in 1965.' },
  { id: 'szolayski-house', name: 'Szołayski House', local: 'Kamienica Szołayskich', cat: 'museum', zone: 'old-town', lat: 50.06335, lon: 19.93596, minutes: 45, priority: 1, blurb: 'A National Museum branch in a corner townhouse on Szczepański Square, with permanent exhibitions on architecture and design.' },
  { id: 'archaeological-museum', name: 'Archaeological Museum', local: 'Muzeum Archeologiczne w Krakowie', cat: 'museum', zone: 'old-town', lat: 50.05756, lon: 19.93625, minutes: 60, priority: 1, blurb: 'Kraków’s archaeological museum, established in 1850.' },
  { id: 'ciolek-palace', name: 'Bishop Ciołek Palace', local: 'Pałac Biskupa Erazma Ciołka', cat: 'museum', zone: 'old-town', lat: 50.0563, lon: 19.93722, minutes: 60, priority: 1, blurb: 'A 16th-century palace on Kanonicza Street, a branch of the National Museum since 2007.' },
  { id: 'natural-history-museum', name: 'Natural History Museum', local: 'Muzeum Przyrodnicze PAN', cat: 'museum', zone: 'old-town', lat: 50.05547, lon: 19.94151, minutes: 45, priority: 1, blurb: 'Home to a woolly rhinoceros preserved whole, the only complete specimen of this extinct animal in the world.' },
  { id: 'krzysztofory', name: 'Krzysztofory Palace', local: 'Pałac Krzysztofory', cat: 'museum', zone: 'old-town', lat: 50.06277, lon: 19.9365, minutes: 60, priority: 1, blurb: 'A historic palace on the corner of the Main Square, the main seat of the Museum of Kraków.' },
  // Wawel
  { id: 'wawel-castle', name: 'Wawel Royal Castle', local: 'Zamek Królewski na Wawelu', cat: 'museum', zone: 'wawel', lat: 50.05441, lon: 19.93656, minutes: 150, priority: 3, blurb: 'The residence of Polish kings, with state rooms, a treasury and an armoury.', lensId: 'wawel', booking: tour('Wawel Castle guided tour') },
  { id: 'wawel-cathedral', name: 'Wawel Cathedral', local: 'Katedra Wawelska', cat: 'history', zone: 'wawel', lat: 50.05464, lon: 19.93548, minutes: 60, priority: 3, blurb: 'Coronation and burial church of Polish kings. You can climb up to the Sigismund Bell.' },
  { id: 'dragons-den', name: "Dragon's Den", local: 'Smocza Jama', cat: 'history', zone: 'wawel', lat: 50.05342, lon: 19.93358, minutes: 20, priority: 2, blurb: 'A cave under Wawel Hill. At the exit stands a dragon statue that breathes fire.' },
  { id: 'boulevards', name: 'Vistula Boulevards', local: 'Bulwary Wiślane', cat: 'view', zone: 'wawel', lat: 50.05491, lon: 19.93168, minutes: 30, priority: 2, blurb: 'Riverside paths below Wawel, good for a sunset walk or a boat trip.', lensId: 'skyline', booking: tour('Krakow Vistula river cruise') },
  { id: 'cathedral-museum', name: 'Cathedral Museum', local: 'Muzeum Katedralne im. Jana Pawła II', cat: 'museum', zone: 'wawel', lat: 50.05466, lon: 19.9345, minutes: 30, priority: 1, blurb: 'The cathedral’s museum, in two 14th-century buildings beside the Vasa Gate on Wawel Hill.' },
  // Kazimierz
  { id: 'old-synagogue', name: 'Old Synagogue', local: 'Stara Synagoga', cat: 'jewish', zone: 'kazimierz', lat: 50.05137, lon: 19.94861, minutes: 45, priority: 3, blurb: 'One of the oldest surviving synagogues in Poland, now a museum.' },
  { id: 'remuh', name: 'Remuh Synagogue and Cemetery', local: 'Synagoga Remuh', cat: 'jewish', zone: 'kazimierz', lat: 50.05265, lon: 19.94728, minutes: 30, priority: 3, blurb: 'An active 16th-century synagogue with an old Jewish cemetery beside it.' },
  { id: 'tempel', name: 'Tempel Synagogue', local: 'Synagoga Tempel', cat: 'jewish', zone: 'kazimierz', lat: 50.05294, lon: 19.94444, minutes: 30, priority: 2, blurb: 'A 19th-century Reform synagogue with a richly painted interior.' },
  { id: 'plac-nowy', name: 'Plac Nowy', cat: 'food', zone: 'kazimierz', lat: 50.05174, lon: 19.94462, minutes: 30, priority: 3, blurb: 'The market square of Kazimierz. The round hall sells zapiekanki, a local open baguette. Busy with bars at night.', booking: tour('Krakow food tour Kazimierz') },
  { id: 'galicia-museum', name: 'Galicia Jewish Museum', local: 'Żydowskie Muzeum Galicja', cat: 'jewish', zone: 'kazimierz', lat: 50.05086, lon: 19.94968, minutes: 60, priority: 2, blurb: 'Photography and exhibitions about Jewish life and memory in southern Poland.' },
  { id: 'corpus-christi', name: 'Corpus Christi Basilica', local: 'Bazylika Bożego Ciała', cat: 'history', zone: 'kazimierz', lat: 50.04977, lon: 19.94498, minutes: 30, priority: 1, blurb: 'A large Gothic church founded when Kazimierz was still a separate town.' },
  { id: 'bernatka', name: 'Father Bernatek Footbridge', local: 'Kładka Ojca Bernatka', cat: 'view', zone: 'kazimierz', lat: 50.04656, lon: 19.9475, minutes: 10, priority: 2, blurb: 'A footbridge across the Vistula linking Kazimierz with Podgórze.' },
  { id: 'ethnographic-museum', name: 'Ethnographic Museum', local: 'Muzeum Etnograficzne im. Seweryna Udzieli', cat: 'museum', zone: 'kazimierz', lat: 50.04866, lon: 19.94349, minutes: 60, priority: 1, blurb: 'The Seweryn Udziela Ethnographic Museum in Kazimierz, first opened in 1911.' },
  { id: 'engineering-museum', name: 'Museum of Engineering and Technology', local: 'Muzeum Inżynierii i Techniki', cat: 'museum', zone: 'kazimierz', lat: 50.04951, lon: 19.9473, minutes: 90, priority: 2, blurb: 'Early trams, buses, motorcycles, radios and machines, in historic buildings on św. Wawrzyńca Street.' },
  // Podgórze
  { id: 'schindler', name: "Oskar Schindler's Factory", local: 'Fabryka Emalia Oskara Schindlera', cat: 'museum', zone: 'podgorze', lat: 50.04745, lon: 19.9617, minutes: 120, priority: 3, blurb: 'A museum of Kraków under German occupation, 1939–1945, in Schindler’s former factory. Tickets often sell out.' },
  { id: 'mocak', name: 'MOCAK', local: 'Muzeum Sztuki Współczesnej', cat: 'museum', zone: 'podgorze', lat: 50.04788, lon: 19.96137, minutes: 90, priority: 1, blurb: 'Museum of Contemporary Art, next door to Schindler’s Factory.' },
  { id: 'ghetto-heroes', name: 'Ghetto Heroes Square', local: 'Plac Bohaterów Getta', cat: 'remembrance', zone: 'podgorze', lat: 50.04672, lon: 19.95444, minutes: 20, priority: 2, blurb: 'A memorial of empty chairs on the square of the wartime ghetto.' },
  { id: 'eagle-pharmacy', name: 'Eagle Pharmacy', local: 'Apteka pod Orłem', cat: 'remembrance', zone: 'podgorze', lat: 50.04624, lon: 19.95415, minutes: 45, priority: 2, blurb: 'The pharmacy of Tadeusz Pankiewicz, who helped people in the ghetto. Now a museum.' },
  { id: 'krakus-mound', name: 'Krakus Mound', local: 'Kopiec Krakusa', cat: 'view', zone: 'podgorze', lat: 50.03808, lon: 19.95844, minutes: 40, priority: 2, blurb: 'An ancient mound with a wide view over the city.' },
  { id: 'podgorze-museum', name: 'Podgórze Museum', local: 'Muzeum Podgórza', cat: 'museum', zone: 'podgorze', lat: 50.04252, lon: 19.96098, minutes: 45, priority: 1, blurb: 'The history of Podgórze, a free royal town from 1784, told in old merchant buildings at 51 Limanowskiego Street. A Museum of Kraków branch.' },
  // Greater Kraków
  { id: 'kosciuszko-mound', name: 'Kościuszko Mound', local: 'Kopiec Kościuszki', cat: 'view', zone: 'city', lat: 50.05492, lon: 19.89335, minutes: 90, priority: 2, blurb: 'A mound raised in the 1820s to honour Tadeusz Kościuszko. On clear days you can see the Tatras.' },
  { id: 'national-museum', name: 'National Museum, Main Building', local: 'Muzeum Narodowe, Gmach Główny', cat: 'museum', zone: 'city', lat: 50.0604, lon: 19.9237, minutes: 120, priority: 1, blurb: 'The main building of the National Museum in Kraków.' },
  { id: 'manggha', name: 'Manggha Museum', local: 'Muzeum Manggha', cat: 'museum', zone: 'city', lat: 50.05087, lon: 19.93166, minutes: 60, priority: 1, blurb: 'Japanese art and technology, on the riverbank facing Wawel.' },
  { id: 'nowa-huta', name: 'Nowa Huta Central Square', local: 'Plac Centralny', cat: 'history', zone: 'city', lat: 50.07188, lon: 20.03807, minutes: 60, priority: 2, blurb: 'The centre of a socialist-realist planned town built from 1949.', booking: tour('Nowa Huta communism tour') },
  { id: 'ark-of-the-lord', name: 'Ark of the Lord Church', local: 'Arka Pana', cat: 'history', zone: 'city', lat: 50.08404, lon: 20.02993, minutes: 30, priority: 1, blurb: 'A modernist church built by Nowa Huta residents and consecrated in 1977.' },
  { id: 'divine-mercy', name: 'Divine Mercy Sanctuary', local: 'Sanktuarium Bożego Miłosierdzia', cat: 'history', zone: 'city', lat: 50.01906, lon: 19.9375, minutes: 60, priority: 1, blurb: 'A major pilgrimage site in Łagiewniki.' },
  { id: 'tyniec', name: 'Tyniec Abbey', local: 'Opactwo w Tyńcu', cat: 'history', zone: 'city', lat: 50.01845, lon: 19.8029, minutes: 120, priority: 1, blurb: 'A Benedictine abbey on a limestone cliff above the Vistula.' },
  { id: 'zakrzowek', name: 'Zakrzówek', cat: 'view', zone: 'city', lat: 50.04141, lon: 19.91833, minutes: 90, priority: 1, blurb: 'A former quarry lake with turquoise water and seasonal swimming pools.' },
  { id: 'aviation-museum', name: 'Polish Aviation Museum', local: 'Muzeum Lotnictwa Polskiego', cat: 'museum', zone: 'city', lat: 50.07885, lon: 19.99056, minutes: 120, priority: 1, blurb: 'Aircraft collection on the site of a former airfield.' },
  { id: 'mehoffer-house', name: 'Józef Mehoffer House', local: 'Dom Józefa Mehoffera', cat: 'museum', zone: 'city', lat: 50.06326, lon: 19.92842, minutes: 45, priority: 1, blurb: 'A National Museum branch devoted to the artist Józef Mehoffer, at 26 Krupnicza Street.' },
  { id: 'hutten-czapski', name: 'Emeryk Hutten-Czapski Museum', local: 'Muzeum im. Emeryka Hutten-Czapskiego', cat: 'museum', zone: 'city', lat: 50.05991, lon: 19.93017, minutes: 45, priority: 1, blurb: 'A branch of the National Museum in Kraków, also known as the Czapski Museum.' },
  { id: 'stained-glass-museum', name: 'Stained Glass Museum', local: 'Muzeum Witrażu', cat: 'museum', zone: 'city', lat: 50.05901, lon: 19.9257, minutes: 45, priority: 1, blurb: 'A museum inside a working stained glass studio founded in 1902, in the house built for it in 1908. Wyspiański and Mehoffer worked with the studio.' },
  { id: 'mufo', name: 'MuFo Museum of Photography', local: 'MuFo Rakowicka', cat: 'museum', zone: 'city', lat: 50.0704, lon: 19.95353, minutes: 60, priority: 1, blurb: 'The Walery Rzewuski Museum of Photography, a state-run museum and the only one of its kind when it was founded.' },
  { id: 'home-army-museum', name: 'Home Army Museum', local: 'Muzeum Armii Krajowej', cat: 'museum', zone: 'city', lat: 50.07239, lon: 19.94871, minutes: 90, priority: 2, blurb: 'A museum of the Polish Underground State and its army during World War II, opened in 2000.' },
  { id: 'cogiteon', name: 'Cogiteon Science Centre', local: 'Małopolskie Centrum Nauki Cogiteon', cat: 'museum', zone: 'city', lat: 50.08558, lon: 19.99044, minutes: 120, priority: 1, blurb: 'Małopolska’s science centre, built around hands-on experiments you do yourself or in a team.' },
  { id: 'pomorska-street', name: 'Pomorska Street Museum', local: 'Ulica Pomorska', cat: 'remembrance', zone: 'city', lat: 50.07069, lon: 19.92493, minutes: 45, priority: 1, blurb: 'The wartime Gestapo headquarters, where prisoners’ inscriptions survive on the walls of the basement cells. A Museum of Kraków branch.' },
  { id: 'celestat', name: 'Celestat', local: 'Celestat', cat: 'museum', zone: 'city', lat: 50.06545, lon: 19.94937, minutes: 30, priority: 1, blurb: 'The small palace where Kraków’s Fowler Brotherhood practised shooting, now a Museum of Kraków branch on the brotherhood’s history.' },
  { id: 'rydlowka', name: 'Rydlówka', local: 'Rydlówka', cat: 'museum', zone: 'city', lat: 50.08785, lon: 19.87805, minutes: 45, priority: 1, blurb: 'The manor house in Bronowice where the poet Lucjan Rydel married in 1900, the wedding Wyspiański turned into his play The Wedding.' },
  { id: 'nowa-huta-underground', name: 'Nowa Huta Underground', local: 'Podziemna Nowa Huta', cat: 'museum', zone: 'city', lat: 50.07653, lon: 20.05041, minutes: 60, priority: 1, blurb: 'One of the Museum of Kraków’s underground sites in Nowa Huta, at os. Szkolne 37, with the permanent exhibition State of Emergency.' },
  // Outside Kraków
  { id: 'wieliczka', trip: 'standard', name: 'Wieliczka Salt Mine', local: 'Kopalnia Soli Wieliczka', cat: 'daytrip', zone: 'out', lat: 49.98089, lon: 20.06124, minutes: 240, priority: 3, blurb: 'A UNESCO-listed salt mine with chapels carved out of salt, about 15 km from the centre.', booking: tour('Wieliczka Salt Mine') },
  { id: 'zakopane', trip: 'mountains', name: 'Zakopane and the Tatras', local: 'Zakopane', cat: 'daytrip', zone: 'out', lat: 49.29691, lon: 19.95048, minutes: 600, priority: 2, blurb: 'A mountain town at the foot of the Tatras, about two hours from Kraków.', booking: tour('Zakopane day trip from Krakow') },
  { id: 'ojcow', name: 'Ojców National Park', local: 'Ojcowski Park Narodowy', cat: 'daytrip', zone: 'out', lat: 50.21071, lon: 19.80857, minutes: 300, priority: 1, blurb: 'Limestone valleys and castles, north of Kraków.', booking: tour('Ojcow National Park') },
  { id: 'energylandia', name: 'Energylandia', cat: 'daytrip', zone: 'out', lat: 49.9994, lon: 19.40982, minutes: 480, priority: 1, blurb: 'One of the largest amusement parks in Poland, in Zator.', booking: tour('Energylandia from Krakow') },
  { id: 'auschwitz', trip: 'remembrance', name: 'Auschwitz-Birkenau Memorial', local: 'Państwowe Muzeum Auschwitz-Birkenau', cat: 'remembrance', zone: 'out', lat: 50.02934, lon: 19.20558, minutes: 420, priority: 3, blurb: 'The former German Nazi concentration and extermination camp, now a memorial and museum. Entry cards are issued only through the official website. Visits are not recommended for children under 14.', booking: official('Reserve on the official website', 'https://visit.auschwitz.org') },
];

export interface Experience {
  id: string;
  name: string;
  note: string;
  season?: string;
  booking: Booking;
}

export const experiences: Experience[] = [
  { id: 'shooting', name: 'Shooting range', note: 'Usually with hotel pickup.', booking: tour('Krakow shooting range') },
  { id: 'quads', name: 'Quad biking off-road', note: 'Half-day trips outside the city.', booking: tour('Krakow quad bike tour') },
  { id: 'pierogi', name: 'Pierogi cooking class', note: 'Make and eat Polish dumplings.', booking: tour('Krakow pierogi cooking class') },
  { id: 'chopin', name: 'Chopin concert', note: 'Evening recitals in the Old Town.', booking: tour('Chopin concert Krakow') },
  { id: 'rafting', name: 'Dunajec River rafting', note: 'Wooden rafts through the Pieniny gorge.', season: 'Spring to autumn', booking: tour('Dunajec rafting from Krakow') },
  { id: 'balloon', name: 'Hot air balloon flight', note: 'Weather dependent, early starts.', booking: tour('Krakow hot air balloon') },
  { id: 'sleigh', name: 'Sleigh ride with bonfire', note: 'In the mountains near Zakopane.', season: 'Winter', booking: tour('Zakopane sleigh ride') },
];

export const placeById = (id: string) => places.find((p) => p.id === id);
