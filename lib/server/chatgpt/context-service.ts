import type {ContextGraph,ContextRequest,ContextRow} from '@/lib/chatgpt/contracts';
import type {ContextRepository,ContextTable} from './repository';
import {ContextNotFound} from './permissions';
const ids=(rows:ContextRow[],key='id')=>rows.map(r=>r[key]).filter((v):v is string=>typeof v==='string'&&!!v);
const unique=(rows:ContextRow[])=>[...new Map(rows.map(r=>[r.id,r])).values()];
const tableFor={lead:'leads',client:'clients',event:'events',proposal:'proposals',opportunity:'opportunities'} as const;
async function gather(repo:ContextRepository,type:ContextRequest['entityType'],id:string):Promise<ContextGraph>{
 const root=await repo.find(tableFor[type],'id',[id]);if(root.length!==1)throw new ContextNotFound();
 const g:ContextGraph={root:type,rootId:id,capturedAt:new Date().toISOString(),clients:[],leads:[],opportunities:[],events:[],proposals:[],shows:[],performers:[],assignments:[],payments:[],activities:[],tasks:[],historyEvents:[],historyProposals:[]};
 if(type==='client'){
  g.clients=root;[g.events,g.proposals,g.leads,g.opportunities]=await Promise.all(['events','proposals','leads','opportunities'].map(t=>repo.find(t as ContextTable,'client_id',[id])));
 }else if(type==='lead'){g.leads=root;g.opportunities=await repo.find('opportunities','lead_id',[id]);}
 else if(type==='proposal'){g.proposals=root;g.opportunities=await repo.find('opportunities','id',ids(root,'opportunity_id'));}
 else if(type==='opportunity'){g.opportunities=root;}
 else {g.events=root;[g.proposals,g.opportunities]=await Promise.all([repo.find('proposals','event_id',[id]),repo.find('opportunities','event_id',[id])]);}
 g.leads=unique([...g.leads,...await repo.find('leads','id',ids(g.opportunities,'lead_id'))]);
 g.proposals=unique([...g.proposals,...await repo.find('proposals','opportunity_id',ids(g.opportunities))]);
 g.events=unique([...g.events,...await repo.find('events','id',[...ids(g.proposals,'event_id'),...ids(g.opportunities,'event_id')])]);
 g.clients=unique([...g.clients,...await repo.find('clients','id',[...ids(g.leads,'client_id'),...ids(g.opportunities,'client_id'),...ids(g.proposals,'client_id'),...ids(g.events,'client_id')])]);
 const [links,assignments,payments,historyEvents,historyProposals,leadActivity,opActivity]=await Promise.all([
  repo.find('event_shows','event_id',ids(g.events)),repo.find('event_talent','event_id',ids(g.events)),repo.find('payments','event_id',ids(g.events)),
  repo.find('events','client_id',ids(g.clients)),repo.find('proposals','client_id',ids(g.clients)),repo.find('crm_activities','lead_id',ids(g.leads)),repo.find('crm_activities','opportunity_id',ids(g.opportunities)),
 ]);
 const proposalShowIds:string[]=[];for(const p of g.proposals){const doc=p.document as {options?:{lines?:{show_ids?:string[]}[]}[]}|undefined;for(const o of doc?.options||[])for(const l of o.lines||[])proposalShowIds.push(...l.show_ids||[]);}
 [g.shows,g.performers]=await Promise.all([repo.find('shows','id',[...ids(links,'show_id'),...proposalShowIds]),repo.find('talent','id',ids(assignments,'talent_id'))]);
 // Link IDs are retained for attribution; records are rendered once.
 g.events=g.events.map(e=>({...e,context_show_ids:links.filter(l=>l.event_id===e.id).map(l=>l.show_id)}));
 g.assignments=assignments;g.payments=payments;g.activities=unique([...leadActivity,...opActivity]);
 g.historyEvents=historyEvents.filter(e=>!g.events.some(r=>r.id===e.id));g.historyProposals=historyProposals.filter(p=>!g.proposals.some(r=>r.id===p.id));
 const related=await Promise.all([['client_id',ids(g.clients)],['event_id',ids(g.events)],['lead_id',ids(g.leads)],['opportunity_id',ids(g.opportunities)],['proposal_id',ids(g.proposals)]].map(([key,values])=>repo.find('tasks',key as string,values as string[])));
 g.tasks=unique(related.flat());return g;
}
export const getClientContext=(repo:ContextRepository,id:string)=>gather(repo,'client',id);
export const getLeadContext=(repo:ContextRepository,id:string)=>gather(repo,'lead',id);
export const getProposalContext=(repo:ContextRepository,id:string)=>gather(repo,'proposal',id);
export const getEventContext=(repo:ContextRepository,id:string)=>gather(repo,'event',id);
export const getOpportunityContext=(repo:ContextRepository,id:string)=>gather(repo,'opportunity',id);
export function getChatGPTContext(repo:ContextRepository,input:ContextRequest){return ({client:getClientContext,lead:getLeadContext,proposal:getProposalContext,event:getEventContext,opportunity:getOpportunityContext}[input.entityType])(repo,input.entityId);}
