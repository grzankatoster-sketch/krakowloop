import { ImageSourcePropType } from 'react-native';
import { t } from '../i18n';

export interface LensLayer {
  key: string;
  /** label on the year button */
  year: string;
  title: string;
  credit: string;
  license: string;
  sourceUrl: string;
  image: ImageSourcePropType;
  /**
   * photo: a photograph of the place, switched with today's photo ·
   * artwork: an engraving or drawing, often a bird's-eye view, shown on its own
   */
  kind: 'photo' | 'artwork';
}

export interface LensPoint {
  id: string;
  name: string;
  where: string;
  lat: number;
  lon: number;
  /** the place today, shown next to the old pictures without needing a camera */
  reference?: { image: ImageSourcePropType; title: string; credit: string; license: string; sourceUrl: string };
  layers: LensLayer[];
}

// Every image: Wikimedia Commons. Old pictures checked 14.09.2026 (02_dane/media_pd/media_assets.json),
// today's photos 17.09.2026 (02_dane/media_pd/lens_today.json).
export const lensPoints: LensPoint[] = [
  {
    id: 'cloth-hall',
    name: 'Cloth Hall',
    where: 'Main Square, facing the Cloth Hall',
    lat: 50.0613,
    lon: 19.9379,
    reference: {
      image: require('../../assets/lens/cloth_hall_today.jpg'),
      title: 'The Cloth Hall and the Main Square today, seen from above',
      credit: 'Jorge Lascar, 2012',
      license: 'CC BY 2.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sukiennice_and_Main_Market_Square_Krakow_Poland.JPG',
    },
    layers: [
      {
        key: 'sukiennice-1870',
        year: '1870',
        title: 'Cloth Hall with cabs and market stalls',
        credit: 'Ignacy Krieger, 1870 (cropped)',
        license: 'Public domain',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:1870_Sukiennice,_doro%C5%BCki_i_Kramy_Bogate,_Fot._Ignacy_Krieger,_BPK.jpg',
        image: require('../../assets/lens/sukiennice_1870_crop.jpg'),
        kind: 'photo',
      },
      {
        key: 'sukiennice-1880',
        year: 'c.1880',
        title: 'Cloth Hall, west side',
        credit: 'Ignacy Krieger, c. 1880 (cropped)',
        license: 'Public domain',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sukiennice,_strona_zachodnia_ca_1880_(31538542).jpg',
        image: require('../../assets/lens/sukiennice_1880_crop.jpg'),
        kind: 'photo',
      },
    ],
  },
  {
    id: 'wawel',
    name: 'Wawel Hill',
    where: 'Vistula Boulevards, looking up at Wawel',
    lat: 50.0536,
    lon: 19.9331,
    reference: {
      image: require('../../assets/lens/wawel_today.jpg'),
      title: 'Wawel from the Vistula today',
      credit: 'Stanislau 93, 2014',
      license: 'CC BY-SA 3.0 pl',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wawel_on_Wisla.JPG',
    },
    layers: [
      {
        key: 'wawel-1900',
        year: '1900',
        title: 'Wawel and the bend of the Vistula, with river boats',
        credit: 'Natan Krieger, 1900',
        license: 'Public domain',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:1900_Zakole_Wis%C5%82y_i_Wawel,_Fot._Natan_Krieger,_Biblioteka_PAN.jpg',
        image: require('../../assets/lens/wawel_1900.jpg'),
        kind: 'photo',
      },
      {
        key: 'wawel-16c',
        year: '1617',
        title: 'Wawel at the end of the 16th century',
        credit: 'Georg Braun and Frans Hogenberg, published 1617',
        license: 'Public domain',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wawel_end_16th_cent.jpg',
        image: require('../../assets/lens/wawel_16c.jpg'),
        kind: 'artwork',
      },
    ],
  },
  {
    id: 'skyline',
    name: 'Old Town skyline',
    where: 'Vistula Boulevards, looking north',
    lat: 50.0549,
    lon: 19.9317,
    reference: {
      image: require('../../assets/lens/skyline_today.jpg'),
      title: 'The Vistula Boulevards today',
      credit: 'Igor123121, 2025',
      license: 'CC BY 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:2025,_Krak%C3%B3w,_Bulwary_Wi%C5%9Blane_w_Krakowie.jpg',
    },
    layers: [
      {
        key: 'cracovia-1493',
        year: '1493',
        title: 'Cracovia in the Nuremberg Chronicle',
        credit: 'Michael Wolgemut and Wilhelm Pleydenwurff, 1493',
        license: 'Public domain',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Nuremberg_chronicles_-_CRACOVIA.png',
        image: require('../../assets/lens/cracovia_1493.jpg'),
        kind: 'artwork',
      },
      {
        key: 'krakow-1617',
        year: '1617',
        title: 'View of Kraków',
        credit: 'Abraham Hogenberg after Joris Hoefnagel, 1617',
        license: 'Public domain',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hogenberg_View_of_Krak%C3%B3w.jpg',
        image: require('../../assets/lens/wawel_1617.jpg'),
        kind: 'artwork',
      },
      {
        key: 'cracovia-1618',
        year: '1618',
        title: 'Cracovia, capital of the Kingdom of Poland',
        credit: 'Georg Braun, 1618',
        license: 'Public domain',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cracovia_Metropolis_Regni_Poloniae._1618_(middle_size)_(55759065).jpg',
        image: require('../../assets/lens/cracovia_1618.jpg'),
        kind: 'artwork',
      },
    ],
  },
];

export const lensById = (id: string) => lensPoints.find((l) => l.id === id);

/** Which picture to show first: the oldest photo when there is one, otherwise today's photo. */
export const firstShown = (point: LensPoint): string => point.layers.find((l) => l.kind === 'photo')?.key ?? 'today';

/**
 * Why the camera cannot be used here, in words for the traveller, or null when it can be tried.
 * Web browsers only offer the camera on secure (https) pages; native apps always may ask.
 */
export function cameraProblem(env: { web: boolean; secure: boolean; mediaDevices: boolean }): string | null {
  if (!env.web) return null;
  if (!env.secure) return t('lens.needHttps');
  if (!env.mediaDevices) return t('lens.noCamera');
  return null;
}
