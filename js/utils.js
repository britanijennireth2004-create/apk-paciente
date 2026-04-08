/**
 * Utility functions for the APK
 * CORREGIDO: Manejo correcto de fechas para evitar el desplazamiento por zona horaria
 */

/**
 * Calcula la edad correctamente sin problemas de zona horaria
 * @param {string} birthDate - Fecha de nacimiento en formato YYYY-MM-DD
 * @returns {number|string} - Edad en años o '--' si no hay fecha
 */
export function calculateAge(birthDate) {
    if (!birthDate) return '--';
    
    // Crear fecha de nacimiento usando UTC para evitar problemas de zona horaria
    const birthParts = birthDate.split('-');
    const birth = new Date(Date.UTC(
        parseInt(birthParts[0]), 
        parseInt(birthParts[1]) - 1, 
        parseInt(birthParts[2])
    ));
    
    const today = new Date();
    // Crear fecha actual en UTC
    const todayUTC = new Date(Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    ));
    
    let age = todayUTC.getUTCFullYear() - birth.getUTCFullYear();
    const monthDiff = todayUTC.getUTCMonth() - birth.getUTCMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && todayUTC.getUTCDate() < birth.getUTCDate())) {
        age--;
    }
    
    return age;
}

/**
 * Formatea una fecha para mostrar hora
 * @param {number|Date} date - Timestamp o objeto Date
 * @returns {string} - Hora formateada (ej: "14:30")
 */
export function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Formatea una fecha para mostrar día y mes corto
 * @param {number|Date} date - Timestamp o objeto Date
 * @returns {string} - Fecha formateada (ej: "18 sep")
 */
export function formatDateShort(date) {
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

/**
 * Formatea una fecha completa para mostrar
 * @param {number|Date} date - Timestamp o objeto Date
 * @returns {string} - Fecha formateada (ej: "18 de septiembre de 2004")
 */
export function formatDateLong(date) {
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
    });
}

/**
 * Convierte una fecha YYYY-MM-DD a un objeto Date sin problemas de zona horaria
 * @param {string} dateStr - Fecha en formato YYYY-MM-DD
 * @returns {Date} - Objeto Date en UTC
 */
export function parseDateUTC(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    return new Date(Date.UTC(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2])
    ));
}

/**
 * Formatea una fecha de nacimiento para mostrar en el perfil (ej: "18 de septiembre de 2004")
 * @param {string} dateStr - Fecha en formato YYYY-MM-DD
 * @returns {string} - Fecha formateada
 */
export function formatBirthDate(dateStr) {
    if (!dateStr) return '—';
    
    const months = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    
    const parts = dateStr.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    
    return `${day} de ${months[month]} de ${year}`;
}

/**
 * Valida si una fecha es válida
 * @param {string} dateStr - Fecha en formato YYYY-MM-DD
 * @returns {boolean} - true si la fecha es válida
 */
export function isValidDate(dateStr) {
    if (!dateStr) return false;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const testDate = new Date(Date.UTC(year, month - 1, day));
    return testDate.getUTCFullYear() === year && 
           testDate.getUTCMonth() === month - 1 && 
           testDate.getUTCDate() === day;
}