"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { addDays, fmtDate, loadObjectTags, startOfWeek, successRate } from "@/lib/lifeos/clientHelpers";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

export default function AnalyticsPage() {
  return (
    <AppShell
      title="Analytics"
      subtitle="Карты прогресса по трекерам, heatmap, risk/success, journals, schedule, tags и Data Science режим."
    >
      <AuthGate>{(user) => <AnalyticsInner user={user}/>}</AuthGate>
    </AppShell>
  );
}

function AnalyticsInner({ user }: { user: any }) {
  const sb = createBrowserSupabase();
  const [data, setData] = useState<any>({ trackers: [], events: [], entries: [], tokens: [], rules: [] });
  const [tagMap, setTagMap] = useState<Map<string,string[]>>(new Map());
  const [tab, setTab] = useState("progress maps");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [{data: trackers},{data: events},{data: entries},{data: tokens},{data: rules}] = await Promise.all([
      sb.from("trackers").select("*").eq("user_id", user.id),
      sb.from("tracker_events").select("*").eq("user_id", user.id).order("occurred_at"),
      sb.from("journal_entries").select("*").eq("user_id", user.id).order("created_at"),
      sb.from("schedule_tokens").select("*").eq("user_id", user.id).order("start_at"),
      sb.from("schedule_rules").select("*").eq("user_id", user.id)
    ]);
    setData({ trackers: trackers||[], events: events||[], entries: entries||[], tokens: tokens||[], rules: rules||[] });
    const maps = await Promise.all([
      loadObjectTags(sb, user.id, "tracker", (trackers||[]).map((x:any)=>x.id)),
      loadObjectTags(sb, user.id, "journal_entry", (entries||[]).map((x:any)=>x.id)),
      loadObjectTags(sb, user.id, "schedule_token", [...(tokens||[]).map((x:any)=>x.id), ...(rules||[]).map((x:any)=>x.id)])
    ]);
    const merged = new Map<string,string[]>();
    for (const m of maps) for (const [k,v] of m.entries()) merged.set(k,v);
    setTagMap(merged);
  }

  const analytics = useMemo(() => buildAnalytics(data, tagMap), [data, tagMap]);

  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2">
      {["progress maps","overview","trackers","journals","schedule","tags","data science"].map((x)=>(
        <button key={x} onClick={()=>setTab(x)} className={`life-tab ${tab===x?"active":""}`}>{x}</button>
      ))}
    </div>
    {tab === "progress maps" && <ProgressMaps analytics={analytics}/>} 
    {tab === "overview" && <Overview analytics={analytics}/>} 
    {tab === "trackers" && <TrackersAnalytics analytics={analytics}/>} 
    {tab === "journals" && <JournalsAnalytics analytics={analytics}/>} 
    {tab === "schedule" && <ScheduleAnalytics analytics={analytics}/>} 
    {tab === "tags" && <TagsAnalytics analytics={analytics}/>} 
    {tab === "data science" && <DataScience analytics={analytics}/>} 
  </div>;
}

