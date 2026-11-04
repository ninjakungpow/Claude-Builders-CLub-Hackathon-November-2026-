// NEhelp: page shell, side nav and shared building blocks
// Loaded as a plain script; everything shares one global scope, in the order index.html lists.

function shell(cur,body,sum){var n=nav();return'<div class="shell"><nav class="side" id="side" aria-label="Main">'+n.map(function(x){return'<button class="nav" data-go="'+x[0]+'"'+(x[0]===cur?' aria-current="page"':"")+">"+esc(x[1])+"</button>"}).join("")+'<button class="nav out" data-a="logout">Log out</button></nav><main class="main">'+body+'</main><aside class="sum" aria-label="Summary"><div class="sumcard"><h2>Summary</h2>'+sum+"</div></aside></div>"}
function sumRows(rows){return rows.map(function(r){return'<div class="sumrow"><span class="k">'+r[0]+"</span><b>"+esc(r[1])+"</b><span>"+esc(r[2])+"</span></div>"}).join("")}
function stat(a,b,c){return'<div class="stat '+(c||"")+'"><small>'+esc(a)+"</small><b>"+esc(b)+"</b></div>"}
function viewbar(title){return'<div class="bar"><h2>'+esc(title)+'</h2><button class="tbtn" data-a="settings">'+ico("gear")+'Display</button><button class="tbtn" data-a="toggleview">'+ico("eye")+(S.ui.view==="grid"?"Grid view":"List view")+"</button></div>"}
function visible(list){return S.ui.hideClosed?list.filter(function(i){return i.status!=="done"&&i.status!=="notneeded"}):list}
