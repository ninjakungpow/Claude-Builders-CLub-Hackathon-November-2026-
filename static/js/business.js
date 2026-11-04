// NEhelp: small business views (overview, new issue, updates, companies)
// Loaded as a plain script; everything shares one global scope, in the order index.html lists.

function bcard(i){var s=BL[i.status];return'<article class="card" tabindex="0" role="button" data-a="open" data-id="'+i.id+'"><div class="grow"><div class="top2"><h3>'+esc(i.title)+'</h3><button class="heart" data-a="fav" data-id="'+i.id+'" aria-pressed="'+!!i.fav+'" aria-label="Save '+esc(i.title)+'">'+ico("heart",i.fav)+"</button></div>"+pill(i.cat)+'<p style="margin-top:8px">'+esc(i.desc)+'</p></div><div class="foot">'+pill(s[0],s[1])+'<span class="meta">About '+i.hours+" hours</span></div></article>"}
function bIssues(){var m=visible(mine());var st=CATS.map(function(c){var s=catStatus(c);return stat(c,s[0],s[1]==="warn"?"warn":s[1])}).join("");
var sum=sumRows(CATS.map(function(c){var s=catStatus(c),n=mine().filter(function(i){return i.cat===c&&i.status!=="notneeded"&&i.status!=="done"}).length;return[c[0],c,[s[0],n?n+" active":"No active requests"].slice(0,2).join("|")]}).map(function(r){var p=r[2].split("|");return[r[0],r[1],p[0]+(p[1]?" · "+p[1]:"")]}));
var body=quick([["b-new","List new issue"],["b-map","Open the map"],["b-companies","Offers and companies"],["b-account","Your account"]])+'<div class="status">'+st+"</div>"+viewbar("Your issues")+(m.length?'<div class="cards '+(S.ui.view==="list"?"list":"")+'">'+m.map(bcard).join("")+"</div>":'<div class="empty"><h3>Nothing listed yet</h3><p>Tell us what would help and we’ll ask companies on your behalf.</p><div class="row" style="justify-content:center"><button class="btn pri" data-go="b-new">List new issue</button></div></div>');
return shell("b-issues",body+bInfo(),sum)}

var IDEAS=["Our website is out of date and I need online booking","I’m drowning in invoices and need a simple system","I need two part-time staff for weekends","I want help with Instagram and photos"];
function bNew(){var body='<div class="bar"><h2>List new issue</h2></div>';
if(!req){body+='<div class="panel"><p class="hint">Ideas only you can see</p><div class="chips">'+IDEAS.map(function(t,k){return'<button class="chip" data-a="idea" data-k="'+k+'">'+esc(t)+"</button>"}).join("")+'</div><label class="field"><span>Or just tell us</span><textarea id="talk" placeholder="Our website is old and I’m drowning in invoices…"></textarea>'+(newErr?'<span class="err">'+esc(newErr)+"</span>":"")+'</label><div class="row"><button class="btn pri" data-a="make">Turn into a request</button></div><p class="hint" style="margin-top:14px">Claude turns your words into a clear request. Nothing is sent until you check it.</p></div>'}
else body+='<div class="panel"><p class="hint" style="margin-bottom:14px">'+(req.byClaude?"Drafted by Claude":"Drafted for you")+'. Change anything before you send it.</p><label class="field"><span>Title</span><input type="text" id="r-title" value="'+esc(req.title)+'"></label><label class="field"><span>Area</span><select id="r-cat">'+CATS.map(function(c){return"<option"+(c===req.cat?" selected":"")+">"+c+"</option>"}).join("")+'</select></label><label class="field"><span>What you need (one per line)</span><textarea id="r-check" style="min-height:110px">'+esc(req.check.join("\n"))+'</textarea></label><div class="field"><span>Help you’d like</span><div class="seg">'+["Free","Discounted","Paid"].map(function(h){return'<button data-a="rhelp" data-h="'+h+'" aria-pressed="'+(req.help===h)+'">'+h+"</button>"}).join("")+'</div></div><label class="field"><span>About how many hours</span><input type="text" id="r-hours" inputmode="numeric" value="'+req.hours+'" style="max-width:120px"></label>'+(newErr?'<p class="err">'+esc(newErr)+"</p>":"")+'<div class="row"><button class="btn" data-a="rback">Start again</button><button class="btn" data-a="rdraft">Save as draft</button><button class="btn cta" data-a="rsend">Send request</button></div></div>';
return shell("b-new",body,bSum())}
function bSum(){return sumRows(CATS.map(function(c){var s=catStatus(c);return[c[0],c,s[0]]}))}
function guess(t){var l=t.toLowerCase(),c="Marketing",ti;
if(/invoice|tax|vat|account|payroll|bookkeep|money|cash|bill/.test(l))c="Finance";else if(/hire|staff|recruit|job|intern|student|shift|rota|employ/.test(l))c="Employment";
if(/website|web site|booking/.test(l))ti="Website refresh";else if(/invoice/.test(l))ti="Invoice setup";else if(/staff|hire|recruit/.test(l))ti="Hire staff";else if(/instagram|social|photo/.test(l))ti="Social media help";else{var w=t.trim().split(/\s+/).slice(0,5).join(" ");ti=w.charAt(0).toUpperCase()+w.slice(1)}
var parts=t.split(/[.,;\n]| and /).map(function(x){return x.trim()}).filter(function(x){return x.length>3}).slice(0,4).map(function(x){return x.charAt(0).toUpperCase()+x.slice(1)});
if(!parts.length)parts=["Talk through what’s needed"];
return{title:ti,cat:c,check:parts,help:"Free",hours:parts.length*2,desc:t.trim().slice(0,120)}}