function buildAnalytics(data: any, tagMap: Map<string,string[]>) {
  const events = data.events || [];
  const trackers = data.trackers || [];
  const entries = data.entries || [];
  const tokens = data.tokens || [];
  const done = events.filter((e:any)=>e.event_type==="done" || e.event_type==="partial_done").length;
  const fail = events.filter((e:any)=>e.event_type==="fail").length;
  const byDay = new Map<string, any>();
  for (let i=89;i>=0;i--) {
    const d=addDays(new Date(), -i);
    const key=d.toISOString().slice(0,10);
    byDay.set(key,{date:key,done:0,fail:0,words:0,planned:0,total:0});
  }
  for (const e of events) {
    const key=new Date(e.occurred_at).toISOString().slice(0,10);
    const row=byDay.get(key);
    if(row){ if(["done","partial_done"].includes(e.event_type)) row.done++; if(e.event_type==="fail") row.fail++; row.total++; }
  }
  for (const e of entries) {
    const key=new Date(e.created_at).toISOString().slice(0,10);
    const row=byDay.get(key);
    if(row){ row.words += e.word_count || 0; row.total += e.word_count ? 1 : 0; }
  }
  for (const t of tokens) {
    const key=new Date(t.start_at).toISOString().slice(0,10);
    const row=byDay.get(key);
    if(row){ row.planned += Math.max(0, (+new Date(t.end_at)-+new Date(t.start_at))/36e5); row.total++; }
  }
  const activity = Array.from(byDay.values());

  const trackerRows = trackers.map((t:any)=>{
    const ev=events.filter((e:any)=>e.tracker_id===t.id);
    const d=ev.filter((e:any)=>["done","partial_done"].includes(e.event_type)).length;
    const f=ev.filter((e:any)=>e.event_type==="fail").length;
    const rate=successRate(d,f);
    const risk=Math.max(0, Math.round((100-rate) + f*8 - d*2));
    return {...t,done:d,fail:f,success_rate:rate,risk_score:risk,tags:tagMap.get(t.id)||[],events:ev.length,_events:ev};
  }).sort((a:any,b:any)=>b.risk_score-a.risk_score);

  const trackerType = groupCount(trackers, (t:any)=>t.type);
  const trackerPriority = groupCount(trackers, (t:any)=>t.priority);
  const trackerTrend = aggregateDaily(events.filter((e:any)=>["done","partial_done","fail"].includes(e.event_type)), "occurred_at", (e:any)=>e.event_type==="fail"?"fail":"done");

  const wordsByWeek = aggregateWeekly(entries, "created_at", (e:any)=>e.word_count||0, "words");
  const entriesByType = groupCount(entries, (e:any)=>e.entry_type);
  const journalTop = entries.slice().sort((a:any,b:any)=>(b.word_count||0)-(a.word_count||0)).slice(0,10).map((e:any)=>({name:e.title.slice(0,28), words:e.word_count||0}));

  const tokenHours = tokens.map((t:any)=>({ ...t, hours: Math.max(0, (+new Date(t.end_at)-+new Date(t.start_at))/36e5), tags: tagMap.get(t.id)||[] }));
  const hoursByDay = aggregateBy(tokenHours, (t:any)=>new Date(t.start_at).toLocaleDateString([], {weekday:"short"}), (t:any)=>t.hours, "hours");
  const hoursBySource = aggregateBy(tokenHours, (t:any)=>t.source_type, (t:any)=>t.hours, "hours");
  const topTokens = aggregateBy(tokenHours, (t:any)=>t.title, (t:any)=>t.hours, "hours").sort((a:any,b:any)=>b.hours-a.hours).slice(0,10);

  const tagStats = new Map<string, any>();
  function tagRow(name:string){ if(!tagStats.has(name)) tagStats.set(name,{tag:name,trackers:0,entries:0,tokens:0,done:0,fail:0,words:0,hours:0}); return tagStats.get(name); }
  for (const tr of trackerRows) for (const tag of tr.tags){ const r=tagRow(tag); r.trackers++; r.done+=tr.done; r.fail+=tr.fail; }
  for (const e of entries) for (const tag of tagMap.get(e.id)||[]){ const r=tagRow(tag); r.entries++; r.words += e.word_count||0; }
  for (const t of tokenHours) for (const tag of t.tags){ const r=tagRow(tag); r.tokens++; r.hours += t.hours; }
  const tags = Array.from(tagStats.values()).map((r:any)=>({...r, success: successRate(r.done,r.fail)})).sort((a:any,b:any)=>(b.hours+b.words/500+b.done)-(a.hours+a.words/500+a.done));

  return { done, fail, success: successRate(done,fail), activity, trackerRows, trackerType, trackerPriority, trackerTrend, wordsByWeek, entriesByType, journalTop, hoursByDay, hoursBySource, topTokens, tags, counts: { trackers: trackers.length, entries: entries.length, tokens: tokens.length, events: events.length } };
}

