// NEhelp: demo data, saved state and small helpers
// Loaded as a plain script; everything shares one global scope, in the order index.html lists.

var KEY="nehelp-v3",CATS=["Finance","Marketing","Employment"],COMP={tyne:"Tyne Digital",nu:"Northumbria University"};
function seedBase(){return{role:null,claimed:false,business:{name:"The Corner Café",kind:"Café",area:"Newcastle",hours:"Mon to Sat, 8am to 5pm",address:"12 High Street, Newcastle"},
issues:[
{id:"i1",biz:"me",title:"Saturday staff",cat:"Employment",desc:"Two part-time students from March.",check:["Post the role","Shortlist candidates","Arrange interviews"],help:"Free",hours:4,status:"inprogress",company:"nu",employee:null,fav:false},
{id:"i2",biz:"me",title:"Invoice setup",cat:"Finance",desc:"Closed. Reopen any time.",check:["Choose an invoice template","Set up payment reminders"],help:"Paid",hours:3,status:"notneeded",company:null,employee:null,fav:false},
{id:"i3",biz:"me",title:"Social media pack",cat:"Marketing",desc:"Photos and a month of posts for Instagram.",check:["Set up the profile","Plan 12 posts","Write captions"],help:"Discounted",hours:5,status:"open",company:null,employee:null,fav:true},
{id:"i4",biz:"Harbour Bakery",kind:"Bakery",area:"Tynemouth",title:"Invoice setup",cat:"Finance",desc:"Needs a simple invoice template and a way to track unpaid bills.",check:["Create invoice template","Track unpaid bills","Show how to send reminders"],help:"Paid",hours:3,status:"open",company:null,employee:null,fav:false},
{id:"i5",biz:"Tyne Cycles",kind:"Bike shop",area:"Gateshead",title:"Two part-time hires",cat:"Employment",desc:"Weekend mechanics for the summer season.",check:["Write the job post","Screen applicants","Set up trial shifts"],help:"Free",hours:4,status:"open",company:null,employee:null,fav:false},
{id:"i6",biz:"Ouseburn Print",kind:"Print shop",area:"Ouseburn",title:"Menu design",cat:"Marketing",desc:"A new menu layout for a local restaurant client.",check:["Draft layout","Pick fonts and colours","Send print-ready file"],help:"Discounted",hours:6,status:"inprogress",company:"tyne",employee:"e1",fav:false}],
employees:[{id:"e1",name:"Sam Okafor",specialty:"Marketing",available:true},{id:"e2",name:"Dan Whitfield",specialty:"Marketing",available:true},{id:"e3",name:"Priya Nair",specialty:"Finance",available:true},{id:"e4",name:"Ava Collins",specialty:"Finance",available:true},{id:"e5",name:"Lee Hart",specialty:"Employment",available:true}],
ui:{view:"grid",hideClosed:false}}}
// Adds the fields the company side needs: district, price, signed date, and the company profile.
function seed(){var s=seedBase(),D={i1:"Newcastle",i2:"Newcastle",i3:"Newcastle",i4:"North Tyneside",i5:"Gateshead",i6:"Newcastle"};
s.issues.forEach(function(i){i.district=D[i.id];i.price=null;i.signed=null;i.note=""});
function g(id){return s.issues.filter(function(i){return i.id===id})[0]}
g("i1").signed="1 Oct 2026";g("i6").price=240;g("i6").signed="28 Oct 2026";
s.issues.push({id:"i7",biz:"Roker Fish Bar",kind:"Fish bar",area:"Sunderland",district:"Sunderland",title:"Cash-flow forecast",cat:"Finance",desc:"A simple forecast so the owner knows when quiet months bite.",check:["Gather last year’s takings","Build a 12-month forecast","Explain it in plain English"],help:"Paid",hours:4,price:null,signed:null,note:"",status:"open",company:null,employee:null,fav:false},
{id:"i8",biz:"Durham Dog Grooming",kind:"Dog groomer",area:"Durham",district:"Durham",title:"Booking website",cat:"Marketing",desc:"A one-page site with online booking and prices.",check:["Design a one-page site","Add online booking","Connect a payment link"],help:"Discounted",hours:6,price:null,signed:null,note:"",status:"open",company:null,employee:null,fav:false});
s.business.district="Newcastle";s.ui.onlyMine=true;
s.company={name:"Tyne Digital",num:"",email:"",areas:["Finance","Marketing","Employment"],districts:["Newcastle","Gateshead","North Tyneside"],hours:40,help:{Free:true,Discounted:true,Paid:true},terms:true,onboarded:false};
s.accounts={business:{name:"Alex Morgan",email:"alex@cornercafe.co.uk",phone:"0191 555 0142",title:"Owner",notify:{offers:true,messages:true,weekly:false}},company:{name:"Jordan Reed",email:"jordan@tynedigital.co.uk",phone:"0191 555 0177",title:"Partnerships lead",notify:{offers:true,messages:true,weekly:true}}};
return s}
var S;try{S=JSON.parse(localStorage.getItem(KEY));}catch(e){S=null}
if(!S||!S.issues||!S.company||!S.accounts)S=seed();
COMP.tyne=S.company.name;
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
var $=function(s){return document.querySelector(s)};
function esc(t){return String(t==null?"":t).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
var IC={heart:'<path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'};
function ico(n,fill){return'<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="'+(fill?"currentColor":"none")+'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+IC[n]+"</svg>"}
function toast(m){var t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(function(){t.hidden=true},2600)}
function go(v){if(location.hash.slice(1)===v)render();else location.hash=v}
function mine(){return S.issues.filter(function(i){return i.biz==="me"})}
function bizName(i){return i.biz==="me"?S.business.name:i.biz}
function revealed(i){return i.status==="inprogress"||i.status==="done"}
function whoFor(i){if(revealed(i))return bizName(i);var k=i.biz==="me"?S.business.kind:i.kind,a=i.biz==="me"?S.business.area:i.area;return k+" in "+a}
function emp(id){return S.employees.filter(function(e){return e.id===id})[0]}
function busy(e){return S.issues.some(function(i){return i.employee===e.id&&(i.status==="offered"||i.status==="inprogress")})}
function isFree(e){return e.available&&!busy(e)}
function freeIn(c){return S.employees.filter(function(e){return e.specialty===c&&isFree(e)})}
var BL={draft:["Draft",""],open:["Looking for a company","warn"],offered:["Offer waiting","warn"],inprogress:["In progress","good"],done:["Done","good"],notneeded:["Not needed",""]};
var CL={open:["Needs an employee","warn"],offered:["Offer sent",""],inprogress:["In progress","good"],done:["Done","good"]};
function pill(t,c){return'<span class="pill '+(c||"")+'">'+esc(t)+"</span>"}
function catStatus(c){var a=mine().filter(function(i){return i.cat===c});function f(s){return a.filter(function(i){return i.status===s})[0]}
var x;if(x=f("offered"))return["Offer waiting","warn"];if(x=f("open"))return["Looking for a company","warn"];if(x=f("inprogress"))return[COMP[x.company]||"In progress","good"];if(x=f("draft"))return["Draft",""];return["Not needed",""]}
function nav(){return S.role==="business"?[["b-issues","Overview"],["b-new","List new issue"],["b-map","Map"],["b-update","Update issues"],["b-companies","Update company relationships"],["b-account","Account"]]:[["c-requests","Overview"],["c-map","Map"],["c-add","Add new employee"],["c-specialty","Update specialty"],["c-companies","View companies working with"],["c-profile","Company profile"],["c-account","Account"]]}
var co={step:1,err:""},ob={step:1,mode:"ch",sent:false,err:""},req=null,openId=null,dlgKind=null,newErr="";

function menu(){var m=$("#menu"),biz=S.role==="business";
m.innerHTML=S.role?'<p>Signed in as <b>'+esc(S.accounts[S.role].name)+'</b><br>'+(biz?esc(S.business.name):esc(S.company.name))+'</p><button data-go="'+(biz?"b-account":"c-account")+'">Your account</button><button data-a="topmap">Open the map</button><button data-a="logout">Log out</button><button data-a="reset">Reset demo data</button>':'<p>Not signed in</p><button data-a="topmap">Open the map</button><button data-a="reset">Reset demo data</button>';
$("#avatar").textContent=S.role?initials(S.accounts[S.role].name):"NE";
var bs=document.querySelectorAll(".rolesw button");for(var k=0;k<bs.length;k++)bs[k].setAttribute("aria-pressed",String(bs[k].dataset.r===S.role))}
