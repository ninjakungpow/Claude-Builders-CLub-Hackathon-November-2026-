// NEhelp: routing, button actions and start-up
// Loaded as a plain script; everything shares one global scope, in the order index.html lists.

var VIEWS={"b-issues":bIssues,"b-map":bMap,"b-new":bNew,"b-update":bUpdate,"b-companies":bCompanies,"c-requests":cRequests,"c-add":cAdd,"c-specialty":cSpec,"c-companies":cCompanies,"c-profile":cProfile,"c-map":cMap,"b-account":bAccount,"c-account":cAccount};
// Colour the whole site by side (blue for small businesses, orange for companies) and keep the top Map button in step with who is signed in.
function topbar(v){document.body.dataset.side=S.role||"";var b=$("#topmap");b.hidden=false;
if(S.role){b.dataset.go=S.role==="business"?"b-map":"c-map";b.removeAttribute("data-a")}else{b.removeAttribute("data-go");b.dataset.a="topmap"}
b.setAttribute("aria-pressed",String(v==="b-map"||v==="c-map"))}
function render(){var v=location.hash.slice(1),app=$("#app");menu();closeSide();topbar("");
if(!S.role||v==="home"){app.innerHTML=landing();drawMini();return}
if(S.role==="business"&&!S.claimed){app.innerHTML=onboarding();return}
if(S.role==="company"&&!S.company.onboarded){app.innerHTML=coOnboarding();return}
if(!VIEWS[v]||v.charAt(0)!==(S.role==="business"?"b":"c")){v=S.role==="business"?"b-issues":"c-requests";history.replaceState(null,"","#"+v)}
app.innerHTML=VIEWS[v]();topbar(v);if(v==="b-map"||v==="c-map")drawBizMap();drawMini()}

function after(m){save();render();refreshDlg();if(m)toast(m)}
function act(a,d,el){var i=d.id?byId(d.id):null;
switch(a){
case"close":closeDlg();break;
case"mapmode":S.ui.mapMode=d.m;after();break;
case"topmap":if(S.role==="business")go("b-map");else if(S.role==="company")go("c-map");else location.href="/map.html";break;
case"acc-save":var ac=S.accounts[S.role];ac.name=$("#ac-name").value.trim()||ac.name;ac.email=$("#ac-email").value.trim();ac.phone=$("#ac-phone").value.trim();ac.title=$("#ac-title").value.trim()||ac.title;save();render();toast("Account saved");break;
case"acc-notify":S.accounts[S.role].notify[d.k]=el.checked;save();toast("Preference saved");break;
case"acc-download":try{var dat={role:S.role,account:S.accounts[S.role],organisation:S.role==="business"?S.business:S.company,requests:S.role==="business"?mine():S.issues.filter(function(x){return x.company==="tyne"})},bl=new Blob([JSON.stringify(dat,null,2)],{type:"application/json"}),ur=URL.createObjectURL(bl),an=document.createElement("a");an.href=ur;an.download="nehelp-my-data.json";document.body.appendChild(an);an.click();an.remove();setTimeout(function(){URL.revokeObjectURL(ur)},1000);toast("Your data is downloading")}catch(e){toast("Couldn’t prepare the download")}break;
case"acc-delete":confirmDeleteDlg();break;
case"acc-delete-yes":S=seed();save();ob={step:1,mode:"ch",err:""};co={step:1,err:""};req=null;closeDlg();location.hash="";render();toast("Account deleted");break;
case"bizedit":bizEditDlg();break;
case"bizedit-save":S.business.name=$("#be-name").value.trim()||S.business.name;S.business.hours=$("#be-hours").value.trim()||S.business.hours;S.business.address=$("#be-addr").value.trim()||S.business.address;save();closeDlg();render();toast("Business details saved");break;
case"cotoggle":grabCo();var tk=d.k,tv=d.v;if(tk==="help")S.company.help[tv]=!S.company.help[tv];else{var ta=S.company[tk],tx=ta.indexOf(tv);if(tx>-1)ta.splice(tx,1);else ta.push(tv)}save();render();break;
case"coterms":S.company.terms=el.checked;save();break;
case"co-back":grabCo();co.step=Math.max(1,co.step-1);co.err="";newErr="";render();break;
case"co-next":grabCo();var cc=S.company,er="";
if(co.step===1){if(!cc.name)cc.name="Tyne Digital"}
else if(co.step===2){if(!cc.areas.length)er="Pick at least one area.";else if(!cc.districts.length)er="Pick at least one place.";else if(!(cc.hours>0))er="Enter how many hours a month your team can give."}
else if(co.step===3){if(!S.employees.length)er="Add at least one person."}
co.err=er;if(!er){co.step++;newErr=""}save();render();break;
case"co-finish":grabCo();var c2=S.company;if(!HELPS.some(function(x){return c2.help[x]}))co.err="Pick at least one kind of work.";else if(!c2.terms)co.err="Agree to the partner terms to continue.";else{c2.onboarded=true;COMP.tyne=c2.name;co.err="";save();go("c-requests");toast("Welcome to NEhelp");break}render();break;
case"profile-save":grabCo();COMP.tyne=S.company.name;save();render();toast("Profile saved");break;
case"how":var hw=document.getElementById("how");if(hw)hw.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"auto":"smooth"});break;
case"role":S.role=d.r;ob={step:1,mode:"ch",err:""};co={step:1,err:""};save();go(d.r==="business"?(S.claimed?"b-issues":"onboarding"):(S.company.onboarded?"c-requests":"c-onboarding"));break;
case"logout":S.role=null;save();location.hash="";render();break;
case"reset":S=seed();save();ob={step:1,mode:"ch",err:""};req=null;closeDlg();$("#menu").hidden=true;location.hash="";render();toast("Demo data reset");break;
case"ob-next":ob.step=2;ob.err="";render();break;
case"ob-mode":ob.mode=d.m;ob.err="";render();break;
case"ob-verify":ob.err="";ob.step=3;render();break;
case"ob-finish":S.business.name=$("#ob-name").value.trim()||S.business.name;S.business.hours=$("#ob-hours").value.trim()||S.business.hours;S.business.address=$("#ob-addr").value.trim()||S.business.address;S.claimed=true;save();go("b-issues");toast("Page claimed");break;
case"open":showIssue(d.id);break;
case"fav":i.fav=!i.fav;after();break;
case"toggleview":S.ui.view=S.ui.view==="grid"?"list":"grid";after();break;
case"settings":setDlg();break;
case"savesettings":S.ui.hideClosed=$("#hc").checked;if($("#om"))S.ui.onlyMine=$("#om").checked;closeDlg();after("Display saved");break;
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
case"accept":i.status="inprogress";i.signed=today();after("Agreement signed with "+COMP[i.company]);break;
case"decline":i.status="open";i.company=null;i.employee=null;i.price=null;i.note="";after("Offer declined");break;
case"message":msgDlg(d.id);break;
case"sendmsg":if(!$("#msg").value.trim()){$("#msgerr").textContent="Write a message first.";return}closeDlg();toast("Message sent");break;
case"handover":handover(d.id);break;
case"assign":var hh=parseInt($("#ofh").value,10),op=$("#ofp");if(!(hh>0)){$("#oferr").textContent="Enter the hours as a number.";return}
if(op&&!(op.value.trim()!==""&&parseFloat(op.value)>=0)){$("#oferr").textContent="Enter a price in pounds.";return}
i.hours=hh;i.price=op?parseFloat(op.value):0;i.note=$("#ofn").value.trim();i.status="offered";i.company="tyne";i.employee=$("#asg").value;after("Offer sent");break;
case"withdraw":i.status="open";i.company=null;i.employee=null;i.price=null;i.note="";after("Offer withdrawn");break;
case"finish":i.status="done";after("Marked done");break;
case"addemp":var nm=$("#en").value.trim();if(!nm){newErr="Enter a name.";render();return}newErr="";S.employees.push({id:"e"+Date.now(),name:nm,specialty:$("#es").value,available:true});after("Employee added");break;
case"rename":if(el.value.trim()){i.title=el.value.trim();save();toast("Title saved")}break;
case"setstatus":i.status=el.value;after("Status updated");break;
case"espec":emp(d.id).specialty=el.value;after("Specialty updated");break;
case"eavail":emp(d.id).available=el.checked;after("Availability updated");break}}

