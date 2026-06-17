const API_BASE = '/api';

const api = {
    async request(endpoint, method = 'GET', body = null) {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const options = {
                method,
                headers
            };
            if (body) options.body = JSON.stringify(body);
            
            const response = await fetch(`${API_BASE}${endpoint}`, options);
            if (response.status === 401) {
                // Token inválido o expirado
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                showNotification('Sesión expirada. Por favor inicie sesión.', 'error');
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                throw new Error('Sesión expirada');
            }
            
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `API Error: ${response.statusText}`);
            }
            
            const text = await response.text();
            return text ? JSON.parse(text) : {};
        } catch (error) {
            console.error('Network Error:', error);
            showNotification(error.message || 'Error de conexión con el servidor', 'error');
            throw error;
        }
    },
    
    // ========== Admin / Dashboard ==========
    getDashboard: () => api.request('/admin/dashboard'),
    getAreas: () => api.request('/admin/areas'),
    createArea: (data) => api.request('/admin/areas', 'POST', data),
    updateArea: (id, data) => api.request(`/admin/areas/${id}`, 'PUT', data),
    getProductos: () => api.request('/admin/productos'),
    createProducto: (data) => api.request('/admin/productos', 'POST', data),
    updateProducto: (id, data) => api.request(`/admin/productos/${id}`, 'PUT', data),
    getUnidades: () => api.request('/admin/unidades'),
    createUnidad: (data) => api.request('/admin/unidades', 'POST', data),
    updateUnidad: (id, data) => api.request(`/admin/unidades/${id}`, 'PUT', data),
    
    // ========== Actividades ==========
    getActividades: () => api.request('/admin/actividades'),
    getActividadesPorArea: (areaId) => api.request(`/admin/actividades/area/${areaId}`),
    createActividad: (data) => api.request('/admin/actividades', 'POST', data),
    updateActividad: (id, data) => api.request(`/admin/actividades/${id}`, 'PUT', data),
    
    // ========== Personal ==========
    getTrabajadores: () => api.request('/personal/trabajadores'),
    getTrabajadoresPorArea: (areaId) => api.request(`/personal/trabajadores/area/${areaId}`),
    createTrabajador: (data) => api.request('/personal/trabajadores', 'POST', data),
    toggleActivoTrabajador: (id) => api.request(`/personal/trabajadores/${id}/toggle-activo`, 'PUT'),
    getAsignaciones: () => api.request('/personal/asignaciones'),
    createAsignacion: (data) => api.request('/personal/asignaciones', 'POST', data),
    
    // ========== Planificación ==========
    getSemanas: () => api.request('/planificacion/semanas'),
    getSemanasDisponibles: () => api.request('/planificacion/semanas/disponibles'),
    getSemanaActual: () => api.request('/planificacion/semana-actual'),
    getSemanaSiguiente: () => api.request('/planificacion/semana-siguiente'),
    generarSemanas: (anio, cantidad) => api.request('/planificacion/semanas/generar', 'POST', { anio, cantidad }),
    cambiarEstadoSemana: (codigo, estado) => api.request(`/planificacion/semanas/${codigo}/estado`, 'PUT', { estado }),
    
    getPlanificacionSemana: (codigo) => api.request(`/planificacion/actividades/semana/${codigo}`),
    getPlanificacionSemanaArea: (codigo, areaId) => api.request(`/planificacion/actividades/semana/${codigo}/area/${areaId}`),
    createPlanificacion: (data) => api.request('/planificacion/actividades', 'POST', data),
    updatePlanificacion: (id, data) => api.request(`/planificacion/actividades/${id}`, 'PUT', data),
    deletePlanificacion: (id) => api.request(`/planificacion/actividades/${id}`, 'DELETE'),
    copiarPlanificacionSemana: (codigoOrigen, codigoDestino) => api.request(`/planificacion/semanas/${codigoOrigen}/copiar-a/${codigoDestino}`, 'POST'),
    
    // ========== Planificación Diaria ==========
    getPlanDiarioFecha: (fecha) => api.request(`/planificacion-diaria/${fecha}`),
    getPlanDiarioSemana: (codigo) => api.request(`/planificacion-diaria/semana/${codigo}`),
    getPlanDiarioSemanaFecha: (codigo, fecha) => api.request(`/planificacion-diaria/semana/${codigo}/fecha/${fecha}`),
    crearPlanDiario: (data) => api.request('/planificacion-diaria', 'POST', data),
    actualizarPlanDiario: (id, data) => api.request(`/planificacion-diaria/${id}`, 'PUT', data),
    eliminarPlanDiario: (id) => api.request(`/planificacion-diaria/${id}`, 'DELETE'),
    getHorasDisponibles: (planId) => api.request(`/planificacion-diaria/disponibles/${planId}`),
    
    // ========== Comparativa ==========
    getComparativaDia: (fecha) => api.request(`/comparativa/dia/${fecha}`),
    getComparativaSemana: (codigo) => api.request(`/comparativa/semana/${codigo}`),
    getAlertaHoras: (codigo) => api.request(`/comparativa/alerta/${codigo}`),
    
    // ========== Ejecución ==========
    getEjecuciones: () => api.request('/ejecucion'),
    getEjecucionesSemana: (codigo) => api.request(`/ejecucion/semana/${codigo}`),
    createEjecucion: (data) => api.request('/ejecucion', 'POST', data),
    updateEjecucion: (id, data) => api.request(`/ejecucion/${id}`, 'PUT', data),
    deleteEjecucion: (id) => api.request(`/ejecucion/${id}`, 'DELETE'),
    
    // ========== Rendimientos ==========
    getRendimientos: () => api.request('/admin/rendimientos'),
    createRendimiento: (data) => api.request('/admin/rendimientos', 'POST', data),
    updateRendimiento: (id, data) => api.request(`/admin/rendimientos/${id}`, 'PUT', data),
    deleteRendimiento: (id) => api.request(`/admin/rendimientos/${id}`, 'DELETE'),
    importarRendimientosGrupos: () => api.request('/admin/importar-rendimientos-grupos', 'POST'),
    
    // ========== Planificación por GRUPO (Actividad Madre) ==========
    getGrupos: () => api.request('/planificacion/grupos'),
    getRendimientosPorGrupo: (grupo) => api.request(`/planificacion/grupos/${encodeURIComponent(grupo)}/rendimientos`),
    getCultivosPorGrupo: (grupo) => api.request(`/planificacion/grupos/${encodeURIComponent(grupo)}/cultivos`),
    getLaboresPorGrupoCultivo: (grupo, productoCodigo) => api.request(`/planificacion/grupos/${encodeURIComponent(grupo)}/cultivos/${encodeURIComponent(productoCodigo)}/labores`),
    
    // ========== Planificación Legacy ==========
    getLaboresMadre: () => api.request('/planificacion/labores'),
    getCultivosPorLabor: (laborNombre) => api.request(`/planificacion/labores/${encodeURIComponent(laborNombre)}/cultivos`),
    getRendimientoLabor: (laborNombre, productoCodigo) => api.request(`/planificacion/rendimiento/${encodeURIComponent(laborNombre)}/${encodeURIComponent(productoCodigo)}`),
    getCultivosCosecha: () => api.request('/planificacion/cosecha/cultivos'),
    calcularHorasCosecha: (data) => api.request('/planificacion/cosecha/calcular', 'POST', data),
    
    // ========== Autenticación y Usuarios ==========
    login: (username, password) => api.request('/auth/login', 'POST', { username, password }),
    getMe: () => api.request('/auth/me'),
    getUsuarios: () => api.request('/admin/usuarios'),
    createUsuario: (data) => api.request('/admin/usuarios', 'POST', data),
    updateUsuario: (id, data) => api.request(`/admin/usuarios/${id}`, 'PUT', data),
    deleteUsuario: (id) => api.request(`/admin/usuarios/${id}`, 'DELETE'),
    
    // ========== Health Check ==========
    async post(endpoint, body = null) {
        return this.request(endpoint, 'POST', body);
    },
    
    healthCheck: async () => {
        try {
            await api.getDashboard();
            return true;
        } catch {
            return false;
        }
    }
};