function bUpdate(){var m=mine();var body='<div class="bar"><h2>Update issues</h2></div>'+(m.length?'<div class="list-rows">'+m.map(function(i){var ed=i.status==="draft"||i.status==="open"||i.status==="notneeded";return'<div class="lrow"><div class="grow"><input type="text" data-a="rename" data-id="'+i.id+'" value="'+esc(i.title)+'" aria-label="Title"><p class="meta" style="margin-top:4px">'+esc(i.cat)+"</p></div>"+(ed?'<select data-a="setstatus" data-id="'+i.id+'" aria-label="Status"><option value="draft"'+(i.status==="draft"?" selected":"")+'>Draft</option><option value="open"'+(i.status==="open"?" selected":"")+'>Looking for a company</option><option value="notneeded"'+(i.status==="notneeded"?" selected":"")+">Not needed</option></select>":pill(BL[i.status][0],BL[i.status][1]))+'<button class="btn" data-a="open" data-id="'+i.id+'">Details</button>'+(i.status==="draft"||i.status==="notneeded"?'<button class="btn dng" data-a="del" data-id="'+i.id+'">Remove</button>':"")+"</div>"}).join("")+"</div>":'<div class="empty"><h3>No issues to update</h3><p>List what you need and it will show up here.</p></div>');
return shell("b-update",body,bSum())}

function bCompanies(){var m=mine().filter(function(i){return i.company});var off=m.filter(function(i){return i.status==="offered"}),act=m.filter(function(i){return i.status==="inprogress"}),dn=m.filter(function(i){return i.status==="done"});
function row(i,btns){var e=emp(i.employee);return'<div class="lrow"><div class="grow"><b>'+esc(COMP[i.company])+"</b><p class=\"meta\">"+esc(i.title)+(e?" · "+esc(e.name):"")+(i.price?" · £"+i.price:" · Free")+"</p></div>"+btns+"</div>"}
var body='<div class="bar"><h2>Update company relationships</h2></div>';
body+='<h3 class="sec">Offers waiting</h3>'+(off.length?'<div class="list-rows">'+off.map(function(i){return row(i,'<button class="btn dng" data-a="decline" data-id="'+i.id+'">Decline</button><button class="btn pri" data-a="accept" data-id="'+i.id+'">Accept offer</button>')}).join("")+"</div>":'<div class="empty">No offers yet. Companies will show up here when they offer help.</div>');
body+='<h3 class="sec">Working with you</h3>'+(act.length?'<div class="list-rows">'+act.map(function(i){return row(i,'<button class="btn" data-a="message" data-id="'+i.id+'">Message</button>')}).join("")+"</div>":'<div class="empty">Nobody yet.</div>');
if(dn.length)body+='<h3 class="sec">Finished</h3><div class="list-rows">'+dn.map(function(i){return row(i,'<button class="btn" data-a="handover" data-id="'+i.id+'">Handover guide</button>')}).join("")+"</div>";
return shell("b-companies",body,bSum())}

