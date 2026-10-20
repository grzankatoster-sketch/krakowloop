/**
 * Polish and German captions of the old pictures (src/data/lens.ts is written in English).
 * Only the words of the caption are translated. Names of people, works and institutions, years,
 * licences and sources stay exactly as in the data: the attribution must remain faithful. A credit
 * with nothing to translate (a name and a year) has no entry here and is shown as it is.
 *
 * Key: `<point id>/<layer key>`, or `<point id>/today` for the picture of the place today.
 */
export interface LensCaption {
  title: string;
  /** only where the credit has words besides names and numbers ("after", "and", "cropped") */
  credit?: string;
}

export type LensCaptionLang = 'pl' | 'de';

export const LENS_TEXT: Record<LensCaptionLang, Record<string, LensCaption>> = {
  pl: {
    'town-hall/today': {
      title: 'Ten sam widok dziś, z modelu 3D miasta (model, nie fotografia)',
      credit: 'GUGiK, budynki 3D LoD2 2017, wizualizacja: KrakowLoop',
    },
    'town-hall/ratusz-1800': {
      title: 'Rekonstrukcja: ratusz sprzed 1820 roku, na podstawie elewacji z 1851 roku i rzutu parteru (nie jest to widok)',
      credit: 'Rekonstrukcja KrakowLoop według: K. Balicki (1851), rzut parteru (tab. I), F. C. Dietrich (1820) i M. Stachowicz (1797); budynki: GUGiK LoD2',
    },
    'cloth-hall/today': { title: 'Sukiennice i Rynek Główny dziś, widziane z góry' },
    'cloth-hall/sukiennice-1870': { title: 'Sukiennice od północnego wschodu, z kramami przy murach', credit: 'Ignacy Krieger, ok. 1870 (wycinek)' },
    'cloth-hall/sukiennice-1880': { title: 'Sukiennice, strona zachodnia', credit: 'Ignacy Krieger, ok. 1880 (wycinek)' },
    'wawel/today': { title: 'Wawel znad Wisły dziś' },
    'wawel/wawel-1900': { title: 'Wawel i zakole Wisły, z łodziami rzecznymi' },
    'wawel/wawel-16c': { title: 'Wawel pod koniec XVI wieku', credit: 'Georg Braun i Frans Hogenberg, opublikowano w 1617' },
    'skyline/today': { title: 'Bulwary Wiślane dziś' },
    'skyline/cracovia-1493': { title: 'Cracovia w Kronice norymberskiej', credit: 'Michael Wolgemut i Wilhelm Pleydenwurff, 1493' },
    'skyline/krakow-1617': { title: 'Widok Krakowa', credit: 'Abraham Hogenberg według Joris Hoefnagel, 1617' },
    'skyline/cracovia-1618': { title: 'Cracovia, stolica Królestwa Polskiego' },
  },
  de: {
    'town-hall/today': {
      title: 'Dieselbe Ansicht heute, aus dem 3D-Modell der Stadt (ein Modell, kein Foto)',
      credit: 'GUGiK, 3D-Gebäude LoD2 2017, Darstellung: KrakowLoop',
    },
    'town-hall/ratusz-1800': {
      title: 'Rekonstruktion: das Rathaus vor 1820, nach den Aufrissen von 1851 und dem Grundriss (keine Ansicht)',
      credit: 'KrakowLoop-Rekonstruktion nach K. Balicki (1851), Grundriss (Taf. I), F. C. Dietrich (1820) und M. Stachowicz (1797); Gebäude: GUGiK LoD2',
    },
    'cloth-hall/today': { title: 'Die Tuchhallen und der Hauptmarkt heute, von oben gesehen' },
    'cloth-hall/sukiennice-1870': { title: 'Die Tuchhallen von Nordosten, mit den Buden an ihren Mauern', credit: 'Ignacy Krieger, um 1870 (Ausschnitt)' },
    'cloth-hall/sukiennice-1880': { title: 'Die Tuchhallen, Westseite', credit: 'Ignacy Krieger, um 1880 (Ausschnitt)' },
    'wawel/today': { title: 'Der Wawel von der Weichsel aus heute' },
    'wawel/wawel-1900': { title: 'Der Wawel und der Weichselbogen, mit Flussbooten' },
    'wawel/wawel-16c': { title: 'Der Wawel Ende des 16. Jahrhunderts', credit: 'Georg Braun und Frans Hogenberg, veröffentlicht 1617' },
    'skyline/today': { title: 'Die Weichselboulevards heute' },
    'skyline/cracovia-1493': { title: 'Cracovia in der Schedelschen Weltchronik', credit: 'Michael Wolgemut und Wilhelm Pleydenwurff, 1493' },
    'skyline/krakow-1617': { title: 'Ansicht von Krakau', credit: 'Abraham Hogenberg nach Joris Hoefnagel, 1617' },
    'skyline/cracovia-1618': { title: 'Cracovia, Hauptstadt des Königreichs Polen' },
  },
};
