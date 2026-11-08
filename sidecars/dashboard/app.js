(()=>{var{defineProperty:G,getOwnPropertyNames:lt,getOwnPropertyDescriptor:dt}=Object,ut=Object.prototype.hasOwnProperty;function mt(t){return this[t]}var pt=(t)=>{var e=(Q??=new WeakMap).get(t),a;if(e)return e;if(e=G({},"__esModule",{value:!0}),t&&typeof t==="object"||typeof t==="function"){for(var n of lt(t))if(!ut.call(e,n))G(e,n,{get:mt.bind(t,n),enumerable:!(a=dt(t,n))||a.enumerable})}return Q.set(t,e),e},Q;var gt=(t)=>t;function ft(t,e){this[t]=gt.bind(null,e)}var yt=(t,e)=>{for(var a in e)G(t,a,{get:e[a],enumerable:!0,configurable:!0,set:ft.bind(e,a)})};var Bt={};yt(Bt,{loadConfig:()=>ot,loadSystemFonts:()=>st,populateFontSelect:()=>q,saveConfig:()=>y,showToast:()=>C,updateSegmentedUI:()=>b,updateStatus:()=>F});var M=null;function Z(t,e,a){let n=(s)=>{let o=s/255;return o<=0.03928?o/12.92:Math.pow((o+0.055)/1.055,2.4)};return 0.2126*n(t)+0.7152*n(e)+0.0722*n(a)}function V(t){if(!t)return null;let e=t.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);if(e)return{r:parseInt(e[1],10),g:parseInt(e[2],10),b:parseInt(e[3],10),alpha:e[4]!==void 0?parseFloat(e[4]):1};return null}function ht(){if(M==="light"||M==="dark")return M;let t=document.documentElement.style.colorScheme;if(t==="light"||t==="dark")return t;let e=document.createElement("div");e.setAttribute("aria-hidden","true"),e.style.cssText="position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;background-color:var(--background, var(--vscode-editor-background, transparent))",(document.body||document.documentElement).appendChild(e);try{let a=window.getComputedStyle(e).backgroundColor,n=V(a);if(n&&n.alpha>0)return Z(n.r,n.g,n.b)>0.179?"light":"dark"}catch(a){}finally{e.remove()}if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)return"dark";return"light"}function S(t){let e=t||ht(),a=document.documentElement;if(a.getAttribute("data-theme")!==e)a.setAttribute("data-theme",e);if(a.style.colorScheme!==e)a.style.colorScheme=e}function tt(){if(window.addEventListener("message",(t)=>{if(t.data?.type==="ag-theme-sync"){let e=t.data.payload||{};if(e.scheme==="light"||e.scheme==="dark")M=e.scheme,S(M)}else if(t.data?.type==="theme-change"){let e=t.data?.payload?.cssVariables;if(e&&typeof e["--background"]==="string"){let a=V(e["--background"]);if(a)M=Z(a.r,a.g,a.b)>0.179?"light":"dark"}S(M||void 0)}}),window.matchMedia){let t=window.matchMedia("(prefers-color-scheme: dark)"),e=()=>S();if(typeof t.addEventListener==="function")t.addEventListener("change",e);else if(typeof t.addListener==="function")t.addListener(e)}if(typeof MutationObserver<"u")new MutationObserver(()=>{S()}).observe(document.documentElement,{attributes:!0,attributeFilter:["style","data-theme"]});S()}function B(t){if(!t||t<=0)return"0";if(t>=1e9)return(t/1e9).toFixed(2)+"B";if(t>=1e6)return(t/1e6).toFixed(1)+"M";if(t>=1e4)return Math.round(t/1000)+"k";if(t>=1000)return(t/1000).toFixed(1)+"k";return String(Math.round(t))}function P(t){return(t||0).toLocaleString("en-US")}function vt(t){if(!t)return"Recently";try{let e=new Date(t).getTime(),a=Date.now(),n=Math.max(0,Math.floor((a-e)/1000));if(n<60)return"Just now";if(n<3600)return`${Math.floor(n/60)}m ago`;if(n<86400)return`${Math.floor(n/3600)}h ago`;let s=Math.floor(n/86400);if(s<30)return`${s}d ago`;return`${Math.floor(s/30)}mo ago`}catch{return"Recently"}}function kt(t){if(!t||t.length<10)return t;try{return new Date(t+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}catch{return t.slice(5)}}function Et(t){if(!t||t.length<10)return t;try{return new Date(t+"T00:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}catch{return t}}var N=null,et="last-month",z="",U="";async function bt(){try{let t=await window.sidecar.fetch("/api/analytics/overview",{method:"GET"});if(!t.ok)return null;let e=await t.json();return e.ok?e.data:null}catch(t){return console.error("[Aura Analytics] Failed to fetch overview:",t),null}}async function Tt(){try{let t=await window.sidecar.fetch("/api/analytics/conversations",{method:"GET"});if(!t.ok)return[];let e=await t.json();return e.ok&&Array.isArray(e.conversations)?e.conversations:[]}catch(t){return console.error("[Aura Analytics] Failed to fetch conversations:",t),[]}}function wt(t){let e=new Date,a=(s)=>s.toISOString().slice(0,10),n=a(e);if(t==="today")return{start:n,end:n};else if(t==="yesterday"){let s=new Date(e.getTime()-86400000),o=a(s);return{start:o,end:o}}else if(t==="last-week"){let s=new Date(e.getTime()-604800000);return{start:a(s),end:n}}else if(t==="last-month"){let s=new Date(e.getTime()-2592000000);return{start:a(s),end:n}}else{if(z&&U)return{start:z,end:U};return{start:"0000-00-00",end:"9999-99-99"}}}function It(t,e){let{start:a,end:n}=wt(e),s=(t.timeRangeSeries||[]).filter((o)=>{if(!o.date||o.date.startsWith("0001"))return!1;return o.date>=a&&o.date<=n});if(s.length>0&&e!=="custom"){let o=0,c=0,r=0,m=0;for(let g of s)o+=g.inputTok,c+=g.outTok,r+=g.cacheRead,m+=g.requests||1;let l=o+c+r,p=o+r,v=p>0?r/p*100:t.cacheEfficiency;return{series:s,totalTokens:{input:o,output:c,cacheRead:r,thinking:t.totalTokens.thinking,total:l},totalRequests:m,cacheEfficiency:v,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec,topProjects:t.topProjects}}return{series:(t.timeRangeSeries||[]).filter((o)=>o.date&&!o.date.startsWith("0001")),totalTokens:t.totalTokens,totalRequests:t.totalRequests||t.totalConversations*10,cacheEfficiency:t.cacheEfficiency,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec,topProjects:t.topProjects}}function xt(t){let e=document.getElementById("analytics-cards-grid");if(!e)return;let a=t.totalTokens.total,n=t.totalTokens.input,s=t.totalTokens.output,o=t.totalTokens.cacheRead,c=t.totalRequests;e.innerHTML=`
    <!-- Row 1: Primary Large Metrics -->
    <div class="kpi-grid-primary">
      <div class="kpi-card kpi-card-featured">
        <div class="kpi-label">Total Tokens Processed</div>
        <div class="kpi-value">${B(a)}</div>
        <div class="kpi-breakdown">
          <span class="kpi-tag tag-cached">Cache: ${B(o)}</span>
          <span class="kpi-tag tag-input">In: ${B(n)}</span>
          <span class="kpi-tag tag-output">Out: ${B(s)}</span>
        </div>
      </div>

      <div class="kpi-card kpi-card-featured">
        <div class="kpi-label">Total Requests</div>
        <div class="kpi-value">${P(c)}</div>
        <div class="kpi-subtext">Completed model inferences across active dialog sessions</div>
      </div>
    </div>

    <!-- Row 2: Secondary Performance Metrics -->
    <div class="kpi-grid-secondary">
      <div class="kpi-card">
        <div class="kpi-label">Cache Cost Efficiency</div>
        <div class="kpi-value">${t.cacheEfficiency.toFixed(1)}%</div>
        <div class="kpi-subtext">Prompt caching saved ~${B(o)} tokens from reprocessing</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Avg Streaming Speed</div>
        <div class="kpi-value">${t.avgTokPerSec} <span class="kpi-unit">tok/s</span></div>
        <div class="kpi-subtext">Real-time generation throughput across connected models</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">Avg Time to First Token</div>
        <div class="kpi-value">${t.avgTtft.toFixed(2)}<span class="kpi-unit">s</span></div>
        <div class="kpi-subtext">Average latency from prompt dispatch to initial token chunk</div>
      </div>
    </div>
  `}function Lt(t){let e=document.getElementById("analytics-activity-chart");if(!e)return;if(!t||t.length===0){e.innerHTML=`
      <div class="chart-header">
        <div class="chart-title">Token Activity Over Time</div>
      </div>
      <div class="chart-empty">No activity data recorded in the selected time range</div>
    `;return}let a=t.slice(-30),n=Math.max(...a.map((d)=>d.inputTok+d.outTok+d.cacheRead),1e4),s=Math.pow(10,Math.floor(Math.log10(n))),o=n/s,c=s;if(o<=2)c=0.5*s;else if(o<=5)c=1*s;else c=2*s;let r=Math.ceil(n/(c*4))*(c*4)||c*4,m=[0,r*0.25,r*0.5,r*0.75,r],l=640,p=220,v=52,g=18,T=24,x=30,w=l-v-g,k=p-T-x,E=w/a.length,f=Math.max(6,Math.min(22,Math.floor(E*0.68))),A="";m.forEach((d)=>{let I=T+k-d/r*k;A+=`
      <line x1="${v}" y1="${I}" x2="${l-g}" y2="${I}" stroke="var(--aura-border)" stroke-width="1" stroke-dasharray="${d===0?"none":"3 3"}" opacity="${d===0?"0.8":"0.4"}" />
      <text x="${v-8}" y="${I+3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${B(d)}</text>
    `});let R="",L="",H=Math.max(1,Math.floor(a.length/6));a.forEach((d,I)=>{let i=v+I*E+(E-f)/2,u=d.inputTok+d.outTok+d.cacheRead,it=Math.max(2,Math.round(u/r*k)),D=Math.max(1,Math.round(d.outTok/r*k)),_=Math.max(1,Math.round(d.inputTok/r*k)),Y=Math.max(1,it-D-_),J=T+k-Y,X=J-_,K=X-D,ct=kt(d.date),rt=Et(d.date);if(R+=`
      <g class="chart-column-group" 
         data-date="${rt}" 
         data-in="${P(d.inputTok)}" 
         data-out="${P(d.outTok)}" 
         data-cache="${P(d.cacheRead)}"
         data-total="${P(u)}"
         data-reqs="${P(d.requests||1)}"
         data-x="${i+f/2}"
         data-y="${K}">
        <!-- Hover highlight slot -->
        <rect class="bar-hover-slot" x="${i-(E-f)/2}" y="${T}" width="${E}" height="${k}" fill="transparent" />
        
        <!-- Stacked Bar Segments (Rounded top) -->
        <rect class="bar-segment bar-cache" x="${i}" y="${J}" width="${f}" height="${Y}" fill="#34A853" opacity="0.85" rx="1" />
        <rect class="bar-segment bar-in" x="${i}" y="${X}" width="${f}" height="${_}" fill="var(--aura-fg-muted)" opacity="0.75" rx="1" />
        <rect class="bar-segment bar-out" x="${i}" y="${K}" width="${f}" height="${D}" fill="var(--aura-primary)" rx="2" />
      </g>
    `,I%H===0||I===a.length-1)L+=`
        <text x="${i+f/2}" y="${p-10}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${ct}</text>
      `}),e.innerHTML=`
    <div class="chart-header">
      <div class="chart-title">Token Activity Over Time</div>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot" style="background: var(--aura-primary)"></span>Output Tokens</span>
        <span class="legend-item"><span class="legend-dot" style="background: var(--aura-fg-muted)"></span>Input Tokens</span>
        <span class="legend-item"><span class="legend-dot" style="background: #34A853"></span>Cache Read</span>
      </div>
    </div>
    <div class="chart-stage">
      <svg viewBox="0 0 ${l} ${p}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="analytics-svg-element">
        ${A}
        ${R}
        ${L}
      </svg>
      <!-- Floating Hover Tooltip -->
      <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
    </div>
  `,St(e)}function St(t){let e=t.querySelector("#chart-floating-tooltip");t.querySelectorAll(".chart-column-group").forEach((n)=>{n.addEventListener("mouseenter",(s)=>{if(!e)return;let o=n,c=o.getAttribute("data-date")||"",r=o.getAttribute("data-in")||"0",m=o.getAttribute("data-out")||"0",l=o.getAttribute("data-cache")||"0",p=o.getAttribute("data-total")||"0",v=o.getAttribute("data-reqs")||"1";e.innerHTML=`
        <div class="tooltip-header">${c}</div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
          <span class="tooltip-label">Output</span>
          <span class="tooltip-val">${m}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: var(--aura-fg-muted)"></span>
          <span class="tooltip-label">Input</span>
          <span class="tooltip-val">${r}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #34A853"></span>
          <span class="tooltip-label">Cache Read</span>
          <span class="tooltip-val">${l}</span>
        </div>
        <div class="tooltip-divider"></div>
        <div class="tooltip-row total-row">
          <span class="tooltip-label">Total Tokens</span>
          <span class="tooltip-val">${p}</span>
        </div>
        <div class="tooltip-subline">${v} generation requests</div>
      `,e.style.display="block"}),n.addEventListener("mousemove",(s)=>{if(!e)return;let o=t.getBoundingClientRect(),c=s.clientX-o.left,r=s.clientY-o.top,m=e.offsetWidth||180,l=c+14;if(l+m>o.width-12)l=c-m-14;let p=Math.max(10,r-60);e.style.left=`${l}px`,e.style.top=`${p}px`}),n.addEventListener("mouseleave",()=>{if(e)e.style.display="none"})})}function Mt(t){let e=document.getElementById("analytics-projects-list");if(!e)return;if(!t||t.length===0){e.innerHTML='<div class="chart-empty">No workspace activity recorded</div>';return}let a=Math.max(...t.map((s)=>s.tokenCount),1),n=t.map((s)=>{let o=Math.max(4,Math.round(s.tokenCount/a*100)),c=s.projectId.split("/").filter(Boolean).pop()||s.projectId;return`
      <div class="project-stat-row">
        <div class="project-meta">
          <div class="project-name" title="${s.projectId}">${c}</div>
          <div class="project-counts">${s.conversationCount} sessions · ${B(s.tokenCount)} tokens</div>
        </div>
        <div class="project-bar-track">
          <div class="project-bar-fill" style="width: ${o}%"></div>
        </div>
      </div>
    `}).join("");e.innerHTML=n}function $t(t){let e=document.getElementById("analytics-sessions-tbody");if(!e)return;if(!t||t.length===0){e.innerHTML='<tr><td colspan="4" class="empty-cell">No recent conversation sessions detected</td></tr>';return}let a=t.slice(0,15).map((n)=>{let s=n.title||"Untitled Session",o="Default";if(n.workspaceUris)try{let r=JSON.parse(n.workspaceUris);if(Array.isArray(r)&&r.length>0){let m=r[0].replace(/^file:\/\//,"").split("/").filter(Boolean).pop();if(m)o=decodeURIComponent(m)}}catch{}else if(n.projectId)o=n.projectId.split("/").filter(Boolean).pop()||n.projectId;let c=vt(n.lastModifiedTime);return`
      <tr class="session-row">
        <td class="session-title-cell" title="${s}">${s}</td>
        <td class="session-project-cell"><span class="project-pill" title="${n.workspaceUris||n.projectId}">${o}</span></td>
        <td class="session-steps-cell">${n.stepCount} steps</td>
        <td class="session-time-cell">${c}</td>
      </tr>
    `}).join("");e.innerHTML=a}function W(t){et=t;let e=document.getElementById("analytics-timerange-segmented");if(e)e.querySelectorAll(".segment-btn").forEach((n)=>{if(n.getAttribute("data-range")===t)n.classList.add("active");else n.classList.remove("active")});let a=document.getElementById("custom-range-inputs");if(a)a.style.display=t==="custom"?"flex":"none";if(N){let n=It(N,t);xt(n),Lt(n.series)}}async function O(){let t=document.getElementById("btn-refresh-analytics");if(t)t.classList.add("loading");let[e,a]=await Promise.all([bt(),Tt()]);if(e)N=e,W(et),Mt(e.topProjects);if(a)$t(a);if(t)setTimeout(()=>t.classList.remove("loading"),300)}function nt(){let t=document.getElementById("analytics-timerange-segmented");if(t)t.querySelectorAll(".segment-btn").forEach((s)=>{s.addEventListener("click",()=>{let o=s.getAttribute("data-range");if(o)W(o)})});let e=document.getElementById("custom-date-start"),a=document.getElementById("custom-date-end");document.getElementById("btn-apply-custom-range")?.addEventListener("click",()=>{if(e?.value&&a?.value)z=e.value,U=a.value,W("custom")})}var h=null,j=[];function C(t){let e=document.getElementById("toast");if(!e)return;e.textContent=t,e.classList.add("show"),setTimeout(()=>e.classList.remove("show"),2000)}async function y(t){try{let e=await window.sidecar.fetch("/api/config",{method:"POST",body:JSON.stringify(t)});if(e.ok)h=(await e.json()).config,C("Configuration applied in real-time");else C("Save failed")}catch(e){console.error("saveConfig failed:",e),C("Network error")}}function b(t,e){let a=document.getElementById(t);if(!a)return;a.querySelectorAll(".segment-btn").forEach((n)=>{if(n.getAttribute("data-val")===String(e))n.classList.add("active");else n.classList.remove("active")})}function q(t,e,a,n){let s=document.getElementById(t);if(!s)return;s.innerHTML="";let o=document.createElement("option");o.value="default",o.textContent=e,s.appendChild(o);let c=document.createElement("optgroup");c.label="System Installed Fonts";for(let m of a){let l=document.createElement("option");l.value=m,l.textContent=m,c.appendChild(l)}s.appendChild(c);let r=document.createElement("option");if(r.value="custom",r.textContent="Custom font name...",s.appendChild(r),!n||n==="default")s.value="default";else if(a.includes(n))s.value=n;else s.value="custom"}async function st(){try{let t=await window.sidecar.fetch("/api/system-fonts",{method:"GET"});if(t.ok){let e=await t.json();if(Array.isArray(e.fonts))j=e.fonts}}catch(t){console.error("loadSystemFonts failed:",t)}}async function ot(){try{let t=await window.sidecar.fetch("/api/config",{method:"GET"});if(!t.ok)return;let{config:e}=await t.json();h=e;let a=document.getElementById("select-language");if(a)a.value=e.language||"default";let n=e.presets?.light||"high-contrast",s=e.presets?.dark||"claude-dark";b("preset-light-segmented",n),b("preset-dark-segmented",s);let o=document.getElementById("toggle-wax-seal");if(o)o.checked=e.composer?.waxSeal!==!1;let c=e.typography||{};q("select-font-sans-primary","Default",j,c.primarySans),q("select-font-sans-fallback","Default",j,c.fallbackSans),q("select-font-mono","Default",j,c.mono);let r=document.getElementById("select-font-sans-primary"),m=document.getElementById("row-custom-sans-primary"),l=document.getElementById("input-custom-sans-primary");if(r&&m){if(m.style.display=r.value==="custom"?"flex":"none",l)l.value=c.customPrimarySans||""}let p=document.getElementById("select-font-sans-fallback"),v=document.getElementById("row-custom-sans-fallback"),g=document.getElementById("input-custom-sans-fallback");if(p&&v){if(v.style.display=p.value==="custom"?"flex":"none",g)g.value=c.customFallbackSans||""}let T=document.getElementById("select-font-mono"),x=document.getElementById("row-custom-mono"),w=document.getElementById("input-custom-mono");if(T&&x){if(x.style.display=T.value==="custom"?"flex":"none",w)w.value=c.customMono||""}b("font-size-segmented",c.fontSize||16);let k=e.composer?.collinear!==!1?"collinear":"native";b("composer-align-segmented",k);let E=document.getElementById("toggle-hide-arrows");if(E)E.checked=e.composer?.hideArrows!==!1;let f=document.getElementById("toggle-metrics");if(f)f.checked=e.telemetry?.enabled!==!1;b("metrics-interval-segmented",e.telemetry?.interval||2000)}catch(t){console.error("loadConfig failed:",t)}}async function F(){try{let t=await window.sidecar.fetch("/api/status",{method:"GET"});if(!t.ok)return;let e=await t.json(),a=document.getElementById("status-dot"),n=document.getElementById("status-text"),s=document.getElementById("status-sublabel");if(e.connected){if(a)a.classList.remove("disconnected");if(n)n.textContent="Connected";if(s)s.textContent=`Connected to host (${e.targetCount||1} window(s) · port ${e.cdpPort||"-"})`}else{if(a)a.classList.add("disconnected");if(n)n.textContent="Searching window...";if(s)s.textContent="Detecting Antigravity CDP port..."}}catch(t){console.error("updateStatus failed:",t)}}async function at(){tt(),S(),await st(),await ot(),F(),setInterval(F,3000);let t=document.getElementById("select-language");if(t)t.addEventListener("change",()=>{y({language:t.value})});let e=document.getElementById("preset-light-segmented");if(e)e.querySelectorAll(".segment-btn").forEach((i)=>{i.addEventListener("click",()=>{let u=i.getAttribute("data-val")||"high-contrast";b("preset-light-segmented",u),y({presets:{...h?.presets,light:u}})})});let a=document.getElementById("preset-dark-segmented");if(a)a.querySelectorAll(".segment-btn").forEach((i)=>{i.addEventListener("click",()=>{let u=i.getAttribute("data-val")||"claude-dark";b("preset-dark-segmented",u),y({presets:{...h?.presets,dark:u}})})});let n=document.getElementById("toggle-wax-seal");if(n)n.addEventListener("change",()=>{y({composer:{...h?.composer,waxSeal:n.checked}})});let s=document.getElementById("select-font-sans-primary"),o=document.getElementById("row-custom-sans-primary"),c=document.getElementById("input-custom-sans-primary");if(s)s.addEventListener("change",()=>{let i=s.value==="custom";if(o)o.style.display=i?"flex":"none";if(!i)y({typography:{...h?.typography,primarySans:s.value}});else if(c)c.focus()});if(c){let i=()=>{if(s&&s.value==="custom")y({typography:{...h?.typography,primarySans:"custom",customPrimarySans:c.value.trim()}})};c.addEventListener("change",i),c.addEventListener("keydown",(u)=>{if(u.key==="Enter")i(),c.blur()})}let r=document.getElementById("select-font-sans-fallback"),m=document.getElementById("row-custom-sans-fallback"),l=document.getElementById("input-custom-sans-fallback");if(r)r.addEventListener("change",()=>{let i=r.value==="custom";if(m)m.style.display=i?"flex":"none";if(!i)y({typography:{...h?.typography,fallbackSans:r.value}});else if(l)l.focus()});if(l){let i=()=>{if(r&&r.value==="custom")y({typography:{...h?.typography,fallbackSans:"custom",customFallbackSans:l.value.trim()}})};l.addEventListener("change",i),l.addEventListener("keydown",(u)=>{if(u.key==="Enter")i(),l.blur()})}let p=document.getElementById("select-font-mono"),v=document.getElementById("row-custom-mono"),g=document.getElementById("input-custom-mono");if(p)p.addEventListener("change",()=>{let i=p.value==="custom";if(v)v.style.display=i?"flex":"none";if(!i)y({typography:{...h?.typography,mono:p.value}});else if(g)g.focus()});if(g){let i=()=>{if(p&&p.value==="custom")y({typography:{...h?.typography,mono:"custom",customMono:g.value.trim()}})};g.addEventListener("change",i),g.addEventListener("keydown",(u)=>{if(u.key==="Enter")i(),g.blur()})}let T=document.getElementById("font-size-segmented");if(T)T.querySelectorAll(".segment-btn").forEach((i)=>{i.addEventListener("click",()=>{let u=Number(i.getAttribute("data-val"));b("font-size-segmented",u),y({typography:{...h?.typography,fontSize:u}})})});let x=document.getElementById("composer-align-segmented");if(x)x.querySelectorAll(".segment-btn").forEach((i)=>{i.addEventListener("click",()=>{let u=i.getAttribute("data-val");b("composer-align-segmented",u||"collinear"),y({composer:{...h?.composer,collinear:u==="collinear"}})})});let w=document.getElementById("toggle-hide-arrows");if(w)w.addEventListener("change",()=>{y({composer:{...h?.composer,hideArrows:w.checked}})});let k=document.getElementById("toggle-metrics");if(k)k.addEventListener("change",()=>{y({telemetry:{...h?.telemetry,enabled:k.checked}})});let E=document.getElementById("metrics-interval-segmented");if(E)E.querySelectorAll(".segment-btn").forEach((i)=>{i.addEventListener("click",()=>{let u=Number(i.getAttribute("data-val"));b("metrics-interval-segmented",u),y({telemetry:{...h?.telemetry,interval:u}})})});let f=document.getElementById("btn-force-reload");if(f)f.addEventListener("click",async()=>{f.disabled=!0,f.style.opacity="0.6";try{if((await window.sidecar.fetch("/api/reload",{method:"POST"})).ok)C("Styles recompiled and re-applied"),await F();else C("Reload failed")}catch(i){C("Request error")}finally{f.disabled=!1,f.style.opacity="1"}});let A=document.getElementById("tab-nav-analytics"),R=document.getElementById("tab-nav-settings"),L=document.getElementById("view-analytics"),H=document.getElementById("view-settings"),d=(i)=>{if(i==="analytics"){if(A?.classList.add("active"),R?.classList.remove("active"),L)L.style.display="block";if(H)H.style.display="none";O()}else{if(R?.classList.add("active"),A?.classList.remove("active"),H)H.style.display="block";if(L)L.style.display="none"}};A?.addEventListener("click",()=>d("analytics")),R?.addEventListener("click",()=>d("settings")),document.getElementById("btn-refresh-analytics")?.addEventListener("click",()=>O()),nt(),O()}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",at);else at();})();

//# debugId=80DD2867C230F6CC64756E2164756E21
