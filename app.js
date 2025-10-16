// ===== app.js (real OLS + ANOVA) =====

// DOM refs
const els = {
  subject: document.getElementById('subject'),
  gender: document.getElementById('gender'),
  school: document.getElementById('school'),
  ses: document.getElementById('ses'),
  toggleEqualMot: document.getElementById('toggleEqualMot'),
  beta: document.getElementById('beta'),
  pval: document.getElementById('pval'),
  r2: document.getElementById('r2'),
  n: document.getElementById('n')
};

let data = [];

// ---- utils ----
const isNum = v => Number.isFinite(v) && !isNaN(v);
const mean = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : NaN;
const variance = (arr, m=mean(arr)) => arr.length>1 ? arr.reduce((s,x)=>s+(x-m)*(x-m),0)/(arr.length-1) : NaN;
const covariance = (x,y) => {
  const n = Math.min(x.length, y.length);
  if (n < 2) return NaN;
  const mx = mean(x), my = mean(y);
  let s = 0; for (let i=0;i<n;i++) s += (x[i]-mx)*(y[i]-my);
  return s/(n-1);
};
const sumSqCentered = arr => {
  const m = mean(arr);
  return arr.reduce((s,x)=>s+(x-m)*(x-m),0);
};
const formatNum = v => (v===null || Number.isNaN(v)) ? '—' :
  (Math.abs(v) >= 100 ? v.toFixed(0) :
   Math.abs(v) >= 10 ? v.toFixed(2) :
   Math.abs(v) >= 1 ? v.toFixed(3) : v.toExponential(2));

// Incomplete beta & Student-t CDF (Numerical Recipes style) for p-values
function betacf(a,b,x){
  const MAXIT=200, EPS=3e-8, FPMIN=1e-30;
  let qab=a+b, qap=a+1, qam=a-1, c=1, d=1 - qab*x/qap;
  if (Math.abs(d)<FPMIN) d=FPMIN; d=1/d; let h=d;
  for(let m=1, m2=2; m<=MAXIT; m++, m2+=2){
    let aa=m*(b-m)*x/((qam+m2)*(a+m2));
    d=1+aa*d; if (Math.abs(d)<FPMIN) d=FPMIN; c=1+aa/c; if (Math.abs(c)<FPMIN) c=FPMIN;
    h*=d*c;
    aa=-(a+m)*(qab+a+m)*x/((a+m2)*(qap+m2));
    d=1+aa*d; if (Math.abs(d)<FPMIN) d=FPMIN; c=1+aa/c; if (Math.abs(c)<FPMIN) c=FPMIN;
    let del=d*c; h*=del; if (Math.abs(del-1)<EPS) break;
  }
  return h;
}
function betai(a,b,x){
  if (x<=0) return 0; if (x>=1) return 1;
  const bt = Math.exp(
    lgamma(a+b) - lgamma(a) - lgamma(b) + a*Math.log(x) + b*Math.log(1-x)
  );
  if (x < (a+1)/(a+b+2)) return bt*betacf(a,b,x)/a;
  return 1 - bt*betacf(b,a,1-x)/b;
}
function lgamma(z){ // Lanczos approx
  const g=7, p=[0.99999999999980993,676.5203681218851,-1259.1392167224028,
    771.32342877765313,-176.61502916214059,12.507343278686905,
    -0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if(z<0.5) return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z)) - lgamma(1-z);
  z-=1; let x=p[0]; for(let i=1;i<g+2;i++) x+=p[i]/(z+i);
  const t=z+g+0.5; return 0.5*Math.log(2*Math.PI)+(z+0.5)*Math.log(t)-t+Math.log(x);
}
// two-sided p from Student-t with df
function tCDF(t, df){ // returns CDF
  const x = df/(df + t*t);
  return 1 - 0.5*betai(df/2, 0.5, x);
}
function tPvalueTwoSided(t, df){
  if (!isNum(t) || !isNum(df) || df<=0) return NaN;
  const cdf = tCDF(Math.abs(t), df);
  return 2*(1 - cdf);
}

// Welch's t-test (two groups)
function welchTTest(a,b){
  const na=a.length, nb=b.length;
  const ma=mean(a), mb=mean(b);
  const va=variance(a,ma), vb=variance(b,mb);
  const se = Math.sqrt(va/na + vb/nb);
  const t = (ma-mb)/se;
  const df = (va/na + vb/nb)**2 / ((va*va)/((na*na)*(na-1)) + (vb*vb)/((nb*nb)*(nb-1)));
  const p = tPvalueTwoSided(t, df);
  return {t, df, p, diff: ma-mb};
}

