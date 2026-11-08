(()=>{var{defineProperty:st,getOwnPropertyNames:xt,getOwnPropertyDescriptor:St}=Object,Mt=Object.prototype.hasOwnProperty;function Lt(t){return this[t]}var It=(t)=>{var e=(pt??=new WeakMap).get(t),n;if(e)return e;if(e=st({},"__esModule",{value:!0}),t&&typeof t==="object"||typeof t==="function"){for(var a of xt(t))if(!Mt.call(e,a))st(e,a,{get:Lt.bind(t,a),enumerable:!(n=St(t,a))||n.enumerable})}return pt.set(t,e),e},pt;var Ct=(t)=>t;function Rt(t,e){this[t]=Ct.bind(null,e)}var At=(t,e)=>{for(var n in e)st(t,n,{get:e[n],enumerable:!0,configurable:!0,set:Rt.bind(e,n)})};var te={};At(te,{loadConfig:()=>$t,loadSystemFonts:()=>Et,populateFontSelect:()=>Q,saveConfig:()=>H,showToast:()=>N,updateSegmentedUI:()=>F,updateStatus:()=>V});var W=null;function gt(t,e,n){let a=(s)=>{let c=s/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};return 0.2126*a(t)+0.7152*a(e)+0.0722*a(n)}function ft(t){if(!t)return null;let e=t.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);if(e)return{r:parseInt(e[1],10),g:parseInt(e[2],10),b:parseInt(e[3],10),alpha:e[4]!==void 0?parseFloat(e[4]):1};return null}function Bt(){if(W==="light"||W==="dark")return W;let t=document.documentElement.style.colorScheme;if(t==="light"||t==="dark")return t;let e=document.createElement("div");e.setAttribute("aria-hidden","true"),e.style.cssText="position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;background-color:var(--background, var(--vscode-editor-background, transparent))",(document.body||document.documentElement).appendChild(e);try{let n=window.getComputedStyle(e).backgroundColor,a=ft(n);if(a&&a.alpha>0)return gt(a.r,a.g,a.b)>0.179?"light":"dark"}catch(n){}finally{e.remove()}if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)return"dark";return"light"}function G(t){let e=t||Bt(),n=document.documentElement;if(n.getAttribute("data-theme")!==e)n.setAttribute("data-theme",e);if(n.style.colorScheme!==e)n.style.colorScheme=e}function ht(){if(window.addEventListener("message",(t)=>{if(t.data?.type==="ag-theme-sync"){let e=t.data.payload||{};if(e.scheme==="light"||e.scheme==="dark")W=e.scheme,G(W)}else if(t.data?.type==="theme-change"){let e=t.data?.payload?.cssVariables;if(e&&typeof e["--background"]==="string"){let n=ft(e["--background"]);if(n)W=gt(n.r,n.g,n.b)>0.179?"light":"dark"}G(W||void 0)}}),window.matchMedia){let t=window.matchMedia("(prefers-color-scheme: dark)"),e=()=>G();if(typeof t.addEventListener==="function")t.addEventListener("change",e);else if(typeof t.addListener==="function")t.addListener(e)}if(typeof MutationObserver<"u")new MutationObserver(()=>{G()}).observe(document.documentElement,{attributes:!0,attributeFilter:["style","data-theme"]});G()}function P(t){if(!t||t<=0)return"0";if(t>=1e9)return(t/1e9).toFixed(2)+"B";if(t>=1e6)return(t/1e6).toFixed(1)+"M";if(t>=1e4)return Math.round(t/1000)+"k";if(t>=1000)return(t/1000).toFixed(1)+"k";return String(Math.round(t))}function q(t){return(t||0).toLocaleString("en-US")}function Ht(t){if(!t)return"Recently";try{let e=new Date(t).getTime(),n=Date.now(),a=Math.max(0,Math.floor((n-e)/1000));if(a<60)return"Just now";if(a<3600)return`${Math.floor(a/60)}m ago`;if(a<86400)return`${Math.floor(a/3600)}h ago`;let s=Math.floor(a/86400);if(s<30)return`${s}d ago`;return`${Math.floor(s/30)}mo ago`}catch{return"Recently"}}function Dt(t){if(!t||t.length<10)return t;try{return new Date(t+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}catch{return t.slice(5)}}function qt(t){if(!t||t.length<10)return t;try{return new Date(t+"T00:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}catch{return t}}var z=null,rt="last-30-days",ot="",it="",O=null;async function Pt(){try{let t=await window.sidecar.fetch("/api/analytics/overview",{method:"GET"});if(!t.ok)return null;let e=await t.json();return e.ok?e.data:null}catch(t){return console.error("[Aura Analytics] Failed to fetch overview:",t),null}}async function Ft(){try{let t=await window.sidecar.fetch("/api/analytics/conversations",{method:"GET"});if(!t.ok)return[];let e=await t.json();return e.ok&&Array.isArray(e.conversations)?e.conversations:[]}catch(t){return console.error("[Aura Analytics] Failed to fetch conversations:",t),[]}}async function vt(){try{let e=new URLSearchParams(window.location.search).get("conversationId")||"",n=e?`/api/analytics/session?id=${encodeURIComponent(e)}`:"/api/analytics/session",a=await window.sidecar.fetch(n,{method:"GET"});if(!a.ok)return null;let s=await a.json();return s.ok?s.data:null}catch(t){return console.error("[Aura Analytics] Failed to fetch active session:",t),null}}function Ot(){let t=new Date;return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}function jt(){let t=new Date(Date.now()-86400000);return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}function Gt(){let t=new Date,e=t.getDay(),n=t.getDate()-e+(e===0?-6:1),a=new Date(t.setDate(n));return a.getFullYear()+"-"+String(a.getMonth()+1).padStart(2,"0")+"-"+String(a.getDate()).padStart(2,"0")}function Wt(){let t=new Date;return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-01"}function yt(t){let e=new Date(Date.now()-t*86400000);return e.getFullYear()+"-"+String(e.getMonth()+1).padStart(2,"0")+"-"+String(e.getDate()).padStart(2,"0")}function Nt(t,e){let n=[],a=new Date(t+"T00:00:00"),s=new Date(e+"T00:00:00");if(isNaN(a.getTime())||isNaN(s.getTime())||a>s)return[t];while(a<=s){let c=a.getFullYear(),i=String(a.getMonth()+1).padStart(2,"0"),u=String(a.getDate()).padStart(2,"0");n.push(`${c}-${i}-${u}`),a.setDate(a.getDate()+1)}return n}function _t(t,e){let n=Ot(),a=jt();if(e==="session"&&O&&O.steps.length>0){let l=O;return{columns:l.steps.map((d)=>{let x=d.ctx||d.inTok+d.cacheRead;return{label:`#${d.idx+1}`,tooltipHeader:`Session Turn #${d.idx+1}`,inputTok:d.inTok,outTok:d.outTok,cacheRead:d.cacheRead,ctx:x,requests:1,subText:`Context: ${P(x)} · Speed: ${Math.round(d.stream>0?d.outTok/d.stream:0)} tok/s`}}),totalTokens:l.totalTokens,totalRequests:l.totalRequests,cacheEfficiency:l.cacheEfficiency,avgTtft:l.avgTtft,avgTokPerSec:l.avgTokPerSec}}if(e==="today"||e==="yesterday"){let l=e==="today"?n:a,p={};for(let E=0;E<24;E++){let r=String(E).padStart(2,"0"),M=`${l} ${r}:00`;p[M]={label:`${r}:00`,tooltipHeader:`${l} ${r}:00 - ${r}:59`,inputTok:0,outTok:0,cacheRead:0,requests:0}}for(let E of t.hourlySeries||[])if(E.hourKey&&E.hourKey.startsWith(l)){let r=E.hourKey.slice(0,16);if(p[r])p[r].inputTok+=E.inputTok,p[r].outTok+=E.outTok,p[r].cacheRead+=E.cacheRead,p[r].requests+=E.requests}let d=Object.values(p),x=0,C=0,h=0,o=0;for(let E of d)x+=E.inputTok,C+=E.outTok,h+=E.cacheRead,o+=E.requests;let g=x+C+h,R=x+h,S=R>0?h/R*100:t.cacheEfficiency;return{columns:d,totalTokens:{input:x,output:C,cacheRead:h,thinking:t.totalTokens.thinking,total:g},totalRequests:o,cacheEfficiency:S,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}let s="0000-00-00",c=n;if(e==="this-week"){s=Gt();let l=new Date(s+"T00:00:00");l.setDate(l.getDate()+6),c=l.getFullYear()+"-"+String(l.getMonth()+1).padStart(2,"0")+"-"+String(l.getDate()).padStart(2,"0")}else if(e==="this-month")s=Wt(),c=n;else if(e==="last-7-days")s=yt(6),c=n;else if(e==="last-30-days")s=yt(29),c=n;else if(e==="custom"){if(ot&&it)s=ot,c=it}let i={};for(let l of t.timeRangeSeries||[])if(l.date&&!l.date.startsWith("0001"))i[l.date]={inputTok:l.inputTok,outTok:l.outTok,cacheRead:l.cacheRead,requests:l.requests||1};let u=Nt(s,c),y=new Date(s+"T00:00:00").getTime(),v=new Date(c+"T00:00:00").getTime();if(Math.round((v-y)/86400000)>90){let l={};for(let S of u){let E=i[S]||{inputTok:0,outTok:0,cacheRead:0,requests:0},r=new Date(S+"T00:00:00"),M=Math.floor(r.getDate()/7)+1,I=`${S.slice(0,7)} W${M}`;if(!l[I])l[I]={label:I.slice(5),tooltipHeader:`Week of ${S}`,inputTok:0,outTok:0,cacheRead:0,requests:0};l[I].inputTok+=E.inputTok,l[I].outTok+=E.outTok,l[I].cacheRead+=E.cacheRead,l[I].requests+=E.requests}let p=Object.values(l),d=0,x=0,C=0,h=0;for(let S of p)d+=S.inputTok,x+=S.outTok,C+=S.cacheRead,h+=S.requests;let o=d+x+C,g=d+C,R=g>0?C/g*100:t.cacheEfficiency;return{columns:p,totalTokens:{input:d,output:x,cacheRead:C,thinking:t.totalTokens.thinking,total:o},totalRequests:h,cacheEfficiency:R,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}let A=u.map((l)=>{let p=i[l]||{inputTok:0,outTok:0,cacheRead:0,requests:0};return{label:Dt(l),tooltipHeader:qt(l),inputTok:p.inputTok,outTok:p.outTok,cacheRead:p.cacheRead,requests:p.requests}}),f=0,w=0,L=0,T=0;for(let l of A)f+=l.inputTok,w+=l.outTok,L+=l.cacheRead,T+=l.requests;let b=f+w+L,B=f+L,k=B>0?L/B*100:t.cacheEfficiency;return{columns:A,totalTokens:{input:f,output:w,cacheRead:L,thinking:t.totalTokens.thinking,total:b},totalRequests:T,cacheEfficiency:k,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}function zt(t){let e=document.getElementById("analytics-cards-grid");if(!e)return;let n=t.totalTokens.total,a=t.totalTokens.input,s=t.totalTokens.output,c=t.totalTokens.cacheRead,i=t.totalRequests;e.innerHTML=`
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
        <div class="kpi-value">${q(i)}</div>
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
  `}var ct="overview";function kt(t,e){let n=document.getElementById("analytics-activity-chart");if(!n)return;if(!t||t.length===0){n.innerHTML=`
      <div class="chart-header">
        <div class="chart-title">${e}</div>
      </div>
      <div class="chart-empty">No activity data recorded in the selected range</div>
    `;return}let a=rt==="session"&&!!O&&O.steps.length>0;if(a&&ct==="overview")Ut(n,O,e,t);else Kt(n,t,e,a)}function Tt(t,e,n){t.querySelectorAll("#session-view-segmented .segment-btn").forEach((s)=>{s.addEventListener("click",(c)=>{c.stopPropagation();let i=s.getAttribute("data-mode");if(i&&i!==ct)ct=i,kt(e,n)})})}function Ut(t,e,n,a){let s=e.steps,c=s.length;if(c===0)return;let i=Math.max(...s.map((h)=>h.ctx||h.inTok+h.cacheRead),1000),u=Math.pow(10,Math.floor(Math.log10(i))),y=i/u,v=u;if(y<=2)v=0.5*u;else if(y<=5)v=1*u;else v=2*u;let m=Math.ceil(i/(v*4))*(v*4)||v*4,A=[0,m*0.25,m*0.5,m*0.75,m],f=220,w=24,L=30,T=f-w-L,b="";A.forEach((h)=>{let o=w+T-h/m*T;b+=`
      <text x="40" y="${o+3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${P(h)}</text>
      <line x1="43" y1="${o}" x2="48" y2="${o}" stroke="var(--aura-border)" stroke-width="1" opacity="${h===0?"0.7":"0.3"}" />
    `});let B=590,k=B-10,l="";A.forEach((h)=>{let o=w+T-h/m*T;l+=`
      <line x1="0" y1="${o}" x2="${k}" y2="${o}" stroke="var(--aura-border)" stroke-width="1" opacity="${h===0?"0.6":"0.2"}" />
    `});let p=`M 0,${w+T}`,d="",x="",C=Math.max(1,Math.floor(c/6));s.forEach((h,o)=>{let g=h.ctx||h.inTok+h.cacheRead,R=c>1?o/(c-1)*k:0,S=w+T-g/m*T;if(o===0)p+=` L ${R.toFixed(1)},${S.toFixed(1)}`,d=`M ${R.toFixed(1)},${S.toFixed(1)}`;else p+=` L ${R.toFixed(1)},${S.toFixed(1)}`,d+=` L ${R.toFixed(1)},${S.toFixed(1)}`;if(o%C===0||o===c-1)x+=`
        <text x="${R.toFixed(1)}" y="${f-8}" text-anchor="${o===0?"start":o===c-1?"end":"middle"}" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#${o+1}</text>
      `}),p+=` L ${k},${w+T} Z`,t.innerHTML=`
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
        <svg viewBox="0 0 48 ${f}" class="y-axis-svg">
          ${b}
        </svg>
      </div>
      <div class="chart-viewport-wrapper">
        <div class="chart-stage" id="chart-stage-container">
          <svg viewBox="0 0 ${B} ${f}" preserveAspectRatio="none" class="analytics-svg" id="analytics-svg-element">
            <defs>
              <linearGradient id="aura-ctx-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#00A67E" stop-opacity="0.45" />
                <stop offset="65%" stop-color="#00A67E" stop-opacity="0.12" />
                <stop offset="100%" stop-color="#00A67E" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            ${l}
            <path d="${p}" fill="url(#aura-ctx-grad)" />
            <path d="${d}" fill="none" stroke="#00A67E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            ${x}
          </svg>
          <div class="chart-scrubber-line" id="chart-scrubber-line" style="display: none;"></div>
          <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
    </div>
  `,Tt(t,a,n),Yt(t,s)}function Yt(t,e){let n=t.querySelector("#chart-stage-container"),a=t.querySelector("#chart-scrubber-line"),s=t.querySelector("#chart-floating-tooltip");if(!n||!a||!s)return;n.addEventListener("mousemove",(c)=>{let i=n.getBoundingClientRect(),u=Math.max(0,Math.min(c.clientX-i.left,i.width)),y=i.width>0?u/i.width:0,v=Math.min(e.length-1,Math.max(0,Math.round(y*(e.length-1)))),m=e[v];if(!m)return;let A=m.ctx||m.inTok+m.cacheRead,f=Math.round(m.stream>0?m.outTok/m.stream:0);a.style.display="block",a.style.transform=`translateX(${u}px)`,s.innerHTML=`
      <div class="tooltip-header">Session Turn #${m.idx+1}</div>
      <div class="tooltip-row ctx-row">
        <span class="tooltip-dot" style="background: #3B82F6"></span>
        <span class="tooltip-label">Context Window</span>
        <span class="tooltip-val">${P(A)} (${q(A)})</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: #00A67E"></span>
        <span class="tooltip-label">Cache Read</span>
        <span class="tooltip-val">${q(m.cacheRead)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: #6366F1"></span>
        <span class="tooltip-label">Input Tokens</span>
        <span class="tooltip-val">${q(m.inTok)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
        <span class="tooltip-label">Output Tokens</span>
        <span class="tooltip-val">${q(m.outTok)}</span>
      </div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-subline">Speed: ${f} tok/s · TTFT: ${m.ttft.toFixed(2)}s</div>
    `,s.style.display="block";let w=s.offsetWidth||180,L=s.offsetHeight||135,T=0;if(u>i.width/2)T=u-w-16;else T=u+16;T=Math.max(8,Math.min(T,i.width-w-8));let b=10,B=i.height-L-12;if(B>10)b=Math.min(b,B);s.style.left=`${Math.round(T)}px`,s.style.top=`${Math.round(b)}px`}),n.addEventListener("mouseleave",()=>{a.style.display="none",s.style.display="none"})}function Kt(t,e,n,a){let s=Math.max(...e.map((r)=>r.inputTok+r.outTok+r.cacheRead),1000),c=Math.pow(10,Math.floor(Math.log10(s))),i=s/c,u=c;if(i<=2)u=0.5*c;else if(i<=5)u=1*c;else u=2*c;let y=Math.ceil(s/(u*4))*(u*4)||u*4,v=[0,y*0.25,y*0.5,y*0.75,y],m=e.length>40,A=m?10:Math.max(6,Math.floor(540/e.length)),f=m?Math.max(580,e.length*A+40):580,w=220,L=10,T=14,b=24,B=30,k=w-b-B,p=(f-L-T)/e.length,d=Math.max(3,Math.min(22,Math.floor(p*0.72))),x="";v.forEach((r)=>{let M=b+k-r/y*k;x+=`
      <text x="40" y="${M+3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${P(r)}</text>
      <line x1="43" y1="${M}" x2="48" y2="${M}" stroke="var(--aura-border)" stroke-width="1" opacity="${r===0?"0.7":"0.3"}" />
    `});let C="";v.forEach((r)=>{let M=b+k-r/y*k;C+=`
      <line x1="0" y1="${M}" x2="${f}" y2="${M}" stroke="var(--aura-border)" stroke-width="1" opacity="${r===0?"0.6":"0.2"}" />
    `});let h="<defs>",o="",g="",R=e.length===24&&(e[0]?.label.includes(":00")||!1),S=R?3:Math.max(1,Math.floor(e.length/8));e.forEach((r,M)=>{let I=L+M*p+(p-d)/2,tt=r.inputTok+r.outTok+r.cacheRead,U=L+M*p,et=I+d/2;if(tt>0){let dt=Math.max(3,Math.round(tt/y*k)),Y=r.outTok>0?Math.max(1,Math.round(r.outTok/y*k)):0,K=r.inputTok>0?Math.max(1,Math.round(r.inputTok/y*k)):0,_=r.cacheRead>0?Math.max(1,dt-Y-K):0;if(_<0)_=0;let at=b+k,ut=at-_,mt=ut-K,nt=mt-Y,X=nt,j=Math.min(3.5,d/2,dt);h+=`
        <clipPath id="col-clip-${M}">
          <path d="M ${I} ${at} L ${I} ${X+j} A ${j} ${j} 0 0 1 ${I+j} ${X} L ${I+d-j} ${X} A ${j} ${j} 0 0 1 ${I+d} ${X+j} L ${I+d} ${at} Z" />
        </clipPath>
      `,o+=`
        <g class="chart-column-group" 
           data-header="${r.tooltipHeader}" 
           data-in="${q(r.inputTok)}" 
           data-out="${q(r.outTok)}" 
           data-cache="${q(r.cacheRead)}"
           data-total="${q(tt)}"
           data-ctx="${r.ctx?P(r.ctx)+" ("+q(r.ctx)+")":""}"
           data-reqs="${q(r.requests||1)}"
           data-subtext="${r.subText||""}"
           data-center-x="${et}"
           data-slot-x="${U}"
           data-slot-w="${p}"
           data-top-y="${nt}"
           data-idx="${M}">
          
          <rect class="bar-bg-band" x="${U}" y="${b}" width="${p}" height="${k}" rx="4" />
          
          <g clip-path="url(#col-clip-${M})">
            ${_>0?`<rect class="bar-segment bar-cache" x="${I}" y="${ut}" width="${d}" height="${_}" fill="#00A67E" />`:""}
            ${K>0?`<rect class="bar-segment bar-in" x="${I}" y="${mt}" width="${d}" height="${K}" fill="#6366F1" opacity="0.85" />`:""}
            ${Y>0?`<rect class="bar-segment bar-out" x="${I}" y="${nt}" width="${d}" height="${Y}" fill="var(--aura-primary)" />`:""}
          </g>
        </g>
      `}else o+=`
        <g class="chart-column-group" 
           data-header="${r.tooltipHeader}" 
           data-in="0" 
           data-out="0" 
           data-cache="0"
           data-total="0"
           data-ctx="${r.ctx?P(r.ctx)+" ("+q(r.ctx)+")":""}"
           data-reqs="0"
           data-subtext="${r.subText||""}"
           data-center-x="${et}"
           data-slot-x="${U}"
           data-slot-w="${p}"
           data-top-y="${b+k}"
           data-idx="${M}">
          
          <rect class="bar-bg-band" x="${U}" y="${b}" width="${p}" height="${k}" rx="4" />
        </g>
      `;if(R?M%3===0:M%S===0||M===e.length-1&&(e.length-1)%S>=Math.floor(S/2))g+=`
        <text x="${et}" y="${w-8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${r.label}</text>
      `}),h+="</defs>";let E=a?`
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
        ${E}
        <div class="chart-legend">
          <span class="legend-item"><span class="legend-dot" style="background: var(--aura-primary)"></span>Output Tokens</span>
          <span class="legend-item"><span class="legend-dot" style="background: #6366F1"></span>Input Tokens</span>
          <span class="legend-item"><span class="legend-dot" style="background: #00A67E"></span>Cache Read</span>
        </div>
      </div>
    </div>
    <div class="chart-layout-root">
      <div class="chart-y-axis-sticky">
        <svg viewBox="0 0 48 ${w}" class="y-axis-svg">
          ${x}
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
          <svg viewBox="0 0 ${f} ${w}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="analytics-svg-element" style="${m?`min-width: ${f}px;`:""}">
            ${h}
            ${C}
            ${o}
            ${g}
          </svg>
          <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
    </div>
  `,a)Tt(t,e,n);if(m)setTimeout(()=>{let r=t.querySelector("#chart-stage-container"),M=t.querySelector("#chart-mask-left"),I=t.querySelector("#chart-mask-right");if(r){if(r.scrollLeft=r.scrollWidth,M&&I)Xt(r,M,I)}},50);Jt(t,f)}function Xt(t,e,n){function a(){let s=t.scrollWidth-t.clientWidth;if(s<=0){e.style.opacity="0",n.style.opacity="0";return}e.style.opacity=t.scrollLeft>14?"1":"0",n.style.opacity=s-t.scrollLeft>14?"1":"0"}t.addEventListener("scroll",a,{passive:!0}),a()}function Jt(t,e){let n=t.querySelector("#chart-floating-tooltip"),a=t.querySelector("#chart-stage-container"),s=t.querySelectorAll(".chart-column-group");if(!n||!a)return;s.forEach((c)=>{c.addEventListener("mouseenter",()=>{let i=c,u=i.getAttribute("data-header")||"",y=i.getAttribute("data-in")||"0",v=i.getAttribute("data-out")||"0",m=i.getAttribute("data-cache")||"0",A=i.getAttribute("data-total")||"0",f=i.getAttribute("data-ctx")||"",w=i.getAttribute("data-reqs")||"0",L=i.getAttribute("data-subtext")||"",T=f?`
        <div class="tooltip-row ctx-row">
          <span class="tooltip-dot" style="background: #3B82F6"></span>
          <span class="tooltip-label">Context Window</span>
          <span class="tooltip-val">${f}</span>
        </div>
      `:"";n.innerHTML=`
        <div class="tooltip-header">${u}</div>
        ${T}
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
          <span class="tooltip-label">Output Tokens</span>
          <span class="tooltip-val">${v}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #6366F1"></span>
          <span class="tooltip-label">Input Tokens</span>
          <span class="tooltip-val">${y}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #00A67E"></span>
          <span class="tooltip-label">Cache Read</span>
          <span class="tooltip-val">${m}</span>
        </div>
        <div class="tooltip-divider"></div>
        <div class="tooltip-row total-row">
          <span class="tooltip-label">Total Tokens</span>
          <span class="tooltip-val">${A}</span>
        </div>
        <div class="tooltip-subline">${w} generation requests${L?" · "+L:""}</div>
      `,n.style.display="block";let b=a.getBoundingClientRect(),k=(i.querySelector(".bar-bg-band")||i).getBoundingClientRect(),l=k.left-b.left+a.scrollLeft,p=k.right-b.left+a.scrollLeft,d=n.offsetWidth||180,x=n.offsetHeight||135,C=a.scrollLeft,h=a.scrollLeft+b.width,o=h-(p+12),g=l-12-C,R=0;if(o>=d+6&&(o>=g||g<d))R=p+12;else if(g>=d+6)R=l-d-12;else if(o>=g)R=Math.max(p+4,h-d-6);else R=Math.min(l-d-4,C+6);let S=10,E=b.height-x-12;if(E>10)S=Math.min(S,E);n.style.left=`${Math.round(R)}px`,n.style.top=`${Math.round(S)}px`}),c.addEventListener("mouseleave",()=>{n.style.display="none"})})}function Zt(t){let e=document.getElementById("analytics-projects-list");if(!e)return;if(!t||t.length===0){e.innerHTML='<div class="chart-empty">No workspace activity recorded</div>';return}let n=Math.max(...t.map((s)=>s.tokenCount),1),a=t.map((s)=>{let c=Math.max(4,Math.round(s.tokenCount/n*100)),i=s.projectId.split("/").filter(Boolean).pop()||s.projectId;return`
      <div class="project-stat-row">
        <div class="project-meta">
          <div class="project-name" title="${s.projectId}">${i}</div>
          <div class="project-counts">${s.conversationCount} sessions · ${P(s.tokenCount)} tokens</div>
        </div>
        <div class="project-bar-track">
          <div class="project-bar-fill" style="width: ${c}%"></div>
        </div>
      </div>
    `}).join("");e.innerHTML=a}function Qt(t){let e=document.getElementById("analytics-sessions-tbody");if(!e)return;if(!t||t.length===0){e.innerHTML='<tr><td colspan="4" class="empty-cell">No recent conversation sessions detected</td></tr>';return}let n=t.slice(0,15).map((a)=>{let s=a.title||"Untitled Session",c="Default";if(a.workspaceUris)try{let u=JSON.parse(a.workspaceUris);if(Array.isArray(u)&&u.length>0){let y=u[0].replace(/^file:\/\//,"").split("/").filter(Boolean).pop();if(y)c=decodeURIComponent(y)}}catch{}else if(a.projectId)c=a.projectId.split("/").filter(Boolean).pop()||a.projectId;let i=Ht(a.lastModifiedTime);return`
      <tr class="session-row">
        <td class="session-title-cell" title="${s}">${s}</td>
        <td class="session-project-cell"><span class="project-pill" title="${a.workspaceUris||a.projectId}">${c}</span></td>
        <td class="session-steps-cell">${a.stepCount} steps</td>
        <td class="session-time-cell">${i}</td>
      </tr>
    `}).join("");e.innerHTML=n}function Vt(t){switch(t){case"session":return"Active Session";case"today":return"Today";case"yesterday":return"Yesterday";case"this-week":return"This Week";case"this-month":return"This Month";case"last-7-days":return"Last 7 Days";case"last-30-days":return"Last 30 Days";case"custom":return"Custom Range";default:return"Overview"}}async function lt(t){rt=t;let e=document.getElementById("analytics-timerange-segmented");if(e)e.querySelectorAll(".segment-btn").forEach((a)=>{if(a.getAttribute("data-range")===t)a.classList.add("active");else a.classList.remove("active")});let n=document.getElementById("custom-range-inputs");if(n)n.style.display=t==="custom"?"flex":"none";if(t==="session"){if(!O)O=await vt()}if(z){let a=_t(z,t);zt(a),kt(a.columns,Vt(t))}}async function J(){let t=document.getElementById("btn-refresh-analytics");if(t)t.classList.add("loading");let[e,n,a]=await Promise.all([Pt(),Ft(),vt()]);if(e)z=e;if(a)O=a;if(z)await lt(rt),Zt(z.topProjects);if(n)Qt(n);if(t)setTimeout(()=>t.classList.remove("loading"),300)}function bt(){let t=document.getElementById("analytics-timerange-segmented");if(t)t.querySelectorAll(".segment-btn").forEach((s)=>{s.addEventListener("click",()=>{let c=s.getAttribute("data-range");if(c)lt(c)})});let e=document.getElementById("custom-date-start"),n=document.getElementById("custom-date-end");document.getElementById("btn-apply-custom-range")?.addEventListener("click",()=>{if(e?.value&&n?.value)ot=e.value,it=n.value,lt("custom")})}var D=null,Z=[];function N(t){let e=document.getElementById("toast");if(!e)return;e.textContent=t,e.classList.add("show"),setTimeout(()=>e.classList.remove("show"),2000)}async function H(t){try{let e=await window.sidecar.fetch("/api/config",{method:"POST",body:JSON.stringify(t)});if(e.ok)D=(await e.json()).config,N("Configuration applied in real-time");else N("Save failed")}catch(e){console.error("saveConfig failed:",e),N("Network error")}}function F(t,e){let n=document.getElementById(t);if(!n)return;n.querySelectorAll(".segment-btn").forEach((a)=>{if(a.getAttribute("data-val")===String(e))a.classList.add("active");else a.classList.remove("active")})}function Q(t,e,n,a){let s=document.getElementById(t);if(!s)return;s.innerHTML="";let c=document.createElement("option");c.value="default",c.textContent=e,s.appendChild(c);let i=document.createElement("optgroup");i.label="System Installed Fonts";for(let y of n){let v=document.createElement("option");v.value=y,v.textContent=y,i.appendChild(v)}s.appendChild(i);let u=document.createElement("option");if(u.value="custom",u.textContent="Custom font name...",s.appendChild(u),!a||a==="default")s.value="default";else if(n.includes(a))s.value=a;else s.value="custom"}async function Et(){try{let t=await window.sidecar.fetch("/api/system-fonts",{method:"GET"});if(t.ok){let e=await t.json();if(Array.isArray(e.fonts))Z=e.fonts}}catch(t){console.error("loadSystemFonts failed:",t)}}async function $t(){try{let t=await window.sidecar.fetch("/api/config",{method:"GET"});if(!t.ok)return;let{config:e}=await t.json();D=e;let n=document.getElementById("select-language");if(n)n.value=e.language||"default";let a=e.presets?.light||"high-contrast",s=e.presets?.dark||"claude-dark";F("preset-light-segmented",a),F("preset-dark-segmented",s);let c=document.getElementById("toggle-wax-seal");if(c)c.checked=e.composer?.waxSeal!==!1;let i=e.typography||{};Q("select-font-sans-primary","Default",Z,i.primarySans),Q("select-font-sans-fallback","Default",Z,i.fallbackSans),Q("select-font-mono","Default",Z,i.mono);let u=document.getElementById("select-font-sans-primary"),y=document.getElementById("row-custom-sans-primary"),v=document.getElementById("input-custom-sans-primary");if(u&&y){if(y.style.display=u.value==="custom"?"flex":"none",v)v.value=i.customPrimarySans||""}let m=document.getElementById("select-font-sans-fallback"),A=document.getElementById("row-custom-sans-fallback"),f=document.getElementById("input-custom-sans-fallback");if(m&&A){if(A.style.display=m.value==="custom"?"flex":"none",f)f.value=i.customFallbackSans||""}let w=document.getElementById("select-font-mono"),L=document.getElementById("row-custom-mono"),T=document.getElementById("input-custom-mono");if(w&&L){if(L.style.display=w.value==="custom"?"flex":"none",T)T.value=i.customMono||""}F("font-size-segmented",i.fontSize||16);let b=e.composer?.collinear!==!1?"collinear":"native";F("composer-align-segmented",b);let B=document.getElementById("toggle-hide-arrows");if(B)B.checked=e.composer?.hideArrows!==!1;let k=document.getElementById("toggle-metrics");if(k)k.checked=e.telemetry?.enabled!==!1;F("metrics-interval-segmented",e.telemetry?.interval||2000)}catch(t){console.error("loadConfig failed:",t)}}async function V(){try{let t=await window.sidecar.fetch("/api/status",{method:"GET"});if(!t.ok)return;let e=await t.json(),n=document.getElementById("status-dot"),a=document.getElementById("status-text"),s=document.getElementById("status-sublabel");if(e.connected){if(n)n.classList.remove("disconnected");if(a)a.textContent="Connected";if(s)s.textContent=`Connected to host (${e.targetCount||1} window(s) · port ${e.cdpPort||"-"})`}else{if(n)n.classList.add("disconnected");if(a)a.textContent="Searching window...";if(s)s.textContent="Detecting Antigravity CDP port..."}}catch(t){console.error("updateStatus failed:",t)}}async function wt(){ht(),G(),await Et(),await $t(),V(),setInterval(V,3000);let t=document.getElementById("select-language");if(t)t.addEventListener("change",()=>{H({language:t.value})});let e=document.getElementById("preset-light-segmented");if(e)e.querySelectorAll(".segment-btn").forEach((o)=>{o.addEventListener("click",()=>{let g=o.getAttribute("data-val")||"high-contrast";F("preset-light-segmented",g),H({presets:{...D?.presets,light:g}})})});let n=document.getElementById("preset-dark-segmented");if(n)n.querySelectorAll(".segment-btn").forEach((o)=>{o.addEventListener("click",()=>{let g=o.getAttribute("data-val")||"claude-dark";F("preset-dark-segmented",g),H({presets:{...D?.presets,dark:g}})})});let a=document.getElementById("toggle-wax-seal");if(a)a.addEventListener("change",()=>{H({composer:{...D?.composer,waxSeal:a.checked}})});let s=document.getElementById("select-font-sans-primary"),c=document.getElementById("row-custom-sans-primary"),i=document.getElementById("input-custom-sans-primary");if(s)s.addEventListener("change",()=>{let o=s.value==="custom";if(c)c.style.display=o?"flex":"none";if(!o)H({typography:{...D?.typography,primarySans:s.value}});else if(i)i.focus()});if(i){let o=()=>{if(s&&s.value==="custom")H({typography:{...D?.typography,primarySans:"custom",customPrimarySans:i.value.trim()}})};i.addEventListener("change",o),i.addEventListener("keydown",(g)=>{if(g.key==="Enter")o(),i.blur()})}let u=document.getElementById("select-font-sans-fallback"),y=document.getElementById("row-custom-sans-fallback"),v=document.getElementById("input-custom-sans-fallback");if(u)u.addEventListener("change",()=>{let o=u.value==="custom";if(y)y.style.display=o?"flex":"none";if(!o)H({typography:{...D?.typography,fallbackSans:u.value}});else if(v)v.focus()});if(v){let o=()=>{if(u&&u.value==="custom")H({typography:{...D?.typography,fallbackSans:"custom",customFallbackSans:v.value.trim()}})};v.addEventListener("change",o),v.addEventListener("keydown",(g)=>{if(g.key==="Enter")o(),v.blur()})}let m=document.getElementById("select-font-mono"),A=document.getElementById("row-custom-mono"),f=document.getElementById("input-custom-mono");if(m)m.addEventListener("change",()=>{let o=m.value==="custom";if(A)A.style.display=o?"flex":"none";if(!o)H({typography:{...D?.typography,mono:m.value}});else if(f)f.focus()});if(f){let o=()=>{if(m&&m.value==="custom")H({typography:{...D?.typography,mono:"custom",customMono:f.value.trim()}})};f.addEventListener("change",o),f.addEventListener("keydown",(g)=>{if(g.key==="Enter")o(),f.blur()})}let w=document.getElementById("font-size-segmented");if(w)w.querySelectorAll(".segment-btn").forEach((o)=>{o.addEventListener("click",()=>{let g=Number(o.getAttribute("data-val"));F("font-size-segmented",g),H({typography:{...D?.typography,fontSize:g}})})});let L=document.getElementById("composer-align-segmented");if(L)L.querySelectorAll(".segment-btn").forEach((o)=>{o.addEventListener("click",()=>{let g=o.getAttribute("data-val");F("composer-align-segmented",g||"collinear"),H({composer:{...D?.composer,collinear:g==="collinear"}})})});let T=document.getElementById("toggle-hide-arrows");if(T)T.addEventListener("change",()=>{H({composer:{...D?.composer,hideArrows:T.checked}})});let b=document.getElementById("toggle-metrics");if(b)b.addEventListener("change",()=>{H({telemetry:{...D?.telemetry,enabled:b.checked}})});let B=document.getElementById("metrics-interval-segmented");if(B)B.querySelectorAll(".segment-btn").forEach((o)=>{o.addEventListener("click",()=>{let g=Number(o.getAttribute("data-val"));F("metrics-interval-segmented",g),H({telemetry:{...D?.telemetry,interval:g}})})});let k=document.getElementById("btn-force-reload");if(k)k.addEventListener("click",async()=>{k.disabled=!0,k.style.opacity="0.6";try{if((await window.sidecar.fetch("/api/reload",{method:"POST"})).ok)N("Styles recompiled and re-applied"),await V();else N("Reload failed")}catch(o){N("Request error")}finally{k.disabled=!1,k.style.opacity="1"}});let l=document.getElementById("tab-nav-analytics"),p=document.getElementById("tab-nav-settings"),d=document.getElementById("view-analytics"),x=document.getElementById("view-settings"),C=(o)=>{if(o==="analytics"){if(l?.classList.add("active"),p?.classList.remove("active"),d)d.style.display="block";if(x)x.style.display="none";J()}else{if(p?.classList.add("active"),l?.classList.remove("active"),x)x.style.display="block";if(d)d.style.display="none"}};l?.addEventListener("click",()=>C("analytics")),p?.addEventListener("click",()=>C("settings")),document.getElementById("btn-refresh-analytics")?.addEventListener("click",()=>J()),bt(),J()}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wt);else wt();})();

//# debugId=B1BC889BD453B33D64756E2164756E21
