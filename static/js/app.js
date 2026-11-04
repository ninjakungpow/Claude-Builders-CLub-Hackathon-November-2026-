// NEhelp: routing, button actions and start-up
// Loaded as a plain script; everything shares one global scope, in the order index.html lists.

var VIEWS={"b-issues":bIssues,"b-map":bMap,"b-new":bNew,"b-update":bUpdate,"b-companies":bCompanies,"c-requests":cRequests,"c-add":cAdd,"c-specialty":cSpec,"c-companies":cCompanies};
function render(){var v=location.hash.slice(1),app=$("#app");menu();closeSide();
if(!S.role){app.innerHTML=landing();return}
if(S.role==="business"&&!S.claimed){app.innerHTML=onboarding();return}
if(!VIEWS[v]||v.charAt(0)!==(S.role==="business"?"b":"c")){v=S.role==="business"?"b-issues":"c-requests";history.replaceState(null,"","#"+v)}
app.innerHTML=VIEWS[v]();if(v==="b-map")drawBizMap()}

function after(m){save();render();refreshDlg();if(m)toast(m)}
function act(a,d,el){var i=d.id?byId(d.id):null;
switch(a){
case"close":closeDlg();break;
case"how":var hw=document.getElementById("how");if(hw)hw.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"auto":"smooth"});break;
case"role":S.role=d.r;ob={step:1,mode:"ch",err:""};save();go(d.r==="business"?(S.claimed?"b-issues":"onboarding"):"c-requests");break;
case"switch":S.role=S.role==="business"?"company":"business";$("#menu").hidden=true;save();location.hash=S.role==="business"?"b-issues":"c-requests";render();break;
case"logout":S.role=null;save();location.hash="";render();break;
case"reset":S=seed();save();ob={step:1,mode:"ch",err:""};req=null;closeDlg();$("#menu").hidden=true;location.hash="";render();toast("Demo data reset");break;
case"ob-next":ob.step=2;ob.err="";render();break;
case"ob-mode":ob.mode=d.m;ob.err="";render();break;
case"ob-verify":var v=$("#ob-id").value.trim(),c=$("#ob-code").value.trim();
if(ob.mode==="ch"&&!/^[A-Za-z0-9]{8}$/.test(v))ob.err="Enter your 8-character company number.";else if(ob.mode==="em"&&!/^\S+@\S+\.\S+$/.test(v))ob.err="Enter a valid email address.";else if(!/^\d{6}$/.test(c))ob.err="Enter the six-digit code.";else{ob.err="";ob.step=3}render();break;
case"ob-finish":S.business.name=$("#ob-name").value.trim()||S.business.name;S.business.hours=$("#ob-hours").value.trim()||S.business.hours;S.business.address=$("#ob-addr").value.trim()||S.business.address;S.claimed=true;save();go("b-issues");toast("Page claimed");break;
case"open":showIssue(d.id);break;
case"fav":i.fav=!i.fav;after();break;
case"toggleview":S.ui.view=S.ui.view==="grid"?"list":"grid";after();break;
case"settings":setDlg();break;
case"savesettings":S.ui.hideClosed=$("#hc").checked;closeDlg();after("Display saved");break;
case"idea":$("#talk").value=IDEAS[+d.k];break;
case"make":var t=$("#talk").value.trim();if(!t){newErr="Tell us what would help first.";render();return}newErr="";var mb=$('[data-a="make"]');mb.disabled=true;mb.textContent="Claude is drafting your request…";fetch("/api/draft-request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t,business:S.business})}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error);return j})}).then(function(j){req=j;req.byClaude=true}).catch(function(){req=guess(t);toast("Claude wasn\u2019t available, so we drafted it here")}).then(function(){render()});break;
case"rhelp":req.help=d.h;req.title=$("#r-title").value;req.cat=$("#r-cat").value;req.check=$("#r-check").value.split("\n");req.hours=$("#r-hours").value;render();break;
case"rback":req=null;newErr="";render();break;
case"rdraft":case"rsend":var ti=$("#r-title").value.trim(),ch=$("#r-check").value.split("\n").map(function(x){return x.trim()}).filter(Boolean),hr=parseInt($("#r-hours").value,10);
if(!ti){newErr="Add a title.";render();return}if(!ch.length){newErr="Add at least one thing you need.";render();return}
S.issues.unshift({id:"i"+Date.now(),biz:"me",title:ti,cat:$("#r-cat").value,desc:req.desc||ch[0],check:ch,help:req.help,hours:hr>0?hr:ch.length*2,status:a==="rsend"?"open":"draft",company:null,employee:null,fav:false});
req=null;newErr="";save();go("b-issues");toast(a==="rsend"?"Request sent to companies":"Draft saved");break;
case"send":i.status="open";after("Request sent to companies");break;
case"notneeded":i.status="notneeded";after("Marked not needed");break;
case"reopen":i.status="open";after("Request reopened");break;
case"del":S.issues=S.issues.filter(function(x){return x.id!==d.id});closeDlg();after("Removed");break;
case"accept":i.status="inprogress";after(COMP[i.company]+" is on it");break;
case"decline":i.status="open";i.company=null;i.employee=null;after("Offer declined");break;
case"message":msgDlg(d.id);break;
case"sendmsg":if(!$("#msg").value.trim()){$("#msgerr").textContent="Write a message first.";return}closeDlg();toast("Message sent");break;
case"handover":handover(d.id);break;
case"assign":i.status="offered";i.company="tyne";i.employee=$("#asg").value;after("Offer sent");break;
case"withdraw":i.status="open";i.company=null;i.employee=null;after("Offer withdrawn");break;
case"finish":i.status="done";after("Marked done");break;
case"addemp":var nm=$("#en").value.trim();if(!nm){newErr="Enter a name.";render();return}newErr="";S.employees.push({id:"e"+Date.now(),name:nm,specialty:$("#es").value,available:true});after("Employee added");break;
case"rename":if(el.value.trim()){i.title=el.value.trim();save();toast("Title saved")}break;
case"setstatus":i.status=el.value;after("Status updated");break;
case"espec":emp(d.id).specialty=el.value;after("Specialty updated");break;
case"eavail":emp(d.id).available=el.checked;after("Availability updated");break}}

