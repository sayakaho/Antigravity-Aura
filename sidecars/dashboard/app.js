(()=>{var{defineProperty:dt,getOwnPropertyNames:jt,getOwnPropertyDescriptor:Gt}=Object,Wt=Object.prototype.hasOwnProperty;function Nt(t){return this[t]}var _t=(t)=>{var e=(vt??=new WeakMap).get(t),n;if(e)return e;if(e=dt({},"__esModule",{value:!0}),t&&typeof t==="object"||typeof t==="function"){for(var a of jt(t))if(!Wt.call(e,a))dt(e,a,{get:Nt.bind(t,a),enumerable:!(n=Gt(t,a))||n.enumerable})}return vt.set(t,e),e},vt;var zt=(t)=>t;function Yt(t,e){this[t]=zt.bind(null,e)}var Xt=(t,e)=>{for(var n in e)dt(t,n,{get:e[n],enumerable:!0,configurable:!0,set:Yt.bind(e,n)})};var ie={};Xt(ie,{loadConfig:()=>Ot,loadSystemFonts:()=>qt,populateFontSelect:()=>ot,saveConfig:()=>q,showToast:()=>U,updateSegmentedUI:()=>W,updateStatus:()=>it});var X=null;function kt(t,e,n){let a=(s)=>{let r=s/255;return r<=0.03928?r/12.92:Math.pow((r+0.055)/1.055,2.4)};return 0.2126*a(t)+0.7152*a(e)+0.0722*a(n)}function Tt(t){if(!t)return null;let e=t.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);if(e)return{r:parseInt(e[1],10),g:parseInt(e[2],10),b:parseInt(e[3],10),alpha:e[4]!==void 0?parseFloat(e[4]):1};return null}function Ut(){if(X==="light"||X==="dark")return X;let t=document.documentElement.style.colorScheme;if(t==="light"||t==="dark")return t;let e=document.createElement("div");e.setAttribute("aria-hidden","true"),e.style.cssText="position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;background-color:var(--background, var(--vscode-editor-background, transparent))",(document.body||document.documentElement).appendChild(e);try{let n=window.getComputedStyle(e).backgroundColor,a=Tt(n);if(a&&a.alpha>0)return kt(a.r,a.g,a.b)>0.179?"light":"dark"}catch(n){}finally{e.remove()}if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)return"dark";return"light"}function Y(t){let e=t||Ut(),n=document.documentElement;if(n.getAttribute("data-theme")!==e)n.setAttribute("data-theme",e);if(n.style.colorScheme!==e)n.style.colorScheme=e}function bt(){if(window.addEventListener("message",(t)=>{if(t.data?.type==="ag-theme-sync"){let e=t.data.payload||{};if(e.scheme==="light"||e.scheme==="dark")X=e.scheme,Y(X)}else if(t.data?.type==="theme-change"){let e=t.data?.payload?.cssVariables;if(e&&typeof e["--background"]==="string"){let n=Tt(e["--background"]);if(n)X=kt(n.r,n.g,n.b)>0.179?"light":"dark"}Y(X||void 0)}}),window.matchMedia){let t=window.matchMedia("(prefers-color-scheme: dark)"),e=()=>Y();if(typeof t.addEventListener==="function")t.addEventListener("change",e);else if(typeof t.addListener==="function")t.addListener(e)}if(typeof MutationObserver<"u")new MutationObserver(()=>{Y()}).observe(document.documentElement,{attributes:!0,attributeFilter:["style","data-theme"]});Y()}function H(t){if(!t||t<=0)return"0";if(t>=1e9)return(t/1e9).toFixed(2)+"B";if(t>=1e6)return(t/1e6).toFixed(1)+"M";if(t>=1e4)return Math.round(t/1000)+"k";if(t>=1000)return(t/1000).toFixed(1)+"k";return String(Math.round(t))}function P(t){return(t||0).toLocaleString("en-US")}function wt(t){if(!t||t.length<10)return t;try{return new Date(t+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}catch{return t.slice(5)}}function Et(t){if(!t||t.length<10)return t;try{return new Date(t+"T00:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}catch{return t}}var N=null,Z="last-30-days",Q="",V="",j=null;async function Kt(){try{let t=await window.sidecar.fetch("/api/analytics/overview",{method:"GET"});if(!t.ok)return null;let e=await t.json();return e.ok?e.data:null}catch(t){return console.error("[Aura Analytics] Failed to fetch overview:",t),null}}async function St(){try{let e=new URLSearchParams(window.location.search).get("conversationId")||"",n=e?`/api/analytics/session?id=${encodeURIComponent(e)}`:"/api/analytics/session",a=await window.sidecar.fetch(n,{method:"GET"});if(!a.ok)return null;let s=await a.json();return s.ok?s.data:null}catch(t){return console.error("[Aura Analytics] Failed to fetch active session:",t),null}}function ht(){let t=new Date;return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}function Mt(){let t=new Date(Date.now()-86400000);return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}function Lt(){let t=new Date,e=t.getDay(),n=t.getDate()-e+(e===0?-6:1),a=new Date(t.setDate(n));return a.getFullYear()+"-"+String(a.getMonth()+1).padStart(2,"0")+"-"+String(a.getDate()).padStart(2,"0")}function Rt(){let t=new Date;return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-01"}function K(t){let e=new Date(Date.now()-t*86400000);return e.getFullYear()+"-"+String(e.getMonth()+1).padStart(2,"0")+"-"+String(e.getDate()).padStart(2,"0")}function z(t,e){let n=[],a=new Date(t+"T00:00:00"),s=new Date(e+"T00:00:00");if(isNaN(a.getTime())||isNaN(s.getTime())||a>s)return[t];while(a<=s){let r=a.getFullYear(),o=String(a.getMonth()+1).padStart(2,"0"),c=String(a.getDate()).padStart(2,"0");n.push(`${r}-${o}-${c}`),a.setDate(a.getDate()+1)}return n}function Jt(t,e){let n=ht(),a=Mt();if(e==="session"&&j&&j.steps.length>0){let h=j;return{columns:h.steps.map((k)=>{let C=k.ctx||k.inTok+k.cacheRead;return{label:`#${k.idx+1}`,tooltipHeader:`Session Turn #${k.idx+1}`,inputTok:k.inTok,outTok:k.outTok,cacheRead:k.cacheRead,ctx:C,requests:1,subText:`Context: ${H(C)} · Speed: ${Math.round(k.stream>0?k.outTok/k.stream:0)} tok/s`}}),totalTokens:h.totalTokens,totalRequests:h.totalRequests,cacheEfficiency:h.cacheEfficiency,avgTtft:h.avgTtft,avgTokPerSec:h.avgTokPerSec}}if(e==="today"||e==="yesterday"){let h=e==="today"?n:a,b={};for(let l=0;l<24;l++){let v=String(l).padStart(2,"0"),u=`${h} ${v}:00`;b[u]={label:`${v}:00`,tooltipHeader:`${h} ${v}:00 - ${v}:59`,inputTok:0,outTok:0,cacheRead:0,requests:0}}for(let l of t.hourlySeries||[])if(l.hourKey&&l.hourKey.startsWith(h)){let v=l.hourKey.slice(0,16);if(b[v])b[v].inputTok+=l.inputTok,b[v].outTok+=l.outTok,b[v].cacheRead+=l.cacheRead,b[v].requests+=l.requests}let k=Object.values(b),C=0,B=0,D=0,m=0;for(let l of k)C+=l.inputTok,B+=l.outTok,D+=l.cacheRead,m+=l.requests;let g=C+B+D,f=C+D,T=f>0?D/f*100:t.cacheEfficiency;return{columns:k,totalTokens:{input:C,output:B,cacheRead:D,thinking:t.totalTokens.thinking,total:g},totalRequests:m,cacheEfficiency:T,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}let s="0000-00-00",r=n;if(e==="this-week"){s=Lt();let h=new Date(s+"T00:00:00");h.setDate(h.getDate()+6),r=h.getFullYear()+"-"+String(h.getMonth()+1).padStart(2,"0")+"-"+String(h.getDate()).padStart(2,"0")}else if(e==="this-month")s=Rt(),r=n;else if(e==="last-7-days")s=K(6),r=n;else if(e==="last-30-days")s=K(29),r=n;else if(e==="custom"){if(Q&&V)s=Q,r=V}let o={};for(let h of t.timeRangeSeries||[])if(h.date&&!h.date.startsWith("0001"))o[h.date]={inputTok:h.inputTok,outTok:h.outTok,cacheRead:h.cacheRead,requests:h.requests||1};let c=z(s,r),d=new Date(s+"T00:00:00").getTime(),p=new Date(r+"T00:00:00").getTime();if(Math.round((p-d)/86400000)>90){let h={};for(let T of c){let l=o[T]||{inputTok:0,outTok:0,cacheRead:0,requests:0},v=new Date(T+"T00:00:00"),u=Math.floor(v.getDate()/7)+1,y=`${T.slice(0,7)} W${u}`;if(!h[y])h[y]={label:y.slice(5),tooltipHeader:`Week of ${T}`,inputTok:0,outTok:0,cacheRead:0,requests:0};h[y].inputTok+=l.inputTok,h[y].outTok+=l.outTok,h[y].cacheRead+=l.cacheRead,h[y].requests+=l.requests}let b=Object.values(h),k=0,C=0,B=0,D=0;for(let T of b)k+=T.inputTok,C+=T.outTok,B+=T.cacheRead,D+=T.requests;let m=k+C+B,g=k+B,f=g>0?B/g*100:t.cacheEfficiency;return{columns:b,totalTokens:{input:k,output:C,cacheRead:B,thinking:t.totalTokens.thinking,total:m},totalRequests:D,cacheEfficiency:f,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}let w=c.map((h)=>{let b=o[h]||{inputTok:0,outTok:0,cacheRead:0,requests:0};return{label:wt(h),tooltipHeader:Et(h),inputTok:b.inputTok,outTok:b.outTok,cacheRead:b.cacheRead,requests:b.requests}}),x=0,E=0,A=0,S=0;for(let h of w)x+=h.inputTok,E+=h.outTok,A+=h.cacheRead,S+=h.requests;let M=x+E+A,R=x+A,L=R>0?A/R*100:t.cacheEfficiency;return{columns:w,totalTokens:{input:x,output:E,cacheRead:A,thinking:t.totalTokens.thinking,total:M},totalRequests:S,cacheEfficiency:L,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}function Zt(t){let e=document.getElementById("analytics-cards-grid");if(!e)return;let n=t.totalTokens.total,a=t.totalTokens.input,s=t.totalTokens.output,r=t.totalTokens.cacheRead,o=t.totalRequests;e.innerHTML=`
    <!-- Row 1: Primary Metrics -->
    <div class="kpi-grid-primary">
      <div class="kpi-card kpi-card-featured">
        <div class="kpi-label">Total Tokens Processed</div>
        <div class="kpi-value">${H(n)}</div>
        <div class="kpi-breakdown">
          <span class="kpi-tag tag-cached">Cache: ${H(r)}</span>
          <span class="kpi-tag tag-input">In: ${H(a)}</span>
          <span class="kpi-tag tag-output">Out: ${H(s)}</span>
        </div>
      </div>

      <div class="kpi-card kpi-card-featured">
        <div class="kpi-label">Total Requests</div>
        <div class="kpi-value">${P(o)}</div>
        <div class="kpi-subtext">Completed model inferences for the selected range</div>
      </div>
    </div>

    <!-- Row 2: Secondary Performance Metrics -->
    <div class="kpi-grid-secondary">
      <div class="kpi-card">
        <div class="kpi-label">Cache Cost Efficiency</div>
        <div class="kpi-value">${t.cacheEfficiency.toFixed(1)}%</div>
        <div class="kpi-subtext">Prompt caching saved ~${H(r)} tokens from reprocessing</div>
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
  `}var ut="overview";function Ct(t,e){let n=document.getElementById("analytics-activity-chart");if(!n)return;if(!t||t.length===0){n.innerHTML=`
      <div class="chart-header">
        <div class="chart-title">${e}</div>
      </div>
      <div class="chart-empty">No activity data recorded in the selected range</div>
    `;return}let a=Z==="session"&&!!j&&j.steps.length>0;if(a&&ut==="overview")Qt(n,j,e,t);else te(n,t,e,a)}function At(t,e,n){t.querySelectorAll("#session-view-segmented .segment-btn").forEach((s)=>{s.addEventListener("click",(r)=>{r.stopPropagation();let o=s.getAttribute("data-mode");if(o&&o!==ut)ut=o,Ct(e,n)})})}function Qt(t,e,n,a){let s=e.steps,r=s.length;if(r===0)return;let o=Math.max(...s.map((g)=>g.ctx||g.inTok+g.cacheRead),1000),c=Math.pow(10,Math.floor(Math.log10(o))),d=o/c,p=c;if(d<=2)p=0.5*c;else if(d<=5)p=1*c;else p=2*c;let i=Math.ceil(o/(p*4))*(p*4)||p*4,w=[0,i*0.25,i*0.5,i*0.75,i],x=220,E=24,A=30,S=x-E-A,M="";w.forEach((g)=>{let f=E+S-g/i*S;M+=`
      <text x="40" y="${f+3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${H(g)}</text>
      <line x1="43" y1="${f}" x2="48" y2="${f}" stroke="var(--aura-border)" stroke-width="1" opacity="${g===0?"0.7":"0.3"}" />
    `});let R=600,L=14,h=28,b=R-L-h,k="";w.forEach((g)=>{let f=E+S-g/i*S;k+=`
      <line x1="${L}" y1="${f}" x2="${L+b}" y2="${f}" stroke="var(--aura-border)" stroke-width="1" opacity="${g===0?"0.6":"0.2"}" />
    `});let C=`M ${L},${E+S}`,B="",D="",m=Math.max(1,Math.floor(r/6));s.forEach((g,f)=>{let T=g.ctx||g.inTok+g.cacheRead,l=L+(r>1?f/(r-1)*b:0),v=E+S-T/i*S;if(f===0)C+=` L ${l.toFixed(1)},${v.toFixed(1)}`,B=`M ${l.toFixed(1)},${v.toFixed(1)}`;else C+=` L ${l.toFixed(1)},${v.toFixed(1)}`,B+=` L ${l.toFixed(1)},${v.toFixed(1)}`;let u=r-1-f<m*0.45;if(f%m===0&&!u){let y=f===0?"start":f===r-1||l>L+b-20?"end":"middle";D+=`
        <text x="${l.toFixed(1)}" y="${x-8}" text-anchor="${y}" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#${f+1}</text>
      `}}),C+=` L ${L+b},${E+S} Z`,t.innerHTML=`
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
        <svg viewBox="0 0 48 ${x}" class="y-axis-svg">
          ${M}
        </svg>
      </div>
      <div class="chart-viewport-wrapper">
        <div class="chart-stage" id="chart-stage-container">
          <svg viewBox="0 0 ${R} ${x}" preserveAspectRatio="none" class="analytics-svg" id="analytics-svg-element">
            <defs>
              <linearGradient id="aura-ctx-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#00A67E" stop-opacity="0.45" />
                <stop offset="65%" stop-color="#00A67E" stop-opacity="0.12" />
                <stop offset="100%" stop-color="#00A67E" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            ${k}
            <path d="${C}" fill="url(#aura-ctx-grad)" />
            <path d="${B}" fill="none" stroke="#00A67E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            ${D}
          </svg>
          <div class="chart-scrubber-line" id="chart-scrubber-line" style="display: none;"></div>
          <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
    </div>
  `,At(t,a,n),Vt(t,s)}function Vt(t,e){let n=t.querySelector("#chart-stage-container"),a=t.querySelector("#chart-scrubber-line"),s=t.querySelector("#chart-floating-tooltip");if(!n||!a||!s)return;n.addEventListener("mousemove",(r)=>{let o=n.getBoundingClientRect(),c=Math.max(0,Math.min(r.clientX-o.left,o.width)),d=o.width>0?c/o.width:0,p=Math.min(e.length-1,Math.max(0,Math.round(d*(e.length-1)))),i=e[p];if(!i)return;let w=i.ctx||i.inTok+i.cacheRead,x=Math.round(i.stream>0?i.outTok/i.stream:0);a.style.display="block",a.style.transform=`translateX(${c}px)`,s.innerHTML=`
      <div class="tooltip-header">Session Turn #${i.idx+1}</div>
      <div class="tooltip-row ctx-row">
        <span class="tooltip-dot" style="background: #3B82F6"></span>
        <span class="tooltip-label">Context Window</span>
        <span class="tooltip-val">${H(w)} (${P(w)})</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: #00A67E"></span>
        <span class="tooltip-label">Cache Read</span>
        <span class="tooltip-val">${P(i.cacheRead)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: #6366F1"></span>
        <span class="tooltip-label">Input Tokens</span>
        <span class="tooltip-val">${P(i.inTok)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
        <span class="tooltip-label">Output Tokens</span>
        <span class="tooltip-val">${P(i.outTok)}</span>
      </div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-subline">Speed: ${x} tok/s · TTFT: ${i.ttft.toFixed(2)}s</div>
    `,s.style.display="block";let E=s.offsetWidth||180,A=s.offsetHeight||135,S=0;if(c>o.width/2)S=c-E-16;else S=c+16;S=Math.max(8,Math.min(S,o.width-E-8));let M=10,R=o.height-A-12;if(R>10)M=Math.min(M,R);s.style.left=`${Math.round(S)}px`,s.style.top=`${Math.round(M)}px`}),n.addEventListener("mouseleave",()=>{a.style.display="none",s.style.display="none"})}function te(t,e,n,a){let s=Math.max(...e.map((u)=>u.inputTok+u.outTok+u.cacheRead),1000),r=Math.pow(10,Math.floor(Math.log10(s))),o=s/r,c=r;if(o<=2)c=0.5*r;else if(o<=5)c=1*r;else c=2*r;let d=Math.ceil(s/(c*4))*(c*4)||c*4,p=[0,d*0.25,d*0.5,d*0.75,d],i=e.length>40,w=i?10:Math.max(6,Math.floor(540/e.length)),x=i?Math.max(580,e.length*w+40):580,E=220,A=10,S=14,M=24,R=30,L=E-M-R,b=(x-A-S)/e.length,k=Math.max(3,Math.min(22,Math.floor(b*0.72))),C="";p.forEach((u)=>{let y=M+L-u/d*L;C+=`
      <text x="40" y="${y+3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${H(u)}</text>
      <line x1="43" y1="${y}" x2="48" y2="${y}" stroke="var(--aura-border)" stroke-width="1" opacity="${u===0?"0.7":"0.3"}" />
    `});let B="";p.forEach((u)=>{let y=M+L-u/d*L;B+=`
      <line x1="0" y1="${y}" x2="${x}" y2="${y}" stroke="var(--aura-border)" stroke-width="1" opacity="${u===0?"0.6":"0.2"}" />
    `});let D="<defs>",m="",g="",f=e.length===24&&(e[0]?.label.includes(":00")||!1),T=e[0]?.label.startsWith("#")||!1,l=f?3:Math.max(1,Math.floor(e.length/8));e.forEach((u,y)=>{let I=A+y*b+(b-k)/2,F=u.inputTok+u.outTok+u.cacheRead,G=A+y*b,lt=I+k/2;if(F>0){let gt=Math.max(3,Math.round(F/d*L)),tt=u.outTok>0?Math.max(1,Math.round(u.outTok/d*L)):0,et=u.inputTok>0?Math.max(1,Math.round(u.inputTok/d*L)):0,J=u.cacheRead>0?Math.max(1,gt-tt-et):0;if(J<0)J=0;let ct=M+L,ft=ct-J,yt=ft-et,rt=yt-tt,at=rt,_=Math.min(3.5,k/2,gt);D+=`
        <clipPath id="col-clip-${y}">
          <path d="M ${I} ${ct} L ${I} ${at+_} A ${_} ${_} 0 0 1 ${I+_} ${at} L ${I+k-_} ${at} A ${_} ${_} 0 0 1 ${I+k} ${at+_} L ${I+k} ${ct} Z" />
        </clipPath>
      `,m+=`
        <g class="chart-column-group" 
           data-header="${u.tooltipHeader}" 
           data-in="${P(u.inputTok)}" 
           data-out="${P(u.outTok)}" 
           data-cache="${P(u.cacheRead)}"
           data-total="${P(F)}"
           data-ctx="${u.ctx?H(u.ctx)+" ("+P(u.ctx)+")":""}"
           data-reqs="${P(u.requests||1)}"
           data-subtext="${u.subText||""}"
           data-center-x="${lt}"
           data-slot-x="${G}"
           data-slot-w="${b}"
           data-top-y="${rt}"
           data-idx="${y}">
          
          <rect class="bar-bg-band" x="${G}" y="${M}" width="${b}" height="${L}" rx="4" />
          
          <g clip-path="url(#col-clip-${y})">
            ${J>0?`<rect class="bar-segment bar-cache" x="${I}" y="${ft}" width="${k}" height="${J}" fill="#00A67E" />`:""}
            ${et>0?`<rect class="bar-segment bar-in" x="${I}" y="${yt}" width="${k}" height="${et}" fill="#6366F1" opacity="0.85" />`:""}
            ${tt>0?`<rect class="bar-segment bar-out" x="${I}" y="${rt}" width="${k}" height="${tt}" fill="var(--aura-primary)" />`:""}
          </g>
        </g>
      `}else m+=`
        <g class="chart-column-group" 
           data-header="${u.tooltipHeader}" 
           data-in="0" 
           data-out="0" 
           data-cache="0"
           data-total="0"
           data-ctx="${u.ctx?H(u.ctx)+" ("+P(u.ctx)+")":""}"
           data-reqs="0"
           data-subtext="${u.subText||""}"
           data-center-x="${lt}"
           data-slot-x="${G}"
           data-slot-w="${b}"
           data-top-y="${M+L}"
           data-idx="${y}">
          
          <rect class="bar-bg-band" x="${G}" y="${M}" width="${b}" height="${L}" rx="4" />
        </g>
      `;let Pt=e.length-1-y<l*0.45;if(f||T?y%l===0&&!Pt:y%l===0||y===e.length-1&&(e.length-1)%l>=Math.floor(l/2))g+=`
        <text x="${lt}" y="${E-8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${u.label}</text>
      `}),D+="</defs>";let v=a?`
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
        ${v}
        <div class="chart-legend">
          <span class="legend-item"><span class="legend-dot" style="background: var(--aura-primary)"></span>Output Tokens</span>
          <span class="legend-item"><span class="legend-dot" style="background: #6366F1"></span>Input Tokens</span>
          <span class="legend-item"><span class="legend-dot" style="background: #00A67E"></span>Cache Read</span>
        </div>
      </div>
    </div>
    <div class="chart-layout-root">
      <div class="chart-y-axis-sticky">
        <svg viewBox="0 0 48 ${E}" class="y-axis-svg">
          ${C}
        </svg>
      </div>
      <div class="chart-viewport-wrapper">
        ${i?`
          <div class="chart-fade-mask mask-left" id="chart-mask-left" style="opacity: 0;">
            <span class="mask-indicator">‹</span>
          </div>
          <div class="chart-fade-mask mask-right" id="chart-mask-right" style="opacity: 0;">
            <span class="mask-indicator">›</span>
          </div>
        `:""}
        <div class="chart-stage ${i?"chart-stage-scrollable":""}" id="chart-stage-container">
          <svg viewBox="0 0 ${x} ${E}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="analytics-svg-element" style="${i?`min-width: ${x}px;`:""}">
            ${D}
            ${B}
            <rect id="chart-shared-hover-band" class="chart-shared-hover-band" x="0" y="${M}" width="0" height="${L}" rx="4" style="display: none;" />
            ${m}
            ${g}
          </svg>
          <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
    </div>
  `,a)At(t,e,n);if(i)setTimeout(()=>{let u=t.querySelector("#chart-stage-container"),y=t.querySelector("#chart-mask-left"),I=t.querySelector("#chart-mask-right");if(u){if(u.scrollLeft=u.scrollWidth,y&&I)ee(u,y,I)}},50);ae(t,x)}function ee(t,e,n){function a(){let s=t.scrollWidth-t.clientWidth;if(s<=0){e.style.opacity="0",n.style.opacity="0";return}e.style.opacity=t.scrollLeft>14?"1":"0",n.style.opacity=s-t.scrollLeft>14?"1":"0"}t.addEventListener("scroll",a,{passive:!0}),a()}function ae(t,e){let n=t.querySelector("#chart-floating-tooltip"),a=t.querySelector("#chart-stage-container"),s=t.querySelector("#chart-shared-hover-band"),r=t.querySelectorAll(".chart-column-group");if(!n||!a)return;let o=null;r.forEach((c)=>{c.addEventListener("mouseenter",()=>{let d=c,p=d.getAttribute("data-idx");if(p===o)return;o=p;let i=d.getAttribute("data-header")||"",w=d.getAttribute("data-in")||"0",x=d.getAttribute("data-out")||"0",E=d.getAttribute("data-cache")||"0",A=d.getAttribute("data-total")||"0",S=d.getAttribute("data-ctx")||"",M=d.getAttribute("data-reqs")||"0",R=d.getAttribute("data-subtext")||"",L=parseFloat(d.getAttribute("data-slot-x")||"0"),h=parseFloat(d.getAttribute("data-slot-w")||"0");if(s)s.setAttribute("x",String(L)),s.setAttribute("width",String(h)),s.style.display="block",s.style.opacity="1";let b=S?`
        <div class="tooltip-row ctx-row">
          <span class="tooltip-dot" style="background: #3B82F6"></span>
          <span class="tooltip-label">Context Window</span>
          <span class="tooltip-val">${S}</span>
        </div>
      `:"";n.innerHTML=`
        <div class="tooltip-header">${i}</div>
        ${b}
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
          <span class="tooltip-label">Output Tokens</span>
          <span class="tooltip-val">${x}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #6366F1"></span>
          <span class="tooltip-label">Input Tokens</span>
          <span class="tooltip-val">${w}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #00A67E"></span>
          <span class="tooltip-label">Cache Read</span>
          <span class="tooltip-val">${E}</span>
        </div>
        <div class="tooltip-divider"></div>
        <div class="tooltip-row total-row">
          <span class="tooltip-label">Total Tokens</span>
          <span class="tooltip-val">${A}</span>
        </div>
        <div class="tooltip-subline">${M} generation requests${R?" · "+R:""}</div>
      `,n.style.display="block",n.style.opacity="1";let k=a.getBoundingClientRect(),B=(d.querySelector(".bar-bg-band")||d).getBoundingClientRect(),D=B.left-k.left+a.scrollLeft,m=B.right-k.left+a.scrollLeft,g=n.offsetWidth||180,f=n.offsetHeight||135,T=a.scrollLeft,l=a.scrollLeft+k.width,v=l-(m+12),u=D-12-T,y=0;if(v>=g+6&&(v>=u||u<g))y=m+12;else if(u>=g+6)y=D-g-12;else if(v>=u)y=Math.max(m+4,l-g-6);else y=Math.min(D-g-4,T+6);let I=10,F=k.height-f-12;if(F>10)I=Math.min(I,F);n.style.left=`${Math.round(y)}px`,n.style.top=`${Math.round(I)}px`})}),a.addEventListener("mouseleave",()=>{if(o=null,s)s.style.display="none";n.style.display="none"})}function ne(t){let e=document.getElementById("analytics-projects-list");if(!e)return;if(!t||t.length===0){e.innerHTML='<div class="chart-empty">No workspace activity recorded</div>';return}let n=Math.max(...t.map((s)=>s.tokenCount),1),a=t.map((s)=>{let r=Math.max(4,Math.round(s.tokenCount/n*100)),o=s.projectId.split("/").filter(Boolean).pop()||s.projectId;return`
      <div class="project-stat-row">
        <div class="project-meta">
          <div class="project-name" title="${s.projectId}">${o}</div>
          <div class="project-counts">${s.conversationCount} sessions · ${H(s.tokenCount)} tokens</div>
        </div>
        <div class="project-bar-track">
          <div class="project-bar-fill" style="width: ${r}%"></div>
        </div>
      </div>
    `}).join("");e.innerHTML=a}var $t={"Gemini 3.8 Flash":"#00A67E","Gemini 3.8 Flash (High)":"#8B5CF6","Gemini 3.8 Flash (Exp)":"#3B82F6","Gemini 3.7 Flash":"#EC4899","Claude Opus 4.6 Thinking":"#D97706","Gemini 4 Argon (Medium)":"#06B6D4","Gemini 3.1 Pro":"#10B981","Gemini 3.8 Flash (Tiered)":"#6366F1","Gemini 3 Flash B":"#F59E0B","Gemini 3.7 Flash (High)":"#A855F7"},xt=["#00A67E","#8B5CF6","#3B82F6","#D97706","#EC4899","#06B6D4","#10B981","#6366F1","#F43F5E"];function pt(t,e=0){if($t[t])return $t[t];return xt[e%xt.length]}function It(t){let e=ht();if(t==="today")return[e];if(t==="yesterday")return[Mt()];if(t==="this-week"){let n=Lt(),a=new Date(n+"T00:00:00");a.setDate(a.getDate()+6);let s=a.getFullYear()+"-"+String(a.getMonth()+1).padStart(2,"0")+"-"+String(a.getDate()).padStart(2,"0");return z(n,s)}if(t==="this-month")return z(Rt(),e);if(t==="last-7-days")return z(K(6),e);if(t==="last-30-days")return z(K(29),e);if(t==="custom"&&Q&&V)return z(Q,V);return z(K(29),e)}function Bt(t,e){let n=document.getElementById("analytics-models-list");if(!n)return;let a=[];if(e==="session")if(j&&j.models&&j.models.length>0)a=j.models;else a=t.modelDistribution||[];else{let o=It(e),c={};for(let d of o){let p=t.dailyModelStats?.[d];if(p)for(let[i,w]of Object.entries(p)){if(!i||i.toLowerCase().includes("unknown")||w.inTok+w.outTok+w.cacheRead===0)continue;if(!c[i])c[i]={inTok:0,outTok:0,cacheRead:0,thinkTok:0,streamSec:0,requests:0};c[i].inTok+=w.inTok,c[i].outTok+=w.outTok,c[i].cacheRead+=w.cacheRead,c[i].thinkTok+=w.thinkTok,c[i].streamSec+=w.streamSec,c[i].requests+=w.requests}}if(Object.keys(c).length>0)a=Object.entries(c).map(([d,p])=>{let i=p.inTok+p.outTok+p.cacheRead,w=p.streamSec>0?Math.round(p.outTok/p.streamSec):0;return{modelId:d,modelName:d,totalTokens:i,inputTok:p.inTok,outTok:p.outTok,cacheRead:p.cacheRead,thinkTok:p.thinkTok,requests:p.requests,avgTps:w,avgTtft:0}}).sort((d,p)=>p.totalTokens-d.totalTokens);else a=[]}if(a=a.filter((o)=>o.totalTokens>0&&!o.modelName.toLowerCase().includes("unknown")),!a||a.length===0){n.innerHTML='<div class="chart-empty">No model usage recorded in this range</div>';return}let s=Math.max(...a.map((o)=>o.totalTokens),1),r=a.map((o,c)=>{let d=Math.max(3,Math.round(o.totalTokens/s*100)),p=pt(o.modelName,c),i=o.avgTps>0?`<span class="model-speed-badge">⚡ ${o.avgTps} tok/s</span>`:"",w=o.inputTok+o.cacheRead,x=w>0?Math.round(o.cacheRead/w*100):0;return`
      <div class="model-stat-row">
        <div class="model-meta">
          <div class="model-title-line">
            <span class="model-dot" style="background: ${p}"></span>
            <span class="model-name">${o.modelName}</span>
            ${i}
          </div>
          <div class="model-token-count">
            <span class="model-tokens-strong">${H(o.totalTokens)}</span> tokens
            <span class="model-req-count">(${P(o.requests)} reqs)</span>
          </div>
        </div>
        <div class="model-bar-track">
          <div class="model-bar-fill" style="width: ${d}%; background: ${p}"></div>
        </div>
        <div class="model-chips">
          <span class="model-chip"><span class="chip-dot" style="background: #00A67E"></span>Cache: ${x}% (${H(o.cacheRead)})</span>
          <span class="model-chip"><span class="chip-dot" style="background: var(--aura-primary)"></span>Out: ${H(o.outTok)}</span>
          <span class="model-chip"><span class="chip-dot" style="background: #6366F1"></span>In: ${H(o.inputTok)}</span>
          ${o.thinkTok>0?`<span class="model-chip"><span class="chip-dot" style="background: #A855F7"></span>Think: ${H(o.thinkTok)}</span>`:""}
        </div>
      </div>
    `}).join("");n.innerHTML=r}function Dt(t,e){let n=document.getElementById("analytics-model-tps-chart");if(!n)return;let a=It(e);if(a.length<5){let f=ht();a=z(K(13),f)}let s={};for(let f of a){let T=t.dailyModelStats?.[f];if(T){for(let[l,v]of Object.entries(T))if(v.streamSec>0&&v.outTok>0){if(!s[l])s[l]={totalOut:0,totalStream:0,daysCount:0};s[l].totalOut+=v.outTok,s[l].totalStream+=v.streamSec,s[l].daysCount+=1}}}let r=Object.keys(s).filter((f)=>!f.toLowerCase().includes("unknown"));if(r.length===0){n.innerHTML=`
      <div class="chart-header">
        <div class="chart-header-left">
          <h3 class="chart-title">Model Speed Trends (Daily Avg TPS)</h3>
        </div>
      </div>
      <div class="chart-empty">No streaming latency data recorded in this period</div>
    `;return}let o=600,c=220,d=45,p=20,i=24,w=28,x=o-d-p,E=c-i-w,A=0,S={};for(let f of r)S[f]=[],a.forEach((T)=>{let l=t.dailyModelStats?.[T]?.[f];if(l&&l.streamSec>0&&l.outTok>0){let v=Math.round(l.outTok/l.streamSec);if(v>A)A=v}});let M=Math.max(500,Math.ceil(A*1.15/100)*100),R=x/Math.max(1,a.length-1);for(let f of r)a.forEach((T,l)=>{let v=t.dailyModelStats?.[T]?.[f],u=d+l*R;if(v&&v.streamSec>0&&v.outTok>0){let y=Math.round(v.outTok/v.streamSec),I=i+E-y/M*E;S[f].push({x:u,y:I,tps:y,date:T,reqs:v.requests})}else S[f].push(null)});let L=[0,Math.round(M*0.33),Math.round(M*0.66),M],h="",b="";L.forEach((f)=>{let T=i+E-f/M*E;h+=`
      <line x1="${d}" y1="${T.toFixed(1)}" x2="${o-p}" y2="${T.toFixed(1)}" stroke="var(--aura-border)" stroke-width="1" stroke-dasharray="3 3" opacity="0.35" />
    `,b+=`
      <text x="${d-8}" y="${(T+3).toFixed(1)}" text-anchor="end" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${f}</text>
    `});let k="",C=Math.max(1,Math.floor(a.length/7));a.forEach((f,T)=>{let l=T===a.length-1,v=l&&T%C<Math.floor(C/2)&&T!==0;if(T%C===0&&!v||l){let u=d+T*R;k+=`
        <text x="${u.toFixed(1)}" y="${c-8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${wt(f)}</text>
      `}});let B="",D="",m="";r.forEach((f,T)=>{let l=pt(f,T),v=S[f],u=Math.round(s[f].totalOut/s[f].totalStream);m+=`
      <span class="legend-item" title="${f}">
        <span class="legend-dot" style="background: ${l}"></span>
        <span class="legend-label">${f}</span>
        <span class="legend-sub">(${u} tok/s)</span>
      </span>
    `;let y="";for(let I=0;I<v.length;I++){let F=v[I];if(F){if(!y)y=`M ${F.x.toFixed(1)},${F.y.toFixed(1)}`;else y+=` L ${F.x.toFixed(1)},${F.y.toFixed(1)}`;D+=`
          <circle cx="${F.x.toFixed(1)}" cy="${F.y.toFixed(1)}" r="3.5" fill="${l}" stroke="var(--aura-bg-elevated, #1e1e1e)" stroke-width="1.5" class="tps-point" />
        `}else if(y)B+=`<path d="${y}" fill="none" stroke="${l}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`,y=""}if(y)B+=`<path d="${y}" fill="none" stroke="${l}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`});let g="";a.forEach((f,T)=>{let l=d+T*R,v=R,u=Math.max(d,l-v/2),y=[];r.forEach((I,F)=>{let G=t.dailyModelStats?.[f]?.[I];if(G&&G.streamSec>0&&G.outTok>0)y.push({model:I,color:pt(I,F),tps:Math.round(G.outTok/G.streamSec),reqs:G.requests})}),g+=`
      <rect class="tps-hover-slot" 
            x="${u.toFixed(1)}" y="${i}" width="${v.toFixed(1)}" height="${E}" 
            fill="transparent" 
            data-date="${f}"
            data-center-x="${l.toFixed(1)}"
            data-models="${encodeURIComponent(JSON.stringify(y))}" />
    `}),n.innerHTML=`
    <div class="chart-header">
      <div class="chart-header-left">
        <h3 class="chart-title">Model Speed Trends (Daily Avg TPS)</h3>
      </div>
      <div class="chart-legend tps-legend">
        ${m}
      </div>
    </div>
    <div class="chart-body" style="position: relative;">
      <svg viewBox="0 0 ${o} ${c}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="tps-svg-element">
        ${h}
        ${b}
        ${k}
        ${B}
        ${D}
        <line id="tps-scrubber-line" x1="0" y1="${i}" x2="0" y2="${i+E}" stroke="var(--aura-border-focus, #3B82F6)" stroke-width="1.5" stroke-dasharray="2 2" style="display: none; pointer-events: none;" />
        ${g}
      </svg>
      <div class="chart-floating-tooltip" id="tps-floating-tooltip" style="display: none;"></div>
    </div>
  `,se(n,o)}function se(t,e){let n=t.querySelector(".chart-body"),a=t.querySelector("#tps-scrubber-line"),s=t.querySelector("#tps-floating-tooltip");if(!n||!s||!a)return;t.querySelectorAll(".tps-hover-slot").forEach((o)=>{o.addEventListener("mouseenter",()=>{let c=parseFloat(o.getAttribute("data-center-x")||"0"),d=o.getAttribute("data-date")||"",p=o.getAttribute("data-models")||"[]",i=[];try{i=JSON.parse(decodeURIComponent(p))}catch{}a.setAttribute("x1",String(c)),a.setAttribute("x2",String(c)),a.style.display="block";let w=i.length>0?i.map((R)=>`
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: ${R.color}"></span>
          <span class="tooltip-label">${R.model}</span>
          <span class="tooltip-val">${R.tps} tok/s (${R.reqs} reqs)</span>
        </div>
      `).join(""):'<div class="tooltip-subline">No activity on this date</div>';s.innerHTML=`
        <div class="tooltip-header">${Et(d)}</div>
        ${w}
      `,s.style.display="block",s.style.opacity="1";let x=n.getBoundingClientRect(),E=s.offsetWidth||180,A=x.width/e,S=c*A,M=S+12;if(M+E>x.width-12)M=S-E-12;M=Math.max(6,Math.min(M,x.width-E-6)),s.style.left=`${Math.round(M)}px`,s.style.top="16px"})}),n.addEventListener("mouseleave",()=>{a.style.display="none",s.style.opacity="0",setTimeout(()=>{if(s.style.opacity==="0")s.style.display="none"},120)})}function oe(t){switch(t){case"session":return"Active Session";case"today":return"Today";case"yesterday":return"Yesterday";case"this-week":return"This Week";case"this-month":return"This Month";case"last-7-days":return"Last 7 Days";case"last-30-days":return"Last 30 Days";case"custom":return"Custom Range";default:return"Overview"}}async function mt(t){Z=t;let e=document.getElementById("analytics-timerange-segmented");if(e)e.querySelectorAll(".segment-btn").forEach((a)=>{if(a.getAttribute("data-range")===t)a.classList.add("active");else a.classList.remove("active")});let n=document.getElementById("custom-range-inputs");if(n)n.style.display=t==="custom"?"flex":"none";if(t==="session"){if(!j)j=await St()}if(N){let a=Jt(N,t);Zt(a),Ct(a.columns,oe(t)),Bt(N,t),Dt(N,t)}}async function nt(){let t=document.getElementById("btn-refresh-analytics");if(t)t.classList.add("loading");let[e,n]=await Promise.all([Kt(),St()]);if(e)N=e;if(n)j=n;if(N)await mt(Z),ne(N.topProjects),Bt(N,Z),Dt(N,Z);if(t)setTimeout(()=>t.classList.remove("loading"),300)}function Ht(){let t=document.getElementById("analytics-timerange-segmented");if(t)t.querySelectorAll(".segment-btn").forEach((s)=>{s.addEventListener("click",()=>{let r=s.getAttribute("data-range");if(r)mt(r)})});let e=document.getElementById("custom-date-start"),n=document.getElementById("custom-date-end");document.getElementById("btn-apply-custom-range")?.addEventListener("click",()=>{if(e?.value&&n?.value)Q=e.value,V=n.value,mt("custom")})}var O=null,st=[];function U(t){let e=document.getElementById("toast");if(!e)return;e.textContent=t,e.classList.add("show"),setTimeout(()=>e.classList.remove("show"),2000)}async function q(t){try{let e=await window.sidecar.fetch("/api/config",{method:"POST",body:JSON.stringify(t)});if(e.ok)O=(await e.json()).config,U("Configuration applied in real-time");else U("Save failed")}catch(e){console.error("saveConfig failed:",e),U("Network error")}}function W(t,e){let n=document.getElementById(t);if(!n)return;n.querySelectorAll(".segment-btn").forEach((a)=>{if(a.getAttribute("data-val")===String(e))a.classList.add("active");else a.classList.remove("active")})}function ot(t,e,n,a){let s=document.getElementById(t);if(!s)return;s.innerHTML="";let r=document.createElement("option");r.value="default",r.textContent=e,s.appendChild(r);let o=document.createElement("optgroup");o.label="System Installed Fonts";for(let d of n){let p=document.createElement("option");p.value=d,p.textContent=d,o.appendChild(p)}s.appendChild(o);let c=document.createElement("option");if(c.value="custom",c.textContent="Custom font name...",s.appendChild(c),!a||a==="default")s.value="default";else if(n.includes(a))s.value=a;else s.value="custom"}async function qt(){try{let t=await window.sidecar.fetch("/api/system-fonts",{method:"GET"});if(t.ok){let e=await t.json();if(Array.isArray(e.fonts))st=e.fonts}}catch(t){console.error("loadSystemFonts failed:",t)}}async function Ot(){try{let t=await window.sidecar.fetch("/api/config",{method:"GET"});if(!t.ok)return;let{config:e}=await t.json();O=e;let n=document.getElementById("select-language");if(n)n.value=e.language||"default";let a=e.presets?.light||"high-contrast",s=e.presets?.dark||"claude-dark";W("preset-light-segmented",a),W("preset-dark-segmented",s);let r=document.getElementById("toggle-wax-seal");if(r)r.checked=e.composer?.waxSeal!==!1;let o=e.typography||{};ot("select-font-sans-primary","Default",st,o.primarySans),ot("select-font-sans-fallback","Default",st,o.fallbackSans),ot("select-font-mono","Default",st,o.mono);let c=document.getElementById("select-font-sans-primary"),d=document.getElementById("row-custom-sans-primary"),p=document.getElementById("input-custom-sans-primary");if(c&&d){if(d.style.display=c.value==="custom"?"flex":"none",p)p.value=o.customPrimarySans||""}let i=document.getElementById("select-font-sans-fallback"),w=document.getElementById("row-custom-sans-fallback"),x=document.getElementById("input-custom-sans-fallback");if(i&&w){if(w.style.display=i.value==="custom"?"flex":"none",x)x.value=o.customFallbackSans||""}let E=document.getElementById("select-font-mono"),A=document.getElementById("row-custom-mono"),S=document.getElementById("input-custom-mono");if(E&&A){if(A.style.display=E.value==="custom"?"flex":"none",S)S.value=o.customMono||""}W("font-size-segmented",o.fontSize||16);let M=e.composer?.collinear!==!1?"collinear":"native";W("composer-align-segmented",M);let R=document.getElementById("toggle-hide-arrows");if(R)R.checked=e.composer?.hideArrows!==!1;let L=document.getElementById("toggle-metrics");if(L)L.checked=e.telemetry?.enabled!==!1;W("metrics-interval-segmented",e.telemetry?.interval||2000)}catch(t){console.error("loadConfig failed:",t)}}async function it(){try{let t=await window.sidecar.fetch("/api/status",{method:"GET"});if(!t.ok)return;let e=await t.json(),n=document.getElementById("status-dot"),a=document.getElementById("status-text"),s=document.getElementById("status-sublabel");if(e.connected){if(n)n.classList.remove("disconnected");if(a)a.textContent="Connected";if(s)s.textContent=`Connected to host (${e.targetCount||1} window(s) · port ${e.cdpPort||"-"})`}else{if(n)n.classList.add("disconnected");if(a)a.textContent="Searching window...";if(s)s.textContent="Detecting Antigravity CDP port..."}}catch(t){console.error("updateStatus failed:",t)}}async function Ft(){bt(),Y(),await qt(),await Ot(),it(),setInterval(it,3000);let t=document.getElementById("select-language");if(t)t.addEventListener("change",()=>{q({language:t.value})});let e=document.getElementById("preset-light-segmented");if(e)e.querySelectorAll(".segment-btn").forEach((m)=>{m.addEventListener("click",()=>{let g=m.getAttribute("data-val")||"high-contrast";W("preset-light-segmented",g),q({presets:{...O?.presets,light:g}})})});let n=document.getElementById("preset-dark-segmented");if(n)n.querySelectorAll(".segment-btn").forEach((m)=>{m.addEventListener("click",()=>{let g=m.getAttribute("data-val")||"claude-dark";W("preset-dark-segmented",g),q({presets:{...O?.presets,dark:g}})})});let a=document.getElementById("toggle-wax-seal");if(a)a.addEventListener("change",()=>{q({composer:{...O?.composer,waxSeal:a.checked}})});let s=document.getElementById("select-font-sans-primary"),r=document.getElementById("row-custom-sans-primary"),o=document.getElementById("input-custom-sans-primary");if(s)s.addEventListener("change",()=>{let m=s.value==="custom";if(r)r.style.display=m?"flex":"none";if(!m)q({typography:{...O?.typography,primarySans:s.value}});else if(o)o.focus()});if(o){let m=()=>{if(s&&s.value==="custom")q({typography:{...O?.typography,primarySans:"custom",customPrimarySans:o.value.trim()}})};o.addEventListener("change",m),o.addEventListener("keydown",(g)=>{if(g.key==="Enter")m(),o.blur()})}let c=document.getElementById("select-font-sans-fallback"),d=document.getElementById("row-custom-sans-fallback"),p=document.getElementById("input-custom-sans-fallback");if(c)c.addEventListener("change",()=>{let m=c.value==="custom";if(d)d.style.display=m?"flex":"none";if(!m)q({typography:{...O?.typography,fallbackSans:c.value}});else if(p)p.focus()});if(p){let m=()=>{if(c&&c.value==="custom")q({typography:{...O?.typography,fallbackSans:"custom",customFallbackSans:p.value.trim()}})};p.addEventListener("change",m),p.addEventListener("keydown",(g)=>{if(g.key==="Enter")m(),p.blur()})}let i=document.getElementById("select-font-mono"),w=document.getElementById("row-custom-mono"),x=document.getElementById("input-custom-mono");if(i)i.addEventListener("change",()=>{let m=i.value==="custom";if(w)w.style.display=m?"flex":"none";if(!m)q({typography:{...O?.typography,mono:i.value}});else if(x)x.focus()});if(x){let m=()=>{if(i&&i.value==="custom")q({typography:{...O?.typography,mono:"custom",customMono:x.value.trim()}})};x.addEventListener("change",m),x.addEventListener("keydown",(g)=>{if(g.key==="Enter")m(),x.blur()})}let E=document.getElementById("font-size-segmented");if(E)E.querySelectorAll(".segment-btn").forEach((m)=>{m.addEventListener("click",()=>{let g=Number(m.getAttribute("data-val"));W("font-size-segmented",g),q({typography:{...O?.typography,fontSize:g}})})});let A=document.getElementById("composer-align-segmented");if(A)A.querySelectorAll(".segment-btn").forEach((m)=>{m.addEventListener("click",()=>{let g=m.getAttribute("data-val");W("composer-align-segmented",g||"collinear"),q({composer:{...O?.composer,collinear:g==="collinear"}})})});let S=document.getElementById("toggle-hide-arrows");if(S)S.addEventListener("change",()=>{q({composer:{...O?.composer,hideArrows:S.checked}})});let M=document.getElementById("toggle-metrics");if(M)M.addEventListener("change",()=>{q({telemetry:{...O?.telemetry,enabled:M.checked}})});let R=document.getElementById("metrics-interval-segmented");if(R)R.querySelectorAll(".segment-btn").forEach((m)=>{m.addEventListener("click",()=>{let g=Number(m.getAttribute("data-val"));W("metrics-interval-segmented",g),q({telemetry:{...O?.telemetry,interval:g}})})});let L=document.getElementById("btn-force-reload");if(L)L.addEventListener("click",async()=>{L.disabled=!0,L.style.opacity="0.6";try{if((await window.sidecar.fetch("/api/reload",{method:"POST"})).ok)U("Styles recompiled and re-applied"),await it();else U("Reload failed")}catch(m){U("Request error")}finally{L.disabled=!1,L.style.opacity="1"}});let h=document.getElementById("tab-nav-analytics"),b=document.getElementById("tab-nav-settings"),k=document.getElementById("view-analytics"),C=document.getElementById("view-settings"),B=(m)=>{if(m==="analytics"){if(h?.classList.add("active"),b?.classList.remove("active"),k)k.style.display="block";if(C)C.style.display="none";nt()}else{if(b?.classList.add("active"),h?.classList.remove("active"),C)C.style.display="block";if(k)k.style.display="none"}};h?.addEventListener("click",()=>B("analytics")),b?.addEventListener("click",()=>B("settings")),document.getElementById("btn-refresh-analytics")?.addEventListener("click",()=>nt()),Ht(),nt()}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",Ft);else Ft();})();

//# debugId=DB98E8E9CD62114664756E2164756E21
