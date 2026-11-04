// NEhelp: messages between companies and small business owners
// Loaded as a plain script; everything shares one global scope, in the order index.html lists.
// Companies contact owners through NEhelp, so an owner's name and details stay private until they accept an offer.

function msgsFor(biz,company){return S.messages.filter(function(m){return m.biz===biz&&(!company||m.company===company)})}
function bubble(m,mineSide){var who=m.from===mineSide?"You":(m.from==="company"?(COMP[m.company]||"A company"):"The business owner");
return'<div class="msg'+(m.from===mineSide?" me":"")+'"><small>'+esc(who)+" · "+esc(m.at)+"</small><p>"+esc(m.text)+"</p></div>"}
function thread(list,mineSide){return list.length?'<div class="thread">'+list.map(function(m){return bubble(m,mineSide)}).join("")+"</div>":'<p class="hint">No messages yet.</p>'}

// Small business: everything companies have sent you, grouped by company, with a reply box.
function bMessages(){var mm=msgsFor("me"),byCo={};
mm.forEach(function(m){(byCo[m.company]=byCo[m.company]||[]).push(m)});
var cos=Object.keys(byCo);
var body='<div class="bar"><h2>Messages</h2></div><p class="hint" style="margin-bottom:16px">Companies that want to help you. Your contact details stay private: replies go through NEhelp.</p>'+
(cos.length?cos.map(function(c){var l=byCo[c],iss=byId(l[0].issue),nu=l.filter(function(m){return m.from==="company"&&!m.read}).length;
return'<section class="panel convo" style="max-width:none"><div class="row" style="justify-content:space-between;margin-bottom:10px"><div><h3 style="font-size:18px">'+esc(COMP[c]||c)+(nu?" "+pill(nu+" new","warn"):"")+"</h3>"+(iss?'<p class="meta">About “'+esc(iss.title)+"” "+svc(iss.cat)+"</p>":"")+"</div></div>"+thread(l,"business")+
'<label class="field" style="margin-top:12px"><span>Reply to '+esc(COMP[c]||c)+'</span><textarea id="rp-'+c+'" style="min-height:70px" placeholder="Thanks! That works for me…"></textarea></label><div class="row"><button class="btn pri" data-a="reply" data-c="'+c+'" data-issue="'+(iss?iss.id:"")+'">Send reply</button></div></section>'}).join("")
:'<div class="empty"><h3>No messages yet</h3><p>When a company contacts you about a request, it shows up here.</p></div>');
// Opening the inbox marks everything as read.
mm.forEach(function(m){if(m.from==="company")m.read=true});save();
return shell("b-messages",body,bSum())}

// Company: businesses you can contact (open requests in your areas, and businesses you already work with).
function cMessages(){var seen={},list=[];
S.issues.forEach(function(i){if(seen[i.biz])return;if(i.company==="tyne"||(i.status==="open"&&!fitReason(i))){seen[i.biz]=1;list.push(i)}});
var body='<div class="bar"><h2>Contact businesses</h2></div><p class="hint" style="margin-bottom:16px">Message the owner of any request that fits your team. They’ll see it in their NEhelp inbox. Names stay hidden until they accept an offer.</p>'+
(list.length?list.map(function(i){var l=msgsFor(i.biz,"tyne");
return'<section class="panel convo" style="max-width:none"><div class="row" style="justify-content:space-between;gap:12px;margin-bottom:10px"><div><h3 style="font-size:18px">'+esc(whoFor(i))+'</h3><p class="meta">“'+esc(i.title)+"” "+svc(i.cat)+" · "+esc(i.help)+"</p></div>"+
'<button class="btn cta" data-a="contact" data-id="'+i.id+'">'+(l.length?"Send another message":"Contact the owner")+"</button></div>"+(l.length?thread(l,"company"):"")+"</section>"}).join("")
:'<div class="empty"><h3>No businesses to contact yet</h3><p>Requests that fit your team will show up here.</p></div>');
return shell("c-messages",body,cSum())}

// The pop-up for writing a message, from either side.
var MSG_STARTERS={company:["We can help with this. When suits you?","Could we have a quick call this week?","Here’s what we’d suggest:"],business:["Thanks, that sounds great.","What times work for you?","Can you tell me a bit more?"]};
function contactDlg(id){var i=byId(id),co=S.role==="company",to=co?whoFor(i):(COMP[i.company]||"the company");openId=null;
dlg('<h2>Message '+esc(to)+'</h2><p class="hint">About “'+esc(i.title)+"” "+svc(i.cat)+'</p><div class="chips" style="margin-top:12px">'+MSG_STARTERS[co?"company":"business"].map(function(t,k){return'<button class="chip" data-a="starter" data-k="'+k+'">'+esc(t)+"</button>"}).join("")+
'</div><label class="field"><span>Your message</span><textarea id="msg" style="min-height:110px"></textarea><span class="err" id="msgerr"></span></label><div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn pri" data-a="sendmsg" data-id="'+i.id+'">Send message</button></div>',"msg")}
