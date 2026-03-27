// ============================================================
//  MÓDULO: MI PERFIL (Paciente Móvil)
//  Adaptado de la versión web para el entorno APK.
// ============================================================

export function mountProfile(root, { bus, store, user }) {

    // ── Encontrar el registro del paciente vinculado al usuario ──
    function getPatient() {
        if (user.patientId) return store.find('patients', user.patientId);
        const all = store.get('patients');
        return all.find(p => p.email === user.email || p.username === user.username) || null;
    }

    // ── Estado local ─────────────────────────────────────────────
    const state = { editing: false, patient: getPatient() };

    // ── SVG Icons ────────────────────────────────────────────────
    const I = {
        user: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
        phone: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 12 19.79 19.79 0 0 1 1.04 3.38 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
        mail: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
        map: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
        heart: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
        alert: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        shield: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        edit: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
        save: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
        cancel: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        id: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>`,
        check: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
    };

    // ── Helpers ──────────────────────────────────────────────────
    function age(birthDate) {
        if (!birthDate) return '—';
        const d = new Date(birthDate);
        const y = new Date().getFullYear() - d.getFullYear();
        return y > 0 ? `${y} años` : '—';
    }
    function fmtDate(d) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    }

    // ── Render ───────────────────────────────────────────────────
    function render() {
        state.patient = getPatient();
        const p = state.patient;

        if (!p) {
            root.innerHTML = `
        <div style="padding:3rem;text-align:center;color:var(--neutralSecondary);">
          <div style="font-size:3rem;margin-bottom:1rem;opacity:0.3;">${I.user}</div>
          <h3>No se encontró su perfil</h3>
          <p>Contacte a recepción para vincular su cuenta móvil.</p>
        </div>`;
            return;
        }

        root.innerHTML = state.editing ? renderEditForm(p) : renderView(p);
        setupListeners();
    }

    // ── Vista de solo lectura ─────────────────────────────────────
    function renderView(p) {
        const initials = p.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        return `
<style>
.profile-mobile-wrap { display:flex; flex-direction:column; gap:1rem; padding-bottom: 2rem; }
.profile-card-m { background:var(--white); border-radius:16px; border:1px solid #e2e8f0; overflow:hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
.profile-hdr-m {
  display:flex; align-items:center; gap:0.6rem;
  padding:0.75rem 1rem; border-bottom:1px solid #f1f5f9;
  background:#f8fafc; font-size:0.65rem;
  font-weight:800; color:var(--neutralSecondary); letter-spacing:0.05em; text-transform:uppercase;
}
.profile-grid-m { display:grid; grid-template-columns:1fr; }
.profile-field-m {
  padding:0.8rem 1rem; border-bottom:1px solid #f1f5f9;
  display:flex; flex-direction:column; gap:0.2rem;
}
.profile-field-m:last-child { border-bottom: none; }
.profile-field-m label { font-size:0.65rem; font-weight:700; color:var(--neutralSecondary); text-transform:uppercase; display:flex; align-items:center; gap:0.4rem; }
.profile-field-m span  { font-size:0.9rem; color:var(--neutralPrimary); font-weight:500; }
.badge-allergy-m { display:inline-flex; align-items:center; gap:4px; background:#fef2f2; color:#dc2626; border:1px solid #fca5a5; border-radius:20px; padding:2px 10px; font-size:0.75rem; font-weight:700; }
.btn-edit-m {
  background: var(--themePrimary); color: white; border: none; padding: 12px; border-radius: 12px;
  font-weight: 600; font-size: 0.9rem; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px;
}
</style>

<div class="profile-mobile-wrap">

  <!-- HERO -->
  <div class="profile-card-m" style="padding: 1.5rem; text-align: center; background: linear-gradient(to bottom, #f8fafc, #ffffff);">
    <div style="width:80px; height:80px; border-radius:50%; background:var(--themePrimary); color:white; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:800; margin:0 auto 1rem; border:4px solid var(--themeLighter);">
      ${initials}
    </div>
    <h2 style="margin:0; font-size:1.25rem; font-weight:800; color:var(--themeDark);">${p.name}</h2>
    <p style="margin:0.5rem 0 1rem; font-size:0.85rem; color:var(--neutralSecondary);">Cédula: ${p.dni || '—'}</p>
    <button class="btn-edit-m" id="btn-edit-profile">${I.edit} Editar Datos</button>
  </div>

  <!-- SECCIONES -->
  <div class="profile-card-m">
    <div class="profile-hdr-m">${I.user} Datos Personales</div>
    <div class="profile-grid-m">
      <div class="profile-field-m"><label>${I.calendar} Nacimiento</label><span>${fmtDate(p.birthDate)} (${age(p.birthDate)})</span></div>
      <div class="profile-field-m"><label>Género</label><span>${p.gender === 'M' ? 'Masculino' : p.gender === 'F' ? 'Femenino' : p.gender || '—'}</span></div>
      <div class="profile-field-m"><label>Nacionalidad</label><span>${p.nationality || '—'}</span></div>
    </div>
  </div>

  <div class="profile-card-m">
    <div class="profile-hdr-m">${I.phone} Contacto</div>
    <div class="profile-grid-m">
      <div class="profile-field-m"><label>Teléfono</label><span>${p.phone || '—'}</span></div>
      <div class="profile-field-m"><label>Email</label><span>${p.email || '—'}</span></div>
      <div class="profile-field-m"><label>Dirección</label><span>${p.address || '—'}</span></div>
    </div>
  </div>

  <div class="profile-card-m">
    <div class="profile-hdr-m">${I.heart} Salud</div>
    <div class="profile-grid-m">
      <div class="profile-field-m"><label>Grupo Sanguíneo</label><span>${p.bloodType || '—'}</span></div>
      <div class="profile-field-m"><label>Alergias</label>
        <span>
          ${p.allergies?.length
                ? p.allergies.map(a => `<span class="badge-allergy-m">${I.alert} ${a}</span>`).join(' ')
                : 'Sin alergias registradas'}
        </span>
      </div>
    </div>
  </div>

  <div class="profile-card-m">
    <div class="profile-hdr-m">${I.alert} Emergencia</div>
    <div class="profile-grid-m">
      <div class="profile-field-m"><label>Nombre</label><span>${p.emergencyContact?.name || '—'}</span></div>
      <div class="profile-field-m"><label>Teléfono</label><span>${p.emergencyContact?.phone || '—'}</span></div>
    </div>
  </div>

</div>`;
    }

    // ── Formulario de edición ─────────────────────────────────────
    function renderEditForm(p) {
        return `
<div class="profile-mobile-wrap">
  <div class="profile-card-m" style="padding: 1.25rem;">
    <h3 style="margin-bottom:1.25rem; font-size:1rem; color:var(--themePrimary);">Editar Información</h3>
    
    <div class="form-group" style="margin-bottom:1rem;">
      <label class="login-label">Nombre Completo</label>
      <input class="login-input" id="ef-name" type="text" value="${p.name || ''}">
    </div>

    <div class="form-group" style="margin-bottom:1rem;">
      <label class="login-label">Teléfono</label>
      <input class="login-input" id="ef-phone" type="tel" value="${p.phone || ''}">
    </div>

    <div class="form-group" style="margin-bottom:1rem;">
      <label class="login-label">Correo Electrónico</label>
      <input class="login-input" id="ef-email" type="email" value="${p.email || ''}">
    </div>

    <div class="form-group" style="margin-bottom:1rem;">
      <label class="login-label">Dirección</label>
      <input class="login-input" id="ef-address" type="text" value="${p.address || ''}">
    </div>

    <div class="form-group" style="margin-bottom:1rem;">
      <label class="login-label">Contacto de Emergencia</label>
      <input class="login-input" id="ef-ec-name" type="text" value="${p.emergencyContact?.name || ''}" placeholder="Nombre">
      <input class="login-input" id="ef-ec-phone" type="tel" value="${p.emergencyContact?.phone || ''}" placeholder="Teléfono" style="margin-top:0.5rem;">
    </div>

    <div style="display:flex; gap:0.75rem; margin-top:1.5rem;">
      <button class="btn-outline" id="btn-cancel-edit" style="flex:1;">Cancelar</button>
      <button class="btn-primary" id="btn-save-profile" style="flex:2;">Guardar Cambios</button>
    </div>
  </div>
</div>`;
    }

    // ── Event Listeners ───────────────────────────────────────────
    function setupListeners() {
        root.querySelector('#btn-edit-profile')?.addEventListener('click', () => {
            state.editing = true;
            render();
        });

        root.querySelector('#btn-cancel-edit')?.addEventListener('click', () => {
            state.editing = false;
            render();
        });

        root.querySelector('#btn-save-profile')?.addEventListener('click', () => {
            const p = state.patient;
            const updated = {
                ...p,
                name: root.querySelector('#ef-name').value.trim(),
                phone: root.querySelector('#ef-phone').value.trim(),
                email: root.querySelector('#ef-email').value.trim(),
                address: root.querySelector('#ef-address').value.trim(),
                emergencyContact: {
                    name: root.querySelector('#ef-ec-name').value.trim(),
                    phone: root.querySelector('#ef-ec-phone').value.trim(),
                },
                updatedAt: Date.now()
            };

            store.update('patients', p.id, updated);
            state.editing = false;
            if (window.showToast) window.showToast('Perfil actualizado');
            render();

            // Emitir evento para actualizar el header si es necesario
            if (bus && bus.emit) bus.emit('profile-updated', updated);
        });
    }

    render();
}
