"""Train independently identifiable data-driven components; no fictitious coupled training labels.

Runs against the small, derived training tables bundled in data/.
No environment, reactor, or human-health outputs are learned by this script.
"""
from __future__ import annotations
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.dummy import DummyClassifier
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, brier_score_loss, balanced_accuracy_score
from sklearn.model_selection import GroupShuffleSplit, StratifiedKFold, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT=Path(__file__).resolve().parent
DATA=ROOT/'data'; MODELS=ROOT/'models'; OUT=ROOT/'outputs'
MODELS.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
SEED=2026

ENERGY_FEATURES=['v_xy_m_s','v_z_m_s','accel_dev_m_s2','tilt_deg','wind_m_s','wind_cos','wind_sin','alt_m','payload_g','air_pressure_Pa','is_Y','is_R','is_G']
JIA_FEATURES=['wind_speed_m_s','time_min','D10_um','D50_um','D90_um','organic_g_kg','silt_pct','sand_pct','agg_lt0.063mm']
BRISTOL_FEATURES=['Circular diameter / um','Circularity','Contact Area / um^2','Contact Area / %','Height (um)','Volume equivalent diameter (um)']


def train_energy():
    df=pd.read_csv(DATA/'energy_training.csv')
    df=df[df['power_W'].between(25,1200)].copy()
    if df['source_file'].nunique()<10:
        raise RuntimeError('Need >=10 independent flights')
    groups=df['source_file'].to_numpy()
    tr,te=next(GroupShuffleSplit(n_splits=1,test_size=0.26,random_state=SEED).split(df,groups=groups))
    Xtr=df.iloc[tr][ENERGY_FEATURES]; Xte=df.iloc[te][ENERGY_FEATURES]
    ytr=df.iloc[tr]['power_W'];yte=df.iloc[te]['power_W']
    model=HistGradientBoostingRegressor(max_iter=165,max_leaf_nodes=13,max_depth=5,min_samples_leaf=35,learning_rate=0.065,l2_regularization=5,random_state=SEED)
    model.fit(Xtr,ytr)
    pred=model.predict(Xte)
    # Model comparison against the median power of the same UAV in train set.
    baseline_by_uav=df.iloc[tr].groupby('uav')['power_W'].median().to_dict()
    base=df.iloc[te]['uav'].map(baseline_by_uav).fillna(float(ytr.median())).to_numpy()
    abs_errors=abs(yte.to_numpy()-pred)
    metrics={'rows':len(df),'train_flights':int(df.iloc[tr].source_file.nunique()),'heldout_flights':int(df.iloc[te].source_file.nunique()),
        'test_rows':len(te),'test_MAE_W':round(float(mean_absolute_error(yte,pred)),2),
        'test_RMSE_W':round(float(np.sqrt(mean_squared_error(yte,pred))),2),
        'test_R2':round(float(r2_score(yte,pred)),3),
        'baseline_uav_median_MAE_W':round(float(mean_absolute_error(yte,base)),2),
        'test_absolute_error_q90_W':round(float(np.quantile(abs_errors,.90)),2),
        'alt_range_m':list(np.round(df.alt_m.quantile([.01,.99]).values,2)),
        'wind_range_m_s':list(np.round(df.wind_m_s.dropna().quantile([.01,.99]).values,2)),
        'flight_grouped_holdout':True, 'training_targets':'measured_voltage_times_current',
        'fit_scope':'Three AMOVFLY UAV airframes; not validated for another drone or near-wall indoor flight'}
    # Keep the held-out metrics above untouched; refit deployment surrogate on all observed runs.
    model.fit(df[ENERGY_FEATURES],df['power_W'])
    metrics['demo_model_refit_all_flights']=True
    joblib.dump({'model':model,'features':ENERGY_FEATURES,'training_medians':{k:float(df[k].median()) for k in ENERGY_FEATURES},'metrics':metrics},MODELS/'energy.joblib')
    return metrics


