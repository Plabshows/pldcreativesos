'use client';
import {useEffect,useState} from 'react';
import {responseJson} from '@/lib/response-json';
export function TeamDirectory(){
  const [members,setMembers]=useState<{id:string;name:string;email:string;role:string}[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{let live=true;fetch('/api/team',{cache:'no-store'}).then(async r=>{const d=await responseJson(r);if(!r.ok)throw Error(d.error);if(live)setMembers(d.members);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
  if(loading)return <p>Cargando miembros del espacio…</p>;
  if(error)return <p role="alert">{error}</p>;
  const roles:Record<string,string>={admin:'Administrador',producer:'Producción',sales:'Ventas',wardrobe:'Vestuario'};
  return <div className="team-grid">{members.map(m=><article className="team-card" key={m.id}><div className="avatar">{m.name.slice(0,1)}</div><div><h3>{m.name}</h3><p>{roles[m.role]||m.role}</p><small>{m.email}</small></div></article>)}</div>;
}
