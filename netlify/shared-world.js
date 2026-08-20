/* Bellweather V16 Netlify-only shared world client.
   The browser is a renderer/observer. Netlify Functions + strongly-consistent
   Netlify Blobs own the single authoritative civilisation. */
(function(){
  const V16={
    version:16,connected:false,active:false,pollMs:2500,lastSnapshot:null,lastReceive:0,seenEvents:new Set(),seenLines:new Set(),viewerId:crypto.randomUUID?.()||String(Math.random()),status:null,
    byId:new Map(),buildingByName:new Map(),serverConversations:new Map(),pollTimer:null,pollBusy:false,
    init(){
      try{AGENTS.forEach(a=>this.byId.set(Number(a.id),a));BUILDINGS.forEach(b=>this.buildingByName.set(b.name,b));}catch(e){console.error('V16 init mapping',e);}
      this.installStatus();this.disableLocalAuthority();this.installControls();this.poll(true);
    },
    installStatus(){
      const el=document.createElement('div');el.id='v16status';el.style.cssText='position:fixed;left:12px;top:86px;z-index:1200;background:rgba(7,14,23,.91);border:1px solid #26394a;border-radius:9px;padding:7px 10px;color:#a9bac9;font:600 10px/1.2 ui-monospace,monospace;letter-spacing:.08em;box-shadow:0 5px 24px #0008;pointer-events:none';el.textContent='SHARED WORLD · NETLIFY · CONNECTING';document.body.appendChild(el);this.status=el;
      const css=document.createElement('style');css.textContent=`#v16init{position:fixed;inset:0;z-index:3100;background:#07101be8;display:grid;place-items:center;padding:24px}#v16init .box{width:min(560px,94vw);background:#101b28;border:1px solid #2b4155;border-radius:14px;padding:20px;color:#e8eef4;font:14px/1.5 system-ui}#v16init h2{margin:0 0 7px;font-size:20px}#v16init input{width:100%;box-sizing:border-box;margin:12px 0;padding:12px;background:#07101b;border:1px solid #36526b;border-radius:8px;color:white;font:13px ui-monospace,monospace}#v16init button{padding:10px 14px;border:0;border-radius:8px;background:#4fd1c5;color:#07101b;font-weight:800}#v16initmsg{margin-top:10px;color:#9fb3c4;font-size:12px}#v16status.bad{border-color:#8b4747;color:#ffb7b7}`;document.head.appendChild(css);
    },
    showBootstrap(retry=false){
      if(document.getElementById('v16init'))return;
      const o=document.createElement('div');o.id='v16init';o.innerHTML=`<div class="box"><h2>Shared world awaiting owner</h2><div>The Netlify world has not been initialised yet. Ordinary visitors cannot create a second timeline.</div><input id="v16admin" type="password" autocomplete="off" placeholder="Owner ADMIN_TOKEN"><button id="v16boot">Create the one world</button><div id="v16initmsg">${retry?'That token was rejected. ':''}Only the owner needs to do this once.</div></div>`;document.body.appendChild(o);
      o.querySelector('#v16boot').onclick=async()=>{const token=o.querySelector('#v16admin').value.trim();if(!token)return;o.querySelector('#v16initmsg').textContent='Initialising the authoritative world on Netlify…';const ok=await this.bootstrapServer(token);if(ok)o.remove();else{o.remove();this.showBootstrap(true);}};
      this.setStatus('SHARED WORLD · NETLIFY · WAITING FOR OWNER',true);
    },
    setStatus(txt,bad=false){if(!this.status)return;this.status.textContent=txt;this.status.classList.toggle('bad',!!bad);},
    disableLocalAuthority(){
      try{this.localTick=tick;tick=(dt)=>{if(!this.active)return;this.visualTick(dt);};}catch(e){console.error('V16 tick takeover',e);}
      try{Persist.save=()=>{};}catch(_){}
      try{window.V14_TIME_MULT=1;}catch(_){}
    },
    installControls(){
      setTimeout(()=>{
        const t=document.getElementById('timespeed');if(t){t.onclick=()=>v12Hint?.('World time is server-authoritative on Netlify. Ordinary viewers cannot fast-forward everybody else.');t.innerHTML='<b>●</b><span>WORLD LIVE</span>';t.title='The shared world clock is controlled by the authoritative Netlify state.';}
        const ai=document.getElementById('aitog');if(ai){ai.onclick=()=>v12Hint?.('DeepSeek keys are private Netlify environment variables. Five global conversation slots remain server controlled.');}
      },50);
    },
    async api(path='/api/world',options={}){
      const r=await fetch(path,{cache:'no-store',...options,headers:{'content-type':'application/json',...(options.headers||{})}});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw Object.assign(new Error(data.message||data.error||`HTTP ${r.status}`),{status:r.status,data});
      return data;
    },
    schedulePoll(delay=this.pollMs){clearTimeout(this.pollTimer);this.pollTimer=setTimeout(()=>this.poll(false),delay);},
    async poll(first=false){
      if(this.pollBusy){this.schedulePoll();return;}this.pollBusy=true;
      try{
        if(first)this.setStatus('SHARED WORLD · NETLIFY · CONNECTING');
        const data=await this.api(`/api/world?viewer=${encodeURIComponent(this.viewerId)}&t=${Date.now()}`);
        this.connected=true;
        if(!data.initialized){this.active=false;this.showBootstrap();this.setStatus('SHARED WORLD · NETLIFY · OWNER SETUP REQUIRED',true);}
        else{const init=document.getElementById('v16init');if(init)init.remove();this.apply(data.state);}
        this.pollMs=2500;
      }catch(e){this.connected=false;this.setStatus('SHARED WORLD · NETLIFY · RECONNECTING',true);this.pollMs=Math.min(15000,Math.round(this.pollMs*1.5));console.error('V16 poll',e);}
      finally{this.pollBusy=false;this.schedulePoll();}
    },
    async bootstrapServer(token){
      try{
        const data=await this.api('/api/world',{method:'POST',body:JSON.stringify({action:'bootstrap',adminToken:token,state:this.bootstrap()})});
        if(data.state)this.apply(data.state);return true;
      }catch(e){console.error('V16 bootstrap',e);return false;}
    },
    clone(x){try{return JSON.parse(JSON.stringify(x));}catch{return null;}},
    bootstrap(){
      const agent=(a)=>({
        id:a.id,name:a.name,age:a.age,town:a.settlement||'Bellweather',x:a.x,y:a.y,inside:a.inside?.name||'',home:a.home?.name||'',work:a.work?.name||'',occupation:a.occupation||'',role:a.role||'',alive:a.alive!==false,activity:a.activity||'',room:a.room||'',speed:a.speed||1,
        finance:this.clone(a.finance),legal:this.clone(a.legal),relationship:this.clone(a.relationship),knowledge:this.clone(a.knowledge)||{},interests:[...(a.interests||[])],brain:a.brain?{baseline:this.clone(a.brain.baseline)||{},learned:this.clone(a.brain.learned)||{},identityNotes:[...(a.brain.identityNotes||[])],values:[...(a.brain.values||[])],opinions:this.clone(a.brain.opinions)||{},memories:[...(a.brain.memories||[])],topicHistory:[...(a.brain.topicHistory||[])],recentLines:[...(a.brain.recentLines||[])],relationshipMemory:this.clone(a.brain.relationshipMemory)||{}}:null
      });
      const building=(b)=>({name:b.name,type:b.type||'',x:b.x,y:b.y,w:b.w,h:b.h,town:b.settlement||'Bellweather',door:b.door?{x:b.door.x,y:b.door.y}:null});
      let strategy={Bellweather:{},Greyhaven:{}};try{for(const t of ['Bellweather','Greyhaven'])strategy[t]={target:V14Strategy.towns[t]?.target?.label||V14Strategy.towns[t]?.target||null};}catch(_){}
      let governments={};try{governments={Bellweather:{mayorId:V10Gov.mayorId,councilIds:[...(V10Gov.councilIds||[])]},Greyhaven:{mayorId:GreyGov.mayorId,councilIds:[...(GreyGov.councilIds||[])]}};}catch(_){}
      let projects=[];try{projects=(V11Build.projects||[]).map(q=>({id:q.id||`${q.town}-${q.name}`,town:q.town||'Bellweather',name:q.name||q.kind||'Project',kind:q.kind||q.dynamicKind||'building',progress:Number(q.progress)||0,status:q.status||'planning',materials:this.clone(q.materials)||{}}));}catch(_){}
      return {day:W.day,t:W.t,worldTimeSec:Math.max(0,(W.day-1)*86400+W.t),weather:W.weather,agents:AGENTS.map(agent),buildings:BUILDINGS.map(building),resources:this.clone(typeof V11Resources!=='undefined'?V11Resources:{Bellweather:{},Greyhaven:{}}),diplomacy:this.clone(typeof V11Diplomacy!=='undefined'?V11Diplomacy:{state:'cold war',tension:70}),strategy,projects,governments,populationCap:1200};
    },
    apply(s){if(!s||!s.initialized)return;this.active=true;this.lastReceive=performance.now();this.lastSnapshot={receivedAt:performance.now(),serverNow:s.serverNow||Date.now(),worldTimeSec:Number(s.worldTimeSec)||0,timeMultiplier:Number(s.timeMultiplier)||1};window.V14_TIME_MULT=Math.max(1,this.lastSnapshot.timeMultiplier);
      this.setStatus(`SHARED WORLD · NETLIFY · ${s.viewers||1} VIEWER${s.viewers===1?'':'S'} · R${s.revision}`);
      for(const x of (s.agents||[])){const a=this.byId.get(Number(x.id))||AGENTS.find(q=>q.name===x.name);if(!a)continue;a._v15={x:Number(x.x)||0,y:Number(x.y)||0,target:x.target,receivedAt:performance.now(),worldTime:this.lastSnapshot.worldTimeSec};a.alive=x.alive!==false;a.settlement=x.town||a.settlement;a.activity=x.activity||a.activity;if(x.occupation)a.occupation=x.occupation;if(x.legal)a.legal=x.legal;if(x.inside){const b=this.buildingByName.get(x.inside);if(b)a.inside=b;}}
      try{if(s.resources){for(const t of ['Bellweather','Greyhaven'])if(s.resources[t])Object.assign(V11Resources[t],s.resources[t]);}}catch(_){}
      try{if(s.diplomacy)Object.assign(V11Diplomacy,s.diplomacy);}catch(_){}
      try{if(Array.isArray(s.projects)){V11Build.projects.length=0;s.projects.forEach(p=>V11Build.projects.push({...p}));}}catch(_){}
      this.syncConversations(s.conversations||[]);
      for(const e of (s.recentEvents||[]))this.applyEvent(e);
      this.lastServerState=s;
    },
    visualTick(dt){if(!this.lastSnapshot)return;const realElapsed=(performance.now()-this.lastSnapshot.receivedAt)/1000;const ws=this.lastSnapshot.worldTimeSec+realElapsed*20*this.lastSnapshot.timeMultiplier;W.day=Math.floor(ws/86400)+1;W.t=((ws%86400)+86400)%86400;W.abs=ws;
      for(const a of AGENTS){const v=a._v15;if(!v)continue;let x=v.x,y=v.y;const target=v.target;if(target&&Number.isFinite(target.x)&&Number.isFinite(target.y)){const elapsedWorld=Math.max(0,ws-v.worldTime),dx=target.x-v.x,dy=target.y-v.y,d=Math.hypot(dx,dy);const speed=.18;const step=Math.min(d,elapsedWorld*speed);if(d>0.01){x=v.x+dx/d*step;y=v.y+dy/d*step;}}a.x=x;a.y=y;a.path=null;a.target=null;}
      try{document.getElementById('clock').textContent=clockStr(W.t);}catch(_){}
    },
    syncConversations(list){
      for(const a of AGENTS)if(a.conv?._v15)a.conv=null;
      this.serverConversations.clear();
      for(const sc of list){const a=this.byId.get(Number(sc.aId)),b=this.byId.get(Number(sc.bId));if(!a||!b)continue;const c={id:sc.id,pair:[a,b],turn:sc.turn||0,brainMode:sc.mode==='deep'?'deep':'local',domain:sc.topic||'conversation',topicSeed:sc.topic||'',lines:[],_v15:true,status:sc.status};a.conv=b.conv=c;this.serverConversations.set(sc.id,c);
        for(const l of (sc.lines||[])){const key=`${sc.id}:${l.speakerId}:${l.at}:${l.text}`;if(this.seenLines.has(key))continue;this.seenLines.add(key);const sp=this.byId.get(Number(l.speakerId));const li=sp===a?b:a;if(!sp)continue;try{const line=record({cid:sc.id,sp,li,text:l.text,vol:'normal',tone:'natural',loc:locationOf(sp),kind:sc.mode==='deep'?'brain':'local-brain',hidden:false,about:false,adamHear:'none',mode:'NORMAL',actor:null,thought:false,domain:sc.topic||'conversation',concept:sc.topic||'conversation'});sp.bubble={text:l.text,vol:'normal',until:performance.now()+Math.min(10000,2400+l.text.length*42),line};c.lines.push(line);}catch(_){}
        }
      }
      if(this.seenLines.size>1500)this.seenLines=new Set([...this.seenLines].slice(-800));
    },
    applyEvent(e){if(!e||this.seenEvents.has(e.id)||e.kind==='conversation')return;this.seenEvents.add(e.id);try{event(e.text,e.kind||'world');}catch(_){}if(this.seenEvents.size>1200)this.seenEvents=new Set([...this.seenEvents].slice(-700));},
  };
  window.V16Shared=V16;
  window.V15Shared=V16;
  window.addEventListener('pagehide',()=>{clearTimeout(V16.pollTimer);});
  V16.init();
})();
