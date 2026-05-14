import { list, get } from '@vercel/blob';

const EVENT_PREFIX = 'events-v47/';

async function readJsonPath(pathname){
  const result = await get(pathname, { access:'private' });
  if(!result || result.statusCode !== 200 || !result.stream) return null;
  const text = await new Response(result.stream).text();
  return JSON.parse(text);
}

async function listAll(prefix){
  let cursor = undefined;
  const blobs = [];
  do{
    const page = await list({prefix, limit:1000, cursor});
    blobs.push(...(page.blobs || []));
    cursor = page.cursor;
  }while(cursor);
  return blobs;
}

function mergeEventsIntoSessions(events){
  const sessions = {};
  const sorted = events.slice().sort((a,b)=>{
    const as = Number(a.statsSeq || a.patch?.statsSeq || 0);
    const bs = Number(b.statsSeq || b.patch?.statsSeq || 0);
    if(as !== bs) return as - bs;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  });

  for(const e of sorted){
    const id = e.sessionId || e.sessionSnapshot?.id || e.patch?.id;
    if(!id) continue;

    if(!sessions[id]){
      sessions[id] = {id, appVersion:'v47', statsNamespace:'events-v47', startedAt:e.createdAt, events:[]};
    }

    const s = sessions[id];

    if(e.sessionSnapshot && typeof e.sessionSnapshot === 'object') Object.assign(s, e.sessionSnapshot);
    if(e.patch && typeof e.patch === 'object') Object.assign(s, e.patch);

    s.id = id;
    s.appVersion = 'v47';
    s.statsNamespace = 'events-v47';
    s.statsSeq = Math.max(Number(s.statsSeq || 0), Number(e.statsSeq || e.patch?.statsSeq || 0));
    s.updatedAt = e.createdAt || s.updatedAt;
    s.lastEventType = e.eventType || s.lastEventType;
    s.events = Array.isArray(s.events) ? s.events : [];
    s.events.push({eventType:e.eventType, patch:e.patch || {}, createdAt:e.createdAt, statsSeq:e.statsSeq});

    if(e.eventType === 'start' && !s.startedAt) s.startedAt = e.createdAt;
    if(e.eventType === 'listening_started') s.listeningStarted = true;
    if(e.eventType === 'listening_complete') s.listeningComplete = true;
    if(['quiz_answer_selected','quiz_submitted','grammar_answer_selected','grammar_submitted','matching_progress'].includes(e.eventType)) s.activitiesStarted = true;
    if(e.eventType === 'activities_complete') s.activitiesComplete = true;
    if(e.eventType === 'speaking_started') s.conversationStarted = true;
    if(e.eventType === 'feedback_viewed') s.feedbackViewed = true;
    if(e.eventType === 'completed') s.conversationComplete = true;
    if(e.eventType === 'save_clicked') s.saveClicked = true;
  }

  return Object.values(sessions);
}

export default async function handler(req, res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  try{
    const blobs = await listAll(EVENT_PREFIX);
    const events = [];
    for(const b of blobs){
      try{
        const item = await readJsonPath(b.pathname);
        if(item) events.push(item);
      }catch(e){}
    }

    const sessions = mergeEventsIntoSessions(events);
    const allEvents = sessions.flatMap(s => Array.isArray(s.events) ? s.events : []);

    return res.status(200).json({
      ok:true,
      mode:'fresh-v47-append-only',
      namespace:'events-v47',
      access:'private',
      count:sessions.length,
      eventCount:allEvents.length,
      blobCount:blobs.length,
      sessions,
      events:allEvents,
      generatedAt:new Date().toISOString()
    });
  }catch(error){
    return res.status(500).json({ok:false, error:error.message, sessions:[], events:[]});
  }
}