// Simple OLS: y ~ x (intercept)
function simpleOLS(x,y){
  const n = Math.min(x.length, y.length);
  if (n < 3) return {beta:NaN, alpha:NaN, r2:NaN, t:NaN, p:NaN, n};
  const mx=mean(x), my=mean(y);
  const ssx = sumSqCentered(x);
  const sxy = x.reduce((s,xi,i)=> s + (xi-mx)*(y[i]-my), 0);
  const beta = sxy/ssx;                    // slope
  const alpha = my - beta*mx;              // intercept
  // R^2
  const yhat = x.map(xi => alpha + beta*xi);
  const sst = y.reduce((s,yi)=> s + (yi-my)*(yi-my), 0);
  const sse = y.reduce((s,yi,i)=> s + (yi-yhat[i])*(yi-yhat[i]), 0);
  const r2 = 1 - sse/sst;
  // SE(beta), t, p
  const sigma2 = sse/(n-2);
  const seBeta = Math.sqrt(sigma2/ssx);
  const t = beta / seBeta;
  const p = tPvalueTwoSided(t, n-2);
  return {beta, alpha, r2, t, p, n};
}

// ---- load CSV ----
Papa.parse('data.csv', {
  download: true,
  header: true,
  dynamicTyping: true,
  complete: (res) => {
    data = res.data.filter(r => r && r.subject && r.gender);
    // coerce numerics
    data.forEach(r=>{
      r.motivation = Number(r.motivation);
      r.interest   = Number(r.interest);
      r.study_time = Number(r.study_time);
      r.grade      = Number(r.grade);
    });
    attachEvents();
    draw();
  }
});

// ---- filtering & drawing ----
function filterData(){
  let d = data.filter(r =>
    (els.subject.value==="All" || r.subject===els.subject.value) &&
    (els.gender.value==="All" || r.gender===els.gender.value) &&
    (els.school.value==="All" || r.school_type===els.school.value) &&
    (els.ses.value==="All" || r.SES===els.ses.value)
  );
  // Equalize motivation/interest: keep motivation within ±1 around median
  if (els.toggleEqualMot.checked && d.length){
    const mVals = d.map(r=>r.motivation).filter(isNum).sort((a,b)=>a-b);
    const med = mVals[Math.floor(mVals.length/2)] ?? 5;
    d = d.filter(r => isNum(r.motivation) && Math.abs(r.motivation - med) < 1.0);
  }
  // keep only rows with numeric grade + motivation
  d = d.filter(r => isNum(r.grade) && isNum(r.motivation));
  return d;
}

function draw(){
  const d = filterData();
  const x = d.map(r=>r.motivation);
  const y = d.map(r=>r.grade);

  // ---- OLS ----
  const ols = simpleOLS(x,y);

  // Scatter
  Plotly.newPlot('scatter', [{
    x, y,
    text: d.map(r=>`${r.gender}, ${r.subject}`),
    mode: 'markers', type: 'scattergl'
  }], {
    margin:{l:40,r:10,t:10,b:40},
    xaxis:{title:'Motivation'},
    yaxis:{title:'Achievement'}
  });

  // ---- ANOVA (gender: two groups, Welch) ----
  const yM = d.filter(r=>r.gender==='Male').map(r=>r.grade);
  const yF = d.filter(r=>r.gender==='Female').map(r=>r.grade);
  const tRes = (yM.length>1 && yF.length>1) ? welchTTest(yM,yF) : {t:NaN, p:NaN, df:NaN, diff:NaN};

  // Bars
  const groups = ['Male','Female'];
  const means = [mean(yM), mean(yF)];
  Plotly.newPlot('bars', [{
    x: groups, y: means, type:'bar'
  }], { margin:{l:40,r:10,t:10,b:40}, yaxis:{title:'Mean Achievement'} });

  // ---- Update stat cards ----
  els.beta.textContent = isNum(ols.beta) ? formatNum(ols.beta) : '—';
  els.pval.textContent = isNum(ols.p) ? (ols.p<0.001?'<0.001':formatNum(ols.p)) : '—';
  els.r2.textContent   = isNum(ols.r2) ? formatNum(ols.r2) : '—';
  els.n.textContent    = ols.n ?? d.length;

  // (선택) 콘솔에 ANOVA 결과도 찍어두기
  console.log('Welch t (Male-Female):', tRes);
}

// attach once
function attachEvents(){
  ['subject','gender','school','ses'].forEach(id =>
    document.getElementById(id).addEventListener('change', draw)
  );
  els.toggleEqualMot.addEventListener('change', draw);
}


