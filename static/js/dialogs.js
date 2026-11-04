// NEhelp: pop-up dialogs: issue details, handover guide, messages, display
// Loaded as a plain script; everything shares one global scope, in the order index.html lists.

function dlg(html,kind){var d=$("#dlg");d.innerHTML='<div class="dl">'+html+"</div>";dlgKind=kind||null;if(!d.open)d.showModal()}
function closeDlg(){var d=$("#dlg");if(d.open)d.close();openId=null;dlgKind=null}
function refreshDlg(){if(!$("#dlg").open)return;if(openId)showIssue(openId)}
function showIssue(id){openId=id;var i=S.issues.filter(function(x){return x.id===id})[0];if(!i)return;var biz=S.role==="business",e=emp(i.employee),s=biz?BL[i.status]:(CL[i.status]||["",""]);
var h='<h2>'+esc(biz?i.title:whoFor(i))+'</h2><div class="row" style="margin:0 0 12px">'+pill(i.cat)+pill(s[0],s[1])+"</div>"+(biz?"":'<p style="margin-bottom:6px"><b>'+esc(i.title)+"</b></p>")+"<p>"+esc(i.desc)+'</p><ul class="check">'+i.check.map(function(c){return"<li>"+esc(c)+"</li>"}).join("")+'</ul><p class="meta">About '+i.hours+" hours · "+esc(i.help)+" help</p>";
var a="";
if(biz){
if(i.status==="draft")a='<button class="btn pri" data-a="send" data-id="'+i.id+'">Send to companies</button><button class="btn dng" data-a="del" data-id="'+i.id+'">Remove</button>';
if(i.status==="open")a='<button class="btn" data-a="notneeded" data-id="'+i.id+'">Mark not needed</button>';
if(i.status==="offered"){h+='<div class="note"><b>'+esc(COMP[i.company])+"</b> has offered help"+(e?" with "+esc(e.name):"")+". Nothing’s agreed until you accept.</div>";a='<button class="btn dng" data-a="decline" data-id="'+i.id+'">Decline</button><button class="btn pri" data-a="accept" data-id="'+i.id+'">Accept offer</button>'}
if(i.status==="inprogress")a='<button class="btn" data-a="message" data-id="'+i.id+'">Message '+esc(COMP[i.company])+"</button>";
if(i.status==="done")a='<button class="btn pri" data-a="handover" data-id="'+i.id+'">View handover guide</button>';
if(i.status==="notneeded")a='<button class="btn" data-a="reopen" data-id="'+i.id+'">Reopen</button>'}
else{
if(i.status==="open"){var f=freeIn(i.cat);h+=f.length?'<label class="field" style="margin-top:14px"><span>Assign an employee</span><select id="asg">'+f.map(function(x){return'<option value="'+x.id+'">'+esc(x.name)+"</option>"}).join("")+"</select></label>":'<div class="note">No one is free in '+esc(i.cat)+". Add an employee or update someone’s specialty first.</div>";
a=f.length?'<button class="btn cta" data-a="assign" data-id="'+i.id+'">Send offer</button>':'<button class="btn" data-go="c-add">Add new employee</button>'}
if(i.status==="offered")a='<button class="btn" data-a="withdraw" data-id="'+i.id+'">Withdraw offer</button>';
if(i.status==="inprogress"&&i.company==="tyne")a='<button class="btn" data-a="message" data-id="'+i.id+'">Message</button><button class="btn pri" data-a="finish" data-id="'+i.id+'">Mark done</button>';
if(i.status==="done")a='<button class="btn" data-a="handover" data-id="'+i.id+'">View handover guide</button>'}
dlg(h+'<div class="row">'+a+'<button class="btn" data-a="close">Close</button></div>',"issue")}
var TIPS={Marketing:["Ask for your admin logins and keep them in a password manager.","Check opening hours and prices online once a month.","Post or update something at least once a week."],Finance:["Keep every receipt in one folder, paper or digital.","Send invoices within three days of finishing a job.","Check your bank balance against unpaid invoices every Friday."],Employment:["Keep signed contracts somewhere safe and backed up.","Check holiday balances at the start of each month.","Review next week’s rota every Friday."]};
function handover(id){var i=S.issues.filter(function(x){return x.id===id})[0],e=emp(i.employee);openId=null;
dlg('<h2>Handover guide</h2><p class="hint">'+esc(i.title)+"</p><h3 style=\"font-size:17px;margin:18px 0 4px\">What was done</h3><ul class=\"check\">"+i.check.map(function(c){return"<li>"+esc(c)+"</li>"}).join("")+'</ul><h3 style="font-size:17px;margin:18px 0 4px">Keeping it going</h3><ul class="check">'+TIPS[i.cat].map(function(t){return"<li>"+esc(t)+"</li>"}).join("")+'</ul><h3 style="font-size:17px;margin:18px 0 4px">Who to ask</h3><p>'+esc(COMP[i.company]||"Your company")+(e?", "+esc(e.name):"")+". Message them in NEhelp any time.</p>"+'<div class="row"><button class="btn" data-a="close">Close</button></div>',"guide")}
function msgDlg(id){openId=null;dlg('<h2>Send a message</h2><label class="field" style="margin-top:12px"><span>Your message</span><textarea id="msg" style="min-height:110px" placeholder="Hi, quick question about timing…"></textarea><span class="err" id="msgerr"></span></label><div class="row"><button class="btn" data-a="close">Cancel</button><button class="btn pri" data-a="sendmsg">Send message</button></div>',"msg")}
function setDlg(){dlg('<h2>Display</h2><label class="row" style="gap:10px;margin-top:12px"><input type="checkbox" id="hc"'+(S.ui.hideClosed?" checked":"")+'> Hide finished and not-needed items</label><div class="row"><button class="btn pri" data-a="savesettings">Save</button><button class="btn" data-a="close">Cancel</button></div>',"settings")}

function byId(id){return S.issues.filter(function(x){return x.id===id})[0]}
