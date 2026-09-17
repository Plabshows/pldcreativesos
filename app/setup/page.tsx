import Link from 'next/link';
import { CheckCircle2, CircleAlert, ArrowLeft } from 'lucide-react';
import { hasSupabaseConfig } from '@/lib/env';

export default function SetupPage() {
  const configured = hasSupabaseConfig();
  return <main className="setup-page"><div className="setup-card"><Link href="/" className="back-link"><ArrowLeft size={14} /> Volver a Mi día</Link><p className="eyebrow">CONFIGURACIÓN INICIAL</p><h1>Conecta el espacio de trabajo</h1><p className="setup-copy">La interfaz ya está lista. Cuando conectes Supabase, clientes, eventos, talento y tareas quedarán guardados para todo el equipo.</p><div className={`setup-status ${configured ? 'ready' : 'pending'}`}>{configured ? <CheckCircle2 size={19} /> : <CircleAlert size={19} />}<div><b>{configured ? 'Supabase conectado' : 'Supabase pendiente'}</b><span>{configured ? 'La persistencia está disponible para activar los módulos.' : 'Añade NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local.'}</span></div></div><div className="setup-steps"><div><b>01</b><span>Crear un proyecto en Supabase</span><small>Usa la migración incluida en supabase/migrations.</small></div><div><b>02</b><span>Configurar autenticación</span><small>Activa acceso por correo y contraseña para el equipo.</small></div><div><b>03</b><span>Invitar al equipo</span><small>Asigna roles: admin, producer, sales o wardrobe.</small></div></div><Link href="/" className="primary-button setup-button">Abrir el panel</Link></div></main>;
}