document.addEventListener("click",function(e){var g=e.target.closest("[data-go]");if(g){closeDlg();go(g.dataset.go);return}
var a=e.target.closest("[data-a]");if(!a||a.tagName==="SELECT"||a.tagName==="INPUT"&&a.type!=="checkbox")return;if(a.tagName==="INPUT")return;
if(a.classList.contains("heart")||a.dataset.a!=="open"||!e.target.closest(".heart")){act(a.dataset.a,a.dataset,a)}
if(!e.target.closest("#menu")&&!e.target.closest("#avatar"))$("#menu").hidden=true;
if(a.dataset.a==="switch"||a.dataset.a==="reset")$("#menu").hidden=true});
document.addEventListener("change",function(e){var a=e.target.closest("[data-a]");if(a&&(a.tagName==="SELECT"||a.tagName==="INPUT"))act(a.dataset.a,a.dataset,a)});
document.addEventListener("keydown",function(e){if(e.key==="Enter"&&e.target.classList&&e.target.classList.contains("card")){e.preventDefault();act("open",e.target.dataset,e.target)}if(e.key==="Escape")$("#menu").hidden=true});
document.addEventListener("click",function(e){if(!e.target.closest("#menu")&&!e.target.closest("#avatar"))$("#menu").hidden=true});
$("#avatar").addEventListener("click",function(){var m=$("#menu");m.hidden=!m.hidden;this.setAttribute("aria-expanded",!m.hidden)});
$("#brand").addEventListener("click",function(){go(S.role==="business"?"b-issues":S.role==="company"?"c-requests":"")});
function closeSide(){var s=$("#side");if(s)s.classList.remove("open");$("#scrim").classList.remove("open")}
$("#burger").addEventListener("click",function(){var s=$("#side");if(!s)return;s.classList.toggle("open");$("#scrim").classList.toggle("open",s.classList.contains("open"))});
$("#scrim").addEventListener("click",closeSide);
$("#dlg").addEventListener("click",function(e){if(e.target===this)closeDlg()});
window.addEventListener("hashchange",render);
render();
