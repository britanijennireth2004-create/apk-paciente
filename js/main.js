/**
 * Main Application Orchestrator for Patient Mobile APK
 * Exclusivamente para pacientes con registro completo
 */
import { createBus } from './core/bus.js';
import { createStore } from './core/store.js';
import * as UI from './ui.js';
import { mountNewAppointmentForm, renderMyAppointmentsView } from './appointments.js';
import { mountNotifications } from './notifications.js';
import { mountProfile } from './profile.js';
import { mountClinical } from './clinical.js';
import { mountAreas } from './areas.js';

// Exponer funciones globales para UI
window.hospitalAlert = UI.hospitalAlert;
window.hospitalConfirm = UI.hospitalConfirm;
window.showToast = UI.showToast;

// Función prompt para recuperación de contraseña
window.promptDialog = function(message, defaultValue = '') {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
        
        modal.innerHTML = `
            <div style="background:#fff;border-radius:20px;width:90%;max-width:400px;overflow:hidden;animation:slideUp 0.3s ease;">
                <div style="background:var(--themePrimary);padding:16px 20px;">
                    <h3 style="margin:0;color:#fff;font-size:1rem;">${message}</h3>
                </div>
                <div style="padding:20px;">
                    <input type="email" id="prompt-input" class="login-input" style="width:100%;" placeholder="correo@ejemplo.com" value="${defaultValue}">
                </div>
                <div style="padding:12px 20px 20px;display:flex;gap:12px;justify-content:flex-end;">
                    <button id="prompt-cancel" style="background:#f1f5f9;border:none;padding:10px 20px;border-radius:12px;cursor:pointer;">Cancelar</button>
                    <button id="prompt-ok" style="background:var(--themePrimary);color:#fff;border:none;padding:10px 20px;border-radius:12px;cursor:pointer;">Aceptar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const input = modal.querySelector('#prompt-input');
        input.focus();
        
        const close = (value) => {
            modal.remove();
            resolve(value);
        };
        
        modal.querySelector('#prompt-cancel').onclick = () => close(null);
        modal.querySelector('#prompt-ok').onclick = () => close(input.value.trim() || null);
        input.onkeypress = (e) => { if (e.key === 'Enter') close(input.value.trim() || null); };
    });
};

class HospitalApp {
    constructor() {
        this.bus = null;
        this.store = null;
        this.user = null;
        this.patientRecord = null;
        this.currentView = 'login';
        this.currentAppointmentId = null;
        this.recoveryUser = null;
        this.registerModule = null;
        this.recoveryModalIcons = null;
        this.isRegistering = false;
        this.eventsBound = false;
    }

    async init() {
        this.bus = createBus();
        this.store = await createStore(this.bus);

        const appContainer = document.querySelector('.app-container');
        if (appContainer) appContainer.style.display = 'flex';
        
        this.updateChromeVisibility();

        await new Promise(res => setTimeout(res, 2000));

        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }

        const savedPatient = localStorage.getItem('hospital_patient');
        if (savedPatient) {
            try {
                const patient = JSON.parse(savedPatient);
                const freshPatient = this.store.find('patients', patient.id);
                if (freshPatient && freshPatient.isActive !== false) {
                    this.patientRecord = freshPatient;
                    this.user = {
                        id: freshPatient.id,
                        name: freshPatient.name,
                        role: 'patient',
                        email: freshPatient.email,
                        patientId: freshPatient.id,
                        dni: freshPatient.dni,
                        docType: freshPatient.docType,
                        username: freshPatient.username
                    };
                    await this.refreshAll();
                    this.navigate('home');
                    return;
                }
            } catch(e) {
                console.error('Error al restaurar sesión:', e);
                localStorage.removeItem('hospital_patient');
            }
        }
        
        // Configurar eventos globales UNA SOLA VEZ
        this.setupGlobalEvents();
        
        this.navigate('login');
        setInterval(() => this.updateStats(), 30000);
    }

    updateChromeVisibility() {
        const isLogin = this.currentView === 'login';
        const isRegister = this.currentView === 'register';
        const header = document.querySelector('.header');
        const bottomNav = document.querySelector('.bottom-nav');
        const statsBar = document.getElementById('global-stats');
        
        if (header) header.style.display = (isLogin || isRegister) ? 'none' : 'flex';
        if (bottomNav) bottomNav.style.display = (isLogin || isRegister) ? 'none' : 'flex';
        if (statsBar) statsBar.style.display = (isLogin || isRegister) ? 'none' : 'flex';
        
        if (isLogin || isRegister) {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('overlay');
            if (sidebar) sidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
        }
    }

    cleanupUI() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        document.querySelectorAll('.sidebar-item[data-view]').forEach(item => {
            item.classList.remove('active');
        });
        
        const statsBar = document.getElementById('global-stats');
        if (statsBar) statsBar.style.display = 'none';
        
        const header = document.querySelector('.header');
        if (header) header.style.display = 'none';
        
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) bottomNav.style.display = 'none';
        
        const nameEl = document.getElementById('header-patient-name');
        if (nameEl) nameEl.textContent = '';
        
        const imgEl = document.getElementById('header-patient-img');
        if (imgEl) imgEl.style.backgroundImage = '';
        
        const greetingEl = document.getElementById('greeting-text');
        if (greetingEl) greetingEl.textContent = '';
        
        const sidebarName = document.getElementById('sidebar-patient-name');
        if (sidebarName) sidebarName.textContent = '';
        
        const sidebarDni = document.getElementById('sidebar-patient-dni');
        if (sidebarDni) sidebarDni.textContent = '';
        
        const sidebarImg = document.getElementById('sidebar-patient-img');
        if (sidebarImg) sidebarImg.style.backgroundImage = '';
        
        const statTotal = document.getElementById('stat-total');
        if (statTotal) statTotal.textContent = '0';
        const statPending = document.getElementById('stat-pending');
        if (statPending) statPending.textContent = '0';
        const statDone = document.getElementById('stat-done');
        if (statDone) statDone.textContent = '0';
        
        const notifBadge = document.getElementById('notif-badge');
        if (notifBadge) {
            notifBadge.classList.remove('active');
            notifBadge.style.display = 'none';
            notifBadge.textContent = '';
        }
    }

    clearLoginForm() {
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        const loginBtn = document.getElementById('btn-login-submit');
        
        if (usernameInput) {
            usernameInput.value = '';
            usernameInput.disabled = false;
        }
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.disabled = false;
        }
        if (loginBtn) {
            loginBtn.innerHTML = 'INICIAR SESIÓN';
            loginBtn.disabled = false;
        }
    }

    async showSplash(show = true) {
        const loader = document.getElementById('loading-screen');
        if (!loader) return;
        
        if (show) {
            loader.style.display = 'flex';
            loader.style.opacity = '1';
        } else {
            loader.style.opacity = '0';
            await new Promise(resolve => setTimeout(resolve, 300));
            loader.style.display = 'none';
        }
    }

    async logout() {
        if (await UI.hospitalConfirm('¿Estás seguro de cerrar sesión?', 'warning')) {
            localStorage.removeItem('hospital_patient');
            this.user = null;
            this.patientRecord = null;
            
            // Limpiar el contenedor #app si existe
            const appElement = document.getElementById('app');
            if (appElement) {
                appElement.innerHTML = '';
                // Restaurar la estructura original
                const originalContainer = document.querySelector('.app-container');
                if (originalContainer && originalContainer.parentNode === appElement) {
                    appElement.appendChild(originalContainer);
                }
            }
            
            this.currentView = 'login';
            this.cleanupUI();
            this.clearLoginForm();
            await this.showSplash(true);
            await new Promise(resolve => setTimeout(resolve, 500));
            this.updateChromeVisibility();
            this.navigate('login');
            await this.showSplash(false);
            
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('overlay');
            if (sidebar) sidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            
            document.querySelectorAll('.hospital-modal-overlay, .modal-overlay, .selection-sheet-overlay, #apt-detail-modal')
                .forEach(modal => modal.remove());
            
            // Asegurar que el app-container sea visible
            const appContainer = document.querySelector('.app-container');
            if (appContainer) appContainer.style.display = 'flex';
        }
    }

    setupNavigation() {
        const oldMenuToggle = document.getElementById('menu-toggle');
        if (oldMenuToggle && oldMenuToggle._listener) {
            oldMenuToggle.removeEventListener('click', oldMenuToggle._listener);
        }
        
        const oldNotifBtn = document.getElementById('notif-btn');
        if (oldNotifBtn && oldNotifBtn._listener) {
            oldNotifBtn.removeEventListener('click', oldNotifBtn._listener);
        }

        document.querySelectorAll('.nav-item').forEach(item => {
            if (item._listener) {
                item.removeEventListener('click', item._listener);
            }
            const handler = (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                if (view) this.navigate(view);
            };
            item.addEventListener('click', handler);
            item._listener = handler;
        });

        document.querySelectorAll('.sidebar-item[data-view]').forEach(item => {
            if (item._listener) {
                item.removeEventListener('click', item._listener);
            }
            const handler = (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                if (view) this.navigate(view);
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('overlay');
                if (sidebar) sidebar.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
            };
            item.addEventListener('click', handler);
            item._listener = handler;
        });

        const notifBtn = document.getElementById('notif-btn');
        if (notifBtn) {
            const notifHandler = (e) => {
                e.preventDefault();
                this.navigate('messages');
            };
            notifBtn.addEventListener('click', notifHandler);
            notifBtn._listener = notifHandler;
        }

        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        
        if (menuToggle) {
            const menuHandler = (e) => {
                e.preventDefault();
                if (sidebar) sidebar.classList.toggle('active');
                if (overlay) overlay.classList.toggle('active');
            };
            menuToggle.addEventListener('click', menuHandler);
            menuToggle._listener = menuHandler;
        }
        
        if (overlay) {
            const overlayHandler = () => {
                if (sidebar) sidebar.classList.remove('active');
                overlay.classList.remove('active');
            };
            overlay.addEventListener('click', overlayHandler);
            overlay._listener = overlayHandler;
        }

        document.querySelectorAll('[data-view-target]').forEach(el => {
            if (el._listener) {
                el.removeEventListener('click', el._listener);
            }
            const handler = (e) => {
                e.preventDefault();
                this.navigate(el.dataset.viewTarget);
            };
            el.addEventListener('click', handler);
            el._listener = handler;
        });

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            if (logoutBtn._listener) {
                logoutBtn.removeEventListener('click', logoutBtn._listener);
            }
            const logoutHandler = (e) => {
                e.preventDefault();
                this.logout();
            };
            logoutBtn.addEventListener('click', logoutHandler);
            logoutBtn._listener = logoutHandler;
        }
        
        this.setupBackButton();
    }
    
    setupBackButton() {
        const checkBackButton = () => {
            const backBtn = document.getElementById('back-from-new-appt');
            if (backBtn && !backBtn._listenerAdded) {
                backBtn.addEventListener('click', () => this.navigate('home'));
                backBtn._listenerAdded = true;
            }
        };
        checkBackButton();
        setTimeout(checkBackButton, 100);
    }

    navigate(viewId) {
        if (this.isRegistering && viewId !== 'register') {
            return;
        }
        
        this.currentView = viewId;

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewId);
        });

        document.querySelectorAll('.sidebar-item[data-view]').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewId);
        });

        document.querySelectorAll('.view').forEach(view => {
            view.classList.toggle('active', view.id === `view-${viewId}`);
        });

        const hideStats = ['profile', 'new-appointment', 'my-appointments', 'login', 'register', 'areas', 'clinical', 'messages'];
        const statsBar = document.getElementById('global-stats');
        if (statsBar) {
            statsBar.style.display = hideStats.includes(viewId) ? 'none' : 'flex';
        }

        this.updateChromeVisibility();
        this.renderCurrentView();
    }

    renderCurrentView() {
        switch (this.currentView) {
            case 'login': this.renderLogin(); break;
            case 'register': this.renderRegister(); break;
            case 'home': this.renderHome(); break;
            case 'messages': this.renderMessages(); break;
            case 'profile': this.renderProfile(); break;
            case 'new-appointment': this.renderNewAppointment(); break;
            case 'my-appointments': this.renderMyAppointments(); break;
            case 'areas': this.renderAreas(); break;
            case 'clinical': this.renderClinical(); break;
        }
    }

    async refreshAll() {
        this.renderHeader();
        this.updateStats();
        this.renderHome();
        this.updateNotificationBadge();
    }
    
    renderHeader() {
        const nameEl = document.getElementById('header-patient-name');
        const imgEl = document.getElementById('header-patient-img');
        const greetingEl = document.getElementById('greeting-text');
        const sidebarName = document.getElementById('sidebar-patient-name');
        const sidebarImg = document.getElementById('sidebar-patient-img');
        const sidebarDni = document.getElementById('sidebar-patient-dni');

        if (this.user) {
            if (nameEl) nameEl.textContent = this.user.name;
            if (sidebarName) sidebarName.textContent = this.user.name;
            if (sidebarDni) sidebarDni.textContent = `Cédula: ${this.user.docType || 'V'}-${this.user.dni || '—'}`;
            
            const profilePic = this.patientRecord?.profilePicture;
            if (profilePic) {
                if (imgEl) imgEl.style.backgroundImage = `url('${profilePic}')`;
                if (sidebarImg) sidebarImg.style.backgroundImage = `url('${profilePic}')`;
            } else {
                const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.user.name)}&background=003b69&color=fff&bold=true&size=80`;
                if (imgEl) imgEl.style.backgroundImage = `url('${avatarUrl}')`;
                if (sidebarImg) sidebarImg.style.backgroundImage = `url('${avatarUrl}')`;
            }

            const hour = new Date().getHours();
            if (greetingEl) {
                if (hour < 12) greetingEl.textContent = 'Buenos días,';
                else if (hour < 18) greetingEl.textContent = 'Buenas tardes,';
                else greetingEl.textContent = 'Buenas noches,';
            }
        }
    }

    updateStats() {
        if (!this.patientRecord) return;

        const appointments = this.store.get('appointments');
        const mine = appointments.filter(a => a.patientId === this.patientRecord.id);

        const stats = {
            total: mine.length,
            pending: mine.filter(a => ['scheduled', 'confirmed'].includes(a.status)).length,
            done: mine.filter(a => ['completed', 'finalized'].includes(a.status)).length
        };

        const totalEl = document.getElementById('stat-total');
        const pendingEl = document.getElementById('stat-pending');
        const doneEl = document.getElementById('stat-done');
        
        if (totalEl) totalEl.textContent = stats.total;
        if (pendingEl) pendingEl.textContent = stats.pending;
        if (doneEl) doneEl.textContent = stats.done;

        this.updateNotificationBadge();
    }
    
    updateNotificationBadge() {
        const unread = this._countUnread();
        const badge = document.getElementById('notif-badge');
        if (badge) {
            if (unread > 0) {
                badge.textContent = unread > 99 ? '99+' : unread;
                badge.classList.add('active');
                badge.style.display = 'block';
            } else {
                badge.classList.remove('active');
                badge.style.display = 'none';
                badge.textContent = '';
            }
        }
    }

    _countUnread() {
        const pid = this.patientRecord?.id;
        const uid = this.user?.id;
        
        const isForMe = item => 
            item.recipientId === uid || 
            item.recipientId === pid || 
            item.recipientRole === 'patient';

        const msgs = (this.store.get('messages') || []).filter(m => isForMe(m) && m.createdBy !== uid && m.status !== 'read').length;
        const notifs = (this.store.get('notifications') || []).filter(n => isForMe(n) && n.status !== 'read').length;
        const reminders = (this.store.get('reminders') || []).filter(r => isForMe(r) && r.status !== 'read').length;
        return msgs + notifs + reminders;
    }

    renderHome() {
        if (!this.patientRecord) return;
        const all = this.store.get('appointments');
        const mine = all.filter(a => a.patientId === this.patientRecord.id);
        this.renderHomeView(mine);
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === 'home');
        });
        document.querySelectorAll('.sidebar-item[data-view]').forEach(item => {
            item.classList.toggle('active', item.dataset.view === 'home');
        });
    }
    
    renderHomeView(appointments) {
        const todayStr = new Date().toDateString();
        const sortedToday = appointments
            .filter(a => new Date(a.dateTime).toDateString() === todayStr && a.status !== 'cancelled')
            .sort((a, b) => a.dateTime - b.dateTime);

        const next = sortedToday.find(a => a.status === 'scheduled' || a.status === 'confirmed');
        const nextSlot = document.getElementById('next-appointment-slot');

        if (next) {
            const doctor = this.store.find('doctors', next.doctorId);
            const time = new Date(next.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const date = new Date(next.dateTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

            nextSlot.innerHTML = `
                <div class="next-card" style="cursor:pointer;" id="next-apt-card">
                    <div class="patient-info">
                        <div class="patient-avatar" style="background-image: url('https://ui-avatars.com/api/?name=${encodeURIComponent(doctor?.name || 'M')}&background=003b69&color=fff&size=80')"></div>
                        <div class="patient-details">
                            <h3>${doctor?.name || 'Médico'}</h3>
                            <div class="patient-sub">${date} a las ${time} · ${next.modality === 'virtual' ? 'Virtual' : 'Presencial'}</div>
                        </div>
                    </div>
                    <div class="appointment-time">
                        <i class="fa-regular fa-clock"></i>
                        ${next.reason || 'Consulta médica'}
                    </div>
                    <button class="btn-primary" style="background: var(--themePrimary);">
                        Ver detalles <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
            `;
            const nextCard = document.getElementById('next-apt-card');
            if (nextCard && !nextCard._listener) {
                const handler = () => {
                    this.showAppointmentDetail(next.id);
                };
                nextCard.addEventListener('click', handler);
                nextCard._listener = handler;
            }
        } else {
            nextSlot.innerHTML = `
                <div class="empty-state" style="background:#fff;border-radius:16px;padding:24px;text-align:center;">
                    <i class="fa-regular fa-calendar-check" style="font-size:2rem;opacity:0.3;margin-bottom:12px;display:block;"></i>
                    <p style="margin:0;color:var(--neutralSecondary);">No hay citas programadas para hoy</p>
                    <button onclick="window._patientApp?.navigate('new-appointment')" class="btn-primary" style="margin-top:12px;background:var(--themePrimary);padding:8px 16px;border-radius:20px;font-size:0.75rem;">
                        <i class="fa-solid fa-plus"></i> Agendar cita
                    </button>
                </div>
            `;
        }

        const agendaList = document.getElementById('home-agenda-list');
        if (!agendaList) return;
        
        const upcoming = appointments
            .filter(a => a.status === 'scheduled' || a.status === 'confirmed')
            .sort((a, b) => a.dateTime - b.dateTime)
            .slice(0, 3);

        agendaList.innerHTML = '';

        if (upcoming.length > 0) {
            upcoming.forEach(apt => {
                const doctor = this.store.find('doctors', apt.doctorId);
                const time = new Date(apt.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const date = new Date(apt.dateTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

                const item = document.createElement('div');
                item.className = 'agenda-item';
                item.style.cursor = 'pointer';
                const handler = () => this.showAppointmentDetail(apt.id);
                item.addEventListener('click', handler);
                item._listener = handler;
                item.innerHTML = `
                    <div class="time-block">
                        <span class="time">${date}</span>
                        <span class="am-pm">${time}</span>
                    </div>
                    <div class="item-details">
                        <h4>${doctor?.name?.split(' ')[0] || 'Médico'} · ${doctor?.specialty?.split(' ')[0] || 'Consulta'}</h4>
                        <p>${apt.reason?.substring(0, 40) || 'Consulta médica'}</p>
                    </div>
                    <div class="status-dot status-waiting"></div>
                `;
                agendaList.appendChild(item);
            });
        } else {
            agendaList.innerHTML = '<div class="empty-state" style="text-align:center;padding:24px;color:var(--neutralSecondary);">No hay citas próximas</div>';
        }
    }

    // ==================== PANTALLA DE REGISTRO ====================
    async renderRegister() {
        if (this.isRegistering) {
            console.log('Registro ya en proceso, ignorando...');
            return;
        }
        
        this.isRegistering = true;
        
        // Limpiar modales existentes
        document.querySelectorAll('.hospital-modal-overlay, .modal-overlay, .selection-sheet-overlay, #apt-detail-modal')
            .forEach(modal => modal.remove());
        
        // Cerrar sidebar si está abierto
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        
        // Ocultar el app-container
        const appContainer = document.querySelector('.app-container');
        if (appContainer) appContainer.style.display = 'none';
        
        // Obtener o crear el contenedor #app
        let appElement = document.getElementById('app');
        if (!appElement) {
            appElement = document.createElement('div');
            appElement.id = 'app';
            document.body.insertBefore(appElement, document.body.firstChild);
        }
        
        // Mostrar loading
        appElement.innerHTML = `
            <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#e2e8f0,#f1f5f9);">
                <div style="text-align:center;">
                    <div style="width:40px;height:40px;border:3px solid #003b69;border-top-color:transparent;border-radius:50%;margin:0 auto 16px;animation:spin 0.8s linear infinite;"></div>
                    <p style="color:#64748b;">Cargando registro...</p>
                </div>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        `;
        
        try {
            // Importar dinámicamente el módulo de registro
            const registerModule = await import('./register.js');
            
            // Limpiar y preparar el contenedor
            appElement.innerHTML = '<div id="register-root" style="min-height:100vh;"></div>';
            const registerRoot = document.getElementById('register-root');
            
            if (!registerRoot) {
                throw new Error('No se pudo crear el contenedor de registro');
            }
            
            // Montar el formulario de registro
            this.registerModule = registerModule.mountRegister(registerRoot, {
                store: this.store,
                onSuccess: (user) => {
                    if (user) {
                        // Guardar sesión y recargar
                        localStorage.setItem('hospital_patient', JSON.stringify({
                            id: user.id,
                            name: user.name,
                            dni: user.dni,
                            username: user.username
                        }));
                        // Recargar la página para reiniciar el estado
                        window.location.reload();
                    } else {
                        // Canceló el registro, volver al login
                        if (appContainer) appContainer.style.display = 'flex';
                        appElement.innerHTML = '';
                        // Restaurar el app-container
                        if (appContainer && appContainer.parentNode !== appElement) {
                            appElement.appendChild(appContainer);
                        }
                        this.isRegistering = false;
                        this.navigate('login');
                    }
                }
            });
            
        } catch (error) {
            console.error('Error cargando módulo de registro:', error);
            // Mostrar error y volver al login
            appElement.innerHTML = `
                <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#e2e8f0,#f1f5f9);">
                    <div style="background:#fff;border-radius:16px;padding:24px;text-align:center;max-width:300px;">
                        <i class="fa-solid fa-circle-exclamation" style="font-size:2rem;color:#dc2626;margin-bottom:12px;"></i>
                        <h3 style="margin:0 0 8px;">Error al cargar</h3>
                        <p style="color:#64748b;margin-bottom:16px;">No se pudo cargar la página de registro</p>
                        <button onclick="window.location.reload()" class="btn-primary" style="background:var(--themePrimary);border:none;padding:10px 20px;border-radius:12px;color:#fff;cursor:pointer;">
                            Reintentar
                        </button>
                    </div>
                </div>
            `;
        } finally {
            this.isRegistering = false;
        }
    }

    // ==================== LOGIN ====================
    renderLogin() {
        document.querySelectorAll('.hospital-modal-overlay, .modal-overlay, .selection-sheet-overlay, #apt-detail-modal')
            .forEach(modal => modal.remove());
        
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        
        const appContainer = document.querySelector('.app-container');
        if (appContainer) appContainer.style.display = 'flex';
        
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        
        const loginBtn = document.getElementById('btn-login-submit');
        if (loginBtn) {
            loginBtn.innerHTML = 'INICIAR SESIÓN';
            loginBtn.disabled = false;
        }
    }

    // ==================== EVENTOS GLOBALES ====================
    setupGlobalEvents() {
        if (this.eventsBound) return;
        this.eventsBound = true;
        
        this.recoveryModalIcons = {
            mail: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
            shield: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
            key: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
            check: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
        };
        
        // Evento para recuperar contraseña
        document.body.addEventListener('click', (e) => {
            const recoverLink = e.target.closest('#recover-link');
            if (recoverLink) {
                e.preventDefault();
                e.stopPropagation();
                const modalOverlay = document.getElementById('recover-modal-overlay');
                if (modalOverlay) {
                    modalOverlay.style.display = 'flex';
                    this.renderRecoverStep('email');
                }
                return;
            }
            
            const registerLink = e.target.closest('#register-link');
            if (registerLink) {
                e.preventDefault();
                e.stopPropagation();
                this.navigate('register');
                return;
            }
            
            const modalClose = e.target.closest('#recover-modal-close');
            if (modalClose) {
                e.preventDefault();
                const modalOverlay = document.getElementById('recover-modal-overlay');
                if (modalOverlay) modalOverlay.style.display = 'none';
                this.recoveryUser = null;
                return;
            }
        });
        
        // Evento para el ojo de la contraseña
        document.body.addEventListener('click', (e) => {
            const eyeBtn = e.target.closest('#eye-login');
            if (eyeBtn) {
                e.preventDefault();
                const passInput = document.getElementById('login-password');
                if (passInput) {
                    const isPassword = passInput.type === 'password';
                    passInput.type = isPassword ? 'text' : 'password';
                    const eyeOffSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
                    const eyeSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
                    eyeBtn.innerHTML = isPassword ? eyeOffSVG : eyeSVG;
                }
            }
        });
        
        // Evento para el formulario de login
        document.body.addEventListener('submit', async (e) => {
            const form = e.target.closest('#login-form');
            if (!form) return;
            
            e.preventDefault();
            
            const userIn = document.getElementById('login-username')?.value.trim() || '';
            const passIn = document.getElementById('login-password')?.value || '';
            const btn = document.getElementById('btn-login-submit');

            if (!userIn || !passIn) {
                await UI.hospitalAlert('Por favor ingrese su usuario y contraseña', 'warning');
                return;
            }

            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
                btn.disabled = true;
            }

            try {
                const patients = this.store.get('patients');
                
                const patient = patients.find(p => 
                    p.username === userIn || 
                    p.dni === userIn ||
                    p.email === userIn
                );
                
                if (!patient) {
                    await UI.hospitalAlert('Usuario no encontrado. ¿Desea registrarse?', 'warning');
                    if (btn) {
                        btn.innerHTML = 'INICIAR SESIÓN';
                        btn.disabled = false;
                    }
                    return;
                }
                
                let validPassword = false;
                let patientPassword = patient.password;
                
                if (!patientPassword) {
                    const users = this.store.get('users');
                    const userRecord = users.find(u => u.patientId === patient.id || u.username === userIn);
                    if (userRecord) {
                        patientPassword = userRecord.password;
                    }
                }
                
                if (patientPassword && patientPassword === passIn) {
                    validPassword = true;
                }
                
                if (!validPassword) {
                    await UI.hospitalAlert('Contraseña incorrecta. Intente nuevamente.', 'error');
                    if (btn) {
                        btn.innerHTML = 'INICIAR SESIÓN';
                        btn.disabled = false;
                    }
                    return;
                }
                
                if (patient.isActive === false) {
                    await UI.hospitalAlert('Esta cuenta ha sido desactivada. Contacte al administrador.', 'error');
                    if (btn) {
                        btn.innerHTML = 'INICIAR SESIÓN';
                        btn.disabled = false;
                    }
                    return;
                }

                this.user = {
                    id: patient.id,
                    name: patient.name,
                    role: 'patient',
                    email: patient.email,
                    patientId: patient.id,
                    dni: patient.dni,
                    docType: patient.docType || 'V',
                    username: patient.username
                };
                this.patientRecord = patient;
                
                localStorage.setItem('hospital_patient', JSON.stringify({
                    id: patient.id,
                    name: patient.name,
                    dni: patient.dni,
                    username: patient.username
                }));

                this.setupNavigation();
                await this.refreshAll();
                this.navigate('home');
                
            } catch (error) {
                console.error('Error en login:', error);
                await UI.hospitalAlert('Error al iniciar sesión. Intente nuevamente.', 'error');
                if (btn) {
                    btn.innerHTML = 'INICIAR SESIÓN';
                    btn.disabled = false;
                }
            }
        });
    }

    renderRecoverStep(step) {
        const modalBody = document.getElementById('recover-modal-body');
        if (!modalBody) return;

        if (step === 'email') {
            modalBody.innerHTML = `
              <div class="auth-rec" style="padding: 0.5rem 0;">
                <div class="auth-rec-head">
                  <span class="auth-rec-ico" style="background: #003b69;">
                    ${this.recoveryModalIcons.mail}
                  </span>
                  <h3 style="color: #1e293b; font-size: 1.3rem; margin-top: 1rem;">Recuperar Acceso</h3>
                  <p style="color: #64748b; font-size: 0.85rem;">Ingrese su correo electrónico para buscar su cuenta</p>
                </div>
                <form id="rec-email-form" style="margin-top: 1.5rem;">
                  <div class="login-field">
                    <label class="login-label" for="rec-email" style="font-weight: 600;">Correo electrónico</label>
                    <input class="login-input" type="email" id="rec-email" placeholder="ejemplo@hospital.com" required 
                           style="border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; width:100%; box-sizing:border-box;" />
                  </div>
                  <div id="rec-error" class="auth-msg auth-err" style="display:none; margin-top: 12px;"></div>
                  <button type="submit" class="login-submit-btn" style="width:100%; margin-top: 24px; background: #003b69; border-radius: 12px; padding: 14px; color:white; border:none; cursor:pointer;">
                    BUSCAR CUENTA
                  </button>
                </form>
              </div>`;
            
            const emailForm = document.getElementById('rec-email-form');
            if (emailForm) {
                emailForm.onsubmit = (e) => {
                    e.preventDefault();
                    const mail = document.getElementById('rec-email').value;
                    const patients = this.store.get('patients');
                    const users = this.store.get('users');
                    const matchedPatient = patients.find(p => p.email === mail);
                    const matchedUser = users.find(u => u.email === mail);
                    const matched = matchedPatient || matchedUser;
                    
                    if (matched) {
                        this.recoveryUser = matched;
                        this.renderRecoverStep('verify');
                    } else {
                        const err = document.getElementById('rec-error');
                        err.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> No se encontró ninguna cuenta con ese correo.';
                        err.style.display = 'flex';
                    }
                };
            }
            
        } else if (step === 'verify') {
            modalBody.innerHTML = `
              <div class="auth-rec" style="padding: 0.5rem 0;">
                <div class="auth-rec-head">
                  <span class="auth-rec-ico" style="background: #0066a0;">
                    ${this.recoveryModalIcons.shield}
                  </span>
                  <h3 style="color: #1e293b; font-size: 1.3rem; margin-top: 1rem;">Verificación de Identidad</h3>
                  <p style="color: #64748b; font-size: 0.85rem;">
                    Cuenta encontrada: <strong style="color: #003b69;">${this.recoveryUser.name || 'Usuario'}</strong><br>
                    Para verificar su identidad, ingrese su nombre de usuario
                  </p>
                </div>
                <form id="rec-verify-form" style="margin-top: 1.5rem;">
                  <div class="login-field">
                    <label class="login-label" for="verify-user">Nombre de usuario</label>
                    <input class="login-input" type="text" id="verify-user" placeholder="Ingrese su nombre de usuario" required 
                           style="border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; width:100%; box-sizing:border-box;" />
                  </div>
                  <div id="verify-error" class="auth-msg auth-err" style="display:none; margin-top: 12px;"></div>
                  <button type="submit" class="login-submit-btn" style="width:100%; margin-top: 24px; background: #003b69; border-radius: 12px; padding: 14px; color:white; border:none; cursor:pointer;">
                    VERIFICAR IDENTIDAD
                  </button>
                </form>
              </div>`;
              
            const verifyForm = document.getElementById('rec-verify-form');
            if (verifyForm) {
                verifyForm.onsubmit = (e) => {
                    e.preventDefault();
                    const userIn = document.getElementById('verify-user').value;
                    if (userIn === this.recoveryUser.username || userIn === this.recoveryUser.id) {
                        this.renderRecoverStep('reset');
                    } else {
                        const err = document.getElementById('verify-error');
                        err.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> El nombre de usuario no coincide.';
                        err.style.display = 'flex';
                    }
                };
            }
            
        } else if (step === 'reset') {
            modalBody.innerHTML = `
              <div class="auth-rec" style="padding: 0.5rem 0;">
                <div class="auth-rec-head">
                  <span class="auth-rec-ico" style="background: #f59e0b;">
                    ${this.recoveryModalIcons.key}
                  </span>
                  <h3 style="color: #1e293b; font-size: 1.3rem; margin-top: 1rem;">Nueva Contraseña</h3>
                  <p style="color: #64748b; font-size: 0.85rem;">
                    Establezca una nueva contraseña para <strong style="color: #003b69;">${this.recoveryUser.name || 'Usuario'}</strong>
                  </p>
                </div>
                <form id="rec-reset-form" style="margin-top: 1.5rem;">
                  <div class="login-field">
                    <label class="login-label" for="new-pass">Nueva contraseña</label>
                    <div class="auth-pw-wrap" style="position:relative;">
                      <input class="login-input" type="password" id="new-pass" placeholder="Mínimo 6 caracteres" required minlength="6" 
                             style="border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; padding-right: 2.5rem; width:100%; box-sizing:border-box;" />
                      <button type="button" class="auth-eye" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                    </div>
                  </div>
                  <div class="login-field" style="margin-top: 16px;">
                    <label class="login-label" for="confirm-pass">Confirmar contraseña</label>
                    <div class="auth-pw-wrap" style="position:relative;">
                      <input class="login-input" type="password" id="confirm-pass" placeholder="Repita la contraseña" required minlength="6" 
                             style="border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; padding-right: 2.5rem; width:100%; box-sizing:border-box;" />
                      <button type="button" class="auth-eye" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                    </div>
                  </div>
                  <div id="reset-error" class="auth-msg auth-err" style="display:none; margin-top: 12px;"></div>
                  <button type="submit" class="login-submit-btn" style="width:100%; margin-top: 24px; background: #003b69; border-radius: 12px; padding: 14px; color:white; border:none; cursor:pointer;">
                    CAMBIAR CONTRASEÑA
                  </button>
                </form>
              </div>`;
            
            const resetForm = document.getElementById('rec-reset-form');
            if (resetForm) {
                resetForm.onsubmit = (e) => {
                    e.preventDefault();
                    const v1 = document.getElementById('new-pass').value;
                    const v2 = document.getElementById('confirm-pass').value;
                    const err = document.getElementById('reset-error');
                    if (v1 !== v2) {
                        err.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Las contraseñas no coinciden.';
                        err.style.display = 'flex';
                    } else if (v1.length < 6) {
                        err.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> La contraseña debe tener al menos 6 caracteres.';
                        err.style.display = 'flex';
                    } else {
                        if (this.recoveryUser.id) {
                            this.store.update('patients', this.recoveryUser.id, { password: v1 });
                        } else {
                            this.store.update('users', this.recoveryUser.id, { password: v1 });
                        }
                        this.renderRecoverStep('success');
                    }
                };
            }
            
        } else if (step === 'success') {
            modalBody.innerHTML = `
              <div class="auth-rec" style="padding: 1rem 0; text-align: center;">
                <div class="auth-rec-head">
                  <span class="auth-rec-ico auth-ico-ok" style="background: linear-gradient(135deg, #16a34a, #15803d);">
                    ${this.recoveryModalIcons.check}
                  </span>
                  <h3 style="color: #1e293b; font-size: 1.3rem; margin-top: 1rem;">¡Contraseña Actualizada!</h3>
                  <p style="color: #64748b; font-size: 0.9rem; line-height: 1.5;">
                    Su contraseña ha sido cambiada exitosamente.<br>
                    Ya puede iniciar sesión con su nueva contraseña.
                  </p>
                </div>
                <button class="login-submit-btn" id="close-success-btn" 
                        style="width:100%; margin-top: 24px; background: #003b69; border-radius: 12px; padding: 14px; color:white; border:none; cursor:pointer;">
                  VOLVER AL LOGIN
                </button>
              </div>`;
              
            const closeBtn = document.getElementById('close-success-btn');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    const modalOverlay = document.getElementById('recover-modal-overlay');
                    if (modalOverlay) modalOverlay.style.display = 'none';
                    const usernameInput = document.getElementById('login-username');
                    const passwordInput = document.getElementById('login-password');
                    if (usernameInput) usernameInput.value = '';
                    if (passwordInput) passwordInput.value = '';
                    this.recoveryUser = null;
                };
            }
        }
    }

    renderMessages() {
        const root = document.getElementById('messages-list');
        if (!root) return;
        root.innerHTML = '';
        mountNotifications(root, {
            store: this.store,
            user: this.user
        });
    }

    renderProfile() {
        const root = document.getElementById('profile-root');
        if (!root) return;
        root.innerHTML = '';
        mountProfile(root, {
            bus: this.bus,
            store: this.store,
            user: this.user
        });
    }

    renderAreas() {
        const root = document.getElementById('areas-list-container');
        if (!root) return;
        root.innerHTML = '';
        mountAreas(root, {
            bus: this.bus,
            store: this.store,
            user: this.user,
            role: 'patient'
        });
    }

    renderClinical() {
        const root = document.getElementById('clinical-root');
        if (!root) return;
        root.innerHTML = '';
        mountClinical(root, {
            bus: this.bus,
            store: this.store,
            user: this.user,
            role: 'patient'
        });
    }

    renderNewAppointment() {
        const doctors = this.store.get('doctors') || [];
        const patients = this.store.get('patients') || [];
        const areas = this.store.get('areas') || [];
        
        mountNewAppointmentForm({
            store: this.store,
            patientRecord: this.patientRecord,
            user: this.user,
            doctors: doctors,
            patients: patients,
            areas: areas,
            isPatientPortal: true,
            onSave: async (newApt) => {
                newApt.patientId = this.patientRecord.id;
                newApt.createdBy = this.user.id;
                newApt.createdAt = Date.now();
                newApt.status = 'scheduled';
                
                this.store.add('appointments', newApt);
                const dt = new Date(newApt.dateTime);
                const dateStr = dt.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
                const timeStr = dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                await UI.hospitalAlert(`Cita agendada con éxito para el ${dateStr} a las ${timeStr}.`, 'success');
                this.navigate('my-appointments');
            }
        });
    }

    renderMyAppointments(filter = 'all') {
        const all = this.store.get('appointments');
        const mine = all
            .filter(a => a.patientId === this.patientRecord?.id)
            .sort((a, b) => b.dateTime - a.dateTime);

        const tabs = document.querySelectorAll('#my-appointments-tabs .appt-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filter === filter);
            if (tab._listener) {
                tab.removeEventListener('click', tab._listener);
            }
            const handler = () => this.renderMyAppointments(tab.dataset.filter);
            tab.addEventListener('click', handler);
            tab._listener = handler;
        });

        let filtered = mine;
        if (filter === 'scheduled') {
            filtered = mine.filter(a => a.status === 'scheduled' || a.status === 'confirmed');
        } else if (filter === 'completed') {
            filtered = mine.filter(a => a.status === 'completed' || a.status === 'finalized');
        }

        const list = document.getElementById('my-appointments-list');
        if (!list) return;

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="empty-state" style="text-align:center;padding:48px 24px;">
                    <i class="fa-regular fa-calendar-xmark" style="font-size:2.5rem;opacity:0.3;margin-bottom:16px;display:block;"></i>
                    <p style="margin:0 0 8px;color:var(--neutralSecondary);">No hay citas ${filter === 'scheduled' ? 'pendientes' : filter === 'completed' ? 'finalizadas' : 'registradas'}</p>
                    <button onclick="window._patientApp?.navigate('new-appointment')" class="btn-primary" style="margin-top:12px;background:var(--themePrimary);padding:8px 20px;border-radius:20px;font-size:0.75rem;">
                        <i class="fa-solid fa-plus"></i> Agendar cita
                    </button>
                </div>
            `;
            return;
        }

        const statusMap = {
            'scheduled': { label: 'Pendiente', cls: 'status-scheduled' },
            'confirmed': { label: 'Confirmada', cls: 'status-confirmed' },
            'completed': { label: 'Atendida', cls: 'status-completed' },
            'finalized': { label: 'Finalizada', cls: 'status-completed' },
            'cancelled': { label: 'Cancelada', cls: 'status-cancelled' }
        };

        list.innerHTML = filtered.map(apt => {
            const doctor = this.store.find('doctors', apt.doctorId);
            const dt = new Date(apt.dateTime);
            const dateStr = dt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            const timeStr = dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const st = statusMap[apt.status] || { label: apt.status, cls: 'status-scheduled' };
            const canCancel = apt.status === 'scheduled' || apt.status === 'confirmed';

            return `
                <div class="agenda-item my-apt-card" style="flex-direction:column;align-items:flex-start;gap:10px;cursor:pointer;" data-id="${apt.id}">
                    <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
                        <div style="display:flex;gap:10px;align-items:center;">
                            <div class="time-block" style="min-width:60px;text-align:center;">
                                <span class="time">${timeStr}</span>
                                <span class="am-pm">${dateStr}</span>
                            </div>
                            <div>
                                <div style="font-weight:700;font-size:0.9rem;">${doctor?.name?.split(' ')[0] || 'Médico'}</div>
                                <div style="font-size:0.7rem;color:var(--neutralSecondary);">${apt.modality === 'virtual' ? 'Virtual' : 'Presencial'}</div>
                            </div>
                        </div>
                        <span class="status-badge ${st.cls}" style="font-size:0.65rem;padding:3px 10px;">${st.label}</span>
                    </div>
                    ${apt.reason ? `<div style="font-size:0.75rem;color:var(--neutralSecondary);padding-left:70px;">${apt.reason.substring(0, 60)}${apt.reason.length > 60 ? '…' : ''}</div>` : ''}
                    <div style="display:flex;gap:8px;padding-left:70px;">
                        ${canCancel ? `<button class="cancel-apt-btn" data-id="${apt.id}" style="background:#fee2e2;color:#dc2626;border:none;border-radius:20px;padding:5px 12px;font-size:0.7rem;font-weight:600;cursor:pointer;">Cancelar</button>` : ''}
                        <button class="view-apt-btn" data-id="${apt.id}" style="background:#f1f5f9;color:#475569;border:none;border-radius:20px;padding:5px 12px;font-size:0.7rem;font-weight:600;cursor:pointer;">Ver detalles</button>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.view-apt-btn').forEach(btn => {
            if (btn._listener) {
                btn.removeEventListener('click', btn._listener);
            }
            const handler = (e) => {
                e.stopPropagation();
                this.showAppointmentDetail(btn.dataset.id);
            };
            btn.addEventListener('click', handler);
            btn._listener = handler;
        });
        
        list.querySelectorAll('.cancel-apt-btn').forEach(btn => {
            if (btn._listener) {
                btn.removeEventListener('click', btn._listener);
            }
            const handler = async (e) => {
                e.stopPropagation();
                const aptId = btn.dataset.id;
                const apt = this.store.find('appointments', aptId);
                const fecha = new Date(apt.dateTime).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
                if (await UI.hospitalConfirm(`¿Cancelar la cita del ${fecha}?`, 'danger')) {
                    this.store.update('appointments', aptId, {
                        status: 'cancelled',
                        cancelledAt: Date.now(),
                        cancelledBy: this.user.id
                    });
                    this.renderMyAppointments(filter);
                }
            };
            btn.addEventListener('click', handler);
            btn._listener = handler;
        });
        
        list.querySelectorAll('.my-apt-card').forEach(card => {
            if (card._listener) {
                card.removeEventListener('click', card._listener);
            }
            const handler = (e) => {
                if (!e.target.closest('button')) {
                    const aptId = card.dataset.id;
                    if (aptId) this.showAppointmentDetail(aptId);
                }
            };
            card.addEventListener('click', handler);
            card._listener = handler;
        });
    }
    
    async showAppointmentDetail(appointmentId) {
        const apt = this.store.find('appointments', appointmentId);
        if (!apt) return;
        
        const doctor = this.store.find('doctors', apt.doctorId);
        const area = apt.areaId ? this.store.find('areas', apt.areaId) : null;
        const consultorio = apt.consultorioId ? this.store.find('consultorios', apt.consultorioId) : null;
        
        const dt = new Date(apt.dateTime);
        const dateStr = dt.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        const timeStr = dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        
        const statusMap = {
            'scheduled': { label: 'Pendiente', color: '#d97706', icon: 'fa-clock' },
            'confirmed': { label: 'Confirmada', color: '#2563eb', icon: 'fa-circle-check' },
            'completed': { label: 'Completada', color: '#16a34a', icon: 'fa-circle-check' },
            'finalized': { label: 'Finalizada', color: '#16a34a', icon: 'fa-flag-checkered' },
            'cancelled': { label: 'Cancelada', color: '#dc2626', icon: 'fa-ban' }
        };
        const st = statusMap[apt.status] || { label: apt.status, color: '#64748b', icon: 'fa-circle' };
        
        const canCancel = apt.status === 'scheduled' || apt.status === 'confirmed';
        
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;';
        
        modal.innerHTML = `
            <div style="background:#fff;border-radius:24px 24px 0 0;max-height:85vh;width:100%;overflow-y:auto;animation:slideUp 0.3s cubic-bezier(0.4,0,0.2,1);">
                <div style="background:${st.color};padding:20px 20px 16px;border-radius:24px 24px 0 0;position:relative;">
                    <div style="width:40px;height:4px;background:rgba(255,255,255,0.3);border-radius:4px;margin:0 auto 12px;"></div>
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <div style="flex:1;">
                            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                                <i class="fa-solid ${st.icon}" style="color:#fff;background:rgba(255,255,255,0.2);padding:6px;border-radius:50%;font-size:0.8rem;"></i>
                                <span style="color:rgba(255,255,255,0.9);font-size:0.75rem;font-weight:600;">${st.label}</span>
                            </div>
                            <div style="color:#fff;font-size:1.3rem;font-weight:800;">${timeStr}</div>
                            <div style="color:rgba(255,255,255,0.85);font-size:0.8rem;margin-top:4px;">${dateStr}</div>
                        </div>
                        <button id="close-detail" style="background:rgba(255,255,255,0.2);border:none;border-radius:50%;width:32px;height:32px;color:#fff;cursor:pointer;">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
                
                <div style="padding:20px;">
                    <div style="margin-bottom:16px;">
                        <div style="font-size:0.7rem;font-weight:800;color:var(--themePrimary);text-transform:uppercase;margin-bottom:8px;">
                            <i class="fa-solid fa-user-doctor"></i> Médico
                        </div>
                        <div style="background:#f8fafc;border-radius:12px;padding:12px;">
                            <div style="font-weight:700;font-size:0.95rem;">${doctor?.name || '—'}</div>
                            <div style="font-size:0.75rem;color:#64748b;">${doctor?.specialty || 'Medicina General'}</div>
                            ${area ? `<div style="font-size:0.75rem;color:#64748b;margin-top:4px;"><i class="fa-solid fa-building"></i> ${area.name}</div>` : ''}
                            ${consultorio ? `<div style="font-size:0.75rem;color:#64748b;"><i class="fa-solid fa-door-open"></i> ${consultorio.name}</div>` : ''}
                        </div>
                    </div>
                    
                    <div style="margin-bottom:16px;">
                        <div style="font-size:0.7rem;font-weight:800;color:var(--themePrimary);text-transform:uppercase;margin-bottom:8px;">
                            <i class="fa-solid fa-clipboard-list"></i> Detalles
                        </div>
                        <div style="background:#f8fafc;border-radius:12px;padding:12px;">
                            <div style="margin-bottom:8px;">
                                <div style="font-size:0.7rem;color:#64748b;">Modalidad</div>
                                <div style="font-weight:600;font-size:0.85rem;">
                                    ${apt.modality === 'virtual' ? '<i class="fa-solid fa-video"></i> Virtual / Telemedicina' : '<i class="fa-solid fa-hospital"></i> Presencial'}
                                </div>
                            </div>
                            ${apt.reason ? `
                            <div style="margin-bottom:8px;">
                                <div style="font-size:0.7rem;color:#64748b;">Motivo</div>
                                <div style="font-size:0.85rem;">${apt.reason}</div>
                            </div>
                            ` : ''}
                            ${apt.notes ? `
                            <div>
                                <div style="font-size:0.7rem;color:#64748b;">Notas</div>
                                <div style="font-size:0.85rem;">${apt.notes}</div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${apt.modality === 'virtual' && apt.virtualLink ? `
                    <div style="margin-bottom:16px;">
                        <a href="${apt.virtualLink}" target="_blank" 
                           style="display:flex;align-items:center;justify-content:center;gap:8px;
                                  background:var(--themePrimary);color:#fff;border-radius:12px;
                                  padding:14px;text-decoration:none;font-weight:700;">
                            <i class="fa-solid fa-video"></i> Unirse a la Reunión Virtual
                        </a>
                    </div>
                    ` : ''}
                    
                    <div style="display:flex;gap:12px;margin-top:8px;">
                        ${canCancel ? `
                        <button id="cancel-appointment" style="flex:1;background:#fee2e2;color:#dc2626;border:1px solid #fecaca;
                                border-radius:12px;padding:14px;font-weight:700;font-size:0.85rem;cursor:pointer;">
                            <i class="fa-solid fa-ban"></i> Cancelar Cita
                        </button>
                        ` : ''}
                        <button id="close-detail-btn" style="flex:1;background:#f1f5f9;color:#475569;border:none;
                                border-radius:12px;padding:14px;font-weight:700;font-size:0.85rem;cursor:pointer;">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeModal = () => {
            const sheet = modal.querySelector('div');
            if (sheet) sheet.style.animation = 'slideDown 0.25s ease forwards';
            setTimeout(() => modal.remove(), 250);
        };
        
        modal.querySelector('#close-detail')?.addEventListener('click', closeModal);
        modal.querySelector('#close-detail-btn')?.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
        
        modal.querySelector('#cancel-appointment')?.addEventListener('click', async () => {
            const fecha = new Date(apt.dateTime).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
            if (await UI.hospitalConfirm(`¿Cancelar la cita del ${fecha}?`, 'danger')) {
                this.store.update('appointments', apt.id, {
                    status: 'cancelled',
                    cancelledAt: Date.now(),
                    cancelledBy: this.user.id
                });
                closeModal();
                this.renderMyAppointments();
            }
        });
    }
}

window.app = new HospitalApp();
window._patientApp = window.app;

document.addEventListener('DOMContentLoaded', () => window.app.init());