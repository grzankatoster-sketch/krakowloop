/**
 * Landmark building models cut from the GUGiK LoD2 building models (2017), CC BY 4.0, by
 * scripts/3d/extract-landmarks.mjs. The files sit in public/models/<id>.glb; each model is in metres
 * around its point, ground at zero. The Barbican and St Florian's Gate are not buildings in that data.
 */
export interface Landmark3d {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const LANDMARKS_3D: Landmark3d[] = [
  { id: 'cloth-hall', name: 'Cloth Hall', lat: 50.0617, lon: 19.93736 },
  { id: 'st-marys', name: 'St Mary’s Basilica', lat: 50.06165, lon: 19.93945 },
  { id: 'town-hall-tower', name: 'Town Hall Tower', lat: 50.06147, lon: 19.93641 },
  { id: 'wawel-cathedral', name: 'Wawel Cathedral', lat: 50.05464, lon: 19.93548 },
  { id: 'wawel-castle', name: 'Wawel Royal Castle', lat: 50.05441, lon: 19.93656 },
];

export const LANDMARKS_3D_CREDIT = 'Landmark 3D models: GUGiK, building models LoD2 (2017), CC BY 4.0';
