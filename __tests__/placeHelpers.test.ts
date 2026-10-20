import { describe, expect, it } from '@jest/globals';
import about from '../src/data/placeAbout.json';
import { firstSentence } from '../src/components/placeName';
import { placeById, places } from '../src/data/places';
import { weekHours } from '../src/lib/hours';
import { Timetable, nearbyTramStopsIn } from '../src/lib/transit';

describe('weekHours', () => {
  it('gives Monday to Sunday for the month of the date', () => {
    const week = weekHours('czartoryski', new Date(2026, 9, 14));
    expect(week).toHaveLength(7);
    expect(week![0]).toEqual([]); // closed on Mondays
    expect(week![1]).toEqual([[600, 1080]]);
  });

  it('follows the season of the given month', () => {
    expect(weekHours('barbican', new Date(2027, 0, 20))!.every((d) => d.length === 0)).toBe(true);
    expect(weekHours('barbican', new Date(2027, 5, 20))!.some((d) => d.length > 0)).toBe(true);
  });

  it('is null for places without hours', () => {
    expect(weekHours('main-square', new Date(2026, 9, 14))).toBeNull();
  });
});

describe('nearbyTramStopsIn', () => {
  const tt: Timetable = {
    stops: [
      ['Near', 50.0605, 19.94],
      ['Middle', 50.0625, 19.94],
      ['Far', 50.09, 19.94],
    ],
    patterns: [
      { r: '8', h: 'Far', s: [0, 1, 2], t: [0, 2, 6], d: 127, n: 50 },
      { r: '18', h: 'Near', s: [2, 0], t: [0, 7], d: 127, n: 40 },
      { r: '8', h: 'Near', s: [2, 1, 0], t: [0, 4, 6], d: 127, n: 50 },
    ],
  };
  const here = { lat: 50.06, lon: 19.94 };

  it('lists the closest stops within walking distance, nearest first, with their lines once each', () => {
    const stops = nearbyTramStopsIn(tt, here, { limit: 3, maxMetres: 700 });
    expect(stops.map((s) => s.name)).toEqual(['Near', 'Middle']);
    expect(stops[0].lines).toEqual(['8', '18']);
    expect(stops[1].lines).toEqual(['8']);
    expect(stops[0].metres).toBeLessThan(stops[1].metres);
  });

  it('respects the limit and the distance', () => {
    expect(nearbyTramStopsIn(tt, here, { limit: 1, maxMetres: 700 })).toHaveLength(1);
    expect(nearbyTramStopsIn(tt, here, { limit: 3, maxMetres: 30 })).toHaveLength(0);
  });

  it('works on the real timetable for a central place', () => {
    // real data: the Barbican has tram stops close by
    const barbican = placeById('barbican')!;
    const stops = nearbyTramStopsIn(undefined, barbican);
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[0].lines.length).toBeGreaterThan(0);
  });
});

