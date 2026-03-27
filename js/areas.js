/**
 * areas.js - Módulo de Áreas Médicas para Pacientes
 * Solo lectura, con visualización de médicos por área
 */

export function mountAreas(root, { bus, store, user, role }) {
    const state = {
        areas: [],
        filters: {
            search: ''
        },
        currentPage: 1,
        itemsPerPage: 10
    };

    let elements = {};

    function init() {
        render();
        setupEventListeners();
        loadAreas();

        const unsubscribe = store.subscribe('areas', () => {
            loadAreas();
        });

        return unsubscribe;
    }

    function loadAreas() {
        let areas = store.get('areas') || [];
        areas = applyFilters(areas);
        areas.sort((a, b) => {
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        state.areas = areas;
        renderAreasList();
        updateStats();
    }

    function applyFilters(areas) {
        return areas.filter(area => {
            if (state.filters.search) {
                const searchTerm = state.filters.search.toLowerCase();
                const statusText = area.isActive ? 'activo active' : 'inactivo inactive';
                const searchFields = [
                    area.name,
                    area.code,
                    area.description,
                    area.location,
                    statusText
                ].filter(Boolean).join(' ').toLowerCase();
                if (!searchFields.includes(searchTerm)) return false;
            }
            return true;
        });
    }

    function getAreaStats(areaId) {
        const doctors = store.get('doctors') || [];
        const appointments = store.get('appointments') || [];
        const today = new Date();
        const thisMonth = today.getMonth();
        const thisYear = today.getFullYear();

        const areaDoctors = doctors.filter(d => d.areaId === areaId);
        const areaAppointments = appointments.filter(a => a.areaId === areaId);

        return {
            totalDoctors: areaDoctors.length,
            totalAppointments: areaAppointments.length,
            todayAppointments: areaAppointments.filter(a => {
                const appointmentDate = new Date(a.dateTime);
                return appointmentDate.toDateString() === today.toDateString();
            }).length,
            monthAppointments: areaAppointments.filter(a => {
                const appointmentDate = new Date(a.dateTime);
                return appointmentDate.getMonth() === thisMonth &&
                    appointmentDate.getFullYear() === thisYear;
            }).length
        };
    }

    function getParentAreaName(parentId) {
        if (!parentId) return null;
        const parentArea = store.find('areas', parentId);
        return parentArea ? parentArea.name : 'Área eliminada';
    }

    function render() {
        root.innerHTML = `
            <style>
                .area-card-patient {
                    background: #fff;
                    border-radius: 16px;
                    padding: 16px;
                    margin-bottom: 12px;
                    border: 1px solid #e2e8f0;
                    transition: all 0.2s ease;
                    cursor: pointer;
                }
                .area-card-patient:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(0,0,0,0.08);
                    border-color: var(--themePrimary);
                }
                .area-icon-patient {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    flex-shrink: 0;
                }
                .area-stats-patient {
                    display: flex;
                    gap: 12px;
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid #f1f5f9;
                }
                .area-stat-patient {
                    flex: 1;
                    text-align: center;
                }
                .area-stat-value-patient {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--themePrimary);
                }
                .area-stat-label-patient {
                    font-size: 0.65rem;
                    color: #64748b;
                    text-transform: uppercase;
                    font-weight: 600;
                }
                .doctor-list-modal {
                    max-height: 60vh;
                    overflow-y: auto;
                }
                .doctor-item-patient {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    border-bottom: 1px solid #f1f5f9;
                    transition: background 0.2s;
                }
                .doctor-item-patient:last-child {
                    border-bottom: none;
                }
                .doctor-item-patient:hover {
                    background: #f8fafc;
                }
                .doctor-avatar-patient {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: var(--themeLighter);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 1rem;
                    color: var(--themePrimary);
                    flex-shrink: 0;
                }
                .doctor-info-patient {
                    flex: 1;
                }
                .doctor-name-patient {
                    font-weight: 700;
                    font-size: 0.9rem;
                    color: #1e293b;
                }
                .doctor-specialty-patient {
                    font-size: 0.7rem;
                    color: #64748b;
                    margin-top: 2px;
                }
                .doctor-schedule-patient {
                    font-size: 0.65rem;
                    color: #94a3b8;
                    margin-top: 2px;
                }
                .search-input-wrapper-patient {
                    position: relative;
                    width: 100%;
                    margin-bottom: 12px;
                }
                .search-input-patient {
                    width: 100%;
                    padding: 12px 12px 12px 40px;
                    border-radius: 20px;
                    border: 1px solid #e2e8f0;
                    font-size: 0.9rem;
                    outline: none;
                    transition: all 0.2s;
                }
                .search-input-patient:focus {
                    border-color: var(--themePrimary);
                    box-shadow: 0 0 0 3px rgba(0, 59, 105, 0.1);
                }
                .search-icon-patient {
                    position: absolute;
                    left: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94a3b8;
                }
                .pagination-patient {
                    display: flex;
                    justify-content: center;
                    gap: 8px;
                    margin-top: 16px;
                    padding: 12px 0;
                }
                .page-btn-patient {
                    padding: 6px 12px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    background: #fff;
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .page-btn-patient.active {
                    background: var(--themePrimary);
                    color: #fff;
                    border-color: var(--themePrimary);
                }
                .page-btn-patient:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .empty-state-patient {
                    text-align: center;
                    padding: 48px 24px;
                    color: #64748b;
                }
            </style>

            <div class="areas-module-patient">
                <!-- Barra de búsqueda -->
                <div class="search-input-wrapper-patient">
                    <i class="fa-solid fa-magnifying-glass search-icon-patient"></i>
                    <input type="text" class="search-input-patient" id="areas-search-patient" 
                           placeholder="Buscar área médica..." value="${state.filters.search}">
                </div>

                <!-- Lista de áreas -->
                <div id="areas-list-patient"></div>

                <!-- Paginación -->
                <div id="pagination-patient" class="pagination-patient"></div>
            </div>
        `;

        captureElements();
        loadAreas();
    }

    function captureElements() {
        elements = {
            areasList: root.querySelector('#areas-list-patient'),
            pagination: root.querySelector('#pagination-patient'),
            searchInput: root.querySelector('#areas-search-patient')
        };
    }

    function renderAreasList() {
        if (!elements.areasList) return;

        const startIndex = (state.currentPage - 1) * state.itemsPerPage;
        const endIndex = startIndex + state.itemsPerPage;
        const paginatedAreas = state.areas.slice(startIndex, endIndex);

        if (paginatedAreas.length === 0) {
            elements.areasList.innerHTML = `
                <div class="empty-state-patient">
                    <i class="fa-regular fa-building" style="font-size: 2rem; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
                    <p>No se encontraron áreas médicas</p>
                </div>
            `;
            elements.pagination.innerHTML = '';
            return;
        }

        const typeNames = { 
            clinical: 'Clínica', 
            diagnostic: 'Diagnóstico', 
            surgical: 'Quirúrgica', 
            administrative: 'Admin', 
            support: 'Soporte' 
        };

        const rows = paginatedAreas.map(area => {
            const stats = getAreaStats(area.id);
            const parentName = getParentAreaName(area.parentId);

            return `
                <div class="area-card-patient" data-id="${area.id}" data-name="${area.name}">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="area-icon-patient" style="background: ${area.color || '#2196F3'}20; color: ${area.color || '#2196F3'};">
                            <i class="fa-solid fa-building"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: 1rem; color: #1e293b;">${area.name}</div>
                            <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">
                                ${area.code || 'Sin código'} • ${typeNames[area.type] || 'Clínica'}
                                ${parentName ? ` • Subárea de ${parentName}` : ''}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span style="background: ${area.isActive ? '#dcfce7' : '#fee2e2'}; color: ${area.isActive ? '#16a34a' : '#dc2626'}; 
                                         padding: 4px 8px; border-radius: 20px; font-size: 0.65rem; font-weight: 600;">
                                ${area.isActive ? 'Activa' : (area.status === 'maintenance' ? 'Mantenimiento' : 'Inactiva')}
                            </span>
                        </div>
                    </div>
                    
                    ${area.location ? `
                    <div style="font-size: 0.7rem; color: #64748b; margin-top: 8px;">
                        <i class="fa-solid fa-location-dot"></i> ${area.location}
                    </div>
                    ` : ''}
                    
                    ${area.description ? `
                    <div style="font-size: 0.75rem; color: #475569; margin-top: 8px; line-height: 1.4;">
                        ${area.description.length > 100 ? area.description.substring(0, 100) + '…' : area.description}
                    </div>
                    ` : ''}
                    
                    <div class="area-stats-patient">
                        <div class="area-stat-patient">
                            <div class="area-stat-value-patient">${stats.totalDoctors}</div>
                            <div class="area-stat-label-patient">Médicos</div>
                        </div>
                        <div class="area-stat-patient">
                            <div class="area-stat-value-patient">${stats.monthAppointments}</div>
                            <div class="area-stat-label-patient">Citas/mes</div>
                        </div>
                        <div class="area-stat-patient">
                            <div class="area-stat-value-patient">${stats.todayAppointments}</div>
                            <div class="area-stat-label-patient">Hoy</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 12px; text-align: right;">
                        <button class="view-doctors-btn" data-id="${area.id}" data-name="${area.name}"
                                style="background: transparent; border: 1px solid var(--themePrimary); color: var(--themePrimary);
                                       padding: 6px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; cursor: pointer;">
                            <i class="fa-solid fa-user-doctor"></i> Ver equipo médico
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        elements.areasList.innerHTML = rows;
        renderPagination();

        // Event listeners para los botones de ver médicos
        elements.areasList.querySelectorAll('.view-doctors-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const areaId = btn.dataset.id;
                const areaName = btn.dataset.name;
                const area = store.find('areas', areaId);
                if (area) {
                    showDoctorsModal(area);
                }
            });
        });

        // Click en la tarjeta para ver detalles del área
        elements.areasList.querySelectorAll('.area-card-patient').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.view-doctors-btn')) {
                    const areaId = card.dataset.id;
                    const area = store.find('areas', areaId);
                    if (area) showAreaDetail(area);
                }
            });
        });
    }

    function renderPagination() {
        if (!elements.pagination) return;

        const totalPages = Math.ceil(state.areas.length / state.itemsPerPage);

        if (totalPages <= 1) {
            elements.pagination.innerHTML = '';
            return;
        }

        let buttons = '';
        
        // Botón anterior
        buttons += `<button class="page-btn-patient" data-page="prev" ${state.currentPage === 1 ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>`;
        
        // Números de página
        const maxVisible = 5;
        let startPage = Math.max(1, state.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            buttons += `<button class="page-btn-patient ${state.currentPage === i ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        
        // Botón siguiente
        buttons += `<button class="page-btn-patient" data-page="next" ${state.currentPage === totalPages ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>`;
        
        elements.pagination.innerHTML = buttons;
        
        // Event listeners
        elements.pagination.querySelectorAll('.page-btn-patient').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (page === 'prev' && state.currentPage > 1) {
                    state.currentPage--;
                    renderAreasList();
                } else if (page === 'next' && state.currentPage < totalPages) {
                    state.currentPage++;
                    renderAreasList();
                } else if (!isNaN(parseInt(page))) {
                    state.currentPage = parseInt(page);
                    renderAreasList();
                }
            });
        });
    }

    function showDoctorsModal(area) {
        const doctors = store.get('doctors') || [];
        const areaDoctors = doctors.filter(d => 
            d.areaId === area.id && d.isActive !== false
        );

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease;';
        
        const doctorsHtml = areaDoctors.length > 0 ? areaDoctors.map(d => `
            <div class="doctor-item-patient">
                <div class="doctor-avatar-patient">
                    ${d.name.charAt(0).toUpperCase()}
                </div>
                <div class="doctor-info-patient">
                    <div class="doctor-name-patient">${d.name}</div>
                    <div class="doctor-specialty-patient">${d.specialty || 'Médico Especialista'}</div>
                    <div class="doctor-schedule-patient">
                        <i class="fa-regular fa-clock"></i> ${d.scheduleStart || '08:00'} - ${d.scheduleEnd || '17:00'}
                        ${d.consultationDuration ? ` • ${d.consultationDuration} min/consulta` : ''}
                    </div>
                </div>
                <div>
                    <span class="badge ${d.isActive ? 'badge-success' : 'badge-danger'}" style="font-size:0.65rem; padding:2px 8px;">
                        ${d.isActive ? 'Disponible' : 'No disponible'}
                    </span>
                </div>
            </div>
        `).join('') : `
            <div style="text-align: center; padding: 40px; color: #64748b;">
                <i class="fa-solid fa-user-slash" style="font-size: 2rem; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
                <p>No hay médicos asignados actualmente a esta área</p>
            </div>
        `;

        modal.innerHTML = `
            <div style="background:#fff;border-radius:20px;width:90%;max-width:480px;max-height:80vh;overflow:hidden;animation:slideUp 0.3s ease;">
                <div style="background:var(--themePrimary);padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <h3 style="margin:0;color:#fff;font-size:1rem;font-weight:700;">${area.name}</h3>
                        <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:0.7rem;">Equipo Médico</p>
                    </div>
                    <button id="close-doctors-modal" style="background:rgba(255,255,255,0.2);border:none;border-radius:50%;width:32px;height:32px;color:#fff;cursor:pointer;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="doctor-list-modal" style="padding:12px 16px;max-height:60vh;overflow-y:auto;">
                    ${doctorsHtml}
                </div>
                <div style="padding:12px 16px;border-top:1px solid #f1f5f9;text-align:center;">
                    <button id="close-modal-footer" style="background:#f1f5f9;border:none;padding:10px 20px;border-radius:12px;font-weight:600;cursor:pointer;">
                        Cerrar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeModal = () => modal.remove();
        modal.querySelector('#close-doctors-modal')?.addEventListener('click', closeModal);
        modal.querySelector('#close-modal-footer')?.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    }

    function showAreaDetail(area) {
        const stats = getAreaStats(area.id);
        const subAreas = state.areas.filter(a => a.parentId === area.id);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease;';
        
        const typeNames = { clinical: 'Clínica', diagnostic: 'Diagnóstico', surgical: 'Quirúrgica', administrative: 'Administrativa', support: 'Soporte' };
        
        modal.innerHTML = `
            <div style="background:#fff;border-radius:20px;width:90%;max-width:500px;max-height:85vh;overflow-y:auto;animation:slideUp 0.3s ease;">
                <div style="background:${area.color || 'var(--themePrimary)'};padding:20px;text-align:center;">
                    <div style="width:60px;height:60px;background:rgba(255,255,255,0.2);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">
                        <i class="fa-solid fa-building" style="font-size:1.8rem;color:#fff;"></i>
                    </div>
                    <h3 style="margin:0;color:#fff;font-size:1.2rem;">${area.name}</h3>
                    <p style="margin:4px 0 0;color:rgba(255,255,255,0.9);font-size:0.75rem;">${area.code || 'Sin código'} • ${typeNames[area.type] || 'Clínica'}</p>
                </div>
                
                <div style="padding:20px;">
                    ${area.description ? `
                    <div style="margin-bottom:16px;">
                        <div style="font-size:0.7rem;font-weight:700;color:var(--themePrimary);text-transform:uppercase;margin-bottom:8px;">Descripción</div>
                        <p style="margin:0;font-size:0.85rem;color:#475569;line-height:1.5;">${area.description}</p>
                    </div>
                    ` : ''}
                    
                    ${area.location ? `
                    <div style="margin-bottom:16px;">
                        <div style="font-size:0.7rem;font-weight:700;color:var(--themePrimary);text-transform:uppercase;margin-bottom:8px;">Ubicación</div>
                        <p style="margin:0;font-size:0.85rem;color:#475569;"><i class="fa-solid fa-location-dot"></i> ${area.location}</p>
                    </div>
                    ` : ''}
                    
                    <div style="margin-bottom:16px;">
                        <div style="font-size:0.7rem;font-weight:700;color:var(--themePrimary);text-transform:uppercase;margin-bottom:8px;">Estadísticas</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                            <div style="background:#f8fafc;border-radius:12px;padding:12px;text-align:center;">
                                <div style="font-size:1.2rem;font-weight:800;color:var(--themePrimary);">${stats.totalDoctors}</div>
                                <div style="font-size:0.65rem;color:#64748b;">Médicos</div>
                            </div>
                            <div style="background:#f8fafc;border-radius:12px;padding:12px;text-align:center;">
                                <div style="font-size:1.2rem;font-weight:800;color:var(--themePrimary);">${stats.monthAppointments}</div>
                                <div style="font-size:0.65rem;color:#64748b;">Citas este mes</div>
                            </div>
                            <div style="background:#f8fafc;border-radius:12px;padding:12px;text-align:center;">
                                <div style="font-size:1.2rem;font-weight:800;color:var(--themePrimary);">${stats.todayAppointments}</div>
                                <div style="font-size:0.65rem;color:#64748b;">Citas hoy</div>
                            </div>
                            <div style="background:#f8fafc;border-radius:12px;padding:12px;text-align:center;">
                                <div style="font-size:1.2rem;font-weight:800;color:var(--themePrimary);">${subAreas.length}</div>
                                <div style="font-size:0.65rem;color:#64748b;">Sub-áreas</div>
                            </div>
                        </div>
                    </div>
                    
                    ${subAreas.length > 0 ? `
                    <div style="margin-bottom:16px;">
                        <div style="font-size:0.7rem;font-weight:700;color:var(--themePrimary);text-transform:uppercase;margin-bottom:8px;">Sub-áreas</div>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;">
                            ${subAreas.map(sa => `
                                <span style="background:#f1f5f9;padding:4px 12px;border-radius:20px;font-size:0.75rem;color:#475569;">
                                    ${sa.name}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div style="margin-top:20px;">
                        <button id="view-doctors-from-detail" style="width:100%;background:var(--themePrimary);color:#fff;border:none;border-radius:12px;padding:12px;font-weight:700;cursor:pointer;">
                            <i class="fa-solid fa-user-doctor"></i> Ver equipo médico (${stats.totalDoctors})
                        </button>
                    </div>
                </div>
                
                <div style="padding:12px 20px 20px;text-align:center;">
                    <button id="close-detail-modal" style="background:#f1f5f9;border:none;padding:10px 24px;border-radius:12px;font-weight:600;cursor:pointer;">
                        Cerrar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeModal = () => modal.remove();
        modal.querySelector('#close-detail-modal')?.addEventListener('click', closeModal);
        modal.querySelector('#view-doctors-from-detail')?.addEventListener('click', () => {
            closeModal();
            showDoctorsModal(area);
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    }

    function updateStats() {
        // No se muestran stats globales en la vista de áreas para pacientes
    }

    function setupEventListeners() {
        function debounce(func, wait) {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }

        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', debounce((e) => {
                state.filters.search = e.target.value;
                state.currentPage = 1;
                loadAreas();
            }, 300));
        }
    }

    const unsubscribe = init();

    return {
        refresh: loadAreas,
        destroy() {
            if (unsubscribe) unsubscribe();
        }
    };
}