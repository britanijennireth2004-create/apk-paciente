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
            case 'name': if (!value.trim()) return 'El nombre es obligatorio.'; break;
            case 'lastName': if (!value.trim()) return 'El apellido es obligatorio.'; break;
            case 'docNumber': 
                if (!value.trim()) return 'El número de documento es obligatorio.';
                if (!isDocNumberUnique(value.trim())) return 'El documento ya está registrado.';
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
                if (!(req.minLength && req.hasUpperCase && req.hasNumber && req.hasSpecialChar)) {
                    return 'La contraseña debe cumplir con los requisitos.';
                }
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
            <div style="min-height:100vh;background:linear-gradient(135deg,#e2e8f0,#f1f5f9);padding:20px;">
                <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.1);">
                    <div style="background:linear-gradient(135deg,var(--themeDarker),var(--themePrimary));padding:20px;text-align:center;">
                        <h2 style="margin:0;color:#fff;font-size:1.3rem;">Registro de Paciente</h2>
                        <p style="margin:5px 0 0;color:rgba(255,255,255,0.9);font-size:0.8rem;">Complete sus datos para crear su cuenta</p>
                    </div>
                    
                    <div id="register-form-container" style="padding:20px;">
                        <form id="register-form">
                            <!-- Datos Personales -->
                            <div style="margin-bottom:16px;">
                                <h3 style="font-size:0.75rem;color:var(--themePrimary);margin-bottom:12px;">DATOS PERSONALES</h3>
                                <div style="margin-bottom:12px;">
                                    <input type="text" id="reg-name" class="login-input" placeholder="Nombres completos *" style="width:100%;">
                                    <div class="error-msg" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                                <div style="margin-bottom:12px;">
                                    <input type="text" id="reg-lastname" class="login-input" placeholder="Apellidos completos *" style="width:100%;">
                                    <div class="error-msg" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                                <div style="display:flex;gap:10px;margin-bottom:12px;">
                                    <select id="reg-doctype" class="login-input" style="width:80px;">
                                        <option value="V">V</option>
                                        <option value="E">E</option>
                                        <option value="P">P</option>
                                    </select>
                                    <input type="text" id="reg-docnumber" class="login-input" placeholder="Número de documento *" style="flex:1;">
                                </div>
                                <div class="error-msg" data-for="reg-docnumber" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                <div style="margin-bottom:12px;">
                                    <input type="date" id="reg-birthdate" class="login-input" style="width:100%;" max="${new Date().toISOString().split('T')[0]}">
                                    <div class="error-msg" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                                <div style="margin-bottom:12px;">
                                    <select id="reg-gender" class="login-input" style="width:100%;">
                                        <option value="">Sexo *</option>
                                        <option value="Masculino">Masculino</option>
                                        <option value="Femenino">Femenino</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                    <div class="error-msg" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                            </div>

                            <!-- Contacto -->
                            <div style="margin-bottom:16px;">
                                <h3 style="font-size:0.75rem;color:var(--themePrimary);margin-bottom:12px;">CONTACTO Y ACCESO</h3>
                                <div style="margin-bottom:12px;">
                                    <input type="tel" id="reg-phone" class="login-input" placeholder="Teléfono (11 dígitos) *" style="width:100%;">
                                    <div class="error-msg" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                    <div style="font-size:0.65rem;color:#64748b;margin-top:4px;">Ejemplo: 04121234567</div>
                                </div>
                                <div style="margin-bottom:12px;">
                                    <input type="email" id="reg-email" class="login-input" placeholder="Correo electrónico *" style="width:100%;">
                                    <div class="error-msg" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                                <div style="margin-bottom:12px;">
                                    <input type="text" id="reg-username" class="login-input" placeholder="Nombre de usuario *" style="width:100%;">
                                    <div class="error-msg" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                                <div style="margin-bottom:12px;">
                                    <input type="password" id="reg-password" class="login-input" placeholder="Contraseña *" style="width:100%;">
                                    <div class="error-msg" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                    <div id="password-reqs" style="font-size:0.65rem;margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">
                                        <span id="req-length">✗ 8+ caracteres</span>
                                        <span id="req-upper">✗ Mayúscula</span>
                                        <span id="req-number">✗ Número</span>
                                        <span id="req-special">✗ Especial (@#$%^&*!)</span>
                                    </div>
                                </div>
                                <div style="margin-bottom:12px;">
                                    <input type="password" id="reg-confirm" class="login-input" placeholder="Confirmar contraseña *" style="width:100%;">
                                    <div class="error-msg" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                                </div>
                            </div>

                            <!-- Consentimiento -->
                            <div style="margin-bottom:20px;">
                                <label style="display:flex;align-items:center;gap:8px;font-size:0.75rem;">
                                    <input type="checkbox" id="reg-consent">
                                    Acepto el <a href="#" id="show-terms" style="color:var(--themePrimary);">consentimiento informado</a>
                                </label>
                                <div class="error-msg" data-for="reg-consent" style="color:#dc2626;font-size:0.7rem;margin-top:4px;"></div>
                            </div>

                            <!-- Botones -->
                            <div style="display:flex;gap:12px;">
                                <button type="button" id="cancel-register" class="btn-outline" style="flex:1;padding:12px;border-radius:12px;font-weight:600;">Cancelar</button>
                                <button type="submit" id="register-btn" class="btn-primary" style="flex:2;padding:12px;border-radius:12px;font-weight:700;background:var(--themePrimary);color:#fff;border:none;">Registrarse</button>
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
            const container = field.closest('div')?.parentElement || field.parentElement;
            let errorDiv = container.querySelector(`.error-msg[data-for="${fieldId}"]`) || container.querySelector('.error-msg:not([data-for])');
            if (!errorDiv) {
                errorDiv = document.createElement('div');
                errorDiv.className = 'error-msg';
                errorDiv.style.cssText = 'color:#dc2626;font-size:0.7rem;margin-top:4px;';
                field.parentElement.appendChild(errorDiv);
            }
            errorDiv.textContent = msg;
        };

        const clearError = (fieldId) => {
            const field = document.getElementById(fieldId);
            if (!field) return;
            const container = field.closest('div')?.parentElement || field.parentElement;
            const errorDiv = container.querySelector('.error-msg');
            if (errorDiv) errorDiv.textContent = '';
        };

        const validateAll = () => {
            const data = getFormData();
            let isValid = true;
            const fieldsToCheck = ['name', 'lastName', 'docNumber', 'phone', 'email', 'username', 'password', 'confirm', 'consent'];
            fieldsToCheck.forEach(f => {
                const error = validateField(f === 'confirm' ? 'confirmPassword' : f, data[f === 'confirm' ? 'confirmPassword' : f], data);
                if (error) {
                    showError(`reg-${f === 'confirm' ? 'confirm' : f}`, error);
                    isValid = false;
                } else {
                    clearError(`reg-${f === 'confirm' ? 'confirm' : f}`);
                }
            });
            return isValid;
        };

        // Validación en tiempo real
        Object.entries(fields).forEach(([name, field]) => {
            if (!field) return;
            field.addEventListener('input', () => {
                const data = getFormData();
                const error = validateField(name === 'confirm' ? 'confirmPassword' : name, field.value, data);
                if (error) showError(`reg-${name}`, error);
                else clearError(`reg-${name}`);
            });
        });

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
                elements.length.innerHTML = `${req.minLength ? '✓' : '✗'} 8+ caracteres`;
                elements.length.style.color = req.minLength ? '#16a34a' : '#dc2626';
                elements.upper.innerHTML = `${req.hasUpperCase ? '✓' : '✗'} Mayúscula`;
                elements.upper.style.color = req.hasUpperCase ? '#16a34a' : '#dc2626';
                elements.number.innerHTML = `${req.hasNumber ? '✓' : '✗'} Número`;
                elements.number.style.color = req.hasNumber ? '#16a34a' : '#dc2626';
                elements.special.innerHTML = `${req.hasSpecialChar ? '✓' : '✗'} Especial`;
                elements.special.style.color = req.hasSpecialChar ? '#16a34a' : '#dc2626';
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
            window.hospitalAlert('El consentimiento informado autoriza al hospital a registrar y almacenar sus datos personales y clínicos para fines de atención médica.', 'info');
        });
    }

    render();
}