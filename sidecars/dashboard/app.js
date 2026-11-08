(()=>{var{defineProperty:bt,getOwnPropertyNames:Ut,getOwnPropertyDescriptor:Jt}=Object,Kt=Object.prototype.hasOwnProperty;function Zt(t){return this[t]}var Qt=(t)=>{var e=(Lt??=new WeakMap).get(t),o;if(e)return e;if(e=bt({},"__esModule",{value:!0}),t&&typeof t==="object"||typeof t==="function"){for(var a of Ut(t))if(!Kt.call(e,a))bt(e,a,{get:Zt.bind(t,a),enumerable:!(o=Jt(t,a))||o.enumerable})}return Lt.set(t,e),e},Lt;var Vt=(t)=>t;function te(t,e){this[t]=Vt.bind(null,e)}var ee=(t,e)=>{for(var o in e)bt(t,o,{get:e[o],enumerable:!0,configurable:!0,set:te.bind(e,o)})};var ge={};ee(ge,{loadConfig:()=>Yt,loadSystemFonts:()=>Xt,populateFontSelect:()=>vt,saveConfig:()=>X,showToast:()=>lt,updateSegmentedUI:()=>ot,updateStatus:()=>kt});var rt=null;function Ct(t,e,o){let a=(s)=>{let m=s/255;return m<=0.03928?m/12.92:Math.pow((m+0.055)/1.055,2.4)};return 0.2126*a(t)+0.7152*a(e)+0.0722*a(o)}function At(t){if(!t)return null;let e=t.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);if(e)return{r:parseInt(e[1],10),g:parseInt(e[2],10),b:parseInt(e[3],10),alpha:e[4]!==void 0?parseFloat(e[4]):1};return null}function ae(){if(rt==="light"||rt==="dark")return rt;let t=document.documentElement.style.colorScheme;if(t==="light"||t==="dark")return t;let e=document.createElement("div");e.setAttribute("aria-hidden","true"),e.style.cssText="position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;background-color:var(--background, var(--vscode-editor-background, transparent))",(document.body||document.documentElement).appendChild(e);try{let o=window.getComputedStyle(e).backgroundColor,a=At(o);if(a&&a.alpha>0)return Ct(a.r,a.g,a.b)>0.179?"light":"dark"}catch(o){}finally{e.remove()}if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)return"dark";return"light"}function it(t){let e=t||ae(),o=document.documentElement;if(o.getAttribute("data-theme")!==e)o.setAttribute("data-theme",e);if(o.style.colorScheme!==e)o.style.colorScheme=e}function Rt(){if(window.addEventListener("message",(t)=>{if(t.data?.type==="ag-theme-sync"){let e=t.data.payload||{};if(e.scheme==="light"||e.scheme==="dark")rt=e.scheme,it(rt)}else if(t.data?.type==="theme-change"){let e=t.data?.payload?.cssVariables;if(e&&typeof e["--background"]==="string"){let o=At(e["--background"]);if(o)rt=Ct(o.r,o.g,o.b)>0.179?"light":"dark"}it(rt||void 0)}}),window.matchMedia){let t=window.matchMedia("(prefers-color-scheme: dark)"),e=()=>it();if(typeof t.addEventListener==="function")t.addEventListener("change",e);else if(typeof t.addListener==="function")t.addListener(e)}if(typeof MutationObserver<"u")new MutationObserver(()=>{it()}).observe(document.documentElement,{attributes:!0,attributeFilter:["style","data-theme"]});it()}function W(t){if(!t||t<=0)return"0";if(t>=1e9)return(t/1e9).toFixed(2)+"B";if(t>=1e6)return(t/1e6).toFixed(1)+"M";if(t>=1e4)return Math.round(t/1000)+"k";if(t>=1000)return(t/1000).toFixed(1)+"k";return String(Math.round(t))}function U(t){return(t||0).toLocaleString("en-US")}function Bt(t){if(!t||t.length<10)return t;try{return new Date(t+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}catch{return t.slice(5)}}function Dt(t){if(!t||t.length<10)return t;try{return new Date(t+"T00:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}catch{return t}}var at=null,ut="last-30-days",ht="",gt="",G=null;async function oe(){try{let t=await window.sidecar.fetch("/api/analytics/overview",{method:"GET"});if(!t.ok)return null;let e=await t.json();return e.ok?e.data:null}catch(t){return console.error("[Aura Analytics] Failed to fetch overview:",t),null}}async function Ht(){try{let e=new URLSearchParams(window.location.search).get("conversationId")||window.sidecar?.conversationId||"",o=e?`/api/analytics/session?id=${encodeURIComponent(e)}`:"/api/analytics/session",a=await window.sidecar.fetch(o,{method:"GET"});if(!a.ok)return null;let s=await a.json();return s.ok?s.data:null}catch(t){return console.error("[Aura Analytics] Failed to fetch active session:",t),null}}function Mt(){let t=new Date;return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}function St(){let t=new Date(Date.now()-86400000);return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}function qt(){let t=new Date,e=t.getDay(),o=t.getDate()-e+(e===0?-6:1),a=new Date(t.setDate(o));return a.getFullYear()+"-"+String(a.getMonth()+1).padStart(2,"0")+"-"+String(a.getDate()).padStart(2,"0")}function Ot(){let t=new Date;return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-01"}function pt(t){let e=new Date(Date.now()-t*86400000);return e.getFullYear()+"-"+String(e.getMonth()+1).padStart(2,"0")+"-"+String(e.getDate()).padStart(2,"0")}function ct(t,e){let o=[],a=new Date(t+"T00:00:00"),s=new Date(e+"T00:00:00");if(isNaN(a.getTime())||isNaN(s.getTime())||a>s)return[t];while(a<=s){let m=a.getFullYear(),i=String(a.getMonth()+1).padStart(2,"0"),n=String(a.getDate()).padStart(2,"0");o.push(`${m}-${i}-${n}`),a.setDate(a.getDate()+1)}return o}function se(t,e){let o=Mt(),a=St();if(e==="session"&&G&&G.steps.length>0){let f=G;return{columns:f.steps.map((b)=>{let B=b.ctx||b.inTok+b.cacheRead;return{label:`#${b.idx+1}`,tooltipHeader:`Session Turn #${b.idx+1}`,inputTok:b.inTok,outTok:b.outTok,cacheRead:b.cacheRead,ctx:B,requests:1,subText:`Context: ${W(B)} · Speed: ${Math.round(b.stream>0?b.outTok/b.stream:0)} tok/s`}}),totalTokens:f.totalTokens,totalRequests:f.totalRequests,cacheEfficiency:f.cacheEfficiency,avgTtft:f.avgTtft,avgTokPerSec:f.avgTokPerSec}}if(e==="today"||e==="yesterday"){let f=e==="today"?o:a,S={};for(let d=0;d<24;d++){let v=String(d).padStart(2,"0"),r=`${f} ${v}:00`;S[r]={label:`${v}:00`,tooltipHeader:`${f} ${v}:00 - ${v}:59`,inputTok:0,outTok:0,cacheRead:0,requests:0}}for(let d of t.hourlySeries||[])if(d.hourKey&&d.hourKey.startsWith(f)){let v=d.hourKey.slice(0,16);if(S[v])S[v].inputTok+=d.inputTok,S[v].outTok+=d.outTok,S[v].cacheRead+=d.cacheRead,S[v].requests+=d.requests}let b=Object.values(S),B=0,O=0,P=0,g=0;for(let d of b)B+=d.inputTok,O+=d.outTok,P+=d.cacheRead,g+=d.requests;let y=B+O+P,H=B+P,T=H>0?P/H*100:t.cacheEfficiency;return{columns:b,totalTokens:{input:B,output:O,cacheRead:P,thinking:t.totalTokens.thinking,total:y},totalRequests:g,cacheEfficiency:T,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}let s="0000-00-00",m=o;if(e==="this-week"){s=qt();let f=new Date(s+"T00:00:00");f.setDate(f.getDate()+6),m=f.getFullYear()+"-"+String(f.getMonth()+1).padStart(2,"0")+"-"+String(f.getDate()).padStart(2,"0")}else if(e==="this-month")s=Ot(),m=o;else if(e==="last-7-days")s=pt(6),m=o;else if(e==="last-30-days")s=pt(29),m=o;else if(e==="custom"){if(ht&&gt)s=ht,m=gt}let i={};for(let f of t.timeRangeSeries||[])if(f.date&&!f.date.startsWith("0001"))i[f.date]={inputTok:f.inputTok,outTok:f.outTok,cacheRead:f.cacheRead,requests:f.requests||1};let n=ct(s,m),p=new Date(s+"T00:00:00").getTime(),c=new Date(m+"T00:00:00").getTime();if(Math.round((c-p)/86400000)>90){let f={};for(let T of n){let d=i[T]||{inputTok:0,outTok:0,cacheRead:0,requests:0},v=new Date(T+"T00:00:00"),r=Math.floor(v.getDate()/7)+1,h=`${T.slice(0,7)} W${r}`;if(!f[h])f[h]={label:h.slice(5),tooltipHeader:`Week of ${T}`,inputTok:0,outTok:0,cacheRead:0,requests:0};f[h].inputTok+=d.inputTok,f[h].outTok+=d.outTok,f[h].cacheRead+=d.cacheRead,f[h].requests+=d.requests}let S=Object.values(f),b=0,B=0,O=0,P=0;for(let T of S)b+=T.inputTok,B+=T.outTok,O+=T.cacheRead,P+=T.requests;let g=b+B+O,y=b+O,H=y>0?O/y*100:t.cacheEfficiency;return{columns:S,totalTokens:{input:b,output:B,cacheRead:O,thinking:t.totalTokens.thinking,total:g},totalRequests:P,cacheEfficiency:H,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}let k=n.map((f)=>{let S=i[f]||{inputTok:0,outTok:0,cacheRead:0,requests:0};return{label:Bt(f),tooltipHeader:Dt(f),inputTok:S.inputTok,outTok:S.outTok,cacheRead:S.cacheRead,requests:S.requests}}),u=0,x=0,R=0,M=0;for(let f of k)u+=f.inputTok,x+=f.outTok,R+=f.cacheRead,M+=f.requests;let C=u+x+R,I=u+R,w=I>0?R/I*100:t.cacheEfficiency;return{columns:k,totalTokens:{input:u,output:x,cacheRead:R,thinking:t.totalTokens.thinking,total:C},totalRequests:M,cacheEfficiency:w,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}function ne(t){let e=document.getElementById("analytics-cards-grid");if(!e)return;let o=t.totalTokens.total,a=t.totalTokens.input,s=t.totalTokens.output,m=t.totalTokens.cacheRead,i=t.totalRequests;e.innerHTML=`
    <!-- Row 1: Primary Metrics -->
    <div class="kpi-grid-primary">
      <div class="kpi-card kpi-card-featured">
        <div class="kpi-label">Total Tokens Processed</div>
        <div class="kpi-value">${W(o)}</div>
        <div class="kpi-breakdown">
          <span class="kpi-tag tag-cached">Cache: ${W(m)}</span>
          <span class="kpi-tag tag-input">In: ${W(a)}</span>
          <span class="kpi-tag tag-output">Out: ${W(s)}</span>
        </div>
      </div>

      <div class="kpi-card kpi-card-featured">
        <div class="kpi-label">Total Requests</div>
        <div class="kpi-value">${U(i)}</div>
        <div class="kpi-subtext">Completed model inferences for the selected range</div>
      </div>
    </div>

    <!-- Row 2: Secondary Performance Metrics -->
    <div class="kpi-grid-secondary">
      <div class="kpi-card">
        <div class="kpi-label">Cache Cost Efficiency</div>
        <div class="kpi-value">${t.cacheEfficiency.toFixed(1)}%</div>
        <div class="kpi-subtext">Prompt caching saved ~${W(m)} tokens from reprocessing</div>
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
  `}var $t="overview";function Pt(t,e){let o=document.getElementById("analytics-activity-chart");if(!o)return;if(!t||t.length===0){o.innerHTML=`
      <div class="chart-header">
        <div class="chart-title">${e}</div>
      </div>
      <div class="chart-empty">No activity data recorded in the selected range</div>
    `;return}let a=ut==="session"&&!!G&&G.steps.length>0;if(a&&$t==="overview")ie(o,G,e,t);else ce(o,t,e,a)}function jt(t,e,o){t.querySelectorAll("#session-view-segmented .segment-btn").forEach((s)=>{s.addEventListener("click",(m)=>{m.stopPropagation();let i=s.getAttribute("data-mode");if(i&&i!==$t)$t=i,Pt(e,o)})})}function ie(t,e,o,a){let s=e.steps,m=s.length;if(m===0)return;let i=Math.max(...s.map((y)=>y.ctx||y.inTok+y.cacheRead),1000),n=Math.pow(10,Math.floor(Math.log10(i))),p=i/n,c=n;if(p<=2)c=0.5*n;else if(p<=5)c=1*n;else c=2*n;let l=Math.ceil(i/(c*4))*(c*4)||c*4,k=[0,l*0.25,l*0.5,l*0.75,l],u=220,x=24,R=30,M=u-x-R,C="";k.forEach((y)=>{let H=x+M-y/l*M;C+=`
      <text x="40" y="${H+3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${W(y)}</text>
      <line x1="43" y1="${H}" x2="48" y2="${H}" stroke="var(--aura-border)" stroke-width="1" opacity="${y===0?"0.7":"0.3"}" />
    `});let I=600,w=14,f=28,S=I-w-f,b="";k.forEach((y)=>{let H=x+M-y/l*M;b+=`
      <line x1="${w}" y1="${H}" x2="${w+S}" y2="${H}" stroke="var(--aura-border)" stroke-width="1" opacity="${y===0?"0.6":"0.2"}" />
    `});let B=`M ${w},${x+M}`,O="",P="",g=Math.max(1,Math.floor(m/6));s.forEach((y,H)=>{let T=y.ctx||y.inTok+y.cacheRead,d=w+(m>1?H/(m-1)*S:0),v=x+M-T/l*M;if(H===0)B+=` L ${d.toFixed(1)},${v.toFixed(1)}`,O=`M ${d.toFixed(1)},${v.toFixed(1)}`;else B+=` L ${d.toFixed(1)},${v.toFixed(1)}`,O+=` L ${d.toFixed(1)},${v.toFixed(1)}`;let r=m-1-H<g*0.7;if(H%g===0&&!r){let h=H===0?"start":"middle";P+=`
        <text x="${d.toFixed(1)}" y="${u-8}" text-anchor="${h}" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#${H+1}</text>
      `}}),B+=` L ${w+S},${x+M} Z`,t.innerHTML=`
    <div class="chart-header">
      <div class="chart-header-left">
        <div class="chart-title">Token Activity (${o})</div>
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
        <svg viewBox="0 0 48 ${u}" class="y-axis-svg">
          ${C}
        </svg>
      </div>
      <div class="chart-viewport-wrapper">
        <div class="chart-stage" id="chart-stage-container">
          <svg viewBox="0 0 ${I} ${u}" preserveAspectRatio="none" class="analytics-svg" id="analytics-svg-element">
            <defs>
              <linearGradient id="aura-ctx-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#00A67E" stop-opacity="0.45" />
                <stop offset="65%" stop-color="#00A67E" stop-opacity="0.12" />
                <stop offset="100%" stop-color="#00A67E" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            ${b}
            <path d="${B}" fill="url(#aura-ctx-grad)" />
            <path d="${O}" fill="none" stroke="#00A67E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            ${P}
          </svg>
          <div class="chart-scrubber-line" id="chart-scrubber-line" style="display: none;"></div>
          <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
    </div>
  `,jt(t,a,o),re(t,s)}function re(t,e){let o=t.querySelector("#chart-stage-container"),a=t.querySelector("#chart-scrubber-line"),s=t.querySelector("#chart-floating-tooltip");if(!o||!a||!s)return;o.addEventListener("mousemove",(m)=>{let i=o.getBoundingClientRect(),n=Math.max(0,Math.min(m.clientX-i.left,i.width)),p=i.width>0?n/i.width:0,c=Math.min(e.length-1,Math.max(0,Math.round(p*(e.length-1)))),l=e[c];if(!l)return;let k=l.ctx||l.inTok+l.cacheRead,u=Math.round(l.stream>0?l.outTok/l.stream:0);a.style.display="block",a.style.transform=`translateX(${n}px)`,s.innerHTML=`
      <div class="tooltip-header">Session Turn #${l.idx+1}</div>
      <div class="tooltip-row ctx-row">
        <span class="tooltip-dot" style="background: #3B82F6"></span>
        <span class="tooltip-label">Context Window</span>
        <span class="tooltip-val">${W(k)} (${U(k)})</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: #00A67E"></span>
        <span class="tooltip-label">Cache Read</span>
        <span class="tooltip-val">${U(l.cacheRead)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: #6366F1"></span>
        <span class="tooltip-label">Input Tokens</span>
        <span class="tooltip-val">${U(l.inTok)}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
        <span class="tooltip-label">Output Tokens</span>
        <span class="tooltip-val">${U(l.outTok)}</span>
      </div>
      <div class="tooltip-divider"></div>
      <div class="tooltip-subline">Speed: ${u} tok/s · TTFT: ${l.ttft.toFixed(2)}s</div>
    `,s.style.display="block";let x=s.offsetWidth||180,R=s.offsetHeight||135,M=0;if(n>i.width/2)M=n-x-16;else M=n+16;M=Math.max(8,Math.min(M,i.width-x-8));let C=10,I=i.height-R-12;if(I>10)C=Math.min(C,I);s.style.left=`${Math.round(M)}px`,s.style.top=`${Math.round(C)}px`}),o.addEventListener("mouseleave",()=>{a.style.display="none",s.style.display="none"})}function ce(t,e,o,a){let s=Math.max(...e.map((r)=>r.inputTok+r.outTok+r.cacheRead),1000),m=Math.pow(10,Math.floor(Math.log10(s))),i=s/m,n=m;if(i<=2)n=0.5*m;else if(i<=5)n=1*m;else n=2*m;let p=Math.ceil(s/(n*4))*(n*4)||n*4,c=[0,p*0.25,p*0.5,p*0.75,p],l=e.length>40,k=l?10:Math.max(6,Math.floor(540/e.length)),u=l?Math.max(580,e.length*k+40):580,x=220,R=10,M=14,C=24,I=30,w=x-C-I,S=(u-R-M)/e.length,b=Math.max(3,Math.min(22,Math.floor(S*0.72))),B="";c.forEach((r)=>{let h=C+w-r/p*w;B+=`
      <text x="40" y="${h+3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${W(r)}</text>
      <line x1="43" y1="${h}" x2="48" y2="${h}" stroke="var(--aura-border)" stroke-width="1" opacity="${r===0?"0.7":"0.3"}" />
    `});let O="";c.forEach((r)=>{let h=C+w-r/p*w;O+=`
      <line x1="0" y1="${h}" x2="${u}" y2="${h}" stroke="var(--aura-border)" stroke-width="1" opacity="${r===0?"0.6":"0.2"}" />
    `});let P="<defs>",g="",y="",H=e.length===24&&(e[0]?.label.includes(":00")||!1),T=e[0]?.label.startsWith("#")||!1,d=H?3:Math.max(1,Math.floor(e.length/8));e.forEach((r,h)=>{let E=R+h*S+(S-b)/2,q=r.inputTok+r.outTok+r.cacheRead,J=R+h*S,N=E+b/2;if(q>0){let V=Math.max(3,Math.round(q/p*w)),tt=r.outTok>0?Math.max(1,Math.round(r.outTok/p*w)):0,st=r.inputTok>0?Math.max(1,Math.round(r.inputTok/p*w)):0,et=r.cacheRead>0?Math.max(1,V-tt-st):0;if(et<0)et=0;let L=C+w,_=L-et,z=_-st,A=z-tt,F=A,D=Math.min(3.5,b/2,V);P+=`
        <clipPath id="col-clip-${h}">
          <path d="M ${E} ${L} L ${E} ${F+D} A ${D} ${D} 0 0 1 ${E+D} ${F} L ${E+b-D} ${F} A ${D} ${D} 0 0 1 ${E+b} ${F+D} L ${E+b} ${L} Z" />
        </clipPath>
      `,g+=`
        <g class="chart-column-group" 
           data-header="${r.tooltipHeader}" 
           data-in="${U(r.inputTok)}" 
           data-out="${U(r.outTok)}" 
           data-cache="${U(r.cacheRead)}"
           data-total="${U(q)}"
           data-ctx="${r.ctx?W(r.ctx)+" ("+U(r.ctx)+")":""}"
           data-reqs="${U(r.requests||1)}"
           data-subtext="${r.subText||""}"
           data-center-x="${N}"
           data-slot-x="${J}"
           data-slot-w="${S}"
           data-top-y="${A}"
           data-idx="${h}">
          
          <rect class="bar-bg-band" x="${J}" y="${C}" width="${S}" height="${w}" rx="4" />
          
          <g clip-path="url(#col-clip-${h})">
            ${et>0?`<rect class="bar-segment bar-cache" x="${E}" y="${_}" width="${b}" height="${et}" fill="#00A67E" />`:""}
            ${st>0?`<rect class="bar-segment bar-in" x="${E}" y="${z}" width="${b}" height="${st}" fill="#6366F1" opacity="0.85" />`:""}
            ${tt>0?`<rect class="bar-segment bar-out" x="${E}" y="${A}" width="${b}" height="${tt}" fill="var(--aura-primary)" />`:""}
          </g>
        </g>
      `}else g+=`
        <g class="chart-column-group" 
           data-header="${r.tooltipHeader}" 
           data-in="0" 
           data-out="0" 
           data-cache="0"
           data-total="0"
           data-ctx="${r.ctx?W(r.ctx)+" ("+U(r.ctx)+")":""}"
           data-reqs="0"
           data-subtext="${r.subText||""}"
           data-center-x="${N}"
           data-slot-x="${J}"
           data-slot-w="${S}"
           data-top-y="${C+w}"
           data-idx="${h}">
          
          <rect class="bar-bg-band" x="${J}" y="${C}" width="${S}" height="${w}" rx="4" />
        </g>
      `;let Z=!1;if(H)Z=h%3===0&&h<23;else if(T){let V=e.length-1-h<d*0.7;Z=h%d===0&&!V}else{let V=e.length-1-h<d*0.45;Z=h%d===0&&!V||h===e.length-1&&(e.length-1)%d>=Math.floor(d/2)}if(Z)y+=`
        <text x="${N}" y="${x-8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${r.label}</text>
      `}),P+="</defs>";let v=a?`
    <div class="segmented-control mini-segmented" id="session-view-segmented">
      <button class="segment-btn" data-mode="overview">Overview</button>
      <button class="segment-btn active" data-mode="timeline">Timeline</button>
    </div>
  `:"";if(t.innerHTML=`
    <div class="chart-header">
      <div class="chart-header-left">
        <div class="chart-title">Token Activity (${o})</div>
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
        <svg viewBox="0 0 48 ${x}" class="y-axis-svg">
          ${B}
        </svg>
      </div>
      <div class="chart-viewport-wrapper">
        ${l?`
          <div class="chart-fade-mask mask-left" id="chart-mask-left" style="opacity: 0;">
            <span class="mask-indicator">‹</span>
          </div>
          <div class="chart-fade-mask mask-right" id="chart-mask-right" style="opacity: 0;">
            <span class="mask-indicator">›</span>
          </div>
        `:""}
        <div class="chart-stage ${l?"chart-stage-scrollable":""}" id="chart-stage-container">
          <svg viewBox="0 0 ${u} ${x}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="analytics-svg-element" style="${l?`min-width: ${u}px;`:""}">
            ${P}
            ${O}
            <rect id="chart-shared-hover-band" class="chart-shared-hover-band" x="0" y="${C}" width="0" height="${w}" rx="4" style="display: none;" />
            ${g}
            ${y}
          </svg>
          <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
        </div>
      </div>
    </div>
  `,a)jt(t,e,o);if(l)setTimeout(()=>{let r=t.querySelector("#chart-stage-container"),h=t.querySelector("#chart-mask-left"),E=t.querySelector("#chart-mask-right");if(r){if(r.scrollLeft=r.scrollWidth,h&&E)le(r,h,E)}},50);de(t,u)}function le(t,e,o){function a(){let s=t.scrollWidth-t.clientWidth;if(s<=0){e.style.opacity="0",o.style.opacity="0";return}e.style.opacity=t.scrollLeft>14?"1":"0",o.style.opacity=s-t.scrollLeft>14?"1":"0"}t.addEventListener("scroll",a,{passive:!0}),a()}function de(t,e){let o=t.querySelector("#chart-floating-tooltip"),a=t.querySelector("#chart-stage-container"),s=t.querySelector("#chart-shared-hover-band"),m=t.querySelectorAll(".chart-column-group");if(!o||!a)return;let i=null;m.forEach((n)=>{n.addEventListener("mouseenter",()=>{let p=n,c=p.getAttribute("data-idx");if(c===i)return;i=c;let l=p.getAttribute("data-header")||"",k=p.getAttribute("data-in")||"0",u=p.getAttribute("data-out")||"0",x=p.getAttribute("data-cache")||"0",R=p.getAttribute("data-total")||"0",M=p.getAttribute("data-ctx")||"",C=p.getAttribute("data-reqs")||"0",I=p.getAttribute("data-subtext")||"",w=parseFloat(p.getAttribute("data-slot-x")||"0"),f=parseFloat(p.getAttribute("data-slot-w")||"0");if(s)s.setAttribute("x",String(w)),s.setAttribute("width",String(f)),s.style.display="block",s.style.opacity="1";let S=M?`
        <div class="tooltip-row ctx-row">
          <span class="tooltip-dot" style="background: #3B82F6"></span>
          <span class="tooltip-label">Context Window</span>
          <span class="tooltip-val">${M}</span>
        </div>
      `:"";o.innerHTML=`
        <div class="tooltip-header">${l}</div>
        ${S}
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
          <span class="tooltip-label">Output Tokens</span>
          <span class="tooltip-val">${u}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #6366F1"></span>
          <span class="tooltip-label">Input Tokens</span>
          <span class="tooltip-val">${k}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #00A67E"></span>
          <span class="tooltip-label">Cache Read</span>
          <span class="tooltip-val">${x}</span>
        </div>
        <div class="tooltip-divider"></div>
        <div class="tooltip-row total-row">
          <span class="tooltip-label">Total Tokens</span>
          <span class="tooltip-val">${R}</span>
        </div>
        <div class="tooltip-subline">${C} generation requests${I?" · "+I:""}</div>
      `,o.style.display="block",o.style.opacity="1";let b=a.getBoundingClientRect(),O=(p.querySelector(".bar-bg-band")||p).getBoundingClientRect(),P=O.left-b.left+a.scrollLeft,g=O.right-b.left+a.scrollLeft,y=o.offsetWidth||180,H=o.offsetHeight||135,T=a.scrollLeft,d=a.scrollLeft+b.width,v=d-(g+12),r=P-12-T,h=0;if(v>=y+6&&(v>=r||r<y))h=g+12;else if(r>=y+6)h=P-y-12;else if(v>=r)h=Math.max(g+4,d-y-6);else h=Math.min(P-y-4,T+6);let E=10,q=b.height-H-12;if(q>10)E=Math.min(E,q);o.style.left=`${Math.round(h)}px`,o.style.top=`${Math.round(E)}px`})}),a.addEventListener("mouseleave",()=>{if(i=null,s)s.setAttribute("width","0"),s.style.display="none";o.style.display="none"})}function ue(t){let e=document.getElementById("analytics-projects-list");if(!e)return;if(!t||t.length===0){e.innerHTML='<div class="chart-empty">No workspace activity recorded</div>';return}let o=Math.max(...t.map((s)=>s.tokenCount),1),a=t.map((s)=>{let m=Math.max(4,Math.round(s.tokenCount/o*100)),i=s.projectId.split("/").filter(Boolean).pop()||s.projectId;return`
      <div class="project-stat-row">
        <div class="project-meta">
          <div class="project-name" title="${s.projectId}">${i}</div>
          <div class="project-counts">${s.conversationCount} sessions · ${W(s.tokenCount)} tokens</div>
        </div>
        <div class="project-bar-track">
          <div class="project-bar-fill" style="width: ${m}%"></div>
        </div>
      </div>
    `}).join("");e.innerHTML=a}var Ft={"Gemini 3.8 Flash":"#00A67E","Gemini 3.8 Flash (High)":"#8B5CF6","Gemini 3.8 Flash (Exp)":"#3B82F6","Gemini 3.7 Flash":"#EC4899","Claude Opus 4.6 Thinking":"#D97706","Gemini 4 Argon (Medium)":"#06B6D4","Gemini 3.1 Pro":"#10B981","Gemini 3.8 Flash (Tiered)":"#6366F1","Gemini 3 Flash B":"#F59E0B","Gemini 3.7 Flash (High)":"#A855F7"},It=["#00A67E","#8B5CF6","#3B82F6","#D97706","#EC4899","#06B6D4","#10B981","#6366F1","#F43F5E"];function mt(t,e=0){if(Ft[t])return Ft[t];return It[e%It.length]}function Et(t){let e=Mt();if(t==="today")return[e];if(t==="yesterday")return[St()];if(t==="this-week"){let o=qt(),a=new Date(o+"T00:00:00");a.setDate(a.getDate()+6);let s=a.getFullYear()+"-"+String(a.getMonth()+1).padStart(2,"0")+"-"+String(a.getDate()).padStart(2,"0");return ct(o,s)}if(t==="this-month")return ct(Ot(),e);if(t==="last-7-days")return ct(pt(6),e);if(t==="last-30-days")return ct(pt(29),e);if(t==="custom"&&ht&&gt)return ct(ht,gt);return ct(pt(29),e)}function me(t){switch(t){case"Gemini 3.8 Flash":return"gemini-3.8-flash";case"Gemini 3.8 Flash (High)":return"gemini-3.8-flash-n";case"Gemini 3.8 Flash (Exp)":return"gemini-3.8-flash-exp-a";case"Gemini 3.8 Flash (Tiered)":return"gemini-3.8-flash-tiered";case"Gemini 3.7 Flash":return"gemini-3.7-flash";case"Gemini 3.7 Flash (High)":return"gemini-3.7-flash-n";case"Gemini 4 Argon (Medium)":return"gemini-4-argon-m";case"Gemini 3.1 Pro":return"gemini-3.1-pro-low";case"Claude Opus 4.6 Thinking":return"claude-opus-4-6-thinking";default:return t.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}}function Gt(t,e){let o=document.getElementById("analytics-models-list");if(!o)return;let a=[];if(e==="session")if(G&&G.models&&G.models.length>0)a=G.models;else a=t.modelDistribution||[];else{let i=Et(e),n={};for(let p of i){let c=t.dailyModelStats?.[p];if(c)for(let[l,k]of Object.entries(c)){if(!l||l.toLowerCase().includes("unknown")||k.inTok+k.outTok+k.cacheRead===0)continue;if(!n[l]){let u=k.modelId,x=u&&u!=="unknown"&&u!==l?u:me(l);n[l]={modelId:x,inTok:0,outTok:0,cacheRead:0,thinkTok:0,streamSec:0,requests:0}}n[l].inTok+=k.inTok,n[l].outTok+=k.outTok,n[l].cacheRead+=k.cacheRead,n[l].thinkTok+=k.thinkTok,n[l].streamSec+=k.streamSec,n[l].requests+=k.requests}}if(Object.keys(n).length>0)a=Object.entries(n).map(([p,c])=>{let l=c.inTok+c.outTok+c.cacheRead,k=c.streamSec>0?Math.round(c.outTok/c.streamSec):0;return{modelId:c.modelId,modelName:p,totalTokens:l,inputTok:c.inTok,outTok:c.outTok,cacheRead:c.cacheRead,thinkTok:c.thinkTok,requests:c.requests,avgTps:k,avgTtft:0}}).sort((p,c)=>c.totalTokens-p.totalTokens);else a=[]}if(a=a.filter((i)=>i.totalTokens>0&&!i.modelName.toLowerCase().includes("unknown")),!a||a.length===0){o.innerHTML='<div class="chart-empty">No model usage recorded in this range</div>';return}let s=Math.max(...a.map((i)=>i.totalTokens),1),m=a.map((i,n)=>{let p=Math.max(3,Math.round(i.totalTokens/s*100)),c=mt(i.modelName,n),l=i.avgTps>0?`<span class="model-speed-badge">⚡ ${i.avgTps} tok/s</span>`:"",k=i.inputTok+i.cacheRead,u=k>0?Math.round(i.cacheRead/k*100):0;return`
      <div class="model-stat-row">
        <div class="model-meta">
          <div class="model-title-line">
            <span class="model-dot" style="background: ${c}"></span>
            <span class="model-name">${i.modelName}</span>
            <span class="model-id-badge" title="API Endpoint ID: ${i.modelId}">${i.modelId}</span>
            ${l}
          </div>
          <div class="model-token-count">
            <span class="model-tokens-strong">${W(i.totalTokens)}</span> tokens
            <span class="model-req-count">(${U(i.requests)} reqs)</span>
          </div>
        </div>
        <div class="model-bar-track">
          <div class="model-bar-fill" style="width: ${p}%; background: ${c}"></div>
        </div>
        <div class="model-chips">
          <span class="model-chip"><span class="chip-dot" style="background: #00A67E"></span>Cache: ${u}% (${W(i.cacheRead)})</span>
          <span class="model-chip"><span class="chip-dot" style="background: var(--aura-primary)"></span>Out: ${W(i.outTok)}</span>
          <span class="model-chip"><span class="chip-dot" style="background: #6366F1"></span>In: ${W(i.inputTok)}</span>
          ${i.thinkTok>0?`<span class="model-chip"><span class="chip-dot" style="background: #A855F7"></span>Think: ${W(i.thinkTok)}</span>`:""}
        </div>
      </div>
    `}).join("");o.innerHTML=m}function pe(t){switch(t){case"run_command":return{name:"Command & Terminal",category:"Execution",color:"#F59E0B"};case"view_file":case"read_file":case"list_dir":case"read_url_content":return{name:"File & Code Reading",category:"Inspection",color:"#00A67E"};case"replace_file_content":case"edit_file":case"write_to_file":case"write_file":return{name:"Code Editing & File Write",category:"Modification",color:"#3B82F6"};case"grep_search":case"find_by_name":return{name:"Codebase Search",category:"Discovery",color:"#8B5CF6"};case"search_web":return{name:"Web Search & Docs",category:"Search",color:"#06B6D4"};case"invoke_subagent":case"manage_subagents":case"send_message":case"define_subagent":return{name:"Multi-Agent Coordination",category:"Agentic",color:"#EC4899"};case"schedule":case"manage_task":return{name:"Task Scheduling",category:"Workflow",color:"#10B981"};case"ask_question":return{name:"User Interaction",category:"Communication",color:"#6366F1"};default:return{name:t,category:"Extension",color:"#948F85"}}}function _t(t,e){let o=document.getElementById("analytics-tools-list");if(!o)return;let a=[];if(e==="session")if(G&&G.tools&&G.tools.length>0)a=G.tools;else a=t.toolDistribution||[];else{let n=Et(e),p={};for(let l of n){let k=t.dailyToolStats?.[l];if(k)for(let[u,x]of Object.entries(k))p[u]=(p[u]||0)+x}let c=Object.values(p).reduce((l,k)=>l+k,0);if(c>0)a=Object.entries(p).map(([l,k])=>{let u=pe(l);return{rawName:l,name:u.name,category:u.category,color:u.color,count:k,percentage:Math.round(k/c*1000)/10}}).sort((l,k)=>k.count-l.count);else a=[]}if(!a||a.length===0){o.innerHTML='<div class="chart-empty">No tool executions recorded in this range</div>';return}let s=Math.max(...a.map((n)=>n.count),1),m=a.reduce((n,p)=>n+p.count,0),i=a.map((n)=>{let p=Math.max(0.5,n.percentage);return`
      <div class="tool-stat-row">
        <div class="tool-meta">
          <div class="tool-title-line">
            <span class="tool-category-badge" style="background: ${n.color}22; color: ${n.color}; border: 1px solid ${n.color}44">${n.category}</span>
            <span class="tool-name">${n.name}</span>
            <span class="tool-raw-badge" title="Raw invocation name: ${n.rawName}">${n.rawName}</span>
          </div>
          <div class="tool-call-count">
            <span class="tool-count-strong">${U(n.count)}</span> calls
            <span class="tool-pct-badge">${n.percentage.toFixed(1)}%</span>
          </div>
        </div>
        <div class="tool-bar-track">
          <div class="tool-bar-fill" style="width: ${p.toFixed(1)}%; background: ${n.color}"></div>
        </div>
      </div>
    `}).join("");o.innerHTML=`
    <div class="tool-distribution-summary">
      <span class="tool-summary-text">Total Invocations: <strong>${U(m)}</strong></span>
    </div>
    <div class="tool-distribution-grid">
      ${i}
    </div>
  `}function Nt(t,e){let o=document.getElementById("analytics-model-tps-chart");if(!o)return;let a=e==="session"&&!!G&&G.steps.length>0,s=e==="today"||e==="yesterday",m=600,i=220,n=45,p=20,c=24,l=28,k=m-n-p,u=i-c-l;if(a){let T=G.steps,d=T.length,v=0,r=[];T.forEach((L,_)=>{let z=L.stream>0&&L.outTok>0?Math.round(L.outTok/L.stream):0;if(z>v)v=z});let h=Math.max(300,Math.ceil(v*1.15/100)*100),E=k/Math.max(1,d-1);T.forEach((L,_)=>{let z=L.stream>0&&L.outTok>0?Math.round(L.outTok/L.stream):0,A=n+(d>1?_*E:k/2),F=c+u-z/h*u;r.push({x:A,y:F,tps:z,stepIdx:L.idx+1})});let q=[0,Math.round(h*0.33),Math.round(h*0.66),h],J="",N="";q.forEach((L)=>{let _=c+u-L/h*u;J+=`<line x1="${n}" y1="${_.toFixed(1)}" x2="${m-p}" y2="${_.toFixed(1)}" stroke="var(--aura-border)" stroke-width="1" stroke-dasharray="3 3" opacity="0.35" />`,N+=`<text x="${n-8}" y="${(_+3).toFixed(1)}" text-anchor="end" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${L}</text>`});let Z="",V=Math.max(1,Math.floor(d/6));T.forEach((L,_)=>{let z=d-1-_<V*0.7;if(_%V===0&&!z){let A=n+(d>1?_*E:k/2);Z+=`<text x="${A.toFixed(1)}" y="${i-8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">#${L.idx+1}</text>`}});let tt="",st="";r.forEach((L,_)=>{if(_===0)tt=`M ${L.x.toFixed(1)},${L.y.toFixed(1)}`;else tt+=` L ${L.x.toFixed(1)},${L.y.toFixed(1)}`;if(d<=50)st+=`<circle cx="${L.x.toFixed(1)}" cy="${L.y.toFixed(1)}" r="3" fill="#8B5CF6" stroke="var(--aura-bg-elevated, #1e1e1e)" stroke-width="1.5" />`});let et="";r.forEach((L,_)=>{let z=E,A=Math.max(n,L.x-z/2),F=JSON.stringify([{model:"Active Session Turn #"+L.stepIdx,color:"#8B5CF6",tps:L.tps,reqs:1}]);et+=`
        <rect class="tps-hover-slot"
              x="${A.toFixed(1)}" y="${c}" width="${z.toFixed(1)}" height="${u}"
              fill="transparent"
              data-date="Session Turn #${L.stepIdx}"
              data-center-x="${L.x.toFixed(1)}"
              data-models="${encodeURIComponent(F)}" />
      `}),o.innerHTML=`
      <div class="chart-header">
        <div class="chart-header-left">
          <h3 class="chart-title">Model Speed Trends</h3>
        </div>
      </div>
      <div class="chart-body" style="position: relative;">
        <svg viewBox="0 0 ${m} ${i}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="tps-svg-element">
          ${J}
          ${N}
          ${Z}
          <path d="${tt}" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          ${st}
          <line id="tps-scrubber-line" x1="0" y1="${c}" x2="0" y2="${c+u}" stroke="var(--aura-border-focus, #3B82F6)" stroke-width="1.5" stroke-dasharray="2 2" style="display: none; pointer-events: none;" />
          ${et}
        </svg>
        <div class="chart-floating-tooltip" id="tps-floating-tooltip" style="display: none;"></div>
      </div>
    `,xt(o,m);return}if(s){let T=Mt(),d=St(),v=e==="today"?T:d,r=[];for(let A=0;A<24;A++){let F=String(A).padStart(2,"0");r.push(`${v} ${F}:00`)}let h=new Set;r.forEach((A)=>{let F=t.hourlyModelStats?.[A];if(F){for(let[D,j]of Object.entries(F))if(j.streamSec>0&&j.outTok>0&&!D.toLowerCase().includes("unknown"))h.add(D)}});let E=Array.from(h);if(E.length===0){o.innerHTML=`
        <div class="chart-header">
          <div class="chart-header-left">
            <h3 class="chart-title">Model Speed Trends</h3>
          </div>
        </div>
        <div class="chart-empty">No streaming latency data recorded for ${e==="today"?"today":"yesterday"}</div>
      `;return}let q=0,J={},N=k/(r.length-1);for(let A of E)r.forEach((F)=>{let D=t.hourlyModelStats?.[F]?.[A];if(D&&D.streamSec>0&&D.outTok>0){let j=Math.round(D.outTok/D.streamSec);if(j>q)q=j}});let Z=Math.max(300,Math.ceil(q*1.15/100)*100);for(let A of E)J[A]=[],r.forEach((F,D)=>{let j=t.hourlyModelStats?.[F]?.[A],Q=n+D*N,nt=F.slice(11,16);if(j&&j.streamSec>0&&j.outTok>0){let K=Math.round(j.outTok/j.streamSec),Tt=c+u-K/Z*u;J[A].push({x:Q,y:Tt,tps:K,hourLabel:nt,reqs:j.requests})}else J[A].push(null)});let V=[0,Math.round(Z*0.33),Math.round(Z*0.66),Z],tt="",st="";V.forEach((A)=>{let F=c+u-A/Z*u;tt+=`<line x1="${n}" y1="${F.toFixed(1)}" x2="${m-p}" y2="${F.toFixed(1)}" stroke="var(--aura-border)" stroke-width="1" stroke-dasharray="3 3" opacity="0.35" />`,st+=`<text x="${n-8}" y="${(F+3).toFixed(1)}" text-anchor="end" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${A}</text>`});let et="";r.forEach((A,F)=>{if(F%3===0&&F<23){let D=n+F*N,j=A.slice(11,16);et+=`<text x="${D.toFixed(1)}" y="${i-8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${j}</text>`}});let L="",_="";E.forEach((A,F)=>{let D=mt(A,F),j=J[A],Q="";for(let nt=0;nt<j.length;nt++){let K=j[nt];if(K){if(!Q)Q=`M ${K.x.toFixed(1)},${K.y.toFixed(1)}`;else Q+=` L ${K.x.toFixed(1)},${K.y.toFixed(1)}`;_+=`<circle cx="${K.x.toFixed(1)}" cy="${K.y.toFixed(1)}" r="3" fill="${D}" stroke="var(--aura-bg-elevated, #1e1e1e)" stroke-width="1.5" />`}else if(Q)L+=`<path d="${Q}" fill="none" stroke="${D}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`,Q=""}if(Q)L+=`<path d="${Q}" fill="none" stroke="${D}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`});let z="";r.forEach((A,F)=>{let D=n+F*N,j=N,Q=Math.max(n,D-j/2),nt=[];E.forEach((K,Tt)=>{let dt=t.hourlyModelStats?.[A]?.[K];if(dt&&dt.streamSec>0&&dt.outTok>0)nt.push({model:K,color:mt(K,Tt),tps:Math.round(dt.outTok/dt.streamSec),reqs:dt.requests})}),z+=`
        <rect class="tps-hover-slot"
              x="${Q.toFixed(1)}" y="${c}" width="${j.toFixed(1)}" height="${u}"
              fill="transparent"
              data-date="${A.slice(0,16)}"
              data-center-x="${D.toFixed(1)}"
              data-models="${encodeURIComponent(JSON.stringify(nt))}" />
      `}),o.innerHTML=`
      <div class="chart-header">
        <div class="chart-header-left">
          <h3 class="chart-title">Model Speed Trends</h3>
        </div>
      </div>
      <div class="chart-body" style="position: relative;">
        <svg viewBox="0 0 ${m} ${i}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="tps-svg-element">
          ${tt}
          ${st}
          ${et}
          ${L}
          ${_}
          <line id="tps-scrubber-line" x1="0" y1="${c}" x2="0" y2="${c+u}" stroke="var(--aura-border-focus, #3B82F6)" stroke-width="1.5" stroke-dasharray="2 2" style="display: none; pointer-events: none;" />
          ${z}
        </svg>
        <div class="chart-floating-tooltip" id="tps-floating-tooltip" style="display: none;"></div>
      </div>
    `,xt(o,m);return}let x=Et(e),R={};for(let T of x){let d=t.dailyModelStats?.[T];if(d){for(let[v,r]of Object.entries(d))if(r.streamSec>0&&r.outTok>0){if(!R[v])R[v]={totalOut:0,totalStream:0,daysCount:0};R[v].totalOut+=r.outTok,R[v].totalStream+=r.streamSec,R[v].daysCount+=1}}}let M=Object.keys(R).filter((T)=>!T.toLowerCase().includes("unknown"));if(M.length===0){o.innerHTML=`
      <div class="chart-header">
        <div class="chart-header-left">
          <h3 class="chart-title">Model Speed Trends</h3>
        </div>
      </div>
      <div class="chart-empty">No streaming latency data recorded in this period</div>
    `;return}let C=0,I={};for(let T of M)I[T]=[],x.forEach((d)=>{let v=t.dailyModelStats?.[d]?.[T];if(v&&v.streamSec>0&&v.outTok>0){let r=Math.round(v.outTok/v.streamSec);if(r>C)C=r}});let w=Math.max(500,Math.ceil(C*1.15/100)*100),f=k/Math.max(1,x.length-1);for(let T of M)x.forEach((d,v)=>{let r=t.dailyModelStats?.[d]?.[T],h=n+v*f;if(r&&r.streamSec>0&&r.outTok>0){let E=Math.round(r.outTok/r.streamSec),q=c+u-E/w*u;I[T].push({x:h,y:q,tps:E,date:d,reqs:r.requests})}else I[T].push(null)});let S=[0,Math.round(w*0.33),Math.round(w*0.66),w],b="",B="";S.forEach((T)=>{let d=c+u-T/w*u;b+=`
      <line x1="${n}" y1="${d.toFixed(1)}" x2="${m-p}" y2="${d.toFixed(1)}" stroke="var(--aura-border)" stroke-width="1" stroke-dasharray="3 3" opacity="0.35" />
    `,B+=`
      <text x="${n-8}" y="${(d+3).toFixed(1)}" text-anchor="end" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${T}</text>
    `});let O="",P=Math.max(1,Math.floor(x.length/7));x.forEach((T,d)=>{let v=d===x.length-1,r=v&&d%P<Math.floor(P/2)&&d!==0;if(d%P===0&&!r||v){let h=n+d*f;O+=`
        <text x="${h.toFixed(1)}" y="${i-8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${Bt(T)}</text>
      `}});let g="",y="";M.forEach((T,d)=>{let v=mt(T,d),r=I[T],h="";for(let E=0;E<r.length;E++){let q=r[E];if(q){if(!h)h=`M ${q.x.toFixed(1)},${q.y.toFixed(1)}`;else h+=` L ${q.x.toFixed(1)},${q.y.toFixed(1)}`;y+=`
          <circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="3.5" fill="${v}" stroke="var(--aura-bg-elevated, #1e1e1e)" stroke-width="1.5" class="tps-point" />
        `}else if(h)g+=`<path d="${h}" fill="none" stroke="${v}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`,h=""}if(h)g+=`<path d="${h}" fill="none" stroke="${v}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`});let H="";x.forEach((T,d)=>{let v=n+d*f,r=f,h=Math.max(n,v-r/2),E=[];M.forEach((q,J)=>{let N=t.dailyModelStats?.[T]?.[q];if(N&&N.streamSec>0&&N.outTok>0)E.push({model:q,color:mt(q,J),tps:Math.round(N.outTok/N.streamSec),reqs:N.requests})}),H+=`
      <rect class="tps-hover-slot" 
            x="${h.toFixed(1)}" y="${c}" width="${r.toFixed(1)}" height="${u}" 
            fill="transparent" 
            data-date="${T}"
            data-center-x="${v.toFixed(1)}"
            data-models="${encodeURIComponent(JSON.stringify(E))}" />
    `}),o.innerHTML=`
    <div class="chart-header">
      <div class="chart-header-left">
        <h3 class="chart-title">Model Speed Trends</h3>
      </div>
    </div>
    <div class="chart-body" style="position: relative;">
      <svg viewBox="0 0 ${m} ${i}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="tps-svg-element">
        ${b}
        ${B}
        ${O}
        ${g}
        ${y}
        <line id="tps-scrubber-line" x1="0" y1="${c}" x2="0" y2="${c+u}" stroke="var(--aura-border-focus, #3B82F6)" stroke-width="1.5" stroke-dasharray="2 2" style="display: none; pointer-events: none;" />
        ${H}
      </svg>
      <div class="chart-floating-tooltip" id="tps-floating-tooltip" style="display: none;"></div>
    </div>
  `,xt(o,m)}function xt(t,e){let o=t.querySelector(".chart-body"),a=t.querySelector("#tps-scrubber-line"),s=t.querySelector("#tps-floating-tooltip");if(!o||!s||!a)return;t.querySelectorAll(".tps-hover-slot").forEach((i)=>{i.addEventListener("mouseenter",()=>{let n=parseFloat(i.getAttribute("data-center-x")||"0"),p=i.getAttribute("data-date")||"",c=i.getAttribute("data-models")||"[]",l=[];try{l=JSON.parse(decodeURIComponent(c))}catch{}a.setAttribute("x1",String(n)),a.setAttribute("x2",String(n)),a.style.display="block";let k=l.length>0?l.map((I)=>`
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: ${I.color}"></span>
          <span class="tooltip-label">${I.model}</span>
          <span class="tooltip-val">${I.tps} tok/s (${I.reqs} reqs)</span>
        </div>
      `).join(""):'<div class="tooltip-subline">No activity on this date</div>';s.innerHTML=`
        <div class="tooltip-header">${Dt(p)}</div>
        ${k}
      `,s.style.display="block",s.style.opacity="1";let u=o.getBoundingClientRect(),x=s.offsetWidth||180,R=u.width/e,M=n*R,C=M+12;if(C+x>u.width-12)C=M-x-12;C=Math.max(6,Math.min(C,u.width-x-6)),s.style.left=`${Math.round(C)}px`,s.style.top="16px"})}),o.addEventListener("mouseleave",()=>{a.style.display="none",s.style.opacity="0",setTimeout(()=>{if(s.style.opacity==="0")s.style.display="none"},120)})}function he(t){switch(t){case"session":return"Active Session";case"today":return"Today";case"yesterday":return"Yesterday";case"this-week":return"This Week";case"this-month":return"This Month";case"last-7-days":return"Last 7 Days";case"last-30-days":return"Last 30 Days";case"custom":return"Custom Range";default:return"Overview"}}async function wt(t){ut=t;let e=document.getElementById("analytics-timerange-segmented");if(e)e.querySelectorAll(".segment-btn").forEach((a)=>{if(a.getAttribute("data-range")===t)a.classList.add("active");else a.classList.remove("active")});let o=document.getElementById("custom-range-inputs");if(o)o.style.display=t==="custom"?"flex":"none";if(t==="session"){if(!G)G=await Ht()}if(at){let a=se(at,t);ne(a),Pt(a.columns,he(t)),Gt(at,t),_t(at,t),Nt(at,t)}}async function ft(){let t=document.getElementById("btn-refresh-analytics");if(t)t.classList.add("loading");let[e,o]=await Promise.all([oe(),Ht()]);if(e)at=e;if(o)G=o;if(at)await wt(ut),ue(at.topProjects),Gt(at,ut),_t(at,ut),Nt(at,ut);if(t)setTimeout(()=>t.classList.remove("loading"),300)}function Wt(){let t=document.getElementById("analytics-timerange-segmented");if(t)t.querySelectorAll(".segment-btn").forEach((s)=>{s.addEventListener("click",()=>{let m=s.getAttribute("data-range");if(m)wt(m)})});let e=document.getElementById("custom-date-start"),o=document.getElementById("custom-date-end");document.getElementById("btn-apply-custom-range")?.addEventListener("click",()=>{if(e?.value&&o?.value)ht=e.value,gt=o.value,wt("custom")})}var Y=null,yt=[];function lt(t){let e=document.getElementById("toast");if(!e)return;e.textContent=t,e.classList.add("show"),setTimeout(()=>e.classList.remove("show"),2000)}async function X(t){try{let e=await window.sidecar.fetch("/api/config",{method:"POST",body:JSON.stringify(t)});if(e.ok)Y=(await e.json()).config,lt("Configuration applied in real-time");else lt("Save failed")}catch(e){console.error("saveConfig failed:",e),lt("Network error")}}function ot(t,e){let o=document.getElementById(t);if(!o)return;o.querySelectorAll(".segment-btn").forEach((a)=>{if(a.getAttribute("data-val")===String(e))a.classList.add("active");else a.classList.remove("active")})}function vt(t,e,o,a){let s=document.getElementById(t);if(!s)return;s.innerHTML="";let m=document.createElement("option");m.value="default",m.textContent=e,s.appendChild(m);let i=document.createElement("optgroup");i.label="System Installed Fonts";for(let p of o){let c=document.createElement("option");c.value=p,c.textContent=p,i.appendChild(c)}s.appendChild(i);let n=document.createElement("option");if(n.value="custom",n.textContent="Custom font name...",s.appendChild(n),!a||a==="default")s.value="default";else if(o.includes(a))s.value=a;else s.value="custom"}async function Xt(){try{let t=await window.sidecar.fetch("/api/system-fonts",{method:"GET"});if(t.ok){let e=await t.json();if(Array.isArray(e.fonts))yt=e.fonts}}catch(t){console.error("loadSystemFonts failed:",t)}}async function Yt(){try{let t=await window.sidecar.fetch("/api/config",{method:"GET"});if(!t.ok)return;let{config:e}=await t.json();Y=e;let o=document.getElementById("select-language");if(o)o.value=e.language||"default";let a=e.presets?.light||"high-contrast",s=e.presets?.dark||"claude-dark";ot("preset-light-segmented",a),ot("preset-dark-segmented",s);let m=document.getElementById("toggle-wax-seal");if(m)m.checked=e.composer?.waxSeal!==!1;let i=e.typography||{};vt("select-font-sans-primary","Default",yt,i.primarySans),vt("select-font-sans-fallback","Default",yt,i.fallbackSans),vt("select-font-mono","Default",yt,i.mono);let n=document.getElementById("select-font-sans-primary"),p=document.getElementById("row-custom-sans-primary"),c=document.getElementById("input-custom-sans-primary");if(n&&p){if(p.style.display=n.value==="custom"?"flex":"none",c)c.value=i.customPrimarySans||""}let l=document.getElementById("select-font-sans-fallback"),k=document.getElementById("row-custom-sans-fallback"),u=document.getElementById("input-custom-sans-fallback");if(l&&k){if(k.style.display=l.value==="custom"?"flex":"none",u)u.value=i.customFallbackSans||""}let x=document.getElementById("select-font-mono"),R=document.getElementById("row-custom-mono"),M=document.getElementById("input-custom-mono");if(x&&R){if(R.style.display=x.value==="custom"?"flex":"none",M)M.value=i.customMono||""}ot("font-size-segmented",i.fontSize||16);let C=e.composer?.collinear!==!1?"collinear":"native";ot("composer-align-segmented",C);let I=document.getElementById("toggle-hide-arrows");if(I)I.checked=e.composer?.hideArrows!==!1;let w=document.getElementById("toggle-metrics");if(w)w.checked=e.telemetry?.enabled!==!1;ot("metrics-interval-segmented",e.telemetry?.interval||2000)}catch(t){console.error("loadConfig failed:",t)}}async function kt(){try{let t=await window.sidecar.fetch("/api/status",{method:"GET"});if(!t.ok)return;let e=await t.json(),o=document.getElementById("status-dot"),a=document.getElementById("status-text"),s=document.getElementById("status-sublabel");if(e.connected){if(o)o.classList.remove("disconnected");if(a)a.textContent="Connected";if(s)s.textContent=`Connected to host (${e.targetCount||1} window(s) · port ${e.cdpPort||"-"})`}else{if(o)o.classList.add("disconnected");if(a)a.textContent="Searching window...";if(s)s.textContent="Detecting Antigravity CDP port..."}}catch(t){console.error("updateStatus failed:",t)}}async function zt(){Rt(),it(),await Xt(),await Yt(),kt(),setInterval(kt,3000);let t=document.getElementById("select-language");if(t)t.addEventListener("change",()=>{X({language:t.value})});let e=document.getElementById("preset-light-segmented");if(e)e.querySelectorAll(".segment-btn").forEach((g)=>{g.addEventListener("click",()=>{let y=g.getAttribute("data-val")||"high-contrast";ot("preset-light-segmented",y),X({presets:{...Y?.presets,light:y}})})});let o=document.getElementById("preset-dark-segmented");if(o)o.querySelectorAll(".segment-btn").forEach((g)=>{g.addEventListener("click",()=>{let y=g.getAttribute("data-val")||"claude-dark";ot("preset-dark-segmented",y),X({presets:{...Y?.presets,dark:y}})})});let a=document.getElementById("toggle-wax-seal");if(a)a.addEventListener("change",()=>{X({composer:{...Y?.composer,waxSeal:a.checked}})});let s=document.getElementById("select-font-sans-primary"),m=document.getElementById("row-custom-sans-primary"),i=document.getElementById("input-custom-sans-primary");if(s)s.addEventListener("change",()=>{let g=s.value==="custom";if(m)m.style.display=g?"flex":"none";if(!g)X({typography:{...Y?.typography,primarySans:s.value}});else if(i)i.focus()});if(i){let g=()=>{if(s&&s.value==="custom")X({typography:{...Y?.typography,primarySans:"custom",customPrimarySans:i.value.trim()}})};i.addEventListener("change",g),i.addEventListener("keydown",(y)=>{if(y.key==="Enter")g(),i.blur()})}let n=document.getElementById("select-font-sans-fallback"),p=document.getElementById("row-custom-sans-fallback"),c=document.getElementById("input-custom-sans-fallback");if(n)n.addEventListener("change",()=>{let g=n.value==="custom";if(p)p.style.display=g?"flex":"none";if(!g)X({typography:{...Y?.typography,fallbackSans:n.value}});else if(c)c.focus()});if(c){let g=()=>{if(n&&n.value==="custom")X({typography:{...Y?.typography,fallbackSans:"custom",customFallbackSans:c.value.trim()}})};c.addEventListener("change",g),c.addEventListener("keydown",(y)=>{if(y.key==="Enter")g(),c.blur()})}let l=document.getElementById("select-font-mono"),k=document.getElementById("row-custom-mono"),u=document.getElementById("input-custom-mono");if(l)l.addEventListener("change",()=>{let g=l.value==="custom";if(k)k.style.display=g?"flex":"none";if(!g)X({typography:{...Y?.typography,mono:l.value}});else if(u)u.focus()});if(u){let g=()=>{if(l&&l.value==="custom")X({typography:{...Y?.typography,mono:"custom",customMono:u.value.trim()}})};u.addEventListener("change",g),u.addEventListener("keydown",(y)=>{if(y.key==="Enter")g(),u.blur()})}let x=document.getElementById("font-size-segmented");if(x)x.querySelectorAll(".segment-btn").forEach((g)=>{g.addEventListener("click",()=>{let y=Number(g.getAttribute("data-val"));ot("font-size-segmented",y),X({typography:{...Y?.typography,fontSize:y}})})});let R=document.getElementById("composer-align-segmented");if(R)R.querySelectorAll(".segment-btn").forEach((g)=>{g.addEventListener("click",()=>{let y=g.getAttribute("data-val");ot("composer-align-segmented",y||"collinear"),X({composer:{...Y?.composer,collinear:y==="collinear"}})})});let M=document.getElementById("toggle-hide-arrows");if(M)M.addEventListener("change",()=>{X({composer:{...Y?.composer,hideArrows:M.checked}})});let C=document.getElementById("toggle-metrics");if(C)C.addEventListener("change",()=>{X({telemetry:{...Y?.telemetry,enabled:C.checked}})});let I=document.getElementById("metrics-interval-segmented");if(I)I.querySelectorAll(".segment-btn").forEach((g)=>{g.addEventListener("click",()=>{let y=Number(g.getAttribute("data-val"));ot("metrics-interval-segmented",y),X({telemetry:{...Y?.telemetry,interval:y}})})});let w=document.getElementById("btn-force-reload");if(w)w.addEventListener("click",async()=>{w.disabled=!0,w.style.opacity="0.6";try{if((await window.sidecar.fetch("/api/reload",{method:"POST"})).ok)lt("Styles recompiled and re-applied"),await kt();else lt("Reload failed")}catch(g){lt("Request error")}finally{w.disabled=!1,w.style.opacity="1"}});let f=document.getElementById("tab-nav-analytics"),S=document.getElementById("tab-nav-settings"),b=document.getElementById("view-analytics"),B=document.getElementById("view-settings"),O=(g)=>{if(g==="analytics"){if(f?.classList.add("active"),S?.classList.remove("active"),b)b.style.display="block";if(B)B.style.display="none";ft()}else{if(S?.classList.add("active"),f?.classList.remove("active"),B)B.style.display="block";if(b)b.style.display="none"}};if(f?.addEventListener("click",()=>O("analytics")),S?.addEventListener("click",()=>O("settings")),document.getElementById("btn-refresh-analytics")?.addEventListener("click",()=>ft()),Wt(),typeof window.sidecar?.onWorkspaceChange==="function")window.sidecar.onWorkspaceChange(()=>{ft()});ft()}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",zt);else zt();})();

//# debugId=BCBD80B0CE5CDD7C64756E2164756E21
