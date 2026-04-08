// js/register.js - Módulo de Registro para Pacientes Móvil

export function mountRegister(root, { store, onSuccess }) {
    const state = {
        isLoading: false,
        fieldErrors: {},
        passwordRequirements: {
            minLength: false,
            hasUpperCase: false,
            hasNumber: false,
            hasSpecialChar: false,
        }
    };

    // Validación de teléfono (11 dígitos exactos)
    const isValidPhone = (phone) => /^\d{11}$/.test(phone);

    // Validación de email
    const isValidEmail = (email) => /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(email);

    // Unicidades
    const isEmailUnique = (email) => !store.get('users').some(u => u.email?.toLowerCase() === email.toLowerCase());
    const isUsernameUnique = (username) => !store.get('users').some(u => u.username?.toLowerCase() === username.toLowerCase());
    const isDocNumberUnique = (docNumber) => !store.get('patients').some(p => p.dni === docNumber);

    // Validación de contraseña
    const checkPasswordStrength = (password) => ({
        minLength: password.length >= 8,
        hasUpperCase: /[A-Z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSpecialChar: /[@#$%^&*!]/.test(password),
    });

    // Validación de campo
    const validateField = (fieldName, value, formData = {}) => {
        switch (fieldName) {
            case 'name': 
                if (!value.trim()) return 'El nombre es obligatorio.';
                if (value.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres.';
                break;
            case 'lastName': 
                if (!value.trim()) return 'El apellido es obligatorio.';
                if (value.trim().length < 2) return 'El apellido debe tener al menos 2 caracteres.';
                break;
            case 'docNumber': 
                if (!value.trim()) return 'El número de documento es obligatorio.';
                if (!/^\d+$/.test(value.trim())) return 'Solo números, sin letras ni espacios.';
                if (!isDocNumberUnique(value.trim())) return 'El documento ya está registrado.';
                break;
            case 'birthDate':
                if (!value) return 'La fecha de nacimiento es obligatoria.';
                const age = new Date().getFullYear() - new Date(value).getFullYear();
                if (age < 18) return 'Debe ser mayor de 18 años.';
                if (age > 120) return 'Fecha de nacimiento inválida.';
                break;
            case 'gender':
                if (!value) return 'Seleccione su sexo.';
                break;
            case 'phone':
                if (!value.trim()) return 'El teléfono es obligatorio.';
                if (!isValidPhone(value.trim())) return 'Formato inválido (deben ser 11 dígitos).';
                break;
            case 'email':
                if (!value.trim()) return 'El correo es obligatorio.';
                if (!isValidEmail(value.trim())) return 'Formato de correo inválido.';
                if (!isEmailUnique(value.trim())) return 'El correo ya está registrado.';
                break;
            case 'username':
                if (!value.trim()) return 'El nombre de usuario es obligatorio.';
                if (value.trim().length < 3) return 'Mínimo 3 caracteres.';
                if (!/^[a-zA-Z0-9_]+$/.test(value.trim())) return 'Solo letras, números y guión bajo.';
                if (!isUsernameUnique(value.trim())) return 'El usuario ya está en uso.';
                break;
            case 'password':
                if (!value) return 'La contraseña es obligatoria.';
                const req = checkPasswordStrength(value);
                if (!req.minLength) return 'Mínimo 8 caracteres.';
                if (!req.hasUpperCase) return 'Al menos una mayúscula.';
                if (!req.hasNumber) return 'Al menos un número.';
                if (!req.hasSpecialChar) return 'Al menos un carácter especial (@#$%^&*!).';
                break;
            case 'confirmPassword':
                if (!value) return 'Confirme su contraseña.';
                if (formData.password !== value) return 'Las contraseñas no coinciden.';
                break;
            case 'consent':
                if (!value) return 'Debe aceptar los términos.';
                break;
        }
        return '';
    };

    // Mostrar modal de consentimiento informado completo
    const showConsentModal = () => {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;';
        
        modal.innerHTML = `
            <div style="background:#fff;border-radius:24px;width:100%;max-width:500px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;animation:slideUpModal 0.3s ease;">
                <div style="background:linear-gradient(135deg,var(--themeDarker),var(--themePrimary));padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;color:#fff;font-size:1rem;display:flex;align-items:center;gap:8px;">
                        <i class="fa-solid fa-file-signature"></i> Consentimiento Informado
                    </h3>
                    <button id="close-consent-modal" style="background:rgba(255,255,255,0.2);border:none;border-radius:50%;width:32px;height:32px;color:#fff;cursor:pointer;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div style="padding:20px;overflow-y:auto;flex:1;">
                    <div style="margin-bottom:20px;">
                        <h4 style="color:var(--themePrimary);margin-bottom:12px;font-size:0.9rem;">AUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS PERSONALES Y CLÍNICOS</h4>
                        <p style="font-size:0.85rem;line-height:1.5;color:#334155;margin-bottom:16px;">
                            Yo, en mi carácter de paciente, autorizo de manera voluntaria, expresa e informada al 
                            <strong>Hospital Universitario Manuel Núñez Tovar (HUMNT)</strong>, 
                            para que, a través de su personal médico, administrativo y asistencial, pueda recopilar, 
                            almacenar, procesar y utilizar mis datos personales y clínicos con las siguientes finalidades:
                        </p>
                        <ul style="margin:16px 0;padding-left:20px;font-size:0.85rem;line-height:1.5;color:#334155;">
                            <li>Registro en la historia clínica electrónica.</li>
                            <li>Atención médica, diagnósticos, tratamientos y seguimiento.</li>
                            <li>Gestión de citas, recordatorios y comunicaciones sobre mi salud.</li>
                            <li>Facturación, cobro de servicios médicos y gestión administrativa.</li>
                            <li>Investigación científica y docencia (previa autorización adicional).</li>
                            <li>Cumplimiento de obligaciones legales y sanitarias.</li>
                        </ul>
                        <p style="font-size:0.85rem;line-height:1.5;color:#334155;">
                            Declaro que he sido informado sobre mis derechos como paciente, incluyendo el acceso, 
                            rectificación, cancelación y oposición (derechos ARCO) sobre mis datos personales, 
                            así como la posibilidad de revocar este consentimiento en cualquier momento.
                        </p>
                        <p style="font-size:0.85rem;line-height:1.5;color:#334155;margin-top:16px;">
                            <strong>Vigencia:</strong> El presente consentimiento tendrá vigencia mientras mantenga 
                            mi condición de paciente activo en el hospital.
                        </p>
                    </div>
                </div>
                <div style="padding:16px 20px;border-top:1px solid #e2e8f0;display:flex;gap:12px;">
                    <button id="reject-consent" style="flex:1;padding:12px;border-radius:12px;font-weight:600;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;cursor:pointer;">
                        <i class="fa-solid fa-times"></i> Rechazar
                    </button>
                    <button id="accept-consent" style="flex:1;padding:12px;border-radius:12px;font-weight:700;background:var(--themePrimary);color:#fff;border:none;cursor:pointer;">
                        <i class="fa-solid fa-check"></i> Aceptar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeModal = () => modal.remove();
        
        modal.querySelector('#close-consent-modal')?.addEventListener('click', closeModal);
        modal.querySelector('#reject-consent')?.addEventListener('click', closeModal);
        modal.querySelector('#accept-consent')?.addEventListener('click', () => {
            const consentCheckbox = document.getElementById('reg-consent');
            if (consentCheckbox) {
                consentCheckbox.checked = true;
                const event = new Event('change', { bubbles: true });
                consentCheckbox.dispatchEvent(event);
            }
            closeModal();
        });
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    };

    const registerPatient = async (formData) => {
        state.isLoading = true;
        const btn = root.querySelector('#register-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';
        }

        try {
            // Crear paciente
            const newPatient = await store.add('patients', {
                name: `${formData.name.trim()} ${formData.lastName.trim()}`,
                docType: formData.docType,
                dni: formData.docNumber.trim(),
                birthDate: formData.birthDate,
                gender: formData.gender === 'Femenino' ? 'F' : formData.gender === 'Masculino' ? 'M' : 'O',
                phone: formData.phone.trim(),
                email: formData.email.trim(),
                username: formData.username.trim(),
                password: formData.password,
                isActive: true,
                allergies: [],
                consent: { granted: true, date: Date.now(), scope: 'Tratamiento de datos personales' },
                createdAt: Date.now(),
            });

            // Crear usuario asociado
            const newUser = await store.add('users', {
                username: formData.username.trim(),
                password: formData.password,
                name: `${formData.name.trim()} ${formData.lastName.trim()}`,
                role: 'patient',
                email: formData.email.trim(),
                patientId: newPatient.id,
                isActive: true,
            });

            // Mostrar éxito y redirigir
            const successMsg = document.createElement('div');
            successMsg.className = 'alert alert-success';
            successMsg.style.cssText = 'background:#d1fae5;color:#065f46;padding:12px;border-radius:12px;text-align:center;margin-bottom:16px;';
            successMsg.innerHTML = '<i class="fa-solid fa-circle-check"></i> ¡Registro exitoso! Redirigiendo...';
            const formContainer = root.querySelector('#register-form-container');
            const oldMsg = formContainer.querySelector('.alert');
            if (oldMsg) oldMsg.remove();
            formContainer.insertBefore(successMsg, formContainer.firstChild);

            setTimeout(() => {
                if (onSuccess) onSuccess(newUser);
            }, 2000);

        } catch (error) {
            console.error('Error en registro:', error);
            const errorMsg = document.createElement('div');
            errorMsg.className = 'alert alert-danger';
            errorMsg.style.cssText = 'background:#fee2e2;color:#dc2626;padding:12px;border-radius:12px;text-align:center;margin-bottom:16px;';
            errorMsg.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Error al registrar. Intente de nuevo.';
            const formContainer = root.querySelector('#register-form-container');
            const oldMsg = formContainer.querySelector('.alert');
            if (oldMsg) oldMsg.remove();
            formContainer.insertBefore(errorMsg, formContainer.firstChild);
        } finally {
            state.isLoading = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Registrarse';
            }
        }
    };

    function render() {
        root.innerHTML = `
            <div style="min-height:100vh;background:linear-gradient(135deg,#e2e8f0,#f1f5f9);">
                <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:0;min-height:100vh;display:flex;flex-direction:column;">
                    <div style="background:linear-gradient(135deg,var(--themeDarker),var(--themePrimary));padding:20px 16px;text-align:center;">
                        <h2 style="margin:0;color:#fff;font-size:1.2rem;">Registro de Paciente</h2>
                        <p style="margin:5px 0 0;color:rgba(255,255,255,0.9);font-size:0.75rem;">Complete sus datos para crear su cuenta</p>
                    </div>
                    
                    <div id="register-form-container" style="padding:20px 16px;flex:1;overflow-y:auto;max-height:calc(100vh - 80px);">
                        <form id="register-form">
                            <!-- Datos Personales -->
                            <div style="margin-bottom:20px;">
                                <h3 style="font-size:0.7rem;color:var(--themePrimary);margin-bottom:12px;font-weight:700;letter-spacing:0.5px;">DATOS PERSONALES</h3>
                                
                                <div class="form-field" style="margin-bottom:16px;">
                                    <input type="text" id="reg-name" class="login-input" placeholder="Nombres completos *" style="width:100%;padding:12px 14px;font-size:0.9rem;border:1.5px solid #e2e8f0;border-radius:12px;">
                                    <div class="error-msg" data-for="reg-name" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                                
                                <div class="form-field" style="margin-bottom:16px;">
                                    <input type="text" id="reg-lastname" class="login-input" placeholder="Apellidos completos *" style="width:100%;padding:12px 14px;font-size:0.9rem;border:1.5px solid #e2e8f0;border-radius:12px;">
                                    <div class="error-msg" data-for="reg-lastname" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                                
                                <div class="form-field" style="margin-bottom:16px;">
                                    <div style="display:flex;gap:10px;">
                                        <select id="reg-doctype" style="width:70px;padding:12px 8px;font-size:0.9rem;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;">
                                            <option value="V">V</option>
                                            <option value="E">E</option>
                                            <option value="P">P</option>
                                            <option value="J">J</option>
                                        </select>
                                        <input type="text" id="reg-docnumber" placeholder="Número de documento *" style="flex:1;padding:12px 14px;font-size:0.9rem;border:1.5px solid #e2e8f0;border-radius:12px;">
                                    </div>
                                    <div class="error-msg" data-for="reg-docnumber" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                                
                                <div class="form-field" style="margin-bottom:16px;">
                                    <input type="date" id="reg-birthdate" style="width:100%;padding:12px 14px;font-size:0.9rem;border:1.5px solid #e2e8f0;border-radius:12px;" max="${new Date().toISOString().split('T')[0]}">
                                    <div class="error-msg" data-for="reg-birthdate" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                                
                                <div class="form-field" style="margin-bottom:16px;">
                                    <select id="reg-gender" style="width:100%;padding:12px 14px;font-size:0.9rem;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;">
                                        <option value="">Sexo *</option>
                                        <option value="Masculino">Masculino</option>
                                        <option value="Femenino">Femenino</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                    <div class="error-msg" data-for="reg-gender" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                            </div>

                            <!-- Contacto -->
                            <div style="margin-bottom:20px;">
                                <h3 style="font-size:0.7rem;color:var(--themePrimary);margin-bottom:12px;font-weight:700;letter-spacing:0.5px;">CONTACTO Y ACCESO</h3>
                                
                                <div class="form-field" style="margin-bottom:16px;">
                                    <input type="tel" id="reg-phone" placeholder="Teléfono (11 dígitos) *" style="width:100%;padding:12px 14px;font-size:0.9rem;border:1.5px solid #e2e8f0;border-radius:12px;">
                                    <div class="error-msg" data-for="reg-phone" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                    <div style="font-size:0.6rem;color:#64748b;margin-top:4px;">Ejemplo: 04121234567</div>
                                </div>
                                
                                <div class="form-field" style="margin-bottom:16px;">
                                    <input type="email" id="reg-email" placeholder="Correo electrónico *" style="width:100%;padding:12px 14px;font-size:0.9rem;border:1.5px solid #e2e8f0;border-radius:12px;">
                                    <div class="error-msg" data-for="reg-email" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                                
                                <div class="form-field" style="margin-bottom:16px;">
                                    <input type="text" id="reg-username" placeholder="Nombre de usuario *" style="width:100%;padding:12px 14px;font-size:0.9rem;border:1.5px solid #e2e8f0;border-radius:12px;">
                                    <div class="error-msg" data-for="reg-username" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                                
                                <div class="form-field" style="margin-bottom:16px;">
                                    <input type="password" id="reg-password" placeholder="Contraseña *" style="width:100%;padding:12px 14px;font-size:0.9rem;border:1.5px solid #e2e8f0;border-radius:12px;">
                                    <div class="error-msg" data-for="reg-password" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                    <div id="password-reqs" style="font-size:0.6rem;margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">
                                        <span id="req-length">✗ 8+ caracteres</span>
                                        <span id="req-upper">✗ Mayúscula</span>
                                        <span id="req-number">✗ Número</span>
                                        <span id="req-special">✗ Especial (@#$%^&*!)</span>
                                    </div>
                                </div>
                                
                                <div class="form-field" style="margin-bottom:16px;">
                                    <input type="password" id="reg-confirm" placeholder="Confirmar contraseña *" style="width:100%;padding:12px 14px;font-size:0.9rem;border:1.5px solid #e2e8f0;border-radius:12px;">
                                    <div class="error-msg" data-for="reg-confirm" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                            </div>

                            <!-- Consentimiento -->
                            <div class="form-field" style="margin-bottom:24px;">
                                <label style="display:flex;align-items:center;gap:8px;font-size:0.75rem;cursor:pointer;">
                                    <input type="checkbox" id="reg-consent" style="width:18px;height:18px;cursor:pointer;">
                                    Acepto el <a href="#" id="show-terms" style="color:var(--themePrimary);text-decoration:none;">consentimiento informado</a>
                                </label>
                                <div class="error-msg" data-for="reg-consent" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                            </div>

                            <!-- Botones -->
                            <div style="display:flex;gap:12px;margin-bottom:30px;">
                                <button type="button" id="cancel-register" class="btn-outline" style="flex:1;padding:14px;border-radius:12px;font-weight:600;font-size:0.9rem;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
                                    <i class="fa-solid fa-arrow-left"></i> Cancelar
                                </button>
                                <button type="submit" id="register-btn" class="btn-primary" style="flex:2;padding:14px;border-radius:12px;font-weight:700;font-size:0.9rem;background:var(--themePrimary);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
                                    <i class="fa-solid fa-user-plus"></i> Registrarse
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        setupEvents();
    }

    function setupEvents() {
        const form = document.getElementById('register-form');
        const fields = {
            name: document.getElementById('reg-name'),
            lastName: document.getElementById('reg-lastname'),
            docType: document.getElementById('reg-doctype'),
            docNumber: document.getElementById('reg-docnumber'),
            birthDate: document.getElementById('reg-birthdate'),
            gender: document.getElementById('reg-gender'),
            phone: document.getElementById('reg-phone'),
            email: document.getElementById('reg-email'),
            username: document.getElementById('reg-username'),
            password: document.getElementById('reg-password'),
            confirm: document.getElementById('reg-confirm'),
            consent: document.getElementById('reg-consent'),
        };

        const getFormData = () => ({
            name: fields.name?.value || '',
            lastName: fields.lastName?.value || '',
            docType: fields.docType?.value || 'V',
            docNumber: fields.docNumber?.value || '',
            birthDate: fields.birthDate?.value || '',
            gender: fields.gender?.value || '',
            phone: fields.phone?.value || '',
            email: fields.email?.value || '',
            username: fields.username?.value || '',
            password: fields.password?.value || '',
            confirmPassword: fields.confirm?.value || '',
            consent: fields.consent?.checked || false,
        });

        const showError = (fieldId, msg) => {
            const field = document.getElementById(fieldId);
            if (!field) return;
            let container = field.closest('.form-field');
            if (!container) {
                container = field.parentElement;
                while (container && !container.classList.contains('form-field')) {
                    container = container.parentElement;
                }
            }
            if (!container) return;
            let errorDiv = container.querySelector(`.error-msg[data-for="${fieldId}"]`);
            if (!errorDiv) {
                errorDiv = container.querySelector('.error-msg');
            }
            if (!errorDiv) {
                errorDiv = document.createElement('div');
                errorDiv.className = 'error-msg';
                errorDiv.setAttribute('data-for', fieldId);
                errorDiv.style.cssText = 'color:#dc2626;font-size:0.7rem;margin-top:4px;';
                container.appendChild(errorDiv);
            }
            errorDiv.textContent = msg;
        };

        const clearError = (fieldId) => {
            const field = document.getElementById(fieldId);
            if (!field) return;
            let container = field.closest('.form-field');
            if (!container) {
                container = field.parentElement;
                while (container && !container.classList.contains('form-field')) {
                    container = container.parentElement;
                }
            }
            if (!container) return;
            const errorDiv = container.querySelector('.error-msg');
            if (errorDiv) errorDiv.textContent = '';
        };

        const validateAll = () => {
            const data = getFormData();
            let isValid = true;
            const fieldsToCheck = [
                { id: 'reg-name', field: 'name' },
                { id: 'reg-lastname', field: 'lastName' },
                { id: 'reg-docnumber', field: 'docNumber' },
                { id: 'reg-birthdate', field: 'birthDate' },
                { id: 'reg-gender', field: 'gender' },
                { id: 'reg-phone', field: 'phone' },
                { id: 'reg-email', field: 'email' },
                { id: 'reg-username', field: 'username' },
                { id: 'reg-password', field: 'password' },
                { id: 'reg-confirm', field: 'confirmPassword' },
                { id: 'reg-consent', field: 'consent' }
            ];
            
            fieldsToCheck.forEach(({ id, field }) => {
                const error = validateField(field, data[field], data);
                if (error) {
                    showError(id, error);
                    isValid = false;
                } else {
                    clearError(id);
                }
            });
            return isValid;
        };

        // Validación en tiempo real
        Object.entries(fields).forEach(([name, field]) => {
            if (!field) return;
            const fieldId = `reg-${name === 'confirm' ? 'confirm' : name}`;
            field.addEventListener('input', () => {
                const data = getFormData();
                const error = validateField(name === 'confirm' ? 'confirmPassword' : name, field.value, data);
                if (error) showError(fieldId, error);
                else clearError(fieldId);
            });
            
            field.addEventListener('blur', () => {
                const data = getFormData();
                const error = validateField(name === 'confirm' ? 'confirmPassword' : name, field.value, data);
                if (error) showError(fieldId, error);
                else clearError(fieldId);
            });
        });

        // Checkbox consentimiento
        if (fields.consent) {
            fields.consent.addEventListener('change', () => {
                const fieldId = 'reg-consent';
                if (fields.consent.checked) {
                    clearError(fieldId);
                } else {
                    showError(fieldId, 'Debe aceptar los términos.');
                }
            });
        }

        // Requisitos de contraseña
        if (fields.password) {
            fields.password.addEventListener('input', () => {
                const req = checkPasswordStrength(fields.password.value);
                const elements = {
                    length: document.getElementById('req-length'),
                    upper: document.getElementById('req-upper'),
                    number: document.getElementById('req-number'),
                    special: document.getElementById('req-special'),
                };
                if (elements.length) {
                    elements.length.innerHTML = `${req.minLength ? '✓' : '✗'} 8+ caracteres`;
                    elements.length.style.color = req.minLength ? '#16a34a' : '#dc2626';
                }
                if (elements.upper) {
                    elements.upper.innerHTML = `${req.hasUpperCase ? '✓' : '✗'} Mayúscula`;
                    elements.upper.style.color = req.hasUpperCase ? '#16a34a' : '#dc2626';
                }
                if (elements.number) {
                    elements.number.innerHTML = `${req.hasNumber ? '✓' : '✗'} Número`;
                    elements.number.style.color = req.hasNumber ? '#16a34a' : '#dc2626';
                }
                if (elements.special) {
                    elements.special.innerHTML = `${req.hasSpecialChar ? '✓' : '✗'} Especial (@#$%^&*!)`;
                    elements.special.style.color = req.hasSpecialChar ? '#16a34a' : '#dc2626';
                }
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (validateAll()) {
                await registerPatient(getFormData());
            } else {
                const errorMsg = document.createElement('div');
                errorMsg.className = 'alert alert-danger';
                errorMsg.style.cssText = 'background:#fee2e2;color:#dc2626;padding:12px;border-radius:12px;text-align:center;margin-bottom:16px;';
                errorMsg.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Corrija los errores marcados.';
                const container = document.getElementById('register-form-container');
                const old = container.querySelector('.alert');
                if (old) old.remove();
                container.insertBefore(errorMsg, container.firstChild);
                setTimeout(() => errorMsg.remove(), 3000);
            }
        });

        document.getElementById('cancel-register')?.addEventListener('click', () => {
            if (onSuccess) onSuccess(null);
        });

        document.getElementById('show-terms')?.addEventListener('click', (e) => {
            e.preventDefault();
            showConsentModal();
        });
    }

    render();
}