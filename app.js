// app.js — load CSV + draw charts

let data = [];

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

// 1) Load data.csv (header must be: id,subject,gender,motivation,interest,study_time,grade,SES,school_type)
Papa.parse('data.csv', {
  download: true,
  header: true,
  dynamicTyping: true,
  complete: (res) => {
    data = res.data.filter(r => r.subject && r.gender); // basic clean
    draw();
  }
});

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

