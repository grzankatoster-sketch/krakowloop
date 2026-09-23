import { CITY } from '../config/city';
import { MAPBOX_TOKEN } from '../config/mapbox';
import { MAP_LOOK_CHOICE } from '../config/mapLook';
import { GLYPH_PATHS, Glyph } from '../data/categoryGlyph';
import { LANDMARKS_3D } from '../data/landmarks3d';
import { colors } from '../theme';

export interface MapPoint {
  id: string;
  lat: number;
  lon: number;
  color: string;
  /** stop number shown inside the marker (plans only) */
  order?: number;
  /**
   * place (default): tappable pin · me: the traveller or start point, not tappable ·
   * lens: a Time Lens viewpoint, tappable · stop: a tram stop, small and not tappable
   */
  kind?: 'me' | 'lens' | 'stop';
  /** name shown next to the marker when zoomed in */
  label?: string;
  /** category icon drawn inside the pin (badge and teardrop pins) */
  glyph?: Glyph;
  /** importance, 1–3: when pins crowd, zoomed out, the higher rank stays on the map */
  rank?: 1 | 2 | 3;
  /** faded, for a place that is closed at this moment (our own opening hours) */
  dim?: boolean;
}

export interface MapPayload {
  points: MapPoint[];
  route?: [number, number][];
  selectedId?: string | null;
  /** fit the view to the route or the points on every update (plans) */
  fit?: boolean;
  /** fit the view once each time this number changes (map screen) */
  fitKey?: number;
  /** what that fit shows: the route (default when there is one) or all places */
  fitTarget?: 'route' | 'points';
  /** the map flies here whenever `key` changes */
  focus?: { lat: number; lon: number; key: number } | null;
  /** tilted view with buildings in 3D */
  threeD?: boolean;
  /** the traveller asked for less motion: jump instead of flying, no fading or pulsing */
  calm?: boolean;
}

// Provider switch. With a public Mapbox token the map uses Mapbox Standard with 3D buildings;
// without one it falls back to MapLibre + OpenFreeMap, which needs no account. OpenFreeMap tiles
// carry OSM building heights (render_height), which we extrude for the 3D view.
const MAPBOX_GL_VERSION = '3.15.0';
const MAPLIBRE_GL_VERSION = '4.7.1';
/** covers the library download too: the watchdog starts before anything is fetched */
const LOAD_TIMEOUT_MS = 15000;

export const MAP_PROVIDER: 'mapbox' | 'openfreemap' = MAPBOX_TOKEN ? 'mapbox' : 'openfreemap';

/** Mapbox basemaps to choose from (src/config/mapLook.ts). Standard themes are set through its config. */
const MAPBOX_STYLES: Record<string, { url: string; theme?: string; lightPreset?: string; colors?: Record<string, string> }> = {
  standard: { url: 'mapbox://styles/mapbox/standard' },
  // Standard with livelier parks and water (documented colour properties of its basemap config)
  'standard-colour': { url: 'mapbox://styles/mapbox/standard', colors: { colorGreenspace: '#8FD18B', colorWater: '#6CB8EA' } },
  'standard-dusk': { url: 'mapbox://styles/mapbox/standard', lightPreset: 'dusk' },
  'standard-satellite': { url: 'mapbox://styles/mapbox/standard-satellite' },
  'standard-faded': { url: 'mapbox://styles/mapbox/standard', theme: 'faded' },
  'standard-monochrome': { url: 'mapbox://styles/mapbox/standard', theme: 'monochrome' },
  streets: { url: 'mapbox://styles/mapbox/streets-v12' },
  outdoors: { url: 'mapbox://styles/mapbox/outdoors-v12' },
  light: { url: 'mapbox://styles/mapbox/light-v11' },
};
const mapboxStyle = MAPBOX_STYLES[MAP_LOOK_CHOICE.style] ?? MAPBOX_STYLES.standard;
export const PIN_STYLE = ['dots', 'badges', 'teardrop'].includes(MAP_LOOK_CHOICE.pins) ? MAP_LOOK_CHOICE.pins : 'badges';

