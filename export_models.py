"""Convert fitted scikit-learn tree ensembles to portable vanilla JS JSON.
Independent check in tests/parity_check.py. Does not retrain or make new accuracy claims.
"""
from pathlib import Path
import json
import numpy as np
import joblib
ROOT=Path(__file__).resolve().parent

def encode_hist(name):
    d=joblib.load(ROOT/'models'/f'{name}.joblib')
    m=d['model']
    trees=[]
    for stage in m._predictors:
        nodes=stage[0].nodes
        trees.append([[int(nd['feature_idx']),float(nd['num_threshold']),int(nd['missing_go_to_left']),int(nd['left']),int(nd['right']),float(nd['value']),int(nd['is_leaf'])] for nd in nodes])
    return {'kind':'HistogramGradientBoostedTrees','feature_names':d['features'], 'baseline':float(np.ravel(m._baseline_prediction)[0]),'trees':trees, 'metrics': json.loads(json.dumps(d['metrics'],default=lambda x:float(x) if isinstance(x,np.number) else str(x))), 'transform': 'expm1_clip0' if name.startswith('jia') else 'identity','medians':d.get('training_medians',{})}

out={'energy':encode_hist('energy'),'jia':encode_hist('jia_concentration')}
br=joblib.load(ROOT/'models'/'bristol_detachment.joblib');s=br['model'].named_steps['standardscaler'];logit=br['model'].named_steps['logisticregression']
out['bristol']={'kind':'LogisticRegression','feature_names':br['features'],'mean':s.mean_.tolist(),'scale':s.scale_.tolist(),'weights':logit.coef_[0].tolist(),'intercept':float(logit.intercept_[0]),'metrics':br['metrics']}
(ROOT/'models'/'portable_models.json').write_text(json.dumps(out,separators=(',',':')))
print('exported',sum(len(v['trees']) for k,v in out.items() if 'trees' in v), 'trees', (ROOT/'models'/'portable_models.json').stat().st_size,'bytes')