describe('firstSentence', () => {
  it('cuts at the end of the first sentence', () => {
    expect(firstSentence('Bunkier Sztuki is a contemporary art gallery in Kraków. It opened in 1965.')).toBe('Bunkier Sztuki is a contemporary art gallery in Kraków.');
    expect(firstSentence('Is it open? Yes. Come in!')).toBe('Is it open?');
    expect(firstSentence('Wow! Really.')).toBe('Wow!');
    expect(firstSentence('He said “stop.” Then he left.')).toBe('He said “stop.”');
  });

  it('returns the whole text when there is no sentence end, and trims it', () => {
    expect(firstSentence('  A single sentence without a full stop  ')).toBe('A single sentence without a full stop');
    expect(firstSentence('')).toBe('');
    expect(firstSentence('Only one.')).toBe('Only one.');
  });

  it('does not cut after Polish abbreviations', () => {
    expect(firstSentence('Kościół św. Wojciecha – zabytkowy kościół na Rynku Głównym. Pierwotnie romański.')).toBe('Kościół św. Wojciecha – zabytkowy kościół na Rynku Głównym.');
    expect(firstSentence('Teatr im. Juliusza Słowackiego w Krakowie – teatr, otwarty w 1893. Od 1909 w nowym budynku.')).toBe(
      'Teatr im. Juliusza Słowackiego w Krakowie – teatr, otwarty w 1893.',
    );
    expect(firstSentence('Muzeum Przyrodnicze mieści się przy ul. Sebastiana 9. Znajduje się tu mamut.')).toBe('Muzeum Przyrodnicze mieści się przy ul. Sebastiana 9.');
    expect(firstSentence('Kopiec stoi na Górze św. Bronisławy na Zwierzyńcu. Ma 34 m.')).toBe('Kopiec stoi na Górze św. Bronisławy na Zwierzyńcu.');
    expect(firstSentence('Muzeum na os. Szkolnym 37 w Nowej Hucie. Wystawa stała.')).toBe('Muzeum na os. Szkolnym 37 w Nowej Hucie.');
    expect(firstSentence('Plac Centralny im. Ronalda Reagana – plac w Nowej Hucie. Jest węzłem.')).toBe('Plac Centralny im. Ronalda Reagana – plac w Nowej Hucie.');
    expect(firstSentence('Galeria przy pl. Szczepańskim 3a. Zobacz więcej.')).toBe('Galeria przy pl. Szczepańskim 3a.');
    expect(firstSentence('Zbudowano m.in. Sukiennice i ratusz. Reszta później.')).toBe('Zbudowano m.in. Sukiennice i ratusz.');
    expect(firstSentence('To tzw. Kopiec Krakusa na wzgórzu. Dalej.')).toBe('To tzw. Kopiec Krakusa na wzgórzu.');
    expect(firstSentence('Ufundowali go oo. Franciszkanie w 1237. Potem odbudowany.')).toBe('Ufundowali go oo. Franciszkanie w 1237.');
  });

  it('does not cut after German or English abbreviations', () => {
    expect(firstSentence('Die Kirche St. Franziskus von Assisi wurde 1237 geweiht. Sie ist gotisch.')).toBe('Die Kirche St. Franziskus von Assisi wurde 1237 geweiht.');
    expect(firstSentence('Die Peter-und-Paul-Kirche befindet sich an der ul. Grodzka 52a und ist berühmt. Sie ist barock.')).toBe(
      'Die Peter-und-Paul-Kirche befindet sich an der ul. Grodzka 52a und ist berühmt.',
    );
    expect(firstSentence('Der Bischofspalast in Krakau, ul. Kanonicza 17, ist eine Zweigstelle. Er ist alt.')).toBe(
      'Der Bischofspalast in Krakau, ul. Kanonicza 17, ist eine Zweigstelle.',
    );
    expect(firstSentence('Hl. Johannes war hier. Danach nicht mehr.')).toBe('Hl. Johannes war hier.');
    expect(firstSentence('Das ist z.B. ein Beispiel. Ende.')).toBe('Das ist z.B. ein Beispiel.');
    expect(firstSentence('Die Veranstaltung beginnt am 3. Mai in Krakau. Eintritt frei.')).toBe('Die Veranstaltung beginnt am 3. Mai in Krakau.');
    expect(firstSentence('Das Haus wurde im 19. Jahrhundert gebaut. Es ist alt.')).toBe('Das Haus wurde im 19. Jahrhundert gebaut.');
    expect(firstSentence('Dr. Anna Nowak leads the tour. It starts at nine.')).toBe('Dr. Anna Nowak leads the tour.');
    expect(firstSentence('The church of St. Mary stands on the square. It is brick.')).toBe('The church of St. Mary stands on the square.');
  });

  it('does not cut after an initial or a century', () => {
    expect(firstSentence('Dom Jana Matejki, J. Matejko mieszkał tu całe życie. Dziś muzeum.')).toBe('Dom Jana Matejki, J. Matejko mieszkał tu całe życie.');
    expect(firstSentence('Kościół z XV w. Wojciecha stoi do dziś. Jest otwarty.')).toBe('Kościół z XV w. Wojciecha stoi do dziś.');
  });

  it('never ends a description of the app on an abbreviation', () => {
    const ABBREVIATION_END = /(?:\b(?:św|ul|im|pl|al|ok|tzw|oo|St|Dr|Hl|Sts)|m\.in|z\.B|\s\p{Lu})\.$/u;
    const texts: string[] = places.map((p) => p.blurb);
    for (const entry of Object.values(about as Record<string, Record<string, { text: string } | string>>)) {
      for (const lead of Object.values(entry)) if (typeof lead !== 'string') texts.push(lead.text);
    }
    expect(texts.length).toBeGreaterThan(300);
    expect(texts.filter((text) => ABBREVIATION_END.test(firstSentence(text))).map((text) => firstSentence(text))).toEqual([]);
  });
});
