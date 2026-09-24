'use client';
import {useEffect, useState, type FormEvent} from 'react';
import {Building2, Check, ChevronDown, Plus, RefreshCw} from 'lucide-react';
import {responseJson} from '@/lib/response-json';

export function WorkspacePicker() {
  const [spaces, setSpaces] = useState<{id: string; name: string}[]>([]);
  const [active, setActive] = useState('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadWorkspaces = async () => {
    try {
      const r = await fetch('/api/workspaces', {cache: 'no-store'});
      const data = await responseJson(r);
      if (!r.ok) throw new Error(data.error);
      setSpaces(data.workspaces || []);
      setActive(data.activeId || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los espacios.');
    }
  };

  useEffect(() => {
    void loadWorkspaces();
  }, []);

  async function send(method: 'POST' | 'PUT', body: object) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/workspaces', {
        method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
      });
      const data = await responseJson(r);
      if (!r.ok) throw new Error(data.error);
      window.location.href = '/';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el espacio.');
      setBusy(false);
    }
  }

  async function resetToMain() {
    setBusy(true);
    setError('');
    try {
      await fetch('/api/workspaces', { method: 'DELETE' });
      window.location.href = '/';
    } catch {
      window.location.reload();
    }
  }

  function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    void send('POST', {name: name.trim()});
  }

  const activeSpace = spaces.find(s => s.id === active);
  const mainSpace = spaces.find(s => s.name === 'Performance Lab');
  const isSecondary = activeSpace && mainSpace && activeSpace.id !== mainSpace.id;

  return (
    <section style={{marginBottom: 20, background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)'}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6}}>
        <span style={{fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 0.5}}>Espacio de trabajo</span>
        {isSecondary && (
          <button
            disabled={busy}
            style={{border: 0, background: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, padding: 0}}
            onClick={() => void resetToMain()}
            title="Volver a Performance Lab principal"
          >
            <RefreshCw size={11}/> Ir a Principal
          </button>
        )}
      </div>

      <select
        aria-label="Espacio de trabajo activo"
        value={active}
        disabled={busy}
        onChange={e => {
          if (!e.target.value) {
            void resetToMain();
          } else {
            void send('PUT', {workspaceId: e.target.value});
          }
        }}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 6,
          background: '#0f172a',
          color: '#ffffff',
          border: '1px solid #334155',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        {spaces.map(s => (
          <option key={s.id} value={s.id}>
            {s.name} {s.name === 'Performance Lab' ? ' (Principal)' : ''}
          </option>
        ))}
      </select>

      {isSecondary && (
        <div style={{marginTop: 8, background: '#1e3a8a', border: '1px solid #3b82f6', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: '#dbeafe'}}>
          <span style={{fontWeight: 600, display: 'block', marginBottom: 4}}>Estás en el espacio secundario: <strong>{activeSpace?.name}</strong></span>
          <button
            disabled={busy}
            style={{border: 0, background: '#2563eb', color: '#ffffff', cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 4, width: '100%'}}
            onClick={() => void resetToMain()}
          >
            ⚡ Volver al Espacio Principal (Performance Lab)
          </button>
        </div>
      )}

      <button
        type="button"
        style={{border: 0, background: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', marginTop: 8, padding: 0, display: 'flex', alignItems: 'center', gap: 4}}
        onClick={() => setOpen(!open)}
      >
        <Plus size={13}/> {open ? 'Cerrar nuevo espacio' : 'Crear otro espacio de trabajo'}
      </button>

      {open && (
        <form onSubmit={create} style={{marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#1e293b', padding: 10, borderRadius: 8}}>
          <label style={{fontSize: 11, color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 4}}>
            Nombre del nuevo espacio
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Dubai / Ibiza 2026"
              minLength={2}
              maxLength={80}
              required
              disabled={busy}
              style={{padding: 6, borderRadius: 4, border: '1px solid #475569', background: '#0f172a', color: '#fff', fontSize: 12}}
            />
          </label>
          <p style={{fontSize: 11, color: '#94a3b8', margin: 0}}>Se creará separado con sus propios clientes, eventos y facturas.</p>
          <button className="primary-button" disabled={busy} style={{fontSize: 12, padding: '6px 12px'}}>
            {busy ? 'Creando…' : 'Crear espacio'}
          </button>
        </form>
      )}

      {error && <p role="alert" style={{color: '#f87171', fontSize: 11, margin: '6px 0 0'}}>{error}</p>}
    </section>
  );
}
