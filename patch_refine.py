from pathlib import Path
p=Path(__file__).parent
engine=p/'engine.js'; ui=p/'ui.js'; template=p/'template.html'
e=engine.read_text();u=ui.read_text()
e=e.replace('const G=9.80665, AIR_DENS=1.2, MU=1.81e-5;', '''const G=9.80665, MU=1.81e-5;
function airDensity(opts){
 // Moist-air ideal-gas estimate; no aircraft density calibration implied.
 const tc=opts.ambientTemp,T=tc+273.15;
 const ps=610.94*Math.exp(17.625*tc/(tc+243.04));
 const pv=Math.min(opts.airPressure*.08,ps*opts.humidity/100);
 return (opts.airPressure-pv)/(287.05*T)+pv/(461.5*T);
}''')
e=e.replace('wind:1.6,windDir:30,ach:2.2,ambientTemp:22,humidity:55,','wind:1.6,windDir:30,ach:2.2,ambientTemp:22,humidity:55,airPressure:101325,particleDensity:1800,')
e=e.replace('const vi=Math.sqrt(opts.massKg*G/(2*AIR_DENS*A));','const vi=Math.sqrt(opts.massKg*G/(2*airDensity(opts)*A));')
e=e.replace('return clamp((density-AIR_DENS)*G*d*d/(18*MU),0,1);','return clamp((density-1.2)*G*d*d/(18*MU),0,1);')
old='''function receptors(z,opts){
 const dx=WORKER.x-z.x,dy=WORKER.y-z.y;
 const d=hypot(dx,dy);
 const wd=opts.windDir*Math.PI/180;
 const along=(dx*Math.cos(wd)+dy*Math.sin(wd))/Math.max(.01,d);
 const directional=clamp(.55+.45*along,.08,1);
 // Residence, spatial transfer and occupancy are all scenario assumptions.
 const ventilation=Math.exp(-opts.ach*opts.reentryMin/60);
 const duration=clamp(opts.occupancyMin/30,.05,4);
 return clamp((.12+.35*directional)*Math.exp(-d/8)*ventilation*duration,0,.85);
}
function dosePerRelease(mg,z,opts){
 // Estimate an inhaled fraction via a deliberately simple 2-compartment model.
 // Concentrations and dose are not calibrated to actual facilities.
 const act=mg*1e-6*Math.pow(10,z.logActivity);  // Bq released
 const e=nuclides[z.isotope].e;
 const Vb=(1.2/60)*opts.occupancyMin; // 1.2 m³/h illustrative breathing volume
 const fraction=clamp(receptors(z,opts)*Vb/opts.roomVolume,0,.05);
 return {dose_uSv:act*fraction*e*1e6,activity_Bq:act,inhBq:act*fraction};
}'''
new='''function receptors(z,opts){
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
}'''
e=e[:e.index('function receptors(z,opts){')]+new+'\n'+e[e.index('function costForSegment(a,b,v,opts,power,weights){'):] 
e=e.replace('const c=(weights.energy*energy/.06 + weights.dust*dust/2 +weights.dose*dose/.004+weights.time*dt/2)', 'const c=(weights.energy*energy/.06 + weights.dust*dust/2 +weights.dose*dose/.00011+weights.time*dt/2)')
e=e.replace('nuclides,route,snapshot,costForSegment,settling,wakeSpeed,dosePerRelease,','nuclides,route,snapshot,costForSegment,settling,wakeSpeed,airDensity,dosePerRelease,')
engine.write_text(e)
# Controls for scenario variables that actually affect air density, settling and size-sensitive transport.
u=u.replace("slider('environmentControls','windDir','Wind direction',0,360,5,'°');", "slider('environmentControls','windDir','Wind direction',0,360,5,'°');\n slider('environmentControls','ambientTemp','Air temperature',0,45,1,' °C');\n slider('environmentControls','humidity','Relative humidity',10,95,5,'%');\n slider('environmentControls','airPressure','Air pressure',90000,104000,500,' Pa');\n slider('environmentControls','particleDensity','Particle effective density',500,5000,100,' kg/m³');")
u=u.replace('const lbl=v.parentElement.querySelector(\'.ctrlName\').textContent;\n if(lbl===\'Radionuclide (reference coefficient)\'){const parent=v.closest(\'.group\').id;v.value=(parent===\'zoneAControls\'?s.zoneA:s.zoneB).isotope;}', "const lbl=v.parentElement.querySelector('.ctrlName').textContent;\n if(lbl==='Radionuclide (reference coefficient)'){const parent=v.parentElement.parentElement.id;v.value=(parent==='zoneAControls'?s.zoneA:s.zoneB).isotope;}")
u=u.replace('const p=A.snapshot(adaptive,clock);\n s.zoneB.dust', 'const p=A.snapshot(adaptive,clock);\n s.zoneB.dust')
# UI slider labels dynamically update the dose model interpretation
u=u.replace('const [name,p] of [[\'adaptive\',adaptive],[\'fixed\',fixed]])',"const [name,p] of [['adaptive',adaptive],['fixed',fixed]])")
# label physical interpretation carefully
u=u.replace('conditional assumptions, not observed reductions in exposure.', 'scenario-dependent transfer and settling assumptions, not measured reductions in human exposure.')
u=u.replace('Context: isotope-specific reference coefficients + assumed room-transfer model.', 'Context: isotope-specific reference coefficients + assumed source-to-worker transfer and 3 m mixing-height settling.')
# Avoid reset oddity with source radio selection, bring UI update labels in sync
u=u.replace("if(k.replace(/[^a-zA-Z0-9]/g,'')===key){i.value=v;let out=$('out_'+i.id);if(out){out.textContent=k.endsWith('logActivity')?'10^'+fmt(v,1)+' Bq/kg':k==='rotorDiameter'?fmt(v,3)+' m':fmt(v,2);}break;}","if(k.replace(/[^a-zA-Z0-9]/g,'')===key){i.value=v;let out=$('out_'+i.id);if(out){const unit={'massKg':' kg','batteryWh':' Wh','reservePct':'%','rotorDiameter':' m','maxHeight':' m','vMax':' m/s','wind':' m/s','windDir':'°','ach':' ACH','roomVolume':' m³','reentryMin':' min','occupancyMin':' min','ambientTemp':' °C','humidity':'%','airPressure':' Pa','particleDensity':' kg/m³','releaseScale':'×'}[k]|| (k.endsWith('dust')?' g/m²':k.endsWith('diameter')?' μm':k.endsWith('gamma')?' μSv/h':'');out.textContent=k.endsWith('logActivity')?'10^'+fmt(v,1)+' Bq/kg':fmt(v,3)+unit;}break;}")
ui.write_text(u)
print('Patched demo controller: size-sensitive settling, one-time occupancy, actual room atmospheric input sliders, restore select fix')