// ========== Global Toast Notification System ==========
function showNotification(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} fade-in`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 9999;
        background: ${type === 'success' ? '#10B981' : '#EF4444'};
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    toast.innerText = msg;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// ========== Global Modal Functions ==========
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeModal() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}

// ========== Global Form Handlers ==========
document.addEventListener('submit', async (e) => {
    // Formulario de nuevo trabajador
    if (e.target.id === 'form-trabajador') {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            cedula: formData.get('cedula'),
            nombre: formData.get('nombre'),
            cargo: formData.get('cargo'),
            activo: true,
            fechaIngreso: new Date().toISOString().split('T')[0]
        };
        
        try {
            await api.createTrabajador(data);
            showNotification('Trabajador registrado exitosamente', 'success');
            closeModal();
            App.navigate('personal');
        } catch (err) {
            showNotification('Error al guardar trabajador', 'error');
        }
    }
    
    // Formulario de ejecución
    if (e.target.id === 'form-ejecucion') {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            fecha: formData.get('fecha'),
            horasReales: parseFloat(formData.get('horasReales')),
            unidadesReales: parseInt(formData.get('unidadesLogradas')),
            observacion: formData.get('observaciones') || ''
        };
        
        try {
            await api.createEjecucion(data);
            showNotification('Ejecución registrada exitosamente', 'success');
            App.navigate('ejecucion');
        } catch (err) {
            showNotification('Error al guardar ejecución', 'error');
        }
    }
    
});
