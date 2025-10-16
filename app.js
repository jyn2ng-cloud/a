// TODO: CSV 로드 → 필터 반영 → Plotly로 차트 업데이트
// 최소 동작용 가짜 데이터
let data = Array.from({length: 120}, (_,i)=>({
  subject: i%2 ? "Math":"Language",
  gender: i%3? "Female":"Male",
  motivation: Math.random()*10,
  interest: Math.random()*10,
  study_time: Math.random()*12,
  grade: 60 + Math.random()*40,
  SES: ["Q1","Q2","Q3","Q4"][i%4],
  school_type: ["General","International","Autonomous"][i%3]
}));

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
