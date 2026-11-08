(()=>{var{defineProperty:nt,getOwnPropertyNames:St,getOwnPropertyDescriptor:Mt}=Object,Lt=Object.prototype.hasOwnProperty;function It(t){return this[t]}var Ct=(t)=>{var e=(pt??=new WeakMap).get(t),n;if(e)return e;if(e=nt({},"__esModule",{value:!0}),t&&typeof t==="object"||typeof t==="function"){for(var a of St(t))if(!Lt.call(e,a))nt(e,a,{get:It.bind(t,a),enumerable:!(n=Mt(t,a))||n.enumerable})}return pt.set(t,e),e},pt;var Rt=(t)=>t;function At(t,e){this[t]=Rt.bind(null,e)}var Bt=(t,e)=>{for(var n in e)nt(t,n,{get:e[n],enumerable:!0,configurable:!0,set:At.bind(e,n)})};var Qt={};Bt(Qt,{loadConfig:()=>$t,loadSystemFonts:()=>xt,populateFontSelect:()=>Z,saveConfig:()=>A,showToast:()=>W,updateSegmentedUI:()=>P,updateStatus:()=>Q});var G=null;function mt(t,e,n){let a=(s)=>{let r=s/255;return r<=0.03928?r/12.92:Math.pow((r+0.055)/1.055,2.4)};return 0.2126*a(t)+0.7152*a(e)+0.0722*a(n)}function gt(t){if(!t)return null;let e=t.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);if(e)return{r:parseInt(e[1],10),g:parseInt(e[2],10),b:parseInt(e[3],10),alpha:e[4]!==void 0?parseFloat(e[4]):1};return null}function Ht(){if(G==="light"||G==="dark")return G;let t=document.documentElement.style.colorScheme;if(t==="light"||t==="dark")return t;let e=document.createElement("div");e.setAttribute("aria-hidden","true"),e.style.cssText="position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;background-color:var(--background, var(--vscode-editor-background, transparent))",(document.body||document.documentElement).appendChild(e);try{let n=window.getComputedStyle(e).backgroundColor,a=gt(n);if(a&&a.alpha>0)return mt(a.r,a.g,a.b)>0.179?"light":"dark"}catch(n){}finally{e.remove()}if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)return"dark";return"light"}function j(t){let e=t||Ht(),n=document.documentElement;if(n.getAttribute("data-theme")!==e)n.setAttribute("data-theme",e);if(n.style.colorScheme!==e)n.style.colorScheme=e}function ft(){if(window.addEventListener("message",(t)=>{if(t.data?.type==="ag-theme-sync"){let e=t.data.payload||{};if(e.scheme==="light"||e.scheme==="dark")G=e.scheme,j(G)}else if(t.data?.type==="theme-change"){let e=t.data?.payload?.cssVariables;if(e&&typeof e["--background"]==="string"){let n=gt(e["--background"]);if(n)G=mt(n.r,n.g,n.b)>0.179?"light":"dark"}j(G||void 0)}}),window.matchMedia){let t=window.matchMedia("(prefers-color-scheme: dark)"),e=()=>j();if(typeof t.addEventListener==="function")t.addEventListener("change",e);else if(typeof t.addListener==="function")t.addListener(e)}if(typeof MutationObserver<"u")new MutationObserver(()=>{j()}).observe(document.documentElement,{attributes:!0,attributeFilter:["style","data-theme"]});j()}function q(t){if(!t||t<=0)return"0";if(t>=1e9)return(t/1e9).toFixed(2)+"B";if(t>=1e6)return(t/1e6).toFixed(1)+"M";if(t>=1e4)return Math.round(t/1000)+"k";if(t>=1000)return(t/1000).toFixed(1)+"k";return String(Math.round(t))}function D(t){return(t||0).toLocaleString("en-US")}function Dt(t){if(!t)return"Recently";try{let e=new Date(t).getTime(),n=Date.now(),a=Math.max(0,Math.floor((n-e)/1000));if(a<60)return"Just now";if(a<3600)return`${Math.floor(a/60)}m ago`;if(a<86400)return`${Math.floor(a/3600)}h ago`;let s=Math.floor(a/86400);if(s<30)return`${s}d ago`;return`${Math.floor(s/30)}mo ago`}catch{return"Recently"}}function ht(t){if(!t||t.length<10)return t;try{return new Date(t+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}catch{return t.slice(5)}}function yt(t){if(!t||t.length<10)return t;try{return new Date(t+"T00:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}catch{return t}}var z=null,lt="last-30-days",st="",ot="",F=null;async function qt(){try{let t=await window.sidecar.fetch("/api/analytics/overview",{method:"GET"});if(!t.ok)return null;let e=await t.json();return e.ok?e.data:null}catch(t){return console.error("[Aura Analytics] Failed to fetch overview:",t),null}}async function Pt(){try{let t=await window.sidecar.fetch("/api/analytics/conversations",{method:"GET"});if(!t.ok)return[];let e=await t.json();return e.ok&&Array.isArray(e.conversations)?e.conversations:[]}catch(t){return console.error("[Aura Analytics] Failed to fetch conversations:",t),[]}}async function kt(){try{let e=new URLSearchParams(window.location.search).get("conversationId")||"",n=e?`/api/analytics/session?id=${encodeURIComponent(e)}`:"/api/analytics/session",a=await window.sidecar.fetch(n,{method:"GET"});if(!a.ok)return null;let s=await a.json();return s.ok?s.data:null}catch(t){return console.error("[Aura Analytics] Failed to fetch active session:",t),null}}function Ft(){let t=new Date;return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}function Ot(){let t=new Date(Date.now()-86400000);return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}function jt(){let t=new Date,e=t.getDay(),n=t.getDate()-e+(e===0?-6:1),a=new Date(t.setDate(n));return a.getFullYear()+"-"+String(a.getMonth()+1).padStart(2,"0")+"-"+String(a.getDate()).padStart(2,"0")}function Gt(){let t=new Date;return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-01"}function vt(t){let e=new Date(Date.now()-t*86400000);return e.getFullYear()+"-"+String(e.getMonth()+1).padStart(2,"0")+"-"+String(e.getDate()).padStart(2,"0")}function Wt(t,e){let n=Ft(),a=Ot();if(e==="session"&&F&&F.steps.length>0){let o=F;return{columns:o.steps.map((u)=>{let m=u.ctx||u.inTok+u.cacheRead;return{label:`#${u.idx+1}`,tooltipHeader:`Session Turn #${u.idx+1}`,inputTok:u.inTok,outTok:u.outTok,cacheRead:u.cacheRead,ctx:m,requests:1,subText:`Context: ${q(m)} · Speed: ${Math.round(u.stream>0?u.outTok/u.stream:0)} tok/s`}}),totalTokens:o.totalTokens,totalRequests:o.totalRequests,cacheEfficiency:o.cacheEfficiency,avgTtft:o.avgTtft,avgTokPerSec:o.avgTokPerSec}}if(e==="today"||e==="yesterday"){let o=e==="today"?n:a,S={};for(let v=0;v<24;v++){let l=String(v).padStart(2,"0"),w=`${o} ${l}:00`;S[w]={label:`${l}:00`,tooltipHeader:`${o} ${l}:00 - ${l}:59`,inputTok:0,outTok:0,cacheRead:0,requests:0}}for(let v of t.hourlySeries||[])if(v.hourKey&&v.hourKey.startsWith(o)){let l=v.hourKey.slice(0,16);if(S[l])S[l].inputTok+=v.inputTok,S[l].outTok+=v.outTok,S[l].cacheRead+=v.cacheRead,S[l].requests+=v.requests}let u=Object.values(S),m=0,M=0,C=0,x=0;for(let v of u)m+=v.inputTok,M+=v.outTok,C+=v.cacheRead,x+=v.requests;let i=m+M+C,g=m+C,b=g>0?C/g*100:t.cacheEfficiency;return{columns:u,totalTokens:{input:m,output:M,cacheRead:C,thinking:t.totalTokens.thinking,total:i},totalRequests:x,cacheEfficiency:b,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}let s="0000-00-00",r=n;if(e==="this-week")s=jt();else if(e==="this-month")s=Gt();else if(e==="last-7-days")s=vt(7);else if(e==="last-30-days")s=vt(30);else if(e==="custom"){if(st&&ot)s=st,r=ot}let c=(t.timeRangeSeries||[]).filter((o)=>{if(!o.date||o.date.startsWith("0001"))return!1;return o.date>=s&&o.date<=r}),p=new Date(s).getTime(),f=new Date(r).getTime();if(Math.round((f-p)/86400000)>90&&c.length>28){let o={};for(let b of c){let v=new Date(b.date+"T00:00:00"),l=Math.floor(v.getDate()/7)+1,w=`${b.date.slice(0,7)} W${l}`;if(!o[w])o[w]={label:w.slice(5),tooltipHeader:`Week of ${b.date}`,inputTok:0,outTok:0,cacheRead:0,requests:0};o[w].inputTok+=b.inputTok,o[w].outTok+=b.outTok,o[w].cacheRead+=b.cacheRead,o[w].requests+=b.requests||1}let S=Object.values(o),u=0,m=0,M=0,C=0;for(let b of S)u+=b.inputTok,m+=b.outTok,M+=b.cacheRead,C+=b.requests;let x=u+m+M,i=u+M,g=i>0?M/i*100:t.cacheEfficiency;return{columns:S,totalTokens:{input:u,output:m,cacheRead:M,thinking:t.totalTokens.thinking,total:x},totalRequests:C,cacheEfficiency:g,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}let d=c.map((o)=>({label:ht(o.date),tooltipHeader:yt(o.date),inputTok:o.inputTok,outTok:o.outTok,cacheRead:o.cacheRead,requests:o.requests||1})),L=0,h=0,k=0,I=0;for(let o of d)L+=o.inputTok,h+=o.outTok,k+=o.cacheRead,I+=o.requests;let E=L+h+k,T=L+k,R=T>0?k/T*100:t.cacheEfficiency;return{columns:d.length>0?d:(t.timeRangeSeries||[]).slice(-14).map((o)=>({label:ht(o.date),tooltipHeader:yt(o.date),inputTok:o.inputTok,outTok:o.outTok,cacheRead:o.cacheRead,requests:o.requests||1})),totalTokens:d.length>0?{input:L,output:h,cacheRead:k,thinking:t.totalTokens.thinking,total:E}:t.totalTokens,totalRequests:I||t.totalRequests||t.totalConversations*10,cacheEfficiency:R,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}function _t(t){let e=document.getElementById("analytics-cards-grid");if(!e)return;let n=t.totalTokens.total,a=t.totalTokens.input,s=t.totalTokens.output,r=t.totalTokens.cacheRead,c=t.totalRequests;e.innerHTML=`
    <!-- Row 1: Primary Metrics -->
    <div class="kpi-grid-primary">
      <div class="kpi-card kpi-card-featured">
        <div class="kpi-label">Total Tokens Processed</div>
        <div class="kpi-value">${q(n)}</div>
        <div class="kpi-breakdown">
          <span class="kpi-tag tag-cached">Cache: ${q(r)}</span>
          <span class="kpi-tag tag-input">In: ${q(a)}</span>
          <span class="kpi-tag tag-output">Out: ${q(s)}</span>
        </div>
      </div>

      <div class="kpi-card kpi-card-featured">
        <div class="kpi-label">Total Requests</div>
        <div class="kpi-value">${D(c)}</div>
        <div class="kpi-subtext">Completed model inferences for the selected range</div>
      </div>
    </div>

    <!-- Row 2: Secondary Performance Metrics -->
    <div class="kpi-grid-secondary">
      <div class="kpi-card">
        <div class="kpi-label">Cache Cost Efficiency</div>
        <div class="kpi-value">${t.cacheEfficiency.toFixed(1)}%</div>
        <div class="kpi-subtext">Prompt caching saved ~${q(r)} tokens from reprocessing</div>
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
  `}var it="overview";function Tt(t,e){let n=document.getElementById("analytics-activity-chart");if(!n)return;if(!t||t.length===0){n.innerHTML=`
      <div class="chart-header">
        <div class="chart-title">${e}</div>
      </div>
      <div class="chart-empty">No activity data recorded in the selected range</div>
    `;return}let a=lt==="session"&&!!F&&F.steps.length>0;if(a&&it==="overview")zt(n,F,e,t);else Ut(n,t,e,a)}function bt(t,e,n){t.querySelectorAll("#session-view-segmented .segment-btn").forEach((s)=>{s.addEventListener("click",(r)=>{r.stopPropagation();let c=s.getAttribute("data-mode");if(c&&c!==it)it=c,Tt(e,n)})})}function zt(t,e,n,a){let s=e.steps,r=s.length;if(r===0)return;let c=Math.max(...s.map((x)=>x.ctx||x.inTok+x.cacheRead),1000),p=Math.pow(10,Math.floor(Math.log10(c))),f=c/p,y=p;if(f<=2)y=0.5*p;else if(f<=5)y=1*p;else y=2*p;let d=Math.ceil(c/(y*4))*(y*4)||y*4,L=[0,d*0.25,d*0.5,d*0.75,d],h=220,k=24,I=30,E=h-k-I,T="";L.forEach((x)=>{let i=k+E-x/d*E;T+=`
      <text x="40" y="${i+3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${q(x)}</text>
      <line x1="43" y1="${i}" x2="48" y2="${i}" stroke="var(--aura-border)" stroke-width="1" opacity="${x===0?"0.7":"0.3"}" />
    `});let R=590,o=R-10,S="";L.forEach((x)=>{let i=k+E-x/d*E;S+=`
      <line x1="0" y1="${i}" x2="${o}" y2="${i}" stroke="var(--aura-border)" stroke-width="1" opacity="${x===0?"0.6":"0.2"}" />
    `});let u=`M 0,${k+E}`,m="",M="",C=Math.max(1,Math.floor(r/6));s.forEach((x,i)=>{let g=x.ctx||x.inTok+x.cacheRead,b=r>1?i/(r-1)*o:0,v=k+E-g/d*E;if(i===0)u+=` L ${b.toFixed(1)},${v.toFixed(1)}`,m=`M ${b.toFixed(1)},${v.toFixed(1)}`;else u+=` L ${b.toFixed(1)},${v.toFixed(1)}`,m+=` L ${b.toFixed(1)},${v.toFixed(1)}`;if(i%C===0||i===r-1)M+=`
        <text x="${b.toFixed(1)}" y="${h-8}" text-anchor="${i===0?"start":i===r-1?"end":"middle"}" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#${i+1}</text>
      `}),u+=` L ${o},${k+E} Z`,t.innerHTML=`
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
        <svg viewBox="0 0 48 ${h}" class="y-axis-svg">
          ${T}
        </svg>
      </div>
      <div class="chart-viewport-wrapper">
        <div class="chart-stage" id="chart-stage-container">
          <svg viewBox="0 0 ${R} ${h}" preserveAspectRatio="none" class="analytics-svg" id="analytics-svg-element">
            <defs>
              <linearGradient id="aura-ctx-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#00A67E" stop-opacity="0.45" />
                <stop offset="65%" stop-color="#00A67E" stop-opacity="0.12" />
                <stop offset="100%" stop-color="#00A67E" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            ${S}
            <path d="${u}" fill="url(#aura-ctx-grad)" />
            <path d="${m}" fill="none" stroke="#00A67E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            ${M}
          </svg>
          <div class="chart-scrubber-line" id="chart-scrubber-line" style="display: none;"></div>
          <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
    </div>
  `,bt(t,a,n),Nt(t,s)}function Nt(t,e){let n=t.querySelector("#chart-stage-container"),a=t.querySelector("#chart-scrubber-line"),s=t.querySelector("#chart-floating-tooltip");if(!n||!a||!s)return;n.addEventListener("mousemove",(r)=>{let c=n.getBoundingClientRect(),p=Math.max(0,Math.min(r.clientX-c.left,c.width)),f=c.width>0?p/c.width:0,y=Math.min(e.length-1,Math.max(0,Math.round(f*(e.length-1)))),d=e[y];if(!d)return;let L=d.ctx||d.inTok+d.cacheRead,h=Math.round(d.stream>0?d.outTok/d.stream:0);a.style.display="block",a.style.transform=`translateX(${p}px)`,s.innerHTML=`
      <div class="tooltip-header">Session Turn #${d.idx+1}</div>
      <div class="tooltip-row ctx-row">
        <span class="tooltip-dot" style="background: #3B82F6"></span>
        <span class="tooltip-label">Context Window</span>
        <span class="tooltip-val">${q(L)} (${D(L)})</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: #00A67E"></span>
        <span class="tooltip-label">Cache Read</span>
        <span class="tooltip-val">${D(d.cacheRead)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: #6366F1"></span>
        <span class="tooltip-label">Input Tokens</span>
        <span class="tooltip-val">${D(d.inTok)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
        <span class="tooltip-label">Output Tokens</span>
        <span class="tooltip-val">${D(d.outTok)}</span>
      </div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-subline">Speed: ${h} tok/s · TTFT: ${d.ttft.toFixed(2)}s</div>
    `,s.style.display="block";let k=s.offsetWidth||180,I=s.offsetHeight||135,E=0;if(p>c.width/2)E=p-k-16;else E=p+16;E=Math.max(8,Math.min(E,c.width-k-8));let T=10,R=c.height-I-12;if(R>10)T=Math.min(T,R);s.style.left=`${Math.round(E)}px`,s.style.top=`${Math.round(T)}px`}),n.addEventListener("mouseleave",()=>{a.style.display="none",s.style.display="none"})}function Ut(t,e,n,a){let s=Math.max(...e.map((l)=>l.inputTok+l.outTok+l.cacheRead),1000),r=Math.pow(10,Math.floor(Math.log10(s))),c=s/r,p=r;if(c<=2)p=0.5*r;else if(c<=5)p=1*r;else p=2*r;let f=Math.ceil(s/(p*4))*(p*4)||p*4,y=[0,f*0.25,f*0.5,f*0.75,f],d=e.length>40,L=d?10:Math.max(6,Math.floor(540/e.length)),h=d?Math.max(580,e.length*L+40):580,k=220,I=10,E=14,T=24,R=30,o=k-T-R,u=(h-I-E)/e.length,m=Math.max(3,Math.min(22,Math.floor(u*0.72))),M="";y.forEach((l)=>{let w=T+o-l/f*o;M+=`
      <text x="40" y="${w+3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${q(l)}</text>
      <line x1="43" y1="${w}" x2="48" y2="${w}" stroke="var(--aura-border)" stroke-width="1" opacity="${l===0?"0.7":"0.3"}" />
    `});let C="";y.forEach((l)=>{let w=T+o-l/f*o;C+=`
      <line x1="0" y1="${w}" x2="${h}" y2="${w}" stroke="var(--aura-border)" stroke-width="1" opacity="${l===0?"0.6":"0.2"}" />
    `});let x="<defs>",i="",g="",b=Math.max(1,Math.floor(e.length/8));e.forEach((l,w)=>{let H=I+w*u+(u-m)/2,V=l.inputTok+l.outTok+l.cacheRead,N=I+w*u,tt=H+m/2;if(V>0){let rt=Math.max(3,Math.round(V/f*o)),U=l.outTok>0?Math.max(1,Math.round(l.outTok/f*o)):0,Y=l.inputTok>0?Math.max(1,Math.round(l.inputTok/f*o)):0,_=l.cacheRead>0?Math.max(1,rt-U-Y):0;if(_<0)_=0;let et=T+o,dt=et-_,ut=dt-Y,at=ut-U,K=at,O=Math.min(3.5,m/2,rt);x+=`
        <clipPath id="col-clip-${w}">
          <path d="M ${H} ${et} L ${H} ${K+O} A ${O} ${O} 0 0 1 ${H+O} ${K} L ${H+m-O} ${K} A ${O} ${O} 0 0 1 ${H+m} ${K+O} L ${H+m} ${et} Z" />
        </clipPath>
      `,i+=`
        <g class="chart-column-group" 
           data-header="${l.tooltipHeader}" 
           data-in="${D(l.inputTok)}" 
           data-out="${D(l.outTok)}" 
           data-cache="${D(l.cacheRead)}"
           data-total="${D(V)}"
           data-ctx="${l.ctx?q(l.ctx)+" ("+D(l.ctx)+")":""}"
           data-reqs="${D(l.requests||1)}"
           data-subtext="${l.subText||""}"
           data-center-x="${tt}"
           data-slot-x="${N}"
           data-slot-w="${u}"
           data-top-y="${at}"
           data-idx="${w}">
          
          <rect class="bar-bg-band" x="${N}" y="${T}" width="${u}" height="${o}" rx="4" />
          
          <g clip-path="url(#col-clip-${w})">
            ${_>0?`<rect class="bar-segment bar-cache" x="${H}" y="${dt}" width="${m}" height="${_}" fill="#00A67E" />`:""}
            ${Y>0?`<rect class="bar-segment bar-in" x="${H}" y="${ut}" width="${m}" height="${Y}" fill="#6366F1" opacity="0.85" />`:""}
            ${U>0?`<rect class="bar-segment bar-out" x="${H}" y="${at}" width="${m}" height="${U}" fill="var(--aura-primary)" />`:""}
          </g>
        </g>
      `}else i+=`
        <g class="chart-column-group" 
           data-header="${l.tooltipHeader}" 
           data-in="0" 
           data-out="0" 
           data-cache="0"
           data-total="0"
           data-ctx="${l.ctx?q(l.ctx)+" ("+D(l.ctx)+")":""}"
           data-reqs="0"
           data-subtext="${l.subText||""}"
           data-center-x="${tt}"
           data-slot-x="${N}"
           data-slot-w="${u}"
           data-top-y="${T+o}"
           data-idx="${w}">
          
          <rect class="bar-bg-band" x="${N}" y="${T}" width="${u}" height="${o}" rx="4" />
        </g>
      `;if(w%b===0||w===e.length-1)g+=`
        <text x="${tt}" y="${k-8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${l.label}</text>
      `}),x+="</defs>";let v=a?`
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
        <svg viewBox="0 0 48 ${k}" class="y-axis-svg">
          ${M}
        </svg>
      </div>
      <div class="chart-viewport-wrapper">
        ${d?`
          <div class="chart-fade-mask mask-left" id="chart-mask-left" style="opacity: 0;">
            <span class="mask-indicator">‹</span>
          </div>
          <div class="chart-fade-mask mask-right" id="chart-mask-right" style="opacity: 0;">
            <span class="mask-indicator">›</span>
          </div>
        `:""}
        <div class="chart-stage ${d?"chart-stage-scrollable":""}" id="chart-stage-container">
          <svg viewBox="0 0 ${h} ${k}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="analytics-svg-element" style="${d?`min-width: ${h}px;`:""}">
            ${x}
            ${C}
            ${i}
            ${g}
          </svg>
          <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
    </div>
  `,a)bt(t,e,n);if(d)setTimeout(()=>{let l=t.querySelector("#chart-stage-container"),w=t.querySelector("#chart-mask-left"),H=t.querySelector("#chart-mask-right");if(l){if(l.scrollLeft=l.scrollWidth,w&&H)Yt(l,w,H)}},50);Kt(t,h)}function Yt(t,e,n){function a(){let s=t.scrollWidth-t.clientWidth;if(s<=0){e.style.opacity="0",n.style.opacity="0";return}e.style.opacity=t.scrollLeft>14?"1":"0",n.style.opacity=s-t.scrollLeft>14?"1":"0"}t.addEventListener("scroll",a,{passive:!0}),a()}function Kt(t,e){let n=t.querySelector("#chart-floating-tooltip"),a=t.querySelector("#chart-stage-container"),s=t.querySelectorAll(".chart-column-group");if(!n||!a)return;s.forEach((r)=>{r.addEventListener("mouseenter",()=>{let c=r,p=c.getAttribute("data-header")||"",f=c.getAttribute("data-in")||"0",y=c.getAttribute("data-out")||"0",d=c.getAttribute("data-cache")||"0",L=c.getAttribute("data-total")||"0",h=c.getAttribute("data-ctx")||"",k=c.getAttribute("data-reqs")||"0",I=c.getAttribute("data-subtext")||"",E=h?`
        <div class="tooltip-row ctx-row">
          <span class="tooltip-dot" style="background: #3B82F6"></span>
          <span class="tooltip-label">Context Window</span>
          <span class="tooltip-val">${h}</span>
        </div>
      `:"";n.innerHTML=`
        <div class="tooltip-header">${p}</div>
        ${E}
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
          <span class="tooltip-label">Output Tokens</span>
          <span class="tooltip-val">${y}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #6366F1"></span>
          <span class="tooltip-label">Input Tokens</span>
          <span class="tooltip-val">${f}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #00A67E"></span>
          <span class="tooltip-label">Cache Read</span>
          <span class="tooltip-val">${d}</span>
        </div>
        <div class="tooltip-divider"></div>
        <div class="tooltip-row total-row">
          <span class="tooltip-label">Total Tokens</span>
          <span class="tooltip-val">${L}</span>
        </div>
        <div class="tooltip-subline">${k} generation requests${I?" · "+I:""}</div>
      `,n.style.display="block";let T=a.getBoundingClientRect(),o=(c.querySelector(".bar-bg-band")||c).getBoundingClientRect(),S=o.left-T.left+a.scrollLeft,u=o.right-T.left+a.scrollLeft,m=n.offsetWidth||180,M=n.offsetHeight||135,C=a.scrollLeft,x=a.scrollLeft+T.width,i=x-(u+12),g=S-12-C,b=0;if(i>=m+6&&(i>=g||g<m))b=u+12;else if(g>=m+6)b=S-m-12;else if(i>=g)b=Math.max(u+4,x-m-6);else b=Math.min(S-m-4,C+6);let v=10,l=T.height-M-12;if(l>10)v=Math.min(v,l);n.style.left=`${Math.round(b)}px`,n.style.top=`${Math.round(v)}px`}),r.addEventListener("mouseleave",()=>{n.style.display="none"})})}function Xt(t){let e=document.getElementById("analytics-projects-list");if(!e)return;if(!t||t.length===0){e.innerHTML='<div class="chart-empty">No workspace activity recorded</div>';return}let n=Math.max(...t.map((s)=>s.tokenCount),1),a=t.map((s)=>{let r=Math.max(4,Math.round(s.tokenCount/n*100)),c=s.projectId.split("/").filter(Boolean).pop()||s.projectId;return`
      <div class="project-stat-row">
        <div class="project-meta">
          <div class="project-name" title="${s.projectId}">${c}</div>
          <div class="project-counts">${s.conversationCount} sessions · ${q(s.tokenCount)} tokens</div>
        </div>
        <div class="project-bar-track">
          <div class="project-bar-fill" style="width: ${r}%"></div>
        </div>
      </div>
    `}).join("");e.innerHTML=a}function Jt(t){let e=document.getElementById("analytics-sessions-tbody");if(!e)return;if(!t||t.length===0){e.innerHTML='<tr><td colspan="4" class="empty-cell">No recent conversation sessions detected</td></tr>';return}let n=t.slice(0,15).map((a)=>{let s=a.title||"Untitled Session",r="Default";if(a.workspaceUris)try{let p=JSON.parse(a.workspaceUris);if(Array.isArray(p)&&p.length>0){let f=p[0].replace(/^file:\/\//,"").split("/").filter(Boolean).pop();if(f)r=decodeURIComponent(f)}}catch{}else if(a.projectId)r=a.projectId.split("/").filter(Boolean).pop()||a.projectId;let c=Dt(a.lastModifiedTime);return`
      <tr class="session-row">
        <td class="session-title-cell" title="${s}">${s}</td>
        <td class="session-project-cell"><span class="project-pill" title="${a.workspaceUris||a.projectId}">${r}</span></td>
        <td class="session-steps-cell">${a.stepCount} steps</td>
        <td class="session-time-cell">${c}</td>
      </tr>
    `}).join("");e.innerHTML=n}function Zt(t){switch(t){case"session":return"Active Session";case"today":return"Today (Hourly)";case"yesterday":return"Yesterday (Hourly)";case"this-week":return"This Week (Daily)";case"this-month":return"This Month (Daily)";case"last-7-days":return"Last 7 Days (Daily)";case"last-30-days":return"Last 30 Days (Daily)";case"custom":return"Custom Range";default:return"Token Activity"}}async function ct(t){lt=t;let e=document.getElementById("analytics-timerange-segmented");if(e)e.querySelectorAll(".segment-btn").forEach((a)=>{if(a.getAttribute("data-range")===t)a.classList.add("active");else a.classList.remove("active")});let n=document.getElementById("custom-range-inputs");if(n)n.style.display=t==="custom"?"flex":"none";if(t==="session"){if(!F)F=await kt()}if(z){let a=Wt(z,t);_t(a),Tt(a.columns,Zt(t))}}async function X(){let t=document.getElementById("btn-refresh-analytics");if(t)t.classList.add("loading");let[e,n,a]=await Promise.all([qt(),Pt(),kt()]);if(e)z=e;if(a)F=a;if(z)await ct(lt),Xt(z.topProjects);if(n)Jt(n);if(t)setTimeout(()=>t.classList.remove("loading"),300)}function wt(){let t=document.getElementById("analytics-timerange-segmented");if(t)t.querySelectorAll(".segment-btn").forEach((s)=>{s.addEventListener("click",()=>{let r=s.getAttribute("data-range");if(r)ct(r)})});let e=document.getElementById("custom-date-start"),n=document.getElementById("custom-date-end");document.getElementById("btn-apply-custom-range")?.addEventListener("click",()=>{if(e?.value&&n?.value)st=e.value,ot=n.value,ct("custom")})}var B=null,J=[];function W(t){let e=document.getElementById("toast");if(!e)return;e.textContent=t,e.classList.add("show"),setTimeout(()=>e.classList.remove("show"),2000)}async function A(t){try{let e=await window.sidecar.fetch("/api/config",{method:"POST",body:JSON.stringify(t)});if(e.ok)B=(await e.json()).config,W("Configuration applied in real-time");else W("Save failed")}catch(e){console.error("saveConfig failed:",e),W("Network error")}}function P(t,e){let n=document.getElementById(t);if(!n)return;n.querySelectorAll(".segment-btn").forEach((a)=>{if(a.getAttribute("data-val")===String(e))a.classList.add("active");else a.classList.remove("active")})}function Z(t,e,n,a){let s=document.getElementById(t);if(!s)return;s.innerHTML="";let r=document.createElement("option");r.value="default",r.textContent=e,s.appendChild(r);let c=document.createElement("optgroup");c.label="System Installed Fonts";for(let f of n){let y=document.createElement("option");y.value=f,y.textContent=f,c.appendChild(y)}s.appendChild(c);let p=document.createElement("option");if(p.value="custom",p.textContent="Custom font name...",s.appendChild(p),!a||a==="default")s.value="default";else if(n.includes(a))s.value=a;else s.value="custom"}async function xt(){try{let t=await window.sidecar.fetch("/api/system-fonts",{method:"GET"});if(t.ok){let e=await t.json();if(Array.isArray(e.fonts))J=e.fonts}}catch(t){console.error("loadSystemFonts failed:",t)}}async function $t(){try{let t=await window.sidecar.fetch("/api/config",{method:"GET"});if(!t.ok)return;let{config:e}=await t.json();B=e;let n=document.getElementById("select-language");if(n)n.value=e.language||"default";let a=e.presets?.light||"high-contrast",s=e.presets?.dark||"claude-dark";P("preset-light-segmented",a),P("preset-dark-segmented",s);let r=document.getElementById("toggle-wax-seal");if(r)r.checked=e.composer?.waxSeal!==!1;let c=e.typography||{};Z("select-font-sans-primary","Default",J,c.primarySans),Z("select-font-sans-fallback","Default",J,c.fallbackSans),Z("select-font-mono","Default",J,c.mono);let p=document.getElementById("select-font-sans-primary"),f=document.getElementById("row-custom-sans-primary"),y=document.getElementById("input-custom-sans-primary");if(p&&f){if(f.style.display=p.value==="custom"?"flex":"none",y)y.value=c.customPrimarySans||""}let d=document.getElementById("select-font-sans-fallback"),L=document.getElementById("row-custom-sans-fallback"),h=document.getElementById("input-custom-sans-fallback");if(d&&L){if(L.style.display=d.value==="custom"?"flex":"none",h)h.value=c.customFallbackSans||""}let k=document.getElementById("select-font-mono"),I=document.getElementById("row-custom-mono"),E=document.getElementById("input-custom-mono");if(k&&I){if(I.style.display=k.value==="custom"?"flex":"none",E)E.value=c.customMono||""}P("font-size-segmented",c.fontSize||16);let T=e.composer?.collinear!==!1?"collinear":"native";P("composer-align-segmented",T);let R=document.getElementById("toggle-hide-arrows");if(R)R.checked=e.composer?.hideArrows!==!1;let o=document.getElementById("toggle-metrics");if(o)o.checked=e.telemetry?.enabled!==!1;P("metrics-interval-segmented",e.telemetry?.interval||2000)}catch(t){console.error("loadConfig failed:",t)}}async function Q(){try{let t=await window.sidecar.fetch("/api/status",{method:"GET"});if(!t.ok)return;let e=await t.json(),n=document.getElementById("status-dot"),a=document.getElementById("status-text"),s=document.getElementById("status-sublabel");if(e.connected){if(n)n.classList.remove("disconnected");if(a)a.textContent="Connected";if(s)s.textContent=`Connected to host (${e.targetCount||1} window(s) · port ${e.cdpPort||"-"})`}else{if(n)n.classList.add("disconnected");if(a)a.textContent="Searching window...";if(s)s.textContent="Detecting Antigravity CDP port..."}}catch(t){console.error("updateStatus failed:",t)}}async function Et(){ft(),j(),await xt(),await $t(),Q(),setInterval(Q,3000);let t=document.getElementById("select-language");if(t)t.addEventListener("change",()=>{A({language:t.value})});let e=document.getElementById("preset-light-segmented");if(e)e.querySelectorAll(".segment-btn").forEach((i)=>{i.addEventListener("click",()=>{let g=i.getAttribute("data-val")||"high-contrast";P("preset-light-segmented",g),A({presets:{...B?.presets,light:g}})})});let n=document.getElementById("preset-dark-segmented");if(n)n.querySelectorAll(".segment-btn").forEach((i)=>{i.addEventListener("click",()=>{let g=i.getAttribute("data-val")||"claude-dark";P("preset-dark-segmented",g),A({presets:{...B?.presets,dark:g}})})});let a=document.getElementById("toggle-wax-seal");if(a)a.addEventListener("change",()=>{A({composer:{...B?.composer,waxSeal:a.checked}})});let s=document.getElementById("select-font-sans-primary"),r=document.getElementById("row-custom-sans-primary"),c=document.getElementById("input-custom-sans-primary");if(s)s.addEventListener("change",()=>{let i=s.value==="custom";if(r)r.style.display=i?"flex":"none";if(!i)A({typography:{...B?.typography,primarySans:s.value}});else if(c)c.focus()});if(c){let i=()=>{if(s&&s.value==="custom")A({typography:{...B?.typography,primarySans:"custom",customPrimarySans:c.value.trim()}})};c.addEventListener("change",i),c.addEventListener("keydown",(g)=>{if(g.key==="Enter")i(),c.blur()})}let p=document.getElementById("select-font-sans-fallback"),f=document.getElementById("row-custom-sans-fallback"),y=document.getElementById("input-custom-sans-fallback");if(p)p.addEventListener("change",()=>{let i=p.value==="custom";if(f)f.style.display=i?"flex":"none";if(!i)A({typography:{...B?.typography,fallbackSans:p.value}});else if(y)y.focus()});if(y){let i=()=>{if(p&&p.value==="custom")A({typography:{...B?.typography,fallbackSans:"custom",customFallbackSans:y.value.trim()}})};y.addEventListener("change",i),y.addEventListener("keydown",(g)=>{if(g.key==="Enter")i(),y.blur()})}let d=document.getElementById("select-font-mono"),L=document.getElementById("row-custom-mono"),h=document.getElementById("input-custom-mono");if(d)d.addEventListener("change",()=>{let i=d.value==="custom";if(L)L.style.display=i?"flex":"none";if(!i)A({typography:{...B?.typography,mono:d.value}});else if(h)h.focus()});if(h){let i=()=>{if(d&&d.value==="custom")A({typography:{...B?.typography,mono:"custom",customMono:h.value.trim()}})};h.addEventListener("change",i),h.addEventListener("keydown",(g)=>{if(g.key==="Enter")i(),h.blur()})}let k=document.getElementById("font-size-segmented");if(k)k.querySelectorAll(".segment-btn").forEach((i)=>{i.addEventListener("click",()=>{let g=Number(i.getAttribute("data-val"));P("font-size-segmented",g),A({typography:{...B?.typography,fontSize:g}})})});let I=document.getElementById("composer-align-segmented");if(I)I.querySelectorAll(".segment-btn").forEach((i)=>{i.addEventListener("click",()=>{let g=i.getAttribute("data-val");P("composer-align-segmented",g||"collinear"),A({composer:{...B?.composer,collinear:g==="collinear"}})})});let E=document.getElementById("toggle-hide-arrows");if(E)E.addEventListener("change",()=>{A({composer:{...B?.composer,hideArrows:E.checked}})});let T=document.getElementById("toggle-metrics");if(T)T.addEventListener("change",()=>{A({telemetry:{...B?.telemetry,enabled:T.checked}})});let R=document.getElementById("metrics-interval-segmented");if(R)R.querySelectorAll(".segment-btn").forEach((i)=>{i.addEventListener("click",()=>{let g=Number(i.getAttribute("data-val"));P("metrics-interval-segmented",g),A({telemetry:{...B?.telemetry,interval:g}})})});let o=document.getElementById("btn-force-reload");if(o)o.addEventListener("click",async()=>{o.disabled=!0,o.style.opacity="0.6";try{if((await window.sidecar.fetch("/api/reload",{method:"POST"})).ok)W("Styles recompiled and re-applied"),await Q();else W("Reload failed")}catch(i){W("Request error")}finally{o.disabled=!1,o.style.opacity="1"}});let S=document.getElementById("tab-nav-analytics"),u=document.getElementById("tab-nav-settings"),m=document.getElementById("view-analytics"),M=document.getElementById("view-settings"),C=(i)=>{if(i==="analytics"){if(S?.classList.add("active"),u?.classList.remove("active"),m)m.style.display="block";if(M)M.style.display="none";X()}else{if(u?.classList.add("active"),S?.classList.remove("active"),M)M.style.display="block";if(m)m.style.display="none"}};S?.addEventListener("click",()=>C("analytics")),u?.addEventListener("click",()=>C("settings")),document.getElementById("btn-refresh-analytics")?.addEventListener("click",()=>X()),wt(),X()}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",Et);else Et();})();

//# debugId=FB9589671F1BBD6664756E2164756E21
