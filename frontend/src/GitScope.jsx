import { useState, useEffect, useRef, useCallback } from "react";

const API = "http://localhost:5001/api";

/* ═══ MOCK DATA ═══ */
const MOCK_REPOS=[{name:"hackumbc-web",full_name:"umbchackers/hackumbc-web",language:"JavaScript",stars:12,description:"hackUMBC official website"},{name:"flask",full_name:"pallets/flask",language:"Python",stars:68400,description:"The Python Micro Framework"},{name:"express",full_name:"expressjs/express",language:"JavaScript",stars:65200,description:"Fast Node.js web framework"}];
const MOCK_ANA={repo:"umbchackers/hackumbc-web",analyzed_at:new Date().toISOString(),files_analyzed:28,total_files:47,local:{tree:{file_count:47,dir_count:12,languages:{JavaScript:18,CSS:8,HTML:5,JSON:6,Markdown:3,Other:5},total_size_kb:342},ranked_files:[{path:"src/App.jsx",score:135,language:"React JSX"},{path:"package.json",score:110,language:"JSON"},{path:"README.md",score:105,language:"Markdown"},{path:"src/index.js",score:100,language:"JavaScript"},{path:"src/components/Schedule.jsx",score:85,language:"React JSX"},{path:"src/components/Navbar.jsx",score:82,language:"React JSX"},{path:"src/components/Hero.jsx",score:78,language:"React JSX"},{path:"src/components/FAQ.jsx",score:75,language:"React JSX"},{path:"src/styles/global.css",score:68,language:"CSS"},{path:"src/utils/api.js",score:52,language:"JavaScript"}],secrets:[{type:"API Key",file:"src/utils/api.js",line:3,preview:'API_KEY = "sk-..."',severity:"high"}],dependencies:{"package.json":{manager:"npm",count:14,dependencies:[{name:"react",version:"^18.2.0",dev:false}]}},quality:{total_lines:3847,code_lines:2891,comment_lines:234,blank_lines:722,comment_ratio:8.1,long_files:[{path:"src/components/Schedule.jsx",lines:342}],long_functions:[]}},ai:{summary:"A React-based SPA for hackUMBC. Built with Vite, React Router, Framer Motion, and Tailwind CSS. Features event schedule, FAQ, sponsors, and registration.",architecture:{pattern:"Component-Based SPA",entry_points:["src/index.js","src/App.jsx"],key_modules:[{name:"App Router",path:"src/App.jsx",purpose:"Main routing and layout"},{name:"Schedule",path:"src/components/Schedule.jsx",purpose:"Interactive event timeline"},{name:"Navigation",path:"src/components/Navbar.jsx",purpose:"Responsive nav"},{name:"Hero",path:"src/components/Hero.jsx",purpose:"Landing hero with animations"},{name:"API Utils",path:"src/utils/api.js",purpose:"Axios API client"}],data_flow:"User interactions → React state → API calls via axios → schedule data from static JSON"},security:{grade:"C+",confirmed_issues:[{severity:"high",description:"Hardcoded API key in client-side code",file:"src/utils/api.js",line:3,fix:"Move to environment variable"}],positive_practices:["Dependencies up to date","No inline scripts"]},quality:{grade:"B",strengths:["Clean component separation","Consistent naming"],improvements:["Add TypeScript","Schedule.jsx too long"],tech_debt:["No tests found"]},contribute:{setup_steps:["git clone repo","npm install","npm run dev","Open localhost:5173"],good_first_files:["src/App.jsx","src/components/Hero.jsx"],improvement_areas:["Add dark mode","Mobile responsiveness"]},stack:["React 18","Vite","React Router","Framer Motion","Tailwind CSS"],health_score:72}};
const MOCK_CHAT={answer:"The schedule is rendered by the Schedule component at src/components/Schedule.jsx. It loads data from src/data/schedule.json and uses React state for track filtering with staggered Framer Motion animations.",sources:[{file:"src/components/Schedule.jsx",lines:"1-342",relevance:"Main schedule component"}],follow_ups:["What filtering options exist?","How are animations done?","Where to add a new track?"]};

const PL=[{label:"Connecting to GitHub",icon:"📡",ms:500},{label:"Reading the file tree",icon:"🌲",ms:600},{label:"Running code analysis",icon:"⚡",ms:500},{label:"Mapping dependencies",icon:"📊",ms:550},{label:"Checking for leaked secrets",icon:"🔐",ms:650},{label:"Reading package files",icon:"📦",ms:450},{label:"Sending to Gemini AI for deep analysis",icon:"🧠",ms:1800},{label:"Building architecture map",icon:"⬡",ms:600},{label:"Wrapping up the report",icon:"✅",ms:300}];

/* ═══ THEME ═══ */
const C={bg:"#040814",bg2:"#0A1124",srf:"rgba(16,26,50,0.6)",srfH:"rgba(22,36,65,0.8)",bdr:"rgba(0,229,255,0.15)",bdrH:"rgba(0,229,255,0.4)",acc:"#00E5FF",accD:"rgba(0,229,255,0.1)",accG:"rgba(0,229,255,0.4)",red:"#FF3366",redD:"rgba(255,51,102,0.1)",amb:"#FFD600",blu:"#3399FF",prp:"#A78BFA",grn:"#34D399",txt:"#F0F4F8",dim:"#94A3B8",mut:"#475569"};
const LC={JavaScript:"#f7df1e",Python:"#3776ab",TypeScript:"#3178c6","React JSX":"#61dafb","React TSX":"#61dafb",HTML:"#e34c26",CSS:"#1572b6",JSON:"#a8a8a8",Markdown:"#808080",YAML:"#cb171e",Rust:"#ce412b",Go:"#00add8",Other:"#3a4d6e",Shell:"#89e051"};

const css=`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body,html{background:${C.bg};color:${C.txt};font-family:'Inter',sans-serif;overflow-x:hidden}
.mn{font-family:'JetBrains Mono',monospace}
canvas.pts{position:fixed;inset:0;z-index:0;pointer-events:none}
@keyframes gu{from{opacity:0;transform:translateY(30px) scale(0.98);filter:blur(4px)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}
@keyframes gp{0%,100%{opacity:1}50%{opacity:0.4}}
@keyframes gsp{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes gscan{from{transform:translateY(-100%)}to{transform:translateY(100vh)}}
@keyframes blink{50%{opacity:0}}
@keyframes glow{0%,100%{box-shadow:0 0 20px ${C.accG}}50%{box-shadow:0 0 40px ${C.accG},0 0 80px ${C.accD}}}
@keyframes flowDash{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}
@keyframes nodeEnter{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
@keyframes ringPulse{0%{transform:scale(1);opacity:0.5}100%{transform:scale(2);opacity:0}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes waveText{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.gi{animation:gu .7s cubic-bezier(.16,1,.3,1) forwards;opacity:0}
.gc{background:${C.srf};border:1px solid ${C.bdr};backdrop-filter:blur(16px);border-radius:16px;transition:all .3s ease}
.gc:hover{border-color:${C.bdrH};transform:translateY(-3px);box-shadow:0 10px 30px rgba(0,0,0,.5),0 0 20px ${C.accD}}
.gb{cursor:pointer;transition:all .3s ease}.gb:hover{transform:translateY(-2px);filter:brightness(1.2)}.gb:active{transform:translateY(0)}
.gf{cursor:pointer;transition:all .2s;border-radius:6px;padding:2px 6px;margin:-2px -6px}.gf:hover{background:${C.accD};color:${C.acc}}
.wave-text{background:linear-gradient(90deg,#fff 0%,${C.acc} 20%,${C.prp} 40%,${C.acc} 60%,#fff 80%,${C.acc} 100%);background-size:200% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:waveText 4s ease infinite}
.cursor-glow{position:fixed;width:400px;height:400px;border-radius:50%;pointer-events:none;z-index:0;background:radial-gradient(circle,rgba(255,255,255,0.04) 0%,transparent 60%);transition:transform .15s ease-out,opacity .3s;will-change:transform}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.mut};border-radius:10px}::-webkit-scrollbar-thumb:hover{background:${C.acc}}
input:focus{border-color:${C.acc}!important;box-shadow:0 0 0 3px ${C.accD}!important;outline:none}
`;

