import { ImageSourcePropType } from 'react-native';

export interface LensLayer {
  key: string;
  /** label on the epoch ruler */
  year: string;
  title: string;
  credit: string;
  license: string;
  sourceUrl: string;
  image: ImageSourcePropType | null;
}

export interface LensPoint {
  id: string;
  name: string;
  where: string;
  lat: number;
  lon: number;
  /** a present-day reference photo for trying the lens without a camera */
  reference?: { image: ImageSourcePropType; credit: string; license: string; sourceUrl: string };
  layers: LensLayer[];
}

const NOW: LensLayer = {
  key: 'now',
  year: 'Now',
  title: 'Today',
  credit: '',
  license: '',
  sourceUrl: '',
  image: null,
};

// Every image below: Wikimedia Commons, metadata checked 14.09.2026 (02_dane/media_pd/media_assets.json).
// Overlays are not aligned to the camera view yet. The viewer lines them up by dragging (stage TL1).
export const lensPoints: LensPoint[] = [
  {
    id: 'cloth-hall',
    name: 'Cloth Hall',
    where: 'Main Square, facing the Cloth Hall',
    lat: 50.0613,
    lon: 19.9379,
    reference: {
      image: require('../../assets/lens/rynek_2015.jpg'),
      credit: 'Fred Romero, 2015',
      license: 'CC BY 2.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Krak%C3%B3w_-_Rynek_G%C5%82%C3%B3wny.jpg',
    },
    layers: [
      {
        key: 'sukiennice-1870',
        year: '1870',
        title: 'Cloth Hall with cabs and market stalls',
        credit: 'Ignacy Krieger, 1870',
        license: 'Public domain',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:1870_Sukiennice,_doro%C5%BCki_i_Kramy_Bogate,_Fot._Ignacy_Krieger,_BPK.jpg',
        image: require('../../assets/lens/sukiennice_1870.jpg'),
      },
      {
        key: 'sukiennice-1880',
        year: 'c.1880',
        title: 'Cloth Hall, west side',
        credit: 'Ignacy Krieger, c. 1880',
        license: 'Public domain',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sukiennice,_strona_zachodnia_ca_1880_(31538542).jpg',
        image: require('../../assets/lens/sukiennice_1880_w.jpg'),
      },
      NOW,
    ],
  },
  {
    id: 'wawel',
    name: 'Wawel Hill',
    where: 'Vistula Boulevards, looking up at Wawel',
    lat: 50.0536,
    lon: 19.9331,
    layers: [
      {
        key: 'wawel-16c',
        year: '1500s',
        title: 'Wawel at the end of the 16th century',
        credit: 'Georg Braun and Frans Hogenberg, published 1617',
        license: 'Public domain',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wawel_end_16th_cent.jpg',
        image: require('../../assets/lens/wawel_16c.jpg'),
      },
      NOW,
    ],
  },
  {
    id: 'skyline',
    name: 'Old Town skyline',
    where: 'Vistula Boulevards, looking north',
    lat: 50.0549,
    lon: 19.9317,
    layers: [
      {
        key: 'cracovia-1493',
        year: '1493',
        title: 'Cracovia in the Nuremberg Chronicle',
        credit: 'Michael Wolgemut and Wilhelm Pleydenwurff, 1493',
        license: 'Public domain',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Nuremberg_chronicles_-_CRACOVIA.png',
        image: require('../../assets/lens/cracovia_1493.jpg'),
      },
      {
        key: 'krakow-1617',
        year: '1617',
        title: 'View of Kraków',
        credit: 'Abraham Hogenberg after Joris Hoefnagel, 1617',
        license: 'Public domain',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hogenberg_View_of_Krak%C3%B3w.jpg',
        image: require('../../assets/lens/wawel_1617.jpg'),
      },
      {
        key: 'cracovia-1618',
        year: '1618',
        title: 'Cracovia, capital of the Kingdom of Poland',
        credit: 'Georg Braun, 1618',
        license: 'Public domain',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Cracovia_Metropolis_Regni_Poloniae._1618_(middle_size)_(55759065).jpg',
        image: require('../../assets/lens/cracovia_1618.jpg'),
      },
      NOW,
    ],
  },
];

export const lensById = (id: string) => lensPoints.find((l) => l.id === id);
