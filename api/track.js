import { put } from '@vercel/blob';

const APP_STATS_VERSION = 'v47';
const EVENT_PREFIX = 'events-v47/';
const LATEST_PREFIX = 'latest-v47/';

function safeName(value){
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','no-store');

  if(req.method === 'OPTIONS') return res.status(200).end();
  if(req.method !== 'POST') return res.status(405).json({ok:false, error:'Method not allowed'});

  try{
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const sessionId = body.sessionId || body.sessionSnapshot?.id || `s_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const statsSeq = Number(body.statsSeq ?? body.patch?.statsSeq ?? body.sessionSnapshot?.statsSeq ?? 0);
    const eventType = body.eventType || 'event';
    const createdAt = new Date().toISOString();
    const safeId = safeName(sessionId);

    const patch = Object.assign({}, body.patch || {}, {
      appVersion:APP_STATS_VERSION,
      statsNamespace:'events-v47',
      updatedAt: body.patch?.updatedAt || createdAt
    });

    const event = {
      sessionId,
      eventType,
      statsSeq,
      createdAt,
      appVersion:APP_STATS_VERSION,
      statsNamespace:'events-v47',
      patch,
      sessionSnapshot: body.sessionSnapshot || null
    };

    const eventPath = `${EVENT_PREFIX}${safeId}/${String(statsSeq).padStart(6,'0')}-${Date.now()}-${safeName(eventType)}.json`;
    await put(eventPath, JSON.stringify(event, null, 2), {
      access:'private',
      contentType:'application/json',
      allowOverwrite:false
    });

    const latest = Object.assign({}, body.sessionSnapshot || {}, patch, {
      id: sessionId,
      appVersion:APP_STATS_VERSION,
      statsNamespace:'events-v47',
      statsSeq,
      updatedAt: createdAt,
      lastEventType:eventType
    });

    await put(`${LATEST_PREFIX}${safeId}.json`, JSON.stringify(latest, null, 2), {
      access:'private',
      contentType:'application/json',
      allowOverwrite:true
    });

    return res.status(200).json({ok:true, mode:'fresh-v47-append-only', sessionId, eventType, statsSeq});
  }catch(error){
    return res.status(500).json({ok:false, error:error.message});
  }
}