const config = MAPBOX_TOKEN
  ? {
      provider: 'mapbox',
      global: 'mapboxgl',
      css: `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`,
      js: `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.js`,
      // Subresource Integrity: a tampered library file is refused. Recompute when the version changes.
      cssIntegrity: 'sha384-ybStW03vjH/S7ZApCJT0nH1D7iITNZEYRxjmkJWtpkDDUhwI+hXoHm7JcDvL6spf',
      jsIntegrity: 'sha384-irwCnVYwxiOAcXldUHjrozDrOWFxnXxgojV8LjaKFdnBzTVUqmdBgP4OpNtXNK6Q',
      style: mapboxStyle.url,
      standard: /\/standard(-satellite)?$/.test(mapboxStyle.url),
      theme: mapboxStyle.theme ?? 'default',
      lightPreset: mapboxStyle.lightPreset ?? null,
      colors: mapboxStyle.colors ?? {},
      token: MAPBOX_TOKEN,
      font: ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      // GUGiK landmark models for the 3D view (Mapbox only: MapLibre has no model layer)
      models: LANDMARKS_3D.map((l) => ({ id: l.id, position: [l.lon, l.lat] })),
    }
  : {
      provider: 'openfreemap',
      global: 'maplibregl',
      css: `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.css`,
      js: `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.js`,
      cssIntegrity: 'sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V',
      jsIntegrity: 'sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj',
      style: `https://tiles.openfreemap.org/styles/${colors.dark ? 'dark' : 'positron'}`,
      standard: false,
      theme: 'default',
      lightPreset: null,
      colors: {},
      token: null,
      font: ['Noto Sans Bold'],
      models: [] as { id: string; position: number[] }[],
    };

const palette = {
  stone: colors.stone,
  ink: colors.ink,
  mute: colors.mute,
  gilt: colors.gilt,
  white: colors.white,
  water: colors.water,
  park: colors.park,
  building: colors.building,
  dark: colors.dark,
  pins: PIN_STYLE,
  glyphs: GLYPH_PATHS,
};
const view = { center: [CITY.mapCentre.lon, CITY.mapCentre.lat], zoom: CITY.mapZoom, timeout: LOAD_TIMEOUT_MS };

