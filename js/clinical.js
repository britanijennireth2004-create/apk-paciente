/**
 * clinical.js — Historia Clínica Electrónica (APK / Patient Mobile)
 * Vista para pacientes: muestra su perfil como tarjeta y al hacer clic
 * muestra el historial clínico en un modal emergente (bottom sheet)
 * CORREGIDO: Manejo correcto de fechas de nacimiento
 */

// ─── Tipos de registro ────────────────────────────────────────────────────────

const ENTRY_TYPES = {
    consultation: { label: 'Consulta', color: '#003b69', bg: '#eff5f9', border: '#93b7d2' },
    treatment: { label: 'Tratamiento', color: '#008272', bg: '#e6f4f3', border: '#00B294' },
    medication: { label: 'Medicación', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
    observation: { label: 'Observación', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
    followup: { label: 'Seguimiento', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
    emergency: { label: 'Urgencia', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
    lab: { label: 'Laboratorio', color: '#0891b2', bg: '#ecfeff', border: '#67e8f9' },
    prescription: { label: 'Receta', color: '#92400e', bg: '#fff7ed', border: '#fdba74' }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calcula la edad correctamente sin problemas de zona horaria (CORREGIDO)
 */
function calcAge(bd) {
    if (!bd) return '—';
    // Usar UTC para evitar problemas de zona horaria
    const birthParts = bd.split('-');
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
    let a = todayUTC.getUTCFullYear() - birthUTC.getUTCFullYear();
    const m = todayUTC.getUTCMonth() - birthUTC.getUTCMonth();
    if (m < 0 || (m === 0 && todayUTC.getUTCDate() < birthUTC.getUTCDate())) {
        a--;
    }
    return a;
}

/**
 * Formatea una fecha de nacimiento para mostrar (CORREGIDO)
 */
function formatBirthDateDisplay(bd) {
    if (!bd) return '—';
    const months = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const parts = bd.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    return `${day} de ${months[month]} de ${year}`;
}

function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────

export function mountClinical(root, { store, user, role }) {
    if (!root) return;

    // Si no es paciente o no hay usuario, no hacer nada
    if (role !== 'patient' || !user) {
        root.innerHTML = '<div class="empty-state">Acceso no autorizado</div>';
        return;
    }

    const patientId = user.patientId || user.id;
    const patient = store.find('patients', patientId);
    
    if (!patient) {
        root.innerHTML = '<div class="empty-state">No se pudo cargar su información médica</div>';
        return;
    }

    // Obtener registros clínicos del paciente
    function getPatientRecords() {
        return (store.get('clinicalRecords') || [])
            .filter(r => r.patientId === patientId)
            .sort((a, b) => (b.timestamp || new Date(b.date).getTime()) - (a.timestamp || new Date(a.date).getTime()));
    }

    // Renderizar timeline de registros
    function renderTimeline(records) {
        if (!records.length) {
            return `
                <div style="text-align:center;padding:40px 16px;color:var(--neutralSecondary);">
                    <i class="fa-solid fa-file-medical" style="font-size:2.5rem;opacity:.2;display:block;margin-bottom:12px;"></i>
                    <div style="font-weight:600;margin-bottom:4px;">Sin registros clínicos</div>
                    <div style="font-size:0.78rem;">Sus registros aparecerán aquí cuando sea atendido por un médico.</div>
                </div>`;
        }

        return records.map(r => {
            const cfg = ENTRY_TYPES[r.type] || ENTRY_TYPES.observation;
            const dr = store.find('doctors', r.doctorId);
            const v = r.vitalSigns || {};
            const hasVitals = v.bloodPressure || v.heartRate || v.temperature || v.spo2 || v.weight || v.height;

            const presHtml = Array.isArray(r.prescriptions) && r.prescriptions.length
                ? r.prescriptions.map((px, i) => `<div style="margin-bottom:3px;">${i + 1}. <strong>${escapeHtml(px.medication)}</strong> — ${escapeHtml(px.dosage)} — ${escapeHtml(px.frequency)} — ${escapeHtml(px.duration)}</div>`).join('')
                : (r.prescriptions ? `<div>${escapeHtml(r.prescriptions)}</div>` : `<div style="font-style:italic;color:var(--neutralSecondary);">Sin prescripciones</div>`);

            return `
            <div style="background:#fff;border-radius:12px;border:1px solid var(--neutralLight);
                        border-left:4px solid ${cfg.color};margin-bottom:12px;overflow:hidden;">
                <div style="padding:10px 14px;background:${cfg.bg};display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <span style="font-size:0.72rem;font-weight:800;color:${cfg.color};text-transform:uppercase;letter-spacing:.05em;">${cfg.label}</span>
                        <div style="font-size:0.68rem;color:var(--neutralSecondary);margin-top:2px;">
                            ${fmtDateTime(r.date)} · ${r.creatorName ? (r.creatorRole === 'doctor' ? 'Dr. ' : r.creatorRole === 'nurse' ? 'Lic. ' : '') + escapeHtml(r.creatorName) : 'Dr. ' + escapeHtml(dr?.name || '—')}
                        </div>
                    </div>
                    <span style="font-size:0.65rem;font-weight:700;padding:2px 8px;border-radius:8px;
                                 background:${r.status === 'finalized' ? 'rgba(16,124,16,.1)' : 'rgba(255,185,0,.1)'};
                                 color:${r.status === 'finalized' ? 'var(--green)' : 'var(--yellow)'};">
                        ${r.status === 'finalized' ? 'Finalizado' : 'Borrador'}
                    </span>
                </div>

                <div style="padding:12px 14px;display:flex;flex-direction:column;gap:10px;">

                    ${hasVitals ? `
                    <div style="background:var(--neutralLighterAlt,#f8f8f8);border-radius:8px;padding:10px;border-left:3px solid #3b82f6;">
                        <div style="font-size:0.65rem;font-weight:800;color:#2563eb;text-transform:uppercase;margin-bottom:7px;">Signos Vitales</div>
                        <div style="display:flex;gap:12px;flex-wrap:wrap;">
                            ${v.bloodPressure ? `<div><div style="font-size:0.6rem;font-weight:700;color:var(--neutralSecondary);">PA</div><div style="font-size:0.82rem;font-weight:600;">${escapeHtml(v.bloodPressure)}</div></div>` : ''}
                            ${v.heartRate ? `<div><div style="font-size:0.6rem;font-weight:700;color:var(--neutralSecondary);">FC</div><div style="font-size:0.82rem;font-weight:600;">${escapeHtml(v.heartRate)} lpm</div></div>` : ''}
                            ${v.temperature ? `<div><div style="font-size:0.6rem;font-weight:700;color:var(--neutralSecondary);">Temp</div><div style="font-size:0.82rem;font-weight:600;">${escapeHtml(v.temperature)} °C</div></div>` : ''}
                            ${v.spo2 ? `<div><div style="font-size:0.6rem;font-weight:700;color:var(--neutralSecondary);">SpO₂</div><div style="font-size:0.82rem;font-weight:600;">${escapeHtml(v.spo2)} %</div></div>` : ''}
                            ${v.weight ? `<div><div style="font-size:0.6rem;font-weight:700;color:var(--neutralSecondary);">Peso</div><div style="font-size:0.82rem;font-weight:600;">${escapeHtml(v.weight)} kg</div></div>` : ''}
                            ${v.height ? `<div><div style="font-size:0.6rem;font-weight:700;color:var(--neutralSecondary);">Talla</div><div style="font-size:0.82rem;font-weight:600;">${escapeHtml(v.height)} cm</div></div>` : ''}
                        </div>
                    </div>` : ''}

                    <div style="background:var(--neutralLighterAlt,#f8f8f8);border-radius:8px;padding:10px;border-left:3px solid #ea580c;">
                        ${r.reason ? `
                        <div style="margin-bottom:8px;">
                            <div style="font-size:0.63rem;font-weight:800;color:#c2410c;text-transform:uppercase;margin-bottom:3px;">Motivo de Consulta</div>
                            <div style="font-size:0.82rem;line-height:1.4;">${escapeHtml(r.reason)}</div>
                        </div>` : ''}
                        <div>
                            <div style="font-size:0.63rem;font-weight:800;color:#c2410c;text-transform:uppercase;margin-bottom:3px;">Diagnóstico</div>
                            <div style="font-size:0.85rem;font-weight:600;line-height:1.4;">${escapeHtml(r.diagnosis || 'Pendiente')}</div>
                        </div>
                    </div>

                    <div style="background:var(--neutralLighterAlt,#f8f8f8);border-radius:8px;padding:10px;border-left:3px solid #16a34a;">
                        ${r.treatment ? `
                        <div style="margin-bottom:8px;">
                            <div style="font-size:0.63rem;font-weight:800;color:#15803d;text-transform:uppercase;margin-bottom:3px;">Plan de Tratamiento</div>
                            <div style="font-size:0.82rem;line-height:1.4;">${escapeHtml(r.treatment)}</div>
                        </div>` : ''}
                        <div style="margin-bottom:${r.followUp || r.notes ? '8px' : '0'};">
                            <div style="font-size:0.63rem;font-weight:800;color:#15803d;text-transform:uppercase;margin-bottom:3px;">Recetas Médicas</div>
                            <div style="font-size:0.82rem;line-height:1.5;">${presHtml}</div>
                        </div>
                        ${r.followUp ? `
                        <div style="padding-top:8px;border-top:1px dashed var(--neutralLight);">
                            <span style="font-size:0.63rem;font-weight:700;color:var(--neutralSecondary);text-transform:uppercase;">Próximo Control:</span>
                            <span style="font-size:0.8rem;font-weight:600;margin-left:6px;">${fmtDate(r.followUp)}</span>
                        </div>` : ''}
                        ${r.notes ? `
                        <div style="padding-top:8px;border-top:1px dashed var(--neutralLight);">
                            <div style="font-size:0.63rem;font-weight:700;color:var(--neutralSecondary);text-transform:uppercase;margin-bottom:3px;">Notas</div>
                            <div style="font-size:0.8rem;">${escapeHtml(r.notes)}</div>
                        </div>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
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

    // Abrir modal con historial clínico
    function openClinicalHistoryModal() {
        const records = getPatientRecords();
        
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;';
        
        const age = calcAge(patient.birthDate);
        const initials = (patient.name || '?').charAt(0).toUpperCase();
        const birthDateFormatted = formatBirthDateDisplay(patient.birthDate);
        
        modal.innerHTML = `
            <div style="background:#f8f9fa;border-radius:24px 24px 0 0;max-height:85vh;width:100%;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.4,0,0.2,1);">
                <div style="background:var(--themePrimary);padding:20px 20px 16px;border-radius:24px 24px 0 0;">
                    <div style="width:40px;height:4px;background:rgba(255,255,255,0.3);border-radius:4px;margin:0 auto 12px;"></div>
                    <div style="display:flex;align-items:center;gap:14px;">
                        <div style="width:56px;height:56px;border-radius:20px;background:rgba(255,255,255,0.2);
                                    display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:800;color:#fff;">
                            ${escapeHtml(initials)}
                        </div>
                        <div style="flex:1;">
                            <div style="color:#fff;font-size:1.1rem;font-weight:800;">${escapeHtml(patient.name)}</div>
                            <div style="color:rgba(255,255,255,0.8);font-size:0.75rem;margin-top:2px;">
                                ${patient.docType || 'V'}-${patient.dni || '—'} · ${birthDateFormatted} (${age} años)
                                ${patient.bloodType ? ` · Sangre: ${patient.bloodType}` : ''}
                            </div>
                        </div>
                        <button id="close-modal-btn" style="background:rgba(255,255,255,0.2);border:none;border-radius:50%;width:36px;height:36px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    
                    ${(patient.allergies || []).length ? `
                    <div style="background:rgba(255,100,50,0.2);border-radius:10px;padding:8px 12px;margin-top:12px;font-size:0.72rem;color:#fff;font-weight:600;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Alergias: ${(patient.allergies || []).map(a => escapeHtml(a)).join(', ')}
                    </div>` : ''}
                </div>
                
                <div style="flex:1;overflow-y:auto;padding:16px 20px;">
                    ${renderTimeline(records)}
                </div>
                
                <div style="padding:12px 20px 24px;background:#fff;border-top:1px solid var(--neutralLight);">
                    <button id="close-footer-btn" style="width:100%;background:var(--neutralLight);border:none;border-radius:14px;padding:14px;font-weight:700;font-size:0.85rem;color:var(--neutralPrimary);cursor:pointer;">
                        <i class="fa-solid fa-chevron-down"></i> Cerrar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeModal = () => {
            const sheet = modal.querySelector('div');
            if (sheet) sheet.style.animation = 'slideDown 0.25s ease forwards';
            setTimeout(() => modal.remove(), 250);
        };
        
        modal.querySelector('#close-modal-btn')?.addEventListener('click', closeModal);
        modal.querySelector('#close-footer-btn')?.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    }

    // Renderizar la tarjeta del paciente (CORREGIDO)
    function renderPatientCard() {
        const age = calcAge(patient.birthDate);
        const initials = (patient.name || '?').charAt(0).toUpperCase();
        const birthDateFormatted = formatBirthDateDisplay(patient.birthDate);
        
        root.innerHTML = `
            <style>
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes slideDown {
                    from { transform: translateY(0); opacity: 1; }
                    to { transform: translateY(100%); opacity: 0; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .clinical-card {
                    background: #fff;
                    border-radius: 20px;
                    padding: 20px;
                    border: 1px solid #e2e8f0;
                    transition: all 0.2s ease;
                    cursor: pointer;
                }
                .clinical-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(0,0,0,0.08);
                    border-color: var(--themePrimary);
                }
                .clinical-card:active {
                    transform: scale(0.98);
                }
                .clinical-allergy-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    background: #fef2f2;
                    color: #dc2626;
                    border: 1px solid #fecaca;
                    border-radius: 20px;
                    padding: 4px 10px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    margin-top: 12px;
                }
            </style>
            
            <div class="clinical-card" id="patient-clinical-card">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="width: 56px; height: 56px; border-radius: 20px; background: var(--themePrimary);
                                display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: #fff; flex-shrink: 0;">
                        ${escapeHtml(initials)}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 1rem; color: #1e293b;">${escapeHtml(patient.name)}</div>
                        <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">
                            ${patient.docType || 'V'}-${patient.dni || '—'} · ${birthDateFormatted} (${age} años)
                            ${patient.bloodType ? ` · Grupo ${patient.bloodType}` : ''}
                        </div>
                        ${patient.phone ? `<div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;"><i class="fa-solid fa-phone"></i> ${escapeHtml(patient.phone)}</div>` : ''}
                    </div>
                    <div style="text-align: right;">
                        <i class="fa-solid fa-chevron-right" style="color: var(--themePrimary); font-size: 1.2rem;"></i>
                    </div>
                </div>
                
                ${(patient.allergies || []).length > 0 ? `
                <div class="clinical-allergy-badge">
                    <i class="fa-solid fa-triangle-exclamation"></i> Alergias: ${(patient.allergies || []).map(a => escapeHtml(a)).join(', ')}
                </div>
                ` : ''}
            </div>
        `;
        
        const card = document.getElementById('patient-clinical-card');
        if (card) {
            card.addEventListener('click', openClinicalHistoryModal);
        }
    }

    renderPatientCard();
    
    return { refresh: renderPatientCard };
}