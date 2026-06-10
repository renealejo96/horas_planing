App.registerView('rendimientos', async () => {
    let rendimientos = [], areas = [], productos = [], actividades = [], unidades = [];
    let editandoRendId = null; // null = crear nuevo, número = editar existente

    try {
        [rendimientos, areas, productos, actividades, unidades] = await Promise.all([
            api.getRendimientos().catch(() => []),
            api.getAreas().catch(() => []),
            api.getProductos().catch(() => []),
            api.getActividades().catch(() => []),
            api.getUnidades().catch(() => [])
        ]);
    } catch (e) {
        console.log('Error cargando datos:', e);
    }

    // Exponer actividades para el datalist inline del modal
    window._actividadesList = actividades;

    // ─── Grupos y cultivos únicos para filtros ────────────────────────────────
    const grupos = [...new Set(rendimientos.map(r => r.grupo).filter(Boolean))].sort();
    const todosLosCultivos = [...new Set(rendimientos.map(r => r.producto?.nombre).filter(Boolean))].sort();

    // Estado activo de los filtros
    let filtroGrupoActivo = '';
    let filtroCultivoActivo = '';

    // ─── Render tabla de rendimientos (filtro por grupo + cultivo) ───────────
    const renderRendimientos = (fGrupo = '', fCultivo = '') => {
        const lista = rendimientos.filter(r => {
            const okGrupo   = !fGrupo   || r.grupo === fGrupo;
            const okCultivo = !fCultivo || (r.producto?.nombre === fCultivo);
            return okGrupo && okCultivo;
        });

        const desc = [fGrupo, fCultivo].filter(Boolean).join(' + ');
        if (!lista.length) return `
            <tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:2rem;">
                <i class="fa-solid fa-tachometer-alt" style="font-size:2rem; margin-bottom:0.5rem; display:block; opacity:0.5;"></i>
                No hay rendimientos${desc ? ' para: ' + desc : ''}. ¡Añade el primero!
            </td></tr>`;

        return lista.map(r => `
            <tr>
                <td><span class="badge" style="background:rgba(245,158,11,0.2);color:#FCD34D;font-size:0.7rem;">${r.grupo || '-'}</span></td>
                <td style="font-size:0.82rem;">${r.producto ? r.producto.nombre : '-'}</td>
                <td style="font-size:0.82rem;">${r.actividad ? r.actividad.nombre : '-'}</td>
                <td><span class="badge" style="background:rgba(59,130,246,0.2);color:#93C5FD;">${r.rendimiento ?? r.valorRendimiento ?? 0}</span></td>
                <td style="font-size:0.78rem; color:var(--text-muted);">${r.unidad ? r.unidad.nombre : '-'}</td>
                <td>${r.notas ? `<span style="font-size:0.75rem; color:var(--text-muted);">${r.notas}</span>` : '-'}</td>
                <td style="white-space:nowrap;">
                    <button onclick="abrirEditarRendimiento(${r.id})"
                        title="Editar rendimiento"
                        style="background:rgba(59,130,246,0.15); color:#93C5FD; border:1px solid rgba(59,130,246,0.3); border-radius:5px; padding:0.25rem 0.5rem; cursor:pointer; margin-right:0.2rem;">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button onclick="eliminarRendimiento(${r.id})"
                        title="Desactivar rendimiento"
                        style="background:rgba(239,68,68,0.15); color:#FCA5A5; border:1px solid rgba(239,68,68,0.3); border-radius:5px; padding:0.25rem 0.5rem; cursor:pointer;">
                        <i class="fa-solid fa-ban"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    };

    // ─── Helper: renderizar botones de cultivo según grupo activo ─────────────
    const renderCultivosBtns = (grupoFiltro) => {
        const cultivosEnGrupo = grupoFiltro
            ? [...new Set(rendimientos.filter(r => r.grupo === grupoFiltro).map(r => r.producto?.nombre).filter(Boolean))].sort()
            : todosLosCultivos;

        if (!cultivosEnGrupo.length) return '<span style="color:var(--text-muted); font-size:0.75rem;">Sin cultivos</span>';

        const todoBtn = `<button class="cultivo-filter-btn active" data-cultivo=""
            onclick="filtrarPorCultivo('')">
            Todos
        </button>`;
        const cultivoBtns = cultivosEnGrupo.map(c => `
            <button class="cultivo-filter-btn" data-cultivo="${c}"
                onclick="filtrarPorCultivo('${c}')">
                ${c}
            </button>`).join('');
        return todoBtn + cultivoBtns;
    };

    // ─── Helper: filtrar datalist de labores según área seleccionada ─────────
    window.filtrarDatalistLabores = (areaId) => {
        const datalist = document.getElementById('datalist-labores');
        const inputLabor = document.getElementById('rend_labor_nombre');
        if (inputLabor && !editandoRendId) inputLabor.value = ''; // Solo limpiar en nuevo
        document.getElementById('rend_labor_id_hidden').value = '';
        
        if (!datalist) return;
        
        let filtradas = actividades;
        if (areaId) {
            filtradas = actividades.filter(a => a.area && a.area.id == areaId);
        }
        
        datalist.innerHTML = filtradas.map(a => `<option value="${a.nombre}">`).join('');
    };

    // ─── Funciones CRUD Rendimiento ───────────────────────────────────────────
    window.abrirNuevoRendimiento = () => {
        editandoRendId = null;
        document.getElementById('modal-rend-titulo').textContent = '+ Nuevo Rendimiento';
        document.getElementById('form-rendimiento').reset();
        // Ocultar campo de grupo personalizado
        const grupoCustom = document.getElementById('rend_grupo_custom_wrap');
        if (grupoCustom) grupoCustom.style.display = 'none';
        // Ocultar mini-form de nuevo cultivo
        const cultivoWrap = document.getElementById('rend_cultivo_nuevo_wrap');
        if (cultivoWrap) cultivoWrap.style.display = 'none';
        
        // Inicializar datalist con todas las actividades
        window.filtrarDatalistLabores('');
        
        document.getElementById('modal-rendimiento').style.display = 'flex';
    };

    window.abrirEditarRendimiento = (id) => {
        const r = rendimientos.find(x => x.id === id);
        if (!r) return;
        editandoRendId = id;
        document.getElementById('modal-rend-titulo').textContent = 'Editar Rendimiento';
        const form = document.getElementById('form-rendimiento');

        // Grupo: si el grupo existe en el select lo selecciona, sino usa "otro"
        const grupoSelect = form.rend_grupo_select;
        const grupoOpciones = [...grupoSelect.options].map(o => o.value);
        if (r.grupo && grupoOpciones.includes(r.grupo)) {
            grupoSelect.value = r.grupo;
            document.getElementById('rend_grupo_custom_wrap').style.display = 'none';
        } else {
            grupoSelect.value = '__otro__';
            document.getElementById('rend_grupo_custom_wrap').style.display = 'block';
            form.rend_grupo_custom.value = r.grupo || '';
        }

        // Área
        const areaId = r.actividad && r.actividad.area ? r.actividad.area.id : '';
        if (form.rend_area) form.rend_area.value = areaId;
        window.filtrarDatalistLabores(areaId);

        // Producto
        form.rend_producto.value       = r.producto?.id || '';
        const cultivoWrap = document.getElementById('rend_cultivo_nuevo_wrap');
        if (cultivoWrap) cultivoWrap.style.display = 'none';

        // Labor
        form.rend_labor_nombre.value   = r.actividad?.nombre || '';
        document.getElementById('rend_labor_id_hidden').value = r.actividad?.id || '';
        
        form.rend_valor.value          = r.rendimiento ?? r.valorRendimiento ?? '';
        form.rend_unidad.value         = r.unidad?.id || '';
        form.rend_notas.value          = r.notas || '';

        document.getElementById('modal-rendimiento').style.display = 'flex';
    };

    window.guardarRendimiento = async (e) => {
        e.preventDefault();
        const form = e.target;

        // ── Resolver grupo ────────────────────────────────────────────────────
        const grupoSelect = form.rend_grupo_select.value;
        const grupo = (grupoSelect === '__otro__'
            ? form.rend_grupo_custom.value.trim()
            : grupoSelect
        ).toUpperCase();

        if (!grupo) { showNotification('Selecciona o escribe el grupo', 'warning'); return; }

        // ── Resolver cultivo (producto) ───────────────────────────────────────
        let productoId = null;
        const productoSelectVal = form.rend_producto.value;

        if (productoSelectVal === '__nuevo_cultivo__') {
            const nombre   = form.cultivo_nuevo_nombre?.value.trim();
            const codigo   = form.cultivo_nuevo_codigo?.value.trim();
            const densidad = parseFloat(form.cultivo_nuevo_densidad?.value) || 0;
            if (!nombre || !codigo) {
                showNotification('Escribe código y nombre para el nuevo cultivo', 'warning'); return;
            }
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando cultivo...';
            try {
                const nuevoProd = await api.createProducto({ codigo, nombre, densidad });
                productoId = nuevoProd.id;
                productos.push(nuevoProd);
            } catch {
                showNotification('Error al crear el nuevo cultivo', 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar';
                return;
            }
        } else {
            productoId = parseInt(productoSelectVal) || null;
        }

        if (!productoId) {
            showNotification('Selecciona o crea un cultivo', 'warning'); return;
        }

        // ── Resolver actividad (labor) ─────────────────────────────────────────
        const laborNombre = form.rend_labor_nombre.value.trim();
        if (!laborNombre) { showNotification('Escribe el nombre de la labor', 'warning'); return; }

        let actividadId = parseInt(document.getElementById('rend_labor_id_hidden').value) || null;

        // Buscar si ya existe por nombre exacto (case-insensitive) Y producto correspondiente
        const actExistente = actividades.find(a => 
            a.nombre.toLowerCase() === laborNombre.toLowerCase() && 
            ((!a.producto && !productoId) || (a.producto && a.producto.id === productoId))
        );
        if (actExistente) {
            actividadId = actExistente.id;
        } else {
            // Nueva labor para este producto: crearla primero
            const areaId = parseInt(form.rend_area?.value) || null;
            if (!areaId) {
                showNotification('Selecciona el área de trabajo para la labor', 'warning');
                return;
            }
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando labor...';
            try {
                const prod = productos.find(p => p.id === productoId);
                const prodCodigo = prod ? prod.codigo.toUpperCase() : 'GENERIC';
                const codigoAct = `${grupo}_${prodCodigo}_${laborNombre.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`.slice(0, 50);
                const nuevaAct = await api.createActividad({
                    codigo: codigoAct,
                    nombre: laborNombre,
                    areaId: areaId,
                    productoId: productoId,
                    laborMadre: grupo,
                    requiereBloque: true,
                    requierePases: false,
                    esVarios: false
                });
                actividadId = nuevaAct.id;
                actividades.push(nuevaAct); // actualizar lista local
            } catch {
                showNotification('Error al crear la labor', 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar';
                return;
            }
        }

        // ── Payload ─────────────────────────────────────────────────────────────
        const payload = {
            grupo,
            producto:    { id: productoId },
            actividad:   actividadId ? { id: actividadId } : undefined,
            rendimiento: parseFloat(form.rend_valor.value),
            unidad:      { id: parseInt(form.rend_unidad.value) },
            notas:       form.rend_notas.value.trim() || null
        };

        if (!payload.rendimiento || !payload.unidad.id) {
            showNotification('Completa el valor y la unidad', 'warning'); return;
        }

        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        try {
            if (editandoRendId) {
                await api.updateRendimiento(editandoRendId, payload);
                showNotification('Rendimiento actualizado ✓', 'success');
            } else {
                await api.createRendimiento(payload);
                showNotification('Rendimiento creado ✓', 'success');
            }
            document.getElementById('modal-rendimiento').style.display = 'none';
            App.navigate('rendimientos');
        } catch (err) {
            showNotification('Error al guardar rendimiento', 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar';
        }
    };

    window.eliminarRendimiento = async (id) => {
        if (!confirm('¿Desactivar este rendimiento?')) return;
        try {
            await api.deleteRendimiento(id);
            showNotification('Rendimiento desactivado', 'success');
            App.navigate('rendimientos');
        } catch {
            showNotification('Error al desactivar', 'error');
        }
    };

    // ─── Funciones CRUD Área ───────────────────────────────────────────────────
    window.crearArea = async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            await api.createArea({ codigo: form.codigo.value, nombre: form.nombre.value, descripcion: form.descripcion.value });
            showNotification('Área creada exitosamente', 'success');
            document.getElementById('modal-area').style.display = 'none';
            App.navigate('rendimientos');
        } catch { showNotification('Error al crear área', 'error'); }
    };

    window.abrirEditarArea = (id) => {
        const a = areas.find(x => x.id === id);
        if (!a) return;
        const form = document.getElementById('form-edit-area');
        form.area_id.value = a.id;
        form.area_codigo.value = a.codigo || '';
        form.area_nombre.value = a.nombre || '';
        form.area_descripcion.value = a.descripcion || '';
        document.getElementById('modal-edit-area').style.display = 'flex';
    };

    window.actualizarArea = async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            await api.updateArea(parseInt(form.area_id.value), {
                codigo: form.area_codigo.value,
                nombre: form.area_nombre.value,
                descripcion: form.area_descripcion.value
            });
            showNotification('Área actualizada ✓', 'success');
            document.getElementById('modal-edit-area').style.display = 'none';
            App.navigate('rendimientos');
        } catch { showNotification('Error al actualizar área', 'error'); }
    };

    // ─── Funciones CRUD Producto ───────────────────────────────────────────────
    window.crearProducto = async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            await api.createProducto({ codigo: form.codigo.value, nombre: form.nombre.value, densidad: parseFloat(form.densidad.value), descripcion: form.descripcion.value });
            showNotification('Producto creado exitosamente', 'success');
            document.getElementById('modal-producto').style.display = 'none';
            App.navigate('rendimientos');
        } catch { showNotification('Error al crear producto', 'error'); }
    };

    window.abrirEditarProducto = (id) => {
        const p = productos.find(x => x.id === id);
        if (!p) return;
        const form = document.getElementById('form-edit-producto');
        form.prod_id.value = p.id;
        form.prod_codigo.value = p.codigo || '';
        form.prod_nombre.value = p.nombre || '';
        form.prod_densidad.value = p.densidad || '';
        form.prod_descripcion.value = p.descripcion || '';
        document.getElementById('modal-edit-producto').style.display = 'flex';
    };

    window.actualizarProducto = async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            await api.updateProducto(parseInt(form.prod_id.value), {
                codigo: form.prod_codigo.value,
                nombre: form.prod_nombre.value,
                densidad: parseFloat(form.prod_densidad.value),
                descripcion: form.prod_descripcion.value
            });
            showNotification('Producto actualizado ✓', 'success');
            document.getElementById('modal-edit-producto').style.display = 'none';
            App.navigate('rendimientos');
        } catch { showNotification('Error al actualizar producto', 'error'); }
    };

    // ─── Funciones CRUD Unidad de Medida ───────────────────────────────────────
    window.crearUnidad = async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            await api.createUnidad({ 
                codigo: form.codigo.value, 
                nombre: form.nombre.value, 
                descripcion: form.descripcion.value,
                factorAHoras: parseFloat(form.factorAHoras.value || 1),
                tipoConversion: form.tipoConversion.value || 'MULTIPLICAR'
            });
            showNotification('Unidad de medida creada exitosamente', 'success');
            document.getElementById('modal-unidad').style.display = 'none';
            App.navigate('rendimientos');
        } catch { showNotification('Error al crear unidad', 'error'); }
    };

    window.abrirEditarUnidad = (id) => {
        const u = unidades.find(x => x.id === id);
        if (!u) return;
        const form = document.getElementById('form-edit-unidad');
        form.uni_id.value = u.id;
        form.uni_codigo.value = u.codigo || '';
        form.uni_nombre.value = u.nombre || '';
        form.uni_descripcion.value = u.descripcion || '';
        form.uni_factor.value = u.factorAHoras || 1;
        form.uni_tipo.value = u.tipoConversion || 'MULTIPLICAR';
        document.getElementById('modal-edit-unidad').style.display = 'flex';
    };

    window.actualizarUnidad = async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            await api.updateUnidad(parseInt(form.uni_id.value), {
                codigo: form.uni_codigo.value,
                nombre: form.uni_nombre.value,
                descripcion: form.uni_descripcion.value,
                factorAHoras: parseFloat(form.uni_factor.value || 1),
                tipoConversion: form.uni_tipo.value
            });
            showNotification('Unidad de medida actualizada ✓', 'success');
            document.getElementById('modal-edit-unidad').style.display = 'none';
            App.navigate('rendimientos');
        } catch { showNotification('Error al actualizar unidad', 'error'); }
    };

    // ─── Funciones CRUD Actividad ──────────────────────────────────────────────
    window.crearActividad = async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            await api.createActividad({ codigo: form.codigo.value, nombre: form.nombre.value, areaId: parseInt(form.areaId.value), requiereBloque: form.requiereBloque.checked, requierePases: form.requierePases.checked, esVarios: form.esVarios.checked });
            showNotification('Actividad creada exitosamente', 'success');
            document.getElementById('modal-actividad').style.display = 'none';
            App.navigate('rendimientos');
        } catch { showNotification('Error al crear actividad', 'error'); }
    };

    window.abrirEditarActividad = (id) => {
        const a = actividades.find(x => x.id === id);
        if (!a) return;
        const form = document.getElementById('form-edit-actividad');
        form.act_id.value         = a.id;
        form.act_codigo.value     = a.codigo || '';
        form.act_nombre.value     = a.nombre || '';
        form.act_area.value       = a.area?.id || '';
        form.act_bloque.checked   = !!a.requiereBloque;
        form.act_pases.checked    = !!a.requierePases;
        form.act_varios.checked   = !!a.esVarios;
        document.getElementById('modal-edit-actividad').style.display = 'flex';
    };

    window.actualizarActividad = async (e) => {
        e.preventDefault();
        const form = e.target;
        try {
            await api.updateActividad(parseInt(form.act_id.value), {
                codigo: form.act_codigo.value,
                nombre: form.act_nombre.value,
                areaId: parseInt(form.act_area.value),
                requiereBloque: form.act_bloque.checked,
                requierePases: form.act_pases.checked,
                esVarios: form.act_varios.checked
            });
            showNotification('Actividad actualizada ✓', 'success');
            document.getElementById('modal-edit-actividad').style.display = 'none';
            App.navigate('rendimientos');
        } catch { showNotification('Error al actualizar actividad', 'error'); }
    };

    // ─── Filtros en cascada: Grupo → Cultivo ──────────────────────────────────
    window.filtrarPorGrupo = (grupo) => {
        filtroGrupoActivo  = grupo;
        filtroCultivoActivo = '';   // resetear cultivo al cambiar grupo

        // Activar botón de grupo
        document.querySelectorAll('.grupo-filter-btn').forEach(b => {
            if (b.dataset.grupo === grupo) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });

        // Actualizar fila de cultivos
        const cultRow = document.getElementById('cultivos-filter-row');
        if (cultRow) cultRow.innerHTML = renderCultivosBtns(grupo);

        // Actualizar tabla
        document.getElementById('tbody-rendimientos').innerHTML = renderRendimientos(grupo, '');
    };

    window.filtrarPorCultivo = (cultivo) => {
        filtroCultivoActivo = cultivo;

        // Activar botón de cultivo activo
        document.querySelectorAll('.cultivo-filter-btn').forEach(b => {
            if (b.dataset.cultivo === cultivo) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });

        // Actualizar tabla
        document.getElementById('tbody-rendimientos').innerHTML = renderRendimientos(filtroGrupoActivo, cultivo);
    };

    return `
        <div class="view-content">
            <!-- ===== MODAL RENDIMIENTO (Crear/Editar) ===== -->
            <div id="modal-rendimiento" class="modal-overlay" style="display:none;">
                <div class="modal-content" style="max-width:500px;">
                    <h3 id="modal-rend-titulo"><i class="fa-solid fa-gauge-high"></i> Nuevo Rendimiento</h3>
                    <form id="form-rendimiento" onsubmit="guardarRendimiento(event)">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem;">
                            <!-- GRUPO: select de grupos existentes + opción "Otro" -->
                            <div class="form-group" style="grid-column:1/-1;">
                                <label><i class="fa-solid fa-layer-group" style="color:#F59E0B;"></i> Grupo (Actividad Madre)</label>
                                <select name="rend_grupo_select" required
                                    onchange="(function(v){const w=document.getElementById('rend_grupo_custom_wrap');w.style.display=v==='__otro__'?'block':'none';})(this.value)">
                                    <option value="">Seleccionar...</option>
                                    ${grupos.map(g => `<option value="${g}">${g}</option>`).join('')}
                                    <option value="__otro__">✏️ Otro / nuevo grupo...</option>
                                </select>
                                <!-- Campo libre solo cuando elige "Otro" -->
                                <div id="rend_grupo_custom_wrap" style="display:none; margin-top:0.4rem;">
                                    <input type="text" name="rend_grupo_custom"
                                        placeholder="Escribe el nombre del nuevo grupo (ej: TUTOREO)"
                                        style="text-transform:uppercase; width:100%; box-sizing:border-box;">
                                </div>
                                <small style="color:var(--text-muted);">Debe coincidir exactamente con el tab en Plan Semanal</small>
                            </div>

                            <!-- ÁREA: siempre visible y requerido -->
                            <div class="form-group">
                                <label><i class="fa-solid fa-layer-group" style="color:#3B82F6;"></i> Área de Trabajo</label>
                                <select name="rend_area" id="rend_area" required onchange="filtrarDatalistLabores(this.value)">
                                    <option value="">Seleccionar...</option>
                                    ${areas.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('')}
                                </select>
                            </div>

                            <!-- CULTIVO -->
                            <div class="form-group">
                                <label><i class="fa-solid fa-seedling" style="color:#10B981;"></i> Cultivo</label>
                                <select name="rend_producto" required
                                    onchange="(function(v){const w=document.getElementById('rend_cultivo_nuevo_wrap');w.style.display=v==='__nuevo_cultivo__'?'block':'none';})(this.value)">
                                    <option value="">Seleccionar...</option>
                                    ${productos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
                                    <option value="__nuevo_cultivo__">🌱 Nuevo cultivo...</option>
                                </select>
                                <!-- Mini-form inline para nuevo cultivo -->
                                <div id="rend_cultivo_nuevo_wrap" style="display:none; margin-top:0.5rem;
                                    background:rgba(16,185,129,0.07); border:1px solid rgba(16,185,129,0.25);
                                    border-radius:8px; padding:0.6rem 0.75rem;">
                                    <div style="font-size:0.72rem; color:#6EE7B7; margin-bottom:0.4rem; font-weight:600;">
                                        <i class="fa-solid fa-circle-plus"></i> Datos del nuevo cultivo
                                    </div>
                                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem;">
                                        <div>
                                            <label style="font-size:0.72rem; color:var(--text-muted);">Código (sin espacios)</label>
                                            <input type="text" name="cultivo_nuevo_codigo"
                                                placeholder="Ej: LISIANTHUS"
                                                style="text-transform:uppercase; font-size:0.82rem; padding:0.3rem 0.5rem; width:100%; box-sizing:border-box;">
                                        </div>
                                        <div>
                                            <label style="font-size:0.72rem; color:var(--text-muted);">Densidad (plantas/cama)</label>
                                            <input type="number" name="cultivo_nuevo_densidad"
                                                placeholder="Ej: 800" step="1" min="1"
                                                style="font-size:0.82rem; padding:0.3rem 0.5rem; width:100%; box-sizing:border-box;">
                                        </div>
                                        <div style="grid-column:1/-1;">
                                            <label style="font-size:0.72rem; color:var(--text-muted);">Nombre completo</label>
                                            <input type="text" name="cultivo_nuevo_nombre"
                                                placeholder="Ej: Lisianthus Blanco"
                                                style="font-size:0.82rem; padding:0.3rem 0.5rem; width:100%; box-sizing:border-box;">
                                        </div>
                                    </div>
                                    <small style="color:#6EE7B7; font-size:0.7rem;">Este cultivo se creará al guardar el rendimiento</small>
                                </div>
                            </div>

                            <!-- LABOR: se filtra sugerencias según área seleccionada -->
                            <div class="form-group" style="grid-column:1/-1;">
                                <label><i class="fa-solid fa-person-digging" style="color:#93C5FD;"></i> Labor (Actividad)</label>
                                <input type="text" name="rend_labor_nombre" id="rend_labor_nombre" required
                                    list="datalist-labores"
                                    placeholder="Selecciona o escribe la labor"
                                    oninput="(function(v){
                                        const areaVal = document.getElementById('rend_area').value;
                                        const prodSelect = document.querySelector('select[name=&quot;rend_producto&quot;]');
                                        const prodId = prodSelect ? (parseInt(prodSelect.value) || null) : null;
                                        const acto = window._actividadesList||[];
                                        const found = acto.find(a=>a.nombre.toLowerCase()===v.toLowerCase() && 
                                            (!areaVal || a.area?.id == areaVal) && 
                                            ((!a.producto && !prodId) || (a.producto && a.producto.id === prodId))
                                        );
                                        document.getElementById('rend_labor_id_hidden').value = found ? found.id : '';
                                     })(this.value)">
                                <datalist id="datalist-labores">
                                    <!-- Se llena dinámicamente -->
                                </datalist>
                                <input type="hidden" id="rend_labor_id_hidden" value="">
                                <small style="color:var(--text-muted);">Si escribes una labor nueva en el área seleccionada, se creará automáticamente.</small>
                            </div>

                            <!-- VALOR + UNIDAD -->
                            <div class="form-group">
                                <label><i class="fa-solid fa-hashtag"></i> Valor Rendimiento</label>
                                <input type="number" name="rend_valor" step="0.01" min="0.01" required placeholder="Ej: 345">
                            </div>
                            <div class="form-group">
                                <label><i class="fa-solid fa-ruler"></i> Unidad de Medida</label>
                                <select name="rend_unidad" required>
                                    <option value="">Seleccionar...</option>
                                    ${unidades.map(u => `<option value="${u.id}">${u.nombre} (${u.codigo})</option>`).join('')}
                                </select>
                                <small style="color:var(--text-muted);">Define cómo se calculan las horas</small>
                            </div>

                            <!-- NOTAS -->
                            <div class="form-group" style="grid-column:1/-1;">
                                <label>Notas (opcional)</label>
                                <input type="text" name="rend_notas" placeholder="Observaciones, condiciones, etc.">
                            </div>
                        </div>
                        <div class="modal-actions" style="margin-top:1rem;">
                            <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-rendimiento').style.display='none'">Cancelar</button>
                            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Guardar</button>
                        </div>
                    </form>
                </div>
            </div>

        <!-- ===== MODAL NUEVA ÁREA ===== -->
        <div id="modal-area" class="modal-overlay" style="display:none;">
            <div class="modal-content">
                <h3><i class="fa-solid fa-layer-group"></i> Nueva Área</h3>
                <form onsubmit="crearArea(event)">
                    <div class="form-group"><label>Código (TTHH)</label><input type="text" name="codigo" required placeholder="Ej: PY_FUMIGACION"></div>
                    <div class="form-group"><label>Nombre</label><input type="text" name="nombre" required placeholder="Ej: Fumigación"></div>
                    <div class="form-group"><label>Descripción</label><input type="text" name="descripcion"></div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-area').style.display='none'">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ===== MODAL NUEVO PRODUCTO ===== -->
        <div id="modal-producto" class="modal-overlay" style="display:none;">
            <div class="modal-content">
                <h3><i class="fa-solid fa-seedling"></i> Nuevo Producto</h3>
                <form onsubmit="crearProducto(event)">
                    <div class="form-group"><label>Código</label><input type="text" name="codigo" required placeholder="Ej: ROSA_ROJA"></div>
                    <div class="form-group"><label>Nombre</label><input type="text" name="nombre" required placeholder="Ej: Rosa Roja"></div>
                    <div class="form-group"><label>Densidad (plantas/cama)</label><input type="number" name="densidad" step="0.1" required placeholder="Ej: 250"></div>
                    <div class="form-group"><label>Descripción</label><input type="text" name="descripcion"></div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-producto').style.display='none'">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ===== MODAL NUEVA ACTIVIDAD ===== -->
        <div id="modal-actividad" class="modal-overlay" style="display:none;">
            <div class="modal-content">
                <h3><i class="fa-solid fa-tasks"></i> Nueva Actividad</h3>
                <form onsubmit="crearActividad(event)">
                    <div class="form-group"><label>Código</label><input type="text" name="codigo" required placeholder="Ej: FUMIG_PLAGA"></div>
                    <div class="form-group"><label>Nombre</label><input type="text" name="nombre" required placeholder="Ej: Fumigación de plagas"></div>
                    <div class="form-group"><label>Área</label>
                        <select name="areaId" required>
                            <option value="">Seleccionar...</option>
                            ${areas.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="display:flex; gap:1rem;">
                        <label><input type="checkbox" name="requiereBloque"> Requiere Bloque</label>
                        <label><input type="checkbox" name="requierePases"> Requiere Pases</label>
                        <label><input type="checkbox" name="esVarios"> Es Varios</label>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-actividad').style.display='none'">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ===== MODAL EDITAR ACTIVIDAD ===== -->
        <div id="modal-edit-actividad" class="modal-overlay" style="display:none;">
            <div class="modal-content">
                <h3><i class="fa-solid fa-pen"></i> Editar Actividad</h3>
                <form id="form-edit-actividad" onsubmit="actualizarActividad(event)">
                    <input type="hidden" name="act_id">
                    <div class="form-group"><label>Código</label><input type="text" name="act_codigo" required></div>
                    <div class="form-group"><label>Nombre</label><input type="text" name="act_nombre" required></div>
                    <div class="form-group"><label>Área</label>
                        <select name="act_area" required>
                            <option value="">Seleccionar...</option>
                            ${areas.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="display:flex; gap:1rem;">
                        <label><input type="checkbox" name="act_bloque"> Requiere Bloque</label>
                        <label><input type="checkbox" name="act_pases"> Requiere Pases</label>
                        <label><input type="checkbox" name="act_varios"> Es Varios</label>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-edit-actividad').style.display='none'">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Actualizar</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ===== MODAL EDITAR ÁREA ===== -->
        <div id="modal-edit-area" class="modal-overlay" style="display:none;">
            <div class="modal-content">
                <h3><i class="fa-solid fa-pen"></i> Editar Área</h3>
                <form id="form-edit-area" onsubmit="actualizarArea(event)">
                    <input type="hidden" name="area_id">
                    <div class="form-group"><label>Código</label><input type="text" name="area_codigo" required></div>
                    <div class="form-group"><label>Nombre</label><input type="text" name="area_nombre" required></div>
                    <div class="form-group"><label>Descripción</label><input type="text" name="area_descripcion"></div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-edit-area').style.display='none'">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Actualizar</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ===== MODAL EDITAR PRODUCTO ===== -->
        <div id="modal-edit-producto" class="modal-overlay" style="display:none;">
            <div class="modal-content">
                <h3><i class="fa-solid fa-pen"></i> Editar Producto</h3>
                <form id="form-edit-producto" onsubmit="actualizarProducto(event)">
                    <input type="hidden" name="prod_id">
                    <div class="form-group"><label>Código</label><input type="text" name="prod_codigo" required></div>
                    <div class="form-group"><label>Nombre</label><input type="text" name="prod_nombre" required></div>
                    <div class="form-group"><label>Densidad (plantas/cama)</label><input type="number" name="prod_densidad" step="0.1" required></div>
                    <div class="form-group"><label>Descripción</label><input type="text" name="prod_descripcion"></div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-edit-producto').style.display='none'">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Actualizar</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ===== MODAL NUEVA UNIDAD ===== -->
        <div id="modal-unidad" class="modal-overlay" style="display:none;">
            <div class="modal-content">
                <h3><i class="fa-solid fa-ruler"></i> Nueva Unidad de Medida</h3>
                <form onsubmit="crearUnidad(event)">
                    <div class="form-group"><label>Código</label><input type="text" name="codigo" required placeholder="Ej: CAMAS_HORA"></div>
                    <div class="form-group"><label>Nombre</label><input type="text" name="nombre" required placeholder="Ej: Camas por hora"></div>
                    <div class="form-group"><label>Descripción</label><input type="text" name="descripcion"></div>
                    <div class="form-group"><label>Factor a Horas</label><input type="number" name="factorAHoras" step="0.0001" required value="1" placeholder="Ej: 1"></div>
                    <div class="form-group"><label>Tipo Conversión</label>
                        <select name="tipoConversion" required>
                            <option value="MULTIPLICAR">Multiplicar</option>
                            <option value="DIVIDIR">Dividir</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-unidad').style.display='none'">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ===== MODAL EDITAR UNIDAD ===== -->
        <div id="modal-edit-unidad" class="modal-overlay" style="display:none;">
            <div class="modal-content">
                <h3><i class="fa-solid fa-pen"></i> Editar Unidad de Medida</h3>
                <form id="form-edit-unidad" onsubmit="actualizarUnidad(event)">
                    <input type="hidden" name="uni_id">
                    <div class="form-group"><label>Código</label><input type="text" name="uni_codigo" required></div>
                    <div class="form-group"><label>Nombre</label><input type="text" name="uni_nombre" required></div>
                    <div class="form-group"><label>Descripción</label><input type="text" name="uni_descripcion"></div>
                    <div class="form-group"><label>Factor a Horas</label><input type="number" name="uni_factor" step="0.0001" required></div>
                    <div class="form-group"><label>Tipo Conversión</label>
                        <select name="uni_tipo" required>
                            <option value="MULTIPLICAR">Multiplicar</option>
                            <option value="DIVIDIR">Dividir</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="document.getElementById('modal-edit-unidad').style.display='none'">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-save"></i> Actualizar</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ===== BARRA SUPERIOR ===== -->
        <div class="top-actions" style="margin-bottom:1rem; justify-content:flex-end; gap:0.5rem; flex-wrap:wrap;">
            <button class="btn btn-outline" onclick="openModal('modal-area')"><i class="fa-solid fa-layer-group"></i> + Área</button>
            <button class="btn btn-outline" onclick="openModal('modal-producto')"><i class="fa-solid fa-seedling"></i> + Producto</button>
            <button class="btn btn-outline" onclick="openModal('modal-actividad')"><i class="fa-solid fa-tasks"></i> + Actividad</button>
            <button class="btn btn-outline" onclick="openModal('modal-unidad')"><i class="fa-solid fa-ruler"></i> + Unidad</button>
            <button class="btn btn-primary" onclick="abrirNuevoRendimiento()"><i class="fa-solid fa-plus"></i> + Rendimiento</button>
        </div>

        <!-- ===== CARDS RESUMEN ===== -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1rem; margin-bottom:1.5rem;">
            <div class="card">
                <h3><i class="fa-solid fa-layer-group" style="color:var(--primary);"></i> Áreas <span class="badge">${areas.length}</span></h3>
                <div style="margin-top:0.75rem; max-height:180px; overflow-y:auto;">
                    ${areas.length ? areas.map(a => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0.6rem; background:rgba(0,0,0,0.2); border-radius:6px; margin-bottom:0.4rem;">
                            <div style="display:flex; flex-direction:column; gap:0.1rem;">
                                <span style="font-size:0.85rem; font-weight:600; color:white;">${a.nombre}</span>
                                <span style="font-size:0.68rem; color:var(--text-muted);">${a.codigo}</span>
                            </div>
                            <button onclick="abrirEditarArea(${a.id})" style="background:rgba(59,130,246,0.15); color:#93C5FD; border:1px solid rgba(59,130,246,0.3); border-radius:4px; padding:2px 6px; cursor:pointer;">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                        </div>`).join('') : '<p style="color:var(--text-muted); font-size:0.85rem;">Sin áreas</p>'}
                </div>
            </div>
            <div class="card">
                <h3><i class="fa-solid fa-seedling" style="color:var(--secondary);"></i> Cultivos <span class="badge">${productos.length}</span></h3>
                <div style="margin-top:0.75rem; max-height:180px; overflow-y:auto;">
                    ${productos.length ? productos.map(p => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0.6rem; background:rgba(0,0,0,0.2); border-radius:6px; margin-bottom:0.4rem;">
                            <div style="display:flex; flex-direction:column; gap:0.1rem;">
                                <span style="font-size:0.85rem; font-weight:600; color:white;">${p.nombre}</span>
                                <span style="font-size:0.68rem; color:var(--text-muted);">${p.codigo} - ${p.densidad} pl/cama</span>
                            </div>
                            <button onclick="abrirEditarProducto(${p.id})" style="background:rgba(59,130,246,0.15); color:#93C5FD; border:1px solid rgba(59,130,246,0.3); border-radius:4px; padding:2px 6px; cursor:pointer;">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                        </div>`).join('') : '<p style="color:var(--text-muted); font-size:0.85rem;">Sin cultivos</p>'}
                </div>
            </div>
            <div class="card">
                <h3><i class="fa-solid fa-ruler" style="color:#F59E0B;"></i> Unidades de Medida <span class="badge">${unidades.length}</span></h3>
                <div style="margin-top:0.75rem; max-height:180px; overflow-y:auto;">
                    ${unidades.length ? unidades.map(u => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0.6rem; background:rgba(0,0,0,0.2); border-radius:6px; margin-bottom:0.4rem;">
                            <div style="display:flex; flex-direction:column; gap:0.1rem;">
                                <span style="font-size:0.82rem; font-weight:600; color:white;">${u.nombre}</span>
                                <span style="font-size:0.68rem; color:#FCD34D;">${u.codigo}</span>
                            </div>
                            <button onclick="abrirEditarUnidad(${u.id})" style="background:rgba(59,130,246,0.15); color:#93C5FD; border:1px solid rgba(59,130,246,0.3); border-radius:4px; padding:2px 6px; cursor:pointer;">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                        </div>`).join('') : '<p style="color:var(--text-muted); font-size:0.85rem;">Sin unidades</p>'}
                </div>
            </div>
        </div>

        <!-- ===== TABLA RENDIMIENTOS ===== -->
        <div class="card" style="margin-bottom:1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.5rem;">
                <h3 style="margin:0;"><i class="fa-solid fa-gauge-high" style="color:var(--primary);"></i>
                    Rendimientos <span class="badge">${rendimientos.length}</span>
                </h3>
            </div>

            <!-- Fila 1: Filtro por GRUPO -->
            <div style="margin-bottom:0.4rem;">
                <span style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-right:0.5rem;">
                    <i class="fa-solid fa-layer-group"></i> Actividad madre
                </span>
                <div style="display:inline-flex; gap:0.3rem; flex-wrap:wrap; margin-top:0.25rem;">
                    <button class="grupo-filter-btn active" data-grupo="" onclick="filtrarPorGrupo('')">
                        Todos
                    </button>
                    ${grupos.map(g => `
                        <button class="grupo-filter-btn" data-grupo="${g}" onclick="filtrarPorGrupo('${g}')">
                            ${g}
                        </button>`).join('')}
                </div>
            </div>

            <!-- Fila 2: Filtro por CULTIVO (dinámico) -->
            <div style="margin-bottom:0.75rem; padding:0.4rem 0.5rem; background:rgba(16,185,129,0.05); border-radius:6px; border:1px solid rgba(16,185,129,0.12);">
                <span style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-right:0.5rem;">
                    <i class="fa-solid fa-seedling" style="color:#10B981;"></i> Cultivo
                </span>
                <div id="cultivos-filter-row" style="display:inline-flex; gap:0.3rem; flex-wrap:wrap; margin-top:0.25rem;">
                    ${renderCultivosBtns('')}
                </div>
            </div>
            <div style="max-height:400px; overflow-y:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.83rem;">
                    <thead>
                        <tr style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; position:sticky; top:0; background:#1E293B; z-index:1;">
                            <th style="padding:0.4rem; text-align:left;">Grupo</th>
                            <th style="padding:0.4rem; text-align:left;">Cultivo</th>
                            <th style="padding:0.4rem; text-align:left;">Labor</th>
                            <th style="padding:0.4rem; text-align:center;">Rend.</th>
                            <th style="padding:0.4rem; text-align:left;">Unidad</th>
                            <th style="padding:0.4rem; text-align:left;">Notas</th>
                            <th style="padding:0.4rem; text-align:center; width:80px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-rendimientos">
                        ${renderRendimientos()}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- ===== TABLA ACTIVIDADES ===== -->
        <div class="card">
            <h3><i class="fa-solid fa-tasks" style="color:var(--primary);"></i> Actividades <span class="badge">${actividades.length}</span></h3>
            <div style="max-height:300px; overflow-y:auto; margin-top:0.75rem;">
                <table style="width:100%; border-collapse:collapse; font-size:0.83rem;">
                    <thead>
                        <tr style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">
                            <th style="padding:0.4rem; text-align:left;">Código</th>
                            <th style="padding:0.4rem; text-align:left;">Nombre</th>
                            <th style="padding:0.4rem; text-align:left;">Área</th>
                            <th style="padding:0.4rem; text-align:center;">Bloque</th>
                            <th style="padding:0.4rem; text-align:center;">Pases</th>
                            <th style="padding:0.4rem; text-align:center; width:70px;">Editar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${actividades.length ? actividades.map(a => `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                <td style="padding:0.4rem; font-size:0.72rem; color:var(--text-muted);">${a.codigo || '-'}</td>
                                <td style="padding:0.4rem;">${a.nombre}</td>
                                <td style="padding:0.4rem;"><span class="badge" style="font-size:0.68rem;">${a.area ? a.area.nombre : 'Sin área'}</span></td>
                                <td style="padding:0.4rem; text-align:center;">${a.requiereBloque ? '<i class="fa-solid fa-check" style="color:#10B981;"></i>' : '-'}</td>
                                <td style="padding:0.4rem; text-align:center;">${a.requierePases ? '<i class="fa-solid fa-check" style="color:#10B981;"></i>' : '-'}</td>
                                <td style="padding:0.4rem; text-align:center;">
                                    <button onclick="abrirEditarActividad(${a.id})"
                                        style="background:rgba(59,130,246,0.15); color:#93C5FD; border:1px solid rgba(59,130,246,0.3); border-radius:5px; padding:0.2rem 0.45rem; cursor:pointer;">
                                        <i class="fa-solid fa-pen-to-square"></i>
                                    </button>
                                </td>
                            </tr>`).join('') : `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1.5rem;">Sin actividades</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- TIP INFO -->
        <div class="card" style="margin-top:1rem; background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(5,150,105,0.2));">
            <i class="fa-solid fa-lightbulb stat-icon"></i>
            <div class="stat-title">Cómo se agrupan los rendimientos en Plan Semanal</div>
            <div style="font-size:0.85rem; color:rgba(255,255,255,0.8); margin-top:0.4rem; line-height:1.6;">
                <strong>Grupo</strong> → Tab de actividad madre (COSECHA, DESBROTE…) <br>
                <strong>Cultivo</strong> → Card de producto (Gypsophila, Hypericum…) <br>
                <strong>Labor</strong> → Botón de labor específica con su rendimiento <br>
                <strong>Unidad</strong> → Define la fórmula: <em>horas = cantidad ÷ rendimiento</em>
            </div>
        </div>
    </div>`;
});
