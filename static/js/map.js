// NEhelp: map of other local businesses, for small business users
// Loaded as a plain script; everything shares one global scope, in the order index.html lists.
// Data comes from /api/businesses, which only returns public facts (never private needs or guesses).

var bizMap=null;

function bMap(){var body='<div class="bar"><h2>Businesses near you</h2></div><p class="hint" style="margin-bottom:14px">Other local businesses. You only see what’s public: name, type, area, website and food hygiene rating.</p>'+
'<div class="maplegend"><span><i style="background:#14B5AE"></i>On NEhelp</span><span><i style="background:#F2A541"></i>Not signed up yet</span></div>'+
'<div id="bizmap" class="bizmap" role="region" aria-label="Map of local businesses"></div>';
return shell("b-map",body,bSum())}

function mapPopup(b){var p=b.public,t=[];
t.push(b.claimed?"On NEhelp":"Not signed up yet");
t.push(p.has_website?"Has a website":b.real?"No website on OpenStreetMap":"No website listed");
if(p.hygiene_rating!=null)t.push("Food hygiene "+p.hygiene_rating+"/5"+(p.hygiene_date?" ("+p.hygiene_date.slice(0,4)+")":""));
if(b.real)t.push("Real business, name changed");
return"<b>"+esc(b.name)+"</b><br>"+esc(b.type+" · "+b.area)+'<div class="row" style="gap:6px;margin-top:8px">'+t.map(function(x){return pill(x)}).join("")+"</div>"}

function drawBizMap(){var el=document.getElementById("bizmap");if(!el||typeof L==="undefined")return;
if(bizMap){bizMap.remove();bizMap=null}
bizMap=L.map(el).setView([54.975,-1.6],13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Hygiene ratings: FSA, OGL v3.0'}).addTo(bizMap);
fetch("/api/businesses").then(function(r){return r.json()}).then(function(list){if(!bizMap)return;var pts=[];
list.forEach(function(b){L.circleMarker([b.lat,b.lng],{radius:b.claimed?9:6,color:"#fff",weight:2,fillColor:b.claimed?"#14B5AE":"#F2A541",fillOpacity:.95}).bindPopup(mapPopup(b)).addTo(bizMap);pts.push([b.lat,b.lng])});
if(pts.length)bizMap.fitBounds(pts,{padding:[30,30]})}).catch(function(){toast("Couldn’t load the map. Is the server running?")})}