/* ═══ PARTICLES ═══ */
function Particles(){
  const ref=useRef(null);
  useEffect(()=>{
    const c=ref.current;if(!c)return;const ctx=c.getContext("2d");
    let w=c.width=window.innerWidth,h=c.height=window.innerHeight,pts=[];
    for(let i=0;i<120;i++)pts.push({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.15,vy:(Math.random()-.5)*.15,r:Math.random()*1.8+.4,o:Math.random()*.5+.3});
    const resize=()=>{w=c.width=window.innerWidth;h=c.height=window.innerHeight};
    window.addEventListener("resize",resize);
    let af;const draw=()=>{ctx.clearRect(0,0,w,h);
      pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;
        ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${p.o})`;ctx.fill();});
      af=requestAnimationFrame(draw);};draw();
    return()=>{cancelAnimationFrame(af);window.removeEventListener("resize",resize)};
  },[]);
  return <canvas ref={ref} className="pts"/>;
}

/* ═══ CURSOR GLOW ═══ */
function CursorGlow(){
  const ref=useRef(null);
  useEffect(()=>{
    const el=ref.current;if(!el)return;
    let x=0,y=0,visible=false;
    const move=e=>{x=e.clientX-200;y=e.clientY-200;if(!visible){el.style.opacity="1";visible=true}el.style.transform=`translate(${x}px,${y}px)`};
    const leave=()=>{el.style.opacity="0";visible=false};
    window.addEventListener("mousemove",move);
    document.addEventListener("mouseleave",leave);
    return()=>{window.removeEventListener("mousemove",move);document.removeEventListener("mouseleave",leave)};
  },[]);
  return<div ref={ref} className="cursor-glow" style={{opacity:0}}/>;
}

/* ═══ CHAT TEXT RENDERER ═══ */
function ChatText({text}){
  if(!text)return null;
  // Split on code fences
  const parts=text.split(/```[\w]*\n?/);
  return<div style={{fontSize:16,lineHeight:1.7}}>
    {parts.map((part,i)=>{
      if(i%2===1){
        // Code block
        return<pre key={i} className="mn" style={{background:C.bg2,border:`1px solid ${C.bdr}`,borderRadius:10,padding:"14px 18px",margin:"12px 0",fontSize:13,overflowX:"auto",whiteSpace:"pre-wrap",wordBreak:"break-all",color:C.acc}}>{part.trim()}</pre>
      }
      // Regular text — handle inline backticks
      const segs=part.split(/`([^`]+)`/);
      return<span key={i}>{segs.map((seg,j)=>{
        if(j%2===1)return<code key={j} className="mn" style={{background:C.bg2,padding:"2px 7px",borderRadius:5,fontSize:14,color:C.acc,border:`1px solid ${C.bdr}`}}>{seg}</code>;
        return<span key={j} style={{whiteSpace:"pre-wrap"}}>{seg}</span>
      })}</span>
    })}
  </div>
}

/* ═══ HOOKS ═══ */
function useCountUp(end,dur=1200,delay=0){const[v,setV]=useState(0);useEffect(()=>{if(!end)return;const t=setTimeout(()=>{const s=performance.now();const f=n=>{const p=Math.min((n-s)/dur,1);setV(Math.round((1-Math.pow(1-p,3))*end));if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f)},delay);return()=>clearTimeout(t)},[end,dur,delay]);return v}

/* ═══ COMPONENTS ═══ */
function Ring({score,size=150,delay=0,color}){
  const[as,setAs]=useState(0);const r=(size-14)/2,ci=2*Math.PI*r;
  useEffect(()=>{const t=setTimeout(()=>{const s=performance.now();const f=n=>{const p=Math.min((n-s)/1400,1);setAs(Math.round((1-Math.pow(1-p,4))*score));if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f)},delay);return()=>clearTimeout(t)},[score,delay]);
  const c=color||(as>=75?C.acc:as>=50?C.amb:C.red);const g=score>=90?"A+":score>=80?"A":score>=70?"B+":score>=60?"B":score>=50?"C":"D";
  return<div style={{position:"relative",width:size,height:size}}><div style={{position:"absolute",inset:-12,borderRadius:"50%",border:`1px solid ${c}`,animation:"ringPulse 2.5s ease-out infinite",opacity:.3}}/><svg width={size} height={size} style={{transform:"rotate(-90deg)"}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.bdr} strokeWidth="5"/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth="5" strokeDasharray={ci} strokeDashoffset={ci-(as/100)*ci} strokeLinecap="round" style={{filter:`drop-shadow(0 0 10px ${c}66)`}}/></svg><div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:size*.32,fontWeight:900,color:c,lineHeight:1}}>{as}</span><span style={{fontSize:size*.11,color:C.dim,marginTop:4,fontWeight:600,letterSpacing:".05em"}}>{g}</span></div></div>
}
function Stat({icon,value,label,color=C.acc,delay=0}){const n=typeof value==="number"?value:null;const av=useCountUp(n,1000,delay);return<div className="gc" style={{padding:"24px",display:"flex",flexDirection:"column",gap:8,animation:`gu .6s cubic-bezier(.16,1,.3,1) ${delay}ms forwards`,opacity:0}}><div style={{fontSize:14,color:C.dim,display:"flex",alignItems:"center",gap:8,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em"}}><span style={{fontSize:16}}>{icon}</span>{label}</div><div style={{fontSize:38,fontWeight:900,color,textShadow:`0 0 20px ${color}40`}}>{n!==null?av.toLocaleString():value}</div></div>}
function Badge({grade,label}){const c=grade?.startsWith("A")||grade?.startsWith("B")?C.acc:C.red;return<div style={{display:"inline-flex",alignItems:"center",gap:10,padding:"8px 20px",background:`${c}15`,border:`1px solid ${c}40`,borderRadius:10,boxShadow:`0 0 15px ${c}20`}}><span style={{fontWeight:800,color:c,fontSize:20}}>{grade}</span><span style={{color:C.txt,fontSize:14,fontWeight:600,letterSpacing:".04em"}}>{label}</span></div>}
function LBar({languages}){const t=Object.values(languages).reduce((a,b)=>a+b,0);const e=Object.entries(languages).sort((a,b)=>b[1]-a[1]);return<div><div style={{display:"flex",height:8,borderRadius:4,overflow:"hidden",marginBottom:14}}>{e.map(([l,n])=><div key={l} style={{width:`${(n/t)*100}%`,background:LC[l]||"#555",minWidth:3}}/>)}</div><div style={{display:"flex",flexWrap:"wrap",gap:"6px 20px"}}>{e.slice(0,6).map(([l,n])=><div key={l} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:C.dim}}><div style={{width:8,height:8,borderRadius:"50%",background:LC[l]||"#555"}}/>{l}<span className="mn" style={{color:C.txt,fontWeight:600}}>{n}</span></div>)}</div></div>}

/* ═══ INTERACTIVE ARCHITECTURE DIAGRAM ═══ */
function ArchDiagram({modules,onFileClick}){
  const[hover,setHover]=useState(null);
  if(!modules?.length)return null;
  const groups={};
  modules.forEach((m,i)=>{const dir=m.path.split("/").slice(0,-1).join("/")||"root";if(!groups[dir])groups[dir]=[];groups[dir].push({...m,idx:i})});
  const groupKeys=Object.keys(groups);
  const positions=modules.map((_,i)=>{const gi=Math.floor(i/Math.ceil(modules.length/Math.max(groupKeys.length,1)));const angle=(i/modules.length)*2*Math.PI-Math.PI/2;const radius=140;return{x:280+radius*Math.cos(angle),y:180+radius*Math.sin(angle),group:gi}});
  const connections=[];
  modules.forEach((m,i)=>{modules.forEach((n,j)=>{if(i<j){const samePath=m.path.split("/").slice(0,-1).join("/")=== n.path.split("/").slice(0,-1).join("/");if(samePath)connections.push({from:i,to:j,strong:true});else if(Math.random()>.6)connections.push({from:i,to:j,strong:false})}})});
  return(
    <svg width="100%" viewBox="0 0 560 360" style={{maxWidth:600}}>
      <defs>
        <filter id="nGlow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="nGlowStrong"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      {connections.map((c,i)=>{const a=positions[c.from],b=positions[c.to];const active=hover===c.from||hover===c.to;return<line key={`c${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active?C.acc:c.strong?`${C.acc}40`:`${C.acc}15`} strokeWidth={active?2:c.strong?1.5:.5} strokeDasharray={c.strong?"":"4 4"} style={{transition:"all .3s",animation:active?"flowDash .5s linear infinite":"none"}}/>})}
      <g style={{animation:"float 3s ease infinite",transformOrigin:"280px 180px"}}>
        <circle cx={280} cy={180} r={24} fill={C.accD} stroke={C.acc} strokeWidth={2} filter="url(#nGlow)"/>
        <text x={280} y={184} textAnchor="middle" fill={C.acc} fontSize="10" fontWeight="800" fontFamily="Inter">Core</text>
      </g>
      {modules.map((m,i)=>{const p=positions[i];const active=hover===i;return(
        <g key={i} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)} onClick={()=>onFileClick?.(m.path)} style={{cursor:"pointer",animation:`nodeEnter .5s ${i*100}ms cubic-bezier(.16,1,.3,1) forwards`,opacity:0,transformOrigin:`${p.x}px ${p.y}px`}}>
          <line x1={280} y1={180} x2={p.x} y2={p.y} stroke={active?C.acc:`${C.acc}20`} strokeWidth={active?1.5:.8} strokeDasharray="4 4" style={{transition:"all .3s",animation:active?"flowDash .5s linear infinite":"none"}}/>
          <circle cx={p.x} cy={p.y} r={active?34:30} fill={active?C.srfH:C.srf} stroke={active?C.acc:`${C.acc}50`} strokeWidth={active?2.5:1.5} filter={active?"url(#nGlowStrong)":"url(#nGlow)"} style={{transition:"all .3s"}}/>
          <text x={p.x} y={p.y-5} textAnchor="middle" fill={active?C.acc:C.txt} fontSize={active?"9":"8"} fontWeight="700" fontFamily="Inter" style={{transition:"all .2s"}}>{m.name.length>13?m.name.slice(0,12)+"…":m.name}</text>
          <text x={p.x} y={p.y+8} textAnchor="middle" fill={C.dim} fontSize="6.5" fontFamily="JetBrains Mono">{m.path.split("/").pop()}</text>
          {active&&<text x={p.x} y={p.y+20} textAnchor="middle" fill={C.acc} fontSize="6" fontFamily="JetBrains Mono" fontWeight="600">Click to view →</text>}
        </g>
      )})}
    </svg>
  );
}