document.addEventListener("click",function(e){var g=e.target.closest("[data-go]");if(g){closeDlg();go(g.dataset.go);$("#menu").hidden=true;return}
var a=e.target.closest("[data-a]");if(!a||a.tagName==="SELECT"||a.tagName==="INPUT"&&a.type!=="checkbox")return;if(a.tagName==="INPUT")return;
if(a.classList.contains("heart")||a.dataset.a!=="open"||!e.target.closest(".heart")){act(a.dataset.a,a.dataset,a)}
if(!e.target.closest("#menu")&&!e.target.closest("#avatar"))$("#menu").hidden=true;
if(e.target.closest("#menu"))$("#menu").hidden=true});
document.addEventListener("change",function(e){var a=e.target.closest("[data-a]");if(a&&(a.tagName==="SELECT"||a.tagName==="INPUT"))act(a.dataset.a,a.dataset,a)});
document.addEventListener("keydown",function(e){if(e.key==="Enter"&&e.target.classList&&e.target.classList.contains("card")){e.preventDefault();act("open",e.target.dataset,e.target)}if(e.key==="Escape")$("#menu").hidden=true});
document.addEventListener("click",function(e){if(!e.target.closest("#menu")&&!e.target.closest("#avatar"))$("#menu").hidden=true});
$("#avatar").addEventListener("click",function(){var m=$("#menu");m.hidden=!m.hidden;this.setAttribute("aria-expanded",!m.hidden)});
function closeSide(){var s=$("#side");if(s)s.classList.remove("open");$("#scrim").classList.remove("open")}
$("#burger").addEventListener("click",function(){var s=$("#side");if(!s)return;s.classList.toggle("open");$("#scrim").classList.toggle("open",s.classList.contains("open"))});
$("#scrim").addEventListener("click",closeSide);
$("#dlg").addEventListener("click",function(e){if(e.target===this)closeDlg()});
window.addEventListener("hashchange",render);
render();
