export const WORLD='bellweather-main';
export const TOWNS=['Bellweather','Greyhaven'];
export const MAX_DEEP=5, MAX_CONV=12, MAX_EVENTS=300;
export const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
export const clean=(s,n=240)=>String(s??'').replace(/\s+/g,' ').trim().slice(0,n);
export function hash(s){let h=2166136261>>>0;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
export function rnd(s){let x=hash(s);x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296}
export const pick=(a,s)=>a.length?a[Math.floor(rnd(s)*a.length)%a.length]:null;
export const day=s=>Math.floor((s.worldTimeSec||0)/86400)+1;
export const hour=s=>((s.worldTimeSec||0)/3600)%24;
