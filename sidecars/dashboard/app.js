(()=>{var{defineProperty:et,getOwnPropertyNames:Tt,getOwnPropertyDescriptor:bt}=Object,Et=Object.prototype.hasOwnProperty;function wt(t){return this[t]}var St=(t)=>{var e=(ct??=new WeakMap).get(t),a;if(e)return e;if(e=et({},"__esModule",{value:!0}),t&&typeof t==="object"||typeof t==="function"){for(var n of Tt(t))if(!Et.call(e,n))et(e,n,{get:wt.bind(t,n),enumerable:!(a=bt(t,n))||a.enumerable})}return ct.set(t,e),e},ct;var $t=(t)=>t;function xt(t,e){this[t]=$t.bind(null,e)}var Mt=(t,e)=>{for(var a in e)et(t,a,{get:e[a],enumerable:!0,configurable:!0,set:xt.bind(e,a)})};var _t={};Mt(_t,{loadConfig:()=>kt,loadSystemFonts:()=>vt,populateFontSelect:()=>V,saveConfig:()=>L,showToast:()=>W,updateSegmentedUI:()=>B,updateStatus:()=>Z});var O=null;function rt(t,e,a){let n=(o)=>{let d=o/255;return d<=0.03928?d/12.92:Math.pow((d+0.055)/1.055,2.4)};return 0.2126*n(t)+0.7152*n(e)+0.0722*n(a)}function lt(t){if(!t)return null;let e=t.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);if(e)return{r:parseInt(e[1],10),g:parseInt(e[2],10),b:parseInt(e[3],10),alpha:e[4]!==void 0?parseFloat(e[4]):1};return null}function Lt(){if(O==="light"||O==="dark")return O;let t=document.documentElement.style.colorScheme;if(t==="light"||t==="dark")return t;let e=document.createElement("div");e.setAttribute("aria-hidden","true"),e.style.cssText="position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;background-color:var(--background, var(--vscode-editor-background, transparent))",(document.body||document.documentElement).appendChild(e);try{let a=window.getComputedStyle(e).backgroundColor,n=lt(a);if(n&&n.alpha>0)return rt(n.r,n.g,n.b)>0.179?"light":"dark"}catch(a){}finally{e.remove()}if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)return"dark";return"light"}function j(t){let e=t||Lt(),a=document.documentElement;if(a.getAttribute("data-theme")!==e)a.setAttribute("data-theme",e);if(a.style.colorScheme!==e)a.style.colorScheme=e}function dt(){if(window.addEventListener("message",(t)=>{if(t.data?.type==="ag-theme-sync"){let e=t.data.payload||{};if(e.scheme==="light"||e.scheme==="dark")O=e.scheme,j(O)}else if(t.data?.type==="theme-change"){let e=t.data?.payload?.cssVariables;if(e&&typeof e["--background"]==="string"){let a=lt(e["--background"]);if(a)O=rt(a.r,a.g,a.b)>0.179?"light":"dark"}j(O||void 0)}}),window.matchMedia){let t=window.matchMedia("(prefers-color-scheme: dark)"),e=()=>j();if(typeof t.addEventListener==="function")t.addEventListener("change",e);else if(typeof t.addListener==="function")t.addListener(e)}if(typeof MutationObserver<"u")new MutationObserver(()=>{j()}).observe(document.documentElement,{attributes:!0,attributeFilter:["style","data-theme"]});j()}function D(t){if(!t||t<=0)return"0";if(t>=1e9)return(t/1e9).toFixed(2)+"B";if(t>=1e6)return(t/1e6).toFixed(1)+"M";if(t>=1e4)return Math.round(t/1000)+"k";if(t>=1000)return(t/1000).toFixed(1)+"k";return String(Math.round(t))}function P(t){return(t||0).toLocaleString("en-US")}function It(t){if(!t)return"Recently";try{let e=new Date(t).getTime(),a=Date.now(),n=Math.max(0,Math.floor((a-e)/1000));if(n<60)return"Just now";if(n<3600)return`${Math.floor(n/60)}m ago`;if(n<86400)return`${Math.floor(n/3600)}h ago`;let o=Math.floor(n/86400);if(o<30)return`${o}d ago`;return`${Math.floor(o/30)}mo ago`}catch{return"Recently"}}function ut(t){if(!t||t.length<10)return t;try{return new Date(t+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}catch{return t.slice(5)}}function mt(t){if(!t||t.length<10)return t;try{return new Date(t+"T00:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}catch{return t}}var U=null,gt="last-30-days",nt="",at="",G=null;async function Ct(){try{let t=await window.sidecar.fetch("/api/analytics/overview",{method:"GET"});if(!t.ok)return null;let e=await t.json();return e.ok?e.data:null}catch(t){return console.error("[Aura Analytics] Failed to fetch overview:",t),null}}async function Rt(){try{let t=await window.sidecar.fetch("/api/analytics/conversations",{method:"GET"});if(!t.ok)return[];let e=await t.json();return e.ok&&Array.isArray(e.conversations)?e.conversations:[]}catch(t){return console.error("[Aura Analytics] Failed to fetch conversations:",t),[]}}async function ft(){try{let e=new URLSearchParams(window.location.search).get("conversationId")||"",a=e?`/api/analytics/session?id=${encodeURIComponent(e)}`:"/api/analytics/session",n=await window.sidecar.fetch(a,{method:"GET"});if(!n.ok)return null;let o=await n.json();return o.ok?o.data:null}catch(t){return console.error("[Aura Analytics] Failed to fetch active session:",t),null}}function At(){let t=new Date;return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}function Bt(){let t=new Date(Date.now()-86400000);return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}function Ht(){let t=new Date,e=t.getDay(),a=t.getDate()-e+(e===0?-6:1),n=new Date(t.setDate(a));return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+String(n.getDate()).padStart(2,"0")}function Dt(){let t=new Date;return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-01"}function pt(t){let e=new Date(Date.now()-t*86400000);return e.getFullYear()+"-"+String(e.getMonth()+1).padStart(2,"0")+"-"+String(e.getDate()).padStart(2,"0")}function qt(t,e){let a=At(),n=Bt();if(e==="session"&&G&&G.steps.length>0){let s=G;return{columns:s.steps.map((u)=>{let h=u.ctx||u.inTok+u.cacheRead;return{label:`#${u.idx+1}`,tooltipHeader:`Session Turn #${u.idx+1}`,inputTok:u.inTok,outTok:u.outTok,cacheRead:u.cacheRead,ctx:h,requests:1,subText:`Context: ${D(h)} · Speed: ${Math.round(u.stream>0?u.outTok/u.stream:0)} tok/s`}}),totalTokens:s.totalTokens,totalRequests:s.totalRequests,cacheEfficiency:s.cacheEfficiency,avgTtft:s.avgTtft,avgTokPerSec:s.avgTokPerSec}}if(e==="today"||e==="yesterday"){let s=e==="today"?a:n,g={};for(let m=0;m<24;m++){let k=String(m).padStart(2,"0"),b=`${s} ${k}:00`;g[b]={label:`${k}:00`,tooltipHeader:`${s} ${k}:00 - ${k}:59`,inputTok:0,outTok:0,cacheRead:0,requests:0}}for(let m of t.hourlySeries||[])if(m.hourKey&&m.hourKey.startsWith(s)){let k=m.hourKey.slice(0,16);if(g[k])g[k].inputTok+=m.inputTok,g[k].outTok+=m.outTok,g[k].cacheRead+=m.cacheRead,g[k].requests+=m.requests}let u=Object.values(g),h=0,y=0,E=0,C=0;for(let m of u)h+=m.inputTok,y+=m.outTok,E+=m.cacheRead,C+=m.requests;let c=h+y+E,i=h+E,p=i>0?E/i*100:t.cacheEfficiency;return{columns:u,totalTokens:{input:h,output:y,cacheRead:E,thinking:t.totalTokens.thinking,total:c},totalRequests:C,cacheEfficiency:p,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}let o="0000-00-00",d=a;if(e==="this-week")o=Ht();else if(e==="this-month")o=Dt();else if(e==="last-7-days")o=pt(7);else if(e==="last-30-days")o=pt(30);else if(e==="custom"){if(nt&&at)o=nt,d=at}let l=(t.timeRangeSeries||[]).filter((s)=>{if(!s.date||s.date.startsWith("0001"))return!1;return s.date>=o&&s.date<=d}),r=new Date(o).getTime(),M=new Date(d).getTime();if(Math.round((M-r)/86400000)>90&&l.length>28){let s={};for(let p of l){let m=new Date(p.date+"T00:00:00"),k=Math.floor(m.getDate()/7)+1,b=`${p.date.slice(0,7)} W${k}`;if(!s[b])s[b]={label:b.slice(5),tooltipHeader:`Week of ${p.date}`,inputTok:0,outTok:0,cacheRead:0,requests:0};s[b].inputTok+=p.inputTok,s[b].outTok+=p.outTok,s[b].cacheRead+=p.cacheRead,s[b].requests+=p.requests||1}let g=Object.values(s),u=0,h=0,y=0,E=0;for(let p of g)u+=p.inputTok,h+=p.outTok,y+=p.cacheRead,E+=p.requests;let C=u+h+y,c=u+y,i=c>0?y/c*100:t.cacheEfficiency;return{columns:g,totalTokens:{input:u,output:h,cacheRead:y,thinking:t.totalTokens.thinking,total:C},totalRequests:E,cacheEfficiency:i,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}let w=l.map((s)=>({label:ut(s.date),tooltipHeader:mt(s.date),inputTok:s.inputTok,outTok:s.outTok,cacheRead:s.cacheRead,requests:s.requests||1})),S=0,v=0,T=0,R=0;for(let s of w)S+=s.inputTok,v+=s.outTok,T+=s.cacheRead,R+=s.requests;let x=S+v+T,A=S+T,H=A>0?T/A*100:t.cacheEfficiency;return{columns:w.length>0?w:(t.timeRangeSeries||[]).slice(-14).map((s)=>({label:ut(s.date),tooltipHeader:mt(s.date),inputTok:s.inputTok,outTok:s.outTok,cacheRead:s.cacheRead,requests:s.requests||1})),totalTokens:w.length>0?{input:S,output:v,cacheRead:T,thinking:t.totalTokens.thinking,total:x}:t.totalTokens,totalRequests:R||t.totalRequests||t.totalConversations*10,cacheEfficiency:H,avgTtft:t.avgTtft,avgTokPerSec:t.avgTokPerSec}}function Pt(t){let e=document.getElementById("analytics-cards-grid");if(!e)return;let a=t.totalTokens.total,n=t.totalTokens.input,o=t.totalTokens.output,d=t.totalTokens.cacheRead,l=t.totalRequests;e.innerHTML=`
    <!-- Row 1: Primary Metrics -->
    <div class="kpi-grid-primary">
      <div class="kpi-card kpi-card-featured">
        <div class="kpi-label">Total Tokens Processed</div>
        <div class="kpi-value">${D(a)}</div>
        <div class="kpi-breakdown">
          <span class="kpi-tag tag-cached">Cache: ${D(d)}</span>
          <span class="kpi-tag tag-input">In: ${D(n)}</span>
          <span class="kpi-tag tag-output">Out: ${D(o)}</span>
        </div>
      </div>

      <div class="kpi-card kpi-card-featured">
        <div class="kpi-label">Total Requests</div>
        <div class="kpi-value">${P(l)}</div>
        <div class="kpi-subtext">Completed model inferences for the selected range</div>
      </div>
    </div>

    <!-- Row 2: Secondary Performance Metrics -->
    <div class="kpi-grid-secondary">
      <div class="kpi-card">
        <div class="kpi-label">Cache Cost Efficiency</div>
        <div class="kpi-value">${t.cacheEfficiency.toFixed(1)}%</div>
        <div class="kpi-subtext">Prompt caching saved ~${D(d)} tokens from reprocessing</div>
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
  `}function Ft(t,e){let a=document.getElementById("analytics-activity-chart");if(!a)return;if(!t||t.length===0){a.innerHTML=`
      <div class="chart-header">
        <div class="chart-title">${e}</div>
      </div>
      <div class="chart-empty">No activity data recorded in the selected range</div>
    `;return}let n=Math.max(...t.map((i)=>i.inputTok+i.outTok+i.cacheRead),1000),o=Math.pow(10,Math.floor(Math.log10(n))),d=n/o,l=o;if(d<=2)l=0.5*o;else if(d<=5)l=1*o;else l=2*o;let r=Math.ceil(n/(l*4))*(l*4)||l*4,M=[0,r*0.25,r*0.5,r*0.75,r],f=t.length>40,w=f?10:Math.max(6,Math.floor(570/t.length)),S=f?Math.max(640,t.length*w+70):640,v=220,T=52,R=18,x=24,A=30,H=S-T-R,s=v-x-A,g=H/t.length,u=Math.max(3,Math.min(22,Math.floor(g*0.72))),h="";M.forEach((i)=>{let p=x+s-i/r*s;h+=`
      <line x1="${T}" y1="${p}" x2="${S-R}" y2="${p}" stroke="var(--aura-border)" stroke-width="1" opacity="${i===0?"0.6":"0.25"}" />
      <text x="${T-8}" y="${p+3.5}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${D(i)}</text>
    `});let y="<defs>",E="",C="",c=Math.max(1,Math.floor(t.length/8));if(t.forEach((i,p)=>{let m=T+p*g+(g-u)/2,k=i.inputTok+i.outTok+i.cacheRead,b=T+p*g,F=m+u/2;if(k>0){let _=Math.max(3,Math.round(k/r*s)),z=i.outTok>0?Math.max(1,Math.round(i.outTok/r*s)):0,Y=i.inputTok>0?Math.max(1,Math.round(i.inputTok/r*s)):0,N=i.cacheRead>0?Math.max(1,_-z-Y):0;if(N<0)N=0;let Q=x+s,st=Q-N,it=st-Y,tt=it-z,K=tt,q=Math.min(3.5,u/2,_);y+=`
        <clipPath id="col-clip-${p}">
          <path d="M ${m} ${Q} L ${m} ${K+q} A ${q} ${q} 0 0 1 ${m+q} ${K} L ${m+u-q} ${K} A ${q} ${q} 0 0 1 ${m+u} ${K+q} L ${m+u} ${Q} Z" />
        </clipPath>
      `,E+=`
        <g class="chart-column-group" 
           data-header="${i.tooltipHeader}" 
           data-in="${P(i.inputTok)}" 
           data-out="${P(i.outTok)}" 
           data-cache="${P(i.cacheRead)}"
           data-total="${P(k)}"
           data-ctx="${i.ctx?D(i.ctx)+" ("+P(i.ctx)+")":""}"
           data-reqs="${P(i.requests||1)}"
           data-subtext="${i.subText||""}"
           data-center-x="${F}"
           data-slot-x="${b}"
           data-slot-w="${g}"
           data-top-y="${tt}"
           data-idx="${p}">
          
          <!-- Hover Container Highlight Band (Full Height Background) -->
          <rect class="bar-bg-band" x="${b}" y="${x}" width="${g}" height="${s}" rx="4" />
          
          <!-- Stacked Column Segments with Top Rounded Cap -->
          <g clip-path="url(#col-clip-${p})">
            ${N>0?`<rect class="bar-segment bar-cache" x="${m}" y="${st}" width="${u}" height="${N}" fill="#00A67E" />`:""}
            ${Y>0?`<rect class="bar-segment bar-in" x="${m}" y="${it}" width="${u}" height="${Y}" fill="#6366F1" opacity="0.85" />`:""}
            ${z>0?`<rect class="bar-segment bar-out" x="${m}" y="${tt}" width="${u}" height="${z}" fill="var(--aura-primary)" />`:""}
          </g>
        </g>
      `}else E+=`
        <g class="chart-column-group" 
           data-header="${i.tooltipHeader}" 
           data-in="0" 
           data-out="0" 
           data-cache="0"
           data-total="0"
           data-ctx="${i.ctx?D(i.ctx)+" ("+P(i.ctx)+")":""}"
           data-reqs="0"
           data-subtext="${i.subText||""}"
           data-center-x="${F}"
           data-slot-x="${b}"
           data-slot-w="${g}"
           data-top-y="${x+s}"
           data-idx="${p}">
          
          <!-- Hover Container Highlight Band (Full Height Background) -->
          <rect class="bar-bg-band" x="${b}" y="${x}" width="${g}" height="${s}" rx="4" />
        </g>
      `;if(p%c===0||p===t.length-1)C+=`
        <text x="${F}" y="${v-8}" text-anchor="middle" font-size="10" font-family="inherit" fill="var(--aura-fg-muted)">${i.label}</text>
      `}),y+="</defs>",a.innerHTML=`
    <div class="chart-header">
      <div class="chart-title">Token Activity (${e})</div>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot" style="background: var(--aura-primary)"></span>Output Tokens</span>
        <span class="legend-item"><span class="legend-dot" style="background: #6366F1"></span>Input Tokens</span>
        <span class="legend-item"><span class="legend-dot" style="background: #00A67E"></span>Cache Read</span>
      </div>
    </div>
    <div class="chart-stage ${f?"chart-stage-scrollable":""}" id="chart-stage-container">
      <svg viewBox="0 0 ${S} ${v}" preserveAspectRatio="xMidYMid meet" class="analytics-svg" id="analytics-svg-element" style="${f?`min-width: ${S}px;`:""}">
        ${y}
        ${h}
        ${E}
        ${C}
      </svg>
      <!-- Smart Fixed Hover Tooltip -->
      <div class="chart-floating-tooltip" id="chart-floating-tooltip" style="display: none;"></div>
    </div>
  `,f)setTimeout(()=>{let i=a.querySelector("#chart-stage-container");if(i)i.scrollLeft=i.scrollWidth},50);jt(a,S,v)}function jt(t,e,a){let n=t.querySelector("#chart-floating-tooltip"),o=t.querySelector("#chart-stage-container"),d=t.querySelectorAll(".chart-column-group");if(!n||!o)return;d.forEach((l)=>{l.addEventListener("mouseenter",()=>{let r=l,M=r.getAttribute("data-header")||"",f=r.getAttribute("data-in")||"0",w=r.getAttribute("data-out")||"0",S=r.getAttribute("data-cache")||"0",v=r.getAttribute("data-total")||"0",T=r.getAttribute("data-ctx")||"",R=r.getAttribute("data-reqs")||"0",x=r.getAttribute("data-subtext")||"",A=Number(r.getAttribute("data-center-x")||0),H=Number(r.getAttribute("data-top-y")||0),s=T?`
        <div class="tooltip-row ctx-row">
          <span class="tooltip-dot" style="background: #3B82F6"></span>
          <span class="tooltip-label">Context Window</span>
          <span class="tooltip-val">${T}</span>
        </div>
      `:"";n.innerHTML=`
        <div class="tooltip-header">${M}</div>
        ${s}
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: var(--aura-primary)"></span>
          <span class="tooltip-label">Output Tokens</span>
          <span class="tooltip-val">${w}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #6366F1"></span>
          <span class="tooltip-label">Input Tokens</span>
          <span class="tooltip-val">${f}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-dot" style="background: #00A67E"></span>
          <span class="tooltip-label">Cache Read</span>
          <span class="tooltip-val">${S}</span>
        </div>
        <div class="tooltip-divider"></div>
        <div class="tooltip-row total-row">
          <span class="tooltip-label">Total Tokens</span>
          <span class="tooltip-val">${v}</span>
        </div>
        <div class="tooltip-subline">${R} generation requests${x?" · "+x:""}</div>
      `,n.style.display="block";let g=o.getBoundingClientRect(),h=(r.querySelector(".bar-bg-band")||r).getBoundingClientRect(),y=h.left-g.left+o.scrollLeft,E=h.right-g.left+o.scrollLeft,C=n.offsetWidth||180,c=n.offsetHeight||135,i=o.scrollLeft,p=o.scrollLeft+g.width,m=p-(E+12),k=y-12-i,b=0;if(m>=C+6&&(m>=k||k<C))b=E+12;else if(k>=C+6)b=y-C-12;else if(m>=k)b=Math.max(E+4,p-C-6);else b=Math.min(y-C-4,i+6);let F=10,_=g.height-c-12;if(_>10)F=Math.min(F,_);n.style.left=`${Math.round(b)}px`,n.style.top=`${Math.round(F)}px`}),l.addEventListener("mouseleave",()=>{n.style.display="none"})})}function Ot(t){let e=document.getElementById("analytics-projects-list");if(!e)return;if(!t||t.length===0){e.innerHTML='<div class="chart-empty">No workspace activity recorded</div>';return}let a=Math.max(...t.map((o)=>o.tokenCount),1),n=t.map((o)=>{let d=Math.max(4,Math.round(o.tokenCount/a*100)),l=o.projectId.split("/").filter(Boolean).pop()||o.projectId;return`
      <div class="project-stat-row">
        <div class="project-meta">
          <div class="project-name" title="${o.projectId}">${l}</div>
          <div class="project-counts">${o.conversationCount} sessions · ${D(o.tokenCount)} tokens</div>
        </div>
        <div class="project-bar-track">
          <div class="project-bar-fill" style="width: ${d}%"></div>
        </div>
      </div>
    `}).join("");e.innerHTML=n}function Gt(t){let e=document.getElementById("analytics-sessions-tbody");if(!e)return;if(!t||t.length===0){e.innerHTML='<tr><td colspan="4" class="empty-cell">No recent conversation sessions detected</td></tr>';return}let a=t.slice(0,15).map((n)=>{let o=n.title||"Untitled Session",d="Default";if(n.workspaceUris)try{let r=JSON.parse(n.workspaceUris);if(Array.isArray(r)&&r.length>0){let M=r[0].replace(/^file:\/\//,"").split("/").filter(Boolean).pop();if(M)d=decodeURIComponent(M)}}catch{}else if(n.projectId)d=n.projectId.split("/").filter(Boolean).pop()||n.projectId;let l=It(n.lastModifiedTime);return`
      <tr class="session-row">
        <td class="session-title-cell" title="${o}">${o}</td>
        <td class="session-project-cell"><span class="project-pill" title="${n.workspaceUris||n.projectId}">${d}</span></td>
        <td class="session-steps-cell">${n.stepCount} steps</td>
        <td class="session-time-cell">${l}</td>
      </tr>
    `}).join("");e.innerHTML=a}function Wt(t){switch(t){case"session":{let e=G?.steps?.length||0;return e>40?`Current Active Session (Latest 40 of ${e} turns)`:"Current Active Session (Turn-by-turn)"}case"today":return"Today (Hourly)";case"yesterday":return"Yesterday (Hourly)";case"this-week":return"This Week (Daily)";case"this-month":return"This Month (Daily)";case"last-7-days":return"Last 7 Days (Daily)";case"last-30-days":return"Last 30 Days (Daily)";case"custom":return"Custom Range";default:return"Token Activity"}}async function ot(t){gt=t;let e=document.getElementById("analytics-timerange-segmented");if(e)e.querySelectorAll(".segment-btn").forEach((n)=>{if(n.getAttribute("data-range")===t)n.classList.add("active");else n.classList.remove("active")});let a=document.getElementById("custom-range-inputs");if(a)a.style.display=t==="custom"?"flex":"none";if(t==="session"){if(!G)G=await ft()}if(U){let n=qt(U,t);Pt(n),Ft(n.columns,Wt(t))}}async function J(){let t=document.getElementById("btn-refresh-analytics");if(t)t.classList.add("loading");let[e,a,n]=await Promise.all([Ct(),Rt(),ft()]);if(e)U=e;if(n)G=n;if(U)await ot(gt),Ot(U.topProjects);if(a)Gt(a);if(t)setTimeout(()=>t.classList.remove("loading"),300)}function ht(){let t=document.getElementById("analytics-timerange-segmented");if(t)t.querySelectorAll(".segment-btn").forEach((o)=>{o.addEventListener("click",()=>{let d=o.getAttribute("data-range");if(d)ot(d)})});let e=document.getElementById("custom-date-start"),a=document.getElementById("custom-date-end");document.getElementById("btn-apply-custom-range")?.addEventListener("click",()=>{if(e?.value&&a?.value)nt=e.value,at=a.value,ot("custom")})}var I=null,X=[];function W(t){let e=document.getElementById("toast");if(!e)return;e.textContent=t,e.classList.add("show"),setTimeout(()=>e.classList.remove("show"),2000)}async function L(t){try{let e=await window.sidecar.fetch("/api/config",{method:"POST",body:JSON.stringify(t)});if(e.ok)I=(await e.json()).config,W("Configuration applied in real-time");else W("Save failed")}catch(e){console.error("saveConfig failed:",e),W("Network error")}}function B(t,e){let a=document.getElementById(t);if(!a)return;a.querySelectorAll(".segment-btn").forEach((n)=>{if(n.getAttribute("data-val")===String(e))n.classList.add("active");else n.classList.remove("active")})}function V(t,e,a,n){let o=document.getElementById(t);if(!o)return;o.innerHTML="";let d=document.createElement("option");d.value="default",d.textContent=e,o.appendChild(d);let l=document.createElement("optgroup");l.label="System Installed Fonts";for(let M of a){let f=document.createElement("option");f.value=M,f.textContent=M,l.appendChild(f)}o.appendChild(l);let r=document.createElement("option");if(r.value="custom",r.textContent="Custom font name...",o.appendChild(r),!n||n==="default")o.value="default";else if(a.includes(n))o.value=n;else o.value="custom"}async function vt(){try{let t=await window.sidecar.fetch("/api/system-fonts",{method:"GET"});if(t.ok){let e=await t.json();if(Array.isArray(e.fonts))X=e.fonts}}catch(t){console.error("loadSystemFonts failed:",t)}}async function kt(){try{let t=await window.sidecar.fetch("/api/config",{method:"GET"});if(!t.ok)return;let{config:e}=await t.json();I=e;let a=document.getElementById("select-language");if(a)a.value=e.language||"default";let n=e.presets?.light||"high-contrast",o=e.presets?.dark||"claude-dark";B("preset-light-segmented",n),B("preset-dark-segmented",o);let d=document.getElementById("toggle-wax-seal");if(d)d.checked=e.composer?.waxSeal!==!1;let l=e.typography||{};V("select-font-sans-primary","Default",X,l.primarySans),V("select-font-sans-fallback","Default",X,l.fallbackSans),V("select-font-mono","Default",X,l.mono);let r=document.getElementById("select-font-sans-primary"),M=document.getElementById("row-custom-sans-primary"),f=document.getElementById("input-custom-sans-primary");if(r&&M){if(M.style.display=r.value==="custom"?"flex":"none",f)f.value=l.customPrimarySans||""}let w=document.getElementById("select-font-sans-fallback"),S=document.getElementById("row-custom-sans-fallback"),v=document.getElementById("input-custom-sans-fallback");if(w&&S){if(S.style.display=w.value==="custom"?"flex":"none",v)v.value=l.customFallbackSans||""}let T=document.getElementById("select-font-mono"),R=document.getElementById("row-custom-mono"),x=document.getElementById("input-custom-mono");if(T&&R){if(R.style.display=T.value==="custom"?"flex":"none",x)x.value=l.customMono||""}B("font-size-segmented",l.fontSize||16);let A=e.composer?.collinear!==!1?"collinear":"native";B("composer-align-segmented",A);let H=document.getElementById("toggle-hide-arrows");if(H)H.checked=e.composer?.hideArrows!==!1;let s=document.getElementById("toggle-metrics");if(s)s.checked=e.telemetry?.enabled!==!1;B("metrics-interval-segmented",e.telemetry?.interval||2000)}catch(t){console.error("loadConfig failed:",t)}}async function Z(){try{let t=await window.sidecar.fetch("/api/status",{method:"GET"});if(!t.ok)return;let e=await t.json(),a=document.getElementById("status-dot"),n=document.getElementById("status-text"),o=document.getElementById("status-sublabel");if(e.connected){if(a)a.classList.remove("disconnected");if(n)n.textContent="Connected";if(o)o.textContent=`Connected to host (${e.targetCount||1} window(s) · port ${e.cdpPort||"-"})`}else{if(a)a.classList.add("disconnected");if(n)n.textContent="Searching window...";if(o)o.textContent="Detecting Antigravity CDP port..."}}catch(t){console.error("updateStatus failed:",t)}}async function yt(){dt(),j(),await vt(),await kt(),Z(),setInterval(Z,3000);let t=document.getElementById("select-language");if(t)t.addEventListener("change",()=>{L({language:t.value})});let e=document.getElementById("preset-light-segmented");if(e)e.querySelectorAll(".segment-btn").forEach((c)=>{c.addEventListener("click",()=>{let i=c.getAttribute("data-val")||"high-contrast";B("preset-light-segmented",i),L({presets:{...I?.presets,light:i}})})});let a=document.getElementById("preset-dark-segmented");if(a)a.querySelectorAll(".segment-btn").forEach((c)=>{c.addEventListener("click",()=>{let i=c.getAttribute("data-val")||"claude-dark";B("preset-dark-segmented",i),L({presets:{...I?.presets,dark:i}})})});let n=document.getElementById("toggle-wax-seal");if(n)n.addEventListener("change",()=>{L({composer:{...I?.composer,waxSeal:n.checked}})});let o=document.getElementById("select-font-sans-primary"),d=document.getElementById("row-custom-sans-primary"),l=document.getElementById("input-custom-sans-primary");if(o)o.addEventListener("change",()=>{let c=o.value==="custom";if(d)d.style.display=c?"flex":"none";if(!c)L({typography:{...I?.typography,primarySans:o.value}});else if(l)l.focus()});if(l){let c=()=>{if(o&&o.value==="custom")L({typography:{...I?.typography,primarySans:"custom",customPrimarySans:l.value.trim()}})};l.addEventListener("change",c),l.addEventListener("keydown",(i)=>{if(i.key==="Enter")c(),l.blur()})}let r=document.getElementById("select-font-sans-fallback"),M=document.getElementById("row-custom-sans-fallback"),f=document.getElementById("input-custom-sans-fallback");if(r)r.addEventListener("change",()=>{let c=r.value==="custom";if(M)M.style.display=c?"flex":"none";if(!c)L({typography:{...I?.typography,fallbackSans:r.value}});else if(f)f.focus()});if(f){let c=()=>{if(r&&r.value==="custom")L({typography:{...I?.typography,fallbackSans:"custom",customFallbackSans:f.value.trim()}})};f.addEventListener("change",c),f.addEventListener("keydown",(i)=>{if(i.key==="Enter")c(),f.blur()})}let w=document.getElementById("select-font-mono"),S=document.getElementById("row-custom-mono"),v=document.getElementById("input-custom-mono");if(w)w.addEventListener("change",()=>{let c=w.value==="custom";if(S)S.style.display=c?"flex":"none";if(!c)L({typography:{...I?.typography,mono:w.value}});else if(v)v.focus()});if(v){let c=()=>{if(w&&w.value==="custom")L({typography:{...I?.typography,mono:"custom",customMono:v.value.trim()}})};v.addEventListener("change",c),v.addEventListener("keydown",(i)=>{if(i.key==="Enter")c(),v.blur()})}let T=document.getElementById("font-size-segmented");if(T)T.querySelectorAll(".segment-btn").forEach((c)=>{c.addEventListener("click",()=>{let i=Number(c.getAttribute("data-val"));B("font-size-segmented",i),L({typography:{...I?.typography,fontSize:i}})})});let R=document.getElementById("composer-align-segmented");if(R)R.querySelectorAll(".segment-btn").forEach((c)=>{c.addEventListener("click",()=>{let i=c.getAttribute("data-val");B("composer-align-segmented",i||"collinear"),L({composer:{...I?.composer,collinear:i==="collinear"}})})});let x=document.getElementById("toggle-hide-arrows");if(x)x.addEventListener("change",()=>{L({composer:{...I?.composer,hideArrows:x.checked}})});let A=document.getElementById("toggle-metrics");if(A)A.addEventListener("change",()=>{L({telemetry:{...I?.telemetry,enabled:A.checked}})});let H=document.getElementById("metrics-interval-segmented");if(H)H.querySelectorAll(".segment-btn").forEach((c)=>{c.addEventListener("click",()=>{let i=Number(c.getAttribute("data-val"));B("metrics-interval-segmented",i),L({telemetry:{...I?.telemetry,interval:i}})})});let s=document.getElementById("btn-force-reload");if(s)s.addEventListener("click",async()=>{s.disabled=!0,s.style.opacity="0.6";try{if((await window.sidecar.fetch("/api/reload",{method:"POST"})).ok)W("Styles recompiled and re-applied"),await Z();else W("Reload failed")}catch(c){W("Request error")}finally{s.disabled=!1,s.style.opacity="1"}});let g=document.getElementById("tab-nav-analytics"),u=document.getElementById("tab-nav-settings"),h=document.getElementById("view-analytics"),y=document.getElementById("view-settings"),E=(c)=>{if(c==="analytics"){if(g?.classList.add("active"),u?.classList.remove("active"),h)h.style.display="block";if(y)y.style.display="none";J()}else{if(u?.classList.add("active"),g?.classList.remove("active"),y)y.style.display="block";if(h)h.style.display="none"}};g?.addEventListener("click",()=>E("analytics")),u?.addEventListener("click",()=>E("settings")),document.getElementById("btn-refresh-analytics")?.addEventListener("click",()=>J()),ht(),J()}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",yt);else yt();})();

//# debugId=D40171A0C59C540164756E2164756E21