// Information sections under the business overview
function bNext(){var m=mine(),L=[],off=m.filter(function(i){return i.status==="offered"}).length,op=m.filter(function(i){return i.status==="open"}).length,dr=m.filter(function(i){return i.status==="draft"}).length;
if(off)L.push(["b-companies",off+(off===1?" offer is waiting for you":" offers are waiting for you"),"Review"]);
if(dr)L.push(["b-update",dr+(dr===1?" draft hasn’t been sent":" drafts haven’t been sent"),"Send"]);
if(op)L.push(["b-update",op+(op===1?" request is out with companies":" requests are out with companies"),"Manage"]);
L.push(["b-map","See who else is nearby","Map"]);L.push(["b-new","Tell us about something new","List issue"]);return L}
function bActivity(){var out=[];mine().forEach(function(i){var c=COMP[i.company]||"A company";
if(i.status==="inprogress")out.push(["Agreement signed with "+c+" for “"+i.title+"”",i.signed||""]);
else if(i.status==="offered")out.push([c+" offered help with “"+i.title+"”",""]);
else if(i.status==="open")out.push(["“"+i.title+"” is out with companies",""]);
else if(i.status==="draft")out.push(["Draft saved: “"+i.title+"”",""]);
else if(i.status==="done")out.push(["“"+i.title+"” finished with "+c,i.signed||""]);
else out.push(["“"+i.title+"” marked not needed",""])});return out.slice(0,6)}
var DIRECTORY=[{name:"Northumbria University",areas:"Employment",where:"Newcastle",help:"Free"},{name:"Wear Accountants",areas:"Finance",where:"Sunderland",help:"Discounted or paid"},{name:"Durham HR Partners",areas:"Employment, Finance",where:"Durham",help:"Paid"}];
function directory(){var c=S.company,h=["Free","Discounted","Paid"].filter(function(x){return c.help[x]}).join(", ").toLowerCase();return[{name:c.name,areas:c.areas.join(", "),where:c.districts.join(", "),help:h.charAt(0).toUpperCase()+h.slice(1)}].concat(DIRECTORY)}
function bInfo(){var dir=directory().map(function(d){return'<li><span><b>'+esc(d.name)+'</b><br><span class="meta">'+esc(d.areas)+" · "+esc(d.where)+" · "+esc(d.help)+"</span></span></li>"}).join("");
return'<div class="infogrid">'+
infocard("Next steps",linklist(bNext()))+
infocard("Recent activity",actlist(bActivity()))+
infocard("Companies ready to help",'<ul class="linklist">'+dir+"</ul>",false,'<button class="tbtn" data-go="b-map">Find them on the map</button>')+
infocard("Good to know",faq([["Is my business name public?","No. Companies see your type and area, such as “Café in Newcastle”, until you accept an offer."],["What do free, discounted and paid mean?","You choose when you list an issue. Companies only make offers that match, and the price is shown before you accept."],["What if I don’t like an offer?","Decline it. Your request goes back out to other companies."],["Who sees my private needs?","Only what you choose to share. Everything else stays with you."]]))+
mapcard("b-map")+"</div>"}
function bAccount(){return shell("b-account",accountBody("business"),bSum())}