/* ═══ CODE VIEWER ═══ */
function CodeV({filePath,content,onClose,highlightLines}){
  const lines=(content||"// Loading...").split("\n");
  return<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",backdropFilter:"blur(8px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"gu .2s ease"}}><div onClick={e=>e.stopPropagation()} style={{background:C.bg,border:`1px solid ${C.bdr}`,borderRadius:20,width:"100%",maxWidth:900,maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:`0 32px 64px rgba(0,0,0,.6),0 0 40px ${C.accD}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 24px",borderBottom:`1px solid ${C.bdr}`,background:C.bg2}}><span className="mn" style={{fontSize:14,color:C.acc,fontWeight:600}}>{filePath}</span><button onClick={onClose} className="gb" style={{background:`${C.red}15`,border:`1px solid ${C.red}30`,borderRadius:8,color:C.red,fontSize:13,padding:"6px 14px",fontWeight:700}}>ESC</button></div><div style={{overflow:"auto",flex:1,padding:"8px 0"}}>{lines.map((l,i)=>{const n=i+1,hl=highlightLines&&n>=highlightLines[0]&&n<=highlightLines[1];return<div key={i} style={{display:"flex",padding:"1px 0",background:hl?`${C.acc}12`:"transparent",borderLeft:hl?`3px solid ${C.acc}`:"3px solid transparent"}}><span className="mn" style={{width:54,textAlign:"right",paddingRight:16,fontSize:12,color:C.mut,userSelect:"none",flexShrink:0}}>{n}</span><pre className="mn" style={{fontSize:12.5,color:C.txt,margin:0,whiteSpace:"pre-wrap",wordBreak:"break-all"}}>{l||" "}</pre></div>})}</div></div></div>
}

/* ═══ TTS ENGINE ═══ */
function useTTS(){
  const[speaking,setSpeaking]=useState(false);
  const[voiceReady,setVoiceReady]=useState(false);
  const bestVoice=useRef(null);
  const utterRef=useRef(null);

  useEffect(()=>{
    const loadVoices=()=>{
      const voices=window.speechSynthesis?.getVoices()||[];
      if(voices.length===0)return;
      // Prefer natural-sounding voices
      const prefs=["Google US English","Google UK English Female","Microsoft Jenny","Samantha","Karen","Daniel","Moira"];
      for(const p of prefs){const v=voices.find(v=>v.name.includes(p));if(v){bestVoice.current=v;break}}
      if(!bestVoice.current){bestVoice.current=voices.find(v=>v.lang.startsWith("en"))||voices[0]}
      setVoiceReady(true);
    };
    loadVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged",loadVoices);
    return()=>window.speechSynthesis?.removeEventListener?.("voiceschanged",loadVoices);
  },[]);

  const speak=(text,onEnd)=>{
    if(!window.speechSynthesis)return;
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    if(bestVoice.current)u.voice=bestVoice.current;
    u.rate=1.0;u.pitch=1.0;u.volume=1;
    u.onstart=()=>setSpeaking(true);
    u.onend=()=>{setSpeaking(false);onEnd?.()};
    u.onerror=()=>{setSpeaking(false);onEnd?.()};
    utterRef.current=u;
    window.speechSynthesis.speak(u);
  };

  const stop=()=>{window.speechSynthesis?.cancel();setSpeaking(false)};
  const pause=()=>window.speechSynthesis?.pause();
  const resume=()=>window.speechSynthesis?.resume();

  return{speak,stop,pause,resume,speaking,voiceReady,voiceName:bestVoice.current?.name||"Default"};
}

/* ═══ WALKTHROUGH ═══ */
function Walkthrough({analysis,onFileClick}){
  const[scenes,setScenes]=useState(null);const[loading,setLoading]=useState(false);
  const[idx,setIdx]=useState(0);const[playing,setPlaying]=useState(false);const[autoPlay,setAutoPlay]=useState(false);
  const[error,setError]=useState(null);
  const[videos,setVideos]=useState({});// scene_type -> {job_id, status}
  const tts=useTTS();
  const{local,ai}=analysis;const[owner,repo]=(analysis.repo||"x/x").split("/");

  // Poll video status
  useEffect(()=>{
    const pending=Object.entries(videos).filter(([_,v])=>v.status==="generating");
    if(pending.length===0)return;
    const iv=setInterval(async()=>{
      for(const[st,v]of pending){
        try{
          const r=await fetch(`${API}/video/status/${v.job_id}`);
          const d=await r.json();
          if(d.status!=="generating"){setVideos(prev=>({...prev,[st]:{...prev[st],status:d.status}}))}
        }catch{}
      }
    },5000);
    return()=>clearInterval(iv);
  },[videos]);

  const kickoffVideos=async()=>{
    try{
      // Generate videos for ALL walkthrough scenes
      const r=await fetch(`${API}/video/generate-all`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({repo:`${owner}/${repo}`})});
      const d=await r.json();
      if(d.scenes){setVideos(d.scenes)}
    }catch{/* video is optional */}
  };

  const generate=async()=>{
    setLoading(true);setError(null);
    try{
      const r=await fetch(`${API}/walkthrough`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({owner,repo})});
      const d=await r.json();
      if(d.scenes){setScenes(d.scenes);setIdx(0);kickoffVideos()}
      else setError("Could not generate walkthrough")
    }catch{
      setError("Backend unavailable — using fallback walkthrough");
      const fb=generateFallbackScenes(analysis);
      setScenes(fb);setIdx(0);kickoffVideos();
    }
    setLoading(false);
  };

  const playScene=(i)=>{
    if(!scenes?.[i])return;
    setIdx(i);setPlaying(true);
    tts.speak(scenes[i].narration,()=>{
      setPlaying(false);
      if(autoPlay&&i<scenes.length-1){setTimeout(()=>playScene(i+1),800)}
    });
  };
  const togglePlay=()=>{if(playing){tts.stop();setPlaying(false)}else{playScene(idx)}};
  const next=()=>{tts.stop();setPlaying(false);if(idx<scenes.length-1){const ni=idx+1;setIdx(ni);if(autoPlay)setTimeout(()=>playScene(ni),300)}};
  const prev=()=>{tts.stop();setPlaying(false);if(idx>0)setIdx(idx-1)};
  const playAll=()=>{setAutoPlay(true);playScene(0)};

  useEffect(()=>()=>tts.stop(),[]);

  const scn=scenes?.[idx];
  const VT={overview:"📋",architecture:"⬡",code:"📄",security:"🛡",stats:"📊",closing:"🎯"};

  // Scene visual content — SVG charts, architecture diagrams, visual graphs
  const SceneVisual=({scene})=>{
    const vt=scene.visual_type;
    const langs=local?.tree?.languages||{};
    const langEntries=Object.entries(langs).sort((a,b)=>b[1]-a[1]);
    const langTotal=Object.values(langs).reduce((a,b)=>a+b,0)||1;
    const ranked=local?.ranked_files||[];
    const secrets=local?.secrets||[];
    const quality=local?.quality||{};
    const modules=ai?.architecture?.key_modules||[];

    // OVERVIEW: Donut chart of languages + stat counters
    if(vt==="overview"){
      const donutR=70,donutW=18,cx=100,cy=100;
      let cumAngle=0;
      const arcs=langEntries.slice(0,8).map(([l,n])=>{
        const frac=n/langTotal;const startA=cumAngle;cumAngle+=frac*Math.PI*2;
        const endA=cumAngle;const large=frac>0.5?1:0;
        const x1=cx+donutR*Math.cos(startA-Math.PI/2),y1=cy+donutR*Math.sin(startA-Math.PI/2);
        const x2=cx+donutR*Math.cos(endA-Math.PI/2),y2=cy+donutR*Math.sin(endA-Math.PI/2);
        return{l,n,frac,d:`M ${x1} ${y1} A ${donutR} ${donutR} 0 ${large} 1 ${x2} ${y2}`,color:LC[l]||"#555"};
      });
      return<div style={{display:"flex",gap:28,alignItems:"center"}}>
        <div style={{flexShrink:0}}>
          <svg width={200} height={200} viewBox="0 0 200 200">
            {arcs.map((a,i)=><path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={donutW} strokeLinecap="round" style={{animation:`gu .8s ${i*100}ms ease forwards`,opacity:0}}/>)}
            <text x={cx} y={cy-6} textAnchor="middle" fill={C.txt} fontSize="28" fontWeight="900" fontFamily="Inter">{local?.tree?.file_count||0}</text>
            <text x={cx} y={cy+14} textAnchor="middle" fill={C.dim} fontSize="11" fontWeight="600" fontFamily="Inter">FILES</text>
          </svg>
          <div style={{display:"flex",flexWrap:"wrap",gap:"4px 14px",justifyContent:"center",marginTop:8}}>{arcs.map(a=><span key={a.l} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.dim}}><span style={{width:8,height:8,borderRadius:"50%",background:a.color}}/>{a.l} {Math.round(a.frac*100)}%</span>)}</div>
        </div>
        <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[{v:(quality.code_lines||0).toLocaleString(),l:"Lines of Code",icon:"📝"},{v:Object.values(local?.dependencies||{}).reduce((a,d)=>a+d.count,0),l:"Dependencies",icon:"📦"},{v:`${quality.comment_ratio||0}%`,l:"Comment Ratio",icon:"💬"},{v:secrets.length,l:"Secrets Found",icon:"🔐",bad:secrets.length>0}].map(s=>
            <div key={s.l} style={{padding:16,background:C.bg2,border:`1px solid ${s.bad?C.red+"50":C.bdr}`,borderRadius:12,textAlign:"center"}}>
              <div style={{fontSize:16,marginBottom:4}}>{s.icon}</div>
              <div style={{fontSize:24,fontWeight:900,color:s.bad?C.red:C.acc}}>{s.v}</div>
              <div className="mn" style={{fontSize:10,color:C.dim,letterSpacing:".06em"}}>{s.l}</div>
            </div>
          )}
        </div>
      </div>
    }

    // ARCHITECTURE: Actual interactive node diagram
    if(vt==="architecture"){
      return<div>
        <div style={{display:"flex",gap:16,marginBottom:20}}>
          <div style={{padding:16,background:`linear-gradient(135deg,${C.srf},${C.accD})`,borderRadius:12,border:`1px solid ${C.bdr}`,flex:1}}>
            <div className="mn" style={{fontSize:10,color:C.dim,letterSpacing:".1em",marginBottom:6}}>PATTERN</div>
            <div style={{fontSize:20,fontWeight:800}}>{ai?.architecture?.pattern||"—"}</div>
          </div>
          <div style={{padding:16,background:C.bg2,borderRadius:12,border:`1px solid ${C.bdr}`,flex:1}}>
            <div className="mn" style={{fontSize:10,color:C.dim,letterSpacing:".1em",marginBottom:6}}>DATA FLOW</div>
            <div style={{fontSize:12,color:C.dim,lineHeight:1.5}}>{(ai?.architecture?.data_flow||"").slice(0,120)}{(ai?.architecture?.data_flow||"").length>120?"...":""}</div>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"center",background:`${C.bg2}80`,borderRadius:16,border:`1px solid ${C.bdr}`,padding:16}}>
          <ArchDiagram modules={modules} onFileClick={path=>onFileClick?.(path)}/>
        </div>
      </div>
    }

    // CODE: Horizontal bar chart of file importance
    if(vt==="code"){
      const top=ranked.slice(0,10);const maxScore=top[0]?.score||1;
      const barH=24,gap=6,svgH=top.length*(barH+gap)+20;
      return<div>
        <svg width="100%" viewBox={`0 0 700 ${svgH}`} style={{maxWidth:800}}>
          {top.map((f,i)=>{
            const pct=(f.score/maxScore);const barW=pct*420;const y=i*(barH+gap)+10;
            const col=LC[f.language]||C.acc;
            return<g key={f.path} onClick={()=>onFileClick?.(f.path)} style={{cursor:"pointer",animation:`gu .5s ${i*60}ms ease forwards`,opacity:0}}>
              <rect x={250} y={y} width={barW} height={barH} rx={4} fill={col} opacity={0.8}/>
              <rect x={250} y={y} width={barW} height={barH} rx={4} fill={`url(#barShine)`} opacity={0.3}/>
              <text x={245} y={y+barH/2+4} textAnchor="end" fill={C.dim} fontSize="11" fontFamily="JetBrains Mono" fontWeight="500">{f.path.length>30?f.path.slice(-30):f.path}</text>
              <text x={255+barW+8} y={y+barH/2+4} fill={C.dim} fontSize="10" fontFamily="JetBrains Mono">{f.score}</text>
              <circle cx={250+barW-8} cy={y+barH/2} r={3} fill="#fff" opacity={0.6}/>
            </g>
          })}
          <defs><linearGradient id="barShine" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity="0.3"/><stop offset="100%" stopColor="#fff" stopOpacity="0"/></linearGradient></defs>
        </svg>
      </div>
    }

    // SECURITY: Visual severity gauge + findings
    if(vt==="security"){
      const grade=ai?.security?.grade||"?";const issues=ai?.security?.confirmed_issues||[];
      const positives=ai?.security?.positive_practices||[];
      const gradeScore={"A+":100,A:92,"A-":85,"B+":78,B:70,"B-":62,"C+":55,C:48,"C-":40,D:25,F:10}[grade]||50;
      const gaugeR=60,gaugeW=12,gcx=80,gcy=80;
      const gaugeArc=Math.PI*1.5;const filled=gaugeArc*(gradeScore/100);
      const gStart=-Math.PI*0.75;
      const x1=gcx+gaugeR*Math.cos(gStart),y1=gcy+gaugeR*Math.sin(gStart);
      const x2=gcx+gaugeR*Math.cos(gStart+filled),y2=gcy+gaugeR*Math.sin(gStart+filled);
      const gColor=gradeScore>=70?C.acc:gradeScore>=50?C.amb:C.red;
      return<div style={{display:"flex",gap:24,alignItems:"flex-start"}}>
        <div style={{flexShrink:0,textAlign:"center"}}>
          <svg width={160} height={160} viewBox="0 0 160 160">
            <circle cx={gcx} cy={gcy} r={gaugeR} fill="none" stroke={`${C.bdr}`} strokeWidth={gaugeW} strokeDasharray={`${gaugeArc*gaugeR} ${2*Math.PI*gaugeR}`} strokeLinecap="round" transform={`rotate(-135 ${gcx} ${gcy})`}/>
            <circle cx={gcx} cy={gcy} r={gaugeR} fill="none" stroke={gColor} strokeWidth={gaugeW} strokeDasharray={`${filled*gaugeR} ${2*Math.PI*gaugeR}`} strokeLinecap="round" transform={`rotate(-135 ${gcx} ${gcy})`} style={{filter:`drop-shadow(0 0 8px ${gColor}66)`,transition:"stroke-dasharray 1.5s ease"}}/>
            <text x={gcx} y={gcy+4} textAnchor="middle" fill={gColor} fontSize="36" fontWeight="900" fontFamily="Inter">{grade}</text>
            <text x={gcx} y={gcy+22} textAnchor="middle" fill={C.dim} fontSize="10" fontWeight="600" fontFamily="Inter">SECURITY</text>
          </svg>
        </div>
        <div style={{flex:1}}>
          {issues.length>0?issues.slice(0,4).map((iss,i)=>
            <div key={i} style={{padding:"10px 14px",marginBottom:8,background:`${C.red}08`,borderLeft:`3px solid ${iss.severity==="high"?C.red:C.amb}`,borderRadius:"0 8px 8px 0",animation:`gu .4s ${i*100}ms ease forwards`,opacity:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span className="mn" style={{fontSize:10,fontWeight:800,color:iss.severity==="high"?C.red:C.amb,textTransform:"uppercase",padding:"2px 8px",background:`${iss.severity==="high"?C.red:C.amb}20`,borderRadius:4}}>{iss.severity}</span>
                <span style={{fontSize:13,fontWeight:600}}>{iss.description}</span>
              </div>
              {iss.file&&<div className="mn gf" onClick={()=>onFileClick?.(iss.file)} style={{fontSize:11,color:C.acc,marginTop:4,cursor:"pointer"}}>📄 {iss.file}{iss.line?`:${iss.line}`:""}</div>}
            </div>
          ):<div style={{padding:20,background:`${C.acc}08`,border:`1px solid ${C.acc}25`,borderRadius:12,textAlign:"center"}}><span style={{fontSize:28}}>✓</span><div style={{color:C.acc,fontWeight:700,marginTop:8}}>No critical issues detected</div></div>}
          {positives.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:12}}>{positives.slice(0,3).map((p,i)=><span key={i} style={{fontSize:11,padding:"5px 12px",background:`${C.acc}10`,borderRadius:6,color:C.acc,border:`1px solid ${C.acc}20`}}>✓ {p}</span>)}</div>}
        </div>
      </div>
    }

    // QUALITY: Visual metric bars + gauge
    if(vt==="stats"){
      const grade=ai?.quality?.grade||"?";
      const gradeScore={"A+":100,A:92,"A-":85,"B+":78,B:70,"B-":62,"C+":55,C:48,"C-":40,D:25,F:10}[grade]||50;
      const gColor=gradeScore>=70?C.acc:gradeScore>=50?C.amb:C.red;
      const metrics=[
        {l:"Code Lines",v:quality.code_lines||0,max:Math.max(quality.code_lines||1,5000)},
        {l:"Comment Lines",v:quality.comment_lines||0,max:Math.max(quality.code_lines||1,5000)},
        {l:"Comment Ratio",v:quality.comment_ratio||0,max:30,suffix:"%"},
        {l:"Blank Lines",v:quality.blank_lines||0,max:Math.max(quality.code_lines||1,5000)},
      ];
      const strengths=ai?.quality?.strengths||[];
      const improvements=ai?.quality?.improvements||[];
      const barH=14,mGap=28,svgH=metrics.length*mGap+20;
      return<div style={{display:"flex",gap:24,alignItems:"flex-start"}}>
        <div style={{flexShrink:0,textAlign:"center",padding:"20px 0"}}>
          <div style={{position:"relative",width:120,height:120}}>
            <Ring score={gradeScore} size={120} delay={200} color={gColor}/>
          </div>
          <div className="mn" style={{fontSize:11,color:C.dim,marginTop:8,letterSpacing:".1em"}}>CODE QUALITY</div>
        </div>
        <div style={{flex:1}}>
          <svg width="100%" viewBox={`0 0 500 ${svgH}`} style={{marginBottom:16}}>
            {metrics.map((m,i)=>{
              const y=i*mGap+10;const pct=Math.min(1,m.v/m.max);const barW=pct*320;
              return<g key={m.l} style={{animation:`gu .5s ${i*80}ms ease forwards`,opacity:0}}>
                <text x={0} y={y+barH/2+4} fill={C.dim} fontSize="11" fontFamily="JetBrains Mono">{m.l}</text>
                <rect x={140} y={y} width={320} height={barH} rx={barH/2} fill={`${C.acc}15`}/>
                <rect x={140} y={y} width={Math.max(4,barW)} height={barH} rx={barH/2} fill={C.acc} style={{transition:"width 1s ease"}}/>
                <text x={468} y={y+barH/2+4} fill={C.txt} fontSize="12" fontFamily="JetBrains Mono" fontWeight="700">{typeof m.v==="number"?m.v.toLocaleString():m.v}{m.suffix||""}</text>
              </g>
            })}
          </svg>
          <div style={{display:"flex",gap:16}}>
            {strengths.length>0&&<div style={{flex:1}}><div className="mn" style={{fontSize:10,color:C.acc,marginBottom:6,letterSpacing:".1em"}}>STRENGTHS</div>{strengths.slice(0,3).map((s,i)=><div key={i} style={{fontSize:12,color:C.dim,padding:"3px 0"}}>✓ {s}</div>)}</div>}
            {improvements.length>0&&<div style={{flex:1}}><div className="mn" style={{fontSize:10,color:C.amb,marginBottom:6,letterSpacing:".1em"}}>TO IMPROVE</div>{improvements.slice(0,3).map((s,i)=><div key={i} style={{fontSize:12,color:C.dim,padding:"3px 0"}}>→ {s}</div>)}</div>}
          </div>
        </div>
      </div>
    }

    // CLOSING: Large health ring + grade summary + stack
    if(vt==="closing"){
      const score=ai?.health_score||0;
      return<div style={{display:"flex",gap:32,alignItems:"center"}}>
        <Ring score={score} size={170} delay={300}/>
        <div style={{flex:1}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
            {[{l:"SECURITY",v:ai?.security?.grade||"?"},{l:"QUALITY",v:ai?.quality?.grade||"?"},{l:"FILES",v:local?.tree?.file_count||0}].map(g=>{
              const gc=(typeof g.v==="string"&&(g.v.startsWith("A")||g.v.startsWith("B")))?C.acc:typeof g.v==="number"?C.acc:C.amb;
              return<div key={g.l} style={{padding:14,background:C.bg2,border:`1px solid ${C.bdr}`,borderRadius:10,textAlign:"center"}}>
                <div style={{fontSize:28,fontWeight:900,color:gc}}>{g.v}</div>
                <div className="mn" style={{fontSize:10,color:C.dim,letterSpacing:".1em"}}>{g.l}</div>
              </div>
            })}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{(ai?.stack||[]).slice(0,8).map(s=><span key={s} className="mn" style={{fontSize:11,padding:"5px 12px",borderRadius:6,background:C.accD,border:`1px solid ${C.acc}30`,color:C.acc}}>{s}</span>)}</div>
        </div>
      </div>
    }

    return null;
  };

  // Pre-generate screen
  if(!scenes){
    return<div className="gi" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:500,textAlign:"center"}}>
      <div style={{fontSize:64,marginBottom:24,animation:"float 3s ease infinite"}}>🎙</div>
      <h3 style={{fontSize:28,fontWeight:800,marginBottom:12}}>Narrated <span style={{color:C.acc}}>Walkthrough</span></h3>
      <p style={{fontSize:16,color:C.dim,marginBottom:8,maxWidth:500,lineHeight:1.6}}>Get a guided tour of this codebase in 6 short scenes. It's like having someone walk you through the repo and explain each part.</p>
      <div className="mn" style={{fontSize:12,color:C.mut,marginBottom:32}}>Voice: {tts.voiceName}{tts.voiceReady?" ✓":" (loading...)"}</div>
      {error&&<div style={{color:C.red,marginBottom:16,fontSize:14}}>{error}</div>}
      <button onClick={generate} disabled={loading} className="gb" style={{padding:"18px 48px",background:loading?C.mut:`linear-gradient(135deg,${C.acc},${C.blu})`,border:"none",borderRadius:14,color:C.bg,fontWeight:800,fontSize:17,letterSpacing:".03em",boxShadow:`0 8px 32px ${C.accG}`}}>
        {loading?"Generating Script...":"Generate Walkthrough →"}
      </button>
      {loading&&<div style={{marginTop:20,display:"flex",gap:6}}>{[0,1,2,3].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:C.acc,animation:`gp 1.2s infinite ${i*.2}s`}}/>)}</div>}
    </div>
  }

  // Player screen
  return<div className="gi">
    {/* Progress bar */}
    <div style={{display:"flex",gap:4,marginBottom:24}}>
      {scenes.map((_,i)=><div key={i} onClick={()=>{tts.stop();setPlaying(false);setIdx(i)}} style={{flex:1,height:4,borderRadius:2,background:i<=idx?C.acc:`${C.acc}25`,cursor:"pointer",transition:"background .3s"}}/>)}
    </div>

    {/* Scene header */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <span style={{fontSize:28}}>{VT[scn?.visual_type]||"📋"}</span>
        <div>
          <div className="mn" style={{fontSize:11,color:C.dim,letterSpacing:".15em"}}>SCENE {idx+1} OF {scenes.length}</div>
          <div style={{fontSize:24,fontWeight:800}}>{scn?.title}</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        {(()=>{const gen=Object.values(videos).filter(v=>v.status==="generating").length;const done=Object.values(videos).filter(v=>v.status==="done").length;if(gen>0)return<span className="mn" style={{fontSize:11,color:C.amb,display:"flex",alignItems:"center",gap:6}}><span style={{width:6,height:6,borderRadius:"50%",background:C.amb,animation:"gp 1s infinite"}}/>Rendering {gen} video{gen>1?"s":""}...</span>;if(done>0)return<span className="mn" style={{fontSize:11,color:C.acc}}>🎬 {done} video{done>1?"s":""} ready</span>;return null})()}
        {videos[scn?.visual_type]?.status==="generating"&&<span className="mn" style={{fontSize:11,color:C.prp}}>(this scene rendering...)</span>}
        <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.dim,cursor:"pointer"}}>
          <input type="checkbox" checked={autoPlay} onChange={e=>setAutoPlay(e.target.checked)} style={{accentColor:C.acc}}/>
          Auto-play
        </label>
      </div>
    </div>

    {/* Narration text */}
    <div className="gc" style={{padding:"28px 32px",marginBottom:24,borderLeft:`4px solid ${playing?C.acc:C.bdr}`,transition:"border-color .3s"}}>
      <div style={{fontSize:17,lineHeight:1.8,color:playing?C.txt:C.dim,transition:"color .3s"}}>{scn?.narration}</div>
      {playing&&<div style={{display:"flex",gap:3,marginTop:12}}>{[0,1,2,3,4].map(i=><div key={i} style={{width:3,height:12+Math.sin(Date.now()/200+i)*8,background:C.acc,borderRadius:2,animation:`gp .6s infinite ${i*.1}s`}}/>)}</div>}
    </div>

    {/* Scene visual — Video (primary) or data viz (fallback) */}
    <div className="gc" style={{padding:videos[scn?.visual_type]?.status==="done"?0:28,marginBottom:28,overflow:"hidden"}}>
      {videos[scn?.visual_type]?.status==="done"?
        <div style={{position:"relative"}}>
          <video key={videos[scn?.visual_type]?.job_id} autoPlay loop muted={!playing} playsInline style={{width:"100%",display:"block",maxHeight:360,objectFit:"cover"}}
            src={`${API}/video/file/${videos[scn?.visual_type]?.job_id}`}/>
          <div style={{position:"absolute",bottom:12,right:12,padding:"4px 12px",background:"rgba(0,0,0,.7)",borderRadius:8,backdropFilter:"blur(8px)"}}>
            <span className="mn" style={{fontSize:10,color:C.acc,letterSpacing:".1em"}}>GENERATED BY VEO 3.1</span>
          </div>
        </div>
      :<SceneVisual scene={scn||{}}/>}
    </div>

    {/* Controls */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16}}>
      <button onClick={prev} disabled={idx===0} className="gb" style={{width:48,height:48,borderRadius:"50%",background:C.bg2,border:`1px solid ${C.bdr}`,color:idx===0?C.mut:C.txt,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>◀</button>
      <button onClick={togglePlay} className="gb" style={{width:72,height:72,borderRadius:"50%",background:playing?C.red:`linear-gradient(135deg,${C.acc},${C.blu})`,border:"none",color:playing?"#fff":C.bg,fontSize:24,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 8px 32px ${playing?C.red+"50":C.accG}`}}>{playing?"⏸":"▶"}</button>
      <button onClick={next} disabled={idx>=scenes.length-1} className="gb" style={{width:48,height:48,borderRadius:"50%",background:C.bg2,border:`1px solid ${C.bdr}`,color:idx>=scenes.length-1?C.mut:C.txt,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>▶</button>
    </div>
    <div style={{textAlign:"center",marginTop:12}}>
      <button onClick={playAll} className="gb mn" style={{background:"transparent",border:"none",color:C.acc,fontSize:12,fontWeight:600,letterSpacing:".08em"}}>▶ PLAY ALL FROM START</button>
    </div>
  </div>;
}

function generateFallbackScenes(analysis){
  const{local,ai}=analysis;
  const langs=local?.tree?.languages||{};
  const primary=Object.keys(langs).sort((a,b)=>langs[b]-langs[a])[0]||"code";
  const files=local?.tree?.file_count||0;
  const stack=ai?.stack||[];
  const top=(local?.ranked_files||[]).slice(0,3).map(f=>f.path);
  return[
    {id:1,title:"The Big Picture",narration:`Alright, let's check out ${analysis.repo}. ${ai?.summary||`It's a ${primary} project with ${files} files.`} The main language is ${primary}, and it uses ${stack.length>0?stack.slice(0,3).join(", "):"a mix of tools"}.`,visual_type:"overview",highlight_files:top.slice(0,1),key_points:[`${primary} primary`,`${files} files`,stack[0]||""]},
    {id:2,title:"How It's Built",narration:`Under the hood, this project follows a ${ai?.architecture?.pattern||"standard"} structure. ${ai?.architecture?.data_flow||"Data moves through the main files in a straightforward way."} Once you see the pattern, navigating the code gets a lot easier.`,visual_type:"architecture",highlight_files:(ai?.architecture?.key_modules||[]).slice(0,3).map(m=>m.path),key_points:[ai?.architecture?.pattern||"Standard","See key modules"]},
    {id:3,title:"Where to Start Reading",narration:`If you're new to this codebase, open ${top[0]||"the main entry file"} first. That's the starting point — everything else branches out from there. Follow the imports and you'll quickly see how the pieces connect.`,visual_type:"code",highlight_files:top.slice(0,2),key_points:["Start at entry point","Follow imports"]},
    {id:4,title:"Code Quality",narration:`Quality-wise, this repo ${(ai?.quality?.strengths||[]).length>0?"does some things well: "+ai.quality.strengths.slice(0,2).join(", ")+".":"has decent structure overall."} ${(ai?.quality?.improvements||[]).length>0?"A few things could be better: "+ai.quality.improvements.slice(0,2).join(", ")+".":"Pretty clean codebase overall."}`,visual_type:"stats",highlight_files:[],key_points:[`Quality: ${ai?.quality?.grade||"?"}`,`${local?.quality?.comment_ratio||0}% comments`,`${local?.quality?.code_lines||0} LOC`]},
    {id:5,title:"Security Check",narration:`Security gets a ${ai?.security?.grade||"?"} grade here. ${(local?.secrets||[]).length>0?`Watch out — there are ${local.secrets.length} possible secrets exposed in the code. Those should be moved to environment variables.`:"Good news: no exposed secrets were found."} The overall health score is ${ai?.health_score||50} out of 100.`,visual_type:"security",highlight_files:[],key_points:[`Security: ${ai?.security?.grade||"?"}`,`Secrets: ${(local?.secrets||[]).length}`,`Health: ${ai?.health_score||50}/100`]},
    {id:6,title:"The Verdict",narration:`That's the full picture of ${analysis.repo}. ${(ai?.health_score||50)>=60?"It's in good shape overall.":"There's room for improvement, but the foundation is solid."} Health score: ${ai?.health_score||50} out of 100, built mainly with ${primary}. Head over to the Contribute tab if you want to get involved.`,visual_type:"closing",highlight_files:[],key_points:[`Score: ${ai?.health_score||50}/100`,"Ready to explore","Check contributor guide"]}
  ];
}

/* ═══ LANDING ═══ */
function Landing({onSearch,loading,onCompare}){
  const[input,setInput]=useState("");const ref=useRef(null);
  useEffect(()=>{ref.current?.focus()},[]);
  const go=()=>{const v=input.trim();if(!v)return;if(v.includes("/")){const[o,r]=v.split("/");onSearch(o,r)}else onSearch(v,null)};
  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",zIndex:1}}>
      <div style={{textAlign:"center",maxWidth:900,width:"100%"}}>
        <div className="gi" style={{display:"inline-flex",alignItems:"center",gap:10,padding:"10px 28px",background:C.srf,border:`1px solid ${C.bdr}`,borderRadius:50,marginBottom:32,backdropFilter:"blur(10px)"}}><span style={{fontSize:22}}>🔬</span><span style={{fontSize:18,fontWeight:800,letterSpacing:".08em"}}>Git<span style={{color:C.acc,textShadow:`0 0 10px ${C.accG}`}}>Scope</span></span></div>

        <h1 className="gi" style={{animationDelay:"100ms",fontSize:"clamp(48px,7vw,80px)",fontWeight:900,lineHeight:1.05,marginBottom:28,letterSpacing:"-.03em"}}>
          Talk to any codebase.<br/>
          <span className="wave-text">Understand it in seconds.</span>
        </h1>

        <p className="gi" style={{animationDelay:"200ms",fontSize:20,color:C.dim,marginBottom:52,lineHeight:1.6,maxWidth:640,margin:"0 auto 52px"}}>
          Paste any GitHub repo. GitScope scans the code, maps out the structure, and uses AI to explain what's going on — so you can jump in with confidence.
        </p>

        {/* MAIN SEARCH - THE HERO */}
        <div className="gi" style={{animationDelay:"300ms",maxWidth:660,margin:"0 auto"}}>
          <div style={{display:"flex",borderRadius:20,overflow:"hidden",border:`2px solid ${C.bdrH}`,background:"rgba(10,17,36,.7)",backdropFilter:"blur(24px)",boxShadow:`0 12px 48px rgba(0,0,0,.5),0 0 0 1px rgba(0,229,255,.1) inset,0 0 60px ${C.accD}`,transition:"box-shadow .3s"}}>
            <div style={{padding:"0 22px",display:"flex",alignItems:"center",color:C.mut,fontSize:16,fontWeight:500}} className="mn">github.com/</div>
            <input ref={ref} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="owner/repo" disabled={loading} style={{flex:1,padding:"26px 0",background:"transparent",border:"none",outline:"none",color:C.txt,fontSize:20,fontFamily:"'JetBrains Mono'"}}/>
            <button onClick={go} disabled={loading||!input.trim()} className="gb" style={{padding:"0 44px",background:loading?C.mut:C.acc,border:"none",color:C.bg,fontWeight:800,fontSize:16,letterSpacing:".04em",boxShadow:loading?"none":`0 0 30px ${C.accG}`}}>
              {loading?"SCANNING...":"ANALYZE →"}
            </button>
          </div>
        </div>

        <div className="gi mn" style={{animationDelay:"400ms",marginTop:20,fontSize:13,color:C.mut}}>
          Try:{" "}{["umbchackers/hackumbc-web","pallets/flask","expressjs/express"].map(r=><span key={r} className="gb" onClick={()=>setInput(r)} style={{color:C.acc,marginLeft:14,cursor:"pointer"}}>{r}</span>)}
        </div>

        <div className="gi" style={{animationDelay:"500ms",marginTop:40}}>
          <button onClick={onCompare} className="gb" style={{background:"transparent",border:`1.5px solid ${C.bdr}`,borderRadius:12,padding:"14px 32px",color:C.dim,fontSize:15,fontWeight:600,display:"inline-flex",alignItems:"center",gap:10}}>
            ⚔️ Compare Two Repos Head-to-Head
          </button>
        </div>

        <div className="gi mn" style={{animationDelay:"600ms",marginTop:48,display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap"}}>
          {["Clone","Parse","Scan","Check","AI Analyze","Report"].map((s,i)=><div key={s} style={{display:"flex",alignItems:"center",gap:8}}><div style={{fontSize:11,padding:"5px 14px",borderRadius:6,border:`1px solid ${C.bdr}`,color:C.mut,fontWeight:500}}>{s}</div>{i<5&&<span style={{color:C.mut,fontSize:11}}>→</span>}</div>)}
        </div>
      </div>
    </div>
  );
}

/* ═══ SCANNING ═══ */
function Scanning({repoName,onComplete,dataReady}){
  const[step,setStep]=useState(0);const[animDone,setAnimDone]=useState(false);
  const stepRef=useRef(0);
  useEffect(()=>{
    let t;const run=i=>{
      if(i>=PL.length){setAnimDone(true);return}
      setStep(i);stepRef.current=i;
      // If data already arrived and we're past halfway, speed through remaining
      const speed=(dataReady&&i>4)?100:PL[i].ms;
      t=setTimeout(()=>run(i+1),speed);
    };run(0);return()=>clearTimeout(t);
  },[]);
  // If data arrives while we're past step 6, just finish immediately
  useEffect(()=>{if(dataReady&&stepRef.current>=7&&!animDone){setStep(PL.length);setAnimDone(true)}},[dataReady]);
  useEffect(()=>{if(animDone&&dataReady){setTimeout(onComplete,300)}},[animDone,dataReady]);
  const pct=animDone?100:Math.max(5,(step/PL.length)*100);
  return<div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",zIndex:1}}>
    <div style={{position:"absolute",left:0,right:0,height:1,background:`linear-gradient(90deg,transparent 10%,${C.acc} 50%,transparent 90%)`,animation:"gscan 1.8s linear infinite",opacity:.5,boxShadow:`0 0 20px ${C.acc}`}}/>
    <div style={{maxWidth:600,width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:44}}><div style={{display:"inline-block",width:64,height:64,borderRadius:"50%",border:`2px solid ${C.acc}`,borderTopColor:"transparent",animation:"gsp 1s linear infinite",marginBottom:24}}/><h2 className="mn" style={{fontSize:28,fontWeight:800,color:C.acc,textShadow:`0 0 20px ${C.accG}`}}>{repoName}</h2><div className="mn" style={{fontSize:13,color:C.dim,marginTop:12,letterSpacing:".2em"}}>{animDone&&!dataReady?"WAITING FOR AI ANALYSIS":"ANALYZING REPOSITORY"}</div></div>
      <div style={{height:4,background:"rgba(255,255,255,.05)",borderRadius:2,marginBottom:40,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:animDone?`linear-gradient(90deg,${C.acc},${C.prp})`:C.acc,transition:"width .4s ease",boxShadow:`0 0 20px ${C.acc}`,animation:animDone&&!dataReady?"shimmer 1.5s linear infinite":"none",backgroundSize:"200% 100%"}}/></div>
      <div className="gc" style={{padding:28}}>
        {PL.map((s,i)=>{const done=i<step,act=i===step&&!animDone;return<div key={i} style={{display:"flex",alignItems:"center",gap:16,padding:"13px",opacity:done||animDone?.5:act?1:.2,transform:act?"scale(1.02)":"scale(1)",transition:"all .3s",background:act?C.srfH:"transparent",borderRadius:10}}><span style={{fontSize:20}}>{done||animDone?"✓":s.icon}</span><span className="mn" style={{fontSize:15,color:act?C.acc:C.txt,fontWeight:act?700:400}}>{s.label}</span>{act&&<span className="mn" style={{marginLeft:"auto",color:C.acc,animation:"blink 1s infinite",fontSize:16}}>_</span>}</div>})}
        {animDone&&!dataReady&&<div style={{display:"flex",alignItems:"center",gap:16,padding:"13px",background:C.srfH,borderRadius:10,marginTop:4}}><span style={{fontSize:20}}>🧠</span><span className="mn" style={{fontSize:15,color:C.prp,fontWeight:700}}>AI is reading through the code...</span><span className="mn" style={{marginLeft:"auto",color:C.prp,animation:"blink 1s infinite",fontSize:16}}>_</span></div>}
      </div>
    </div>
  </div>;
}

/* ═══ DASHBOARD ═══ */
function Dash({analysis,onBack}){
  const[tab,setTab]=useState("chat");const[msgs,setMsgs]=useState([]);const[ci,setCi]=useState("");const[cl,setCl]=useState(false);const[cv,setCv]=useState(null);const ce=useRef(null);
  const{local,ai}=analysis;const[owner,repo]=(analysis.repo||"x/x").split("/");
  useEffect(()=>{ce.current?.scrollIntoView({behavior:"smooth"})},[msgs]);
  const ask=async q=>{const question=q||ci.trim();if(!question)return;setCi("");setMsgs(p=>[...p,{role:"user",content:question}]);setCl(true);try{const r=await fetch(`${API}/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({owner,repo,question})});let d=await r.json();
    // Fix: if answer is a raw JSON string, parse it out
    if(typeof d.answer==="string"&&d.answer.trim().startsWith("{")){try{const p=JSON.parse(d.answer);if(p.answer){d={...d,...p}}}catch{}}
    // Fix: if the whole response is a stringified JSON blob with no answer key parsed
    if(!d.answer&&typeof d==="object"){const k=Object.keys(d);if(k.includes("answer"))d.answer=d.answer||""}
    setMsgs(p=>[...p,{role:"ai",...d}])}catch{await new Promise(r=>setTimeout(r,1000));setMsgs(p=>[...p,{role:"ai",...MOCK_CHAT}])}setCl(false)};
  const openF=async(path,lines)=>{try{const r=await fetch(`${API}/file?owner=${owner}&repo=${repo}&path=${path}`);const d=await r.json();let hl=null;if(lines){const p=lines.split("-");hl=[parseInt(p[0]),parseInt(p[1]||p[0])]}setCv({filePath:path,content:d.content,highlightLines:hl})}catch{setCv({filePath:path,content:`// Could not fetch ${path}`,highlightLines:null})}};
  const tabs=[{id:"chat",label:"Ask Anything",icon:"💬",primary:true},{id:"walkthrough",label:"Walkthrough",icon:"🎙",primary:true},{id:"architecture",label:"Architecture",icon:"⬡",primary:true},{id:"contribute",label:"Contribute",icon:"🚀",primary:true},{id:"_div",label:"",icon:""},{id:"overview",label:"Overview",icon:"⊚"},{id:"security",label:"Security",icon:"🛡"},{id:"quality",label:"Quality",icon:"✦"},{id:"roast",label:"Roast",icon:"🔥"}];

  return<div style={{minHeight:"100vh",paddingBottom:100,position:"relative",zIndex:1}}>
    {cv&&<CodeV {...cv} onClose={()=>setCv(null)}/>}
    {/* HEADER */}
    <div style={{background:"rgba(4,8,20,.85)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${C.bdr}`,padding:"18px 40px",position:"sticky",top:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:24}}><button onClick={onBack} className="gb mn" style={{background:"transparent",border:`1px solid ${C.mut}`,color:C.txt,padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:600}}>← BACK</button><div style={{fontSize:22,fontWeight:800,letterSpacing:".04em"}}>🔬 Git<span style={{color:C.acc}}>Scope</span></div><div style={{width:1,height:24,background:C.bdr}}/><div className="mn" style={{fontSize:17,fontWeight:600}}>{analysis.repo}</div></div>
      <div className="mn" style={{fontSize:13,color:C.acc,background:C.accD,padding:"8px 20px",borderRadius:24,border:`1px solid ${C.bdr}`,fontWeight:600}}>{analysis.files_analyzed} FILES ANALYZED</div>
    </div>
    {/* TABS */}
    <div style={{display:"flex",justifyContent:"center",padding:"36px 0"}}>
      <div style={{display:"flex",background:C.srf,padding:6,borderRadius:14,border:`1px solid ${C.bdr}`,backdropFilter:"blur(10px)",gap:2,flexWrap:"wrap",justifyContent:"center"}}>
        {tabs.map(t=>{
          if(t.id==="_div")return<div key="_div" style={{width:1,background:C.bdr,margin:"6px 4px",alignSelf:"stretch"}}/>;
          const isPrimary=t.primary;
          return<button key={t.id} onClick={()=>setTab(t.id)} className="gb" style={{background:tab===t.id?(isPrimary?C.accD:C.accD):"transparent",border:"none",padding:isPrimary?"13px 28px":"13px 20px",borderRadius:10,color:tab===t.id?C.acc:isPrimary?C.txt:C.dim,fontSize:isPrimary?15:14,fontWeight:tab===t.id?800:isPrimary?700:600,display:"flex",alignItems:"center",gap:8,transition:"all .2s"}}><span>{t.icon}</span>{t.label}</button>
        })}
      </div>
    </div>
    <div style={{maxWidth:1200,margin:"0 auto",padding:"0 40px"}}>

      {/* OVERVIEW */}
      {tab==="overview"&&<div className="gi">
        <div style={{display:"flex",gap:28,marginBottom:40}}>
          <div className="gc" style={{flex:2,padding:36}}><h3 className="mn" style={{fontSize:14,color:C.acc,letterSpacing:".1em",marginBottom:18}}>WHAT THIS PROJECT DOES</h3><p style={{fontSize:19,lineHeight:1.7,marginBottom:28}}>{ai?.summary}</p><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{ai?.stack?.map(s=><span key={s} className="mn" style={{background:C.bg2,border:`1px solid ${C.bdr}`,padding:"7px 14px",borderRadius:8,fontSize:13,fontWeight:500}}>{s}</span>)}</div></div>
          <div className="gc" style={{flex:1,padding:36,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:`linear-gradient(135deg,${C.srf} 0%,${C.accD} 100%)`}}><Ring score={ai?.health_score||0} delay={400}/><div className="mn" style={{fontSize:13,color:C.txt,marginTop:14,letterSpacing:".1em",fontWeight:600}}>HEALTH SCORE</div></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:20,marginBottom:32}}><Stat icon="📂" value={local.tree.file_count} label="Files" delay={100}/><Stat icon="📝" value={local.quality.code_lines} label="Lines of Code" delay={200}/><Stat icon="🔐" value={local.secrets.length} label="Secrets" color={local.secrets.length>0?C.red:C.acc} delay={300}/><Stat icon="📦" value={Object.values(local.dependencies).reduce((a,d)=>a+d.count,0)} label="Deps" delay={400}/><Stat icon="💬" value={`${local.quality.comment_ratio}%`} label="Comments" delay={500}/></div>
        <div style={{display:"flex",gap:12,marginBottom:32,flexWrap:"wrap"}}><Badge grade={ai?.security?.grade} label="Security"/><Badge grade={ai?.quality?.grade} label="Quality"/></div>
        <div className="gc" style={{padding:28,marginBottom:20}}><h4 style={{fontSize:15,fontWeight:800,marginBottom:16}}>Language Breakdown</h4><LBar languages={local.tree.languages}/></div>
        <div className="gc" style={{padding:28}}><h4 style={{fontSize:15,fontWeight:800,marginBottom:16}}>Top Files by Importance</h4>{local.ranked_files.slice(0,10).map((f,i)=><div key={f.path} onClick={()=>openF(f.path)} className="gf" style={{display:"flex",alignItems:"center",gap:14,padding:"10px 12px",borderRadius:8}}><span className="mn" style={{width:28,fontSize:13,color:C.mut,textAlign:"right"}}>#{i+1}</span><span className="mn" style={{flex:1,fontSize:13,color:C.acc,fontWeight:600}}>{f.path}</span><span className="mn" style={{fontSize:11,color:C.dim,padding:"3px 10px",background:C.bg2,borderRadius:6}}>{f.language}</span><span className="mn" style={{fontSize:11,color:C.mut,width:40,textAlign:"right"}}>{f.score}</span></div>)}</div>
      </div>}

      {/* ARCHITECTURE */}
      {tab==="architecture"&&<div className="gi">
        <div className="gc" style={{padding:32,marginBottom:24}}><div className="mn" style={{fontSize:12,color:C.dim,letterSpacing:".1em",marginBottom:6}}>ARCHITECTURE PATTERN</div><div style={{fontSize:26,fontWeight:800}}>{ai?.architecture?.pattern}</div></div>
        <div className="gc" style={{padding:32,marginBottom:24,display:"flex",justifyContent:"center"}}><ArchDiagram modules={ai?.architecture?.key_modules} onFileClick={path=>openF(path)}/></div>
        <div className="gc" style={{padding:32,marginBottom:24}}><h4 style={{fontSize:15,fontWeight:800,marginBottom:18}}>Key Modules</h4>{ai?.architecture?.key_modules?.map((m,i)=><div key={i} style={{padding:"14px 0",borderBottom:i<ai.architecture.key_modules.length-1?`1px solid ${C.bdr}`:"none"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontWeight:700,fontSize:16}}>{m.name}</span><span className="mn gf" onClick={()=>openF(m.path)} style={{fontSize:13,color:C.acc}}>{m.path}</span></div><div style={{fontSize:14,color:C.dim,marginTop:6}}>{m.purpose}</div></div>)}</div>
        <div className="gc" style={{padding:32}}><h4 style={{fontSize:15,fontWeight:800,marginBottom:12}}>Data Flow</h4><p style={{fontSize:15,color:C.dim,lineHeight:1.7}}>{ai?.architecture?.data_flow}</p></div>
      </div>}

      {/* WALKTHROUGH */}
      {tab==="walkthrough"&&<Walkthrough analysis={analysis} onFileClick={path=>openF(path)}/>}

      {/* SECURITY */}
      {tab==="security"&&<div className="gi">
        <Badge grade={ai?.security?.grade} label="Security Grade"/>
        {ai?.security?.confirmed_issues?.map((iss,i)=><div key={i} className="gc" style={{padding:28,marginTop:20,borderLeft:`4px solid ${C.red}`}}><div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}><span style={{fontSize:11,fontWeight:800,padding:"4px 12px",borderRadius:6,background:`${C.red}20`,color:C.red,textTransform:"uppercase",letterSpacing:".06em"}}>{iss.severity}</span><span style={{fontSize:16,fontWeight:700}}>{iss.description}</span></div><div className="mn gf" onClick={()=>openF(iss.file)} style={{fontSize:13,color:C.acc,marginBottom:8}}>📄 {iss.file}:{iss.line}</div><div style={{fontSize:14,color:C.dim}}><strong style={{color:C.acc}}>Fix:</strong> {iss.fix}</div></div>)}
        {ai?.security?.positive_practices?.map((p,i)=><div key={i} style={{fontSize:15,color:C.dim,padding:"10px 0",display:"flex",gap:12,marginTop:i===0?20:0}}><span style={{color:C.acc,fontSize:16}}>✓</span>{p}</div>)}
      </div>}

      {/* QUALITY */}
      {tab==="quality"&&<div className="gi">
        <Badge grade={ai?.quality?.grade} label="Quality Grade"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginTop:28}}>
          <div className="gc" style={{padding:28}}><h4 style={{fontSize:15,fontWeight:800,color:C.acc,marginBottom:16}}>Strengths</h4>{ai?.quality?.strengths?.map((s,i)=><div key={i} style={{fontSize:14,color:C.dim,padding:"6px 0",display:"flex",gap:10}}><span style={{color:C.acc}}>+</span>{s}</div>)}</div>
          <div className="gc" style={{padding:28}}><h4 style={{fontSize:15,fontWeight:800,color:C.amb,marginBottom:16}}>Improvements</h4>{ai?.quality?.improvements?.map((s,i)=><div key={i} style={{fontSize:14,color:C.dim,padding:"6px 0",display:"flex",gap:10}}><span style={{color:C.amb}}>→</span>{s}</div>)}</div>
        </div>
        {ai?.quality?.tech_debt?.length>0&&<div className="gc" style={{padding:28,marginTop:20}}><h4 style={{fontSize:15,fontWeight:800,color:C.red,marginBottom:16}}>Tech Debt</h4>{ai.quality.tech_debt.map((d,i)=><div key={i} style={{fontSize:14,color:C.dim,padding:"6px 0"}}>• {d}</div>)}</div>}
        {local.quality.long_files?.length>0&&<div className="gc" style={{padding:28,marginTop:20}}><h4 style={{fontSize:15,fontWeight:800,marginBottom:16}}>Long Files (300+ lines)</h4>{local.quality.long_files.map((f,i)=><div key={i} className="mn gf" onClick={()=>openF(f.path)} style={{fontSize:14,color:C.acc,padding:"6px 0"}}>{f.path} — {f.lines} lines</div>)}</div>}
      </div>}

      {/* ROAST */}
      {tab==="roast"&&<div className="gi" style={{display:"flex",flexDirection:"column",gap:28}}>
        <div className="gc" style={{padding:44,border:`1px solid ${C.red}`,background:`linear-gradient(180deg,rgba(255,51,102,.06) 0%,${C.srf} 100%)`,boxShadow:`0 0 60px ${C.redD}`}}>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:28}}><span style={{fontSize:40}}>🔥</span><h3 className="mn" style={{fontSize:24,fontWeight:800,color:C.red,letterSpacing:".08em"}}>BRUTAL AI ROAST</h3></div>
          <p className="mn" style={{fontSize:18,lineHeight:1.8,color:C.txt}}>"{ai?.roast?.brutal_take || `This codebase has ${local.tree.file_count} files and ${local.secrets.length} exposed secret${local.secrets.length!==1?"s":""}. Your comment ratio is ${local.quality.comment_ratio}% — future you will have no idea what past you was thinking. The architecture is ${ai?.architecture?.pattern || "unclear"}, which is a polite way of saying it grew organically like mold on bread.`}"</p>
        </div>
        <div className="gc" style={{padding:44,border:`1px solid ${C.acc}`}}>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:28}}><span style={{fontSize:40}}>✨</span><h3 className="mn" style={{fontSize:24,fontWeight:800,color:C.acc,letterSpacing:".08em"}}>THE GLOW UP PLAN</h3></div>
          <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:18}}>
            {(ai?.roast?.glow_up || ai?.quality?.improvements || ["Add proper environment variable management","Increase comment ratio above 15%","Add comprehensive test coverage"]).map((step,i)=><li key={i} style={{display:"flex",gap:18,alignItems:"flex-start",fontSize:17,color:C.dim}}><span style={{color:C.bg,background:C.acc,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",fontWeight:800,fontSize:14,flexShrink:0}}>{i+1}</span>{step}</li>)}
          </ul>
        </div>
      </div>}

      {/* CONTRIBUTE */}
      {tab==="contribute"&&<div className="gi">
        {/* Welcoming hero for first-time contributors */}
        <div className="gc" style={{padding:"40px 36px",marginBottom:28,background:`linear-gradient(135deg,${C.srf} 0%,${C.accD} 100%)`,borderColor:`${C.acc}30`,textAlign:"center"}}>
          <div style={{fontSize:42,marginBottom:16}}>👋</div>
          <h3 style={{fontSize:24,fontWeight:800,marginBottom:10}}>Want to contribute but <span style={{color:C.acc}}>not sure where to start?</span></h3>
          <p style={{fontSize:16,color:C.dim,maxWidth:520,margin:"0 auto",lineHeight:1.7}}>No worries — we broke it down for you. Here are some beginner-friendly ways to jump in, even if this is your first open-source contribution.</p>
        </div>

        <div className="gc" style={{padding:36,marginBottom:24}}><h4 style={{fontSize:16,fontWeight:800,color:C.acc,marginBottom:8}}>🛠 Set Up Locally</h4><p style={{fontSize:14,color:C.dim,marginBottom:18}}>Get the project running on your machine in a few steps:</p>{ai?.contribute?.setup_steps?.map((s,i)=><div key={i} style={{display:"flex",gap:16,padding:"12px 0",alignItems:"flex-start"}}><span style={{width:30,height:30,borderRadius:"50%",background:C.accD,color:C.acc,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,flexShrink:0,border:`1px solid ${C.acc}30`}}>{i+1}</span><pre className="mn" style={{fontSize:14,margin:0,whiteSpace:"pre-wrap"}}>{s}</pre></div>)}</div>
        <div className="gc" style={{padding:36,marginBottom:24}}><h4 style={{fontSize:16,fontWeight:800,marginBottom:8}}>📖 Read These Files First</h4><p style={{fontSize:14,color:C.dim,marginBottom:14}}>Start here to understand how the project works:</p>{ai?.contribute?.good_first_files?.map((f,i)=><div key={i} className="mn gf" onClick={()=>openF(f)} style={{fontSize:14,color:C.acc,padding:"8px 0"}}>→ {f}</div>)}</div>
        <div className="gc" style={{padding:36}}><h4 style={{fontSize:16,fontWeight:800,marginBottom:8}}>💡 Beginner-Friendly Ideas</h4><p style={{fontSize:14,color:C.dim,marginBottom:14}}>These are things you could work on right now — no deep codebase knowledge needed:</p>{ai?.contribute?.improvement_areas?.map((a,i)=><div key={i} style={{fontSize:15,color:C.dim,padding:"8px 0",display:"flex",gap:10,alignItems:"flex-start"}}><span style={{color:C.bg,background:C.acc,width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",fontWeight:800,fontSize:12,flexShrink:0}}>{i+1}</span>{a}</div>)}</div>
      </div>}

      {/* CHAT - ASK ANYTHING */}
      {tab==="chat"&&<div className="gi" style={{display:"flex",flexDirection:"column",minHeight:"65vh"}}>
        {msgs.length===0&&<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
          <div style={{fontSize:56,marginBottom:8,animation:"float 3s ease infinite"}}>💬</div>
          <h3 style={{fontSize:28,fontWeight:800}}>Ask <span style={{color:C.acc}}>Anything</span></h3>
          <p style={{fontSize:16,color:C.dim,marginBottom:24}}>The whole codebase is loaded. Ask a question and get answers with real file references.</p>
          <div style={{display:"flex",flexDirection:"column",gap:8,width:"100%",maxWidth:540}}>
            {[
              `What does ${(ai?.architecture?.key_modules?.[0]?.name)||"the main module"} do?`,
              ai?.security?.confirmed_issues?.length>0?"What are the main security concerns?":"How is the code structured?",
              `How would I add a new feature to this ${ai?.architecture?.pattern||"project"}?`,
              `What's the most complex part of this codebase?`
            ].map((q,i)=><button key={q} onClick={()=>ask(q)} className="gc gb" style={{padding:"16px 22px",textAlign:"left",color:C.dim,fontSize:15,fontWeight:500}}>→ {q}</button>)}
          </div>
        </div>}
        {msgs.length>0&&<div style={{flex:1,display:"flex",flexDirection:"column",gap:16,marginBottom:20}}>
          {msgs.map((m,i)=><div key={i} style={{padding:22,borderRadius:16,background:m.role==="user"?C.accD:C.srf,border:`1px solid ${C.bdr}`,alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"85%"}}>
            <div className="mn" style={{fontSize:11,fontWeight:700,color:m.role==="user"?C.blu:C.acc,marginBottom:10,letterSpacing:".1em"}}>{m.role==="user"?"YOU":"GITSCOPE AI"}</div>
            {m.role==="user"?<div style={{fontSize:16,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{m.content}</div>:<ChatText text={m.answer}/>}
            {m.sources?.length>0&&<div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${C.bdr}`}}><div className="mn" style={{fontSize:10,color:C.mut,marginBottom:8,letterSpacing:".08em"}}>SOURCES</div>{m.sources.map((s,j)=><div key={j} onClick={()=>openF(s.file,s.lines)} className="gf mn" style={{fontSize:12,color:C.acc,padding:"5px 0"}}>📄 {s.file} L{s.lines} — {s.relevance}</div>)}</div>}
            {m.follow_ups?.length>0&&<div style={{marginTop:14,display:"flex",gap:8,flexWrap:"wrap"}}>{m.follow_ups.map((fq,j)=><button key={j} onClick={()=>ask(fq)} className="gb" style={{background:C.bg2,border:`1px solid ${C.bdr}`,borderRadius:8,padding:"8px 16px",fontSize:12,color:C.dim,cursor:"pointer"}}>{fq}</button>)}</div>}
          </div>)}
          {cl&&<div style={{padding:22,borderRadius:16,background:C.srf,border:`1px solid ${C.bdr}`,alignSelf:"flex-start"}}><div className="mn" style={{fontSize:11,fontWeight:700,color:C.acc,marginBottom:10,letterSpacing:".1em"}}>GITSCOPE AI</div><div style={{display:"flex",gap:5}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:C.acc,animation:`gp 1s infinite ${i*.2}s`}}/>)}</div></div>}
          <div ref={ce}/>
        </div>}
        <div style={{display:"flex",borderRadius:16,overflow:"hidden",border:`2px solid ${C.bdr}`,background:"rgba(10,17,36,.8)",backdropFilter:"blur(16px)",marginTop:"auto",boxShadow:`0 0 30px ${C.accD}`}}>
          <input value={ci} onChange={e=>setCi(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} placeholder="Ask anything about this codebase..." disabled={cl} style={{flex:1,padding:"20px 24px",background:"transparent",border:"none",outline:"none",color:C.txt,fontSize:17}}/>
          <button onClick={()=>ask()} disabled={cl||!ci.trim()} className="gb" style={{padding:"0 36px",background:cl?C.mut:C.acc,border:"none",color:C.bg,fontWeight:800,fontSize:15,letterSpacing:".04em"}}>SEND →</button>
        </div>
      </div>}
    </div>
  </div>;
}

/* ═══ COMPARE ═══ */
function CmpIn({onStart,onBack}){
  const[a,setA]=useState("");const[b,setB]=useState("");
  return<div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",zIndex:1}}>
    <div style={{textAlign:"center",maxWidth:700,width:"100%"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",marginBottom:28,fontSize:14}}>← Back</button>
      <div className="gi" style={{fontSize:52,marginBottom:12}}>⚔️</div>
      <h1 className="gi" style={{animationDelay:"80ms",fontSize:42,fontWeight:900,marginBottom:10,letterSpacing:"-.02em"}}><span style={{color:C.acc}}>Repo</span> vs <span style={{color:C.red}}>Repo</span></h1>
      <p className="gi" style={{animationDelay:"150ms",fontSize:16,color:C.dim,marginBottom:40}}>Head-to-head. Which codebase is healthier?</p>
      <div className="gi" style={{animationDelay:"200ms",display:"flex",gap:20,alignItems:"center",justifyContent:"center",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:220}}><div className="mn" style={{fontSize:11,fontWeight:700,color:C.acc,marginBottom:8,letterSpacing:".15em"}}>REPO A</div><input value={a} onChange={e=>setA(e.target.value)} onKeyDown={e=>e.key==="Enter"&&a&&b&&onStart(a,b)} placeholder="owner/repo" style={{width:"100%",padding:"18px",background:C.srf,border:`2px solid ${C.acc}30`,borderRadius:14,color:C.txt,fontSize:16,fontFamily:"'JetBrains Mono'"}}/></div>
        <div style={{fontSize:26,fontWeight:900,color:C.mut,paddingTop:24}}>VS</div>
        <div style={{flex:1,minWidth:220}}><div className="mn" style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:8,letterSpacing:".15em"}}>REPO B</div><input value={b} onChange={e=>setB(e.target.value)} onKeyDown={e=>e.key==="Enter"&&a&&b&&onStart(a,b)} placeholder="owner/repo" style={{width:"100%",padding:"18px",background:C.srf,border:`2px solid ${C.red}30`,borderRadius:14,color:C.txt,fontSize:16,fontFamily:"'JetBrains Mono'"}}/></div>
      </div>
      <button onClick={()=>a&&b&&onStart(a,b)} disabled={!a||!b} className="gb gi" style={{animationDelay:"300ms",marginTop:28,padding:"18px 52px",background:!a||!b?C.mut:`linear-gradient(135deg,${C.acc},${C.blu})`,border:"none",borderRadius:14,color:C.bg,fontWeight:800,fontSize:16,letterSpacing:".03em"}}>⚔️ BATTLE →</button>
      <div className="gi" style={{animationDelay:"400ms",marginTop:32,display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>{[["pallets/flask","expressjs/express"],["facebook/react","vuejs/core"]].map(([x,y])=><button key={x} onClick={()=>{setA(x);setB(y)}} className="gb mn" style={{background:C.bg2,border:`1px solid ${C.bdr}`,borderRadius:8,padding:"8px 16px",fontSize:12,color:C.dim,cursor:"pointer"}}>{x.split("/")[1]} vs {y.split("/")[1]}</button>)}</div>
    </div>
  </div>;
}

function CmpLoad({rA,rB,pA,pB}){
  return<div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",zIndex:1}}>
    <div style={{position:"absolute",left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${C.acc},${C.red},transparent)`,animation:"gscan 1.5s linear infinite",opacity:.6,boxShadow:`0 0 20px ${C.acc}`}}/>
    <div className="mn" style={{fontSize:13,color:C.dim,letterSpacing:".2em",marginBottom:20}}>⚔️ ANALYZING BOTH</div>
    <div style={{display:"flex",gap:52,alignItems:"center"}}>
      {[{n:rA,p:pA,c:C.acc},{n:rB,p:pB,c:C.red}].map((r,i)=><div key={i} style={{textAlign:"center"}}><div className="mn" style={{fontSize:16,fontWeight:700,color:r.c,marginBottom:14}}>{r.n}</div><div style={{width:120,height:120,borderRadius:"50%",border:`2px solid ${r.c}`,display:"flex",alignItems:"center",justifyContent:"center",animation:"glow 2s infinite"}}>{r.p==="done"?<span style={{fontSize:36,color:r.c}}>✓</span>:<div style={{width:22,height:22,border:`2px solid ${r.c}`,borderTopColor:"transparent",borderRadius:"50%",animation:"gsp .7s linear infinite"}}/>}</div><div className="mn" style={{fontSize:12,color:r.p==="done"?r.c:C.dim,marginTop:12}}>{r.p==="done"?"Complete":"Analyzing..."}</div></div>)}
    </div>
  </div>;
}

function Cmp({dA,dB,onBack}){
  const aA=dA.ai||{},aB=dB.ai||{},sA=aA.health_score||0,sB=aB.health_score||0;
  const w=sA>sB?"A":sB>sA?"B":"TIE";const[sh,setSh]=useState(false);useEffect(()=>{setTimeout(()=>setSh(true),600)},[]);
  function Row({label,vA,vB,hw=true,ig=false}){let wn=null;if(ig){const gv=g=>({"A+":12,A:11,"A-":10,"B+":9,B:8,"B-":7,"C+":6,C:5,"C-":4,"D+":3,D:2,"D-":1,F:0}[g]||0);wn=gv(vA)>gv(vB)?"A":gv(vB)>gv(vA)?"B":null}else{const nA=typeof vA==="number"?vA:parseFloat(String(vA).replace(/[^\d.]/g,""))||0,nB=typeof vB==="number"?vB:parseFloat(String(vB).replace(/[^\d.]/g,""))||0;wn=hw?(nA>nB?"A":nB>nA?"B":null):(nA<nB?"A":nB<nA?"B":null)}return<div style={{display:"flex",alignItems:"center",padding:"15px 0",borderBottom:`1px solid ${C.bdr}`,transition:"background .2s"}}><div style={{flex:1,textAlign:"right",paddingRight:20}}><span style={{fontSize:20,fontWeight:800,color:wn==="A"?C.acc:C.txt}}>{String(vA)}</span>{wn==="A"&&<span className="mn" style={{marginLeft:10,fontSize:11,color:C.acc,fontWeight:700}}>◀ WIN</span>}</div><div style={{width:160,textAlign:"center",flexShrink:0}}><span className="mn" style={{fontSize:11,fontWeight:700,color:C.dim,letterSpacing:".1em"}}>{label}</span></div><div style={{flex:1,textAlign:"left",paddingLeft:20}}>{wn==="B"&&<span className="mn" style={{marginRight:10,fontSize:11,color:C.red,fontWeight:700}}>WIN ▶</span>}<span style={{fontSize:20,fontWeight:800,color:wn==="B"?C.red:C.txt}}>{String(vB)}</span></div></div>}
  return<div style={{minHeight:"100vh",position:"relative",zIndex:1}}>
    <div style={{background:"rgba(4,8,20,.85)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${C.bdr}`,padding:"18px 40px",display:"flex",alignItems:"center",gap:24}}><button onClick={onBack} style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:14}}>← Back</button><div style={{width:1,height:24,background:C.bdr}}/><span style={{fontSize:22,fontWeight:800}}>🔬 Git<span style={{color:C.acc}}>Scope</span></span><span style={{fontSize:15,color:C.dim}}>⚔️ Head-to-Head</span></div>
    <div style={{maxWidth:960,margin:"0 auto",padding:"40px 24px"}}>
      <div className="gi" style={{textAlign:"center",marginBottom:44}}><div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:48,marginBottom:16}}>
        <div><div className="mn" style={{fontSize:15,color:C.acc,marginBottom:12,fontWeight:700}}>{dA.repo}</div><Ring score={sh?sA:0} size={170} delay={200} color={C.acc}/></div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}><div style={{fontSize:38,fontWeight:900,color:C.mut}}>VS</div>{sh&&<div style={{padding:"8px 26px",borderRadius:10,fontSize:15,fontWeight:800,letterSpacing:".06em",background:w==="A"?C.accD:w==="B"?C.redD:C.bg2,color:w==="A"?C.acc:w==="B"?C.red:C.dim,border:`1px solid ${w==="A"?C.acc:w==="B"?C.red:C.bdr}40`,animation:"gu .5s ease"}}>{w==="TIE"?"DRAW":`${(w==="A"?dA:dB).repo.split("/")[1]} WINS`}</div>}</div>
        <div><div className="mn" style={{fontSize:15,color:C.red,marginBottom:12,fontWeight:700}}>{dB.repo}</div><Ring score={sh?sB:0} size={170} delay={400} color={C.red}/></div>
      </div></div>
      <div className="gc gi" style={{animationDelay:"400ms",padding:"10px 32px",marginBottom:28}}>
        <div style={{display:"flex",padding:"16px 0",borderBottom:`2px solid ${C.bdr}`}}><div style={{flex:1,textAlign:"right",paddingRight:20}}><span className="mn" style={{fontSize:14,fontWeight:700,color:C.acc}}>{dA.repo}</span></div><div style={{width:160,textAlign:"center"}}><span className="mn" style={{fontSize:11,fontWeight:800,color:C.mut,letterSpacing:".15em"}}>METRIC</span></div><div style={{flex:1,textAlign:"left",paddingLeft:20}}><span className="mn" style={{fontSize:14,fontWeight:700,color:C.red}}>{dB.repo}</span></div></div>
        <Row label="HEALTH" vA={sA} vB={sB}/><Row label="SECURITY" vA={aA.security?.grade||"?"} vB={aB.security?.grade||"?"} ig/><Row label="QUALITY" vA={aA.quality?.grade||"?"} vB={aB.quality?.grade||"?"} ig/><Row label="FILES" vA={dA.local?.tree?.file_count||0} vB={dB.local?.tree?.file_count||0}/><Row label="LOC" vA={(dA.local?.quality?.code_lines||0).toLocaleString()} vB={(dB.local?.quality?.code_lines||0).toLocaleString()}/><Row label="SECRETS" vA={dA.local?.secrets?.length||0} vB={dB.local?.secrets?.length||0} hw={false}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>{[{d:dA,a:aA,c:C.acc},{d:dB,a:aB,c:C.red}].map(({d,a,c})=><div key={d.repo} className="gc" style={{padding:28}}><div className="mn" style={{fontSize:11,fontWeight:700,color:c,marginBottom:8,letterSpacing:".12em"}}>ARCHITECTURE</div><div style={{fontSize:17,fontWeight:800,marginBottom:12}}>{a.architecture?.pattern||"Unknown"}</div><div style={{fontSize:14,color:C.dim,lineHeight:1.6,marginBottom:16}}>{a.summary||""}</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{(a.stack||[]).map(t=><span key={t} className="mn" style={{fontSize:10,padding:"4px 10px",borderRadius:5,background:`${c}12`,border:`1px solid ${c}25`,color:c}}>{t}</span>)}</div></div>)}</div>
    </div>
  </div>;
}

/* ═══ MAIN ═══ */
export default function GitScope(){
  const[scr,setScr]=useState("landing");const[un,setUn]=useState("");const[rps,setRps]=useState([]);const[sel,setSel]=useState(null);const[ana,setAna]=useState(null);const[ld,setLd]=useState(false);
  const[cA,setCA]=useState(null);const[cB,setCB]=useState(null);const[cpA,setCpA]=useState("loading");const[cpB,setCpB]=useState("loading");const[cnA,setCnA]=useState("");const[cnB,setCnB]=useState("");
  const[scanDone,setScanDone]=useState(false);const[dataLoaded,setDataLoaded]=useState(false);const anaRef=useRef(null);

  // Transition to dashboard when BOTH scan animation and API are done
  useEffect(()=>{
    if(scr==="scan"&&scanDone&&dataLoaded&&anaRef.current){setAna(anaRef.current);setScr("dash")}
  },[scr,scanDone,dataLoaded]);

  const doA=async(o,r)=>{try{const res=await fetch(`${API}/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({owner:o,repo:r})});return await res.json()}catch{return{...MOCK_ANA,repo:`${o}/${r}`}}};
  const search=async(u,r)=>{setUn(u);if(r){setSel({full_name:`${u}/${r}`,name:r});setScanDone(false);setDataLoaded(false);anaRef.current=null;setScr("scan");const d=await doA(u,r);anaRef.current=d;setDataLoaded(true);return}setLd(true);try{const res=await fetch(`${API}/user/${u}/repos`);const d=await res.json();if(d.repos?.length>0){setRps(d.repos);setScr("repos")}else{setRps(MOCK_REPOS);setScr("repos")}}catch{setRps(MOCK_REPOS);setScr("repos")}setLd(false)};
  const pick=async rp=>{setSel(rp);const[o,n]=rp.full_name.split("/");setScanDone(false);setDataLoaded(false);anaRef.current=null;setScr("scan");const d=await doA(o,n);anaRef.current=d;setDataLoaded(true)};
  const cmp=async(a,b)=>{setCnA(a);setCnB(b);setCpA("loading");setCpB("loading");setCA(null);setCB(null);setScr("cmpLoad");const[oA,rA]=a.split("/");const[oB,rB]=b.split("/");const pA=doA(oA,rA).then(d=>{setCA(d);setCpA("done");return d});const pB=doA(oB,rB).then(d=>{setCB(d);setCpB("done");return d});await Promise.all([pA,pB]);setTimeout(()=>setScr("cmp"),500)};
  const reset=()=>{setScr("landing");setUn("");setRps([]);setSel(null);setAna(null);setCA(null);setCB(null);setScanDone(false);setDataLoaded(false);anaRef.current=null};

  return<>
    <style>{css}</style>
    <Particles/>
    <CursorGlow/>
    {/* Radial glows */}
    <div style={{position:"fixed",top:"10%",left:"50%",transform:"translateX(-50%)",width:800,height:800,background:`radial-gradient(ellipse,${C.accD} 0%,transparent 55%)`,pointerEvents:"none",zIndex:0,animation:"gp 6s ease infinite"}}/>
    <div style={{position:"relative",zIndex:1}}>
      {scr==="landing"&&<Landing onSearch={search} loading={ld} onCompare={()=>setScr("cmpIn")}/>}
      {scr==="repos"&&<div style={{minHeight:"100vh",padding:"48px 24px",position:"relative",zIndex:1}}><div style={{maxWidth:700,margin:"0 auto"}}><button onClick={reset} className="gb" style={{background:"none",border:"none",color:C.dim,cursor:"pointer",marginBottom:24,fontSize:14,fontWeight:600}}>← Back</button><h2 className="gi" style={{fontSize:28,fontWeight:800,marginBottom:6}}><span style={{color:C.acc}}>@{un}</span></h2><p className="gi" style={{animationDelay:"80ms",color:C.dim,marginBottom:32,fontSize:15}}>Select a repository to analyze</p><div style={{display:"flex",flexDirection:"column",gap:8}}>{rps.map((repo,i)=><button key={repo.name} onClick={()=>pick(repo)} className="gc gb" style={{padding:"18px 24px",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:17,fontWeight:700,marginBottom:4}}>{repo.name}</div><div style={{fontSize:13,color:C.dim}}>{repo.description||"No description"}</div></div><div style={{display:"flex",gap:16,alignItems:"center",flexShrink:0}}>{repo.language&&<span className="mn" style={{fontSize:12,color:C.dim,padding:"4px 10px",background:C.bg2,borderRadius:6}}>{repo.language}</span>}<span style={{fontSize:12,color:C.dim}}>⭐ {repo.stars}</span><span style={{color:C.acc,fontSize:18,fontWeight:700}}>→</span></div></button>)}</div></div></div>}
      {scr==="scan"&&<Scanning repoName={sel?.full_name||"..."} onComplete={()=>{setScanDone(true);if(dataLoaded&&anaRef.current){setAna(anaRef.current);setScr("dash")}}} dataReady={dataLoaded}/>}
      {scr==="dash"&&ana&&<Dash analysis={ana} onBack={reset}/>}
      {scr==="cmpIn"&&<CmpIn onStart={cmp} onBack={reset}/>}
      {scr==="cmpLoad"&&<CmpLoad rA={cnA} rB={cnB} pA={cpA} pB={cpB}/>}
      {scr==="cmp"&&cA&&cB&&<Cmp dA={cA} dB={cB} onBack={reset}/>}
    </div>
  </>;
}
