'use client';
import {useState} from 'react';
import {createClient} from '@/lib/supabase/client';
export function SignOut(){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function leave(){setBusy(true);setError('');try{const {error}=await createClient().auth.signOut({scope:'local'});if(error)throw error;window.location.replace('/auth');}catch{setError('No se pudo cerrar la sesión. Inténtalo de nuevo.');setBusy(false);}}
  return <div><button className="nav-item" disabled={busy} onClick={()=>void leave()}>{busy?'Cerrando sesión…':'Cerrar sesión'}</button>{error&&<p role="alert">{error}</p>}</div>;
}