function groupCount(arr:any[], fn:(x:any)=>string){ const m=new Map<string,number>(); for(const x of arr)m.set(fn(x)||"unknown",(m.get(fn(x)||"unknown")||0)+1); return Array.from(m.entries()).map(([name,count])=>({name,count})); }
function aggregateBy(arr:any[], keyFn:(x:any)=>string, valFn:(x:any)=>number, valueName:string){ const m=new Map<string,number>(); for(const x of arr){const k=keyFn(x)||"unknown"; m.set(k,(m.get(k)||0)+valFn(x));} return Array.from(m.entries()).map(([name,v])=>({name,[valueName]:Math.round(v*10)/10})); }
function aggregateDaily(arr:any[], dateKey:string, typeFn:(x:any)=>string){ const m=new Map<string,any>(); for(let i=29;i>=0;i--){const k=addDays(new Date(),-i).toISOString().slice(5,10); m.set(k,{date:k,done:0,fail:0});} for(const x of arr){const k=new Date(x[dateKey]).toISOString().slice(5,10); const r=m.get(k); if(r) r[typeFn(x)]++;} return Array.from(m.values()); }
function aggregateWeekly(arr:any[], dateKey:string, valFn:(x:any)=>number, valueName:string){ const m=new Map<string,number>(); for(const x of arr){const d=startOfWeek(new Date(x[dateKey])); const k=fmtDate(d); m.set(k,(m.get(k)||0)+valFn(x));} return Array.from(m.entries()).map(([week,v])=>({week,[valueName]:v})).slice(-12); }

function Card({title, children, subtitle}:{title:string;children:React.ReactNode;subtitle?:string}){
  return <div className="life-card p-4 md:p-5"><div className="mb-3"><h3 className="text-lg font-black">{title}</h3>{subtitle && <p className="mt-1 text-sm text-white/48">{subtitle}</p>}</div>{children}</div>;
}
function Metric({label,value}:{label:string;value:any}){ return <div className="life-card p-4"><div className="text-sm text-white/45">{label}</div><div className="mt-1 text-3xl font-black">{value}</div></div>; }

function ProgressMaps({analytics}:any){
  const [filter, setFilter] = useState("all");
  const rows = filter === "all" ? analytics.trackerRows : analytics.trackerRows.filter((t:any)=>t.type===filter);
  return <div className="space-y-5">
    <div className="life-card p-4">
      <div className="mb-3 text-sm text-white/55">Это как Excel-карта привычек: каждый tracker получает свою визуальную дорожку прогресса. Daily = кубики по дням, weekly/monthly = широкие блоки периода, deadline = гонка к дедлайну, countdown = серия циклов до сброса через Done.</div>
      <div className="flex flex-wrap gap-2">{["all","cycle","deadline","countdown","gray"].map((x)=><button key={x} onClick={()=>setFilter(x)} className={`life-tab ${filter===x?"active":""}`}>{x}</button>)}</div>
    </div>
    <div className="grid gap-4">
      {rows.map((tracker:any)=><TrackerProgressCard key={tracker.id} tracker={tracker}/>) }
      {!rows.length && <div className="life-card p-8 text-center text-white/50">No trackers for this filter.</div>}
    </div>
  </div>;
}

