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
  /** the traveller's position or start point: drawn differently, not tappable */
  kind?: 'me';
}

export interface MapPayload {
  points: MapPoint[];
  route?: [number, number][];
  selectedId?: string | null;
  fit?: boolean;
  /** the map flies here whenever `key` changes */
  focus?: { lat: number; lon: number; key: number } | null;
}

// Provider switch. With a public Mapbox token the map uses Mapbox Standard with 3D buildings;
// without one it falls back to MapLibre + OpenFreeMap, which needs no account.
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
      style: 'mapbox://styles/mapbox/standard',
      token: MAPBOX_TOKEN,
      font: ['DIN Pro Bold', 'Arial Unicode MS Bold'],
    }
  : {
      provider: 'openfreemap',
      global: 'maplibregl',
      css: `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.css`,
      js: `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.js`,
      style: 'https://tiles.openfreemap.org/styles/positron',
      token: null,
      font: ['Noto Sans Bold'],
    };

const palette = { stone: colors.stone, ink: colors.ink, gilt: colors.gilt, white: colors.white };
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

  var map=null,lib=null,ready=false,failed=false,warned=false,lastError='',pending=null,lastFocus=null;
  function fail(message){if(ready||failed)return;failed=true;post({type:'error',message:message})}
  var timer=setTimeout(function(){
    fail(lastError?'The map took too long to load ('+lastError+').':'The map took too long to load.')},VIEW.timeout);

  // Only well-formed, bounded data reaches the map.
  function num(n,a,b){return typeof n==='number'&&isFinite(n)&&n>=a&&n<=b}
  function clean(d){
    if(!d||typeof d!=='object')return null;
    var pts=Array.isArray(d.points)?d.points.slice(0,500).filter(function(p){
      return p&&typeof p.id==='string'&&p.id.length<=64&&num(p.lat,-90,90)&&num(p.lon,-180,180)
        &&typeof p.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(p.color)&&(p.order==null||num(p.order,1,99))
        &&(p.kind==null||p.kind==='me')}):[];
    var route=Array.isArray(d.route)?d.route.slice(0,5000).filter(function(c){
      return Array.isArray(c)&&num(c[0],-180,180)&&num(c[1],-90,90)}):[];
    var f=d.focus;
    var focus=f&&typeof f==='object'&&num(f.lat,-90,90)&&num(f.lon,-180,180)&&num(f.key,0,1e9)?{lat:f.lat,lon:f.lon,key:f.key}:null;
    return{points:pts,route:route,selectedId:typeof d.selectedId==='string'?d.selectedId:null,fit:d.fit===true,focus:focus};
  }
  function fc(d){return{type:'FeatureCollection',features:d.points.map(function(p){
    return{type:'Feature',geometry:{type:'Point',coordinates:[p.lon,p.lat]},
      properties:{id:p.id,color:p.color,order:p.order==null?'':String(p.order),sel:p.id===d.selectedId?1:0,me:p.kind==='me'?1:0}}})}}
  function line(d){return{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:d.route.length>1?d.route:[]}}}
  function apply(d){
    if(!ready){pending=d;return}
    map.getSource('pts').setData(fc(d));
    map.getSource('route').setData(line(d));
    if(d.fit&&d.points.length){
      var b=new lib.LngLatBounds();d.points.forEach(function(p){b.extend([p.lon,p.lat])});
      map.fitBounds(b,{padding:{top:70,bottom:70,left:40,right:40},maxZoom:16,duration:600});
    }
    if(d.focus&&d.focus.key!==lastFocus){
      lastFocus=d.focus.key;
      map.flyTo({center:[d.focus.lon,d.focus.lat],zoom:Math.max(map.getZoom(),15.5),duration:700});
    }
  }
  window.__apply=function(d){var c=clean(d);if(c)apply(c)};

  function start(){
    lib=window[CFG.global];
    if(!lib){fail('The map library could not be downloaded.');return}
    if(CFG.token)lib.accessToken=CFG.token;
    var opts={container:'m',style:CFG.style,center:VIEW.center,zoom:VIEW.zoom};
    if(CFG.provider==='mapbox'){opts.pitch=40;opts.config={basemap:{lightPreset:'day',showPointOfInterestLabels:false}}}
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
          if(l.id.indexOf('water')===0&&l.type==='fill')map.setPaintProperty(l.id,'fill-color','#AFC3C6');
          if(l.id.indexOf('park')===0&&l.type==='fill')map.setPaintProperty(l.id,'fill-color','#C4D6CB');
        }catch(e){}});
      }
      var top=CFG.provider==='mapbox'?{slot:'top'}:{};
      function layer(def){for(var k in top)def[k]=top[k];map.addLayer(def)}
      map.addSource('route',{type:'geojson',data:line({route:[]})});
      map.addSource('pts',{type:'geojson',data:fc({points:[]})});
      layer({id:'route-casing',type:'line',source:'route',layout:{'line-join':'round','line-cap':'round'},
        paint:{'line-color':C.ink,'line-width':7}});
      layer({id:'route-line',type:'line',source:'route',layout:{'line-join':'round','line-cap':'round'},
        paint:{'line-color':C.gilt,'line-width':3.5,'line-dasharray':[2,1.2]}});
      layer({id:'pts-circle',type:'circle',source:'pts',paint:{
        'circle-color':['get','color'],
        'circle-radius':['case',['==',['get','sel'],1],13,['==',['get','me'],1],9,['!=',['get','order'],''],11,7],
        'circle-stroke-color':['case',['==',['get','sel'],1],C.ink,C.white],
        'circle-stroke-width':['case',['==',['get','sel'],1],3,['==',['get','me'],1],4,2]}});
      layer({id:'pts-order',type:'symbol',source:'pts',layout:{'text-field':['get','order'],
        'text-font':CFG.font,'text-size':11,'text-allow-overlap':true},paint:{'text-color':C.white}});
      map.on('click','pts-circle',function(e){var f=e.features&&e.features[0];
        if(f&&f.properties.me!==1)post({type:'select',id:String(f.properties.id)})});
      map.on('mouseenter','pts-circle',function(){map.getCanvas().style.cursor='pointer'});
      map.on('mouseleave','pts-circle',function(){map.getCanvas().style.cursor=''});
      // a late load still counts: the app clears its error message on "ready"
      ready=true;clearTimeout(timer);
      if(pending){apply(pending);pending=null}
      post({type:'ready'});
    });
  }

  var css=document.createElement('link');css.rel='stylesheet';css.href=CFG.css;document.head.appendChild(css);
  var js=document.createElement('script');js.src=CFG.js;js.onload=start;
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
