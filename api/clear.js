import { list, del } from '@vercel/blob';

const PREFIXES_TO_CLEAR = ['events-v47/', 'latest-v47/'];

async function deletePrefix(prefix){
  let deleted = 0;
  let cursor = undefined;
  do{
    const page = await list({prefix, limit:1000, cursor});
    const blobs = page.blobs || [];
    const pathnames = blobs.map(b => b.pathname).filter(Boolean);
    if(pathnames.length){
      await del(pathnames);
      deleted += pathnames.length;
    }
    cursor = page.cursor;
  }while(cursor);
  return deleted;
}

export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','no-store');

  if(req.method === 'OPTIONS') return res.status(200).end();
  if(req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ok:false, error:'Method not allowed'});
  }

  try{
    let deleted = 0;
    for(const prefix of PREFIXES_TO_CLEAR) deleted += await deletePrefix(prefix);
    const verify = await list({prefix:'events-v47/', limit:1000});
    return res.status(200).json({ok:true, deleted, remaining:(verify.blobs||[]).length});
  }catch(error){
    return res.status(500).json({ok:false, error:error.message});
  }
}