function TrackerProgressCard({ tracker }: { tracker: any }) {
  const events = [...(tracker._events || [])].sort((a:any,b:any)=>+new Date(a.occurred_at)-+new Date(b.occurred_at));
  const tags = tracker.tags || [];
  return <article className="life-card-strong overflow-hidden p-4 md:p-5">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2"><span className="life-badge">{tracker.type}</span><span className="life-badge">{tracker.priority}</span>{tags.map((t:string)=><span key={t} className="life-chip">#{t}</span>)}</div>
        <h3 className="text-xl font-black">{tracker.title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs text-white/58">
        <div className="rounded-xl bg-white/[.04] px-3 py-2"><b className="text-white">{tracker.done}</b><br/>done</div>
        <div className="rounded-xl bg-white/[.04] px-3 py-2"><b className="text-white">{tracker.fail}</b><br/>fail</div>
        <div className="rounded-xl bg-white/[.04] px-3 py-2"><b className="text-white">{tracker.success_rate}%</b><br/>success</div>
      </div>
    </div>
    {tracker.type === "deadline" ? <DeadlineRace tracker={tracker} events={events}/> : tracker.type === "countdown" ? <CountdownRace tracker={tracker} events={events}/> : <CycleGrid tracker={tracker} events={events}/>} 
    <Legend />
  </article>;
}

function Legend(){return <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/45"><span className="progress-legend done"/>done/finish <span className="progress-legend partial"/>partial <span className="progress-legend fail"/>fail/missed <span className="progress-legend empty"/>no data <span className="progress-legend current"/>current waiting</div>}

function dayKey(d:Date){return d.toISOString().slice(0,10);}
function sameDay(a:Date,b:Date){return dayKey(a)===dayKey(b);}
function pct(n:number){return `${Math.max(0, Math.min(1, n))*100}%`;}
function eventInRange(events:any[], start:Date, end:Date, types:string[]){ return events.find((e:any)=>{const d=new Date(e.occurred_at); return d>=start && d<end && types.includes(e.event_type);}); }
function cycleLenDays(type?:string|null){ return type === "weekly" ? 7 : type === "monthly" ? 30 : 1; }

function CycleGrid({ tracker, events }: { tracker:any; events:any[] }) {
  const len = cycleLenDays(tracker.cycle_type);
  const today = new Date(); today.setHours(0,0,0,0);
  const totalDays = len === 1 ? 56 : len === 7 ? 84 : 180;
  const first = addDays(today, -totalDays + 1);
  const segments:any[] = [];
  if (len === 1) {
    for (let i=0;i<56;i++) {
      const start = addDays(today, -55+i);
      const end = addDays(start, 1);
      segments.push(segmentForPeriod(events, start, end, 1, sameDay(start,today)));
    }
  } else {
    let cursor = len === 7 ? startOfWeek(first) : new Date(first.getFullYear(), first.getMonth(), 1);
    while (cursor <= today) {
      const start = new Date(cursor);
      const end = len === 7 ? addDays(start, 7) : new Date(start.getFullYear(), start.getMonth()+1, 1);
      const width = len === 7 ? 7 : Math.max(28, Math.round((+end-+start)/86400000));
      segments.push(segmentForPeriod(events, start, end, width, today>=start && today<end));
      cursor = end;
    }
  }
  return <div>
    <div className="mb-2 text-sm text-white/58">Cycle map · {tracker.cycle_type || "daily"}</div>
    <div className="progress-track">{segments.map((s,i)=><span key={i} className={`progress-seg ${s.cls}`} style={{gridColumn:`span ${s.span}`}} title={s.title}/>)}</div>
  </div>;
}
function segmentForPeriod(events:any[], start:Date, end:Date, span:number, current:boolean){
  const fail = eventInRange(events,start,end,["fail"]);
  const partial = eventInRange(events,start,end,["partial_done"]);
  const done = eventInRange(events,start,end,["done"]);
  let cls = current ? "current" : "empty";
  if (done) cls = "done";
  else if (partial) cls = "partial";
  else if (fail) cls = "fail";
  const title = `${fmtDate(start)} — ${fmtDate(addDays(end,-1))}: ${cls}`;
  return { cls, span, title };
}

function DeadlineRace({ tracker, events }: { tracker:any; events:any[] }) {
  const created = new Date(tracker.created_at);
  const deadline = tracker.deadline_at ? new Date(tracker.deadline_at) : addDays(created, 30);
  const done = events.find((e:any)=>["done","partial_done"].includes(e.event_type));
  const now = new Date();
  const total = Math.max(1, +deadline - +created);
  const donePos = done ? (+new Date(done.occurred_at) - +created) / total : null;
  const nowPos = (+now - +created) / total;
  const over = now > deadline && !done;
  return <div>
    <div className="mb-2 text-sm text-white/58">Deadline race · {fmtDate(created)} → {tracker.deadline_at ? fmtDate(deadline) : "no deadline"}</div>
    <div className={`deadline-race ${over ? "over" : ""}`}>
      <span className="race-marker now" style={{left:pct(nowPos)}} title="today" />
      {done && <span className="race-marker finish" style={{left:pct(donePos || 0)}} title={`finish: ${fmtDate(new Date(done.occurred_at))}`} />}
    </div>
    <div className="mt-2 flex justify-between text-xs text-white/42"><span>start</span><span>{done ? "finished" : over ? "missed" : "finish line"}</span></div>
  </div>;
}

function CountdownRace({ tracker, events }: { tracker:any; events:any[] }) {
  const doneEvents = events.filter((e:any)=>["done","partial_done"].includes(e.event_type));
  const start = new Date(tracker.created_at);
  const days = Number(tracker.countdown_days || 1);
  const points = [start, ...doneEvents.map((e:any)=>new Date(e.occurred_at)), new Date()].sort((a,b)=>+a-+b);
  const segments:any[] = [];
  for (let i=0;i<points.length-1;i++) {
    const a=points[i], b=points[i+1];
    const spanDays = Math.max(.2,(+b-+a)/86400000);
    const ratio = spanDays / Math.max(days,1);
    const isClosed = i < points.length-2;
    const cls = isClosed ? "done" : ratio >= 1 ? "fail" : ratio > .75 ? "urgent" : ratio > .45 ? "partial" : "current";
    segments.push({cls, span:Math.max(2, Math.min(14, Math.round(spanDays*2))), title:`${fmtDate(a)} → ${fmtDate(b)} · ${Math.round(spanDays*10)/10} days`});
  }
  return <div>
    <div className="mb-2 text-sm text-white/58">Countdown chain · every {days} day(s). Done closes the current segment and starts the next one.</div>
    <div className="progress-track countdown-track">{segments.map((s,i)=><span key={i} className={`progress-seg ${s.cls}`} style={{gridColumn:`span ${s.span}`}} title={s.title}/>)}</div>
  </div>;
}

function Overview({analytics}:any){return <div className="space-y-5"><div className="grid gap-3 md:grid-cols-5"><Metric label="Done" value={analytics.done}/><Metric label="Fail" value={analytics.fail}/><Metric label="Success" value={`${analytics.success}%`}/><Metric label="Trackers" value={analytics.counts.trackers}/><Metric label="Entries" value={analytics.counts.entries}/></div><Card title="Activity heatmap"><Heatmap data={analytics.activity}/></Card><div className="grid gap-5 lg:grid-cols-2"><Card title="Done / fail over time"><ChartLine data={analytics.trackerTrend}/></Card><Card title="High risk trackers"><ChartBar data={analytics.trackerRows.slice(0,8).map((x:any)=>({name:x.title.slice(0,18),value:x.risk_score}))}/></Card></div></div>}
function TrackersAnalytics({analytics}:any){return <div className="space-y-5"><div className="grid gap-5 lg:grid-cols-2"><Card title="Trackers by type"><ChartBar data={analytics.trackerType.map((x:any)=>({name:x.name,value:x.count}))}/></Card><Card title="Trackers by priority"><ChartBar data={analytics.trackerPriority.map((x:any)=>({name:x.name,value:x.count}))}/></Card></div><Card title="Tracker feature matrix"><table className="life-table"><thead><tr><th>Tracker</th><th>Done</th><th>Fail</th><th>Success</th><th>Risk</th><th>Tags</th><th>Segment</th></tr></thead><tbody>{analytics.trackerRows.map((r:any)=><tr key={r.id}><td>{r.title}</td><td>{r.done}</td><td>{r.fail}</td><td>{r.success_rate}%</td><td>{r.risk_score}</td><td>{r.tags.map((t:string)=>`#${t}`).join(" ")}</td><td>{r.events<3?"not enough data":r.risk_score>80?"high risk":r.success_rate>75?"stable":"mixed"}</td></tr>)}</tbody></table></Card></div>}
function JournalsAnalytics({analytics}:any){return <div className="grid gap-5 lg:grid-cols-2"><Card title="Journal words by week"><ChartLine data={analytics.wordsByWeek} x="week" a="words"/></Card><Card title="Entries by type"><ChartBar data={analytics.entriesByType.map((x:any)=>({name:x.name,value:x.count}))}/></Card><Card title="Top entries by words"><ChartBar data={analytics.journalTop.map((x:any)=>({name:x.name,value:x.words}))}/></Card></div>}
function ScheduleAnalytics({analytics}:any){return <div className="grid gap-5 lg:grid-cols-2"><Card title="Planned hours by day"><ChartBar data={analytics.hoursByDay.map((x:any)=>({name:x.name,value:x.hours}))}/></Card><Card title="Planned hours by source"><ChartPie data={analytics.hoursBySource.map((x:any)=>({name:x.name,value:x.hours}))}/></Card><Card title="Top tokens by hours"><ChartBar data={analytics.topTokens.map((x:any)=>({name:x.name.slice(0,22),value:x.hours}))}/></Card></div>}
function TagsAnalytics({analytics}:any){return <div className="space-y-5"><Card title="Top tags by planned hours"><ChartBar data={analytics.tags.slice(0,12).map((x:any)=>({name:"#"+x.tag,value:x.hours}))}/></Card><Card title="Tag matrix"><table className="life-table"><thead><tr><th>Tag</th><th>Trackers</th><th>Entries</th><th>Tokens</th><th>Done</th><th>Fail</th><th>Success</th><th>Words</th><th>Hours</th></tr></thead><tbody>{analytics.tags.map((r:any)=><tr key={r.tag}><td>#{r.tag}</td><td>{r.trackers}</td><td>{r.entries}</td><td>{r.tokens}</td><td>{r.done}</td><td>{r.fail}</td><td>{r.success}%</td><td>{r.words}</td><td>{Math.round(r.hours*10)/10}</td></tr>)}</tbody></table></Card></div>}
function DataScience({analytics}:any){return <div className="space-y-5"><Card title="Risk vs success scatter"><div className="h-80"><ResponsiveContainer width="100%" height="100%"><ScatterChart><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)"/><XAxis dataKey="risk_score" name="risk" stroke="rgba(255,255,255,.45)"/><YAxis dataKey="success_rate" name="success" stroke="rgba(255,255,255,.45)"/><Tooltip/><Scatter data={analytics.trackerRows}/></ScatterChart></ResponsiveContainer></div></Card><Card title="DS notes"><div className="space-y-2 text-sm text-white/60"><p>Feature matrix готова для экспорта/ML: type, priority, done, fail, success_rate, risk_score, tag_count.</p><p>Progress maps — это уже поведенческие временные ряды по каждому tracker. Потом их можно использовать для clustering/anomaly detection.</p></div></Card></div>}
function ChartBar({data}:any){return <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)"/><XAxis dataKey="name" stroke="rgba(255,255,255,.45)"/><YAxis stroke="rgba(255,255,255,.45)"/><Tooltip/><Bar dataKey="value" radius={[8,8,0,0]}/></BarChart></ResponsiveContainer></div>}
function ChartLine({data,x="date",a="done"}:any){return <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)"/><XAxis dataKey={x} stroke="rgba(255,255,255,.45)"/><YAxis stroke="rgba(255,255,255,.45)"/><Tooltip/><Line type="monotone" dataKey={a} strokeWidth={2}/><Line type="monotone" dataKey="fail" strokeWidth={2}/></LineChart></ResponsiveContainer></div>}
function ChartPie({data}:any){return <div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip/><Pie data={data} dataKey="value" nameKey="name" outerRadius={95}>{data.map((_:any,i:number)=><Cell key={i}/>)}</Pie></PieChart></ResponsiveContainer></div>}
function Heatmap({data}:any){return <div className="flex flex-wrap gap-1">{data.map((d:any)=>{const n=Math.min(4, Math.floor(d.total + d.words/500 + d.planned/2)); return <span key={d.date} title={`${d.date}: done ${d.done}, fail ${d.fail}, words ${d.words}, planned ${Math.round(d.planned*10)/10}h`} className={`heat-cell heat-${n}`}/>})}</div>}
