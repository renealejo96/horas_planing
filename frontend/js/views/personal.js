App.registerView('personal', async () => {
    let trabajadores = [], areas = [];
    try {
        [trabajadores, areas] = await Promise.all([
            api.getTrabajadores(),
            api.getAreas()
        ]);
    } catch (e) {
        console.log('Error cargando datos:', e);
    }

    const renderTrabajadores = () => {
        if (trabajadores.length === 0) {
            return `
                <tr>
                    <td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">
                        <i class="fa-solid fa-users" style="font-size:2rem; margin-bottom:0.5rem; display:block; opacity:0.5;"></i>
                        No hay trabajadores registrados. ¡Añade el primero!
                    </td>
                </tr>
            `;
        }
        return trabajadores.map(t => `
            <tr>
                <td>${t.cedula || '-'}</td>
                <td>${t.nombre || '-'}</td>
                <td>${t.cargo || '-'}</td>
                <td><span class="badge" style="background:rgba(59, 130, 246, 0.2); color:#93C5FD;">${t.area ? t.area.nombre : 'Sin área'}</span></td>
                <td><span class="badge" style="background:${t.activo ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color:${t.activo ? '#A7F3D0' : '#FCA5A5'};">${t.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td><button class="btn ${t.activo ? 'btn-outline' : 'btn-primary'}" onclick="toggleActivo(${t.id})" style="padding:0.3rem 0.6rem; font-size:0.75rem;">
                    <i class="fa-solid ${t.activo ? 'fa-user-slash' : 'fa-user-check'}"></i> ${t.activo ? 'Dar Baja' : 'Activar'}
                </button></td>
            </tr>
        `).join('');
    };
    
    // Función para dar de baja / activar trabajador
    window.toggleActivo = async (id) => {
        const trabajador = trabajadores.find(t => t.id === id);
        const accion = trabajador?.activo ? 'dar de baja' : 'activar';
        
        if (!confirm(`¿Seguro que desea ${accion} a ${trabajador?.nombre}?`)) return;
        
        try {
            await api.toggleActivoTrabajador(id);
            showNotification(`Trabajador ${trabajador?.activo ? 'dado de baja' : 'activado'}`, 'success');
            App.navigate('personal');
        } catch (e) {
            showNotification('Error al actualizar trabajador', 'error');
        }
    };
    
    const renderAreasOptions = () => {
        if (areas.length === 0) return '<option value="">Sin áreas</option>';
        return areas.map(a => `<option value="${a.id}">${a.nombre} (${a.codigo})</option>`).join('');
    };

    // Función para crear trabajador
    window.crearTrabajador = async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = {
            cedula: form.cedula.value,
            nombre: form.nombre.value,
            cargo: form.cargo.value,
            area: form.areaId.value ? { id: parseInt(form.areaId.value) } : null,
            activo: true
        };
        
        try {
            await api.createTrabajador(data);
            showNotification('Trabajador creado exitosamente', 'success');
            closeModal();
            App.navigate('personal');
        } catch (e) {
            showNotification('Error al crear trabajador', 'error');
        }
    };

    return `
        <div class="fade-in">
            <!-- Modal Nuevo Trabajador -->
            <div id="modal-trabajador" class="modal-overlay" style="display:none;">
                <div class="modal-content">
                    <h3><i class="fa-solid fa-user-plus"></i> Nuevo Trabajador</h3>
                    <form id="form-trabajador" onsubmit="crearTrabajador(event)">
                        <div class="form-group">
                            <label>Cédula</label>
                            <input type="text" name="cedula" required placeholder="Ej: 1712345678">
                        </div>
                        <div class="form-group">
                            <label>Nombre Completo</label>
                            <input type="text" name="nombre" required placeholder="Ej: Juan Pérez">
                        </div>
                        <div class="form-group">
                            <label>Cargo (desde TTHH)</label>
                            <input type="text" name="cargo" required placeholder="Ej: PY_FUMIGACION">
                        </div>
                        <div class="form-group">
                            <label>Área Asignada</label>
                            <select name="areaId" required>
                                <option value="">Seleccionar área...</option>
                                ${renderAreasOptions()}
                            </select>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar</button>
                        </div>
                    </form>
                </div>
            </div>

            <div class="top-actions" style="margin-bottom: 1rem; justify-content: flex-end;">
                <button class="btn btn-outline" onclick="showNotification('Función de importar CSV pendiente', 'success')" style="margin-right:0.5rem;">
                    <i class="fa-solid fa-file-csv"></i> Importar CSV
                </button>
                <button class="btn btn-primary" onclick="openModal('modal-trabajador')">
                    <i class="fa-solid fa-user-plus"></i> Nuevo Trabajador
                </button>
            </div>
            
            ${trabajadores.length > 0 ? `
            <div class="card" style="margin-bottom:1.5rem;">
                <h3><i class="fa-solid fa-chart-pie" style="color:var(--primary); margin-right:0.5rem;"></i> Personal por Área</h3>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-top:1rem;">
                    ${areas.map(a => {
                        const count = trabajadores.filter(t => t.activo && t.area && t.area.id === a.id).length;
                        return `
                            <div style="padding:1rem; background:var(--surface-glass); border:1px solid var(--surface-glass-border); border-radius:12px; text-align:center;">
                                <div style="font-size:1.4rem; font-weight:700; color:var(--primary);">${count} Activos</div>
                                <div style="font-size:0.85rem; color:var(--text-muted); font-weight:600; margin-top:0.25rem;">${a.nombre}</div>
                                <div style="font-size:0.95rem; color:var(--secondary); font-weight:700; margin-top:0.5rem;">
                                    <i class="fa-solid fa-clock"></i> ${(count * 40).toLocaleString()}h Nómina
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}

            <div class="card">
                <h3>Personal Registrado <span class="badge" style="margin-left:0.5rem;">${trabajadores.length}</span></h3>
                <table>
                    <thead>
                        <tr>
                            <th>Cédula</th>
                            <th>Nombre</th>
                            <th>Cargo</th>
                            <th>Área</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tabla-trabajadores">
                        ${renderTrabajadores()}
                    </tbody>
                </table>
            </div>
        </div>
    `;
});

