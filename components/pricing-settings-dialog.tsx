'use client';

import { useState } from 'react';
import { defaultPricingSettings, pricingSettingsSchema, type PricingSettings } from '@/lib/pricing-settings';
import { responseJson } from '@/lib/response-json';

interface PricingSettingsDialogProps {
  settings: PricingSettings;
  canEdit: boolean;
  onClose: () => void;
  onSave: (updated: PricingSettings) => void;
}

export function PricingSettingsDialog({ settings: initialSettings, canEdit, onClose, onSave }: PricingSettingsDialogProps) {
  const [form, setForm] = useState<PricingSettings>(initialSettings || defaultPricingSettings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const updateNumber = (path: string[], val: number) => {
    setForm(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      let curr = copy;
      for (let i = 0; i < path.length - 1; i++) {
        curr = curr[path[i]];
      }
      curr[path[path.length - 1]] = val;
      return copy;
    });
  };

  const handleSave = async () => {
    if (busy || !canEdit) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const parsed = pricingSettingsSchema.safeParse(form);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0].message);
      }

      const res = await fetch('/api/proposals/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const data = await responseJson(res);
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la configuración.');

      setNotice('Configuración de precios guardada correctamente.');
      onSave(parsed.data);
      setTimeout(() => onClose(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="sw-dialog" style={{ width: 'min(760px, 95vw)', padding: '24px' }} onMouseDown={e => e.stopPropagation()}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <p className="eyebrow">CONFIGURACIÓN DE MARGEN Y REGLAS</p>
            <h2 style={{ margin: 0, fontSize: '20px' }}>Tarifas, Cooperativa y Márgenes</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>

        {error && <p className="sw-error" role="alert">{error}</p>}
        {notice && <p style={{ background: '#ecfdf5', color: '#047857', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>{notice}</p>}

        <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '6px' }}>
          {/* Section 1: Márgenes */}
          <section style={{ marginBottom: '24px', background: '#fafafa', padding: '16px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '14px', margin: '0 0 12px', color: '#1e293b' }}>🎯 Márgenes de Beneficio (calculados sin IVA)</h3>
            <div className="sw-form-grid">
              <label>
                Margen Mínimo Aceptable (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(form.margin.minimum * 100)}
                  onChange={e => updateNumber(['margin', 'minimum'], Number(e.target.value) / 100)}
                  disabled={!canEdit || busy}
                />
              </label>

              <label>
                Buen Margen (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(form.margin.good * 100)}
                  onChange={e => updateNumber(['margin', 'good'], Number(e.target.value) / 100)}
                  disabled={!canEdit || busy}
                />
              </label>

              <label>
                Margen Objetivo (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(form.margin.target * 100)}
                  onChange={e => updateNumber(['margin', 'target'], Number(e.target.value) / 100)}
                  disabled={!canEdit || busy}
                />
              </label>

              <label>
                Contribución Mínima por Performer (€)
                <input
                  type="number"
                  min="0"
                  value={form.profit_floor.own_costume_performer_contribution_eur}
                  onChange={e => updateNumber(['profit_floor', 'own_costume_performer_contribution_eur'], Number(e.target.value))}
                  disabled={!canEdit || busy}
                />
              </label>
            </div>
          </section>

          {/* Section 2: Cooperativa y Altas */}
          <section style={{ marginBottom: '24px', background: '#fafafa', padding: '16px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '14px', margin: '0 0 12px', color: '#1e293b' }}>🏛 Cooperativa de Artistas</h3>
            <div className="sw-form-grid">
              <label>
                Comisión Cooperativa (% sobre neto)
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={form.cooperative.fee_percent_of_net * 100}
                  onChange={e => updateNumber(['cooperative', 'fee_percent_of_net'], Number(e.target.value) / 100)}
                  disabled={!canEdit || busy}
                />
              </label>

              <label>
                Alta Estándar por Artista/Día (€)
                <input
                  type="number"
                  min="0"
                  value={form.cooperative.registration_fee_per_artist_day}
                  onChange={e => updateNumber(['cooperative', 'registration_fee_per_artist_day'], Number(e.target.value))}
                  disabled={!canEdit || busy}
                />
              </label>

              <label>
                Umbral Neto Diario para 2ª Alta (€)
                <input
                  type="number"
                  min="0"
                  value={form.cooperative.second_registration_threshold_net_daily}
                  onChange={e => updateNumber(['cooperative', 'second_registration_threshold_net_daily'], Number(e.target.value))}
                  disabled={!canEdit || busy}
                />
              </label>

              <label>
                Total Alta si alcanza Umbral (€)
                <input
                  type="number"
                  min="0"
                  value={form.cooperative.registration_fee_at_or_above_threshold}
                  onChange={e => updateNumber(['cooperative', 'registration_fee_at_or_above_threshold'], Number(e.target.value))}
                  disabled={!canEdit || busy}
                />
              </label>
            </div>
          </section>

          {/* Section 3: Tarifas Comerciales Base */}
          <section style={{ marginBottom: '24px', background: '#fafafa', padding: '16px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '14px', margin: '0 0 12px', color: '#1e293b' }}>💶 Referencias Comerciales de Venta (€ por performer)</h3>
            <div className="sw-form-grid">
              <label>
                Recurrente / Semanal (≥ 4 fechas) (€)
                <input
                  type="number"
                  min="0"
                  value={form.rates.recurring_performer_sale}
                  onChange={e => updateNumber(['rates', 'recurring_performer_sale'], Number(e.target.value))}
                  disabled={!canEdit || busy}
                />
              </label>

              <label>
                Ocasional Local (€)
                <input
                  type="number"
                  min="0"
                  value={form.rates.occasional_local_sale}
                  onChange={e => updateNumber(['rates', 'occasional_local_sale'], Number(e.target.value))}
                  disabled={!canEdit || busy}
                />
              </label>

              <label>
                Boda / Evento Privado Base (€)
                <input
                  type="number"
                  min="0"
                  value={form.rates.private_wedding_base_sale}
                  onChange={e => updateNumber(['rates', 'private_wedding_base_sale'], Number(e.target.value))}
                  disabled={!canEdit || busy}
                />
              </label>

              <label>
                Cambio Adicional de Vestuario (€)
                <input
                  type="number"
                  min="0"
                  value={form.rates.costume_change_sale}
                  onChange={e => updateNumber(['rates', 'costume_change_sale'], Number(e.target.value))}
                  disabled={!canEdit || busy}
                />
              </label>
            </div>
          </section>

          {/* Section 4: Production Fees & Dietas */}
          <section style={{ marginBottom: '24px', background: '#fafafa', padding: '16px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: '14px', margin: '0 0 12px', color: '#1e293b' }}>✈ Production Fees y Dietas de Manutención</h3>
            <div className="sw-form-grid">
              <label>
                Production Fee Medio (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round(form.production_fee.medium * 100)}
                  onChange={e => updateNumber(['production_fee', 'medium'], Number(e.target.value) / 100)}
                  disabled={!canEdit || busy}
                />
              </label>

              <label>
                Production Fee Complejo (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round(form.production_fee.complex * 100)}
                  onChange={e => updateNumber(['production_fee', 'complex'], Number(e.target.value) / 100)}
                  disabled={!canEdit || busy}
                />
              </label>

              <label>
                Production Fee Muy Complejo (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round(form.production_fee.very_complex * 100)}
                  onChange={e => updateNumber(['production_fee', 'very_complex'], Number(e.target.value) / 100)}
                  disabled={!canEdit || busy}
                />
              </label>

              <label>
                Dieta España Pernocta (€/día)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.travel.per_diem_reference_2026.spain_overnight}
                  onChange={e => updateNumber(['travel', 'per_diem_reference_2026', 'spain_overnight'], Number(e.target.value))}
                  disabled={!canEdit || busy}
                />
              </label>
            </div>
          </section>
        </div>

        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '18px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
          <button className="secondary-button" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="primary-button" onClick={handleSave} disabled={busy || !canEdit}>
            {busy ? 'Guardando…' : 'Guardar Configuración'}
          </button>
        </footer>
      </div>
    </div>
  );
}
