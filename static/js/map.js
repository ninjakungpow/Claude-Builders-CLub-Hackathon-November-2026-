// NEhelp: map (or list) of local businesses, for both small businesses and companies
// Loaded as a plain script; everything shares one global scope, in the order index.html lists.
// Data comes from /api/businesses, which only returns public facts (never private needs or guesses).

var bizMap=null,bizData=null;

function mapView(cur,sum){var mode=S.ui.mapMode||"map";
var body='<div class="bar"><h2>Businesses near you</h2><div class="seg" role="group" aria-label="Show as">'+
[["map","Map"],["list","List"]].map(function(m){return'<button data-a="mapmode" data-m="'+m[0]+'" aria-pressed="'+(mode===m[0])+'">'+m[1]+"</button>"}).join("")+"</div></div>"+
'<p class="hint" style="margin-bottom:14px">Every local business on NEhelp and nearby. You only see what’s public: name, type, area, website and food hygiene rating.</p>'+
'<div class="maplegend"><span><i style="background:#14B5AE"></i>On NEhelp</span><span><i style="background:#F2A541"></i>Not signed up yet</span></div>'+
(mode==="map"?'<div id="bizmap" class="bizmap" role="region" aria-label="Map of local businesses"></div>':'<div id="bizlist"><p class="hint">Loading…</p></div>');
return shell(cur,body,sum)}
function bMap(){return mapView("b-map",bSum())}
function cMap(){return mapView("c-map",cSum())}

function bizTags(b){var p=b.public,t=[];
t.push(pill(b.claimed?"On NEhelp":"Not signed up yet",b.claimed?"good":""));
t.push(pill(p.has_website?"Has a website":b.real?"No website on OpenStreetMap":"No website listed"));
if(p.hygiene_rating!=null)t.push(pill("Food hygiene "+p.hygiene_rating+"/5"+(p.hygiene_date?" ("+p.hygiene_date.slice(0,4)+")":"")));
if(b.real)t.push(pill("Real business, name changed"));
return'<div class="row" style="gap:6px;margin-top:8px">'+t.join("")+"</div>"}

function loadBiz(done){if(bizData)return done(bizData);
fetch("/api/businesses").then(function(r){return r.json()}).then(function(list){bizData=list;done(list)}).catch(function(){toast("Couldn’t load businesses. Is the server running?")})}

// Called after render() whenever a map view is on screen.
function drawBizMap(){var listEl=document.getElementById("bizlist");
if(listEl)return loadBiz(function(list){var areas={};list.forEach(function(b){(areas[b.area]=areas[b.area]||[]).push(b)});
listEl.innerHTML=Object.keys(areas).sort().map(function(a){return'<h3 class="sec">'+esc(a)+" · "+areas[a].length+'</h3><div class="list-rows">'+
areas[a].sort(function(x,y){return y.claimed-x.claimed||x.name.localeCompare(y.name)}).map(function(b){return'<div class="lrow"><div class="grow"><b>'+esc(b.name)+'</b><p class="meta">'+esc(b.type)+"</p>"+bizTags(b)+"</div></div>"}).join("")+"</div>"}).join("")});
var el=document.getElementById("bizmap");if(!el||typeof L==="undefined")return;
if(bizMap){bizMap.remove();bizMap=null}
bizMap=L.map(el).setView([54.975,-1.6],13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Hygiene ratings: FSA, OGL v3.0'}).addTo(bizMap);
loadBiz(function(list){if(!bizMap)return;var pts=[];
list.forEach(function(b){L.circleMarker([b.lat,b.lng],{radius:b.claimed?9:6,color:"#fff",weight:2,fillColor:b.claimed?"#14B5AE":"#F2A541",fillOpacity:.95}).bindPopup("<b>"+esc(b.name)+"</b><br>"+esc(b.type+" · "+b.area)+bizTags(b)).addTo(bizMap);pts.push([b.lat,b.lng])});
if(pts.length)bizMap.fitBounds(pts,{padding:[30,30]})})}

// Small preview map used on the landing page and both dashboards (the #minimap card).
var miniMap=null;
function drawMini(){var el=document.getElementById("minimap");if(!el)return;
if(typeof L==="undefined"){el.innerHTML='<p class="hint" style="padding:16px">The map needs an internet connection. <a href="/map.html">Open the map page</a>.</p>';return}
if(miniMap){try{miniMap.remove()}catch(e){}miniMap=null}
miniMap=L.map(el,{scrollWheelZoom:false}).setView([54.975,-1.6],12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Hygiene ratings: FSA, OGL v3.0'}).addTo(miniMap);
loadBiz(function(list){if(!miniMap)return;var pts=[];
list.forEach(function(b){L.circleMarker([b.lat,b.lng],{radius:b.claimed?9:6,color:"#fff",weight:2,fillColor:b.claimed?"#14B5AE":"#F2A541",fillOpacity:.95}).bindPopup("<b>"+esc(b.name)+"</b><br>"+esc(b.type+" · "+b.area)+bizTags(b)).addTo(miniMap);pts.push([b.lat,b.lng])});
if(pts.length)miniMap.fitBounds(pts,{padding:[30,30]})})}
