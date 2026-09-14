import { CITY } from '../config/city';
import { MAPBOX_TOKEN } from '../config/mapbox';
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
}

export interface MapPayload {
  points: MapPoint[];
  route?: [number, number][];
  selectedId?: string | null;
  /** fit the view to the route or the points on every update (plans) */
  fit?: boolean;
  /** fit the view once each time this number changes (map screen) */
  fitKey?: number;
  /** the map flies here whenever `key` changes */
  focus?: { lat: number; lon: number; key: number } | null;
  /** tilted view with buildings in 3D */
  threeD?: boolean;
}

// Provider switch. With a public Mapbox token the map uses Mapbox Standard with 3D buildings;
// without one it falls back to MapLibre + OpenFreeMap, which needs no account. OpenFreeMap tiles
// carry OSM building heights (render_height), which we extrude for the 3D view.
const MAPBOX_GL_VERSION = '3.15.0';
const MAPLIBRE_GL_VERSION = '4.7.1';
/** covers the library download too: the watchdog starts before anything is fetched */
const LOAD_TIMEOUT_MS = 15000;

export const MAP_PROVIDER: 'mapbox' | 'openfreemap' = MAPBOX_TOKEN ? 'mapbox' : 'openfreemap';

const config = MAPBOX_TOKEN
  ? {
      provider: 'mapbox',
      global: 'mapboxgl',
      css: `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`,
      js: `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.js`,
      // Subresource Integrity: a tampered library file is refused. Recompute when the version changes.
      cssIntegrity: 'sha384-ybStW03vjH/S7ZApCJT0nH1D7iITNZEYRxjmkJWtpkDDUhwI+hXoHm7JcDvL6spf',
      jsIntegrity: 'sha384-irwCnVYwxiOAcXldUHjrozDrOWFxnXxgojV8LjaKFdnBzTVUqmdBgP4OpNtXNK6Q',
      style: 'mapbox://styles/mapbox/standard',
      token: MAPBOX_TOKEN,
      font: ['DIN Pro Bold', 'Arial Unicode MS Bold'],
    }
  : {
      provider: 'openfreemap',
      global: 'maplibregl',
      css: `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.css`,
      js: `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.js`,
      cssIntegrity: 'sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V',
      jsIntegrity: 'sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj',
      style: `https://tiles.openfreemap.org/styles/${colors.dark ? 'dark' : 'positron'}`,
      token: null,
      font: ['Noto Sans Bold'],
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
  function fail(message){if(ready||failed)return;failed=true;post({type:'error',message:message})}
  var timer=setTimeout(function(){
    fail(lastError?'The map took too long to load ('+lastError+').':'The map took too long to load.')},VIEW.timeout);

  // Only well-formed, bounded data reaches the map.
  var KINDS={me:1,lens:1,stop:1};
  function num(n,a,b){return typeof n==='number'&&isFinite(n)&&n>=a&&n<=b}
  function clean(d){
    if(!d||typeof d!=='object')return null;
    var pts=Array.isArray(d.points)?d.points.slice(0,800).filter(function(p){
      return p&&typeof p.id==='string'&&p.id.length<=64&&num(p.lat,-90,90)&&num(p.lon,-180,180)
        &&typeof p.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(p.color)&&(p.order==null||num(p.order,1,99))
        &&(p.kind==null||KINDS[p.kind]===1)&&(p.label==null||(typeof p.label==='string'&&p.label.length<=80))}):[];
    var route=Array.isArray(d.route)?d.route.slice(0,5000).filter(function(c){
      return Array.isArray(c)&&num(c[0],-180,180)&&num(c[1],-90,90)}):[];
    var f=d.focus;
    var focus=f&&typeof f==='object'&&num(f.lat,-90,90)&&num(f.lon,-180,180)&&num(f.key,0,1e9)?{lat:f.lat,lon:f.lon,key:f.key}:null;
    return{points:pts,route:route,selectedId:typeof d.selectedId==='string'?d.selectedId:null,fit:d.fit===true,
      fitKey:num(d.fitKey,0,1e9)?d.fitKey:null,focus:focus,threeD:d.threeD===true};
  }
  function fc(d){return{type:'FeatureCollection',features:d.points.map(function(p){
    return{type:'Feature',geometry:{type:'Point',coordinates:[p.lon,p.lat]},
      properties:{id:p.id,color:p.color,order:p.order==null?'':String(p.order),sel:p.id===d.selectedId?1:0,
        kind:p.kind||'place',label:p.label||''}}})}}
  function line(d){return{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:d.route.length>1?d.route:[]}}}
  /** the route when there is one, otherwise the places (tram stops and the traveller left out) */
  function fitTo(d){
    var b=new lib.LngLatBounds(),n=0;
    if(d.route.length>1){d.route.forEach(function(c){b.extend(c);n++})}
    else{d.points.forEach(function(p){if(p.kind!=='stop'){b.extend([p.lon,p.lat]);n++}})}
    if(n)map.fitBounds(b,{padding:{top:80,bottom:80,left:48,right:48},maxZoom:16,duration:600});
  }
  function apply(d){
    if(!ready){pending=d;return}
    map.getSource('pts').setData(fc(d));
    map.getSource('route').setData(line(d));
    if(d.fit)fitTo(d);
    if(d.fitKey!==null&&d.fitKey!==lastFit){var first=lastFit===null;lastFit=d.fitKey;if(!first||d.fitKey>0)fitTo(d)}
    // A new focus and a 3D switch arriving together become one camera move, so neither cancels the other.
    var cam={},move=false;
    if(d.focus&&d.focus.key!==lastFocus){
      lastFocus=d.focus.key;
      cam.center=[d.focus.lon,d.focus.lat];cam.zoom=Math.max(map.getZoom(),15.5);move=true;
    }
    if(d.threeD!==threeD){
      threeD=d.threeD;
      if(map.getLayer('krk-buildings-3d'))map.setLayoutProperty('krk-buildings-3d','visibility',threeD?'visible':'none');
      cam.pitch=threeD?58:0;cam.bearing=threeD?-20:0;
      if(threeD)cam.zoom=Math.max(cam.zoom||map.getZoom(),15.6);
      move=true;
    }
    if(move)map.easeTo(Object.assign({duration:800},cam));
  }
  window.__apply=function(d){var c=clean(d);if(c)apply(c)};

  function start(){
    lib=window[CFG.global];
    if(!lib){fail('The map library could not be downloaded.');return}
    if(CFG.token)lib.accessToken=CFG.token;
    var opts={container:'m',style:CFG.style,center:VIEW.center,zoom:VIEW.zoom};
    if(CFG.provider==='mapbox'){opts.config={basemap:{lightPreset:C.dark?'night':'day',showPointOfInterestLabels:false}}}
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
      }
      var top=CFG.provider==='mapbox'?{slot:'top'}:{};
      function layer(def){for(var k in top)def[k]=top[k];map.addLayer(def)}
      var isStop=['==',['get','kind'],'stop'];
      var notStop=['!=',['get','kind'],'stop'];
      map.addSource('route',{type:'geojson',data:line({route:[]})});
      map.addSource('pts',{type:'geojson',data:fc({points:[]})});
      layer({id:'route-casing',type:'line',source:'route',layout:{'line-join':'round','line-cap':'round'},
        paint:{'line-color':C.ink,'line-width':7}});
      layer({id:'route-line',type:'line',source:'route',layout:{'line-join':'round','line-cap':'round'},
        paint:{'line-color':C.gilt,'line-width':3.5,'line-dasharray':[2,1.2]}});
      // tram stops: small rings, drawn under the places
      layer({id:'stops',type:'circle',source:'pts',minzoom:13,filter:isStop,paint:{
        'circle-color':C.stone,'circle-radius':['interpolate',['linear'],['zoom'],13,2.5,17,5],
        'circle-stroke-color':C.ink,'circle-stroke-width':1.5}});
      layer({id:'pts-circle',type:'circle',source:'pts',filter:notStop,paint:{
        'circle-color':['get','color'],
        'circle-radius':['case',['==',['get','sel'],1],13,['==',['get','kind'],'me'],9,['==',['get','kind'],'lens'],9,['!=',['get','order'],''],11,7],
        'circle-stroke-color':['case',['==',['get','sel'],1],C.ink,['==',['get','kind'],'lens'],C.ink,C.white],
        'circle-stroke-width':['case',['==',['get','sel'],1],3,['==',['get','kind'],'me'],4,['==',['get','kind'],'lens'],3,2]}});
      layer({id:'pts-order',type:'symbol',source:'pts',filter:['!=',['get','order'],''],layout:{'text-field':['get','order'],
        'text-font':CFG.font,'text-size':11,'text-allow-overlap':true},paint:{'text-color':C.white}});
      layer({id:'pts-label',type:'symbol',source:'pts',minzoom:14.6,filter:['all',notStop,['!=',['get','label'],'']],
        layout:{'text-field':['get','label'],'text-font':CFG.font,'text-size':11,'text-offset':[0,1.1],'text-anchor':'top',
          'text-max-width':9,'text-optional':true},
        paint:{'text-color':C.ink,'text-halo-color':C.stone,'text-halo-width':1.6}});
      layer({id:'stops-label',type:'symbol',source:'pts',minzoom:16,filter:isStop,
        layout:{'text-field':['get','label'],'text-font':CFG.font,'text-size':10,'text-offset':[0,0.9],'text-anchor':'top',
          'text-max-width':8,'text-optional':true},
        paint:{'text-color':C.mute,'text-halo-color':C.stone,'text-halo-width':1.4}});
      map.on('click','pts-circle',function(e){var f=e.features&&e.features[0];
        if(f&&f.properties.kind!=='me')post({type:'select',id:String(f.properties.id)})});
      map.on('mouseenter','pts-circle',function(){map.getCanvas().style.cursor='pointer'});
      map.on('mouseleave','pts-circle',function(){map.getCanvas().style.cursor=''});
      // a late load still counts: the app clears its error message on "ready"
      ready=true;clearTimeout(timer);
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
