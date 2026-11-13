from pathlib import Path
p=Path(__file__).parent
ht=(p/'template.html').read_text()
anchor='</main>\n<aside class="panel sidebar">'
insert='''<section class="panel" style="margin-top:12px;padding:13px 15px">
<div class="panelHead" style="padding:0 0 9px;margin-bottom:8px"><strong>MEASURED-DATA ML PROBES</strong><small>Separate learned components, not coupled drone dust predictions</small></div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:15px">
<div><div class="ctrlName"><span>Wind-tunnel flow speed</span><output id="jiaWindOut">10 m/s</output></div><input id="jiaWind" type="range" min="8" max="14" step=".5" value="10"><p class="xsmall">Jia soil model · originally tested wind range 8–14 m/s</p></div>
<div><div class="ctrlName"><span>Wind-tunnel time</span><output id="jiaTimeOut">3 min</output></div><input id="jiaTime" type="range" min="0.2" max="10" step=".2" value="3"><p class="xsmall">Time within an experiment, not UAV flight time</p></div>
<div><div class="ctrlName"><span>Particle circular diameter</span><output id="bristolDOut">18 µm</output></div><input id="bristolD" type="range" min="3" max="50" step="1" value="18"><p class="xsmall">Bristol morphology classifier, other features at training means</p></div>
</div><div id="mlLabResults" style="margin-top:9px" class="statline"></div>
</section>
'''
assert anchor in ht
ht=ht.replace(anchor,insert+anchor)
(p/'template.html').write_text(ht)
u=(p/'ui.js').read_text()
anchor="$('export').onclick=()=>"
fn='''function updateModelProbes(){
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
'''
assert anchor in u;u=u.replace(anchor,fn+anchor)
u=u.replace(' updateHardware();}\nlet debounce;', ' updateHardware();}\nlet debounce;')
u=u.replace(' updateMetrics();draw();\n}', ' updateMetrics();updateModelProbes();draw();\n}')
(p/'ui.js').write_text(u)
models=(p/'models/portable_models.json').read_text().strip()
(p/'AEROSIM_LIVE_3D.html').write_text(ht.replace('__MODEL_JSON__',models).replace('__ENGINE_JS__',(p/'engine.js').read_text()).replace('__UI_JS__',u))
print('Included ML probes (Jia / Bristol / AMOVFLY)')
