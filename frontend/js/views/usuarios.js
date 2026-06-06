App.registerView('usuarios', async () => {
    let usuarios = [];
    let gruposDisponibles = [];
    
    try {
        // Cargar usuarios y grupos disponibles de labores madre
        [usuarios, gruposDisponibles] = await Promise.all([
            api.getUsuarios().catch(() => []),
            api.getGrupos().catch(() => [])
        ]);
    } catch (e) {
        console.error('Error cargando datos de usuarios:', e);
    }

    // Si no hay grupos mapeados, poner algunos por defecto por seguridad
    if (gruposDisponibles.length === 0) {
        gruposDisponibles = ['COSECHA', 'DESBROTE', 'DESMALEZADO', 'INFRAESTRUCTURA', 'SIEMBRA'];
    }

    // Variable global para almacenar el usuario que se está editando
    window.usuarioEditandoId = null;

    // Abrir modal de nuevo usuario
    window.abrirModalUsuario = (id = null) => {
        const title = document.getElementById('modal-usuario-title');
        const form = document.getElementById('form-usuario');
        const passwordLabel = document.querySelector('label[for="user-password"]');
        const passwordInput = document.getElementById('user-password');
        
        // Limpiar checkboxes
        document.querySelectorAll('.permiso-check').forEach(cb => cb.checked = false);
        
        if (id) {
            window.usuarioEditandoId = id;
            const u = usuarios.find(usr => usr.id === id);
            title.innerText = 'Editar Usuario';
            document.getElementById('user-username').value = u.username;
            document.getElementById('user-email').value = u.email;
            passwordInput.value = '';
            passwordInput.required = false;
            passwordLabel.innerHTML = 'Nueva Contraseña <span style="color:var(--text-muted); font-size:0.75rem;">(dejar vacío para no cambiar)</span>';
            document.getElementById('user-rol').value = u.rol;
            document.getElementById('user-modificar-rend').checked = u.modificarRendimientos || false;
            
            // Marcar checkboxes de actividades permitidas
            if (u.actividadesPermitidas) {
                const permitidas = u.actividadesPermitidas.split(',').map(s => s.trim().toUpperCase());
                permitidas.forEach(p => {
                    const cb = document.getElementById(`cb-permiso-${p}`);
                    if (cb) cb.checked = true;
                });
            }
        } else {
            window.usuarioEditandoId = null;
            title.innerText = 'Nuevo Usuario';
            form.reset();
            passwordInput.required = true;
            passwordLabel.innerHTML = 'Contraseña <span style="color:#EF4444;">*</span>';
            document.getElementById('user-rol').value = 'SUPERVISOR';
            document.getElementById('user-modificar-rend').checked = false;
        }
        
        openModal('modal-usuario');
    };

    // Guardar usuario (Crear o Actualizar)
    window.guardarUsuario = async (e) => {
        e.preventDefault();
        const username = document.getElementById('user-username').value.trim();
        const email = document.getElementById('user-email').value.trim();
        const password = document.getElementById('user-password').value;
        const rol = document.getElementById('user-rol').value;
        const modificarRendimientos = document.getElementById('user-modificar-rend').checked;
        
        // Obtener actividades permitidas de los checkboxes
        const permitidas = [];
        document.querySelectorAll('.permiso-check:checked').forEach(cb => {
            permitidas.push(cb.value);
        });
        const actividadesPermitidas = permitidas.join(',');
        
        const data = {
            username,
            email,
            rol,
            modificarRendimientos,
            actividadesPermitidas
        };
        
        if (password) {
            data.password = password;
        }

        try {
            if (window.usuarioEditandoId) {
                // Actualizar usuario
                await api.updateUsuario(window.usuarioEditandoId, data);
                showNotification('Usuario actualizado exitosamente', 'success');
            } else {
                // Crear usuario
                if (!password) {
                    showNotification('La contraseña es obligatoria para nuevos usuarios', 'error');
                    return;
                }
                await api.createUsuario(data);
                showNotification('Usuario creado exitosamente', 'success');
            }
            closeModal();
            App.navigate('usuarios');
        } catch (err) {
            showNotification(err.message || 'Error al guardar el usuario', 'error');
        }
    };

    // Dar de baja / Desactivar usuario
    window.desactivarUsuario = async (id, username) => {
        if (confirm(`¿Está seguro de que desea desactivar al usuario "${username}"?`)) {
            try {
                await api.deleteUsuario(id);
                showNotification('Usuario desactivado exitosamente', 'success');
                App.navigate('usuarios');
            } catch (err) {
                showNotification('Error al desactivar el usuario', 'error');
            }
        }
    };

    // Reactivar usuario (usando update)
    window.reactivarUsuario = async (id, username) => {
        if (confirm(`¿Desea reactivar al usuario "${username}"?`)) {
            try {
                await api.updateUsuario(id, { activo: true });
                showNotification('Usuario reactivado exitosamente', 'success');
                App.navigate('usuarios');
            } catch (err) {
                showNotification('Error al reactivar el usuario', 'error');
            }
        }
    };

    const renderTableRows = () => {
        if (usuarios.length === 0) {
            return `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">No hay usuarios registrados</td></tr>`;
        }

        return usuarios.map(u => {
            const rolBadge = u.rol === 'ADMIN' 
                ? '<span class="badge" style="background:rgba(59, 130, 246, 0.2); color:#93C5FD; border:1px solid rgba(59,130,246,0.3);"><i class="fa-solid fa-user-shield"></i> Administrador</span>'
                : '<span class="badge" style="background:rgba(16, 185, 129, 0.2); color:#A7F3D0; border:1px solid rgba(16,185,129,0.3);"><i class="fa-solid fa-user"></i> Supervisor</span>';
                
            const rendBadge = u.modificarRendimientos 
                ? '<span class="badge" style="background:rgba(16, 185, 129, 0.15); color:#34D399;"><i class="fa-solid fa-check"></i> Sí</span>' 
                : '<span class="badge" style="background:rgba(239, 68, 68, 0.15); color:#F87171;"><i class="fa-solid fa-xmark"></i> No</span>';
                
            const estadoBadge = u.activo 
                ? '<span class="badge badge-success">Activo</span>' 
                : '<span class="badge badge-danger">Inactivo</span>';

            const actList = u.actividadesPermitidas 
                ? u.actividadesPermitidas.split(',').map(a => `<span class="badge" style="background:rgba(255,255,255,0.08); margin:1px;">${a}</span>`).join('')
                : '<span style="color:var(--text-muted); font-size:0.8rem;"><i>Todas</i></span>';

            const selfDeleteDisabled = u.username === 'admin' ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : '';

            let actionBtn = '';
            if (u.activo) {
                actionBtn = `<button class="btn btn-outline" onclick="desactivarUsuario(${u.id}, '${u.username}')" style="border-color:rgba(239, 68, 68, 0.4); color:#F87171; padding:0.3rem 0.6rem;" ${selfDeleteDisabled} title="Desactivar Usuario">
                                <i class="fa-solid fa-user-minus"></i> Desactivar
                             </button>`;
            } else {
                actionBtn = `<button class="btn btn-outline" onclick="reactivarUsuario(${u.id}, '${u.username}')" style="border-color:rgba(16, 185, 129, 0.4); color:#34D399; padding:0.3rem 0.6rem;" title="Reactivar Usuario">
                                <i class="fa-solid fa-user-plus"></i> Activar
                             </button>`;
            }

            return `
                <tr>
                    <td style="font-weight:600; color:white;">${u.username}</td>
                    <td style="color:var(--text-muted);">${u.email}</td>
                    <td>${rolBadge}</td>
                    <td>${actList}</td>
                    <td style="text-align:center;">${rendBadge}</td>
                    <td>${estadoBadge}</td>
                    <td>
                        <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                            <button class="btn btn-primary" onclick="abrirModalUsuario(${u.id})" style="padding:0.3rem 0.6rem;">
                                <i class="fa-solid fa-pen-to-square"></i> Editar
                            </button>
                            ${actionBtn}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    };

    return `
        <div class="fade-in">
            <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                <div>
                    <h3 style="margin:0;"><i class="fa-solid fa-users-gear" style="color:var(--primary); margin-right:0.5rem;"></i> Cuentas y Accesos</h3>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin:0.25rem 0 0 0;">Crea usuarios y asígnales accesos por actividad madre y permisos de rendimientos</p>
                </div>
                <button class="btn btn-primary" onclick="abrirModalUsuario()">
                    <i class="fa-solid fa-user-plus"></i> Crear Usuario
                </button>
            </div>

            <!-- TABLA DE USUARIOS -->
            <div class="card" style="padding:0; overflow:hidden;">
                <div style="overflow-x:auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Email</th>
                                <th>Rol</th>
                                <th>Actividades Permitidas</th>
                                <th style="text-align:center;">Modifica Rend.</th>
                                <th>Estado</th>
                                <th style="text-align:right;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderTableRows()}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- MODAL USUARIO (Crear/Editar) -->
            <div class="modal-overlay" id="modal-usuario" style="display:none;">
                <div class="modal-content glass-panel" style="max-width:550px;">
                    <div class="modal-header">
                        <h3 id="modal-usuario-title">Nuevo Usuario</h3>
                        <button class="modal-close" onclick="closeModal()">&times;</button>
                    </div>
                    
                    <form id="form-usuario" onsubmit="guardarUsuario(e || event)">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                            <div class="form-group">
                                <label for="user-username">Nombre de Usuario <span style="color:#EF4444;">*</span></label>
                                <input type="text" id="user-username" required style="width:100%;" placeholder="Ej: pedro_cosecha">
                            </div>
                            
                            <div class="form-group">
                                <label for="user-email">Email <span style="color:#EF4444;">*</span></label>
                                <input type="email" id="user-email" required style="width:100%;" placeholder="Ej: pedro@pyganflor.com">
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                            <div class="form-group">
                                <label for="user-password">Contraseña <span style="color:#EF4444;">*</span></label>
                                <input type="password" id="user-password" style="width:100%;" placeholder="Contraseña de acceso">
                            </div>
                            
                            <div class="form-group">
                                <label for="user-rol">Rol en el Sistema</label>
                                <select id="user-rol" style="width:100%; padding:0.75rem; background:#111827; border:1px solid var(--surface-glass-border); border-radius:8px; color:white;">
                                    <option value="SUPERVISOR">SUPERVISOR (Acceso Limitado)</option>
                                    <option value="ADMIN">ADMINISTRADOR (Acceso Total)</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group" style="margin-bottom:1.25rem;">
                            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:600;">
                                <input type="checkbox" id="user-modificar-rend" style="width:18px; height:18px; accent-color:var(--primary);">
                                Permitir modificar tablas de rendimientos (Rendimientos)
                            </label>
                        </div>

                        <div class="form-group" style="margin-bottom:1.5rem;">
                            <label style="font-weight:600; display:block; margin-bottom:0.5rem;">
                                Actividades Madre Permitidas
                                <span style="color:var(--text-muted); font-size:0.75rem; display:block; font-weight:400;">
                                    (Aplica para rol SUPERVISOR. Si no se marca ninguna, tendrá acceso a todas por defecto)
                                </span>
                            </label>
                            
                            <div class="permissions-grid">
                                ${gruposDisponibles.map(g => `
                                    <label class="permission-item" for="cb-permiso-${g}">
                                        <input type="checkbox" id="cb-permiso-${g}" class="permiso-check" value="${g}">
                                        ${g}
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid var(--surface-glass-border); padding-top:1rem; margin-top:1rem;">
                            <button type="button" class="btn btn-outline" onclick="closeModal()">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar Usuario</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
});