// One HTML document runs the map inside a WebView (iOS/Android) and an iframe (web preview).
export const MAP_HTML = `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body,#m{margin:0;height:100%;background:${colors.stone}}</style>
</head><body><div id="m"></div><script>
(function(){
  var CFG=${JSON.stringify(config)}, C=${JSON.stringify(palette)}, VIEW=${JSON.stringify(view)};
  function post(msg){var s=JSON.stringify(msg);
    if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s)}else if(window.parent!==window){window.parent.postMessage(s,'*')}}

  var map=null,lib=null,ready=false,failed=false,warned=false,lastError='',pending=null;
  var lastFocus=null,lastFit=null,threeD=false;
  // Read-only state for the end-to-end tests: whether the style loaded, how many points were
  // drawn, how long the drawn route is, and where a coordinate sits on screen (to tap a real pin).
  // Changes nothing on the map.
  // every layer that draws a tappable pin: all of them count for taps and for the tests
  var FIT_MIN_ZOOM=7.6,NEAR_ZOOM=16.5,PIN_LAYERS=['pts-far','pts-icon','pts-icon-sel','pts-circle'];
  var debug={ready:false,points:0,route:0,models:0,zoom:function(){return map?map.getZoom():null},
    project:function(lon,lat){if(!map)return null;var p=map.project([lon,lat]);return{x:p.x,y:p.y}},
    hit:function(x,y){if(!map||!ready)return[];
      return map.queryRenderedFeatures([x,y],{layers:PIN_LAYERS}).map(function(f){return String(f.properties.id)})},
    // ids of the pins actually drawn in the current view (not just the data handed to the map)
    // route line pieces actually drawn in the current view
    routeDrawn:function(){if(!map||!ready)return 0;return map.queryRenderedFeatures({layers:['route-line']}).length},
    rendered:function(){if(!map||!ready)return[];var seen={};
      map.queryRenderedFeatures({layers:PIN_LAYERS}).forEach(function(f){seen[String(f.properties.id)]=1});
      return Object.keys(seen)}};
  window.__krk=debug;
  function fail(message){if(ready||failed)return;failed=true;post({type:'error',message:message})}
  var timer=setTimeout(function(){
    fail(lastError?'The map took too long to load ('+lastError+').':'The map took too long to load.')},VIEW.timeout);

  // Only well-formed, bounded data reaches the map.
  var KINDS={me:1,lens:1,stop:1};
  function num(n,a,b){return typeof n==='number'&&isFinite(n)&&n>=a&&n<=b}
  function clean(d){
    if(!d||typeof d!=='object')return null;
    var pts=Array.isArray(d.points)?d.points.slice(0,1600).filter(function(p){
      return p&&typeof p.id==='string'&&p.id.length<=64&&num(p.lat,-90,90)&&num(p.lon,-180,180)
        &&typeof p.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(p.color)&&(p.order==null||num(p.order,1,99))
        &&(p.kind==null||KINDS[p.kind]===1)&&(p.label==null||(typeof p.label==='string'&&p.label.length<=80))
        &&(p.glyph==null||(typeof p.glyph==='string'&&Object.prototype.hasOwnProperty.call(C.glyphs,p.glyph)))
        &&(p.rank==null||num(p.rank,1,3))&&(p.dim==null||typeof p.dim==='boolean')}):[];
    var route=Array.isArray(d.route)?d.route.slice(0,5000).filter(function(c){
      return Array.isArray(c)&&num(c[0],-180,180)&&num(c[1],-90,90)}):[];
    var f=d.focus;
    var focus=f&&typeof f==='object'&&num(f.lat,-90,90)&&num(f.lon,-180,180)&&num(f.key,0,1e9)?{lat:f.lat,lon:f.lon,key:f.key}:null;
    return{points:pts,route:route,selectedId:typeof d.selectedId==='string'?d.selectedId:null,fit:d.fit===true,
      fitKey:num(d.fitKey,0,1e9)?d.fitKey:null,fitTarget:d.fitTarget==='points'?'points':'route',focus:focus,threeD:d.threeD===true,
      calm:d.calm===true};
  }

  // Motion. Every animation is a short, single movement tied to something the traveller did, and
  // none runs when the phone or the browser asks for reduced motion.
  var calm=false,mq=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
  function still(){return calm||(mq&&mq.matches)}
  var FADE_LAYERS=[['pts-far','icon-opacity'],['pts-icon','icon-opacity'],['pts-circle','circle-opacity']];
  var BASE_OPACITY={};
  // New pins fade in over ~350 ms: the paint opacity is the layer's own expression times k, 0 → 1.
  var fadeRun=0;
  function fadeIn(){
    if(still())return;
    var run=++fadeRun,t0=performance.now(),DUR=350;
    function frame(now){
      if(run!==fadeRun)return;
      var k=Math.min(1,(now-t0)/DUR);k=1-Math.pow(1-k,3);
      FADE_LAYERS.forEach(function(l){if(map.getLayer(l[0])&&BASE_OPACITY[l[0]]!=null)
        map.setPaintProperty(l[0],l[1],k>=1?BASE_OPACITY[l[0]]:['*',BASE_OPACITY[l[0]],k])});
      if(k<1)requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  // A soft ring breathes around the chosen pin three times, then stays still.
  var pulseRun=0;
  function pulse(){
    var run=++pulseRun;
    if(!map.getLayer('pts-pulse'))return;
    if(still()){map.setPaintProperty('pts-pulse','circle-stroke-opacity',0);return}
    var t0=performance.now(),DUR=1400,TIMES=3;
    function frame(now){
      if(run!==pulseRun)return;
      var e=(now-t0)/DUR,p=e%1;
      if(e>=TIMES){map.setPaintProperty('pts-pulse','circle-stroke-opacity',0);return}
      map.setPaintProperty('pts-pulse','circle-radius',22+18*p);
      map.setPaintProperty('pts-pulse','circle-stroke-opacity',0.55*(1-p));
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  // A new route draws itself from the start to the end (Mapbox only: MapLibre has no line trim).
  var drawRun=0;
  function drawRoute(){
    var run=++drawRun;
    if(CFG.provider!=='mapbox'||!map.getLayer('route-line'))return;
    var ids=['route-casing','route-line'];
    if(still()){ids.forEach(function(id){try{map.setPaintProperty(id,'line-trim-offset',[0,0])}catch(e){}});return}
    var t0=performance.now(),DUR=900;
    function frame(now){
      if(run!==drawRun)return;
      var k=Math.min(1,(now-t0)/DUR);k=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      // the part still to come is trimmed away: [k, 1] hidden while k grows
      ids.forEach(function(id){try{map.setPaintProperty(id,'line-trim-offset',k>=1?[0,0]:[k,1])}catch(e){}});
      if(k<1)requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var lastIds='',lastRoute='',lastSel=null;
  // Pins with a category icon are drawn once per icon and colour on a canvas and added to the map
  // as images. Numbered plan stops, the traveller and tram stops stay plain circles.
  function drawPin(shape,glyph,color){
    // drawn at 3x: 44 css px, sharp on high-density phones, with room for a shadow that lifts it off pale buildings
    var tear=shape==='teardrop',w=tear?144:132,h=tear?184:132,cx=w/2,cy=66,r=54;
    var cv=document.createElement('canvas');cv.width=w;cv.height=h;var g=cv.getContext('2d');
    g.beginPath();
    if(tear){g.arc(cx,cy,r,Math.PI*0.8,Math.PI*0.2,false);g.lineTo(cx,h-12);g.closePath()}
    else{g.arc(cx,cy,r,0,Math.PI*2)}
    g.save();g.shadowColor='rgba(0,0,0,0.35)';g.shadowBlur=12;g.shadowOffsetY=3;g.fillStyle=color;g.fill();g.restore();
    g.lineWidth=9;g.strokeStyle='#FFFFFF';g.stroke();
    var s=(r*1.25)/24;g.save();g.translate(cx-12*s,cy-12*s);g.scale(s,s);g.fillStyle='#FFFFFF';
    g.fill(new Path2D(C.glyphs[glyph]));g.restore();
    return g.getImageData(0,0,w,h);
  }
  function iconFor(p){
    if(C.pins==='dots'||!p.glyph||p.kind==='stop'||p.kind==='me'||p.order!=null)return'';
    var key='pin-'+C.pins+'-'+p.glyph+'-'+p.color.slice(1);
    if(map&&!map.hasImage(key)){try{map.addImage(key,drawPin(C.pins,p.glyph,p.color),{pixelRatio:3})}catch(e){return''}}
    return key;
  }
  function fc(d){return{type:'FeatureCollection',features:d.points.map(function(p){
    return{type:'Feature',geometry:{type:'Point',coordinates:[p.lon,p.lat]},
      properties:{id:p.id,color:p.color,rank:p.rank==null?2:p.rank,order:p.order==null?'':String(p.order),sel:p.id===d.selectedId?1:0,
        kind:p.kind||'place',label:p.label||'',icon:iconFor(p),dim:p.dim===true?1:0}}})}}
  function line(d){return{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:d.route.length>1?d.route:[]}}}
  /** the route when asked for and present, otherwise the places (tram stops left out) */
  function fitTo(d,target){
    var b=new lib.LngLatBounds(),n=0;
    if(target!=='points'&&d.route.length>1){d.route.forEach(function(c){b.extend(c);n++})}
    else{d.points.forEach(function(p){if(p.kind!=='stop'){b.extend([p.lon,p.lat]);n++}})}
    if(!n)return;
    var pad={top:80,bottom:80,left:48,right:48};
    // Day trips reach from Czestochowa to the Tatras: fitting them all in a small map zooms out to
    // half of Europe, where every pin merges into one. Below FIT_MIN_ZOOM the map stays at the
    // region around the places instead, and the far ones are a short pan away.
    var cam=map.cameraForBounds(b,{padding:pad,maxZoom:16});
    if(cam&&cam.zoom<FIT_MIN_ZOOM){map.easeTo({center:b.getCenter(),zoom:FIT_MIN_ZOOM,duration:600});return}
    map.fitBounds(b,{padding:pad,maxZoom:16,duration:still()?0:900});
  }
  function apply(d){
    if(!ready){pending=d;return}
    calm=d.calm;
    map.getSource('pts').setData(fc(d));debug.points=d.points.length;
    var drawn=line(d);map.getSource('route').setData(drawn);debug.route=drawn.geometry.coordinates.length;
    // animate only what changed: a new set of pins, a new route, a new chosen pin
    var ids=d.points.map(function(p){return p.id}).join('|');
    if(ids!==lastIds){if(lastIds)fadeIn();lastIds=ids}
    var rk=drawn.geometry.coordinates.length?drawn.geometry.coordinates.map(function(c){return c[0].toFixed(5)+','+c[1].toFixed(5)}).join(';'):'';
    if(rk!==lastRoute){lastRoute=rk;if(rk)drawRoute()}
    if(d.selectedId!==lastSel){lastSel=d.selectedId;if(d.selectedId)pulse()}
    var fitted=false;
    if(d.fit){fitTo(d,'route');fitted=true}
    if(d.fitKey!==null&&d.fitKey!==lastFit){
      var first=lastFit===null;lastFit=d.fitKey;
      if(!first||d.fitKey>0){fitTo(d,d.fitTarget);fitted=true}
    }
    // Camera requests arriving together: a fit is the newest user action, so a focus in the same
    // update doesn't fly away from it, and a 3D switch waits for the fit to finish.
    var cam={},move=false;
    if(d.focus&&d.focus.key!==lastFocus){
      lastFocus=d.focus.key;
      if(!fitted){cam.center=[d.focus.lon,d.focus.lat];cam.zoom=Math.max(map.getZoom(),15.5);move=true}
    }
    if(d.threeD!==threeD){
      threeD=d.threeD;
      ['krk-buildings-3d','krk-models'].forEach(function(id){
        if(map.getLayer(id))map.setLayoutProperty(id,'visibility',threeD?'visible':'none')});
      // north stays up: a turned map confuses visitors who read it like a paper one
      // steep enough, and close enough, that the buildings around the Main Square read as 3D at once
      cam.pitch=threeD?60:0;cam.bearing=0;
      if(threeD&&!fitted)cam.zoom=Math.max(cam.zoom||map.getZoom(),16.2);
      move=true;
    }
    if(move){
      // a chosen place is flown to along a gentle arc; a calm map jumps there
      var go=function(){
        if(still())map.jumpTo(cam);
        else if(cam.center)map.flyTo(Object.assign({duration:1200,curve:1.3,essential:false},cam));
        else map.easeTo(Object.assign({duration:800},cam));
      };
      if(fitted)map.once('moveend',go);else go();
    }
  }
  window.__apply=function(d){var c=clean(d);if(c)apply(c)};

  function start(){
    lib=window[CFG.global];
    if(!lib){fail('The map library could not be downloaded.');return}
    if(CFG.token)lib.accessToken=CFG.token;
    var opts={container:'m',style:CFG.style,center:VIEW.center,zoom:VIEW.zoom};
    if(CFG.provider==='mapbox'&&CFG.standard){
      var basemap={lightPreset:CFG.lightPreset||(C.dark?'night':'day'),theme:CFG.theme,showPointOfInterestLabels:false,showLandmarkIconLabels:false};
      for(var k in CFG.colors)basemap[k]=CFG.colors[k];
      opts.config={basemap:basemap}}
    else{opts.attributionControl={compact:true}}
    try{map=new lib.Map(opts)}catch(err){fail('The map could not start: '+(err&&err.message));return}

    // Before the first load an error is only remembered (a single missing tile is not fatal);
    // afterwards the app hears about the first one as a warning.
    map.on('error',function(e){
      var msg=String((e&&e.error&&e.error.message)||'map error');
      if(!ready){lastError=msg;return}
      if(!warned){warned=true;post({type:'warning',message:msg})}
    });

    map.on('load',function(){
      if(CFG.provider!=='mapbox'){
        map.getStyle().layers.forEach(function(l){try{
          if(l.type==='background')map.setPaintProperty(l.id,'background-color',C.stone);
          if(l.id.indexOf('water')===0&&l.type==='fill')map.setPaintProperty(l.id,'fill-color',C.water);
          if(l.id.indexOf('park')===0&&l.type==='fill')map.setPaintProperty(l.id,'fill-color',C.park);
        }catch(e){}});
        // 3D buildings from OSM heights, hidden until the 3D view is switched on
        try{
          map.addLayer({id:'krk-buildings-3d',type:'fill-extrusion',source:'openmaptiles','source-layer':'building',minzoom:13,
            layout:{visibility:'none'},
            paint:{'fill-extrusion-color':C.building,
              'fill-extrusion-height':['coalesce',['get','render_height'],8],
              'fill-extrusion-base':['coalesce',['get','render_min_height'],0],
              'fill-extrusion-opacity':0.92}});
        }catch(e){}
      }else if(!CFG.standard){
        // classic Mapbox styles: extrude their own building heights for the 3D view
        try{
          map.addLayer({id:'krk-buildings-3d',type:'fill-extrusion',source:'composite','source-layer':'building',minzoom:13,
            filter:['==',['get','extrude'],'true'],layout:{visibility:'none'},
            paint:{'fill-extrusion-color':C.building,'fill-extrusion-height':['get','height'],
              'fill-extrusion-base':['get','min_height'],'fill-extrusion-opacity':0.9}});
        }catch(e){}
      }
      // Landmark models, hidden until the 3D view. They are files of the web app (public/models), so a
      // document without a web origin (the native WebView) has nowhere to load them from.
      // (a blob: document keeps the http(s) origin of the page that made it)
      if(CFG.models.length&&/^https?:\\/\\//.test(location.origin)){
        try{
          var specs={};
          CFG.models.forEach(function(m){specs[m.id]={uri:location.origin+'/models/'+m.id+'.glb',position:m.position,orientation:[0,0,0]}});
          map.addSource('krk-models',{type:'model',models:specs});
          // in the middle slot, so the buildings never cover the pins and names drawn in the top slot
          var models={id:'krk-models',type:'model',source:'krk-models',layout:{visibility:'none'},paint:{'model-opacity':1}};
          if(CFG.standard)models.slot='middle';
          map.addLayer(models);
          debug.models=CFG.models.length;
        }catch(e){}
      }
      // slots exist only in Mapbox Standard
      var top=CFG.standard?{slot:'top'}:{};
      function layer(def){for(var k in top)def[k]=top[k];map.addLayer(def)}
      var isStop=['==',['get','kind'],'stop'];
      var notStop=['!=',['get','kind'],'stop'];
      // lineMetrics lets the route draw itself (line-trim-offset)
      map.addSource('route',{type:'geojson',lineMetrics:true,data:line({route:[]})});
      map.addSource('pts',{type:'geojson',data:fc({points:[]})});
      layer({id:'route-casing',type:'line',source:'route',layout:{'line-join':'round','line-cap':'round'},
        paint:{'line-color':C.ink,'line-width':7}});
      layer({id:'route-line',type:'line',source:'route',layout:{'line-join':'round','line-cap':'round'},
        paint:{'line-color':C.gilt,'line-width':3.5,'line-dasharray':[2,1.2]}});
      // tram stops: small rings, drawn under the places
      layer({id:'stops',type:'circle',source:'pts',minzoom:13,filter:isStop,paint:{
        // ringed in the stop's own colour: trams and buses are told apart at a glance
        'circle-color':C.stone,'circle-radius':['interpolate',['linear'],['zoom'],13,2.5,17,6],
        'circle-stroke-color':['get','color'],'circle-stroke-width':['interpolate',['linear'],['zoom'],13,1.5,17,2.5]}});
      layer({id:'pts-circle',type:'circle',source:'pts',filter:['all',notStop,['==',['get','icon'],'']],paint:{
        'circle-color':['get','color'],
        'circle-opacity':['case',['all',['==',['get','dim'],1],['!=',['get','sel'],1]],0.45,1],
        'circle-radius':['case',['==',['get','sel'],1],13,['==',['get','kind'],'me'],9,['==',['get','kind'],'lens'],9,['!=',['get','order'],''],11,7],
        'circle-stroke-color':['case',['==',['get','sel'],1],C.ink,['==',['get','kind'],'lens'],C.ink,C.white],
        'circle-stroke-width':['case',['==',['get','sel'],1],3,['==',['get','kind'],'me'],4,['==',['get','kind'],'lens'],3,2]}});
      var tear=C.pins==='teardrop',hasIcon=['!=',['get','icon'],''];
      // a ring around the selected icon pin (for teardrops, around its round head)
      layer({id:'pts-sel',type:'circle',source:'pts',filter:['all',hasIcon,['==',['get','sel'],1]],paint:{
        'circle-radius':tear?25:26,'circle-color':'rgba(0,0,0,0)','circle-stroke-color':C.ink,'circle-stroke-width':3,
        'circle-translate':tear?[0,-39]:[0,0]}});
      // the breathing ring around the chosen pin (radius and opacity are animated by pulse())
      layer({id:'pts-pulse',type:'circle',source:'pts',filter:['==',['get','sel'],1],paint:{
        'circle-radius':22,'circle-color':'rgba(0,0,0,0)','circle-stroke-color':['get','color'],'circle-stroke-width':3,
        'circle-stroke-opacity':0,'circle-translate':tear?[0,-39]:[0,0]}});
      // Crowding. Zoomed out, a pin and its name are placed together and give way to more important
      // neighbours (a cafe beside St Mary's), so fewer, readable pins remain; zoomed in, every pin shows.
      var notSel=['!=',['get','sel'],1],isSel=['==',['get','sel'],1],byRank=['-',4,['get','rank']];
      // a closed place is faded, so what is open stands out; the chosen pin always stays solid
      var dimmed=['case',['all',['==',['get','dim'],1],notSel],0.45,1];
      function pin(extra){var l={'icon-image':['get','icon'],'icon-anchor':tear?'bottom':'center',
        'icon-size':['case',isSel,1.2,1]};for(var k in extra)l[k]=extra[k];return l}
      var pinPaint={'icon-opacity':dimmed};
      // a name moves to whichever side of its pin is free, instead of hiding under a neighbour
      function named(l,field){l['text-field']=field;l['text-font']=CFG.font;
        l['text-size']=['interpolate',['linear'],['zoom'],14,13,17,16];
        l['text-variable-anchor']=['top','bottom','right','left'];l['text-radial-offset']=tear?1.2:1.9;
        l['text-max-width']=8;l['text-optional']=true;return l}
      var namePaint={'text-color':C.ink,'text-halo-color':'#FFFFFF','text-halo-width':2.5};
      function merge(a,b){var o={};for(var k in a)o[k]=a[k];for(var j in b)o[j]=b[j];return o}
      layer({id:'pts-far',type:'symbol',source:'pts',maxzoom:NEAR_ZOOM,filter:['all',hasIcon,notSel],
        layout:named(pin({'icon-allow-overlap':false,'icon-padding':2,'symbol-sort-key':byRank}),
          ['step',['zoom'],'',13.8,['get','label']]),paint:merge(namePaint,pinPaint)});
      layer({id:'pts-icon',type:'symbol',source:'pts',minzoom:NEAR_ZOOM,filter:['all',hasIcon,notSel],
        layout:pin({'icon-allow-overlap':true,'icon-ignore-placement':false,'symbol-sort-key':byRank}),paint:pinPaint});
      // the chosen place always shows, with its name, whatever is around it
      layer({id:'pts-icon-sel',type:'symbol',source:'pts',filter:['all',hasIcon,isSel],
        layout:named(pin({'icon-allow-overlap':true,'icon-ignore-placement':true}),['get','label']),paint:namePaint});
      layer({id:'pts-order',type:'symbol',source:'pts',filter:['!=',['get','order'],''],layout:{'text-field':['get','order'],
        'text-font':CFG.font,'text-size':11,'text-allow-overlap':true},paint:{'text-color':C.white}});
      // names of plain markers (plan stops, dot pins), and of icon pins once zoomed in
      layer({id:'pts-label',type:'symbol',source:'pts',minzoom:13.8,
        filter:['all',notStop,['==',['get','icon'],''],['!=',['get','label'],'']],
        layout:named({},['get','label']),paint:namePaint});
      layer({id:'pts-label-near',type:'symbol',source:'pts',minzoom:NEAR_ZOOM,
        filter:['all',hasIcon,notSel,['!=',['get','label'],'']],
        layout:named({},['get','label']),paint:namePaint});
      layer({id:'stops-label',type:'symbol',source:'pts',minzoom:16,filter:isStop,
        layout:{'text-field':['get','label'],'text-font':CFG.font,'text-size':10,'text-offset':[0,0.9],'text-anchor':'top',
          'text-max-width':8,'text-optional':true},
        paint:{'text-color':C.mute,'text-halo-color':C.stone,'text-halo-width':1.4}});
      // A tap opens the nearest place within 24 px, pin or name: fingers rarely hit a 44 px pin exactly.
      map.on('click',function(e){
        var p=e.point,r=24,best=null,bestD=Infinity;
        map.queryRenderedFeatures([[p.x-r,p.y-r],[p.x+r,p.y+r]],{layers:PIN_LAYERS.concat(['pts-label','pts-label-near'])}).forEach(function(f){
          var k=f.properties.kind;if(k==='me'||k==='stop'||!f.geometry||!f.geometry.coordinates)return;
          var q=map.project(f.geometry.coordinates),d=(q.x-p.x)*(q.x-p.x)+(q.y-p.y)*(q.y-p.y);
          if(d<bestD){bestD=d;best=f}});
        if(best)post({type:'select',id:String(best.properties.id)});
      });
      PIN_LAYERS.concat(['pts-label','pts-label-near']).forEach(function(id){
        map.on('mouseenter',id,function(){map.getCanvas().style.cursor='pointer'});
        map.on('mouseleave',id,function(){map.getCanvas().style.cursor=''});
      });
      // remember each fading layer's own opacity expression, so fadeIn() can scale and restore it
      FADE_LAYERS.forEach(function(l){if(map.getLayer(l[0]))BASE_OPACITY[l[0]]=map.getPaintProperty(l[0],l[1])});
      // a late load still counts: the app clears its error message on "ready"
      ready=true;debug.ready=true;clearTimeout(timer);
      if(pending){apply(pending);pending=null}
      post({type:'ready'});
    });
  }

  var css=document.createElement('link');css.rel='stylesheet';css.crossOrigin='anonymous';css.integrity=CFG.cssIntegrity;
  css.href=CFG.css;document.head.appendChild(css);
  var js=document.createElement('script');js.crossOrigin='anonymous';js.integrity=CFG.jsIntegrity;js.src=CFG.js;js.onload=start;
  js.onerror=function(){fail('The map library could not be downloaded.')};
  document.head.appendChild(js);

  // Web preview: accept data only from the page that embeds this map.
  window.addEventListener('message',function(e){
    if(window.parent===window||e.source!==window.parent)return;
    var m=null;try{m=JSON.parse(e.data)}catch(err){return}
    if(m&&m.type==='data')window.__apply(m.payload);
  });
})();
</script></body></html>`;
