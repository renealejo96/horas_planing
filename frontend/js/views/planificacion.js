const initPlanificacionView = (mode) => { return async () => {
    // ========== CONSTANTES ==========
    const TALLOS_POR_MALLA = {
        'GYPSOPHILA': 25, 'HYPERICUM': 25, 'VERONICA': 25, 'SOLIDAGO': 25, 'SUNFLOWER': 30, 'Eucalitpos': 25
    };
    
    const BLOQUES = App.BLOQUES;
    
    // ========== ESTADO ==========
    let semanaActual = null, semanaSiguiente = null, grupos = [], planificacionItems = [];
    let semanaSeleccionada = null, grupoActivo = null, cultivoActivo = null, laborActiva = null;
    let cultivosGrupo = [], rendimientosGrupo = [];
    let filasData = {};
    let filaCounter = 0;
    let editandoId = null;
    let cosechaExpandido = false; // Estado para formulario COSECHA colapsable
    let resumenExpandido = {}; // Estado para acordeones en el resumen semanal
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // ========== CARGAR DATOS INICIALES ==========
    let semanasDisponibles = [];
    try {
        [semanaActual, semanaSiguiente, grupos, semanasDisponibles] = await Promise.all([
            api.getSemanaActual().catch(() => null),
            api.getSemanaSiguiente().catch(() => null),
            api.getGrupos().catch(() => []),
            api.getSemanasDisponibles().catch(() => [])
        ]);
        
        // Filtrar grupos por permisos de usuario
        if (user.rol !== 'ADMIN') {
            const permitidas = (user.actividadesPermitidas || '').split(',').map(s => s.trim().toUpperCase());
            grupos = grupos.filter(g => {
                const grupoNombre = typeof g === 'string' ? g : (g.nombre || g.codigo || String(g));
                return permitidas.includes(grupoNombre.toUpperCase());
            });
        }

        // Predeterminar la semana según el modo de planificación
        if (mode === 'actual') {
            semanaSeleccionada = semanaActual || semanaSiguiente;
        } else {
            semanaSeleccionada = semanaSiguiente || semanaActual;
        }
        if (semanaSeleccionada) {
            // Actualizar el título de la página dinámicamente con el código de la semana
            const titleSpan = document.getElementById('page-title');
            if (titleSpan) {
                if (mode === 'actual') {
                    titleSpan.innerText = `${semanaSeleccionada.codigoAass} Plan Semanal Actual`;
                } else {
                    titleSpan.innerText = `${semanaSeleccionada.codigoAass} Planificación Semanal`;
                }
            }

            planificacionItems = await api.getPlanificacionSemana(semanaSeleccionada.codigoAass).catch(() => []);
            
            // Filtrar planificacionItems por permisos
            if (user.rol !== 'ADMIN') {
                const permitidas = (user.actividadesPermitidas || '').split(',').map(s => s.trim().toUpperCase());
                planificacionItems = planificacionItems.filter(p => {
                    const rawName = (p.actividad?.laborMadre || p.actividad?.grupo || p.actividad?.nombre || 'GENERAL').toUpperCase();
                    const grupo = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
                    return permitidas.includes(grupo);
                });
            }
        }
    } catch (e) { console.log('Error cargando datos iniciales:', e); }
    
    // Calcular horas totales de TODA la semana
    const calcularTotalHorasSemana = () => planificacionItems.reduce((sum, p) => sum + (p.horasAjustadas || p.horasCalculadas || 0), 0);
    
    // Calcular horas del grupo activo
    const calcularHorasGrupo = () => {
        if (!grupoActivo) return 0;
        return getPlanificacionFiltrada().reduce((sum, p) => sum + (p.horasAjustadas || p.horasCalculadas || 0), 0);
    };
    
    const esCosecha = () => grupoActivo === 'COSECHA';
    
    // Filtrar planificacion por grupo activo y cultivo activo
    const getPlanificacionFiltrada = () => {
        if (!grupoActivo) return [];
        return planificacionItems.filter(p => {
            // Usar laborMadre si existe, sino buscar en nombre
            const laborMadre = (p.actividad?.laborMadre || '').toUpperCase();
            const actNombre = (p.actividad?.nombre || '').toUpperCase();
            const coincideGrupo = laborMadre === grupoActivo || actNombre.includes(grupoActivo);
            if (!coincideGrupo) return false;
            
            if (grupoActivo !== 'COSECHA' && cultivoActivo) {
                const pdcto = p.producto || p.actividad?.producto;
                const pCultivo = (pdcto?.codigo || pdcto?.nombre || 'GENERAL').toUpperCase();
                return pCultivo === cultivoActivo.toUpperCase();
            }
            return true;
        });
    };
    
    // Obtener labores únicas del grupo/cultivo actual
    const getLaboresUnicas = () => {
        const laboresFiltradas = cultivoActivo 
            ? rendimientosGrupo.filter(r => r.productoCodigo === cultivoActivo || r.producto.toUpperCase() === cultivoActivo)
            : [];
        const laboresMap = new Map();
        laboresFiltradas.forEach(r => {
            if (!laboresMap.has(r.labor)) {
                laboresMap.set(r.labor, r);
            }
        });
        return Array.from(laboresMap.values());
    };
    
    // ========== GUARDAR VALORES ACTUALES ==========
    const guardarValoresActuales = () => {
        document.querySelectorAll('div[data-fila], tr[data-fila], #cosecha-form .cosecha-row').forEach(row => {
            const filaId = row.dataset.fila || row.dataset.cultivo;
            const inp = row.querySelector('.inp-cantidad');
            const sel = row.querySelector('.sel-bloque');
            if (inp && filaId) {
                filasData[filaId] = {
                    cantidad: inp.value || '',
                    bloque: sel ? sel.value : ''
                };
            }
        });
    };
    
    // ========== RENDER SELECTOR DE SEMANAS ==========
    const renderSemanaSelector = () => {
        if (!semanaSeleccionada) {
            return `<span style="color:#EF4444; font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Sin semana definida</span>`;
        }
        
        const label = semanaSeleccionada.codigoAass + (semanaSeleccionada.fechaInicio ? ` (${semanaSeleccionada.fechaInicio})` : '');
        const isActual = mode === 'actual';
        const badgeColor = isActual ? '#10B981' : '#818CF8';
        const bgStyle = isActual ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)';
        const borderStyle = isActual ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)';
        const textLabel = isActual ? '★ Semana Actual' : '✦ Semana Siguiente';
        
        return `
            <div style="padding:0.4rem 0.8rem; background:${bgStyle}; color:${badgeColor}; border:1px solid ${borderStyle}; 
                       border-radius:8px; font-size:0.85rem; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem;">
                <i class="fa-solid ${isActual ? 'fa-calendar-check' : 'fa-calendar-plus'}"></i>
                <span>${textLabel}: <strong>${label}</strong></span>
            </div>
        `;
    };

    // ========== RENDER TABS GRUPOS ==========
    const renderGrupoTabs = () => {
        if (!grupos.length) return '<span style="color:var(--text-muted);">Sin grupos</span>';
        return grupos.map(g => {
            // Asegurar que g es string
            const grupoNombre = typeof g === 'string' ? g : (g.nombre || g.codigo || String(g));
            const isActive = grupoActivo === grupoNombre ? 'active' : '';
            return `
            <button class="grupo-tab ${isActive}" data-grupo="${grupoNombre}" onclick="seleccionarGrupo('${grupoNombre}')">
                ${grupoNombre}
            </button>`;
        }).join('');
    };
    
    // ========== RENDER CULTIVO CARDS ==========
    const renderCultivoCards = () => {
        if (!cultivosGrupo.length) {
            return '<div style="color:var(--text-muted); text-align:center; padding:0.5rem;">Selecciona un grupo arriba</div>';
        }
        return cultivosGrupo.map(c => {
            const codigo = c.codigo || c;
            const nombre = c.nombre || c;
            const isActive = cultivoActivo === codigo ? 'active' : '';
            return `
                <button class="cultivo-card ${isActive}" onclick="seleccionarCultivo('${codigo}')">
                    ${nombre}
                </button>
            `;
        }).join('');
    };
    
    // ========== RENDER LABOR CARDS ==========
    const renderLaborCards = () => {
        const labores = getLaboresUnicas();
        if (!labores.length) {
            return '<div style="color:var(--text-muted); text-align:center; padding:0.5rem; font-size:0.8rem;">Selecciona un cultivo</div>';
        }
        return labores.map(r => {
            const isActive = laborActiva === r.labor ? 'active' : '';
            return `
                <button class="labor-card ${isActive}" onclick="seleccionarLabor('${r.labor}')">
                    ${r.labor} <span style="opacity:0.7; font-size:0.65rem;">(${r.rendimiento})</span>
                </button>
            `;
        }).join('');
    };
    
    // ========== RENDER FORMULARIO COSECHA (ACORDEON) ==========
    const renderCosechaForm = () => {
        if (!cultivosGrupo.length) {
            return '<div style="color:var(--text-muted); text-align:center; padding:1rem;">Sin cultivos para cosecha</div>';
        }

        // Agrupar por cultivo en un acordeón
        return cultivosGrupo.map((c, index) => {
            const codigo = c.codigo || c;
            const nombre = c.nombre || c;
            const tallosMalla = TALLOS_POR_MALLA[codigo] || 25;
            const rend = rendimientosGrupo.find(r => r.productoCodigo === codigo || r.producto === nombre);
            const rendVal = rend ? rend.rendimiento : 1;
            const actId = rend ? rend.actividadId : null;
            const saved = filasData[codigo] || {};
            const isExpanded = cultivationExpanded[codigo] || false;
            
            return `
                <div class="accordion-item" style="margin-bottom: 0.5rem; border: 1px solid rgba(245,158,11,0.2); border-radius: 8px; overflow: hidden;">
                    <div class="accordion-header" onclick="toggleCultivation('${codigo}')"
                         style="padding: 0.75rem; background: rgba(245,158,11,0.1); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 0.6rem;">
                            <i class="fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}" style="font-size: 0.7rem; color: #F59E0B;"></i>
                            <span style="font-weight: 700; color: white; font-size: 0.9rem;">${nombre}</span>
                            <span style="font-size: 0.7rem; color: var(--text-muted); background: rgba(0,0,0,0.2); padding: 0.1rem 0.4rem; border-radius: 4px;">${tallosMalla} t/m</span>
                        </div>
                        <div style="display: flex; gap: 0.8rem; align-items: center;">
                             <span style="font-size: 0.75rem; color: #10B981; font-weight: 600;" id="summary-hrs-${codigo}">
                                ${saved.cantidad ? ((parseFloat(saved.cantidad) / tallosMalla) / rendVal).toFixed(2) + 'h' : ''}
                             </span>
                        </div>
                    </div>
                    <div class="accordion-content" style="display: ${isExpanded ? 'block' : 'none'}; padding: 0.75rem; background: rgba(255,255,255,0.02);">
                         <div class="cosecha-row" data-cultivo="${codigo}" 
                            style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem; background:rgba(255,255,255,0.03); 
                                   border-radius:8px; border:1px solid rgba(255,255,255,0.08);">
                            <div style="font-weight:600; color:var(--text-muted); width:30px; text-align:center; background: rgba(0,0,0,0.2); border-radius: 4px; padding: 0.2rem 0;">#1</div>
                            <div style="flex:1; font-size: 0.8rem; color: var(--text-muted);">Cantidad Tallos:</div>
                            <div style="display:flex; align-items:center; gap:0.3rem;">
                                <span style="background:rgba(16,185,129,0.2); color:#10B981; padding:0.15rem 0.3rem; border-radius:4px; font-size:0.65rem;">
                                    ${rendVal} m/h
                                </span>
                            </div>
                            <input type="number" class="inp-cantidad" data-cultivo="${codigo}" data-rend="${rendVal}" 
                                   data-actid="${actId}" data-tallos-malla="${tallosMalla}"
                                   placeholder="Tallos" value="${saved.cantidad || ''}" oninput="calcHorasCosecha('${codigo}')" onfocus="this.select()"
                                   style="width:100px; padding:0.5rem; background:#1E293B; color:white; border-radius:6px; 
                                          border:1px solid rgba(255,255,255,0.2); font-size:1rem; text-align:center;">
                            <span id="hrs-${codigo}" style="min-width:55px; font-weight:600; color:var(--text-muted); text-align:center; font-size:0.85rem; margin-right:0.2rem;">
                                ${saved.cantidad ? ((parseFloat(saved.cantidad) / tallosMalla) / rendVal).toFixed(2) + 'h' : '--'}
                            </span>
                            <button onclick="guardarFilaCosecha('${codigo}', ${actId})" title="Guardar cosecha"
                                style="width:28px; height:28px; background:rgba(16,185,129,0.15); color:#10B981; border:1px solid rgba(16,185,129,0.3); border-radius:6px; cursor:pointer; font-size:0.8rem; display:flex; align-items:center; justify-content:center;">
                                <i class="fa-solid fa-floppy-disk"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    let cultivationExpanded = {};
    window.toggleCultivation = (codigo) => {
        guardarValoresActuales();
        cultivationExpanded[codigo] = !cultivationExpanded[codigo];
        renderContenidoLabores();
    };

    window.guardarFilaCosecha = async (cultivoCodigo, actId) => {
        // Restricción de miércoles en adelante para semana actual (solo para supervisores)
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.rol !== 'ADMIN') {
            const hoy = new Date();
            const diaSemana = hoy.getDay();
            const esMiercolesODespues = (diaSemana === 0 || diaSemana >= 3);
            if (esMiercolesODespues && semanaActual && semanaSeleccionada && semanaSeleccionada.id === semanaActual.id) {
                showNotification('A partir del miércoles no se permite ingresar nuevas planificaciones para la semana actual.', 'error');
                return;
            }
        }

        const row = document.querySelector(`#cosecha-form .cosecha-row[data-cultivo="${cultivoCodigo}"]`);
        if (!row) return;
        const inp = row.querySelector('.inp-cantidad');
        const cantidad = parseFloat(inp?.value) || 0;
        if (cantidad <= 0) { showNotification('Ingresa una cantidad mayor a 0', 'warning'); return; }
        
        const rend = parseFloat(inp.dataset.rend) || 1;
        const tallosMalla = parseFloat(inp.dataset.tallosMalla) || 25;
        let horas = (cantidad / tallosMalla) / rend;
        
        if (!actId) { showNotification('Actividad no encontrada', 'error'); return; }

        const btn = row.querySelector('button');
        if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; }

        try {
            await api.createPlanificacion({
                semana: { id: semanaSeleccionada.id },
                actividad: { id: actId },
                bloque: null,
                unidadesPlanificadas: cantidad,
                rendimientoUsado: rend,
                horasCalculadas: horas,
                horasAjustadas: horas
            });
            showNotification(`✓ Cosecha guardada: ${horas.toFixed(2)}h`, 'success');
            inp.value = '';
            const hrsSpan = document.getElementById(`hrs-${cultivoCodigo}`);
            if (hrsSpan) {
                hrsSpan.textContent = '--';
                hrsSpan.style.color = 'var(--text-muted)';
            }
            const sumSpan = document.getElementById(`summary-hrs-${cultivoCodigo}`);
            if (sumSpan) sumSpan.textContent = '';
            delete filasData[cultivoCodigo];
            
            // Recargar tabla
            planificacionItems = await api.getPlanificacionSemana(semanaSeleccionada.codigoAass).catch(() => []);
            document.getElementById('tabla-plan').innerHTML = renderPlanificacion();
            actualizarContadores();
        } catch(e) {
            showNotification('Error al guardar', 'error');
        } finally {
            if (btn) { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>'; btn.disabled = false; }
        }
    };

    
    // ========== RENDER DROPDOWN BLOQUES ==========
    const renderBloqueOptions = (selected = '') => BLOQUES.map(b => 
        `<option value="${b}" ${b === selected ? 'selected' : ''}>${b}</option>`
    ).join('');
    
    // ========== HELPER: Obtener placeholder según unidad ==========
    const getPlaceholderUnidad = (unidadCodigo) => {
        switch(unidadCodigo) {
            case 'PLANTAS_HORA': return 'Plantas';
            case 'MALLAS_HORA': return 'Mallas';
            case 'PINGOS_HORA': return 'Pingos';
            case 'CAMAS_HORA':
            default: return 'Camas';
        }
    };

    // ========== RENDER INPUT LABOR (para grupo no-cosecha) ==========
    const renderLaborInput = () => {
        if (!laborActiva) {
            return `<div style="text-align:center; color:var(--text-muted); padding:1rem;">
                <i class="fa-solid fa-hand-pointer" style="font-size:1rem; margin-bottom:0.3rem; display:block;"></i>
                Selecciona una labor arriba
            </div>`;
        }
        
        const laborData = rendimientosGrupo.find(r => r.labor === laborActiva && (r.productoCodigo === cultivoActivo || r.producto.toUpperCase() === cultivoActivo));
        if (!laborData) return '<div style="color:var(--text-muted); padding:1rem;">Labor no encontrada</div>';
        
        // Obtener unidad (del API o default)
        const unidadAbrev = laborData.unidadAbrev || 'cam/h';
        const unidadCodigo = laborData.unidadCodigo || 'CAMAS_HORA';
        const placeholder = getPlaceholderUnidad(unidadCodigo);
        
        // Renderizar filas para esta labor
        const mainId = `main-${laborData.id}`;
        const saved = filasData[mainId] || {};
        const adicionales = Object.keys(filasData).filter(k => k.startsWith(`add-${laborData.id}-`));
        
        let html = `
            <div style="padding:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; padding:0.5rem; background:rgba(16,185,129,0.1); border-radius:8px; border:1px solid rgba(16,185,129,0.3);">
                    <span style="font-weight:600; color:#10B981; flex:1;">${laborData.labor}</span>
                    <span style="background:rgba(16,185,129,0.2); color:#10B981; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.8rem;">
                        ${laborData.rendimiento} ${unidadAbrev}
                    </span>
                </div>
                <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.4rem; padding:0 0.2rem;">
                    <i class="fa-solid fa-info-circle" style="margin-right:0.3rem;"></i>
                    Ingresa cantidad en <strong style="color:#10B981;">${placeholder.toLowerCase()}</strong>
                </div>
        `;
        
        // Fila principal
        html += renderFilaInput(laborData, mainId, saved, false, unidadCodigo, placeholder, 1);
        
        // Filas adicionales
        adicionales.forEach((filaId, index) => {
            const savedAd = filasData[filaId] || {};
            html += renderFilaInput(laborData, filaId, savedAd, true, unidadCodigo, placeholder, index + 2);
        });
        
        html += '</div>';
        return html;
    };
    
    const renderFilaInput = (laborData, filaId, saved, esAdicional, unidadCodigo = 'CAMAS_HORA', placeholder = 'Camas', index = 1) => {
        return `
            <div data-fila="${filaId}" style="display:flex; align-items:center; gap:0.2rem; margin-bottom:0.2rem; padding:0.2rem; background:rgba(255,255,255,0.03); border-radius:4px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="font-weight:600; color:var(--text-muted); width:20px; text-align:center; font-size:0.8rem;">${index}</div>
                
                <!-- Celda Bloque -->
                <input list="list-bloques" class="sel-bloque" data-fila="${filaId}" value="${saved.bloque || ''}" placeholder="Bloque"
                    style="flex:1.2; padding:0.35rem; background:#1E293B; color:white; border-radius:4px; border:1px solid rgba(255,255,255,0.15); font-size:0.85rem;"
                    onfocus="this.select()">

                <!-- Celda Rendimiento (Visual) -->
                <div style="width:65px; text-align:center; background:rgba(0,0,0,0.2); border-radius:4px; padding:0.35rem 0; font-size:0.75rem; color:#94A3B8; border:1px solid rgba(255,255,255,0.05);">
                    ${laborData.rendimiento}
                </div>

                <!-- Celda Cantidad -->
                <input type="number" class="inp-cantidad" data-fila="${filaId}" data-rend="${laborData.rendimiento}" 
                       data-actid="${laborData.actividadId}" data-unidad="${unidadCodigo}" value="${saved.cantidad || ''}"
                       placeholder="${placeholder}" oninput="calcHoras('${filaId}')" onfocus="this.select()"
                       style="width:85px; padding:0.35rem; background:#1E293B; color:white; border-radius:4px; border:1px solid rgba(255,255,255,0.15); font-size:0.9rem; text-align:center; font-weight:700;">
                
                <!-- Celda Horas -->
                <span id="hrs-${filaId}" style="min-width:55px; font-weight:700; color:${saved.cantidad ? '#10B981' : 'var(--text-muted)'}; text-align:center; font-size:0.85rem; background:rgba(0,0,0,0.15); border-radius:4px; padding:0.35rem 0;">
                    ${saved.cantidad ? (parseFloat(saved.cantidad) / laborData.rendimiento).toFixed(2) + 'h' : '--'}
                </span>

                <!-- Acciones -->
                <div style="display:flex; gap:0.2rem;">
                    <button onclick="guardarFila('${filaId}', ${laborData.id})" title="Guardar fila"
                        style="width:26px; height:26px; background:rgba(16,185,129,0.15); color:#10B981; border:1px solid rgba(16,185,129,0.3); border-radius:4px; cursor:pointer; font-size:0.75rem;">
                        <i class="fa-solid fa-floppy-disk"></i>
                    </button>
                    ${!esAdicional ? 
                        `<button onclick="agregarFilaLabor(${laborData.id})" title="+ Bloque" 
                            style="width:26px; height:26px; background:rgba(59,130,246,0.15); color:#3B82F6; border:1px solid rgba(59,130,246,0.3); border-radius:4px; cursor:pointer; font-size:0.75rem;">
                            <i class="fa-solid fa-plus"></i>
                        </button>` : 
                        `<button onclick="quitarFilaLabor('${filaId}')" title="Quitar" 
                            style="width:26px; height:26px; background:rgba(239,68,68,0.15); color:#EF4444; border:1px solid rgba(239,68,68,0.3); border-radius:4px; cursor:pointer; font-size:0.75rem;">
                            <i class="fa-solid fa-minus"></i>
                        </button>`
                    }
                </div>
            </div>
        `;
    };
    
    // ========== RENDER PLANIFICACION CON EDICION (AGRUPADA POR CULTIVO) ==========
    window.toggleSelectAllPlan = (chk) => {
        const selectAll = chk.checked;
        document.querySelectorAll('.plan-row-chk').forEach(c => {
            c.checked = selectAll;
        });
        window.actualizarBotonEliminarLote();
    };

    window.actualizarBotonEliminarLote = () => {
        const checkedBoxes = document.querySelectorAll('.plan-row-chk:checked');
        const btn = document.getElementById('btn-eliminar-lote');
        const countSpan = document.getElementById('count-eliminar-lote');
        if (btn && countSpan) {
            if (checkedBoxes.length > 0) {
                btn.style.display = 'inline-flex';
                countSpan.textContent = checkedBoxes.length;
            } else {
                btn.style.display = 'none';
            }
        }
    };

    window.eliminarPlanificacionLote = async () => {
        const checkedBoxes = document.querySelectorAll('.plan-row-chk:checked');
        if (!checkedBoxes.length) return;
        
        if (!confirm(`¿Estás seguro de que deseas eliminar los ${checkedBoxes.length} registros seleccionados?`)) {
            return;
        }
        
        const ids = Array.from(checkedBoxes).map(c => parseInt(c.dataset.id));
        
        const btnLote = document.getElementById('btn-eliminar-lote');
        if (btnLote) btnLote.disabled = true;
        
        showNotification(`Eliminando ${ids.length} registros...`, 'info');
        try {
            await Promise.all(ids.map(id => api.deletePlanificacion(id)));
            showNotification(`✓ ${ids.length} registros eliminados correctamente`, 'success');
            
            if (mode === 'actual') {
                App.navigate('planificacion');
            } else {
                App.navigate('planificacion-siguiente');
            }
        } catch (err) {
            showNotification('Error al eliminar planificación en lote', 'error');
            if (btnLote) btnLote.disabled = false;
        }
    };

    window.eliminarPlanificacionCultivo = async (cultivoNombre) => {
        const itemsFiltrados = getPlanificacionFiltrada();
        const itemsCultivo = itemsFiltrados.filter(p => {
            const pdcto = p.producto || p.actividad?.producto;
            const cName = pdcto ? pdcto.nombre : 'General';
            return cName.toUpperCase() === cultivoNombre.toUpperCase();
        });
        
        if (!itemsCultivo.length) return;
        
        if (!confirm(`¿ADMIN: Estás seguro de que deseas eliminar TODOS los ${itemsCultivo.length} registros de planificación para el cultivo ${cultivoNombre.toUpperCase()} en esta semana?`)) {
            return;
        }
        
        const ids = itemsCultivo.map(p => p.id);
        showNotification(`Eliminando ${ids.length} registros para ${cultivoNombre.toUpperCase()}...`, 'info');
        
        try {
            await Promise.all(ids.map(id => api.deletePlanificacion(id)));
            showNotification(`✓ Se eliminaron todos los registros de ${cultivoNombre.toUpperCase()}`, 'success');
            
            if (mode === 'actual') {
                App.navigate('planificacion');
            } else {
                App.navigate('planificacion-siguiente');
            }
        } catch (err) {
            showNotification('Error al eliminar registros del cultivo', 'error');
        }
    };
    
    // ========== RENDER PLANIFICACION CON EDICION (AGRUPADA POR CULTIVO) ==========
    const renderPlanificacion = () => {
        const itemsFiltrados = getPlanificacionFiltrada();
        const isCosechaGroup = grupoActivo === 'COSECHA';
        const isClosed = semanaSeleccionada && (semanaSeleccionada.planificacionCerrada || semanaSeleccionada.estado === 'CERRADA');
        
        if (!grupoActivo) {
            return `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1.5rem;">
                <i class="fa-solid fa-hand-pointer" style="margin-bottom:0.5rem; display:block; font-size:1.2rem; opacity:0.5;"></i>
                Selecciona una actividad madre arriba
            </td></tr>`;
        }
        
        if (!itemsFiltrados.length) {
            return `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1.5rem;">
                No hay planificación guardada para ${grupoActivo}
            </td></tr>`;
        }

        // Agrupar items por cultivo
        const grouped = {};
        itemsFiltrados.forEach(p => {
            const pdcto = p.producto || p.actividad?.producto;
            const cultivo = pdcto ? pdcto.nombre : 'General';
            if (!grouped[cultivo]) grouped[cultivo] = [];
            grouped[cultivo].push(p);
        });

        const user = JSON.parse(localStorage.getItem('user') || '{}');

        let html = '';
        Object.keys(grouped).sort().forEach((cultivo, idx) => {
            const items = grouped[cultivo];
            const subtotalHrs = items.reduce((sum, p) => sum + (p.horasAjustadas || p.horasCalculadas || 0), 0);
            const isExpanded = resumenExpandido[cultivo] === true;

            const btnAdminDelete = (user.rol === 'ADMIN' && !isClosed) ? `
                <button class="btn btn-sm" onclick="event.stopPropagation(); window.eliminarPlanificacionCultivo('${cultivo}')" 
                        style="background:rgba(239, 68, 68, 0.15); color:#FCA5A5; border:1px solid rgba(239, 68, 68, 0.3); padding: 0.2rem 0.5rem; font-size:0.65rem; border-radius:4px; margin-left:0.8rem; cursor:pointer;"
                        title="Eliminar toda la planificación de este cultivo">
                    <i class="fa-solid fa-trash-arrow-up" style="margin-right:0.25rem;"></i> Eliminar Todo
                </button>
            ` : '';

            // Header del cultivo (Fila Acordeón)
            html += `
                <tr onclick="toggleResumenCultivo('${cultivo}')" style="background: rgba(59,130,246,0.08); cursor:pointer; user-select:none;">
                    <td colspan="4" style="padding: 0.6rem; font-weight: 800; color: white; font-size: 0.8rem;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display:flex; align-items:center;">
                                <i class="fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}" style="margin-right:0.5rem; color:var(--primary); font-size:0.7rem;"></i>
                                <i class="fa-solid fa-leaf" style="margin-right:0.3rem; opacity:0.5; color:#10B981;"></i> 
                                ${cultivo.toUpperCase()}
                            </div>
                            ${btnAdminDelete}
                        </div>
                    </td>
                    <td style="padding: 0.6rem; text-align: center; font-weight: 800; color: #10B981; font-size: 0.8rem;">
                         ${subtotalHrs.toFixed(1)}h
                    </td>
                    <td style="text-align:right; padding-right:0.5rem;">
                        <span style="font-size:0.6rem; color:var(--text-muted);">${items.length} acts</span>
                    </td>
                </tr>
            `;

            if (isExpanded) {
                // Ordenar por orden alfabético
                items.sort((a, b) => {
                    const nameA = (a.actividad?.nombre || '').toUpperCase();
                    const nameB = (b.actividad?.nombre || '').toUpperCase();
                    return nameA.localeCompare(nameB);
                });
                // Items del cultivo
                items.forEach(p => {
                    const isEditing = editandoId === p.id;
                    const dsc = (p.actividad?.nombre || '-');
                    const horas = p.horasAjustadas || p.horasCalculadas || 0;
                    
                    let subInfoStr = '';
                    if (isCosechaGroup) {
                        const pdcto = p.producto || p.actividad?.producto;
                        const tallosMalla = pdcto ? (TALLOS_POR_MALLA[pdcto.codigo] || 25) : 25;
                        const rendUsado = p.rendimientoUsado || 1;
                        const tallos = Math.round(horas * rendUsado * tallosMalla);
                        subInfoStr = `
                            <div style="font-size:0.65rem; color:#F59E0B; margin-top:1px;">${tallos.toLocaleString()} tallos</div>
                            <div style="font-size:0.62rem; color:var(--text-muted); opacity:0.8;">Rendimiento: ${rendUsado} mal/h</div>
                        `;
                    } else {
                        const rendUsado = p.rendimientoUsado || 0;
                        subInfoStr = `<div style="font-size:0.62rem; color:var(--text-muted); opacity:0.8;">Rendimiento: ${rendUsado}</div>`;
                    }

                    if (isEditing) {
                        html += `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.03); background:rgba(59,130,246,0.05);">
                                <td style="text-align:center; padding:0.5rem;">
                                    <input type="checkbox" disabled style="opacity:0.3;">
                                </td>
                                <td style="padding:0.5rem; font-size:0.75rem; padding-left: 2rem;">
                                    <strong>${dsc}</strong>
                                    ${subInfoStr}
                                </td>
                                <td style="padding:0.5rem;">
                                    <input list="list-bloques" id="edit-bloque-${p.id}" value="${p.bloque || ''}" placeholder="Bloque"
                                        style="width:100%; padding:0.3rem; background:#1E293B; color:white; border-radius:4px; border:1px solid #3B82F6; font-size:0.7rem;"
                                        onfocus="this.select()">
                                </td>
                                <td style="padding:0.5rem; text-align:center;">
                                    <input type="number" id="edit-cant-${p.id}" value="${p.unidadesPlanificadas || 0}" onfocus="this.select()"
                                        style="width:70px; padding:0.3rem; background:#1E293B; color:white; border-radius:4px; border:1px solid #3B82F6; font-size:0.75rem; text-align:center; font-weight:700;">
                                </td>
                                <td style="padding:0.5rem; text-align:center;"><span style="color:#93C5FD; font-weight:800; font-size:0.8rem;">${horas.toFixed(1)}h</span></td>
                                <td style="padding:0.5rem; text-align:center;">
                                    <div style="display:flex; gap:0.3rem; justify-content:center;">
                                        <button class="btn btn-sm" onclick="guardarEdicion(${p.id}, ${p.rendimientoUsado || 1})" style="background:#10B981; color:white; padding:4px 8px;">
                                            <i class="fa-solid fa-check"></i>
                                        </button>
                                        <button class="btn btn-sm" onclick="cancelarEdicion()" style="background:#6B7280; color:white; padding:4px 8px;">
                                            <i class="fa-solid fa-xmark"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    } else {
                        const checkHtml = isClosed 
                            ? `<input type="checkbox" disabled style="opacity:0.3;">` 
                            : `<input type="checkbox" class="plan-row-chk" data-id="${p.id}" onchange="window.actualizarBotonEliminarLote()" style="cursor:pointer;">`;
                        
                        const actionsHtml = isClosed 
                            ? `<div style="display:flex; gap:0.3rem; justify-content:center; color:var(--text-muted); font-size:0.75rem;"><i class="fa-solid fa-lock" title="Planificación cerrada" style="color:var(--text-muted); opacity:0.6;"></i></div>` 
                            : `<div style="display:flex; gap:0.3rem; justify-content:center;">
                                    <button class="btn btn-sm" onclick="editarPlan(${p.id})" style="background:rgba(59,130,246,0.1); color:#3B82F6; border:1px solid rgba(59,130,246,0.2); padding:4px 8px;">
                                        <i class="fa-solid fa-pen"></i>
                                    </button>
                                    <button class="btn btn-sm" onclick="eliminarPlan(${p.id})" style="background:rgba(239,68,68,0.1); color:#EF4444; border:1px solid rgba(239,68,68,0.2); padding:4px 8px;">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                </div>`;

                        html += `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                                <td style="text-align:center; padding:0.5rem;">
                                    ${checkHtml}
                                </td>
                                <td style="padding:0.5rem; font-size:0.75rem; padding-left: 2rem;">
                                    <strong>${dsc}</strong>
                                    ${subInfoStr}
                                </td>
                                <td style="padding:0.5rem; text-align:center; font-size:0.75rem; color:var(--text-muted);">${p.bloque || '-'}</td>
                                <td style="padding:0.5rem; text-align:center; font-size:1rem; font-weight:700; color:#CBD5E1;">${p.unidadesPlanificadas || 0}</td>
                                <td style="padding:0.5rem; text-align:center;"><span style="color:#93C5FD; font-weight:700; font-size:0.8rem;">${horas.toFixed(1)}h</span></td>
                                <td style="padding:0.5rem; text-align:center;">
                                    ${actionsHtml}
                                </td>
                            </tr>
                        `;
                    }
                });
            }
        });
        
        return html;
    };


    // ========== RENDER ENCABEZADO DE TABLA (dinámico según grupo) ==========
    const renderTablaHeader = () => {
        const isCosechaGroup = grupoActivo === 'COSECHA';
        const isClosed = semanaSeleccionada && (semanaSeleccionada.planificacionCerrada || semanaSeleccionada.estado === 'CERRADA');
        const chkCol = isClosed 
            ? '<th style="width: 30px; text-align: center; padding: 0.3rem;"><input type="checkbox" disabled style="opacity:0.3;"></th>' 
            : `<th style="width: 30px; text-align: center; padding: 0.3rem;">
                   <input type="checkbox" id="check-all-plan" onchange="window.toggleSelectAllPlan(this)" style="cursor: pointer;">
               </th>`;

        return `
            <tr style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">
                ${chkCol}
                <th style="text-align:left; padding:0.3rem;">${isCosechaGroup ? 'Cultivo' : 'Actividad'}</th>
                <th style="text-align:center; padding:0.3rem;">Blq</th>
                <th style="text-align:center; padding:0.3rem;">${isCosechaGroup ? 'Tallos' : 'Cant'}</th>
                <th style="text-align:center; padding:0.3rem;">Hrs</th>
                <th style="width:60px;"></th>
            </tr>
        `;
    };
    
    // ========== ACTUALIZAR CONTADORES ==========
    const actualizarContadores = () => {
        document.getElementById('total-hrs-semana').textContent = calcularTotalHorasSemana().toFixed(1);
        document.getElementById('total-hrs-grupo').textContent = calcularHorasGrupo().toFixed(1);
        document.getElementById('grupo-label').textContent = grupoActivo || '-';
        // Contador de horas guardadas en la tabla inferior
        const tablaEl = document.getElementById('total-hrs-tabla');
        if (tablaEl) {
            const hrsTabla = getPlanificacionFiltrada().reduce((s, p) => s + (p.horasAjustadas || p.horasCalculadas || 0), 0);
            tablaEl.textContent = hrsTabla.toFixed(1);
        }
        // Actualizar encabezado de tabla dinámicamente
        const headEl = document.getElementById('tabla-plan-head');
        if (headEl) headEl.innerHTML = renderTablaHeader();
        actualizarTotalIngresando();
    };

    const actualizarTotalIngresando = () => {
        let totalEnVivo = 0;
        document.querySelectorAll('.inp-cantidad').forEach(inp => {
            const cant = parseFloat(inp.value) || 0;
            const rend = parseFloat(inp.dataset.rend) || 1;
            const tallosMalla = parseFloat(inp.dataset.tallosMalla);
            if (cant > 0) {
                if (tallosMalla) {
                    totalEnVivo += (cant / tallosMalla) / rend;
                } else {
                    totalEnVivo += cant / rend;
                }
            }
        });
        const el = document.getElementById('total-hrs-ingresando');
        if (el) {
            el.textContent = totalEnVivo > 0 ? `+${totalEnVivo.toFixed(1)}h a guardar` : '';
            el.style.display = totalEnVivo > 0 ? 'inline' : 'none';
        }
    };
    
    // ========== FUNCIONES GLOBALES ==========

    // Guardar UNA sola fila individualmente (botón disquete)
    window.guardarFila = async (filaId, rendId) => {
        const fila = document.querySelector(`#labor-input div[data-fila="${filaId}"]`);
        if (!fila) return;
        const inp = fila.querySelector('.inp-cantidad');
        const sel = fila.querySelector('.sel-bloque');
        const cantidad = parseFloat(inp?.value) || 0;
        const bloque = sel?.value || '';
        if (cantidad <= 0) { showNotification('Ingresa una cantidad mayor a 0', 'warning'); return; }

        // Validar que el bloque no esté vacío (excepto para COSECHA)
        if (grupoActivo !== 'COSECHA' && !bloque) {
            showNotification('El campo bloque es obligatorio', 'warning');
            return;
        }

        // Restricción de miércoles en adelante para semana actual (solo para supervisores)
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.rol !== 'ADMIN') {
            const hoy = new Date();
            const diaSemana = hoy.getDay();
            const esMiercolesODespues = (diaSemana === 0 || diaSemana >= 3);
            if (esMiercolesODespues && semanaActual && semanaSeleccionada && semanaSeleccionada.id === semanaActual.id) {
                showNotification('A partir del miércoles no se permite ingresar nuevas planificaciones para la semana actual.', 'error');
                return;
            }
        }
        const rend = parseFloat(inp.dataset.rend) || 1;
        const actId = parseInt(inp.dataset.actid);
        const horas = cantidad / rend;
        if (!actId) { showNotification('Actividad no encontrada', 'error'); return; }

        // Indicador visual de guardando
        const btn = fila.querySelector(`button[onclick="guardarFila('${filaId}', ${rendId})"]`);
        if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; }

        try {
            await api.createPlanificacion({
                semana: { id: semanaSeleccionada.id },
                actividad: { id: actId },
                bloque: bloque || null,
                unidadesPlanificadas: cantidad,
                rendimientoUsado: rend,
                horasCalculadas: horas,
                horasAjustadas: horas
            });
            showNotification(`✓ Guardado: ${horas.toFixed(2)}h`, 'success');
            inp.value = '';
            if (sel) sel.value = '';
            document.getElementById(`hrs-${filaId}`).textContent = '--';
            document.getElementById(`hrs-${filaId}`).style.color = 'var(--text-muted)';
            delete filasData[filaId];
            // Recargar tabla
            planificacionItems = await api.getPlanificacionSemana(semanaSeleccionada.codigoAass).catch(() => []);
            document.getElementById('tabla-plan').innerHTML = renderPlanificacion();
            actualizarContadores();
        } catch(e) {
            showNotification('Error al guardar', 'error');
        } finally {
            if (btn) { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>'; btn.disabled = false; }
        }
    };

    window.cambiarSemana = async (codigoAass) => {
        const todasLasSemanas = semanasDisponibles.length ? semanasDisponibles : [semanaActual, semanaSiguiente].filter(Boolean);
        const semanaEncontrada = todasLasSemanas.find(s => s.codigoAass === codigoAass);
        if (!semanaEncontrada) return;
        semanaSeleccionada = semanaEncontrada;
        
        const selEl = document.getElementById('semana-selector-plan');
        if (selEl) selEl.value = codigoAass;
        
        grupoActivo = null;
        cultivoActivo = null;
        laborActiva = null;
        filasData = {};
        cosechaExpandido = false;
        // Recargar items de planificacion para la nueva semana
        planificacionItems = await api.getPlanificacionSemana(codigoAass).catch(() => []);
        // Actualizar la etiqueta de semana
        const semLabel = document.getElementById('semana-badge-label');
        if (semLabel) semLabel.textContent = codigoAass;
        // Reset contenido labores
        const cont = document.getElementById('contenido-labores');
        if (cont) cont.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-muted);">
            <i class="fa-solid fa-hand-pointer" style="font-size:1.5rem; margin-bottom:0.5rem; display:block;"></i>
            Selecciona una actividad madre arriba
        </div>`;
        // Reset tabs
        document.querySelectorAll('.grupo-tab').forEach(t => {
            t.classList.remove('active');
        });
        document.getElementById('tabla-plan').innerHTML = renderPlanificacion();
        actualizarContadores();
        document.getElementById('plan-grupo-label').textContent = '';
    };

    window.llenarPlanSemanaSiguiente = async () => {
        if (!semanaActual || !semanaSiguiente) {
            showNotification('No se puede copiar: la semana actual o siguiente no están definidas', 'error');
            return;
        }
        
        if (!confirm(`¿Deseas copiar todas las actividades planificadas de la semana actual (${semanaActual.codigoAass}) a la semana siguiente (${semanaSiguiente.codigoAass})?`)) {
            return;
        }
        
        const btn = document.getElementById('btn-llenar-siguiente');
        let originalHtml = '';
        if (btn) {
            originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Copiando...';
        }
        
        try {
            const res = await api.copiarPlanificacionSemana(semanaActual.codigoAass, semanaSiguiente.codigoAass);
            showNotification(res.mensaje || 'Planificación copiada con éxito', 'success');
            
            // Recargar planificación de la semana seleccionada
            planificacionItems = await api.getPlanificacionSemana(semanaSeleccionada.codigoAass).catch(() => []);
            document.getElementById('tabla-plan').innerHTML = renderPlanificacion();
            actualizarContadores();
        } catch (e) {
            console.error(e);
            showNotification(e.message || 'Error al copiar la planificación', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };

    window.autorizarSemanaPlanificada = async (codigoAass) => {
        if (!confirm(`¿Está seguro de que desea autorizar la planificación de la semana ${codigoAass}? Esta semana pasará a ser la Semana Actual en Ejecución y la semana anterior se cerrará.`)) {
            return;
        }
        
        try {
            await api.cambiarEstadoSemana(codigoAass, 'EN_EJECUCION');
            showNotification(`Semana ${codigoAass} autorizada como semana actual`, 'success');
            
            // Forzar recarga de los datos de semana en el layout general de la aplicación
            if (typeof App.verificarConexionYBadge === 'function') {
                await App.verificarConexionYBadge();
            }
            
            // Redirigir a la vista de planificacion actual
            App.navigate('planificacion');
        } catch (err) {
            console.error('Error al autorizar semana:', err);
            showNotification(err.message || 'Error al autorizar la semana', 'error');
        }
    };

    window.seleccionarGrupo = async (grupo) => {
        guardarValoresActuales();
        grupoActivo = grupo;
        cultivoActivo = null;
        laborActiva = null;
        filasData = {};
        cosechaExpandido = false;
        
        document.querySelectorAll('.grupo-tab').forEach(t => {
            if (t.dataset.grupo === grupo) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });
        
        try {
            [cultivosGrupo, rendimientosGrupo] = await Promise.all([
                api.getCultivosPorGrupo(grupo),
                api.getRendimientosPorGrupo(grupo)
            ]);
        } catch(e) { cultivosGrupo = []; rendimientosGrupo = []; }
        
        renderContenidoLabores();
        document.getElementById('tabla-plan').innerHTML = renderPlanificacion();
        actualizarContadores();
        document.getElementById('plan-grupo-label').textContent = grupo;
    };
    
    window.seleccionarCultivo = (cultivo) => {
        guardarValoresActuales();
        cultivoActivo = cultivo;
        laborActiva = null;
        filasData = {}; // Reset data when changing crop
        
        const cultCont = document.getElementById('cultivo-container');
        const labCont = document.getElementById('labor-container');
        const labInp = document.getElementById('labor-input');
        
        if (cultCont) cultCont.innerHTML = renderCultivoCards();
        if (labCont) labCont.innerHTML = renderLaborCards();
        if (labInp) labInp.innerHTML = renderLaborInput();

        // Re-render table and update counters
        const tablaPlan = document.getElementById('tabla-plan');
        if (tablaPlan) tablaPlan.innerHTML = renderPlanificacion();
        actualizarContadores();
    };
    
    window.seleccionarLabor = (labor) => {
        guardarValoresActuales();
        laborActiva = labor;
        filasData = {}; // Reset data when changing labor
        
        const labCont = document.getElementById('labor-container');
        const labInp = document.getElementById('labor-input');
        
        if (labCont) labCont.innerHTML = renderLaborCards();
        if (labInp) labInp.innerHTML = renderLaborInput();
    };
    
    const renderContenidoLabores = () => {
        const container = document.getElementById('contenido-labores');
        if (!container) return;

        const isClosed = semanaSeleccionada && (semanaSeleccionada.planificacionCerrada || semanaSeleccionada.estado === 'CERRADA');
        if (isClosed) {
            container.innerHTML = `
                <div style="padding: 2.5rem 1.5rem; text-align: center; color: var(--text-muted);">
                    <i class="fa-solid fa-lock" style="font-size: 2.5rem; color: #EF4444; margin-bottom: 1rem; opacity: 0.8; display: block;"></i>
                    <h3 style="color: #F8FAFC; margin-bottom: 0.5rem; font-size: 1.1rem; font-weight: 700;">Planificación de Semana Cerrada</h3>
                    <p style="font-size: 0.85rem; max-width: 320px; margin: 0 auto; line-height: 1.4;">
                        Esta planificación ha sido autorizada y está cerrada. No se pueden agregar ni modificar actividades.
                    </p>
                </div>
            `;
            return;
        }

        if (esCosecha()) {
            container.innerHTML = `
                <div style="padding:0.5rem 0.75rem; background:linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.05)); border-bottom:1px solid rgba(245,158,11,0.3);">
                    <div style="font-size:0.7rem; color:#F59E0B; margin-bottom:0.3rem; text-transform:uppercase; letter-spacing:1px; font-weight:600;">
                        <i class="fa-solid fa-seedling" style="margin-right:0.3rem;"></i> Planificación Cosecha
                    </div>
                </div>
                <div id="cosecha-form" style="padding:0.75rem; max-height:400px; overflow-y:auto;">
                    ${renderCosechaForm()}
                </div>
            `;
        } else {
            container.innerHTML = `
                <div style="padding:0.5rem 0.75rem; background:linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.05)); border-bottom:1px solid rgba(59,130,246,0.3);">
                    <div style="font-size:0.65rem; color:#3B82F6; margin-bottom:0.3rem; text-transform:uppercase; letter-spacing:1px; font-weight:600;">
                        <i class="fa-solid fa-filter" style="margin-right:0.3rem;"></i> Selección de Cultivo y Labor
                    </div>
                </div>
                
                <div style="padding:0.75rem; display:flex; flex-direction:column; gap:0.75rem;">
                    <!-- Selector de Cultivo -->
                    <div id="cultivo-container" style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                        ${renderCultivoCards()}
                    </div>
                    
                    <!-- Selector de Labor -->
                    <div id="labor-container" style="display:flex; gap:0.4rem; flex-wrap:wrap; min-height:30px;">
                        ${renderLaborCards()}
                    </div>
                    
                    <!-- Area de Input -->
                    <div id="labor-input" style="background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid rgba(255,255,255,0.05); min-height:80px;">
                        ${renderLaborInput()}
                    </div>
                </div>
            `;
        }
    };

    const renderLaboresForAccordion = (cultivoCodigo, labores) => {
        if (!labores.length) return '<div style="font-size:0.75rem; color:var(--text-muted);">Sin labores configuradas</div>';
        
        return labores.map((r, lIndex) => {
            const laborId = r.id;
            const mainFilaId = `main-${laborId}`;
            const saved = filasData[mainFilaId] || {};
            const unidadAbrev = r.unidadAbrev || 'cam/h';
            const placeholder = getPlaceholderUnidad(r.unidadCodigo || 'CAMAS_HORA');
            
            return `
                <div style="background: rgba(255,255,255,0.03); border-radius: 6px; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <span style="font-weight: 600; color: #10B981; font-size: 0.8rem;">${r.labor}</span>
                        <span style="font-size: 0.7rem; color: var(--text-muted); background: rgba(16,185,129,0.1); padding: 0.1rem 0.3rem; border-radius: 4px;">
                            ${r.rendimiento} ${unidadAbrev}
                        </span>
                    </div>
                    ${renderFilaInputAccordion(r, mainFilaFId = mainFilaId, saved, placeholder, 1)}
                </div>
            `;
        }).join('');
    };

    const renderFilaInputAccordion = (laborData, filaId, saved, placeholder, index) => {
        return `
            <div data-fila="${filaId}" style="display:flex; align-items:center; gap:0.4rem;">
                <div style="font-weight:600; color:var(--text-muted); width:28px; text-align:center; font-size:0.75rem; background: rgba(0,0,0,0.2); border-radius: 4px; padding: 0.2rem 0;">#${index}</div>
                <input list="list-bloques" class="sel-bloque" data-fila="${filaId}" value="${saved.bloque || ''}" placeholder="Bloque"
                    style="flex:1; padding:0.35rem; background:#1E293B; color:white; border-radius:6px; border:1px solid rgba(255,255,255,0.2); font-size:0.8rem;"
                    onfocus="this.select()">
                <input type="number" class="inp-cantidad" data-fila="${filaId}" data-rend="${laborData.rendimiento}" 
                       data-actid="${laborData.actividadId}" data-unidad="${laborData.unidadCodigo || 'CAMAS_HORA'}" value="${saved.cantidad || ''}"
                       placeholder="${placeholder}" oninput="calcHoras('${filaId}')" onfocus="this.select()"
                       style="width:75px; padding:0.35rem; background:#1E293B; color:white; border-radius:6px; border:1px solid rgba(255,255,255,0.2); font-size:0.85rem; text-align:center;">
                <span id="hrs-${filaId}" style="min-width:44px; font-weight:600; color:#10B981; text-align:center; font-size:0.75rem;">
                    ${saved.cantidad ? (parseFloat(saved.cantidad) / laborData.rendimiento).toFixed(1) + 'h' : '--'}
                </span>
                <button onclick="guardarFila('${filaId}', ${laborData.id})" 
                    style="width:26px; height:26px; background:linear-gradient(135deg,#10B981,#059669); color:white; border:none; border-radius:4px; cursor:pointer; font-size:0.7rem;">
                    <i class="fa-solid fa-save"></i>
                </button>
            </div>
        `;
    };

    
    window.agregarFilaLabor = (rendId) => {
        guardarValoresActuales();
        filaCounter++;
        const newFilaId = `add-${rendId}-${filaCounter}`;
        filasData[newFilaId] = { bloque: '', cantidad: '' };
        document.getElementById('labor-input').innerHTML = renderLaborInput();
    };
    
    window.quitarFilaLabor = (filaId) => {
        guardarValoresActuales();
        delete filasData[filaId];
        document.getElementById('labor-input').innerHTML = renderLaborInput();
    };
    
    window.calcHoras = (filaId) => {
        const inp = document.querySelector(`.inp-cantidad[data-fila="${filaId}"]`);
        const span = document.getElementById(`hrs-${filaId}`);
        const cantidad = parseFloat(inp.value) || 0;
        const rend = parseFloat(inp.dataset.rend) || 1;
        
        if (cantidad > 0) {
            let horas = cantidad / rend;
            span.textContent = horas.toFixed(2) + 'h';
            span.style.color = '#10B981';
        } else {
            span.textContent = '--';
            span.style.color = 'var(--text-muted)';
        }
        actualizarTotalIngresando();
    };
    
    window.calcHorasCosecha = (cultivoId) => {
        const inp = document.querySelector(`.inp-cantidad[data-cultivo="${cultivoId}"]`);
        const span = document.getElementById(`hrs-${cultivoId}`);
        const cantidad = parseFloat(inp.value) || 0;
        const rend = parseFloat(inp.dataset.rend) || 1;
        const tallosMalla = parseFloat(inp.dataset.tallosMalla) || 25;
        
        if (cantidad > 0) {
            let mallas = cantidad / tallosMalla;
            let horas = mallas / rend;
            span.textContent = horas.toFixed(2) + 'h';
            span.style.color = '#10B981';
        } else {
            span.textContent = '--';
            span.style.color = 'var(--text-muted)';
        }
    };
    
    window.guardarTodo = async () => {
        // Restricción de miércoles en adelante para semana actual (solo para supervisores)
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.rol !== 'ADMIN') {
            const hoy = new Date();
            const diaSemana = hoy.getDay();
            const esMiercolesODespues = (diaSemana === 0 || diaSemana >= 3);
            if (esMiercolesODespues && semanaActual && semanaSeleccionada && semanaSeleccionada.id === semanaActual.id) {
                showNotification('A partir del miércoles no se permite ingresar nuevas planificaciones para la semana actual.', 'error');
                return;
            }
        }

        guardarValoresActuales();
        let guardados = 0, errores = 0;
        
        // Validar que todas las filas tengan bloque si no es COSECHA
        if (!esCosecha()) {
            const filas = document.querySelectorAll('#labor-input div[data-fila]');
            for (const fila of filas) {
                const inp = fila.querySelector('.inp-cantidad');
                const sel = fila.querySelector('.sel-bloque');
                const cantidad = parseFloat(inp?.value) || 0;
                const bloque = sel?.value || '';
                if (cantidad > 0 && !bloque) {
                    showNotification('El campo bloque es obligatorio para todas las actividades planificadas.', 'warning');
                    return;
                }
            }
        }

        if (esCosecha()) {
            const rows = document.querySelectorAll('#cosecha-form .cosecha-row');
            for (const row of rows) {
                const inp = row.querySelector('.inp-cantidad');
                const cantidad = parseFloat(inp?.value) || 0;
                if (cantidad <= 0) continue;
                
                const rend = parseFloat(inp.dataset.rend) || 1;
                const actId = parseInt(inp.dataset.actid);
                const tallosMalla = parseFloat(inp.dataset.tallosMalla) || 25;
                let horas = (cantidad / tallosMalla) / rend;
                
                if (!actId) { errores++; continue; }
                
                try {
                    await api.createPlanificacion({
                        semana: { id: semanaSeleccionada.id },
                        actividad: { id: actId },
                        bloque: null,
                        unidadesPlanificadas: cantidad,
                        rendimientoUsado: rend,
                        horasCalculadas: horas,
                        horasAjustadas: horas
                    });
                    guardados++;
                    inp.value = '';
                    document.getElementById(`hrs-${inp.dataset.cultivo}`).textContent = '--';
                    document.getElementById(`hrs-${inp.dataset.cultivo}`).style.color = 'var(--text-muted)';
                } catch(e) { errores++; }
            }
        } else {
            // Guardar desde labor-input
            const filas = document.querySelectorAll('#labor-input div[data-fila]');
            for (const fila of filas) {
                const filaId = fila.dataset.fila;
                const inp = fila.querySelector('.inp-cantidad');
                const sel = fila.querySelector('.sel-bloque');
                const cantidad = parseFloat(inp?.value) || 0;
                const bloque = sel?.value || '';
                
                if (cantidad <= 0) continue;
                
                const rend = parseFloat(inp.dataset.rend) || 1;
                const actId = parseInt(inp.dataset.actid);
                let horas = cantidad / rend;
                
                try {
                    await api.createPlanificacion({
                        semana: { id: semanaSeleccionada.id },
                        actividad: { id: actId },
                        bloque: bloque || null,
                        unidadesPlanificadas: cantidad,
                        rendimientoUsado: rend,
                        horasCalculadas: horas,
                        horasAjustadas: horas
                    });
                    guardados++;
                    inp.value = '';
                    if (sel) sel.value = '';
                    document.getElementById(`hrs-${filaId}`).textContent = '--';
                    document.getElementById(`hrs-${filaId}`).style.color = 'var(--text-muted)';
                    delete filasData[filaId];
                } catch(e) { errores++; }
            }
        }
        
        if (guardados > 0) {
            showNotification(`Guardados: ${guardados} items`, 'success');
            planificacionItems = await api.getPlanificacionSemana(semanaSeleccionada.codigoAass).catch(() => []);
            document.getElementById('tabla-plan').innerHTML = renderPlanificacion();
            actualizarContadores();
            filasData = {};
            laborActiva = null;
            renderContenidoLabores();
        }
        if (errores > 0) showNotification(`Errores: ${errores}`, 'error');
    };
    
    window.editarPlan = (id) => {
        editandoId = id;
        document.getElementById('tabla-plan').innerHTML = renderPlanificacion();
    };
    
    window.cancelarEdicion = () => {
        editandoId = null;
        document.getElementById('tabla-plan').innerHTML = renderPlanificacion();
    };
    
    window.guardarEdicion = async (id, rendOriginal) => {
        const bloque = document.getElementById(`edit-bloque-${id}`).value;
        const cantidad = parseFloat(document.getElementById(`edit-cant-${id}`).value) || 0;
        const plan = planificacionItems.find(p => p.id === id);
        
        const laborMadre = (plan?.actividad?.laborMadre || '').toUpperCase();
        const esCosechaItem = laborMadre === 'COSECHA';
        
        let horas;
        if (esCosechaItem) {
            const tallosMalla = TALLOS_POR_MALLA[plan?.actividad?.producto?.codigo] || 25;
            horas = (cantidad / tallosMalla) / rendOriginal;
        } else {
            horas = cantidad / rendOriginal;
        }
        
        try {
            await api.updatePlanificacion(id, {
                ...plan,
                bloque: bloque || null,
                unidadesPlanificadas: cantidad,
                horasCalculadas: horas,
                horasAjustadas: horas
            });
            editandoId = null;
            planificacionItems = await api.getPlanificacionSemana(semanaSeleccionada.codigoAass).catch(() => []);
            document.getElementById('tabla-plan').innerHTML = renderPlanificacion();
            actualizarContadores();
            showNotification('Actualizado', 'success');
        } catch(e) { 
            showNotification('Error al actualizar', 'error'); 
        }
    };
    
    window.eliminarPlan = async (id) => {
        if (!confirm('¿Eliminar esta planificación?')) return;
        try {
            await api.deletePlanificacion(id);
            planificacionItems = planificacionItems.filter(p => p.id !== id);
            document.getElementById('tabla-plan').innerHTML = renderPlanificacion();
            actualizarContadores();
            showNotification('Eliminado', 'success');
        } catch(e) { showNotification('Error', 'error'); }
    };

    window.toggleResumenCultivo = (cultivo) => {
        resumenExpandido[cultivo] = resumenExpandido[cultivo] === false ? true : false;
        document.getElementById('tabla-plan').innerHTML = renderPlanificacion();
    };

    window.recalcularPlanificacion = async () => {
        if (!confirm('Esto recalculará todos los totales de avance comparando con las ejecuciones reales. ¿Continuar?')) return;
        const btn = document.getElementById('btn-recalcular');
        if (btn) btn.disabled = true;
        try {
            await api.post('/api/ejecuciones/recalcular-todo');
            showNotification('Totales recalculados correctamente', 'success');
            // Recargar datos actuales
            planificacionItems = await api.getPlanificacionSemana(semanaSeleccionada.codigoAass).catch(() => []);
            document.getElementById('tabla-plan').innerHTML = renderPlanificacion();
        } catch(e) {
            showNotification('Error al recalcular', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    };
    
    // ========== NAVEGACION CON TECLADO (Enter → siguiente campo vacío) ==========
    const configurarNavegacionTeclado = () => {
        const contenedor = document.getElementById('contenido-labores');
        if (!contenedor) return;
        
        contenedor.addEventListener('keydown', (e) => {
            const keys = ['Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
            if (!keys.includes(e.key)) return;
            
            const target = e.target;
            const isInput = target.classList.contains('inp-cantidad');
            const isSelect = target.classList.contains('sel-bloque');
            
            if (!isInput && !isSelect) return;
            
            const allInputs = Array.from(document.querySelectorAll('.inp-cantidad, .sel-bloque'));
            const currentIndex = allInputs.indexOf(target);
            
            // Enter o Flecha Abajo -> Siguiente fila (mismo elemento si es posible)
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault();
                // Si es Enter en el input de cantidad, intentamos guardar la fila? 
                // No, mejor solo navegar para rapidez.
                
                // Encontrar el elemento en la misma columna de la siguiente fila
                // Como hay 2 elementos por fila (select e input), el salto es de +2
                const nextIndex = currentIndex + 2;
                if (nextIndex < allInputs.length) {
                    allInputs[nextIndex].focus();
                    if (allInputs[nextIndex].tagName === 'INPUT') allInputs[nextIndex].select();
                } else if (e.key === 'Enter') {
                    // Si es el último, quizás ir al botón guardar todo?
                }
            }
            
            // Flecha Arriba -> Fila anterior
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = currentIndex - 2;
                if (prevIndex >= 0) {
                    allInputs[prevIndex].focus();
                    if (allInputs[prevIndex].tagName === 'INPUT') allInputs[prevIndex].select();
                }
            }
            
            // Flecha Derecha -> Siguiente celda en la misma fila
            if (e.key === 'ArrowRight') {
                if (isSelect) {
                    e.preventDefault();
                    allInputs[currentIndex + 1]?.focus();
                    allInputs[currentIndex + 1]?.select();
                }
                // Si es input, el comportamiento natural es mover el cursos dentro del número,
                // a menos que esté al final. Para simplicidad, si es número no solemos mover flechas dentro.
            }
            
            // Flecha Izquierda -> Celda anterior en la misma fila
            if (e.key === 'ArrowLeft') {
                if (isInput) {
                    // Solo saltar si el cursor está al inicio o si queremos navegación pura
                    e.preventDefault();
                    allInputs[currentIndex - 1]?.focus();
                }
            }
        });

        // FIX: Permitir sobreescribir valores existentes - al hacer focus selecciona todo el texto
        contenedor.addEventListener('focusin', (e) => {
            if (e.target.classList.contains('inp-cantidad') || e.target.classList.contains('sel-bloque')) {
                if (e.target.tagName === 'INPUT') {
                    e.target.select();
                }
            }
        });
    };
    
    // Configurar navegación después de que el DOM se renderice
    setTimeout(configurarNavegacionTeclado, 100);
    
    // ========== RENDER PRINCIPAL ==========
    const wrapperClass = mode === 'actual' ? 'plan-semana-actual' : 'plan-semana-siguiente';
    const bannerHtml = mode === 'actual' 
        ? `
        <div class="plan-banner-alerta actual">
            <i class="fa-solid fa-circle-info"></i>
            <span>Estás planificando la <strong>Semana Actual (${semanaSeleccionada ? semanaSeleccionada.codigoAass : ''})</strong>. Las horas se guardarán en esta semana en curso.</span>
        </div>
        `
        : `
        <div class="plan-banner-alerta siguiente">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>Estás planificando la <strong>Semana Siguiente (${semanaSeleccionada ? semanaSeleccionada.codigoAass : ''})</strong>. Las horas se guardarán en la próxima semana.</span>
        </div>
        `;

    const autorizacionHtml = (mode === 'siguiente' && user.rol === 'ADMIN' && semanaSeleccionada) 
        ? `
        <div class="card" style="background:linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.15)); border:1px solid rgba(16,185,129,0.4); padding:1.25rem; margin-bottom:0.75rem; border-radius:12px; display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:1rem;">
                <div style="background:rgba(16,185,129,0.2); width:48px; height:48px; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#10B981; font-size:1.5rem;">
                    <i class="fa-solid fa-file-signature"></i>
                </div>
                <div>
                    <h4 style="margin:0; color:#E5E7EB; font-size:1rem; font-weight:700;">Autorización de Planificación</h4>
                    <p style="margin:0.25rem 0 0 0; color:var(--text-muted); font-size:0.8rem;">
                        Autoriza la <strong>Semana ${semanaSeleccionada.codigoAass}</strong> con un total de <strong>${calcularTotalHorasSemana().toFixed(1)}</strong> horas planificadas. Esto la convertirá en la <strong>Semana Actual</strong> en Ejecución y cerrará la semana previa.
                    </p>
                </div>
            </div>
            <button onclick="window.autorizarSemanaPlanificada('${semanaSeleccionada.codigoAass}')" 
                style="padding:0.75rem 1.5rem; background:linear-gradient(135deg, #10B981, #059669); color:white; border:none; border-radius:8px; font-weight:700; font-size:0.85rem; cursor:pointer; box-shadow: 0 4px 12px rgba(16,185,129,0.3); text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:0.5rem; transition:transform 0.2s;">
                <i class="fa-solid fa-circle-check"></i> Autorizar Planificación
            </button>
        </div>
        `
    const isClosed = semanaSeleccionada && (semanaSeleccionada.planificacionCerrada || semanaSeleccionada.estado === 'CERRADA');

    const actionButtonsHtml = isClosed 
        ? `
        <div style="padding:1rem; background:rgba(239,68,68,0.08); border-top:1px dashed rgba(239,68,68,0.25); text-align:center; color:#FCA5A5; font-size:0.85rem; width:100%; border-radius:0 0 12px 12px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:0.5rem;">
            <i class="fa-solid fa-lock" style="color:#EF4444;"></i> Planificación de la semana está cerrada. No se admiten cambios.
        </div>
        `
        : `
        <div style="padding:0.75rem; background:rgba(0,0,0,0.2); display:flex; gap:0.5rem; width:100%;">
            <button id="btn-recalcular" onclick="recalcularPlanificacion()" 
                style="flex:1; padding:0.75rem; background:rgba(59,130,246,0.15); color:#93C5FD; border:1px solid rgba(59,130,246,0.4); 
                       border-radius:8px; font-size:0.85rem; font-weight:600; cursor:pointer;">
                <i class="fa-solid fa-sync" style="margin-right:0.3rem;"></i> Recalcular
            </button>
            <button onclick="guardarTodo()" 
                style="flex:2; padding:0.75rem; background:linear-gradient(135deg, #10B981, #059669); 
                       color:white; border:none; border-radius:8px; font-size:1rem; font-weight:700; cursor:pointer;
                       box-shadow: 0 4px 12px rgba(16,185,129,0.4); text-transform:uppercase; letter-spacing:1px;">
                <i class="fa-solid fa-save" style="margin-right:0.5rem;"></i> Guardar Todo
            </button>
        </div>
        `;

    const copyBtnHtml = (mode === 'siguiente' && semanaActual && semanaSiguiente) 
        ? `
        <button id="btn-llenar-siguiente" onclick="llenarPlanSemanaSiguiente()" 
            style="padding:0.4rem 0.8rem; background:rgba(99,102,241,0.15); color:#818CF8; border:1px solid rgba(99,102,241,0.4); 
                   border-radius:8px; cursor:pointer; font-size:0.75rem; font-weight:600; outline:none; display:flex; align-items:center; gap:0.3rem;">
            <i class="fa-solid fa-copy"></i> Copiar Plan de Semana Actual (${semanaActual.codigoAass})
        </button>
        ` 
        : '';

    return `
        <div class="fade-in ${wrapperClass}">
            ${bannerHtml}
            ${autorizacionHtml}
            <!-- HEADER CON TOTALES -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.6rem;">
                    ${renderSemanaSelector()}
                    ${copyBtnHtml}
                </div>
                <div style="display:flex; gap:1rem; align-items:center;">
                    <span style="color:#F59E0B; font-weight:600; font-size:0.9rem;">
                        <span id="grupo-label">-</span>: <span id="total-hrs-grupo">0.0</span>h
                    </span>
                    <span style="color:#10B981; font-weight:700; font-size:1rem;">
                        Total: <span id="total-hrs-semana">${calcularTotalHorasSemana().toFixed(1)}</span>h
                    </span>
                </div>
            </div>
            
            <!-- CARD PRINCIPAL -->
            <div class="card" style="padding:0; margin-bottom:0.75rem; overflow:hidden;">
                
                <!-- GRUPO TABS -->
                <div style="padding:0.75rem; background:rgba(0,0,0,0.2); border-bottom:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:1px;">Actividad Madre</div>
                    <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                        ${renderGrupoTabs()}
                    </div>
                </div>
                
                <!-- CONTENIDO LABORES (dinámico según grupo) -->
                <div id="contenido-labores">
                    <div style="padding:1rem; text-align:center; color:var(--text-muted);">
                        <i class="fa-solid fa-hand-pointer" style="font-size:1.5rem; margin-bottom:0.5rem; display:block;"></i>
                        Selecciona una actividad madre arriba
                    </div>
                </div>
                
                <!-- BOTONES ACCION -->
                ${actionButtonsHtml}
            </div>
            
            <!-- PLANIFICACION GUARDADA (FILTRADA POR GRUPO) -->
            <div class="card" style="padding:0.75rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.3rem;">
                    <span style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">
                        <i class="fa-solid fa-list-check" style="margin-right:0.3rem; color:var(--primary);"></i> 
                        Planificación <span style="color:#F59E0B;" id="plan-grupo-label">${grupoActivo || ''}</span>
                    </span>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <button id="btn-eliminar-lote" onclick="window.eliminarPlanificacionLote()" 
                                style="display:none; background:rgba(239, 68, 68, 0.15); color:#FCA5A5; border:1px solid rgba(239, 68, 68, 0.3); padding:0.2rem 0.6rem; font-size:0.75rem; border-radius:6px; font-weight:bold; cursor:pointer; align-items:center; gap:0.25rem;">
                            <i class="fa-solid fa-trash-can"></i> Eliminar (<span id="count-eliminar-lote">0</span>)
                        </button>
                        <span id="total-hrs-ingresando" style="display:none; font-size:0.72rem; color:#F59E0B; font-weight:600; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); border-radius:6px; padding:0.15rem 0.4rem;"></span>
                        <span style="font-size:0.8rem; color:#93C5FD; font-weight:700;">
                            <i class="fa-solid fa-clock" style="margin-right:0.2rem; opacity:0.7;"></i>
                            <span id="total-hrs-tabla">0.0</span>h guardadas
                        </span>
                    </div>
                </div>
                <div style="max-height:180px; overflow-y:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                        <thead id="tabla-plan-head">
                            ${renderTablaHeader()}
                        </thead>
                        <tbody id="tabla-plan">
                            ${renderPlanificacion()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
  };
};

App.registerView('planificacion', initPlanificacionView('actual'));
App.registerView('planificacion-siguiente', initPlanificacionView('siguiente'));
