/* Neo Store · efeitos visuais
   Monograma 3D, revelar ao rolar, tema claro/escuro e destaque do menu. */
/* ================= Hero tilt ================= */
(()=>{if(reduce)return;const st=$('#stage'),tl=$('#tilt'),gl=$('#glint'),hero=$('.hero');
  hero.addEventListener('pointermove',e=>{const r=st.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
    tl.style.transform=`rotateY(${x*22}deg) rotateX(${-y*22}deg) translateZ(20px)`;gl.style.setProperty('--gx',(50+x*60)+'%');gl.style.setProperty('--gy',(50+y*60)+'%')});
  hero.addEventListener('pointerleave',()=>tl.style.transform='')})();

/* ================= Reveal on scroll ================= */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.15});
$$('.reveal').forEach(el=>io.observe(el));

/* ================= Theme toggle ================= */
$('#themeBtn').onclick=()=>{const r=document.documentElement;const dark=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;r.dataset.theme=dark?'light':'dark'};

/* nav pill */
(()=>{const nav=$('nav.main'),pill=nav.querySelector('.nav-pill'),links=[...nav.querySelectorAll(':scope > a, :scope > .dd > a')];let active=null;
  function place(a){links.forEach(l=>l.classList.toggle('lit',l===a));if(!a){pill.style.opacity=0;return}
    pill.style.opacity=1;pill.style.width=a.offsetWidth+'px';pill.style.transform=`translateX(${a.getBoundingClientRect().left-nav.getBoundingClientRect().left}px)`}
  links.forEach(a=>{a.addEventListener('mouseenter',()=>place(a));a.addEventListener('focus',()=>place(a));a.addEventListener('blur',()=>place(active));a.addEventListener('click',()=>{active=a;place(a)})});
  nav.addEventListener('mouseleave',()=>place(active));
  nav.querySelectorAll('.menu a').forEach(a=>a.addEventListener('click',()=>{active=a.closest('.dd').querySelector(':scope > a');place(active);a.blur()}));
  const loja=$('#loja'),sobre=$('#sobre');
  function spy(){if(nav.matches(':hover'))return;const y=innerHeight*.4;const inS=el=>{const r=el.getBoundingClientRect();return r.top<y&&r.bottom>y};
    let a=null;if(inS(sobre))a=links.find(l=>l.getAttribute('href')==='#sobre');else if(inS(loja))a=links.find(l=>l.dataset.go===filter.split(':')[0])||null;
    if(a!==active){active=a;place(a)}}
  addEventListener('scroll',spy,{passive:true});addEventListener('resize',()=>place(active));window.navSpy=spy;})();