function filterData() {
  let d = data.filter(r =>
    (els.subject.value==="All" || r.subject===els.subject.value) &&
    (els.gender.value==="All" || r.gender===els.gender.value) &&
    (els.school.value==="All" || r.school_type===els.school.value) &&
    (els.ses.value==="All" || r.SES===els.ses.value)
  );
  if (els.toggleEqualMot.checked && d.length) {
    const mVals = d.map(r=>Number(r.motivation)).filter(v=>!isNaN(v)).sort((a,b)=>a-b);
    const med = mVals[Math.floor(mVals.length/2)] ?? 5;
    d = d.filter(r => Math.abs((Number(r.motivation)||0) - med) < 1.0);
  }
  return d;
}

function mean(arr, key) {
  const xs = arr.map(r=>Number(r[key])).filter(v=>!isNaN(v));
  return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
}

function draw() {
  const d = filterData();

  // Scatter: motivation vs grade (변경 원하면 interest로 바꿔도 됨)
  Plotly.newPlot('scatter', [{
    x: d.map(r=>Number(r.motivation)),
    y: d.map(r=>Number(r.grade)),
    text: d.map(r=>`${r.gender}, ${r.subject}`),
    mode: 'markers',
    type: 'scattergl'
  }], {margin:{l:40,r:10,t:10,b:40}, xaxis:{title:'Motivation'}, yaxis:{title:'Achievement'}});

  // Bars: mean grade by gender
  const groups = ['Male','Female'];
  const means = groups.map(g => mean(d.filter(r=>r.gender===g),'grade'));
  Plotly.newPlot('bars', [{
    x: groups, y: means, type:'bar'
  }], {margin:{l:40,r:10,t:10,b:40}, yaxis:{title:'Mean Achievement'}});

  // Simple stat placeholders (원하면 실제 회귀 계산 코드 넣어줄 수 있어요)
  els.beta.textContent = d.length > 0 ? '~ +0.3 (demo)' : '—';
  els.pval.textContent = d.length > 30 ? '< 0.05 (demo)' : '—';
  els.r2.textContent = '~ 0.25 (demo)';
  els.n.textContent = d.length;
}

// Re-draw on control changes
['subject','gender','school','ses'].forEach(id => {
  document.getElementById(id).addEventListener('change', draw);
});
els.toggleEqualMot.addEventListener('change', draw);


function filterData() {
  let d = data.filter(r =>
    (els.subject.value==="All" || r.subject===els.subject.value) &&
    (els.gender.value==="All" || r.gender===els.gender.value) &&
    (els.school.value==="All" || r.school_type===els.school.value) &&
    (els.ses.value==="All" || r.SES===els.ses.value)
  );
  if (els.toggleEqualMot.checked) {
    // “동기·흥미 동일 그룹” 가짜 매칭: 중간값 주변 범위만 사용
    const mMed = d.map(r=>r.motivation).sort((a,b)=>a-b)[Math.floor(d.length/2)] || 5;
    d = d.filter(r => Math.abs(r.motivation - mMed) < 1.0);
  }
  return d;
}

function draw() {
  const d = filterData();
  // 산점도: motivation vs grade
  Plotly.newPlot('scatter', [{
    x: d.map(r=>r.motivation),
    y: d.map(r=>r.grade),
    mode: 'markers',
    type: 'scattergl',
    text: d.map(r=>`${r.gender}, ${r.subject}`),
  }], {margin:{l:40,r:10,t:10,b:40}, xaxis:{title:'Motivation'}, yaxis:{title:'Achievement'}});

  // 막대: gender means
  const groups = ["Male","Female"];
  const means = groups.map(g=>{
    const s = d.filter(r=>r.gender===g);
    const mu = s.reduce((a,b)=>a+b.grade,0)/(s.length||1);
    return mu || null;
  });
  Plotly.newPlot('bars', [{
    x: groups, y: means, type:'bar'
  }], {margin:{l:40,r:10,t:10,b:40}, yaxis:{title:'Mean Achievement'}});

  // 통계(데모값)
  els.beta.textContent = "~ +0.3";
  els.pval.textContent = d.length>30 ? "< 0.05 (demo)" : "—";
  els.r2.textContent = "~ 0.25 (demo)";
  els.n.textContent = d.length;
}
['subject','gender','school','ses','toggleEqualMot'].forEach(id=>{
  (id==='toggleEqualMot'? els.toggleEqualMot: document.getElementById(id)).addEventListener('change', draw);
});
draw();


