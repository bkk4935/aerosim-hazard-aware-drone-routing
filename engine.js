/* AEROSIM LIVE - self-contained transparent research simulator.
 * Models: embedded fitted AMOVFLY HistGB and Jia HistGB, Bristol logistic.
 * Rotor->emission, compartment->dose, indoor transfer: explicitly assumed.
 * No CFD, regulatory certification, aviation control, measured worker exposure.
 */
(function(root){'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sq=x=>x*x, hypot=(a,b)=>Math.sqrt(a*a+b*b);
const G=9.80665, MU=1.81e-5;
function airDensity(opts){
 // Moist-air ideal-gas estimate; no aircraft density calibration implied.
 const tc=opts.ambientTemp,T=tc+273.15;
 const ps=610.94*Math.exp(17.625*tc/(tc+243.04));
 const pv=Math.min(opts.airPressure*.08,ps*opts.humidity/100);
 return (opts.airPressure-pv)/(287.05*T)+pv/(461.5*T);
}
function predictTree(model,features){
 const x=model.feature_names.map(k=>features[k]===undefined?NaN:Number(features[k]));
 let y=model.baseline;
 for(const tree of model.trees){let p=0;let it=0;
   while(!tree[p][6] && it++<30){const nd=tree[p],v=x[nd[0]];
      p=(Number.isNaN(v)?Boolean(nd[2]):v<=nd[1])?nd[3]:nd[4];
   }
   y+=tree[p][5];
 }
 return model.transform==='expm1_clip0'?Math.max(0,Math.expm1(y)):y;
}
function predictLogit(model,features){
 let t=model.intercept;
 model.feature_names.forEach((k,i)=>{t+=model.weights[i]*(Number(features[k])-model.mean[i])/model.scale[i]});
 return 1/(1+Math.exp(-clamp(t,-30,30)));
}
const DEFAULT={
 wind:1.6,windDir:30,ach:2.2,ambientTemp:22,humidity:55,airPressure:101325,particleDensity:1800,
 roomVolume:180,reentryMin:30,occupancyMin:30,
 weightEnergy:1.3,weightDust:1.2,weightDose:2.1,weightTime:0.8,weightGamma:0.2,
 releaseScale:1.4, uncertainty:2.5, rotorDiameter:0.254,
 massKg:1.90,batteryWh:74,reservePct:25,maxHeight:1.9,
 surfaceAdhesion:1.0,referenceTunnelWind:11.0,
 vMax:2.2, speedScale:1, minAltitude:.7,
 zoneA:{x:-2.1,y:1.0,r:1.35,dust:36,logActivity:5.7,isotope:'Cs-137',diameter:14,gamma:40},
 zoneB:{x:2.2,y:-.9,r:1.45,dust:90,logActivity:6.1,isotope:'Pu-239',diameter:8,gamma:80},
};
// ICRP Publication 119 Table A.1 worker inhalation e(Sv/Bq), AMAD 5 um,
// displayed absorption type. They are conditional reference scenarios, not a universal ranking.
const nuclides={
 'Cs-137':{e:6.7e-9,type:'F',radiation:'β/γ'},
 'Sr-90':{e:3.0e-8,type:'F',radiation:'β'},
 'Co-60':{e:7.1e-9,type:'M',radiation:'β/γ'},
 'Pu-239':{e:3.2e-5,type:'M',radiation:'α'},
 'Pu-240':{e:3.2e-5,type:'M',radiation:'α'},
 'Am-241':{e:2.7e-5,type:'M',radiation:'α/γ'}
};
const WORKER={x:4.55,y:1.1};
const OBSTACLES=[{x:-.25,y:.15,r:.68},{x:.7,y:2.45,r:.55}];
const START={x:-4.5,y:-3.35,z:1.2};
const GOALS=[{x:-3.35,y:2.95},{x:3.25,y:2.95},{x:4.05,y:-3.15},{x:START.x,y:START.y}];
function meanWindPower(opts,models){
 const memo={};
 const predict=(v)=>{
   const model=models.energy;
   const typical={v_xy_m_s:v,v_z_m_s:0,accel_dev_m_s2:.3,tilt_deg:8,wind_m_s:opts.wind,wind_cos:Math.cos(opts.windDir*Math.PI/180),wind_sin:Math.sin(opts.windDir*Math.PI/180),alt_m:10,payload_g:0,air_pressure_Pa:97000,is_Y:1,is_R:0,is_G:0};
   return predictTree(model,typical);
 };
 // Use *changes* in a fitted AMOVFLY aircraft's predicted power as a weak,
 // clipped transfer trend. Absolute power comes from an X500-class assumed baseline.
 const anchor=predict(1.2);
 for(const v of [.7,1.2,1.8,2.2]){
   const learned=clamp(.28*(predict(v)-anchor),-40,50);
   const geom=230*Math.pow(opts.massKg/1.79,1.5)*(0.254/opts.rotorDiameter);
   const env=12+4*sq(opts.wind/3);
   memo[v]=clamp(geom+env+learned+9*sq(Math.max(0,v-1.2)),120,800);
 }
 return memo;
}
function wakeSpeed(opts,h){
 const A=4*Math.PI*sq(opts.rotorDiameter/2);
 const rho=101325/(287.05*(273.15+opts.ambientTemp)); // illustrative dry air at sea-level pressure
 const vi=Math.sqrt(opts.massKg*G/(2*rho*A));
 return (2*vi)/(1+sq(.5*h/opts.rotorDiameter));
}
function settling(d_um,density=1800){
 const d=d_um*1e-6;
 return clamp((density-1.2)*G*d*d/(18*MU),0,1);
}
function receptors(z,opts){
 // Unvalidated source-to-receptor transfer coefficient, NOT CFD or a validated exposure field.
 const dx=WORKER.x-z.x,dy=WORKER.y-z.y,d=hypot(dx,dy);
 const wd=opts.windDir*Math.PI/180;
 const along=(dx*Math.cos(wd)+dy*Math.sin(wd))/Math.max(.01,d);
 const directional=clamp(.55+.45*along,.08,1);
 return clamp((.12+.35*directional)*Math.exp(-d/8),0,.85);
}
function dosePerRelease(mg,z,opts){
 // Conditional instantaneous release into a 1-zone receptor volume.
 // Settling is an AEROSOL-TRANSPORT term. ICRP coefficient accounts for
 // lung deposition/biokinetics; never apply lung deposition a second time.
 const act=mg*1e-6*Math.pow(10,z.logActivity);  // released Bq
 const e=nuclides[z.isotope].e;
 const settlingLossMin=60*settling(z.diameter,opts.particleDensity)/3; // 3 m mixing height, assumed
 const lossMin=opts.ach/60+settlingLossMin;
 const timeIntegral=Math.exp(-lossMin*opts.reentryMin)*(-Math.expm1(-lossMin*opts.occupancyMin))/Math.max(1e-8,lossMin); // minutes
 const breathing_m3_min=.02; // 1.2 m³/h, adult light-work scenario, assumed
 const fraction=clamp(receptors(z,opts)*breathing_m3_min*timeIntegral/opts.roomVolume,0,.05);
 return {dose_uSv:act*fraction*e*1e6,activity_Bq:act,inhBq:act*fraction,settlingLossMin};
}
function costForSegment(a,b,v,opts,power,weights){
 const dist=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
 const horizontal=hypot(b.x-a.x,b.y-a.y);
 const isClimb=horizontal<.05;
 // Cubic ease-in/out has a peak speed 1.5× its mean. Allocate time accordingly.
 const dt=isClimb?Math.max(.12,1.5*Math.abs(b.z-a.z)/.55):Math.max(.30,1.5*horizontal/v);
 const p=power[v]||power[1.2];const extraClimb=(Math.max(0,b.z-a.z)*opts.massKg*G/.55)/Math.max(dt,.2);
 const energy=(p+extraClimb)*dt/3600;
 let dust=0,dose=0,gamma=0,activity=0;
 const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,mz=(a.z+b.z)/2;
 const surf=wakeSpeed(opts,mz);
 for(const z of [opts.zoneA,opts.zoneB]){
   const d=hypot(mx-z.x,my-z.y);
   const footprint=Math.exp(-.5*sq(d/z.r));
   const vfactor=Math.pow(surf/3,2);
   const motionFactor=1+.04*v;
   // Hypothesized rotor emission coefficient, not inferred from Jia or Bristol.
   const humidityMultiplier=clamp(1+(50-opts.humidity)/140,.6,1.5); // assumed cohesive response
   const mg=opts.releaseScale*(z.dust/30)*footprint*vfactor*motionFactor*dt*humidityMultiplier/Math.max(.25,opts.surfaceAdhesion);
   const rel=dosePerRelease(mg,z,opts);
   dust+=mg;dose+=rel.dose_uSv;activity+=rel.activity_Bq;
   gamma+=z.gamma*footprint*dt/3600; // environmental field exposure proxy to electronics, not worker
 }
 const c=(weights.energy*energy/.06 + weights.dust*dust/2 +weights.dose*dose/.00011+weights.time*dt/2)
  +(weights.gamma||0)*gamma/.05 + (mz>1.7? 0.015*dt:0);
 return {cost:c,dt,energy,dust,dose,gamma,activity,dist};
}
function route(opts,models,mode='adaptive',start=START,goals=GOALS){
 const NX=21, NY=17, levels=[.7,1.2,1.7,2.2].filter(h=>h<=opts.maxHeight+1e-7);
 if(!levels.length)levels.push(.7);
 const mnX=-4.9,mnY=-3.9,DX=9.8/(NX-1),DY=7.8/(NY-1);
 const toIdx=(x,y)=>[clamp(Math.round((x-mnX)/DX),0,NX-1),clamp(Math.round((y-mnY)/DY),0,NY-1)];
 const pos=(i,j,k)=>({x:mnX+i*DX,y:mnY+j*DY,z:levels[k]});
 const id=(i,j,k)=>(k*NY+j)*NX+i;const decode=id=>[id%NX,Math.floor(id/NX)%NY,Math.floor(id/(NX*NY))];
 const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
 const speeds=[.7,1.2,1.8,2.2].filter(v=>v<=opts.vMax+.001);if(!speeds.length)speeds.push(.7);
 const power=meanWindPower(opts,models);
 const weights=mode==='fixed'?{energy:1.5,dust:0,dose:0,time:1.7,gamma:0}:
   {energy:opts.weightEnergy,dust:opts.weightDust,dose:opts.weightDose,time:opts.weightTime,gamma:opts.weightGamma};
 function search(from,to){
   const [si,sj]=toIdx(from.x,from.y),[gi,gj]=toIdx(to.x,to.y);
   let sk=0;for(let k=0;k<levels.length;k++)if(Math.abs(from.z-levels[k])<Math.abs(from.z-levels[sk]))sk=k;
   const source=id(si,sj,sk),n=NX*NY*levels.length;
   const d=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),spd=new Float64Array(n),done=new Uint8Array(n),stats=new Array(n);
   const heap=[];function put(item){heap.push(item);let i=heap.length-1;while(i>0){let p=(i-1)>>1;if(heap[p][0]<=item[0])break;heap[i]=heap[p];i=p;}heap[i]=item;}
   function pop(){const result=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let l=2*i+1,r=l+1;if(l>=heap.length)break;let c=r<heap.length&&heap[r][0]<heap[l][0]?r:l;if(heap[c][0]>=last[0])break;heap[i]=heap[c];i=c;}heap[i]=last;}return result;}
   d[source]=0;put([0,source]);let target=-1;
   while(heap.length){const [score,idx]=pop();if(done[idx]||score>d[idx]+1e-10)continue;done[idx]=1;
      const [i,j,k]=decode(idx);if(i===gi&&j===gj){target=idx;break;}
      const aa=pos(i,j,k);
      const options=[];
      for(const [di,dj] of dirs){const ni=i+di,nj=j+dj;if(ni<0||ni>=NX||nj<0||nj>=NY)continue;
        const nb=pos(ni,nj,k);if(OBSTACLES.some(o=>hypot(nb.x-o.x,nb.y-o.y)<o.r+.19))continue;
        options.push([ni,nj,k]);}
      for(const nk of [k-1,k+1])if(nk>=0&&nk<levels.length) options.push([i,j,nk]);
      for(const [ni,nj,nk] of options){const bb=pos(ni,nj,nk),nid=id(ni,nj,nk);
        const goalNear=hypot(bb.x-to.x,bb.y-to.y)<.85;
        let best=Infinity,bestV=.7,bst=null;
        for(const v of speeds){if(goalNear&&v>1.2)continue;
          const st=costForSegment(aa,bb,v,opts,power,weights);
          let penalty=goalNear&&bb.z>1.7?.4:0;
          const co=st.cost+penalty;
          if(co<best){best=co;bestV=v;bst=st;}}
        const nd=score+best;
        if(nd+1e-9<d[nid]){d[nid]=nd;prev[nid]=idx;spd[nid]=bestV;stats[nid]=bst;put([nd,nid]);}
      }
   }
   if(target<0)return null;
   const nodes=[],legs=[];let cur=target;
   while(cur!==source){nodes.push(pos(...decode(cur)));legs.push({...stats[cur],speed:spd[cur]});cur=prev[cur];if(cur<0)return null;}
   nodes.push(pos(...decode(source)));nodes.reverse();legs.reverse();
   // The initial grid snap is < one cell; include the true initial state for viewer continuity.
   if(hypot(nodes[0].x-from.x,nodes[0].y-from.y)>.01){nodes.unshift({...from});
      const st=costForSegment(from,nodes[1],.7,opts,power,weights);legs.unshift({...st,speed:.7});}
   return {nodes,legs};
 }
 const points=[{...start}],legs=[];let loc={...start};let count=0;
 for(const g of goals){const path=search(loc,g);if(!path)return {valid:false,error:'No collision-free path in grid'};
   points.push(...path.nodes.slice(1));legs.push(...path.legs);loc=path.nodes[path.nodes.length-1];count++;
 }
 const totals={energy:0,dust:0,dose:0,gamma:0,activity:0,distance:0,duration:0};
 for(let i=0;i<legs.length;i++){const s=legs[i];totals.energy+=s.energy;totals.dust+=s.dust;totals.dose+=s.dose;totals.gamma+=s.gamma;totals.activity+=s.activity;totals.distance+=s.dist;totals.duration+=s.dt;}
 return {valid:true,points,legs,totals,mode,goalCount:count};
}
function snapshot(plan,t){
 if(!plan?.valid)return {x:START.x,y:START.y,z:START.z,speed:0,index:0};
 let remaining=clamp(t,0,plan.totals.duration);
 for(let k=0;k<plan.legs.length;k++){
  const L=plan.legs[k]; if(remaining<=L.dt){let r=L.dt>0?remaining/L.dt:1;const a=plan.points[k],b=plan.points[k+1];
     // Smooth minimum-jerk interpolation; kinematic only, not Newton-Euler flight dynamics.
     const eased=r*r*(3-2*r);
     const x=a.x+(b.x-a.x)*eased,y=a.y+(b.y-a.y)*eased,z=a.z+(b.z-a.z)*eased;
     const heading=Math.atan2(b.y-a.y,b.x-a.x);
     return {x,y,z,speed:(L.dist/Math.max(.05,L.dt))*6*r*(1-r),heading,index:k,progress:r};
  }remaining-=L.dt;
 }
 const end=plan.points[plan.points.length-1];return {...end,speed:0,heading:0,index:plan.legs.length-1,progress:1};
}
function estimateEndurance(opts){
 const power=meanWindPower(opts,{energy:root.AEROSIM_MODELS.energy});
 const hover=power[.7];const usable=opts.batteryWh*(1-opts.reservePct/100);
 return {referencePower_W:hover,idealHoverMin:usable/hover*60,estimatedLowMin:usable/(hover*1.25)*60,estimatedHighMin:usable/(hover*.9)*60};
}
const Aero={predictTree,predictLogit,DEFAULT,nuclides,route,snapshot,costForSegment,settling,wakeSpeed,airDensity,dosePerRelease,WORKER,OBSTACLES,START,GOALS,meanWindPower,estimateEndurance,clamp};
root.Aero=Aero;
if(typeof module!=='undefined'&&module.exports)module.exports=Aero;
})(typeof window!=='undefined'?window:globalThis);
