'use client';

import {useEffect, useMemo, useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {AlertCircle, Box, CheckCircle2, ChevronRight, DollarSign, Filter, Wrench, Package, Plus, Search, ShieldAlert, Sparkles, Tag, Truck} from 'lucide-react';
import {responseJson} from '@/lib/response-json';
import {inventoryFinance} from '@/lib/inventory-finance';
import './inventory-workspace.css';

type Concept = {
  id: string;
  name: string;
  category: 'Characters' | 'Costumes' | 'Heads' | 'Props' | 'Accessories' | 'Technical' | 'Other';
  description: string | null;
  main_image: string | null;
  total_units: number;
  default_location: string | null;
  production_cost: number | null;
  replacement_value: number | null;
  suggested_rental_price: number | null;
  active: boolean;
  notes: string | null;
};

type Item = {
  id: string;
  concept_id: string;
  item_code: string;
  name: string | null;
  size: string | null;
  condition: 'NEW' | 'EXCELLENT' | 'GOOD' | 'USED' | 'DAMAGED';
  status: 'AVAILABLE' | 'RESERVED' | 'OUT' | 'REPAIR' | 'CLEANING' | 'LOST' | 'RETIRED';
  location: string | null;
  purchase_or_build_date: string | null;
  production_cost: number | null;
  replacement_value: number | null;
  main_image: string | null;
  notes: string | null;
  last_event_id: string | null;
  last_used_at: string | null;
};

type Repair = {
  id: string;
  inventory_item_id: string;
  date_reported: string;
  problem: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'NOT_REPAIRABLE';
  estimated_cost: number | null;
  actual_cost: number | null;
  assigned_to: string | null;
  date_completed: string | null;
  before_image: string | null;
  after_image: string | null;
  notes: string | null;
};

type Allocation = {
  id: string;
  event_id: string;
  concept_id: string;
  inventory_item_id: string | null;
  quantity: number;
  status: 'RESERVED' | 'OUT' | 'RETURNED' | 'CANCELLED';
  out_at: string | null;
  returned_at: string | null;
  rental_revenue: number | null;
  notes: string | null;
  events?: {id: string; event_name: string; event_date: string | null};
};

type Metrics = {
  totalConcepts: number;
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  outUnits: number;
  repairUnits: number;
  cleaningUnits: number;
  lostUnits: number;
  totalInventoryValue: number;
  totalRepairCost: number;
};

type AttentionItem = {
  id: string;
  item_code: string;
  name: string;
  concept_id: string;
  concept_name: string;
  status: string;
  condition: string;
  location: string;
  issue: string;
};

const CATEGORIES = ['Characters', 'Costumes', 'Heads', 'Props', 'Accessories', 'Technical', 'Other'] as const;
const LOCATIONS = ['Ibiza Warehouse', 'Valencia', 'Dubai', 'Castellón', 'Evento', 'Taller / Reparación', 'Otra'];

export function InventoryWorkspace({query = ''}: {query?: string}) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'catalog' | 'repairs'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [events, setEvents] = useState<{id: string; event_name: string; event_date: string | null}[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalConcepts: 0, totalUnits: 0, availableUnits: 0, reservedUnits: 0, outUnits: 0, repairUnits: 0, cleaningUnits: 0, lostUnits: 0, totalInventoryValue: 0, totalRepairCost: 0
  });
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);

  // Filters for Catalog
  const [search, setSearch] = useState(query);
  const [catFilter, setCatFilter] = useState('');
  const [locFilter, setLocFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dialogs
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [newConceptOpen, setNewConceptOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newRepairOpen, setNewRepairOpen] = useState(false);

  useEffect(() => setSearch(query), [query]);

  async function loadData() {
    setLoading(true);
    try {
      const r = await fetch('/api/inventory', {cache: 'no-store'});
      const d = await responseJson(r);
      if (!r.ok) throw new Error(d.error || 'Error al cargar el inventario.');
      setConcepts(d.data.concepts || []);
      setItems(d.data.items || []);
      setRepairs(d.data.repairs || []);
      setAllocations(d.data.allocations || []);
      setEvents(d.data.events || []);
      setMetrics(d.data.metrics);
      setAttentionItems(d.data.attentionItems || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const filteredConcepts = useMemo(() => {
    return concepts.filter(c => {
      const matchSearch = `${c.name} ${c.category} ${c.description || ''} ${c.notes || ''}`.toLowerCase().includes(search.toLowerCase());
      const matchCat = !catFilter || c.category === catFilter;
      const matchLoc = !locFilter || c.default_location === locFilter;
      const cItems = items.filter(i => i.concept_id === c.id);
      const matchStatus = !statusFilter || cItems.some(i => i.status === statusFilter);
      return matchSearch && matchCat && matchLoc && matchStatus;
    });
  }, [concepts, items, search, catFilter, locFilter, statusFilter]);

  async function saveConcept(formData: FormData) {
    const name = String(formData.get('name') || '').trim();
    const category = String(formData.get('category') || 'Other') as Concept['category'];
    const description = String(formData.get('description') || '').trim() || null;
    const default_location = String(formData.get('default_location') || 'Ibiza Warehouse').trim();
    const suggested_rental_price = formData.get('suggested_rental_price') ? Math.round(Number(formData.get('suggested_rental_price')) * 100) : null;
    const production_cost = formData.get('production_cost') ? Math.round(Number(formData.get('production_cost')) * 100) : null;
    const replacement_value = formData.get('replacement_value') ? Math.round(Number(formData.get('replacement_value')) * 100) : null;
    const main_image = String(formData.get('main_image') || '').trim() || null;
    const notes = String(formData.get('notes') || '').trim() || null;

    try {
      const r = await fetch('/api/inventory', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'saveConcept',
          concept: {
            id: selectedConcept?.id,
            name, category, description, default_location, suggested_rental_price, production_cost, replacement_value, main_image, notes
          }
        })
      });
      const d = await responseJson(r);
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar el concepto.');
      setNotice('Concepto guardado correctamente.');
      setNewConceptOpen(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar.');
    }
  }

  async function saveItem(formData: FormData, conceptId: string) {
    const item_code = String(formData.get('item_code') || '').trim();
    const name = String(formData.get('name') || '').trim() || null;
    const size = String(formData.get('size') || '').trim() || null;
    const condition = String(formData.get('condition') || 'GOOD') as Item['condition'];
    const status = String(formData.get('status') || 'AVAILABLE') as Item['status'];
    const location = String(formData.get('location') || 'Ibiza Warehouse').trim();

    try {
      const r = await fetch('/api/inventory', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'saveItem',
          item: {
            concept_id: conceptId, item_code, name, size, condition, status, location
          }
        })
      });
      const d = await responseJson(r);
      if (!r.ok) throw new Error(d.error || 'No se pudo crear la unidad física.');
      setNotice('Unidad física creada correctamente.');
      setNewItemOpen(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar.');
    }
  }

  async function saveRepair(formData: FormData) {
    const inventory_item_id = String(formData.get('inventory_item_id') || '');
    const problem = String(formData.get('problem') || '').trim();
    const status = String(formData.get('status') || 'PENDING') as Repair['status'];
    const assigned_to = String(formData.get('assigned_to') || '').trim() || null;
    const estimated_cost = formData.get('estimated_cost') ? Math.round(Number(formData.get('estimated_cost')) * 100) : null;
    const actual_cost = formData.get('actual_cost') ? Math.round(Number(formData.get('actual_cost')) * 100) : null;

    try {
      const r = await fetch('/api/inventory', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'saveRepair',
          repair: {
            inventory_item_id, problem, status, assigned_to, estimated_cost, actual_cost
          }
        })
      });
      const d = await responseJson(r);
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar la reparación.');
      setNotice('Reparación registrada correctamente.');
      setNewRepairOpen(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar la reparación.');
    }
  }

  async function updateItemStatus(itemId: string, newStatus: Item['status']) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    try {
      const r = await fetch('/api/inventory', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'saveItem',
          item: {...item, status: newStatus}
        })
      });
      if (r.ok) await loadData();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="inv-container">
      <div className="inv-header">
        <div>
          <p className="eyebrow">CONTROL FÍSICO Y LOGÍSTICA</p>
          <h1 style={{fontSize: 24, fontWeight: 800, margin: '2px 0 0', color: '#0f172a'}}>INVENTARIO / PRODUCCIÓN</h1>
          <p style={{fontSize: 13, color: '#64748b', margin: 0}}>Control de trajes, personajes, props, cabezas, reparaciones y rentabilidad de Performance Lab.</p>
        </div>
        <div style={{display: 'flex', gap: 10}}>
          <button className="secondary-button" onClick={() => setNewRepairOpen(true)}>+ Registrar reparación</button>
          <button className="primary-button" onClick={() => setNewConceptOpen(true)}>+ Crear concepto</button>
        </div>
      </div>

      <div className="inv-tabs">
        <button className={`inv-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          Dashboard
        </button>
        <button className={`inv-tab-btn ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => setActiveTab('catalog')}>
          Catálogo ({concepts.length})
        </button>
        <button className={`inv-tab-btn ${activeTab === 'repairs' ? 'active' : ''}`} onClick={() => setActiveTab('repairs')}>
          Reparaciones ({repairs.filter(r => r.status !== 'DONE').length})
        </button>
      </div>

      {error && <p className="cb-error" role="alert">{error}</p>}
      {notice && <p className="cb-feedback" aria-live="polite">{notice}</p>}

      {loading ? (
        <p style={{padding: 20}}>Cargando inventario de Performance Lab...</p>
      ) : activeTab === 'dashboard' ? (
        <>
          <div className="inv-kpi-grid">
            <div className="inv-kpi-card">
              <span className="inv-kpi-label">Conceptos</span>
              <span className="inv-kpi-value">{metrics.totalConcepts}</span>
              <span className="inv-kpi-sub">Tipos de vestuario/props</span>
            </div>
            <div className="inv-kpi-card">
              <span className="inv-kpi-label">Total Unidades</span>
              <span className="inv-kpi-value">{metrics.totalUnits}</span>
              <span className="inv-kpi-sub">Unidades físicas</span>
            </div>
            <div className="inv-kpi-card" style={{borderLeft: '4px solid #10b981'}}>
              <span className="inv-kpi-label">🟢 Disponibles</span>
              <span className="inv-kpi-value" style={{color: '#059669'}}>{metrics.availableUnits}</span>
              <span className="inv-kpi-sub">Listos para evento</span>
            </div>
            <div className="inv-kpi-card" style={{borderLeft: '4px solid #3b82f6'}}>
              <span className="inv-kpi-label">📦 Reservados / Fuera</span>
              <span className="inv-kpi-value" style={{color: '#2563eb'}}>{metrics.reservedUnits + metrics.outUnits}</span>
              <span className="inv-kpi-sub">{metrics.reservedUnits} reserv. · {metrics.outUnits} en evento</span>
            </div>
            <div className="inv-kpi-card" style={{borderLeft: '4px solid #ef4444'}}>
              <span className="inv-kpi-label">🔴 En Reparación</span>
              <span className="inv-kpi-value" style={{color: '#dc2626'}}>{metrics.repairUnits}</span>
              <span className="inv-kpi-sub">En taller de reparación</span>
            </div>
            <div className="inv-kpi-card" style={{borderLeft: '4px solid #f59e0b'}}>
              <span className="inv-kpi-label">🧹 Limpieza</span>
              <span className="inv-kpi-value" style={{color: '#d97706'}}>{metrics.cleaningUnits}</span>
              <span className="inv-kpi-sub">Mantenimiento/lavado</span>
            </div>
            <div className="inv-kpi-card" style={{borderLeft: '4px solid #6b7280'}}>
              <span className="inv-kpi-label">⚠️ Perdidos</span>
              <span className="inv-kpi-value" style={{color: '#4b5563'}}>{metrics.lostUnits}</span>
              <span className="inv-kpi-sub">Unidades sin localizar</span>
            </div>
            <div className="inv-kpi-card" style={{gridColumn: 'span 2'}}>
              <span className="inv-kpi-label">Valor Total Estimado</span>
              <span className="inv-kpi-value">{(metrics.totalInventoryValue / 100).toLocaleString('es-ES')} €</span>
              <span className="inv-kpi-sub">Valor de reposición/coste</span>
            </div>
            <div className="inv-kpi-card" style={{gridColumn: 'span 2'}}>
              <span className="inv-kpi-label">Costes Mantenimiento / Reparación</span>
              <span className="inv-kpi-value">{(metrics.totalRepairCost / 100).toLocaleString('es-ES')} €</span>
              <span className="inv-kpi-sub">Acumulado en reparaciones</span>
            </div>
          </div>

          <div className="inv-attention-panel">
            <div className="inv-attention-head">
              <ShieldAlert size={20}/>
              <span>NECESITA ATENCIÓN ({attentionItems.length})</span>
            </div>
            {attentionItems.length === 0 ? (
              <p style={{fontSize: 13, color: '#059669', margin: 0}}>✓ Todas las unidades físicas están en excelente estado y con ubicación asignada.</p>
            ) : (
              <div className="inv-attention-list">
                {attentionItems.map(item => (
                  <div key={item.id} className="inv-attention-item">
                    <div>
                      <b style={{fontSize: 13, color: '#0f172a'}}>{item.concept_name} — {item.item_code}</b>
                      <p style={{fontSize: 12, color: '#7f1d1d', margin: '2px 0 0'}}>{item.issue}</p>
                      <span style={{fontSize: 11, color: '#64748b'}}>Ubicación: {item.location}</span>
                    </div>
                    <button className="secondary-button" style={{fontSize: 11, padding: '4px 8px'}} onClick={() => {
                      const c = concepts.find(x => x.id === item.concept_id);
                      if (c) setSelectedConcept(c);
                    }}>Ver Ficha</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'catalog' ? (
        <>
          <div className="inv-catalog-toolbar">
            <div className="search-wrap" style={{minWidth: 220}}>
              <Search size={16}/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar concepto o material..." aria-label="Buscar concepto"/>
            </div>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} aria-label="Filtrar por categoría">
              <option value="">Todas las categorías</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={locFilter} onChange={e => setLocFilter(e.target.value)} aria-label="Filtrar por ubicación">
              <option value="">Todas las ubicaciones</option>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filtrar por estado">
              <option value="">Todos los estados</option>
              <option value="AVAILABLE">🟢 Disponibles</option>
              <option value="REPAIR">🔴 En Reparación</option>
              <option value="CLEANING">🧹 Limpieza</option>
              <option value="OUT">📦 Fuera en evento</option>
            </select>
          </div>

          <div className="inv-catalog-grid">
            {filteredConcepts.map(c => {
              const cItems = items.filter(i => i.concept_id === c.id);
              const avail = cItems.filter(i => i.status === 'AVAILABLE').length;
              const inRepair = cItems.filter(i => i.status === 'REPAIR').length;
              const inClean = cItems.filter(i => i.status === 'CLEANING').length;
              const cAllocations = allocations.filter(a => a.concept_id === c.id);
              const uses2026 = cAllocations.filter(a => a.status !== 'CANCELLED').length;
              const suggestedFee = c.suggested_rental_price ? (c.suggested_rental_price / 100) : null;

              return (
                <article key={c.id} className="inv-concept-card" onClick={() => setSelectedConcept(c)}>
                  {c.main_image ? (
                    <img src={c.main_image} alt={c.name} className="inv-card-img"/>
                  ) : (
                    <div className="inv-card-img"><Sparkles size={28}/></div>
                  )}
                  <div className="inv-card-body">
                    <span className="inv-card-tag">{c.category}</span>
                    <h3 className="inv-card-title">{c.name}</h3>
                    <p style={{fontSize: 12, color: '#64748b', margin: 0}}>{c.description || 'Sin descripción.'}</p>
                    <div className="inv-status-pill">
                      <span>📦 {c.total_units} un.</span>
                      <span style={{color: '#059669'}}>🟢 {avail} disp.</span>
                      {inRepair > 0 && <span style={{color: '#dc2626'}}>🔴 {inRepair} rep.</span>}
                      {inClean > 0 && <span style={{color: '#d97706'}}>🧹 {inClean} limp.</span>}
                    </div>
                    <div style={{fontSize: 12, color: '#475569', display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f1f5f9'}}>
                      <span>📍 {c.default_location || 'Ibiza Warehouse'}</span>
                      <span>Usos 2026: <strong>{uses2026}</strong></span>
                    </div>
                    {suggestedFee != null && (
                      <div style={{fontSize: 12, fontWeight: 700, color: '#2563eb'}}>
                        Alquiler sug.: {suggestedFee} €
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        /* Reparaciones Tab */
        <div className="inv-repairs-grid">
          {(['PENDING', 'IN_PROGRESS', 'DONE', 'NOT_REPAIRABLE'] as const).map(st => {
            const colRepairs = repairs.filter(r => r.status === st);
            const titleMap = {PENDING: '⏳ Pendientes', IN_PROGRESS: '⚙️ En Proceso', DONE: '✅ Terminadas', NOT_REPAIRABLE: '🚫 No Reparables'};
            return (
              <div key={st} className="inv-repair-column">
                <h3 style={{fontSize: 14, fontWeight: 700, margin: 0, color: '#0f172a'}}>{titleMap[st]} ({colRepairs.length})</h3>
                {colRepairs.map(r => {
                  const item = items.find(i => i.id === r.inventory_item_id);
                  const concept = concepts.find(c => c.id === item?.concept_id);
                  return (
                    <div key={r.id} className="inv-repair-card">
                      <b style={{fontSize: 13, color: '#0f172a'}}>{concept?.name} — {item?.item_code || 'Unidad'}</b>
                      <p style={{fontSize: 12, color: '#475569', margin: '4px 0'}}>{r.problem}</p>
                      <div style={{fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between'}}>
                        <span>Asignado: {r.assigned_to || 'Sin asignar'}</span>
                        <span>Coste: {r.actual_cost !== null ? `${r.actual_cost / 100} €` : r.estimated_cost !== null ? `Est. ${r.estimated_cost / 100} €` : 'Sin indicar'}</span>
                      </div>
                    </div>
                  );
                })}
                {colRepairs.length === 0 && <p style={{fontSize: 12, color: '#94a3b8'}}>No hay registros.</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Concept Detail Drawer */}
      <Dialog.Root open={!!selectedConcept} onOpenChange={v => { if (!v) setSelectedConcept(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="cb-overlay"/>
          <Dialog.Content className="cb-drawer">
            <Dialog.Title>{selectedConcept?.name}</Dialog.Title>
            <Dialog.Description>Ficha completa del concepto, unidades físicas y rentabilidad acumulada.</Dialog.Description>
            <Dialog.Close className="cb-close">Cerrar</Dialog.Close>

            {selectedConcept && (() => {
              const cItems = items.filter(i => i.concept_id === selectedConcept.id);
              const cAllocations = allocations.filter(a => a.concept_id === selectedConcept.id);
              const cRepairs = repairs.filter(r => cItems.some(i => i.id === r.inventory_item_id));

              const financials = inventoryFinance(cAllocations, cRepairs, selectedConcept.production_cost);

              return (
                <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
                  <div style={{background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', gap: 12}}>
                    {selectedConcept.main_image && (
                      <img src={selectedConcept.main_image} alt={selectedConcept.name} style={{width: 80, height: 80, objectFit: 'cover', borderRadius: 6}}/>
                    )}
                    <div>
                      <span className="inv-card-tag">{selectedConcept.category}</span>
                      <p style={{fontSize: 13, color: '#334155', margin: '4px 0'}}>{selectedConcept.description || 'Sin descripción especificada.'}</p>
                      <span style={{fontSize: 12, color: '#64748b'}}>Ubicación por defecto: <strong>{selectedConcept.default_location || 'Ibiza Warehouse'}</strong></span>
                    </div>
                  </div>

                  {/* Rentabilidad */}
                  <div style={{background: '#f0f9ff', padding: 14, borderRadius: 8, border: '1px solid #bae6fd'}}>
                    <h3 style={{fontSize: 14, fontWeight: 700, color: '#0369a1', margin: '0 0 8px'}}>Importes asignados al material</h3>
                    <p style={{fontSize: 11, color: '#0c4a6e', margin: '0 0 10px'}}>Importes explícitos, excluidas cancelaciones. No acreditan cobros ni beneficio contable. El saldo requiere todos los importes y costes reales. Reparaciones estimadas pendientes: {financials.estimatedRepairCost / 100} €.</p>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center', fontSize: 12}}>
                      <div><span style={{color: '#64748b'}}>Alquiler asignado conocido</span><br/><b style={{color: '#0284c7'}}>{financials.revenue / 100} €</b></div>
                      <div><span style={{color: '#64748b'}}>Coste indicado del concepto</span><br/><b>{selectedConcept.production_cost === null ? 'Sin indicar' : `${selectedConcept.production_cost / 100} €`}</b></div>
                      <div><span style={{color: '#64748b'}}>Reparaciones reales conocidas</span><br/><b style={{color: '#dc2626'}}>{financials.actualRepairCost / 100} €</b></div>
                      <div><span style={{color: '#64748b'}}>Saldo de asignaciones</span><br/><b>{financials.balance === null ? 'Datos incompletos' : `${financials.balance / 100} €`}</b></div>
                    </div>
                  </div>

                  {/* Unidades Físicas */}
                  <div>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                      <h3 style={{fontSize: 14, fontWeight: 700, margin: 0}}>UNIDADES FÍSICAS ({cItems.length})</h3>
                      <button className="secondary-button" style={{fontSize: 11}} onClick={() => setNewItemOpen(true)}>+ Añadir pieza física</button>
                    </div>

                    <table style={{width: '100%', fontSize: 12, borderCollapse: 'collapse'}}>
                      <thead>
                        <tr style={{background: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #cbd5e1'}}>
                          <th style={{padding: 6}}>Código</th>
                          <th style={{padding: 6}}>Talla</th>
                          <th style={{padding: 6}}>Estado</th>
                          <th style={{padding: 6}}>Ubicación</th>
                          <th style={{padding: 6}}>Cambiar Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cItems.map(item => (
                          <tr key={item.id} style={{borderBottom: '1px solid #f1f5f9'}}>
                            <td style={{padding: 6}}><b>{item.item_code}</b></td>
                            <td style={{padding: 6}}>{item.size || 'Única'}</td>
                            <td style={{padding: 6}}>
                              <span style={{
                                color: item.status === 'AVAILABLE' ? '#059669' : item.status === 'REPAIR' ? '#dc2626' : item.status === 'CLEANING' ? '#d97706' : '#2563eb',
                                fontWeight: 700
                              }}>{item.status}</span>
                            </td>
                            <td style={{padding: 6}}>{item.location || 'Almacén'}</td>
                            <td style={{padding: 6}}>
                              <select value={item.status} onChange={e => void updateItemStatus(item.id, e.target.value as Item['status'])} style={{fontSize: 11, padding: 2}}>
                                <option value="AVAILABLE">AVAILABLE</option>
                                <option value="RESERVED">RESERVED</option>
                                <option value="OUT">OUT</option>
                                <option value="REPAIR">REPAIR</option>
                                <option value="CLEANING">CLEANING</option>
                                <option value="LOST">LOST</option>
                                <option value="RETIRED">RETIRED</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                        {cItems.length === 0 && (
                          <tr><td colSpan={5} style={{padding: 10, textAlign: 'center', color: '#94a3b8'}}>No hay unidades físicas registradas para este concepto. Haz clic en "+ Añadir pieza física".</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Modal Nueva Unidad */}
                  <Dialog.Root open={newItemOpen} onOpenChange={setNewItemOpen}>
                    <Dialog.Portal>
                      <Dialog.Overlay className="cb-overlay"/>
                      <Dialog.Content className="cb-modal">
                        <Dialog.Title>Añadir pieza física ({selectedConcept.name})</Dialog.Title>
                        <form onSubmit={e => { e.preventDefault(); void saveItem(new FormData(e.currentTarget), selectedConcept.id); }}>
                          <label>Código de pieza (ej: PPS-01)<input name="item_code" required defaultValue={`${selectedConcept.name.slice(0, 3).toUpperCase()}-${String(cItems.length + 1).padStart(2, '0')}`}/></label>
                          <label>Nombre/Referencia opcional<input name="name" placeholder="Ej: Pom Pom Silver 01"/></label>
                          <label>Talla / Medida<input name="size" placeholder="Ej: M / L / Única"/></label>
                          <label>Ubicación<input name="location" defaultValue={selectedConcept.default_location || 'Ibiza Warehouse'}/></label>
                          <label>Condición
                            <select name="condition">
                              <option value="GOOD">Buena (GOOD)</option>
                              <option value="NEW">Nueva (NEW)</option>
                              <option value="EXCELLENT">Excelente (EXCELLENT)</option>
                              <option value="USED">Usada (USED)</option>
                              <option value="DAMAGED">Dañada (DAMAGED)</option>
                            </select>
                          </label>
                          <button className="primary-button" style={{marginTop: 10}}>Guardar Unidad Física</button>
                        </form>
                      </Dialog.Content>
                    </Dialog.Portal>
                  </Dialog.Root>

                  {/* Historial de Eventos */}
                  <div>
                    <h3 style={{fontSize: 14, fontWeight: 700, margin: '8px 0'}}>HISTORIAL DE USO EN EVENTOS ({cAllocations.length})</h3>
                    <table style={{width: '100%', fontSize: 12, borderCollapse: 'collapse'}}>
                      <thead>
                        <tr style={{background: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #cbd5e1'}}>
                          <th style={{padding: 6}}>Evento</th>
                          <th style={{padding: 6}}>Fecha</th>
                          <th style={{padding: 6}}>Cantidad</th>
                          <th style={{padding: 6}}>Alquiler Explicit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cAllocations.map(a => (
                          <tr key={a.id} style={{borderBottom: '1px solid #f1f5f9'}}>
                            <td style={{padding: 6}}><b>{a.events?.event_name || 'Evento'}</b></td>
                            <td style={{padding: 6}}>{a.events?.event_date || 'Sin fecha'}</td>
                            <td style={{padding: 6}}>{a.quantity} un.</td>
                            <td style={{padding: 6}}>{a.rental_revenue ? `${a.rental_revenue / 100} €` : 'Incluido'}</td>
                          </tr>
                        ))}
                        {cAllocations.length === 0 && (
                          <tr><td colSpan={4} style={{padding: 10, textAlign: 'center', color: '#94a3b8'}}>No hay eventos vinculados a este concepto aún.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal Nuevo Concepto */}
      <Dialog.Root open={newConceptOpen} onOpenChange={setNewConceptOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="cb-overlay"/>
          <Dialog.Content className="cb-modal">
            <Dialog.Title>Nuevo Concepto de Inventario</Dialog.Title>
            <form onSubmit={e => { e.preventDefault(); void saveConcept(new FormData(e.currentTarget)); }}>
              <label>Nombre del Concepto<input name="name" required placeholder="Ej: POM POM SILVER"/></label>
              <label>Categoría
                <select name="category">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>Descripción<textarea name="description" placeholder="Descripción física del vestuario/prop"/></label>
              <label>Ubicación por defecto<input name="default_location" defaultValue="Ibiza Warehouse"/></label>
              <label>Precio Alquiler Sugerido (€)<input name="suggested_rental_price" type="number" step="0.01" placeholder="Ej: 100.00"/></label>
              <label>Coste de Fabricación (€)<input name="production_cost" type="number" step="0.01" placeholder="Ej: 450.00"/></label>
              <label>Valor de Reposición (€)<input name="replacement_value" type="number" step="0.01" placeholder="Ej: 600.00"/></label>
              <button className="primary-button" style={{marginTop: 10}}>Crear Concepto</button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal Registrar Reparación */}
      <Dialog.Root open={newRepairOpen} onOpenChange={setNewRepairOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="cb-overlay"/>
          <Dialog.Content className="cb-modal">
            <Dialog.Title>Registrar Reparación / Mantenimiento</Dialog.Title>
            <form onSubmit={e => { e.preventDefault(); void saveRepair(new FormData(e.currentTarget)); }}>
              <label>Seleccionar Unidad Física
                <select name="inventory_item_id" required>
                  {items.map(i => {
                    const c = concepts.find(x => x.id === i.concept_id);
                    return <option key={i.id} value={i.id}>{c?.name} — {i.item_code} ({i.status})</option>;
                  })}
                </select>
              </label>
              <label>Problema / Daño detectado<textarea name="problem" required placeholder="Ej: Cremallera rota tras show"/></label>
              <label>Asignado a (Taller / Persona)<input name="assigned_to" placeholder="Ej: Taller Valencia / Sara"/></label>
              <label>Coste Estimado (€)<input name="estimated_cost" type="number" step="0.01" placeholder="0.00"/></label>
              <label>Coste Real (€)<input name="actual_cost" type="number" step="0.01" placeholder="0.00"/></label>
              <label>Estado Inicial
                <select name="status">
                  <option value="PENDING">Pendiente (PENDING)</option>
                  <option value="IN_PROGRESS">En proceso (IN_PROGRESS)</option>
                  <option value="DONE">Terminada (DONE)</option>
                </select>
              </label>
              <button className="primary-button" style={{marginTop: 10}}>Registrar Reparación</button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