def train_jia():
    d=pd.read_csv(DATA/'jia_training.csv')
    # Corrected readings may go just below zero because of background subtraction.
    d=d.copy(); d['response_g_m3']=d['conc_bg_corrected'].clip(lower=0)
    tr,te=next(GroupShuffleSplit(n_splits=1,test_size=.29,random_state=SEED).split(d,groups=d['soil_id']))
    Xtr=d.iloc[tr][JIA_FEATURES];Xte=d.iloc[te][JIA_FEATURES]
    ytr=np.log1p(d.iloc[tr]['response_g_m3']);yte=d.iloc[te]['response_g_m3']
    model=HistGradientBoostingRegressor(max_iter=125,max_leaf_nodes=7,max_depth=3,min_samples_leaf=10,learning_rate=.065,l2_regularization=2,random_state=SEED)
    model.fit(Xtr,ytr)
    p=np.clip(np.expm1(model.predict(Xte)),0,None)
    simple=np.full(len(te),float(d.iloc[tr]['response_g_m3'].median()))
    metrics={'rows':len(d),'soils':int(d.soil_id.nunique()),'train_soils':sorted(d.iloc[tr].soil_id.unique()),
        'heldout_soils':sorted(d.iloc[te].soil_id.unique()),'test_MAE_g_m3':round(float(mean_absolute_error(yte,p)),3),
        'test_R2':round(float(r2_score(yte,p)),3),'global_median_baseline_MAE_g_m3':round(float(mean_absolute_error(yte,simple)),3),
        'measured_wind_range_m_s':[float(d.wind_speed_m_s.min()),float(d.wind_speed_m_s.max())],
        'test_log_MAE':round(float(mean_absolute_error(np.log1p(yte),np.log1p(p))),3),
        'note':'Wind-tunnel concentration on tested farmland soils; no relation calibrated to a drone rotor wake'}
    # Refit on all measured rows for demonstrator within-study predictions
    model.fit(d[JIA_FEATURES],np.log1p(d['response_g_m3']))
    joblib.dump({'model':model,'features':JIA_FEATURES,'metrics':metrics,'soil_properties':d.drop_duplicates('soil_id').set_index('soil_id')[JIA_FEATURES[2:]].to_dict('index')},MODELS/'jia_concentration.joblib')
    return metrics


def train_bristol():
    d=pd.read_csv(DATA/'bristol_training.csv')
    X=d[BRISTOL_FEATURES];y=d['resuspended'].astype(int)
    model=make_pipeline(StandardScaler(), LogisticRegression(C=.7,max_iter=500,class_weight='balanced',random_state=SEED))
    # In-sample population of two different particle morphology figures; stratified CV is modest descriptive check, not generalisation validation.
    probs=cross_val_predict(model,X,y,cv=StratifiedKFold(5,shuffle=True,random_state=SEED),method='predict_proba')[:,1]
    pred=(probs>=.5).astype(int)
    # Cross-figure extrapolation exercise
    cross=[]
    for name in d['figure'].unique():
        keep=d.figure!=name; test=~keep
        m=make_pipeline(StandardScaler(),LogisticRegression(C=.7,class_weight='balanced',max_iter=500,random_state=SEED))
        m.fit(X[keep],y[keep]);yp=m.predict_proba(X[test])[:,1]
        cross.append({'heldout_figure':name,'n':int(test.sum()),'brier':round(float(brier_score_loss(y[test],yp)),3)})
    model.fit(X,y)
    metrics={'n_particles':len(d),'resuspended_Y':int(y.sum()),'within_sample_cv_brier':round(float(brier_score_loss(y,probs)),3),
        'within_sample_cv_balanced_accuracy':round(float(balanced_accuracy_score(y,pred)),3),
        'dummy_most_frequent_balanced_accuracy':.5,'cross_figure':cross,
        'note':'Conditional morphology classification; no rotor speed/surface shear input, NOT a rotor-induced emission law'}
    joblib.dump({'model':model,'features':BRISTOL_FEATURES,'metrics':metrics},MODELS/'bristol_detachment.joblib')
    return metrics


def main():
    results={'energy':train_energy(),'jia_wind_tunnel':train_jia(),'bristol_morphology':train_bristol(),
        'train_note':'Imputed radionuclide and conditional scenario values excluded from supervised labels. Radioactive activity used as scenario multiplier only.'}
    (OUT/'validation.json').write_text(json.dumps(results,indent=2))
    print(json.dumps(results,indent=2))

if __name__=='__main__':main()
