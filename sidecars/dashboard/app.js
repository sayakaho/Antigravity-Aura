(()=>{var{defineProperty:ot,getOwnPropertyNames:St,getOwnPropertyDescriptor:Mt}=Object,Lt=Object.prototype.hasOwnProperty;function It(t){return this[t]}var Ct=(t)=>{var e=(gt??=new WeakMap).get(t),n;if(e)return e;if(e=ot({},"__esModule",{value:!0}),t&&typeof t==="object"||typeof t==="function"){for(var a of St(t))if(!Lt.call(e,a))ot(e,a,{get:It.bind(t,a),enumerable:!(n=Mt(t,a))||n.enumerable})}return gt.set(t,e),e},gt;var At=(t)=>t;function Rt(t,e){this[t]=At.bind(null,e)}var Bt=(t,e)=>{for(var n in e)ot(t,n,{get:e[n],enumerable:!0,configurable:!0,set:Rt.bind(e,n)})};var ee={};Bt(ee,{loadConfig:()=>$t,loadSystemFonts:()=>Et,populateFontSelect:()=>tt,saveConfig:()=>H,showToast:()=>_,updateSegmentedUI:()=>O,updateStatus:()=>et});var N=null;function ht(t,e,n){let a=(s)=>{let c=s/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};return 0.2126*a(t)+0.7152*a(e)+0.0722*a(n)}function ft(t){if(!t)return null;let e=t.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);if(e)return{r:parseInt(e[1],10),g:parseInt(e[2],10),b:parseInt(e[3],10),alpha:e[4]!==void 0?parseFloat(e[4]):1};return null}function Ht(){if(N==="light"||N==="dark")return N;let t=document.documentElement.style.colorScheme;if(t==="light"||t==="dark")return t;let e=document.createElement("div");e.setAttribute("aria-hidden","true"),e.style.cssText="position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;background-color:var(--background, var(--vscode-editor-background, transparent))",(document.body||document.documentElement).appendChild(e);try{let n=window.getComputedStyle(e).backgroundColor,a=ft(n);if(a&&a.alpha>0)return ht(a.r,a.g,a.b)>0.179?"light":"dark"}catch(n){}finally{e.remove()}if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)return"dark";return"light"}function W(t){let e=t||Ht(),n=document.documentElement;if(n.getAttribute("data-theme")!==e)n.setAttribute("data-theme",e);if(n.style.colorScheme!==e)n.style.colorScheme=e}function yt(){if(window.addEventListener("message",(t)=>{if(t.data?.type==="ag-theme-sync"){let e=t.data.payload||{};if(e.scheme==="light"||e.scheme==="dark")N=e.scheme,W(N)}else if(t.data?.type==="theme-change"){let e=t.data?.payload?.cssVariables;if(e&&typeof e["--background"]==="string"){let n=ft(e["--background"]);if(n)N=ht(n.r,n.g,n.b)>0.179?"light":"dark"}W(N||void 0)}}),window.matchMedia){let t=window.matchMedia("(prefers-color-scheme: dark)"),e=()=>W();if(typeof t.addEventListener==="function")t.addEventListener("change",e);else if(typeof t.addListener==="function")t.addListener(e)}if(typeof MutationObserver<"u")new MutationObserver(()=>{W()}).observe(document.documentElement,{attributes:!0,attributeFilter:["style","data-theme"]});W()}function P(t){if(!t||t<=0)return"0";if(t>=1e9)return(t/1e9).toFixed(2)+"B";if(t>=1e6)return(t/1e6).toFixed(1)+"M";if(t>=1e4)return Math.round(t/1000)+"k";if(t>=1000)return(t/1000).toFixed(1)+"k";return String(Math.round(t))}function F(t){return(t||0).toLocaleString("en-US")}function Dt(t){if(!t)return"Recently";try{let e=new Date(t).getTime(),n=Date.now(),a=Math.max(0,Math.floor((n-e)/1000));if(a<60)return"Just now";if(a<3600)return`${Math.floor(a/60)}m ago`;if(a<86400)return`${Math.floor(a/3600)}h ago`;let s=Math.floor(a/86400);if(s<30)return`${s}d ago`;return`${Math.floor(s/30)}mo ago`}catch{return"Recently"}}function qt(t){if(!t||t.length<10)return t;try{return new Date(t+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}catch{return t.slice(5)}}function Ft(t){if(!t||t.length<10)return t;try{return new Date(t+"T00:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}catch{return t}}var Y=null,dt="last-30-days",it="",ct="",j=null;async function Pt(){try{let t=await window.sidecar.fetch("/api/analytics/overview",{method:"GET"});if(!t.ok)return null;let e=await t.json();return e.ok?e.data:null}catch(t){return console.error("[Aura Analytics] Failed to fetch overview:",t),null}}async function Ot(){try{let t=await window.sidecar.fetch("/api/analytics/conversations",{method:"GET"});if(!t.ok)return[];let e=await t.json();return e.ok&&Array.isArray(e.conversations)?e.conversations:[]}catch(t){return console.error("[Aura Analytics] Failed to fetch conversations:",t),[]}}async function kt(){try{let e=new URLSearchParams(window.location.search).get("conversationId")||"",n=e?`/api/analytics/session?id=${encodeURIComponent(e)}`:"/api/analytics/session",a=await window.sidecar.fetch(n,{method:"GET"});if(!a.ok)return null;let s=await a.json();return s.ok?s.data:null}catch(t){return console.error("[Aura Analytics] Failed to fetch active session:",t),null}}function jt(){let t=new Date;return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}function Gt(){let t=new Date(Date.now()-86400000);return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}function Wt(){let t=new Date,e=t.getDay(),n=t.getDate()-e+(e===0?-6:1),a=new Date(t.setDate(n));return a.getFullYear()+"-"+String(a.getMonth()+1).padStart(2,"0")+"-"+String(a.getDate()).padStart(2,"0")}function Nt(){let t=new Date;return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-01"}function vt(t){let e=new Date(Date.now()-t*86400000);return e.getFullYear()+"-"+String(e.getMonth()+1).padStart(2,"0")+"-"+String(e.getDate()).padStart(2,"0")}function _t(t,e){let n=[],a=new Date(t+"T00:00:00"),s=new Date(e+"T00:00:00");if(isNaN(a.getTime())||isNaN(s.getTime())||a>s)return[t];while(a<=s){let c=a.getFullYear(),i=String(a.getMonth()+1).padStart(2,"0"),d=String(a.getDate()).padStart(2,"0");n.push(`${c}-${i}-${d}`),a.setDate(a.getDate()+1)}return n}function zt(t,e){let n=jt(),a=Gt();if(e==="session"&&j&&j.steps.length>0){let l=j;return{columns:l.steps.map((u)=>{let S=u.ctx||u.inTok+u.cacheRead;return{label:`#${u.idx+1}`,tooltipHeader:`Session Turn #${u.idx+1}`,inputTok:u.inTok,outTok:u.outTok,cacheRead:u.cacheRead,ctx:S,requests:1,subText:`Context: ${P(S)} · Speed: ${Math.round(u.stream>0?u.outTok/u.stream:0)} tok/s`}}),totalTokens:l.totalTokens,totalRequests:l.totalRequests,cacheEfficiency:l.cacheEfficiency,avgTtft:l.avgTtft,avgTokPerSec:l.avgTokPerSec}}if(e==="today"||e==="yesterday"){let l=e==="today"?n:a,h={};for(let w=0;w<24;w++){let R=String(w).padStart(2,"0"),r=`${l} ${R}:00`;h[r]={label:`${R}:00`,tooltipHeader:`${l} ${R}:00 - ${R}:59`,inputTok:0,outTok:0,cacheRead:0,requests:0}}for(let w of t.hourlySeries||[])if(w.hourKey&&w.hourKey.startsWith(l)){let R=w.hourKey.slice(0,16);if(h[R])h[R].inputTok+=w.inputTok,h[R].outTok+=w.outTok,h[R].cacheRead+=w.cacheRead,h[R].requests+=w.requests}let u=Object.values(h),S=0,I=0,y=0,o=0;for(let w of u)S+=w.inputTok,I+=w.outTok,y+=w.cacheRead,o+=w.requests;let g=S+I+y,q=S+y,L=q>0?y/q*100:t.cacheEfficiency;return{columns:u,totalTokens:{input:S,output:I,cacheRead:y,thinking:t.totalTokens.thinking,total:g},totalRequests:o,cacheEfficiency:L,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}let s="0000-00-00",c=n;if(e==="this-week"){s=Wt();let l=new Date(s+"T00:00:00");l.setDate(l.getDate()+6),c=l.getFullYear()+"-"+String(l.getMonth()+1).padStart(2,"0")+"-"+String(l.getDate()).padStart(2,"0")}else if(e==="this-month")s=Nt(),c=n;else if(e==="last-7-days")s=vt(6),c=n;else if(e==="last-30-days")s=vt(29),c=n;else if(e==="custom"){if(it&&ct)s=it,c=ct}let i={};for(let l of t.timeRangeSeries||[])if(l.date&&!l.date.startsWith("0001"))i[l.date]={inputTok:l.inputTok,outTok:l.outTok,cacheRead:l.cacheRead,requests:l.requests||1};let d=_t(s,c),p=new Date(s+"T00:00:00").getTime(),v=new Date(c+"T00:00:00").getTime();if(Math.round((v-p)/86400000)>90){let l={};for(let L of d){let w=i[L]||{inputTok:0,outTok:0,cacheRead:0,requests:0},R=new Date(L+"T00:00:00"),r=Math.floor(R.getDate()/7)+1,f=`${L.slice(0,7)} W${r}`;if(!l[f])l[f]={label:f.slice(5),tooltipHeader:`Week of ${L}`,inputTok:0,outTok:0,cacheRead:0,requests:0};l[f].inputTok+=w.inputTok,l[f].outTok+=w.outTok,l[f].cacheRead+=w.cacheRead,l[f].requests+=w.requests}let h=Object.values(l),u=0,S=0,I=0,y=0;for(let L of h)u+=L.inputTok,S+=L.outTok,I+=L.cacheRead,y+=L.requests;let o=u+S+I,g=u+I,q=g>0?I/g*100:t.cacheEfficiency;return{columns:h,totalTokens:{input:u,output:S,cacheRead:I,thinking:t.totalTokens.thinking,total:o},totalRequests:y,cacheEfficiency:q,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}let A=d.map((l)=>{let h=i[l]||{inputTok:0,outTok:0,cacheRead:0,requests:0};return{label:qt(l),tooltipHeader:Ft(l),inputTok:h.inputTok,outTok:h.outTok,cacheRead:h.cacheRead,requests:h.requests}}),k=0,x=0,M=0,b=0;for(let l of A)k+=l.inputTok,x+=l.outTok,M+=l.cacheRead,b+=l.requests;let E=k+x+M,C=k+M,T=C>0?M/C*100:t.cacheEfficiency;return{columns:A,totalTokens:{input:k,output:x,cacheRead:M,thinking:t.totalTokens.thinking,total:E},totalRequests:b,cacheEfficiency:T,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}function Ut(t){let e=document.getElementById("analytics-cards-grid");if(!e)return;let n=t.totalTokens.total,a=t.totalTokens.input,s=t.totalTokens.output,c=t.totalTokens.cacheRead,i=t.totalRequests;e.innerHTML=`
    <!-- Row 1: Primary Metrics -->
    <div class="kpi-grid-primary">
      <div class="kpi-card kpi-card-featured">
        <div class="kpi-label">Total Tokens Processed</div>
        <div class="kpi-value">${P(n)}</div>
        <div class="kpi-breakdown">
          <span class="kpi-tag tag-cached">Cache: ${P(c)}</span>
          <span class="kpi-tag tag-input">In: ${P(a)}</span>
          <span class="kpi-tag tag-output">Out: ${P(s)}</span>
        </div>
      </div>

      <div class="kpi-card kpi-card-featured">
        <div class="kpi-label">Total Requests</div>
        <div class="kpi-value">${F(i)}</div>
        <div class="kpi-subtext">Completed model inferences for the selected range</div>
      </div>
    </div>

    <!-- Row 2: Secondary Performance Metrics -->
    <div class="kpi-grid-secondary">
      <div class="kpi-card">
        <div class="kpi-label">Cache Cost Efficiency</div>
        <div class="kpi-value">${t.cacheEfficiency.toFixed(1)}%</div>
        <div class="kpi-subtext">Prompt caching saved ~${P(c)} tokens from reprocessing</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Avg Streaming Speed</div>
        <div class="kpi-value">${t.avgTokPerSec} <span class="kpi-unit">tok/s</span></div>
        <div class="kpi-subtext">Real-time generation throughput across models</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Avg Time to First Token</div>
        <div class="kpi-value">${t.avgTtft.toFixed(2)}<span class="kpi-unit">s</span></div>
        <div class="kpi-subtext">Average latency from prompt dispatch to first chunk</div>
      </div>
    </div>
  `}var lt="overview";function Tt(t,e){let n=document.getElementById("analytics-activity-chart");if(!n)return;if(!t||t.length===0){n.innerHTML=`
      <div class="chart-header">
        <div class="chart-title">${e}</div>
      </div>
      <div class="chart-empty">No activity data recorded in the selected range</div>
    `;return}let a=dt==="session"&&!!j&&j.steps.length>0;if(a&&lt==="overview")Yt(n,j,e,t);else Kt(n,t,e,a)}function bt(t,e,n){t.querySelectorAll("#session-view-segmented .segment-btn").forEach((s)=>{s.addEventListener("click",(c)=>{c.stopPropagation();let i=s.getAttribute("data-mode");if(i&&i!==lt)lt=i,Tt(e,n)})})}function Yt(t,e,n,a){let s=e.steps,c=s.length;if(c===0)return;let i=Math.max(...s.map((y)=>y.ctx||y.inTok+y.cacheRead),1000),d=Math.pow(10,Math.floor(Math.log10(i))),p=i/d,v=d;if(p<=2)v=0.5*d;else if(p<=5)v=1*d;else v=2*d;let m=Math.ceil(i/(v*4))*(v*4)||v*4,A=[0,m*0.25,m*0.5,m*0.75,m],k=220,x=24,M=30,b=k-x-M,E="";A.forEach((y)=>{let o=x+b-y/m*b;E+=`
      <text x="40" y="${o+3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${P(y)}</text>
      <line x1="43" y1="${o}" x2="48" y2="${o}" stroke="var(--aura-border)" stroke-width="1" opacity="${y===0?"0.7":"0.3"}" />
    `});let C=590,T=C-10,l="";A.forEach((y)=>{let o=x+b-y/m*b;l+=`
      <line x1="0" y1="${o}" x2="${T}" y2="${o}" stroke="var(--aura-border)" stroke-width="1" opacity="${y===0?"0.6":"0.2"}" />
    `});let h=`M 0,${x+b}`,u="",S="",I=Math.max(1,Math.floor(c/6));s.forEach((y,o)=>{let g=y.ctx||y.inTok+y.cacheRead,q=c>1?o/(c-1)*T:0,L=x+b-g/m*b;if(o===0)h+=` L ${q.toFixed(1)},${L.toFixed(1)}`,u=`M ${q.toFixed(1)},${L.toFixed(1)}`;else h+=` L ${q.toFixed(1)},${L.toFixed(1)}`,u+=` L ${q.toFixed(1)},${L.toFixed(1)}`;if(o%I===0)S+=`
        <text x="${q.toFixed(1)}" y="${k-8}" text-anchor="${o===0?"start":"middle"}" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#${o+1}</text>
      `}),h+=` L ${T},${x+b} Z`,t.innerHTML=`
    <div class="chart-header">
      <div class="chart-header-left">
        <div class="chart-title">Token Activity (${n})</div>
      </div>
      <div class="chart-header-right">
        <div class="segmented-control mini-segmented" id="session-view-segmented">
          <button class="segment-btn active" data-mode="overview">Overview</button>
          <button class="segment-btn" data-mode="timeline">Timeline</button>
        </div>
        <div class="chart-legend">
          <span class="legend-item"><span class="legend-dot" style="background: #00A67E"></span>Context Window Watermark</span>
        </div>
      </div>
    </div>
    <div class="chart-layout-root">
      <div class="chart-y-axis-sticky">
        <svg viewBox="0 0 48 ${k}" class="y-axis-svg">
          ${E}
        </svg>
      </div>
      <div class="chart-viewport-wrapper">
        <div class="chart-stage" id="chart-stage-container">
          <svg viewBox="0 0 ${C} ${k}" preserveAspectRatio="none" class="analytics-svg" id="analytics-svg-element">
            <defs>
              <linearGradient id="aura-ctx-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#00A67E" stop-opacity="0.45" />
                <stop offset="65%" stop-color="#00A67E" stop-opacity="0.12" />
                <stop offset="100%" stop-color="#00A67E" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            ${l}
            <path d="${h}" fill="url(#aura-ctx-grad)" />
            <path d="${u}" fill="none" stroke="#00A67E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            ${S}
          </svg>
          <div class="chart-scrubber-line" id="chart-scrubber-line" style="display: none;"></div>
          <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
    </div>
  `,bt(t,a,n),Xt(t,s)}function Xt(t,e){let n=t.querySelector("#chart-stage-container"),a=t.querySelector("#chart-scrubber-line"),s=t.querySelector("#chart-floating-tooltip");if(!n||!a||!s)return;n.addEventListener("mousemove",(c)=>{let i=n.getBoundingClientRect(),d=Math.max(0,Math.min(c.clientX-i.left,i.width)),p=i.width>0?d/i.width:0,v=Math.min(e.length-1,Math.max(0,Math.round(p*(e.length-1)))),m=e[v];if(!m)return;let A=m.ctx||m.inTok+m.cacheRead,k=Math.round(m.stream>0?m.outTok/m.stream:0);a.style.display="block",a.style.transform=`translateX(${d}px)`,s.innerHTML=`
      <div class="tooltip-header">Session Turn #${m.idx+1}</div>
      <div class="tooltip-row ctx-row">
        <span class="tooltip-dot" style="background: #3B82F6"></span>
        <span class="tooltip-label">Context Window</span>
        <span class="tooltip-val">${P(A)} (${F(A)})</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: #00A67E"></span>
        <span class="tooltip-label">Cache Read</span>
        <span class="tooltip-val">${F(m.cacheRead)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: #6366F1"></span>
        <span class="tooltip-label">Input Tokens</span>
        <span class="tooltip-val">${F(m.inTok)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
        <span class="tooltip-label">Output Tokens</span>
        <span class="tooltip-val">${F(m.outTok)}</span>
      </div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-subline">Speed: ${k} tok/s · TTFT: ${m.ttft.toFixed(2)}s</div>
    `,s.style.display="block";let x=s.offsetWidth||180,M=s.offsetHeight||135,b=0;if(d>i.width/2)b=d-x-16;else b=d+16;b=Math.max(8,Math.min(b,i.width-x-8));let E=10,C=i.height-M-12;if(C>10)E=Math.min(E,C);s.style.left=`${Math.round(b)}px`,s.style.top=`${Math.round(E)}px`}),n.addEventListener("mouseleave",()=>{a.style.display="none",s.style.display="none"})}function Kt(t,e,n,a){let s=Math.max(...e.map((r)=>r.inputTok+r.outTok+r.cacheRead),1000),c=Math.pow(10,Math.floor(Math.log10(s))),i=s/c,d=c;if(i<=2)d=0.5*c;else if(i<=5)d=1*c;else d=2*c;let p=Math.ceil(s/(d*4))*(d*4)||d*4,v=[0,p*0.25,p*0.5,p*0.75,p],m=e.length>40,A=m?10:Math.max(6,Math.floor(540/e.length)),k=m?Math.max(580,e.length*A+40):580,x=220,M=10,b=14,E=24,C=30,T=x-E-C,h=(k-M-b)/e.length,u=Math.max(3,Math.min(22,Math.floor(h*0.72))),S="";v.forEach((r)=>{let f=E+T-r/p*T;S+=`
      <text x="40" y="${f+3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${P(r)}</text>
      <line x1="43" y1="${f}" x2="48" y2="${f}" stroke="var(--aura-border)" stroke-width="1" opacity="${r===0?"0.7":"0.3"}" />
    `});let I="";v.forEach((r)=>{let f=E+T-r/p*T;I+=`
      <line x1="0" y1="${f}" x2="${k}" y2="${f}" stroke="var(--aura-border)" stroke-width="1" opacity="${r===0?"0.6":"0.2"}" />
    `});let y="<defs>",o="",g="",q=e.length===24&&(e[0]?.label.includes(":00")||!1),L=e[0]?.label.startsWith("#")||!1,w=q?3:Math.max(1,Math.floor(e.length/8));e.forEach((r,f)=>{let B=M+f*h+(h-u)/2,z=r.inputTok+r.outTok+r.cacheRead,X=M+f*h,at=B+u/2;if(z>0){let ut=Math.max(3,Math.round(z/p*T)),K=r.outTok>0?Math.max(1,Math.round(r.outTok/p*T)):0,J=r.inputTok>0?Math.max(1,Math.round(r.inputTok/p*T)):0,U=r.cacheRead>0?Math.max(1,ut-K-J):0;if(U<0)U=0;let nt=E+T,pt=nt-U,mt=pt-J,st=mt-K,Z=st,G=Math.min(3.5,u/2,ut);y+=`
        <clipPath id="col-clip-${f}">
          <path d="M ${B} ${nt} L ${B} ${Z+G} A ${G} ${G} 0 0 1 ${B+G} ${Z} L ${B+u-G} ${Z} A ${G} ${G} 0 0 1 ${B+u} ${Z+G} L ${B+u} ${nt} Z" />
        </clipPath>
      `,o+=`
        <g class="chart-column-group" 
           data-header="${r.tooltipHeader}" 
           data-in="${F(r.inputTok)}" 
           data-out="${F(r.outTok)}" 
           data-cache="${F(r.cacheRead)}"
           data-total="${F(z)}"
           data-ctx="${r.ctx?P(r.ctx)+" ("+F(r.ctx)+")":""}"
           data-reqs="${F(r.requests||1)}"
           data-subtext="${r.subText||""}"
           data-center-x="${at}"
           data-slot-x="${X}"
           data-slot-w="${h}"
           data-top-y="${st}"
           data-idx="${f}">
          
          <rect class="bar-bg-band" x="${X}" y="${E}" width="${h}" height="${T}" rx="4" />
          
          <g clip-path="url(#col-clip-${f})">
            ${U>0?`<rect class="bar-segment bar-cache" x="${B}" y="${pt}" width="${u}" height="${U}" fill="#00A67E" />`:""}
            ${J>0?`<rect class="bar-segment bar-in" x="${B}" y="${mt}" width="${u}" height="${J}" fill="#6366F1" opacity="0.85" />`:""}
            ${K>0?`<rect class="bar-segment bar-out" x="${B}" y="${st}" width="${u}" height="${K}" fill="var(--aura-primary)" />`:""}
          </g>
        </g>
      `}else o+=`
        <g class="chart-column-group" 
           data-header="${r.tooltipHeader}" 
           data-in="0" 
           data-out="0" 
           data-cache="0"
           data-total="0"
           data-ctx="${r.ctx?P(r.ctx)+" ("+F(r.ctx)+")":""}"
           data-reqs="0"
           data-subtext="${r.subText||""}"
           data-center-x="${at}"
           data-slot-x="${X}"
           data-slot-w="${h}"
           data-top-y="${E+T}"
           data-idx="${f}">
          
          <rect class="bar-bg-band" x="${X}" y="${E}" width="${h}" height="${T}" rx="4" />
        </g>
      `;if(q||L?f%w===0:f%w===0||f===e.length-1&&(e.length-1)%w>=Math.floor(w/2))g+=`
        <text x="${at}" y="${x-8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${r.label}</text>
      `}),y+="</defs>";let R=a?`
    <div class="segmented-control mini-segmented" id="session-view-segmented">
      <button class="segment-btn" data-mode="overview">Overview</button>
      <button class="segment-btn active" data-mode="timeline">Timeline</button>
    </div>
  `:"";if(t.innerHTML=`
    <div class="chart-header">
      <div class="chart-header-left">
        <div class="chart-title">Token Activity (${n})</div>
      </div>
      <div class="chart-header-right">
        ${R}
        <div class="chart-legend">
          <span class="legend-item"><span class="legend-dot" style="background: var(--aura-primary)"></span>Output Tokens</span>
          <span class="legend-item"><span class="legend-dot" style="background: #6366F1"></span>Input Tokens</span>
          <span class="legend-item"><span class="legend-dot" style="background: #00A67E"></span>Cache Read</span>
        </div>
      </div>
    </div>
    <div class="chart-layout-root">
      <div class="chart-y-axis-sticky">
        <svg viewBox="0 0 48 ${x}" class="y-axis-svg">
          ${S}
        </svg>
      </div>
      <div class="chart-viewport-wrapper">
        ${m?`
          <div class="chart-fade-mask mask-left" id="chart-mask-left" style="opacity: 0;">
            <span class="mask-indicator">‹</span>
          </div>
          <div class="chart-fade-mask mask-right" id="chart-mask-right" style="opacity: 0;">
            <span class="mask-indicator">›</span>
          </div>
        `:""}
        <div class="chart-stage ${m?"chart-stage-scrollable":""}" id="chart-stage-container">
          <svg viewBox="0 0 ${k} ${x}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="analytics-svg-element" style="${m?`min-width: ${k}px;`:""}">
            ${y}
            ${I}
            <rect id="chart-shared-hover-band" class="chart-shared-hover-band" x="0" y="${E}" width="0" height="${T}" rx="4" style="display: none;" />
            ${o}
            ${g}
          </svg>
          <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
    </div>
  `,a)bt(t,e,n);if(m)setTimeout(()=>{let r=t.querySelector("#chart-stage-container"),f=t.querySelector("#chart-mask-left"),B=t.querySelector("#chart-mask-right");if(r){if(r.scrollLeft=r.scrollWidth,f&&B)Jt(r,f,B)}},50);Zt(t,k)}function Jt(t,e,n){function a(){let s=t.scrollWidth-t.clientWidth;if(s<=0){e.style.opacity="0",n.style.opacity="0";return}e.style.opacity=t.scrollLeft>14?"1":"0",n.style.opacity=s-t.scrollLeft>14?"1":"0"}t.addEventListener("scroll",a,{passive:!0}),a()}function Zt(t,e){let n=t.querySelector("#chart-floating-tooltip"),a=t.querySelector("#chart-stage-container"),s=t.querySelector("#chart-shared-hover-band"),c=t.querySelectorAll(".chart-column-group");if(!n||!a)return;let i=null;c.forEach((d)=>{d.addEventListener("mouseenter",()=>{let p=d,v=p.getAttribute("data-idx");if(v===i)return;i=v;let m=p.getAttribute("data-header")||"",A=p.getAttribute("data-in")||"0",k=p.getAttribute("data-out")||"0",x=p.getAttribute("data-cache")||"0",M=p.getAttribute("data-total")||"0",b=p.getAttribute("data-ctx")||"",E=p.getAttribute("data-reqs")||"0",C=p.getAttribute("data-subtext")||"",T=parseFloat(p.getAttribute("data-slot-x")||"0"),l=parseFloat(p.getAttribute("data-slot-w")||"0");if(s)s.setAttribute("x",String(T)),s.setAttribute("width",String(l)),s.style.display="block";let h=b?`
        <div class="tooltip-row ctx-row">
          <span class="tooltip-dot" style="background: #3B82F6"></span>
          <span class="tooltip-label">Context Window</span>
          <span class="tooltip-val">${b}</span>
        </div>
      `:"";n.innerHTML=`
        <div class="tooltip-header">${m}</div>
        ${h}
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
          <span class="tooltip-label">Output Tokens</span>
          <span class="tooltip-val">${k}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #6366F1"></span>
          <span class="tooltip-label">Input Tokens</span>
          <span class="tooltip-val">${A}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #00A67E"></span>
          <span class="tooltip-label">Cache Read</span>
          <span class="tooltip-val">${x}</span>
        </div>
        <div class="tooltip-divider"></div>
        <div class="tooltip-row total-row">
          <span class="tooltip-label">Total Tokens</span>
          <span class="tooltip-val">${M}</span>
        </div>
        <div class="tooltip-subline">${E} generation requests${C?" · "+C:""}</div>
      `,n.style.display="block";let u=a.getBoundingClientRect(),I=(p.querySelector(".bar-bg-band")||p).getBoundingClientRect(),y=I.left-u.left+a.scrollLeft,o=I.right-u.left+a.scrollLeft,g=n.offsetWidth||180,q=n.offsetHeight||135,L=a.scrollLeft,w=a.scrollLeft+u.width,R=w-(o+12),r=y-12-L,f=0;if(R>=g+6&&(R>=r||r<g))f=o+12;else if(r>=g+6)f=y-g-12;else if(R>=r)f=Math.max(o+4,w-g-6);else f=Math.min(y-g-4,L+6);let B=10,z=u.height-q-12;if(z>10)B=Math.min(B,z);n.style.left=`${Math.round(f)}px`,n.style.top=`${Math.round(B)}px`})}),a.addEventListener("mouseleave",()=>{if(i=null,s)s.style.display="none";n.style.display="none"})}function Qt(t){let e=document.getElementById("analytics-projects-list");if(!e)return;if(!t||t.length===0){e.innerHTML='<div class="chart-empty">No workspace activity recorded</div>';return}let n=Math.max(...t.map((s)=>s.tokenCount),1),a=t.map((s)=>{let c=Math.max(4,Math.round(s.tokenCount/n*100)),i=s.projectId.split("/").filter(Boolean).pop()||s.projectId;return`
      <div class="project-stat-row">
        <div class="project-meta">
          <div class="project-name" title="${s.projectId}">${i}</div>
          <div class="project-counts">${s.conversationCount} sessions · ${P(s.tokenCount)} tokens</div>
        </div>
        <div class="project-bar-track">
          <div class="project-bar-fill" style="width: ${c}%"></div>
        </div>
      </div>
    `}).join("");e.innerHTML=a}function Vt(t){let e=document.getElementById("analytics-sessions-tbody");if(!e)return;if(!t||t.length===0){e.innerHTML='<tr><td colspan="4" class="empty-cell">No recent conversation sessions detected</td></tr>';return}let n=t.slice(0,15).map((a)=>{let s=a.title||"Untitled Session",c="Default";if(a.workspaceUris)try{let d=JSON.parse(a.workspaceUris);if(Array.isArray(d)&&d.length>0){let p=d[0].replace(/^file:\/\//,"").split("/").filter(Boolean).pop();if(p)c=decodeURIComponent(p)}}catch{}else if(a.projectId)c=a.projectId.split("/").filter(Boolean).pop()||a.projectId;let i=Dt(a.lastModifiedTime);return`
      <tr class="session-row">
        <td class="session-title-cell" title="${s}">${s}</td>
        <td class="session-project-cell"><span class="project-pill" title="${a.workspaceUris||a.projectId}">${c}</span></td>
        <td class="session-steps-cell">${a.stepCount} steps</td>
        <td class="session-time-cell">${i}</td>
      </tr>
    `}).join("");e.innerHTML=n}function te(t){switch(t){case"session":return"Active Session";case"today":return"Today";case"yesterday":return"Yesterday";case"this-week":return"This Week";case"this-month":return"This Month";case"last-7-days":return"Last 7 Days";case"last-30-days":return"Last 30 Days";case"custom":return"Custom Range";default:return"Overview"}}async function rt(t){dt=t;let e=document.getElementById("analytics-timerange-segmented");if(e)e.querySelectorAll(".segment-btn").forEach((a)=>{if(a.getAttribute("data-range")===t)a.classList.add("active");else a.classList.remove("active")});let n=document.getElementById("custom-range-inputs");if(n)n.style.display=t==="custom"?"flex":"none";if(t==="session"){if(!j)j=await kt()}if(Y){let a=zt(Y,t);Ut(a),Tt(a.columns,te(t))}}async function Q(){let t=document.getElementById("btn-refresh-analytics");if(t)t.classList.add("loading");let[e,n,a]=await Promise.all([Pt(),Ot(),kt()]);if(e)Y=e;if(a)j=a;if(Y)await rt(dt),Qt(Y.topProjects);if(n)Vt(n);if(t)setTimeout(()=>t.classList.remove("loading"),300)}function wt(){let t=document.getElementById("analytics-timerange-segmented");if(t)t.querySelectorAll(".segment-btn").forEach((s)=>{s.addEventListener("click",()=>{let c=s.getAttribute("data-range");if(c)rt(c)})});let e=document.getElementById("custom-date-start"),n=document.getElementById("custom-date-end");document.getElementById("btn-apply-custom-range")?.addEventListener("click",()=>{if(e?.value&&n?.value)it=e.value,ct=n.value,rt("custom")})}var D=null,V=[];function _(t){let e=document.getElementById("toast");if(!e)return;e.textContent=t,e.classList.add("show"),setTimeout(()=>e.classList.remove("show"),2000)}async function H(t){try{let e=await window.sidecar.fetch("/api/config",{method:"POST",body:JSON.stringify(t)});if(e.ok)D=(await e.json()).config,_("Configuration applied in real-time");else _("Save failed")}catch(e){console.error("saveConfig failed:",e),_("Network error")}}function O(t,e){let n=document.getElementById(t);if(!n)return;n.querySelectorAll(".segment-btn").forEach((a)=>{if(a.getAttribute("data-val")===String(e))a.classList.add("active");else a.classList.remove("active")})}function tt(t,e,n,a){let s=document.getElementById(t);if(!s)return;s.innerHTML="";let c=document.createElement("option");c.value="default",c.textContent=e,s.appendChild(c);let i=document.createElement("optgroup");i.label="System Installed Fonts";for(let p of n){let v=document.createElement("option");v.value=p,v.textContent=p,i.appendChild(v)}s.appendChild(i);let d=document.createElement("option");if(d.value="custom",d.textContent="Custom font name...",s.appendChild(d),!a||a==="default")s.value="default";else if(n.includes(a))s.value=a;else s.value="custom"}async function Et(){try{let t=await window.sidecar.fetch("/api/system-fonts",{method:"GET"});if(t.ok){let e=await t.json();if(Array.isArray(e.fonts))V=e.fonts}}catch(t){console.error("loadSystemFonts failed:",t)}}async function $t(){try{let t=await window.sidecar.fetch("/api/config",{method:"GET"});if(!t.ok)return;let{config:e}=await t.json();D=e;let n=document.getElementById("select-language");if(n)n.value=e.language||"default";let a=e.presets?.light||"high-contrast",s=e.presets?.dark||"claude-dark";O("preset-light-segmented",a),O("preset-dark-segmented",s);let c=document.getElementById("toggle-wax-seal");if(c)c.checked=e.composer?.waxSeal!==!1;let i=e.typography||{};tt("select-font-sans-primary","Default",V,i.primarySans),tt("select-font-sans-fallback","Default",V,i.fallbackSans),tt("select-font-mono","Default",V,i.mono);let d=document.getElementById("select-font-sans-primary"),p=document.getElementById("row-custom-sans-primary"),v=document.getElementById("input-custom-sans-primary");if(d&&p){if(p.style.display=d.value==="custom"?"flex":"none",v)v.value=i.customPrimarySans||""}let m=document.getElementById("select-font-sans-fallback"),A=document.getElementById("row-custom-sans-fallback"),k=document.getElementById("input-custom-sans-fallback");if(m&&A){if(A.style.display=m.value==="custom"?"flex":"none",k)k.value=i.customFallbackSans||""}let x=document.getElementById("select-font-mono"),M=document.getElementById("row-custom-mono"),b=document.getElementById("input-custom-mono");if(x&&M){if(M.style.display=x.value==="custom"?"flex":"none",b)b.value=i.customMono||""}O("font-size-segmented",i.fontSize||16);let E=e.composer?.collinear!==!1?"collinear":"native";O("composer-align-segmented",E);let C=document.getElementById("toggle-hide-arrows");if(C)C.checked=e.composer?.hideArrows!==!1;let T=document.getElementById("toggle-metrics");if(T)T.checked=e.telemetry?.enabled!==!1;O("metrics-interval-segmented",e.telemetry?.interval||2000)}catch(t){console.error("loadConfig failed:",t)}}async function et(){try{let t=await window.sidecar.fetch("/api/status",{method:"GET"});if(!t.ok)return;let e=await t.json(),n=document.getElementById("status-dot"),a=document.getElementById("status-text"),s=document.getElementById("status-sublabel");if(e.connected){if(n)n.classList.remove("disconnected");if(a)a.textContent="Connected";if(s)s.textContent=`Connected to host (${e.targetCount||1} window(s) · port ${e.cdpPort||"-"})`}else{if(n)n.classList.add("disconnected");if(a)a.textContent="Searching window...";if(s)s.textContent="Detecting Antigravity CDP port..."}}catch(t){console.error("updateStatus failed:",t)}}async function xt(){yt(),W(),await Et(),await $t(),et(),setInterval(et,3000);let t=document.getElementById("select-language");if(t)t.addEventListener("change",()=>{H({language:t.value})});let e=document.getElementById("preset-light-segmented");if(e)e.querySelectorAll(".segment-btn").forEach((o)=>{o.addEventListener("click",()=>{let g=o.getAttribute("data-val")||"high-contrast";O("preset-light-segmented",g),H({presets:{...D?.presets,light:g}})})});let n=document.getElementById("preset-dark-segmented");if(n)n.querySelectorAll(".segment-btn").forEach((o)=>{o.addEventListener("click",()=>{let g=o.getAttribute("data-val")||"claude-dark";O("preset-dark-segmented",g),H({presets:{...D?.presets,dark:g}})})});let a=document.getElementById("toggle-wax-seal");if(a)a.addEventListener("change",()=>{H({composer:{...D?.composer,waxSeal:a.checked}})});let s=document.getElementById("select-font-sans-primary"),c=document.getElementById("row-custom-sans-primary"),i=document.getElementById("input-custom-sans-primary");if(s)s.addEventListener("change",()=>{let o=s.value==="custom";if(c)c.style.display=o?"flex":"none";if(!o)H({typography:{...D?.typography,primarySans:s.value}});else if(i)i.focus()});if(i){let o=()=>{if(s&&s.value==="custom")H({typography:{...D?.typography,primarySans:"custom",customPrimarySans:i.value.trim()}})};i.addEventListener("change",o),i.addEventListener("keydown",(g)=>{if(g.key==="Enter")o(),i.blur()})}let d=document.getElementById("select-font-sans-fallback"),p=document.getElementById("row-custom-sans-fallback"),v=document.getElementById("input-custom-sans-fallback");if(d)d.addEventListener("change",()=>{let o=d.value==="custom";if(p)p.style.display=o?"flex":"none";if(!o)H({typography:{...D?.typography,fallbackSans:d.value}});else if(v)v.focus()});if(v){let o=()=>{if(d&&d.value==="custom")H({typography:{...D?.typography,fallbackSans:"custom",customFallbackSans:v.value.trim()}})};v.addEventListener("change",o),v.addEventListener("keydown",(g)=>{if(g.key==="Enter")o(),v.blur()})}let m=document.getElementById("select-font-mono"),A=document.getElementById("row-custom-mono"),k=document.getElementById("input-custom-mono");if(m)m.addEventListener("change",()=>{let o=m.value==="custom";if(A)A.style.display=o?"flex":"none";if(!o)H({typography:{...D?.typography,mono:m.value}});else if(k)k.focus()});if(k){let o=()=>{if(m&&m.value==="custom")H({typography:{...D?.typography,mono:"custom",customMono:k.value.trim()}})};k.addEventListener("change",o),k.addEventListener("keydown",(g)=>{if(g.key==="Enter")o(),k.blur()})}let x=document.getElementById("font-size-segmented");if(x)x.querySelectorAll(".segment-btn").forEach((o)=>{o.addEventListener("click",()=>{let g=Number(o.getAttribute("data-val"));O("font-size-segmented",g),H({typography:{...D?.typography,fontSize:g}})})});let M=document.getElementById("composer-align-segmented");if(M)M.querySelectorAll(".segment-btn").forEach((o)=>{o.addEventListener("click",()=>{let g=o.getAttribute("data-val");O("composer-align-segmented",g||"collinear"),H({composer:{...D?.composer,collinear:g==="collinear"}})})});let b=document.getElementById("toggle-hide-arrows");if(b)b.addEventListener("change",()=>{H({composer:{...D?.composer,hideArrows:b.checked}})});let E=document.getElementById("toggle-metrics");if(E)E.addEventListener("change",()=>{H({telemetry:{...D?.telemetry,enabled:E.checked}})});let C=document.getElementById("metrics-interval-segmented");if(C)C.querySelectorAll(".segment-btn").forEach((o)=>{o.addEventListener("click",()=>{let g=Number(o.getAttribute("data-val"));O("metrics-interval-segmented",g),H({telemetry:{...D?.telemetry,interval:g}})})});let T=document.getElementById("btn-force-reload");if(T)T.addEventListener("click",async()=>{T.disabled=!0,T.style.opacity="0.6";try{if((await window.sidecar.fetch("/api/reload",{method:"POST"})).ok)_("Styles recompiled and re-applied"),await et();else _("Reload failed")}catch(o){_("Request error")}finally{T.disabled=!1,T.style.opacity="1"}});let l=document.getElementById("tab-nav-analytics"),h=document.getElementById("tab-nav-settings"),u=document.getElementById("view-analytics"),S=document.getElementById("view-settings"),I=(o)=>{if(o==="analytics"){if(l?.classList.add("active"),h?.classList.remove("active"),u)u.style.display="block";if(S)S.style.display="none";Q()}else{if(h?.classList.add("active"),l?.classList.remove("active"),S)S.style.display="block";if(u)u.style.display="none"}};l?.addEventListener("click",()=>I("analytics")),h?.addEventListener("click",()=>I("settings")),document.getElementById("btn-refresh-analytics")?.addEventListener("click",()=>Q()),wt(),Q()}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",xt);else xt();})();

//# debugId=193376B1B8E4B55E64756E2164756E21
