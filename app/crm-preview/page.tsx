'use client';
import { useState } from 'react';
import { CrmWorkspace } from '@/components/crm-workspace';
export default function CrmPreview(){
  const [mode,setMode]=useState<'leads'|'opportunities'>('leads');
  if(process.env.NODE_ENV!=='development')return <p>La prueba local está disponible únicamente en desarrollo.</p>;
  return <main className="crm-preview-shell"><nav className="crm-preview-nav"><a href="/">← Volver al workspace</a><button aria-pressed={mode==='leads'} onClick={()=>setMode('leads')}>Leads</button><button aria-pressed={mode==='opportunities'} onClick={()=>setMode('opportunities')}>Pipeline</button></nav><CrmWorkspace mode={mode} localPreview/></main>;
}
