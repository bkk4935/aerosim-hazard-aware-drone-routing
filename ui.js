/* Browser UI - no external dependencies. All 3D coordinates in metres, +Z up.
 * Perspective view and drones are illustrative meshes; physics and route are
 * evaluated in engine.js, not extracted from canvas geometry.
 */
(function(){'use strict';
const A=window.Aero,M=window.AEROSIM_MODELS;
let s=JSON.parse(JSON.stringify(A.DEFAULT)),adaptive=null,fixed=null,paused=true,clock=0,goalIndex=0,replans=0;
let camera={yaw:.75,pitch:.68,zoom:1.0,down:false,start:null},smoke=[],timeLast=performance.now(),animFrame=0,spike=false;
const $=id=>document.getElementById(id),fmt=(x,n=2)=>Number(x).toLocaleString('en-GB',{maximumFractionDigits:n});
const fmtDose=x=>!Number.isFinite(x)?'n/a': x>=.01?fmt(x,3)+' µSv':x>=1e-6?fmt(x*1000,5)+' nSv':x>=1e-9?fmt(x*1e6,4)+' pSv':x.toExponential(2)+' µSv';
const setBy=(key,v)=>{let path=key.split('.');if(path.length===1)s[key]=v;else s[path[0]][path[1]]=v;};
const getBy=key=>key.split('.').reduce((x,k)=>x[k],s);
function slider(dst,key,title,min,max,step,unit='',formatter=null){
 const root=$(dst),box=document.createElement('div');box.className='control';const id='s_'+key.replace(/[^a-zA-Z0-9]/g,'');
 const lab=document.createElement('label');lab.className='ctrlName';lab.htmlFor=id;const val=()=>formatter?formatter(getBy(key)):fmt(getBy(key),3)+unit;
 lab.innerHTML='<span>'+title+'</span><output id="out_'+id+'">'+val()+'</output>';
 const inp=document.createElement('input');inp.type='range';inp.id=id;inp.min=min;inp.max=max;inp.step=step;inp.value=getBy(key);
 inp.oninput=()=>{setBy(key,+inp.value);$('out_'+id).textContent=val();planDebounced();updateHardware();updateMLDiagnostics()};box.append(lab,inp);root.appendChild(box);
}
function select(dst,key,title,options){const root=$(dst),box=document.createElement('div');box.className='control';const lab=document.createElement('label');lab.className='ctrlName';lab.textContent=title;
 const elem=document.createElement('select');for(const o of options){const item=document.createElement('option');item.value=o;item.textContent=o;elem.appendChild(item)}elem.value=getBy(key);elem.onchange=()=>{setBy(key,elem.value);planDebounced();updateMLDiagnostics()};
 box.append(lab,elem);root.append(box);}
function createControls(){
 slider('flightControls','massKg','Total takeoff mass',1.20,2.60,.01,' kg');
 slider('flightControls','batteryWh','Battery capacity',5,100,1,' Wh');
 slider('flightControls','reservePct','Reserve energy',10,50,1,'%');
 slider('flightControls','rotorDiameter','Rotor diameter',.18,.34,.002,' m');
 slider('flightControls','maxHeight','Maximum inspection clearance',.7,2.2,.1,' m');
 slider('flightControls','vMax','Maximum translation speed',.7,2.2,.1,' m/s');
 slider('environmentControls','wind','Wind speed',0,7,.2,' m/s');
 slider('environmentControls','windDir','Wind direction',0,360,5,'°');
 slider('environmentControls','ambientTemp','Air temperature',0,45,1,' °C');
 slider('environmentControls','humidity','Relative humidity',10,95,5,'%');
 slider('environmentControls','airPressure','Air pressure',90000,104000,500,' Pa');
 slider('environmentControls','particleDensity','Particle effective density',500,5000,100,' kg/m³');
 slider('environmentControls','ach','Air exchanges per hour',.1,8,.1,' ACH');
 slider('environmentControls','roomVolume','Well-mixed receptor volume',60,600,10,' m³');
 slider('environmentControls','reentryMin','Worker re-entry delay',0,180,5,' min');
 slider('environmentControls','occupancyMin','Worker occupancy',5,120,5,' min');
 for(const [zone,dst] of [['zoneA','zoneAControls'],['zoneB','zoneBControls']]){
   select(dst,zone+'.isotope','Radionuclide (reference coefficient)',Object.keys(A.nuclides));
   slider(dst,zone+'.logActivity','Specific activity (log₁₀ Bq/kg)',1,9,.1,'',x=>'10^'+fmt(x,1)+' Bq/kg');
   slider(dst,zone+'.dust','Deposited dust surface load',0,200,2,' g/m²');
   slider(dst,zone+'.diameter','Median aerodynamic diameter (assumed)',1,80,1,' μm');
   slider(dst,zone+'.gamma','External gamma dose-rate field',0,2000,20,' μSv/h');
 }
 slider('weightsControls','weightEnergy','Energy priority',0,4,.1,'×');
 slider('weightsControls','weightDust','Dust mass priority',0,4,.1,'×');
 slider('weightsControls','weightDose','Conditional inhalation-dose priority',0,4,.1,'×');
 slider('weightsControls','weightTime','Mission time priority',0,4,.1,'×');
 slider('weightsControls','weightGamma','Electronics gamma-exposure priority',0,4,.1,'×');
 slider('assumptionControls','releaseScale','Unknown rotor-to-dust multiplier',.1,10,.1,'×');
 slider('assumptionControls','surfaceAdhesion','Assumed surface adhesion factor',.3,3,.1,'×');
 slider('mlControls','referenceTunnelWind','Jia wind-tunnel reference speed',8,14,.5,' m/s');
}
function updateMLDiagnostics(){
 const ref=M.jia.medians || {};
 const inputs={};for(const x of M.jia.feature_names)inputs[x]=ref[x]||0;
 inputs.wind_speed_m_s=s.referenceTunnelWind;
 const predicted=A.predictTree(M.jia,inputs);
 const b={};M.bristol.feature_names.forEach((name,i)=>b[name]=M.bristol.mean[i]);
 b['Circular diameter / um']=s.zoneA.diameter;
 b['Volume equivalent diameter (um)']=s.zoneA.diameter;
 const detached=A.predictLogit(M.bristol,b);
 const el=$('mlDiagnostics');if(!el)return;
 el.innerHTML=`<div class="rowm"><span>AMOVFLY electrical-power model</span><strong>USED (trend only)</strong></div>
 <div class="rowm"><span>Jia 8–14 m/s wind-tunnel prediction</span><strong>${fmt(predicted,2)} g/m³</strong></div>
 <div class="rowm"><span>Bristol morphology classifier</span><strong>${fmt(detached*100,1)}% class score</strong></div>
 <div class="desc">Two bottom values are independent ML diagnostics, NOT outputs of the rotor-emission, radioactivity or human-exposure model. The Bristol probability fixes other morphology inputs at training means; results at unsupported particle sizes may be invalid. Jia's 7-soil wind-tunnel model does not describe drone airflow.</div>`;
}
function updateHardware(){let e=A.estimateEndurance(s);$('hardwareSummary').innerHTML=`<div class="rowm"><span>Estimated takeoff mass</span><strong>${fmt(s.massKg,2)} kg</strong></div>
<div class="rowm"><span>Usable battery (after reserve)</span><strong>${fmt(s.batteryWh*(1-s.reservePct/100))} Wh</strong></div>
<div class="rowm"><span>Scenario hover power</span><strong>${fmt(e.referencePower_W,0)} W</strong></div>
<div class="rowm"><span>Illustrative endurance band</span><strong>${fmt(e.estimatedLowMin,1)}–${fmt(e.estimatedHighMin,1)} min</strong></div>
<div class="desc">Energy band comes from the assumed X500-class power budget and the AMOVFLY-derived trend. NOT a tested flight endurance for this aircraft.</div>`}
let debounce;
function planDebounced(){clearTimeout(debounce);debounce=setTimeout(()=>recompute(),110)}
function recompute(from,resetTime=true){
 const origin=from|| (adaptive?.valid?A.snapshot(adaptive,clock):A.START);
 const goals=A.GOALS.slice(goalIndex);
 const c=performance.now();
 fixed=A.route(s,M,'fixed',origin,goals);adaptive=A.route(s,M,'adaptive',origin,goals);
 const budget=s.batteryWh*(1-s.reservePct/100);
 let fallback=false;
 if(adaptive.valid&&adaptive.totals.energy>budget){
   const safe=A.route(s,M,'adaptive',origin,[A.START]);
   if(safe.valid){adaptive=safe;fallback=true;}
 }
 if(resetTime){clock=0;smoke=[];}replans++;
 $('flightReplans').textContent=String(replans);
 $('modeLabel').textContent=fallback?'RETURN: ENERGY LIMIT':'ADAPTIVE PATH COMPUTED';
 $('stateSummary').innerHTML=`Planner: 3D grid (x, y, clearance), discrete speeds; obstacle rejection. Replanning takes ${fmt(performance.now()-c,1)} ms. ${fallback?'<span class="bad">Energy reserve would be violated: return policy enabled.</span>':''}<br>Context: isotope-specific reference coefficients + assumed source-to-worker transfer and 3 m mixing-height settling. Training domains differ from the prototype aircraft.`;
 updateMetrics();updateMLDiagnostics();updateModelProbes();draw();
}
function reduce(b,a){return b>0?100*(1-a/b):0;}
function updateMetrics(){if(!adaptive?.valid||!fixed?.valid){$('stateSummary').textContent=adaptive?.error||fixed?.error||'No feasible path';return;}
 const t=adaptive.totals,f=fixed.totals;
 $('energyKPI').textContent=fmt(t.energy,3)+' Wh';
 $('dustKPI').textContent=fmt(t.dust,2)+' mg';
 $('doseKPI').textContent=fmtDose(t.dose);
 $('distKPI').textContent=fmt(t.distance,1)+' m';
 const er=reduce(f.energy,t.energy),dr=reduce(f.dust,t.dust),rr=reduce(f.dose,t.dose);
 $('comparison').innerHTML=`<div class="rowm"><span>Dust mass vs fixed route</span><strong class="${dr>=0?'good':'bad'}">${dr>=0?'−':'+'}${fmt(Math.abs(dr),1)}%</strong></div>
 <div class="rowm"><span>Conditional inhalation dose</span><strong class="${rr>=0?'good':'bad'}">${rr>=0?'−':'+'}${fmt(Math.abs(rr),1)}%</strong></div>
 <div class="rowm"><span>Electrical energy</span><strong class="${er>=0?'good':'bad'}">${er>=0?'−':'+'}${fmt(Math.abs(er),1)}%</strong></div>
 <div class="rowm"><span>Adaptive / fixed time</span><strong>${fmt(t.duration,1)} / ${fmt(f.duration,1)} s</strong></div>
 <div class="rowm"><span>Conditional release activity</span><strong>${fmt(t.activity,4)} Bq</strong></div>
 <div class="rowm"><span>Avionics external-field proxy</span><strong>${fmt(t.gamma,4)} µSv</strong></div>
 <div class="rowm"><span>Energy available after reserve</span><strong>${fmt(s.batteryWh*(1-s.reservePct/100),2)} Wh</strong></div>
 <div class="desc">Comparisons reflect scenario-dependent transfer and settling assumptions, not measured reductions in human exposure.</div>`;
 drawTimeseries();
}
const canvas=$('scene'),ctx=canvas.getContext('2d');let W=900,H=520,scale=1;
function resize(){let w=canvas.clientWidth,h=canvas.clientHeight;scale=window.devicePixelRatio||1;W=w;H=h;canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);ctx.setTransform(scale,0,0,scale,0,0);draw();}
function cameraPoint(p){const x=p.x,y=p.y,z=p.z;const ay=camera.yaw,pt=camera.pitch;const a=x*Math.cos(ay)-y*Math.sin(ay),b=x*Math.sin(ay)+y*Math.cos(ay);
 const depth=b*Math.cos(pt)+(z-1.6)*Math.sin(pt);
 const factor=44*camera.zoom/(1+Math.max(-10,depth)*.025);
 return {x:W*.51+a*factor,y:H*.59+(b*Math.sin(pt)-(z-1.6)*Math.cos(pt))*factor,depth};}
function drawLine(a,b,color,width=1,dash=[]){const p=cameraPoint(a),q=cameraPoint(b);ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.restore();}
function poly3(points,fill,stroke=null){const p=points.map(cameraPoint);ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function circle3(cx,cy,cz,rx,ry,fill,stroke){let pts=[];for(let a=0;a<=32;a++){let t=a/32*Math.PI*2;pts.push({x:cx+Math.cos(t)*rx,y:cy+Math.sin(t)*ry,z:cz});}poly3(pts,fill,stroke);}
function renderRoom(){poly3([{x:-5,y:-4,z:0},{x:5,y:-4,z:0},{x:5,y:4,z:0},{x:-5,y:4,z:0}],'rgba(22,42,63,.8)','#587085');
 for(let x=-5;x<=5;x+=1)drawLine({x,y:-4,z:0},{x,y:4,z:0},'rgba(100,143,174,.12)',.7);
 for(let y=-4;y<=4;y+=1)drawLine({x:-5,y,z:0},{x:5,y,z:0},'rgba(100,143,174,.12)',.7);
 const corner=[[-5,-4],[5,-4],[5,4],[-5,4]];
 for(let i=0;i<4;i++){let [x,y]=corner[i];drawLine({x,y,z:0},{x,y,z:4},'rgba(113,158,191,.42)',1.5);let [nx,ny]=corner[(i+1)%4];drawLine({x,y,z:4},{x:nx,y:ny,z:4},'rgba(113,158,191,.18)',1.1);}
 for(const o of A.OBSTACLES){circle3(o.x,o.y,.07,o.r,o.r,'rgba(69,95,111,.88)','#7899ad');circle3(o.x,o.y,2,o.r,o.r,'rgba(78,107,118,.3)','#7695ad');for(let ang=0;ang<4;ang++){let t=ang*Math.PI/2;drawLine({x:o.x+o.r*Math.cos(t),y:o.y+o.r*Math.sin(t),z:0},{x:o.x+o.r*Math.cos(t),y:o.y+o.r*Math.sin(t),z:2},'rgba(90,136,163,.45)',1);}}
}
function renderZones(){for(const [name,z,c1,c2] of [['A',s.zoneA,'rgba(239,187,72,.22)','rgba(238,173,71,.55)'],['B',s.zoneB,'rgba(235,86,125,.26)','rgba(242,100,147,.62)']]){
 circle3(z.x,z.y,.03,z.r,z.r,c1,c2);let p=cameraPoint({x:z.x,y:z.y,z:.12});ctx.fillStyle=name==='A'?'#f4cd75':'#ffa3bc';ctx.font='bold 13px system-ui';ctx.fillText('ZONE '+name,p.x-22,p.y);}}
function renderWorker(){const x=A.WORKER.x,y=A.WORKER.y;const p=cameraPoint({x,y,z:1.45});ctx.save();ctx.strokeStyle='#7afde5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y-8,5,0,2*Math.PI);ctx.moveTo(p.x,p.y-2);ctx.lineTo(p.x,p.y+18);ctx.moveTo(p.x,p.y+5);ctx.lineTo(p.x-10,p.y+15);ctx.moveTo(p.x,p.y+5);ctx.lineTo(p.x+10,p.y+15);ctx.stroke();ctx.font='10px system-ui';ctx.fillStyle='#c8f9e8';ctx.fillText('WORKER ENTRY',p.x-36,p.y-21);ctx.restore();}
function renderPath(plan,color,width,dash=[]){if(!plan?.valid)return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();plan.points.forEach((v,i)=>{let p=cameraPoint(v);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y)});ctx.stroke();ctx.restore();}
function drone3D(p,t){const yaw=p.heading||0,span=.25;const armAngles=[Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4];
 const motors=armAngles.map(a=>({x:p.x+span*Math.cos(a+yaw),y:p.y+span*Math.sin(a+yaw),z:p.z+.025}));
 // Draw shadow for altitude cues.
 const sh=cameraPoint({x:p.x,y:p.y,z:.02});ctx.fillStyle='rgba(13,240,215,.12)';ctx.beginPath();ctx.ellipse(sh.x,sh.y,12,5,0,0,Math.PI*2);ctx.fill();
 motors.forEach(v=>drawLine({...p,z:p.z},v,'#c6e0ec',3));
 motors.forEach((v,i)=>{circle3(v.x,v.y,v.z,s.rotorDiameter/2,s.rotorDiameter/2,'rgba(67,191,224,.27)','#67d5ee');const a=t*.03+i*Math.PI/4;
 drawLine({x:v.x+Math.cos(a)*(s.rotorDiameter/2),y:v.y+Math.sin(a)*(s.rotorDiameter/2),z:v.z+.01},{x:v.x-Math.cos(a)*(s.rotorDiameter/2),y:v.y-Math.sin(a)*(s.rotorDiameter/2),z:v.z+.01},'#a6f9f4',2);});
 circle3(p.x,p.y,p.z,.12,.105,'rgba(34,225,185,.95)','#cdfbf5');let top=cameraPoint({x:p.x,y:p.y,z:p.z+.18});ctx.fillStyle='#eeffff';ctx.font='bold 11px system-ui';ctx.fillText('AEROSIM UAV',top.x-31,top.y-8);
}
function drawSmoke(dt){if(!paused&&adaptive?.valid&&dt>0){const p=A.snapshot(adaptive,clock);
 for(const [z,col] of [[s.zoneA,'#e9bf69'],[s.zoneB,'#fb96bd']]){const presence=Math.exp(-.5*((p.x-z.x)**2+(p.y-z.y)**2)/(z.r*z.r));let amount=Math.min(12,Math.floor(2+15*presence));if(Math.random()<presence*.4){for(let i=0;i<amount;i++){smoke.push({x:p.x+(Math.random()-.5)*.2,y:p.y+(Math.random()-.5)*.2,z:Math.random()*.22+.08,life:0,vz:.25+Math.random()*.06,col,diam:z.diameter})}}}
 }
 if(!paused&&dt>0){const th=s.windDir*Math.PI/180;smoke.forEach(pt=>{pt.life+=dt;pt.x+=s.wind*Math.cos(th)*dt*.12;pt.y+=s.wind*Math.sin(th)*dt*.12;pt.z+=dt*(.25*Math.exp(-pt.life/7)-A.settling(pt.diam)*.5);});}
 smoke=smoke.filter(pt=>pt.life<18&&pt.z>0&&Math.abs(pt.x)<5&&Math.abs(pt.y)<4).slice(-230);
 smoke.sort((a,b)=>cameraPoint(b).depth-cameraPoint(a).depth);
 for(const pt of smoke){const pp=cameraPoint(pt);ctx.fillStyle=pt.col;ctx.globalAlpha=A.clamp(.62*(1-pt.life/18),0,.62);ctx.beginPath();ctx.arc(pp.x,pp.y,Math.max(.6,2.4-pt.life*.06),0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
}
function draw(){if(!ctx)return;
 ctx.clearRect(0,0,W,H);
 const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#14263b');grad.addColorStop(1,'#07121e');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
 renderRoom();renderZones();renderPath(fixed,'rgba(115,157,245,.44)',2,[7,5]);renderPath(adaptive,'#4febd6',3,[]);renderWorker();drawSmoke(0);
 if(adaptive?.valid){const p=A.snapshot(adaptive,clock);drone3D(p,performance.now());
 $('simulationTime').textContent=fmt(clock,1)+' s';$('flightSpeed').textContent=fmt(p.speed,2)+' m/s';$('flightAltitude').textContent=fmt(p.z,2)+' m';
 $('flightDecision').textContent=p.speed<.1?'HOVER / TURN':Math.abs(p.z-1.2)>.15?'ADJUST ALTITUDE':'FOLLOW PLANNED LEG';
 }
 ctx.save();ctx.fillStyle='#b8ccdf';ctx.font='11px system-ui';ctx.fillText('MODELLED 10 × 8 × 4 m INDUSTRIAL ROOM · NOT MARCOULE CAD',14,H-14);ctx.restore();
}
function drawTimeseries(){const c=$('timeseries'),r=c.getBoundingClientRect(),dpr=devicePixelRatio||1; c.width=Math.round(r.width*dpr);c.height=Math.round(180*dpr);const g=c.getContext('2d');g.scale(dpr,dpr);
 let w=r.width,h=180;g.clearRect(0,0,w,h);if(!adaptive?.valid||!fixed?.valid)return;
 const metrics=[['energy','#4cead9'],['dust','#ffc565'],['dose','#bc98f8']];let maxDur=Math.max(adaptive.totals.duration,fixed.totals.duration);
 function line(plan,key,col,alpha){let x0=35,y0=h-20;g.strokeStyle=col;g.globalAlpha=alpha;g.lineWidth=2.2;g.beginPath();g.moveTo(x0,y0);let t=0,tot=0;
 const maxVal=Math.max(1e-15,adaptive.totals[key],fixed.totals[key]);for(let i=0;i<plan.legs.length;i++){t+=plan.legs[i].dt;tot+=plan.legs[i][key];g.lineTo(x0+(w-55)*t/maxDur,y0-(h-42)*tot/maxVal)}g.stroke();g.globalAlpha=1;}
 for(let k=0;k<4;k++){let yy=14+(h-34)*k/3;g.strokeStyle='#284053';g.lineWidth=1;g.beginPath();g.moveTo(35,yy);g.lineTo(w-20,yy);g.stroke();}
 for(const [key,color] of metrics){line(fixed,key,color,.28);line(adaptive,key,color,.95)}
 g.font='10px system-ui';g.fillStyle='#96afc1';g.fillText('0 s',35,h-4);g.fillText(fmt(maxDur,1)+' s',w-56,h-4);
 g.fillStyle='#4cead9';g.fillText('ENERGY',50,13);g.fillStyle='#ffc565';g.fillText('DUST',132,13);g.fillStyle='#bc98f8';g.fillText('DOSE',190,13);
}
let currentTime=performance.now();function step(t){const d=Math.max(0,Math.min(.09,(t-currentTime)/1000)),factor=+($('timeFactor').value||1);currentTime=t;
 if(!paused&&adaptive?.valid){clock=Math.min(adaptive.totals.duration,clock+d*factor);
 const p=A.snapshot(adaptive,clock);
 if(goalIndex<A.GOALS.length){const g=A.GOALS[goalIndex];
   if(Math.hypot(p.x-g.x,p.y-g.y)<.46){goalIndex++;}}
 drawSmoke(d*factor);if(clock>=adaptive.totals.duration){paused=true;$('play').textContent='▶ Replay mission'}
 }
 draw();animFrame=requestAnimationFrame(step);}
$('play').onclick=()=>{if(clock>=adaptive.totals.duration){clock=0;goalIndex=0;smoke=[];recompute(A.START)}paused=false;$('play').textContent='▶ Playing'};
$('pause').onclick=()=>{paused=true;$('play').textContent='▶ Resume'};
$('reset').onclick=()=>{paused=true;clock=0;goalIndex=0;smoke=[];recompute(A.START);$('play').textContent='▶ Play mission'};
$('event').onclick=()=>{const p=adaptive?.valid?A.snapshot(adaptive,clock):A.START;
 s.zoneB.dust=A.clamp(s.zoneB.dust*2,0,200);s.zoneB.logActivity=A.clamp(s.zoneB.logActivity+.65,1,9);s.windDir=(s.windDir+75)%360;spike=true;syncUI();recompute(p);paused=false;$('play').textContent='▶ Playing';$('event').textContent='⚡ Additional spike';};
$('restore').onclick=()=>{s=JSON.parse(JSON.stringify(A.DEFAULT));spike=false;syncUI();goalIndex=0;paused=true;clock=0;smoke=[];recompute(A.START);$('event').textContent='⚡ Inject contamination spike';};
$('defaults').onclick=$('restore').onclick;
function syncUI(){for(const i of document.querySelectorAll('input[type=range]')){let key=i.id.replace(/^s_/,'');const all={};(function walk(x,p){for(const [k,v] of Object.entries(x)){if(v&&typeof v==='object'&&!Array.isArray(v))walk(v,p?p+'.'+k:k);else all[(p?p+'.':'')+k]=v;}})(s,'');
 for(const [k,v] of Object.entries(all)){if(k.replace(/[^a-zA-Z0-9]/g,'')===key){i.value=v;let out=$('out_'+i.id);if(out){const unit={'massKg':' kg','batteryWh':' Wh','reservePct':'%','rotorDiameter':' m','maxHeight':' m','vMax':' m/s','wind':' m/s','windDir':'°','ach':' ACH','roomVolume':' m³','reentryMin':' min','occupancyMin':' min','ambientTemp':' °C','humidity':'%','airPressure':' Pa','particleDensity':' kg/m³','releaseScale':'×'}[k]|| (k.endsWith('dust')?' g/m²':k.endsWith('diameter')?' μm':k.endsWith('gamma')?' μSv/h':'');out.textContent=k.endsWith('logActivity')?'10^'+fmt(v,1)+' Bq/kg':fmt(v,3)+unit;}break;}}
 }
 for(const v of document.querySelectorAll('select')){if(v.id==='timeFactor')continue;const lbl=v.parentElement.querySelector('.ctrlName').textContent;
 if(lbl==='Radionuclide (reference coefficient)'){const parent=v.parentElement.parentElement.id;v.value=(parent==='zoneAControls'?s.zoneA:s.zoneB).isotope;}}
 updateHardware();updateMLDiagnostics();}
function updateModelProbes(){
 const rawW=+($('jiaWind').value), rawT=+($('jiaTime').value),diam=+($('bristolD').value);
 $('jiaWindOut').textContent=fmt(rawW,1)+' m/s';$('jiaTimeOut').textContent=fmt(rawT,1)+' min';$('bristolDOut').textContent=fmt(diam,0)+' µm';
 const j={...M.jia.medians,wind_speed_m_s:rawW,time_min:rawT};
 const concentration=A.predictTree(M.jia,j);
 const b={};M.bristol.feature_names.forEach((k,i)=>b[k]=M.bristol.mean[i]);b['Circular diameter / um']=diam;
 const score=A.predictLogit(M.bristol,b);
 const en={...M.energy.medians,v_xy_m_s:Math.min(2.2,s.vMax),wind_m_s:s.wind,wind_cos:Math.cos(s.windDir*Math.PI/180),wind_sin:Math.sin(s.windDir*Math.PI/180),is_Y:1,is_R:0,is_G:0};
 const power=A.predictTree(M.energy,en);
 $('mlLabResults').innerHTML='<strong>Jia wind-tunnel concentration:</strong> '+fmt(concentration,2)+' g/m³ (soil medians; no UAV) &nbsp; | &nbsp; <strong>Bristol classifier score:</strong> '+fmt(score,3)+' (not calibrated probability) &nbsp; | &nbsp; <strong>AMOVFLY reference-aircraft power:</strong> '+fmt(power,1)+' W (not this drone)';
}
for(const id of ['jiaWind','jiaTime','bristolD'])$(id).addEventListener('input',updateModelProbes);
$('export').onclick=()=>{if(!adaptive?.valid)return;const rows=['controller,segment,x_m,y_m,z_m,speed_m_s,segment_Wh,segment_dust_mg,segment_dose_uSv,segment_gamma_uSv'];
 for(const [name,p] of [['adaptive',adaptive],['fixed',fixed]]){for(let i=0;i<p.legs.length;i++){const g=p.legs[i],v=p.points[i+1];rows.push([name,i+1,v.x.toFixed(4),v.y.toFixed(4),v.z.toFixed(3),g.speed.toFixed(2),g.energy.toExponential(6),g.dust.toExponential(6),g.dose.toExponential(6),g.gamma.toExponential(6)].join(','));}}
 const blob=new Blob([rows.join('\n')+'\n'],{type:'text/csv'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='aerosim_live_route_comparison.csv';a.click();URL.revokeObjectURL(url);};
$('screenshot').onclick=()=>{const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='aerosim_live_3d.png';a.click();};
canvas.addEventListener('pointerdown',e=>{camera.down=true;camera.start={x:e.clientX,y:e.clientY,yaw:camera.yaw,pitch:camera.pitch};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!camera.down)return;camera.yaw=camera.start.yaw+(e.clientX-camera.start.x)/140;camera.pitch=A.clamp(camera.start.pitch+(e.clientY-camera.start.y)/220,.15,1.35);draw()});
canvas.addEventListener('pointerup',()=>camera.down=false);canvas.addEventListener('wheel',e=>{e.preventDefault();camera.zoom=A.clamp(camera.zoom*(e.deltaY<0?1.09:.92),.45,2.5);draw()},{passive:false});
window.addEventListener('resize',()=>{resize();drawTimeseries()});
createControls();resize();updateHardware();updateMLDiagnostics();recompute(A.START);requestAnimationFrame(step);
})();
