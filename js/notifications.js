/**
 * notifications.js — Panel de Notificaciones (APK / Patient Mobile)
 * Adapta el módulo de comunicaciones de la versión web a móvil:
 *   - Carpetas: Bandeja, Enviados, Recordatorios, Alertas, Borradores, Papelera
 *   - Vistas: lista → detalle → redactar/responder
 *   - Guardar borrador, enviar, marcar leído, eliminar, destacar
 *   - Auto-recordatorios de citas próximas (< 48h)
 *   - FILTRADO: Pacientes solo ven notificaciones dirigidas específicamente a ellos
 */

// ─── helpers de fecha ─────────────────────────────────────────────────────────

function fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString())
        return d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    if (d.getFullYear() === now.getFullYear())
        return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
    return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: '2-digit' });
}

function fmtFull(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('es-VE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }) + ' ' + new Date(ts).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

function avatarColor(name) {
    const colors = ['#0f8d3a', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899', '#004b50'];
    let h = 0;
    for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
}

function chBadge(ch) {
    const m = {
        email: { l: 'Email', c: '#3b82f6', b: '#dbeafe' },
        sms: { l: 'SMS', c: '#8b5cf6', b: '#ede9fe' },
        push: { l: 'Push', c: '#f59e0b', b: '#fef3c7' },
        internal: { l: 'Interna', c: '#10b981', b: '#d1fae5' },
        system: { l: 'Sistema', c: '#6b7280', b: '#f3f4f6' }
    };
    const v = m[ch] || m.system;
    return `<span style="font-size:0.65rem;font-weight:700;padding:2px 8px;border-radius:10px;color:${v.c};background:${v.b};">${v.l}</span>`;
}

function prBadge(p) {
    const m = {
        critical: { l: 'Urgente', c: '#dc2626', b: '#fee2e2' },
        high: { l: 'Alta', c: '#ea580c', b: '#ffedd5' },
        normal: { l: 'Normal', c: '#3b82f6', b: '#dbeafe' },
        low: { l: 'Baja', c: '#6b7280', b: '#f3f4f6' }
    };
    const v = m[p] || m.normal;
    return `<span style="font-size:0.65rem;font-weight:700;padding:2px 8px;border-radius:10px;color:${v.c};background:${v.b};">${v.l}</span>`;
}

const FOLDERS = [
    { id: 'inbox', icon: 'fa-inbox', label: 'Bandeja' },
    { id: 'alerts', icon: 'fa-triangle-exclamation', label: 'Alertas' },
    { id: 'reminders', icon: 'fa-clock', label: 'Recordatorios' },
    { id: 'sent', icon: 'fa-paper-plane', label: 'Enviados' },
    { id: 'drafts', icon: 'fa-file-lines', label: 'Borradores' },
    { id: 'trash', icon: 'fa-trash', label: 'Papelera' }
];

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────

export function mountNotifications(root, { store, user }) {
    if (!root) return;

    const role = user?.role || 'patient';
    const patientId = user?.patientId || user?.id;

    const state = {
        folder: 'inbox',
        search: '',
        view: 'list',   // 'list' | 'detail' | 'compose'
        viewingId: null,
        replyTo: null,
        editingDraftId: null,
        searchTimeout: null
    };

    let allData = { messages: [], notifications: [], reminders: [], drafts: [] };
    let currentRoot = root;
    let isRendering = false;

    // ── Cargar datos ──────────────────────────────────────────────────────────
    function loadData() {
        allData.messages = store.get('messages') || [];
        allData.notifications = store.get('notifications') || [];
        allData.reminders = store.get('reminders') || [];
        allData.drafts = store.get('drafts') || [];
        generateAutoReminders();
    }

    function generateAutoReminders() {
        const apts = store.get('appointments') || [];
        const now = Date.now();
        const in48 = now + 48 * 3600000;
        const existing = new Set(allData.reminders.map(r => r.appointmentId));
        
        apts.forEach(a => {
            // Solo generar recordatorios para citas del paciente actual
            if (a.patientId !== patientId) return;
            if (a.status !== 'scheduled' || existing.has(a.id)) return;
            const t = new Date(a.dateTime).getTime();
            if (t > now && t <= in48) {
                const d = store.find('doctors', a.doctorId);
                if (!d) return;
                store.add('reminders', {
                    appointmentId: a.id,
                    recipientId: patientId,
                    recipientName: user?.name || 'Paciente',
                    title: 'Recordatorio de cita próxima',
                    content: `Cita con ${d.name} el ${fmtFull(a.dateTime)}.`,
                    channel: 'internal', priority: 'normal',
                    status: 'pending', type: 'appointment_reminder',
                    createdBy: 'system', createdAt: now
                });
            }
        });
        allData.reminders = store.get('reminders') || [];
    }

    function getActorName(id) {
        if (!id || id === 'system') return 'Sistema Hospitalario';
        if (id.startsWith('role_')) {
            const roleMap = {
                role_admin: 'Alta Administración', role_doctor: 'Gremio Médico',
                role_nurse: 'Enfermería', role_receptionist: 'Recepción', role_patient: 'Pacientes'
            };
            return roleMap[id] || id;
        }
        const u = store.find('users', id); if (u) return u.name;
        const d = store.find('doctors', id); if (d) return d.name;
        const p = store.find('patients', id); if (p) return p.name;
        return id;
    }

    function getAllItems() {
        const all = [
            ...allData.messages.map(m => ({ ...m, _src: 'messages' })),
            ...allData.notifications.map(n => ({ ...n, _src: 'notifications' })),
            ...allData.reminders.map(r => ({ ...r, _src: 'reminders' })),
            ...allData.drafts.map(d => ({ ...d, _src: 'drafts' }))
        ];
        
        return all.filter(i => {
            // ============================================================
            // FILTRO PARA PACIENTES: Solo ven notificaciones dirigidas a ellos
            // ============================================================
            if (role === 'patient') {
                // Mensajes creados por el mismo usuario (enviados por él)
                const isFromMe = i.createdBy === user?.id || i.createdBy === patientId;
                // Mensajes dirigidos específicamente al paciente
                const isForPatient = i.recipientId === patientId || 
                                     i.recipientId === user?.id ||
                                     i.recipientRole === 'patient';
                
                // Solo mostrar si cumple alguna de las condiciones
                return isFromMe || isForPatient;
            }
            
            // ============================================================
            // FILTRO PARA ADMINISTRADORES: Ven todo
            // ============================================================
            if (role === 'admin') return true;
            
            // ============================================================
            // FILTRO PARA MÉDICOS Y ENFERMERAS
            // ============================================================
            if (i.createdBy === user?.id) return true;
            if (i.recipientId === user?.id ||
                (user?.doctorId && i.recipientId === user.doctorId) ||
                (user?.patientId && i.recipientId === user.patientId) ||
                (user?.nurseId && i.recipientId === user.nurseId) ||
                (user?.receptionistId && i.recipientId === user.receptionistId)) return true;
            if (i.recipientRole === role) return true;
            
            return false;
        });
    }

    function getFolderItems() {
        let items = getAllItems();
        if (state.folder === 'inbox') items = items.filter(i => i.createdBy !== user?.id && !i.deleted);
        else if (state.folder === 'sent') items = items.filter(i => i.createdBy === user?.id && !i.deleted && i._src !== 'drafts');
        else if (state.folder === 'reminders') items = items.filter(i => i._src === 'reminders' && !i.deleted);
        else if (state.folder === 'alerts') items = items.filter(i => (i.priority === 'critical' || i.priority === 'high' || i._src === 'notifications') && !i.deleted);
        else if (state.folder === 'trash') items = items.filter(i => i.deleted);
        else if (state.folder === 'drafts') items = items.filter(i => i._src === 'drafts' && !i.deleted);
        
        if (state.search) {
            const s = state.search.toLowerCase();
            items = items.filter(i =>
                (i.title || '').toLowerCase().includes(s) ||
                (i.content || '').toLowerCase().includes(s) ||
                getActorName(i.createdBy).toLowerCase().includes(s)
            );
        }
        return items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    function findItem(id) {
        return [...allData.messages, ...allData.notifications, ...allData.reminders, ...allData.drafts].find(i => i.id === id);
    }
    
    function findSrc(id) {
        for (const src of ['messages', 'notifications', 'reminders', 'drafts'])
            if ((allData[src] || []).find(i => i.id === id)) return src;
        return null;
    }

    function unreadCount() {
        return getAllItems().filter(i =>
            !i.deleted && i.createdBy !== user?.id &&
            (i.status === 'sent' || i.status === 'pending' || i.status === 'scheduled' || i.status === 'delivered')
        ).length;
    }

    // ── ACTUALIZAR LISTA SIN RECONSTRUIR TODO ────────────────────────────────────────────────
    function updateListOnly() {
        if (state.view !== 'list') return;
        
        const items = getFolderItems();
        const listContainer = currentRoot.querySelector('.notif-list-container');
        
        if (!listContainer) {
            render();
            return;
        }
        
        if (items.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align:center;padding:48px 16px;color:var(--neutralSecondary);">
                    <i class="fa-solid fa-inbox" style="font-size:2.5rem;opacity:.25;display:block;margin-bottom:12px;"></i>
                    <div style="font-weight:600;margin-bottom:4px;">No hay mensajes</div>
                    <div style="font-size:0.78rem;">Los mensajes aparecerán aquí.</div>
                </div>`;
            return;
        }
        
        listContainer.innerHTML = buildListHTML(items);
        bindListEvents(listContainer);
    }
    
    function buildListHTML(items) {
        if (!items.length) {
            return `
                <div style="text-align:center;padding:48px 16px;color:var(--neutralSecondary);">
                    <i class="fa-solid fa-inbox" style="font-size:2.5rem;opacity:.25;display:block;margin-bottom:12px;"></i>
                    <div style="font-weight:600;margin-bottom:4px;">No hay mensajes</div>
                    <div style="font-size:0.78rem;">Los mensajes aparecerán aquí.</div>
                </div>`;
        }
        
        return items.map(item => {
            const isDraft = item._src === 'drafts';
            const isUnread = !isDraft &&
                item.createdBy !== user?.id &&
                (item.status === 'sent' || item.status === 'pending' || item.status === 'scheduled' || item.status === 'delivered');
            const sender = state.folder === 'sent' ? `Para: ${item.recipientName || '—'}` : isDraft ? 'Borrador' : getActorName(item.createdBy);
            const ac = avatarColor(sender);
            const initial = (sender || 'S').charAt(0).toUpperCase();
            
            return `
                <div class="notif-msg-row ${isUnread ? 'unread' : ''}" data-id="${item.id}"
                     style="display:flex; align-items:center; gap:12px; padding:12px 14px;
                            background:${isUnread ? 'rgba(0,120,180,0.03)' : '#fff'}; border-bottom:1px solid var(--neutralLighter);
                            cursor:pointer; position:relative; overflow:hidden;">
                    ${isUnread ? '<div style="position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--themePrimary);"></div>' : ''}
                    <div class="notif-actor-avatar" style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.1rem;flex-shrink:0;background:${ac};">
                        ${initial}
                    </div>
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;">
                        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:2px;">
                            <span style="font-size:0.9rem; font-weight:${isUnread ? '800' : '600'}; color:${isDraft ? '#b45309' : 'var(--neutralPrimary)'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(sender)}</span>
                            <span style="font-size:0.75rem; color:${isUnread ? 'var(--themePrimary)' : 'var(--neutralSecondary)'}; font-weight:${isUnread ? '700' : 'normal'}; flex-shrink:0;">${fmtDate(item.createdAt)}</span>
                        </div>
                        <div style="display:flex;align-items:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;">
                            <span style="font-size:0.85rem; font-weight:${isUnread ? '700' : '600'}; color:var(--neutralDark); flex-shrink:0;">${escapeHtml(item.title || '(sin asunto)')}</span>
                            <span style="font-size:0.85rem; color:var(--neutralSecondary); margin-left:4px; overflow:hidden; text-overflow:ellipsis;">— ${escapeHtml((item.content || '').replace(/\n/g, ' '))}</span>
                        </div>
                    </div>
                </div>`;
        }).join('');
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    function bindListEvents(listContainer) {
        listContainer.querySelectorAll('.notif-msg-row').forEach(row => {
            if (row._listener) {
                row.removeEventListener('click', row._listener);
            }
            const handler = () => {
                const id = row.dataset.id;
                markRead(id);
                state.viewingId = id;
                state.view = 'detail';
                render();
            };
            row.addEventListener('click', handler);
            row._listener = handler;
        });
    }

    // ── RENDER PRINCIPAL ──────────────────────────────────────────────────────
    function render() {
        if (isRendering) return;
        isRendering = true;
        
        loadData();
        const items = getFolderItems();
        const unread = unreadCount();

        // Actualizar badge del botón de notificaciones en el header
        const badge = document.getElementById('notif-badge');
        if (badge) {
            badge.textContent = unread > 0 ? (unread > 99 ? '99+' : unread) : '';
            badge.style.display = unread > 0 ? '' : 'none';
        }

        const currentSearchValue = state.search;
        
        currentRoot.innerHTML = '';
        
        // Cabecera de la vista
        const header = document.createElement('div');
        header.style.cssText = 'padding:0 0 12px;';
        header.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <div style="font-size:1rem;font-weight:700;color:var(--neutralDark);">
                    ${FOLDERS.find(f => f.id === state.folder)?.label || 'Bandeja'}
                    ${items.filter(i => i.status !== 'read' && i.createdBy !== user?.id).length
                ? `<span style="background:var(--themePrimary);color:#fff;font-size:0.65rem;padding:2px 7px;border-radius:10px;margin-left:6px;vertical-align:middle;">
                            ${items.filter(i => i.status !== 'read' && i.createdBy !== user?.id).length} nuevo${items.filter(i => i.status !== 'read' && i.createdBy !== user?.id).length === 1 ? '' : 's'}
                           </span>` : ''}
                </div>
                <button id="notif-compose-btn"
                    style="display:flex;align-items:center;gap:6px;background:var(--themePrimary);color:#fff;border:none;
                           border-radius:20px;padding:8px 16px;font-size:0.8rem;font-weight:600;cursor:pointer;">
                    <i class="fa-solid fa-pen-to-square"></i> Redactar
                </button>
            </div>
            <!-- Tabs de carpetas (scroll horizontal) -->
            <div id="notif-folders" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:10px;scrollbar-width:none;">
                ${FOLDERS.map(f => `
                <button class="notif-folder-tab ${f.id === state.folder ? 'active' : ''}" data-folder="${f.id}" title="${f.label}"
                    style="display:flex;align-items:center;justify-content:center;flex-shrink:0;
                           border:1px solid ${f.id === state.folder ? 'var(--themePrimary)' : 'var(--neutralLight)'};
                           background:${f.id === state.folder ? 'var(--themePrimary)' : '#fff'};
                           color:${f.id === state.folder ? '#fff' : 'var(--neutralSecondary)'};
                           border-radius:50%;width:40px;height:40px;font-size:1.1rem;cursor:pointer;">
                    <i class="fa-solid ${f.icon}"></i>
                </button>`).join('')}
            </div>
            <!-- Buscador -->
            <div class="search-input-wrap" style="margin-top:10px;">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input id="notif-search-input" type="text" placeholder="Buscar mensajes..." value="${escapeHtml(currentSearchValue)}">
            </div>
        `;
        currentRoot.appendChild(header);

        // Cuerpo según vista
        if (state.view === 'compose') {
            currentRoot.appendChild(buildCompose());
        } else if (state.view === 'detail' && state.viewingId) {
            currentRoot.appendChild(buildDetail());
        } else {
            const listContainer = document.createElement('div');
            listContainer.className = 'notif-list-container';
            listContainer.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
            listContainer.innerHTML = buildListHTML(items);
            currentRoot.appendChild(listContainer);
            bindListEvents(listContainer);
        }

        bindEvents();
        
        const searchInputEl = currentRoot.querySelector('#notif-search-input');
        if (searchInputEl) {
            searchInputEl.value = state.search;
            setupSearchListener(searchInputEl);
        }
        
        isRendering = false;
    }
    
    function setupSearchListener(inputEl) {
        if (inputEl._listener) {
            inputEl.removeEventListener('input', inputEl._listener);
        }
        
        const handler = (e) => {
            const newValue = e.target.value;
            state.search = newValue;
            
            if (state.searchTimeout) clearTimeout(state.searchTimeout);
            state.searchTimeout = setTimeout(() => {
                updateListOnly();
            }, 300);
        };
        
        inputEl.addEventListener('input', handler);
        inputEl._listener = handler;
    }

    // ── DETALLE ───────────────────────────────────────────────────────────────
    function buildDetail() {
        const item = findItem(state.viewingId);
        const wrap = document.createElement('div');
        if (!item) {
            wrap.innerHTML = '<p style="color:var(--neutralSecondary);text-align:center;padding:32px;">Mensaje no encontrado.</p>';
            return wrap;
        }

        markRead(item.id);
        const senderName = getActorName(item.createdBy);
        const ac = avatarColor(senderName);
        const isDraft = item._src === 'drafts';

        wrap.className = 'notif-detail-view';
        wrap.innerHTML = `
            <!-- Toolbar detallado -->
            <div style="display:flex;align-items:center;gap:12px;padding:5px 0 15px;margin-bottom:15px;border-bottom:1px solid var(--neutralLighter);">
                <button id="detail-back" style="background:var(--neutralLighterAlt);border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;color:var(--themePrimary);display:flex;align-items:center;justify-content:center;">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <div style="flex:1;"></div>
                <div style="display:flex; gap:12px;">
                    <button data-action="delete-detail" data-id="${item.id}"
                        style="background:transparent;border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;color:var(--neutralTertiaryAlt);font-size:1.1rem;display:flex;align-items:center;justify-content:center;transition:color 0.2s;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                    ${!isDraft ? `
                    <button data-action="star" data-id="${item.id}"
                        style="background:transparent;border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;color:${item.starred ? '#f59e0b' : 'var(--neutralTertiaryAlt)'};font-size:1.1rem;display:flex;align-items:center;justify-content:center;">
                        <i class="fa-${item.starred ? 'solid' : 'regular'} fa-star"></i>
                    </button>` : ''}
                </div>
            </div>

            <!-- Cabecera estilo Web -->
            <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;padding:0 8px;">
                <div class="notif-actor-avatar" style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.25rem;color:white;flex-shrink:0;transform:rotate(-2deg);box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);background:${ac};">
                    ${senderName.charAt(0).toUpperCase()}
                </div>
                <div style="flex:1;min-width:0;">
                     <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
                         <h3 style="margin:0;font-size:1.15rem;color:var(--neutralDark);font-weight:600;">${escapeHtml(item.title || '(sin asunto)')}</h3>
                         ${chBadge(item.channel)} ${prBadge(item.priority)}
                     </div>
                     <div style="font-size:0.8rem;color:var(--neutralSecondary);display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                        <strong style="color:var(--neutralPrimary);">${escapeHtml(senderName)}</strong>
                        <span>→</span>
                        <span>${escapeHtml(item.recipientName || '—')}</span>
                     </div>
                     <div style="font-size:0.75rem;color:var(--neutralSecondary);margin-top:6px;">${fmtFull(item.createdAt)}</div>
                </div>
            </div>
            
            <!-- Cuerpo estilo Web -->
            <div style="font-size:0.95rem;color:var(--neutralDark);line-height:1.75;white-space:pre-wrap;padding:0 8px 20px;">
                ${escapeHtml(item.content || 'Sin contenido')}
            </div>

            ${item.appointmentId ? `
            <div style="margin:0 8px 20px;padding:12px 16px;background:var(--themeLighterAlt,#eff5f9);border-left:3px solid var(--themePrimary);border-radius:0 8px 8px 0;font-size:0.85rem;color:var(--themeDark);">
                <strong>Cita vinculada:</strong> ${item.appointmentId}
            </div>` : ''}

            <!-- Acciones Estilo Web -->
            ${isDraft ? `
            <div style="margin:20px 8px 0;padding-top:20px;border-top:1px solid var(--neutralLighter);">
                <button id="edit-draft-btn" data-id="${item.id}"
                    style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 24px;
                           background:var(--themePrimary);color:#fff;border:none;border-radius:24px;font-weight:600;cursor:pointer;box-shadow:0 4px 10px rgba(0,120,180,0.3);width:fit-content;">
                    <i class="fa-solid fa-pen-to-square"></i> Editar borrador
                </button>
            </div>` : `
            <div style="margin:20px 8px 0;padding-top:20px;border-top:1px solid var(--neutralLighter);">
                <button id="reply-btn"
                    style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 24px;
                           background:var(--themePrimary);color:#fff;border:none;border-radius:24px;font-weight:600;cursor:pointer;box-shadow:0 4px 10px rgba(0,120,180,0.3);width:fit-content;">
                    <i class="fa-solid fa-reply"></i> Responder
                </button>
            </div>`}
        `;
        return wrap;
    }

    // ── REDACTAR ──────────────────────────────────────────────────────────────
    function buildCompose() {
        const isEditing = !!state.editingDraftId;
        const draft = isEditing ? findItem(state.editingDraftId) : null;
        const replyTo = state.replyTo;

        let initTo = '', initSubj = '', initBody = '', initCh = 'internal', initPri = 'normal';
        if (draft) {
            initTo = draft.recipientId || (draft.recipientRole ? `role_${draft.recipientRole}` : '');
            initSubj = draft.title || '';
            initBody = draft.content || '';
            initCh = draft.channel || 'internal';
            initPri = draft.priority || 'normal';
        } else if (replyTo) {
            initTo = replyTo.createdBy === user?.id
                ? (replyTo.recipientId || '')
                : (replyTo.createdBy || '');
            initSubj = 'Re: ' + (replyTo.title || '');
        }

        const doctors = store.get('doctors') || [];
        const nurses = store.get('nurses') || [];
        const patients = store.get('patients') || [];
        const allUsers = store.get('users') || [];

        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:15px;">
                <button id="compose-cancel-btn"
                    style="background:var(--neutralLighterAlt); border:none; width:36px; height:36px; border-radius:50%; cursor:pointer; color:var(--themePrimary); display:flex; align-items:center; justify-content:center;">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <div style="flex:1;">
                    <div style="font-size:0.7rem;font-weight:700;color:var(--neutralPrimary);text-transform:uppercase;letter-spacing:0.03em;">Mensajería Hospitalaria</div>
                    <div style="font-size:0.9rem;font-weight:800;color:var(--neutralDark);">${isEditing ? 'Editar Borrador' : replyTo ? 'Responder Mensaje' : 'Redactar Nuevo'}</div>
                </div>
            </div>

            <form id="compose-form" class="compose-form-container">

                <!-- Para -->
                <div class="compose-input-group">
                    <span class="compose-label">Para</span>
                    <div style="flex:1; position:relative;">
                        ${replyTo && !isEditing ? `
                        <div style="font-size:0.9rem;font-weight:700;color:var(--themePrimary); padding:4px 0;">
                            ${escapeHtml(getActorName(initTo))}
                            <input type="hidden" id="cmp-to" value="${escapeHtml(initTo)}">
                        </div>` : `
                        <select id="cmp-to" class="compose-field" required>
                            <option value="">Seleccionar destinatario...</option>
                            <optgroup label="Directivos y Gremio">
                                <option value="role_admin"        ${initTo === 'role_admin' ? 'selected' : ''}>Alta Administración</option>
                                <option value="role_doctor"       ${initTo === 'role_doctor' ? 'selected' : ''}>Gremio Médico</option>
                                <option value="role_nurse"        ${initTo === 'role_nurse' ? 'selected' : ''}>Enfermería</option>
                                <option value="role_receptionist" ${initTo === 'role_receptionist' ? 'selected' : ''}>Recepción</option>
                            </optgroup>
                            <optgroup label="Médicos">
                                ${doctors.map(d => `<option value="${d.id}" ${d.id === initTo ? 'selected' : ''}>Dr/a. ${escapeHtml(d.name)}</option>`).join('')}
                            </optgroup>
                            <optgroup label="Enfermeras">
                                ${nurses.map(n => `<option value="${n.id}" ${n.id === initTo ? 'selected' : ''}>Lic. ${escapeHtml(n.name)}</option>`).join('')}
                            </optgroup>
                            <optgroup label="Pacientes Registrados">
                                ${patients.map(p => `<option value="${p.id}" ${p.id === initTo ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                            </optgroup>
                        </select>
                        <i class="fa-solid fa-chevron-down" style="position:absolute; right:0; top:50%; transform:translateY(-50%); font-size:0.7rem; color:var(--neutralSecondary); pointer-events:none;"></i>`}
                    </div>
                </div>

                <!-- Asunto -->
                <div class="compose-input-group">
                    <span class="compose-label">Asunto</span>
                    <input id="cmp-subj" class="compose-field" type="text" required placeholder="Escriba el título del mensaje" value="${escapeHtml(initSubj)}">
                </div>

                <!-- Parámetros -->
                <div style="display:grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--neutralLighter); background: #fafafa;">
                    <div class="compose-input-group" style="border-right:1px solid var(--neutralLighter); border-bottom:none;">
                        <span class="compose-label" style="width:auto; margin-right:8px;">Vía</span>
                        <select id="cmp-ch" class="compose-field" style="font-size:0.8rem; font-weight:600;">
                            <option value="internal" ${initCh === 'internal' ? 'selected' : ''}>Interna</option>
                            <option value="email" ${initCh === 'email' ? 'selected' : ''}>Email</option>
                            <option value="sms" ${initCh === 'sms' ? 'selected' : ''}>SMS</option>
                        </select>
                    </div>
                    <div class="compose-input-group" style="border-bottom:none;">
                        <span class="compose-label" style="width:auto; margin-right:8px;">Nivel</span>
                        <select id="cmp-pri" class="compose-field" style="font-size:0.8rem; font-weight:600;">
                            <option value="normal" ${initPri === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="high" ${initPri === 'high' ? 'selected' : ''}>Alta</option>
                            <option value="critical" ${initPri === 'critical' ? 'selected' : ''}>Urgente</option>
                        </select>
                    </div>
                </div>

                <!-- Mensaje -->
                <textarea id="cmp-body" required placeholder="Escriba su mensaje con detalle aquí..."
                    style="width:100%; border:none; padding:18px; font-size:0.9rem; min-height:180px;
                           outline:none; font-family:inherit; line-height:1.7; color:var(--neutralDark); border-bottom:1px solid var(--neutralLighter);">${escapeHtml(initBody)}</textarea>

                <!-- Acciones del formulario -->
                <div style="display:flex;align-items:center;gap:12px;padding:15px;background:#fff;border-top:1px solid var(--neutralLighter); border-radius:0 0 18px 18px;">
                    <button type="submit"
                        style="flex:2; display:flex;align-items:center;justify-content:center;gap:8px;background:var(--themePrimary);color:#fff;
                               border:none;border-radius:14px;padding:14px;font-size:0.9rem;font-weight:800;cursor:pointer; box-shadow:0 6px 15px rgba(0,59,105,0.2);">
                        <i class="fa-solid fa-paper-plane"></i> Enviar Ahora
                    </button>
                    <button type="button" id="save-draft-btn"
                        style="flex:1; display:flex;align-items:center;justify-content:center;gap:6px;background:var(--neutralLighterAlt);color:var(--themePrimary);
                               border:1px solid var(--themePrimary);border-radius:14px;padding:14px;font-size:0.85rem;font-weight:700;cursor:pointer;">
                        <i class="fa-solid fa-floppy-disk"></i> Borrador
                    </button>
                    <button type="button" id="discard-btn"
                        style="background:none; border:none; color:var(--red); width:40px; height:40px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; cursor:pointer;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </form>
        `;
        return wrap;
    }

    // ── ACCIONES ──────────────────────────────────────────────────────────────
    function markRead(id) {
        const src = findSrc(id);
        const item = findItem(id);
        if (!src || !item) return;
        if (item.status !== 'read' && item.createdBy !== user?.id) {
            store.update(src, id, { status: 'read' });
            const unread = unreadCount();
            const badge = document.getElementById('notif-badge');
            if (badge) {
                badge.textContent = unread > 0 ? (unread > 99 ? '99+' : unread) : '';
                badge.style.display = unread > 0 ? '' : 'none';
            }
        }
    }

    function toggleStar(id) {
        const src = findSrc(id);
        const item = findItem(id);
        if (src && item) store.update(src, id, { starred: !item.starred });
    }

    async function deleteItem(id) {
        const src = findSrc(id);
        if (!src) return;
        if (state.folder === 'trash') {
            if (!await hospitalConfirm('¿Eliminar permanentemente este mensaje?', 'danger')) return;
            store.remove(src, id);
        } else {
            store.update(src, id, { deleted: true });
        }
        state.view = 'list';
        state.viewingId = null;
        render();
        showToast(state.folder === 'trash' ? 'Eliminado permanentemente' : 'Movido a papelera');
    }

    function sendMessage(form) {
        const toEl = form.querySelector('#cmp-to');
        const val = toEl.value.trim();
        if (!val) { showToast('<i class="fa-solid fa-triangle-exclamation"></i> Seleccione un destinatario'); return; }
        const subj = form.querySelector('#cmp-subj').value.trim();
        const body = form.querySelector('#cmp-body').value.trim();
        if (!subj || !body) { showToast('<i class="fa-solid fa-triangle-exclamation"></i> Complete asunto y mensaje'); return; }

        const isRole = val.startsWith('role_');
        const name = isRole
            ? ({
                'role_admin': 'Alta Administración', 'role_doctor': 'Gremio Médico',
                'role_nurse': 'Enfermería', 'role_receptionist': 'Recepción',
                'role_patient': 'Pacientes'
            }[val] || val)
            : (toEl.tagName === 'SELECT'
                ? toEl.options[toEl.selectedIndex]?.text || getActorName(val)
                : getActorName(val));

        store.add('messages', {
            recipientId: isRole ? null : val,
            recipientRole: isRole ? val.replace('role_', '') : null,
            recipientName: name,
            title: subj,
            content: body,
            channel: form.querySelector('#cmp-ch').value,
            priority: form.querySelector('#cmp-pri').value,
            status: 'sent',
            type: 'manual',
            createdBy: user?.id || '',
            createdAt: Date.now()
        });
        if (state.editingDraftId) store.remove('drafts', state.editingDraftId);
        state.view = 'list'; state.replyTo = null; state.editingDraftId = null;
        render();
        showToast('<i class="fa-solid fa-check"></i> Mensaje enviado correctamente');
    }

    function saveDraft(form) {
        const toEl = form.querySelector('#cmp-to');
        const val = toEl.value.trim();
        const isRole = val.startsWith('role_');
        const name = isRole
            ? (toEl.tagName === 'SELECT' ? toEl.options[toEl.selectedIndex]?.text : getActorName(val))
            : getActorName(val);
        const data = {
            recipientId: isRole ? null : val,
            recipientRole: isRole ? val.replace('role_', '') : null,
            recipientName: name,
            title: form.querySelector('#cmp-subj').value.trim() || '(sin asunto)',
            content: form.querySelector('#cmp-body').value.trim(),
            channel: form.querySelector('#cmp-ch').value,
            priority: form.querySelector('#cmp-pri').value,
            status: 'draft', type: 'manual',
            createdBy: user?.id || '', createdAt: Date.now()
        };
        if (state.editingDraftId) store.update('drafts', state.editingDraftId, data);
        else store.add('drafts', data);
        state.view = 'list'; state.replyTo = null; state.editingDraftId = null;
        render();
        showToast('<i class="fa-solid fa-floppy-disk"></i> Borrador guardado');
    }

    function showToast(msg) {
        const el = document.createElement('div');
        el.style.cssText = `position:fixed;top:20px;right:20px;max-width:calc(100vw - 40px);
            padding:1rem 1.5rem;border-radius:8px;background:var(--neutralDark);color:#fff;
            font-size:0.85rem;font-weight:600;z-index:999999;box-shadow:0 10px 15px -3px rgba(0,0,0,.15);
            display:flex;align-items:center;gap:0.75rem;
            transform:translateX(120%);opacity:0;transition:transform 0.3s ease, opacity 0.3s ease;`;
        el.innerHTML = msg;
        document.body.appendChild(el);
        setTimeout(() => { el.style.transform = 'translateX(0)'; el.style.opacity = '1'; }, 10);
        setTimeout(() => {
            el.style.transform = 'translateX(120%)';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
        }, 2800);
    }

    // ── BIND ──────────────────────────────────────────────────────────────────
    function bindEvents() {
        // Carpetas
        currentRoot.querySelectorAll('[data-folder]').forEach(btn => {
            if (btn._listener) {
                btn.removeEventListener('click', btn._listener);
            }
            const handler = () => {
                state.folder = btn.dataset.folder;
                state.view = 'list';
                state.viewingId = null;
                render();
            };
            btn.addEventListener('click', handler);
            btn._listener = handler;
        });

        // Redactar
        const composeBtn = currentRoot.querySelector('#notif-compose-btn');
        if (composeBtn) {
            if (composeBtn._listener) composeBtn.removeEventListener('click', composeBtn._listener);
            const handler = () => {
                state.view = 'compose'; state.replyTo = null; state.editingDraftId = null; render();
            };
            composeBtn.addEventListener('click', handler);
            composeBtn._listener = handler;
        }

        // Detalle — volver
        const detailBack = currentRoot.querySelector('#detail-back');
        if (detailBack) {
            if (detailBack._listener) detailBack.removeEventListener('click', detailBack._listener);
            const handler = () => {
                state.view = 'list'; state.viewingId = null; render();
            };
            detailBack.addEventListener('click', handler);
            detailBack._listener = handler;
        }

        // Detalle — estrella
        const starBtn = currentRoot.querySelector('[data-action="star"]');
        if (starBtn) {
            if (starBtn._listener) starBtn.removeEventListener('click', starBtn._listener);
            const handler = (e) => {
                toggleStar(e.currentTarget.dataset.id); render();
            };
            starBtn.addEventListener('click', handler);
            starBtn._listener = handler;
        }

        // Detalle — eliminar
        const deleteBtn = currentRoot.querySelector('[data-action="delete-detail"]');
        if (deleteBtn) {
            if (deleteBtn._listener) deleteBtn.removeEventListener('click', deleteBtn._listener);
            const handler = (e) => {
                deleteItem(e.currentTarget.dataset.id);
            };
            deleteBtn.addEventListener('click', handler);
            deleteBtn._listener = handler;
        }

        // Detalle — responder
        const replyBtn = currentRoot.querySelector('#reply-btn');
        if (replyBtn) {
            if (replyBtn._listener) replyBtn.removeEventListener('click', replyBtn._listener);
            const handler = () => {
                state.replyTo = findItem(state.viewingId);
                state.view = 'compose'; state.editingDraftId = null; render();
            };
            replyBtn.addEventListener('click', handler);
            replyBtn._listener = handler;
        }

        // Detalle — editar borrador
        const editDraftBtn = currentRoot.querySelector('#edit-draft-btn');
        if (editDraftBtn) {
            if (editDraftBtn._listener) editDraftBtn.removeEventListener('click', editDraftBtn._listener);
            const handler = (e) => {
                state.editingDraftId = e.currentTarget.dataset.id;
                state.view = 'compose'; state.replyTo = null; render();
            };
            editDraftBtn.addEventListener('click', handler);
            editDraftBtn._listener = handler;
        }

        // Redactar — cancelar
        const composeCancel = currentRoot.querySelector('#compose-cancel-btn');
        if (composeCancel) {
            if (composeCancel._listener) composeCancel.removeEventListener('click', composeCancel._listener);
            const handler = () => {
                state.view = 'list'; state.replyTo = null; state.editingDraftId = null; render();
            };
            composeCancel.addEventListener('click', handler);
            composeCancel._listener = handler;
        }

        // Redactar — enviar
        const composeForm = currentRoot.querySelector('#compose-form');
        if (composeForm) {
            if (composeForm._submitListener) composeForm.removeEventListener('submit', composeForm._submitListener);
            const submitHandler = (e) => { e.preventDefault(); sendMessage(composeForm); };
            composeForm.addEventListener('submit', submitHandler);
            composeForm._submitListener = submitHandler;
            
            // Guardar borrador
            const saveDraftBtn = currentRoot.querySelector('#save-draft-btn');
            if (saveDraftBtn) {
                if (saveDraftBtn._listener) saveDraftBtn.removeEventListener('click', saveDraftBtn._listener);
                const draftHandler = () => saveDraft(composeForm);
                saveDraftBtn.addEventListener('click', draftHandler);
                saveDraftBtn._listener = draftHandler;
            }
            
            // Descartar
            const discardBtn = currentRoot.querySelector('#discard-btn');
            if (discardBtn) {
                if (discardBtn._listener) discardBtn.removeEventListener('click', discardBtn._listener);
                const discardHandler = () => {
                    state.view = 'list'; state.replyTo = null; state.editingDraftId = null; render();
                };
                discardBtn.addEventListener('click', discardHandler);
                discardBtn._listener = discardHandler;
            }
        }
    }

    // ── Iniciar ───────────────────────────────────────────────────────────────
    loadData();
    render();

    // Devolver función para refrescar desde main
    return { refresh: render };
}