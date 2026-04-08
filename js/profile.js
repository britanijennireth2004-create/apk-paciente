// ============================================================
//  MÓDULO: MI PERFIL (Paciente Móvil)
//  Adaptado de la versión web para el entorno APK.
//  Permite al paciente editar TODOS sus datos personales
//  CORREGIDO: Manejo correcto de fechas y campos completos
// ============================================================

import { formatBirthDate, parseDateUTC } from './utils.js';

export function mountProfile(root, { bus, store, user }) {

    // ── Encontrar el registro del paciente vinculado al usuario ──
    function getPatient() {
        if (user.patientId) return store.find('patients', user.patientId);
        const all = store.get('patients');
        return all.find(p => p.email === user.email || p.username === user.username) || null;
    }

    // ── Estado local ──
    const state = { editing: false, patient: getPatient(), tempProfilePicture: null };

    // ── Calcular edad correctamente ──
    function calculateAgeFromBirthDate(birthDate) {
        if (!birthDate) return '—';
        const birthParts = birthDate.split('-');
        const birthUTC = new Date(Date.UTC(
            parseInt(birthParts[0]),
            parseInt(birthParts[1]) - 1,
            parseInt(birthParts[2])
        ));
        const today = new Date();
        const todayUTC = new Date(Date.UTC(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        ));
        let age = todayUTC.getUTCFullYear() - birthUTC.getUTCFullYear();
        const monthDiff = todayUTC.getUTCMonth() - birthUTC.getUTCMonth();
        if (monthDiff < 0 || (monthDiff === 0 && todayUTC.getUTCDate() < birthUTC.getUTCDate())) {
            age--;
        }
        return age > 0 ? age : '—';
    }

    // ── Formatear fecha de nacimiento ──
    function formatBirthDateDisplay(birthDate) {
        if (!birthDate) return '—';
        return formatBirthDate(birthDate);
    }

    // ── Opciones para selects ──
    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const genders = [
        { value: 'M', label: 'Masculino' },
        { value: 'F', label: 'Femenino' },
        { value: 'O', label: 'Otro' }
    ];
    const civilStatuses = [
        { value: 'Soltero/a', label: 'Soltero/a' },
        { value: 'Casado/a', label: 'Casado/a' },
        { value: 'Divorciado/a', label: 'Divorciado/a' },
        { value: 'Viudo/a', label: 'Viudo/a' },
        { value: 'Unión Libre', label: 'Unión Libre' }
    ];
    const nationalities = [
        'Venezolana', 'Colombiana', 'Peruana', 'Ecuatoriana', 'Boliviana',
        'Argentina', 'Chilena', 'Mexicana', 'Española', 'Estadounidense',
        'Brasileña', 'Paraguaya', 'Uruguaya', 'Canadiense', 'Francesa',
        'Italiana', 'Alemana', 'Portuguesa', 'China', 'Japonesa', 'Otra'
    ];

    // ── SVG Icons ──
    const I = {
        user: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
        phone: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 12 19.79 19.79 0 0 1 1.04 3.38 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
        mail: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
        map: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
        heart: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
        alert: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        edit: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
        blood: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 4 8 12 8 12s8-8 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>`,
        flag: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7m0-10v3m0 0h16l-3 4 3 4H4z"/></svg>`
    };

    // ── Render ──
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

    // ── Vista de solo lectura ──
    function renderView(p) {
        const initials = p.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        const profilePicture = p.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=003b69&color=fff&bold=true&size=200`;
        const birthDateFormatted = formatBirthDateDisplay(p.birthDate);
        const ageValue = calculateAgeFromBirthDate(p.birthDate);
        
        // Obtener etiqueta de género
        const genderLabel = p.gender === 'M' ? 'Masculino' : p.gender === 'F' ? 'Femenino' : p.gender === 'O' ? 'Otro' : p.gender || '—';
        
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
                .badge-allergy-m { display:inline-flex; align-items:center; gap:4px; background:#fef2f2; color:#dc2626; border:1px solid #fca5a5; border-radius:20px; padding:2px 10px; font-size:0.75rem; font-weight:700; margin:2px; }
                .btn-edit-m {
                    background: var(--themePrimary); color: white; border: none; padding: 12px; border-radius: 12px;
                    font-weight: 600; font-size: 0.9rem; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px;
                    transition: all 0.2s ease;
                    margin-top: 16px;
                }
                .btn-edit-m:active { transform: scale(0.98); }
                .profile-header-row {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px;
                    background: linear-gradient(to bottom, #f8fafc, #ffffff);
                    border-bottom: 1px solid #e2e8f0;
                }
                .profile-photo-view {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background-size: cover;
                    background-position: center;
                    border: 3px solid var(--themePrimary);
                    flex-shrink: 0;
                }
                .profile-info { flex: 1; }
                .profile-name { font-weight: 800; font-size: 1rem; color: var(--themeDark); margin-bottom: 4px; }
                .profile-dni { font-size: 0.7rem; color: var(--neutralSecondary); }
            </style>

            <div class="profile-mobile-wrap">
                <div class="profile-card-m">
                    <div class="profile-header-row">
                        <div class="profile-photo-view" style="background-image: url('${profilePicture}');"></div>
                        <div class="profile-info">
                            <div class="profile-name">${escapeHtml(p.name)}</div>
                            <div class="profile-dni">Cédula: ${p.docType || 'V'}-${p.dni || '—'}</div>
                        </div>
                    </div>
                    <div style="padding: 0 16px 16px 16px;">
                        <button class="btn-edit-m" id="btn-edit-profile">${I.edit} Editar Datos</button>
                    </div>
                </div>

                <div class="profile-card-m">
                    <div class="profile-hdr-m">${I.user} Datos Personales</div>
                    <div class="profile-grid-m">
                        <div class="profile-field-m"><label>${I.calendar} Fecha de Nacimiento</label><span>${birthDateFormatted} (${ageValue} años)</span></div>
                        <div class="profile-field-m"><label>${I.user} Género</label><span>${genderLabel}</span></div>
                        <div class="profile-field-m"><label>${I.flag} Nacionalidad</label><span>${p.nationality || '—'}</span></div>
                        <div class="profile-field-m"><label>Estado Civil</label><span>${p.civilStatus || '—'}</span></div>
                        <div class="profile-field-m"><label>Lugar de Nacimiento</label><span>${p.birthPlace || '—'}</span></div>
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
                    <div class="profile-hdr-m">${I.blood} Salud</div>
                    <div class="profile-grid-m">
                        <div class="profile-field-m"><label>Grupo Sanguíneo</label><span>${p.bloodType || '—'}</span></div>
                        <div class="profile-field-m"><label>Alergias</label>
                            <span>
                                ${p.allergies?.length
                                    ? p.allergies.map(a => `<span class="badge-allergy-m">${I.alert} ${escapeHtml(a)}</span>`).join(' ')
                                    : 'Sin alergias registradas'}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="profile-card-m">
                    <div class="profile-hdr-m">${I.alert} Contacto de Emergencia</div>
                    <div class="profile-grid-m">
                        <div class="profile-field-m"><label>Nombre</label><span>${p.emergencyContact?.name || '—'}</span></div>
                        <div class="profile-field-m"><label>Teléfono</label><span>${p.emergencyContact?.phone || '—'}</span></div>
                        <div class="profile-field-m"><label>Parentesco</label><span>${p.emergencyContact?.relation || '—'}</span></div>
                    </div>
                </div>
            </div>`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    // ── Formulario de edición COMPLETO (con todos los campos) ──
    function renderEditForm(p) {
        const currentPhoto = p.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=003b69&color=fff&bold=true&size=200`;
        
        // Obtener alergias como string para el textarea
        const allergiesString = (p.allergies || []).join(', ');
        
        return `
            <div class="profile-mobile-wrap">
                <div class="profile-card-m" style="padding: 1.25rem;">
                    <h3 style="margin-bottom:1.25rem; font-size:1rem; color:var(--themePrimary);">Editar Información Personal</h3>
                    
                    <!-- Selector de Foto de Perfil -->
                    <div class="profile-photo-container" style="display: flex; flex-direction: column; align-items: center; margin-bottom: 1.5rem; padding: 1rem; background: var(--neutralLighterAlt); border-radius: 20px; border: 2px dashed var(--neutralQuaternaryAlt);">
                        <div id="profile-preview-circle" style="width: 60px; height: 60px; border-radius: 50%; background-size: cover; background-position: center; background-image: url('${currentPhoto}'); border: 3px solid var(--themePrimary); margin-bottom: 12px;"></div>
                        <button type="button" id="btn-change-photo" style="background: var(--themePrimary); color: white; border: none; padding: 8px 20px; border-radius: 25px; font-size: 0.8rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-camera"></i> Cambiar Foto
                        </button>
                        <input type="file" id="profile-file-input" hidden accept="image/*">
                        <p style="font-size: 0.65rem; color: var(--neutralSecondary); margin-top: 8px;">Formato recomendado: JPG o PNG, máximo 2MB</p>
                    </div>

                    <!-- DATOS PERSONALES -->
                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.7rem; color: var(--themePrimary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Datos Personales</h4>
                        
                        <div class="form-group" style="margin-bottom:1rem;">
                            <label class="login-label">Nombre Completo *</label>
                            <input class="login-input" id="ef-name" type="text" value="${escapeHtml(p.name || '')}">
                        </div>

                        <div class="form-group" style="margin-bottom:1rem;">
                            <label class="login-label">Fecha de Nacimiento *</label>
                            <input class="login-input" id="ef-birthdate" type="date" value="${p.birthDate || ''}" max="${new Date().toISOString().split('T')[0]}">
                        </div>

                        <div class="form-group" style="margin-bottom:1rem;">
                            <label class="login-label">Género *</label>
                            <select class="login-input" id="ef-gender">
                                <option value="">Seleccionar...</option>
                                ${genders.map(g => `<option value="${g.value}" ${p.gender === g.value ? 'selected' : ''}>${g.label}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group" style="margin-bottom:1rem;">
                            <label class="login-label">Nacionalidad</label>
                            <select class="login-input" id="ef-nationality">
                                <option value="">Seleccionar...</option>
                                ${nationalities.map(n => `<option value="${n}" ${p.nationality === n ? 'selected' : ''}>${n}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group" style="margin-bottom:1rem;">
                            <label class="login-label">Estado Civil</label>
                            <select class="login-input" id="ef-civil-status">
                                <option value="">Seleccionar...</option>
                                ${civilStatuses.map(cs => `<option value="${cs.value}" ${p.civilStatus === cs.value ? 'selected' : ''}>${cs.label}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group" style="margin-bottom:1rem;">
                            <label class="login-label">Lugar de Nacimiento</label>
                            <input class="login-input" id="ef-birthplace" type="text" value="${escapeHtml(p.birthPlace || '')}" placeholder="Ciudad, Estado">
                        </div>
                    </div>

                    <!-- CONTACTO -->
                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.7rem; color: var(--themePrimary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Contacto</h4>
                        
                        <div class="form-group" style="margin-bottom:1rem;">
                            <label class="login-label">Teléfono *</label>
                            <input class="login-input" id="ef-phone" type="tel" value="${escapeHtml(p.phone || '')}" placeholder="0412XXXXXXX">
                        </div>

                        <div class="form-group" style="margin-bottom:1rem;">
                            <label class="login-label">Correo Electrónico *</label>
                            <input class="login-input" id="ef-email" type="email" value="${escapeHtml(p.email || '')}">
                        </div>

                        <div class="form-group" style="margin-bottom:1rem;">
                            <label class="login-label">Dirección</label>
                            <input class="login-input" id="ef-address" type="text" value="${escapeHtml(p.address || '')}" placeholder="Dirección completa">
                        </div>
                    </div>

                    <!-- SALUD -->
                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.7rem; color: var(--themePrimary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Información de Salud</h4>
                        
                        <div class="form-group" style="margin-bottom:1rem;">
                            <label class="login-label">Grupo Sanguíneo</label>
                            <select class="login-input" id="ef-bloodtype">
                                <option value="">No especificado</option>
                                ${bloodTypes.map(bt => `<option value="${bt}" ${p.bloodType === bt ? 'selected' : ''}>${bt}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group" style="margin-bottom:1rem;">
                            <label class="login-label">Alergias (separadas por comas)</label>
                            <input class="login-input" id="ef-allergies" type="text" value="${escapeHtml(allergiesString)}" placeholder="Ej: Penicilina, Polen, Mariscos">
                            <div style="font-size: 0.65rem; color: var(--neutralSecondary); margin-top: 4px;">Ingrese las alergias separadas por comas</div>
                        </div>
                    </div>

                    <!-- CONTACTO DE EMERGENCIA -->
                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.7rem; color: var(--themePrimary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Contacto de Emergencia</h4>
                        
                        <div class="form-group" style="margin-bottom:1rem;">
                            <label class="login-label">Nombre Completo</label>
                            <input class="login-input" id="ef-ec-name" type="text" value="${escapeHtml(p.emergencyContact?.name || '')}" placeholder="Nombre del contacto">
                        </div>

                        <div class="form-group" style="margin-bottom:1rem;">
                            <label class="login-label">Teléfono</label>
                            <input class="login-input" id="ef-ec-phone" type="tel" value="${escapeHtml(p.emergencyContact?.phone || '')}" placeholder="Teléfono de contacto">
                        </div>

                        <div class="form-group" style="margin-bottom:1rem;">
                            <label class="login-label">Parentesco</label>
                            <input class="login-input" id="ef-ec-relation" type="text" value="${escapeHtml(p.emergencyContact?.relation || '')}" placeholder="Ej: Padre, Madre, Hermano, Cónyuge">
                        </div>
                    </div>

                    <!-- BOTONES -->
                    <div style="display:flex; gap:0.75rem; margin-top:1.5rem;">
                        <button type="button" class="btn-outline" id="btn-cancel-edit" style="flex:1;">Cancelar</button>
                        <button type="button" class="btn-primary" id="btn-save-profile" style="flex:2;">Guardar Cambios</button>
                    </div>
                </div>
            </div>`;
    }

    // ── Event Listeners ──
    function setupListeners() {
        root.querySelector('#btn-edit-profile')?.addEventListener('click', () => {
            state.editing = true;
            render();
        });

        root.querySelector('#btn-cancel-edit')?.addEventListener('click', () => {
            state.editing = false;
            render();
        });

        // Manejo de foto de perfil
        const fileInput = root.querySelector('#profile-file-input');
        const preview = root.querySelector('#profile-preview-circle');
        
        if (fileInput && preview) {
            const changePhotoBtn = root.querySelector('#btn-change-photo');
            if (changePhotoBtn) {
                changePhotoBtn.addEventListener('click', () => fileInput.click());
            }
            
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
                        if (window.showToast) window.showToast('Solo se permiten imágenes JPG o PNG');
                        return;
                    }
                    if (file.size > 2 * 1024 * 1024) {
                        if (window.showToast) window.showToast('La imagen no debe superar los 2MB');
                        return;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = (rl) => {
                        const imgData = rl.target.result;
                        preview.style.backgroundImage = `url('${imgData}')`;
                        state.tempProfilePicture = imgData;
                    };
                    reader.readAsDataURL(file);
                }
            };
        }

        // Guardar cambios
        root.querySelector('#btn-save-profile')?.addEventListener('click', () => {
            const p = state.patient;
            
            // Procesar alergias (convertir string con comas a array)
            const allergiesStr = root.querySelector('#ef-allergies')?.value.trim() || '';
            const allergiesArray = allergiesStr ? allergiesStr.split(',').map(a => a.trim()).filter(a => a) : [];
            
            const updated = {
                ...p,
                name: root.querySelector('#ef-name')?.value.trim() || p.name,
                birthDate: root.querySelector('#ef-birthdate')?.value || p.birthDate,
                gender: root.querySelector('#ef-gender')?.value || p.gender,
                nationality: root.querySelector('#ef-nationality')?.value || p.nationality,
                civilStatus: root.querySelector('#ef-civil-status')?.value || p.civilStatus,
                birthPlace: root.querySelector('#ef-birthplace')?.value.trim() || p.birthPlace,
                phone: root.querySelector('#ef-phone')?.value.trim() || p.phone,
                email: root.querySelector('#ef-email')?.value.trim() || p.email,
                address: root.querySelector('#ef-address')?.value.trim() || p.address,
                bloodType: root.querySelector('#ef-bloodtype')?.value || p.bloodType,
                allergies: allergiesArray,
                emergencyContact: {
                    name: root.querySelector('#ef-ec-name')?.value.trim() || p.emergencyContact?.name || '',
                    phone: root.querySelector('#ef-ec-phone')?.value.trim() || p.emergencyContact?.phone || '',
                    relation: root.querySelector('#ef-ec-relation')?.value.trim() || p.emergencyContact?.relation || ''
                },
                updatedAt: Date.now()
            };
            
            // Agregar foto de perfil si se cambió
            if (state.tempProfilePicture) {
                updated.profilePicture = state.tempProfilePicture;
                delete state.tempProfilePicture;
            }

            store.update('patients', p.id, updated);
            state.editing = false;
            
            if (window.showToast) window.showToast('Perfil actualizado correctamente');
            render();

            // Emitir eventos para actualizar la UI global
            if (bus && bus.emit) {
                bus.emit('profile-updated', updated);
                if (updated.profilePicture) {
                    bus.emit('profile-picture-updated', { patientId: p.id, imgData: updated.profilePicture });
                }
            }
            
            // Actualizar el objeto global del paciente
            if (window._patientApp && window._patientApp.user) {
                window._patientApp.user.name = updated.name;
                if (updated.profilePicture) {
                    window._patientApp.patientRecord.profilePicture = updated.profilePicture;
                }
                window._patientApp.patientRecord = updated;
                window._patientApp.renderHeader();
            }
        });
    }

    render();
}