App.registerView('ejecucion', async () => {
    const TALLOS_POR_MALLA = {
        'GYPSOPHILA': 25, 'HYPERICUM': 25, 'VERONICA': 25, 'SOLIDAGO': 25, 'SUNFLOWER': 30, 'Eucalitpos': 25
    };

    const getLocalIsoDate = (dOb) => {
        const y = dOb.getFullYear();
        const m = String(dOb.getMonth() + 1).padStart(2, '0');
        const d = String(dOb.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const hoy = new Date();
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    const fechaManana = getLocalIsoDate(manana);
    const fechaHoy = getLocalIsoDate(hoy);

    // Cargar semana en ejecución y su planificación
    let semanaActual = null, planDiarioArr = [], planificacionItems = [], ejecuciones = [], areas = [], actividades = [], rendimientos = [], productos = [];
    let grupoActivo = null;
    let gruposUnicos = [];
    let fechaSeleccionada = window.fechaGlobalSeleccionada || fechaHoy;
    window.fechaGlobalSeleccionada = fechaSeleccionada;
    
    try {
        [semanaActual, areas, actividades, ejecuciones, rendimientos, productos] = await Promise.all([
            api.getSemanaActual().catch(() => null),
            api.getAreas().catch(() => []),
            api.getActividades().catch(() => []),
            api.getEjecuciones().catch(() => []),
            api.getRendimientos().catch(() => []),
            api.getProductos().catch(() => [])
        ]);
        
        if (semanaActual) {
            planificacionItems = await api.getPlanificacionSemana(semanaActual.codigoAass).catch(() => []);
            planDiarioArr = await api.getPlanDiarioFecha(fechaSeleccionada).catch(() => []);
            
            // Extraer grupos únicos para Ejecución
            const gruposSet = new Set();
            planificacionItems.forEach(p => {
                const rawName = (p.actividad?.laborMadre || p.actividad?.grupo || p.actividad?.nombre || 'OTRO').toUpperCase();
                p.grupoCalculado = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
                gruposSet.add(p.grupoCalculado);
            });
            
            // Etiquetar la colección separada de planDiarioArr para el filtro de la vista
            planDiarioArr.forEach(pd => {
                if(pd.planificacion) {
                    const rawName = (pd.planificacion.actividad?.laborMadre || pd.planificacion.actividad?.grupo || pd.planificacion.actividad?.nombre || 'OTRO').toUpperCase();
                    pd.planificacion.grupoCalculado = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
                    gruposSet.add(pd.planificacion.grupoCalculado);
                }
            });
            gruposUnicos = Array.from(gruposSet).sort();
            
            if (gruposUnicos.length > 0 && (!grupoActivo || !gruposUnicos.includes(grupoActivo))) {
                grupoActivo = gruposUnicos.includes('COSECHA') ? 'COSECHA' : gruposUnicos[0];
            }
        }
    } catch (e) {
        console.log('Error cargando ejecución:', e);
    }
    
    window.cambiarFechaEjecucion = (fecha) => {
        window.fechaGlobalSeleccionada = fecha;
        App.navigate('ejecucion');
    };
    
    // Función para cambiar el grupo sin recargar todo
    window.seleccionarGrupoEjecucion = (grupo) => {
        grupoActivo = grupo;
        document.getElementById('grid-container-ejecucion').innerHTML = window.renderPlanificacionParaEjecutar();
        document.querySelectorAll('.grupo-tab-ejecucion').forEach(t => {
            if (t.dataset.grupo === grupo) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });
        
        // Auto-sincronizar cosecha al hacer click en el grupo COSECHA
        if (grupo === 'COSECHA') {
            window.sincronizarCosechaApi();
        }
    };
    
    const renderGrupoTabs = () => {
        if (!gruposUnicos.length) return '<span style="color:var(--text-muted);">Sin actividades en la semana</span>';
        return gruposUnicos.map(g => {
            const isActive = grupoActivo === g ? 'active' : '';
            return `
            <button class="grupo-tab-ejecucion ${isActive}" data-grupo="${g}" onclick="seleccionarGrupoEjecucion('${g}')">
                ${g}
            </button>
            `;
        }).join('');
    };
    
    // Separar ejecuciones planificadas vs imprevistas
    const ejecucionesImprevistas = ejecuciones.filter(e => !e.planificacion && e.observacion?.includes('[IMPREVISTO]'));
    const totalHorasImprevistas = ejecucionesImprevistas.reduce((sum, e) => sum + (e.horasReales || 0), 0);
    
    // Calcular totales de la SEMANA para la barra superior
    const totalHorasPlanificadas = planificacionItems.reduce((sum, p) => sum + (p.horasAjustadas || p.horasCalculadas || 0), 0);
    const totalHorasEjecutadas = planificacionItems.reduce((sum, p) => sum + (p.horasEjecutadas || 0), 0);
    const porcentajeEjecucion = totalHorasPlanificadas > 0 ? Math.min(100, (totalHorasEjecutadas / totalHorasPlanificadas) * 100) : 0;
    
    // Calcular el total para el DIA
    const totalHorasPlanificadasDia = planDiarioArr.reduce((sum, pd) => sum + (pd.horasAsignadas || 0), 0);
    const totalHorasEjecutadasDia = ejecuciones.filter(e => e.fecha === fechaSeleccionada && e.planificacion).reduce((sum, e) => sum + (e.horasReales || 0), 0);
    
    // Función para calcular rendimiento real
    window.calcularRendimientoReal = (planId) => {
        const horasInput = document.getElementById(`horas-real-${planId}`);
        const unidadesInput = document.getElementById(`unidades-real-${planId}`);
        const rendSpan = document.getElementById(`rend-real-${planId}`);
        
        const horas = parseFloat(horasInput.value) || 0;
        const unidades = parseFloat(unidadesInput.value) || 0;
        
        if (horas > 0) {
            const rendimiento = unidades / horas;
            rendSpan.textContent = `${rendimiento.toFixed(1)} u/h`;
            rendSpan.style.color = '#10B981';
        } else {
            rendSpan.textContent = '--';
            rendSpan.style.color = 'var(--text-muted)';
        }
    };

    // Función para sincronizar la cosecha desde la API externa
    window.sincronizarCosechaApi = async () => {
        if (!semanaActual) {
            showNotification('No hay una semana activa cargada', 'error');
            return;
        }

        const diasSemanaNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const [y, m, d] = fechaSeleccionada.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const nombreDia = diasSemanaNombres[date.getDay()];

        showNotification('Conectando con la API de Cosecha...', 'info');

        let data;

        try {
            data = await api.request(`/ejecucion/cosechas-externas?semana=${encodeURIComponent(semanaActual.codigoAass)}`);
        } catch (e) {
            console.warn('Error fetching harvest API via proxy, attempting direct fetch:', e);
            try {
                const directUrl = `https://cosecha-app-1.onrender.com/api/resumen?semana=${encodeURIComponent(semanaActual.codigoAass)}`;
                const responseDirect = await fetch(directUrl);
                if (!responseDirect.ok) {
                    throw new Error(`Direct status: ${responseDirect.status}`);
                }
                data = await responseDirect.json();
                console.log('Successfully fetched harvest data directly from Render API.');
            } catch (directErr) {
                console.error('Direct fetch also failed:', directErr);
                showNotification('Error al conectar con la API de Cosecha. Sincronización cancelada para evitar datos incorrectos.', 'error');
                return;
            }
        }

        const registros = data.datos || [];
        if (!registros.length) {
            showNotification('No hay registros de cosecha disponibles para esta semana en la API', 'warning');
            return;
        }

        // Agrupar por producto_maestro para la fecha seleccionada
        const totalesPorProducto = {};
        registros.forEach(r => {
            if (r.fecha === fechaSeleccionada) {
                const prod = String(r.producto_maestro || '').toUpperCase().trim();
                const tallos = parseFloat(r.total_tallos || r.cantidad || r.unidades || 0);
                totalesPorProducto[prod] = (totalesPorProducto[prod] || 0) + tallos;
            }
        });

        let matchCount = 0;
        const rows = document.querySelectorAll('#grid-container-ejecucion tr[data-producto-codigo]');
        
        rows.forEach(row => {
            const rowProdCodigo = String(row.dataset.productoCodigo || '').toUpperCase().trim();
            const planId = row.dataset.id;
            
            if (rowProdCodigo && totalesPorProducto[rowProdCodigo] !== undefined) {
                const totalCosechado = totalesPorProducto[rowProdCodigo];
                const unidadesInput = document.getElementById(`unidades-real-${planId}`);
                
                if (unidadesInput) {
                    unidadesInput.value = totalCosechado;
                    calcularRendimientoReal(planId);
                    matchCount++;
                }
            }
        });

        if (matchCount > 0) {
            showNotification(`✓ Sincronizados ${matchCount} registros de cosecha desde la API`, 'success');
        } else {
            showNotification('No se encontraron coincidencias de cultivos entre la API y la planificación de hoy', 'info');
        }
    };
    
    // Función para guardar ejecución de una línea
    window.guardarEjecucionLinea = async (planId) => {
        const horasReales = parseFloat(document.getElementById(`horas-real-${planId}`).value);
        const unidadesReales = parseFloat(document.getElementById(`unidades-real-${planId}`).value);
        
        if (!horasReales || !unidadesReales) {
            showNotification('Ingresa horas y unidades reales', 'error');
            return;
        }
        
        const rendimientoReal = unidadesReales / horasReales;
        
        const btn = document.querySelector(`button[onclick="guardarEjecucionLinea(${planId})"]`);
        let originalHtml = '';
        if (btn) {
            originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }
        
        try {
            await api.createEjecucion({
                planificacion: { id: planId },
                semana: semanaActual ? { id: semanaActual.id } : null,
                fecha: fechaSeleccionada,
                horasReales: horasReales,
                unidadesReales: unidadesReales,
                rendimientoReal: rendimientoReal
            });
            
            showNotification(`✓ Ejecutado el ${fechaSeleccionada}: ${horasReales}h`, 'success');
            App.navigate('ejecucion');
        } catch (e) {
            showNotification('Error al guardar ejecución', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };

    // Guardar ejecución de todo lo ingresado en el listado activo
    window.guardarTodoEjecucion = async () => {
        const elementosParaMostrar = planDiarioArr.filter(pd => {
            const p = pd.planificacion;
            if (!p || p.grupoCalculado !== grupoActivo) return false;
            const hasEjec = ejecuciones.some(e => e.planificacion?.id === p.id && e.fecha === fechaSeleccionada);
            return !hasEjec;
        });

        const promesas = [];
        let creados = 0;

        for (const pd of elementosParaMostrar) {
            const p = pd.planificacion;
            if (!p) continue;

            const ejecsEstePlanDia = ejecuciones.filter(e => e.planificacion?.id === p.id && e.fecha === fechaSeleccionada);
            const horasEjecDia = ejecsEstePlanDia.reduce((sum, e) => sum + (e.horasReales || 0), 0);
            const planHoras = pd.horasAsignadas || 0;
            const completado = horasEjecDia >= planHoras && planHoras > 0;

            if (completado) continue; // Saltear filas completadas

            const horasInput = document.getElementById(`horas-real-${p.id}`);
            const unidadesInput = document.getElementById(`unidades-real-${p.id}`);

            if (!horasInput || !unidadesInput) continue;

            const horasReales = parseFloat(horasInput.value);
            const unidadesReales = parseFloat(unidadesInput.value);

            if (horasReales > 0 && unidadesReales > 0) {
                const rendimientoReal = unidadesReales / horasReales;
                promesas.push(api.createEjecucion({
                    planificacion: { id: p.id },
                    semana: semanaActual ? { id: semanaActual.id } : null,
                    fecha: fechaSeleccionada,
                    horasReales: horasReales,
                    unidadesReales: unidadesReales,
                    rendimientoReal: rendimientoReal
                }));
                creados++;
            }
        }

        if (promesas.length === 0) {
            showNotification('No hay nuevos avances reales ingresados para guardar.', 'info');
            return;
        }

        const btn = document.querySelector('button[onclick="guardarTodoEjecucion()"]');
        let originalHtml = '';
        if (btn) {
            originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> GUARDANDO AVANCES...';
        }
        showNotification('Guardando avances de ejecución...', 'info');

        try {
            await Promise.all(promesas);
            showNotification(`✓ ${creados} registros de ejecución guardados`, 'success');
            App.navigate('ejecucion');
        } catch (e) {
            showNotification('Error al guardar ejecuciones en lote', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };

    // Modal de edición de ejecuciones
    window.abrirModalEditarEjecucion = async (id, fecha, horas, unidades, observacion) => {
        document.getElementById('edit-ejec-id').value = id;
        document.getElementById('edit-ejec-fecha').value = fecha;
        document.getElementById('edit-ejec-horas').value = horas;
        document.getElementById('edit-ejec-unidades').value = unidades;
        document.getElementById('edit-ejec-observacion').value = observacion || '';

        const unidadesInput = document.getElementById('edit-ejec-unidades');

        // Buscar ejecución en el arreglo local
        const ejec = ejecuciones.find(e => e.id == id);
        const p = ejec?.planificacion;
        const act = ejec?.actividad || p?.actividad;
        const rawName = (act?.laborMadre || act?.grupo || act?.nombre || '').toUpperCase();
        const isCosecha = rawName.includes('COSECHA');

        if (isCosecha) {
            // Configurar input como de solo lectura
            unidadesInput.readOnly = true;
            unidadesInput.style.background = 'rgba(255,255,255,0.05)';
            unidadesInput.style.border = '1px solid rgba(255,255,255,0.1)';
            unidadesInput.style.color = '#94A3B8';
            unidadesInput.style.cursor = 'not-allowed';
            unidadesInput.tabIndex = -1;

            // Mostrar estado de carga
            unidadesInput.value = '';
            unidadesInput.placeholder = 'Cargando tallos actualizados...';

            try {
                const weekCode = ejec?.semana?.codigoAass || semanaActual?.codigoAass;
                if (!weekCode) {
                    throw new Error('No hay semana asociada');
                }

                const pdcto = p?.producto || p?.actividad?.producto || ejec?.actividad?.producto;
                const rowProdCodigo = String(pdcto?.codigo || '').toUpperCase().trim();

                if (!rowProdCodigo) {
                    throw new Error('No hay producto asociado');
                }

                let data;
                try {
                    data = await api.request(`/ejecucion/cosechas-externas?semana=${encodeURIComponent(weekCode)}`);
                } catch (proxyErr) {
                    console.warn('Error fetching harvest API via proxy for edit, trying direct URL:', proxyErr);
                    const directUrl = `https://cosecha-app-1.onrender.com/api/resumen?semana=${encodeURIComponent(weekCode)}`;
                    const responseDirect = await fetch(directUrl);
                    if (!responseDirect.ok) {
                        throw new Error(`Direct status: ${responseDirect.status}`);
                    }
                    data = await responseDirect.json();
                }
                const registros = data.datos || [];

                // Sumar tallos para la fecha del registro y el producto exacto
                let totalCosechado = 0;
                let foundMatch = false;
                registros.forEach(r => {
                    if (r.fecha === fecha) {
                        const prod = String(r.producto_maestro || '').toUpperCase().trim();
                        if (prod === rowProdCodigo) {
                            const tallos = parseFloat(r.total_tallos || r.cantidad || r.unidades || 0);
                            totalCosechado += tallos;
                            foundMatch = true;
                        }
                    }
                });

                if (foundMatch) {
                    unidadesInput.value = totalCosechado;
                    showNotification(`✓ Tallos actualizados desde API: ${totalCosechado}`, 'success');
                } else {
                    unidadesInput.value = unidades;
                    unidadesInput.placeholder = '';
                    showNotification('No se encontraron cosechas actualizadas en la API para esta fecha/producto. Se mantiene el valor actual.', 'warning');
                }
            } catch (err) {
                console.error('Error fetching updated harvest data for edit:', err);
                unidadesInput.value = unidades;
                unidadesInput.placeholder = '';
                showNotification('Error al consultar cosechas de la API. Se mantiene el valor original.', 'warning');
            }
        } else {
            // Actividad normal
            unidadesInput.readOnly = false;
            unidadesInput.style.background = '#0F172A';
            unidadesInput.style.border = '1px solid rgba(255,255,255,0.15)';
            unidadesInput.style.color = 'white';
            unidadesInput.style.cursor = 'auto';
            unidadesInput.tabIndex = 0;
            unidadesInput.placeholder = '';
        }

        document.getElementById('modal-edit-ejecucion').style.display = 'flex';
    };

    window.cerrarModalEditarEjecucion = () => {
        document.getElementById('modal-edit-ejecucion').style.display = 'none';
    };

    window.guardarEditarEjecucion = async () => {
        const id = document.getElementById('edit-ejec-id').value;
        const fecha = document.getElementById('edit-ejec-fecha').value;
        const horasReales = parseFloat(document.getElementById('edit-ejec-horas').value);
        const unidadesReales = parseFloat(document.getElementById('edit-ejec-unidades').value);
        const observacion = document.getElementById('edit-ejec-observacion').value;

        if (!fecha || !horasReales || !unidadesReales) {
            showNotification('Por favor, rellene todos los campos obligatorios.', 'error');
            return;
        }

        const btn = document.querySelector('button[onclick="guardarEditarEjecucion()"]');
        let originalHtml = '';
        if (btn) {
            originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        }

        try {
            await api.updateEjecucion(id, {
                fecha,
                horasReales,
                unidadesReales,
                observacion
            });
            showNotification('✓ Registro corregido con éxito', 'success');
            cerrarModalEditarEjecucion();
            App.navigate('ejecucion');
        } catch (e) {
            showNotification('Error al actualizar ejecución', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };

    window.eliminarEjecucionRegistro = async (id) => {
        if (!confirm('¿Está seguro de eliminar este registro de ejecución? Las horas del plan semanal se recalcularán automáticamente.')) {
            return;
        }

        try {
            await api.deleteEjecucion(id);
            showNotification('✓ Registro de ejecución eliminado', 'success');
            App.navigate('ejecucion');
        } catch (e) {
            showNotification('Error al eliminar ejecución', 'error');
        }
    };
    
    const activityBelongsToArea = (a, areaId) => {
        const area = areas.find(ar => ar.id == areaId);
        if (!area) return false;
        
        // 1. Direct match
        if (a.area && a.area.id == areaId) return true;
        
        // Fallback: match activity.laborMadre with area.codigo/nombre
        const cleanAreaCode = area.codigo ? area.codigo.replace('PY_', '').toUpperCase() : '';
        const cleanAreaNombre = area.nombre ? area.nombre.toUpperCase() : '';
        
        if (a.laborMadre) {
            const lm = a.laborMadre.toUpperCase();
            if (lm === cleanAreaCode || lm === cleanAreaNombre) return true;
        }
        
        // Fallback 2: match activity name containing cleanAreaCode/Nombre or vice versa
        if (a.nombre) {
            const nm = a.nombre.toUpperCase();
            if (nm.includes(cleanAreaCode) || nm.includes(cleanAreaNombre) || cleanAreaNombre.includes(nm)) return true;
        }
        
        // Fallback 3: check if there's any Rendimiento mapping for this activity that has the grupo matching this area
        const matchingRends = rendimientos.filter(r => r.actividad?.id === a.id);
        for (const r of matchingRends) {
            if (r.grupo) {
                const rg = r.grupo.toUpperCase();
                if (rg === cleanAreaCode || rg === cleanAreaNombre) return true;
            }
        }
        
        // Fallback 4: check if there's any Rendimiento mapping matching by NAME
        const hasMatchingYieldByName = rendimientos.some(r => 
            r.actividad?.nombre && a.nombre &&
            r.actividad.nombre.toUpperCase() === a.nombre.toUpperCase() &&
            r.grupo && (r.grupo.toUpperCase() === cleanAreaCode || r.grupo.toUpperCase() === cleanAreaNombre)
        );
        if (hasMatchingYieldByName) return true;
        
        return false;
    };

    // Filter crops (productos) for daily execution add form based on Area
    window.filtrarCultivosEjecucion = (areaId) => {
        const selectCultivo = document.getElementById('agregar-cultivo');
        const selectAct = document.getElementById('agregar-actividad');
        
        selectAct.innerHTML = '<option value="">Selecciona cultivo primero</option>';
        selectAct.disabled = true;
        document.getElementById('agregar-bloque-container').style.display = 'none';
        
        if (!areaId) {
            selectCultivo.innerHTML = '<option value="">Selecciona área primero</option>';
            selectCultivo.disabled = true;
            return;
        }
        
        const area = areas.find(ar => ar.id == areaId);
        const cleanAreaCode = area?.codigo ? area.codigo.replace('PY_', '').toUpperCase() : '';
        const cleanAreaNombre = area?.nombre ? area.nombre.toUpperCase() : '';
        
        // Find products that have yields defined in this Area (via group/area match or activity area match)
        const prodIds = new Set(
            rendimientos
                .filter(r => r.producto && (
                    (r.actividad?.area?.id == areaId) ||
                    (r.grupo && cleanAreaCode && r.grupo.toUpperCase() === cleanAreaCode) ||
                    (r.grupo && cleanAreaNombre && r.grupo.toUpperCase() === cleanAreaNombre)
                ))
                .map(r => r.producto.id)
        );
        const filteredProductos = productos.filter(p => prodIds.has(p.id));
        const finalProductos = filteredProductos.length > 0 ? filteredProductos : productos;
        
        selectCultivo.innerHTML = '<option value="">Seleccionar cultivo...</option>' +
            finalProductos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        selectCultivo.disabled = false;
    };

    // Función para filtrar actividades por área y cultivo (agregar línea)
    window.filtrarActividadesAgregar = () => {
        const areaId = document.getElementById('agregar-area').value;
        const cultivoId = document.getElementById('agregar-cultivo').value;
        const selectAct = document.getElementById('agregar-actividad');
        
        document.getElementById('agregar-bloque-container').style.display = 'none';
        
        if (!areaId || !cultivoId) {
            selectAct.innerHTML = '<option value="">Selecciona cultivo primero</option>';
            selectAct.disabled = true;
            return;
        }
        
        // Find activities belonging to this area and either general (!producto) or matching this crop or having yield for this crop
        const actividadesArea = actividades.filter(a => {
            const belongsToArea = activityBelongsToArea(a, areaId);
            if (!belongsToArea) return false;
            
            const hasDirectCrop = a.producto && a.producto.id == cultivoId;
            const isGeneral = !a.producto;
            const hasYieldForCrop = rendimientos.some(r => 
                r.producto?.id == cultivoId && 
                (r.actividad?.id == a.id || (r.actividad?.nombre && a.nombre && r.actividad.nombre.toUpperCase() === a.nombre.toUpperCase()))
            );
            
            return hasDirectCrop || isGeneral || hasYieldForCrop;
        });
        
        if (actividadesArea.length === 0) {
            selectAct.innerHTML = '<option value="">Sin actividades para esta área y cultivo</option>';
            selectAct.disabled = true;
        } else {
            // Eliminar duplicados visuales por nombre
            const nombresVistos = new Set();
            const actividadesUnicas = [];
            actividadesArea.forEach(a => {
                const nombreKey = (a.nombre || '').toUpperCase();
                if (!nombresVistos.has(nombreKey)) {
                    nombresVistos.add(nombreKey);
                    actividadesUnicas.push(a);
                }
            });
            
            selectAct.innerHTML = '<option value="">Seleccionar...</option>' + 
                actividadesUnicas.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');
            selectAct.disabled = false;
        }
    };
    
    // Función para mostrar campo bloque según actividad y cargar rendimiento
    window.actualizarBloqueAgregar = (actividadId) => {
        const actividad = actividades.find(a => a.id == actividadId);
        const container = document.getElementById('agregar-bloque-container');
        const label = document.getElementById('agregar-bloque-label');
        const rendInput = document.getElementById('agregar-rendimiento');
        const cultivoId = document.getElementById('agregar-cultivo').value;
        
        if (!actividad) {
            container.style.display = 'none';
            rendInput.value = '';
            return;
        }
        
        // Buscar rendimiento para esta actividad y cultivo, o fallback a general
        let rend = rendimientos.find(r => r.actividad?.id == actividadId && r.producto?.id == cultivoId) ||
                   rendimientos.find(r => r.actividad?.id == actividadId && !r.producto);
                   
        // Fallback: match by name if exact ID match fails
        if (!rend && actividad.nombre) {
            const nameUpper = actividad.nombre.toUpperCase();
            rend = rendimientos.find(r => r.actividad?.nombre && r.actividad.nombre.toUpperCase() === nameUpper && r.producto?.id == cultivoId) ||
                   rendimientos.find(r => r.actividad?.nombre && r.actividad.nombre.toUpperCase() === nameUpper && !r.producto);
        }
                     
        const rendVal = rend ? (rend.rendimiento ?? rend.valorRendimiento ?? 0) : 0;
        
        if (rendVal > 0) {
            rendInput.value = rendVal;
            calcularHorasAgregar();
        } else {
            rendInput.value = '';
        }
        
        if (actividad.esVarios) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        const esFerti = actividad.area?.codigo?.includes('FERTIRRIEGO');
        label.textContent = esFerti ? 'Válvulas' : 'Bloque(s)';
    };
    
    // Función para calcular horas en tiempo real (agregar línea)
    window.calcularHorasAgregar = () => {
        const unidades = parseFloat(document.getElementById('agregar-unidades').value) || 0;
        const rendimiento = parseFloat(document.getElementById('agregar-rendimiento').value) || 0;
        const span = document.getElementById('agregar-horas-preview');
        
        if (rendimiento > 0 && unidades > 0) {
            const horas = unidades / rendimiento;
            span.textContent = `${horas.toFixed(2)} h`;
            span.style.color = '#10B981';
        } else {
            span.textContent = '--';
            span.style.color = 'var(--text-muted)';
        }
    };
    
    // Función para agregar línea adicional de planificación
    window.agregarLineaPlanificacion = async () => {
        const actividadId = document.getElementById('agregar-actividad').value;
        const bloque = document.getElementById('agregar-bloque').value;
        const unidades = parseFloat(document.getElementById('agregar-unidades').value);
        const rendimiento = parseFloat(document.getElementById('agregar-rendimiento').value);
        const observacion = document.getElementById('agregar-observacion')?.value || '';
        
        if (!actividadId || !unidades || !rendimiento) {
            showNotification('Completa: Actividad, Unidades y Rendimiento', 'error');
            return;
        }
        
        const horasCalc = unidades / rendimiento;
        const actividad = actividades.find(a => a.id == actividadId);
        const esFerti = actividad?.area?.codigo?.includes('FERTIRRIEGO');
        
        try {
            const newPlan = await api.createPlanificacion({
                semana: { id: semanaActual.id },
                actividad: { id: parseInt(actividadId) },
                bloque: esFerti ? null : bloque,
                valvulas: esFerti ? bloque : null,
                unidadesPlanificadas: unidades,
                rendimientoUsado: rendimiento,
                horasCalculadas: horasCalc,
                horasAjustadas: horasCalc
            });
            
            if (newPlan && newPlan.id) {
                await api.crearPlanDiario({
                    planificacionId: newPlan.id,
                    fecha: fechaSeleccionada,
                    horasAsignadas: horasCalc,
                    unidadesAsignadas: unidades,
                    observacion: observacion || '[ADICIONAL]'
                });
            }
            
            showNotification(`✓ Línea agregada y asignada al día: ${horasCalc.toFixed(2)} horas`, 'success');
            App.navigate('ejecucion'); // Recargar vista
        } catch (e) {
            showNotification('Error al agregar línea', 'error');
        }
    };
    
    // Toggle sección agregar
    window.toggleSeccionAgregar = () => {
        const contenido = document.getElementById('agregar-contenido');
        const icono = document.getElementById('agregar-toggle-icon');
        if (contenido.style.display === 'none') {
            contenido.style.display = 'block';
            icono.className = 'fa-solid fa-chevron-up';
        } else {
            contenido.style.display = 'none';
            icono.className = 'fa-solid fa-chevron-down';
        }
    };
    
    // Renderizar opciones de áreas
    const renderAreasOptions = () => {
        if (areas.length === 0) return '<option value="">Sin áreas</option>';
        return '<option value="">Seleccionar área...</option>' + 
            areas.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');
    };
    
    // Renderizar tabla de ejecución DIARIA
    window.renderPlanificacionParaEjecutar = () => {
        const elementosParaMostrar = planDiarioArr.filter(pd => {
            const p = pd.planificacion;
            if (!p || p.grupoCalculado !== grupoActivo) return false;
            
            // Si ya hay alguna ejecución registrada para esta planificación en esta fecha, la quitamos
            const ejecsEstePlanDia = ejecuciones.filter(e => e.planificacion?.id === p.id && e.fecha === fechaSeleccionada);
            return ejecsEstePlanDia.length === 0;
        });
        
        elementosParaMostrar.sort((a,b) => {
            const cultA = (a.planificacion?.actividad?.producto?.nombre || a.planificacion?.actividad?.nombre || '').toUpperCase();
            const cultB = (b.planificacion?.actividad?.producto?.nombre || b.planificacion?.actividad?.nombre || '').toUpperCase();
            return cultA.localeCompare(cultB);
        });

        if (elementosParaMostrar.length === 0) {
            return `
                <tr>
                    <td colspan="11" style="text-align:center; color:var(--text-muted); padding:2rem;">
                        <i class="fa-solid fa-calendar-xmark" style="font-size:2rem; margin-bottom:0.5rem; display:block; opacity:0.5;"></i>
                        No hay Plan Diario asignado para la categoría <strong>${grupoActivo}</strong> en la fecha <strong>${fechaSeleccionada}</strong>.<br>Ve a la pantalla de <strong>Plan Diario</strong> para asignarlo.
                    </td>
                </tr>
            `;
        }
        return elementosParaMostrar.map(pd => {
            const p = pd.planificacion;
            if(!p) return '';
            
            const rawName = (p.actividad?.laborMadre || p.actividad?.grupo || p.actividad?.nombre || 'OTRO').toUpperCase();
            const isCosecha = rawName.includes('COSECHA');
            
            const rendRelacionado = rendimientos.find(r => r.actividad?.id === p.actividad?.id && (!p.actividad?.producto || r.producto?.id === p.actividad?.producto?.id));
            const getPlaceholderUnidad = (unidadCodigo) => {
                switch(unidadCodigo) {
                    case 'PLANTAS_HORA': return 'Pts';
                    case 'MALLAS_HORA': return 'Mallas';
                    case 'PINGOS_HORA': return 'Pingos';
                    case 'CAMAS_HORA': return 'Camas';
                    default: return 'unid';
                }
            };
            const unidadPlaceholder = isCosecha ? 'Tallos' : getPlaceholderUnidad(rendRelacionado?.unidad?.codigo);
            
            const horasPlanDia = pd.horasAsignadas || 0;
            const uniPlanDia = pd.unidadesAsignadas || 0;
            
            const ejecsEstePlanDia = ejecuciones.filter(e => e.planificacion?.id === p.id && e.fecha === fechaSeleccionada);
            const horasEjecDia = ejecsEstePlanDia.reduce((sum, e) => sum + (e.horasReales || 0), 0);
            const unidadesEjecDia = ejecsEstePlanDia.reduce((sum, e) => sum + (e.unidadesReales || 0), 0);
            
            const pendiente = Math.max(0, horasPlanDia - horasEjecDia);
            const uniPendiente = Math.max(0, uniPlanDia - unidadesEjecDia);
            const completado = horasEjecDia >= horasPlanDia && horasPlanDia > 0;
            
            const pdcto = p.producto || p.actividad?.producto;
            const dsc = (pdcto && pdcto.nombre) ? `${pdcto.nombre} - ${p.actividad?.nombre || ''}` : (p.actividad?.nombre || '-');
            
            return `
                <tr data-id="${p.id}" data-producto-codigo="${pdcto ? pdcto.codigo : ''}" style="${completado ? 'opacity:0.6;' : ''}">
                    <td>
                        ${completado ? '<i class="fa-solid fa-check-circle" style="color:#10B981;"></i>' : '<i class="fa-regular fa-circle" style="color:var(--text-muted);"></i>'}
                    </td>
                    <td>${p.actividad?.area?.nombre || '-'}</td>
                    <td>
                        <strong>${dsc}</strong>
                    </td>
                    <td>${p.bloque || p.valvulas || '-'}</td>
                    <td style="text-align:right;">
                        <span class="badge" style="background:rgba(59, 130, 246, 0.2); color:#93C5FD; display:block; margin-bottom:2px;">${uniPlanDia.toFixed(0)} ${unidadPlaceholder}</span>
                        <span class="badge" style="background:rgba(59, 130, 246, 0.2); color:#93C5FD; display:block;">${horasPlanDia.toFixed(1)}h</span>
                    </td>
                    <td style="text-align:right;">
                        <span class="badge" style="background:${completado ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}; color:${completado ? '#A7F3D0' : '#FCD34D'}; display:block; margin-bottom:2px;">
                            ${unidadesEjecDia.toFixed(0)}
                        </span>
                        <span class="badge" style="background:${completado ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}; color:${completado ? '#A7F3D0' : '#FCD34D'}; display:block;">
                            ${horasEjecDia.toFixed(1)}h
                        </span>
                    </td>
                    <td style="text-align:center; font-weight:bold; color:var(--text-muted); font-size:0.8rem;">
                        ${unidadPlaceholder}
                    </td>
                    ${!completado ? `
                        <td style="text-align:center;">
                            <input type="number" id="unidades-real-${p.id}" placeholder="${uniPendiente.toFixed(0)}" min="0" onfocus="this.select()"
                                   oninput="calcularRendimientoReal(${p.id})"
                                   ${isCosecha ? 'readonly tabindex="-1"' : ''}
                                   style="width:70px; padding:0.3rem; border-radius:6px; background:${isCosecha ? 'rgba(255,255,255,0.05)' : 'var(--surface-glass)'}; border:1px solid ${isCosecha ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)'}; color:${isCosecha ? '#94A3B8' : 'white'}; text-align:center; cursor:${isCosecha ? 'not-allowed' : 'auto'};">
                        </td>
                        <td style="text-align:center;">
                            <input type="number" id="horas-real-${p.id}" placeholder="${pendiente.toFixed(1)}" step="0.5" min="0" onfocus="this.select()"
                                   oninput="calcularRendimientoReal(${p.id})"
                                   style="width:70px; padding:0.3rem; border-radius:6px; background:var(--surface-glass); border:1px solid rgba(255,255,255,0.2); color:white; text-align:center;">
                        </td>
                        <td style="text-align:center;">
                            <span id="rend-real-${p.id}" style="color:var(--text-muted);">--</span>
                        </td>
                        <td>
                            <button class="btn btn-primary" style="padding:0.4rem 0.8rem; background:linear-gradient(135deg, #10B981, #059669); border:none;" onclick="guardarEjecucionLinea(${p.id})" title="Guardar avance">
                                <i class="fa-solid fa-floppy-disk"></i>
                            </button>
                        </td>
                    ` : `
                        <td colspan="4" style="text-align:center; color:#10B981;"><i class="fa-solid fa-check-double"></i> Completado (${unidadesEjecDia} u)</td>
                    `}
                </tr>
            `;
        }).join('');
    };
    
    // Generar opciones de días de la semana
    const renderDiasSemana = () => {
        if (!semanaActual) return '';
        
        const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        const [sy, sm, sd] = semanaActual.fechaInicio.split('T')[0].split('-');
        const fechaInicioLocal = new Date(sy, sm - 1, sd);
        let html = '<div style="display:flex; gap:0.5rem; overflow-x:auto; padding-bottom:0.5rem;">';
        
        for (let i = 0; i < 7; i++) {
            const cDate = new Date(fechaInicioLocal);
            cDate.setDate(cDate.getDate() + i);
            const fechaStr = getLocalIsoDate(cDate);
            
            const esMañana = fechaStr === fechaManana;
            const esHoy = fechaStr === fechaHoy;
            const esSeleccionado = fechaStr === fechaSeleccionada;
            
            html += `
                <button class="dia-btn ${esSeleccionado ? 'active' : ''}" 
                        onclick="cambiarFechaEjecucion('${fechaStr}')"
                        style="flex:1; min-width:60px; padding:0.5rem; border:none; 
                               background:${esSeleccionado ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : 'rgba(255,255,255,0.08)'}; 
                               color:white; border-radius:8px; cursor:pointer; font-size:0.85rem; font-weight:600;
                               display:flex; flex-direction:column; align-items:center;
                               box-shadow:${esSeleccionado ? '0 2px 8px rgba(59,130,246,0.4)' : 'none'};">
                    <span style="font-size:0.7rem; color:${esSeleccionado ? '#DBEAFE' : 'var(--text-muted)'}; text-transform:uppercase;">${diasSemana[i]}</span>
                    <span style="font-size:1.1rem; margin-top:0.2rem;">${fechaStr.split('-')[2]}</span>
                    ${esHoy ? '<span style="font-size:0.6rem; background:#10B981; padding:0.1rem 0.3rem; border-radius:4px; margin-top:0.2rem;">Hoy</span>' : ''}
                </button>
            `;
        }
        html += '</div>';
        return html;
    };

    // Renderizar historial de ejecuciones agrupado
    const renderHistorialEjecuciones = (ejecsFiltradas) => {
        if (!ejecsFiltradas || ejecsFiltradas.length === 0) return '';

        const getNombreDiaSemana = (fechaStr) => {
            const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const [y, m, d] = fechaStr.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            return diasNombres[date.getDay()];
        };

        // Agrupar
        const agrupados = {};
        ejecsFiltradas.forEach(e => {
            const fecha = e.fecha || 'Sin Fecha';
            
            const rawName = (e.planificacion?.actividad?.laborMadre || e.actividad?.laborMadre || 'OTRO').toUpperCase();
            const grupo = rawName.includes('COSECHA') ? 'COSECHA' : rawName;
            
            const cultivo = (e.planificacion?.actividad?.producto?.nombre || e.actividad?.producto?.nombre || 'GENERAL').toUpperCase();
            
            if (!agrupados[fecha]) agrupados[fecha] = {};
            if (!agrupados[fecha][grupo]) agrupados[fecha][grupo] = {};
            if (!agrupados[fecha][grupo][cultivo]) agrupados[fecha][grupo][cultivo] = [];
            
            agrupados[fecha][grupo][cultivo].push(e);
        });

        // Ordenar fechas descendente
        const fechasOrdenadas = Object.keys(agrupados).sort((a, b) => b.localeCompare(a));
        
        // Mantener registro de qué días están expandidos (por defecto, el primero)
        if (window.historialExpandido === undefined) {
            window.historialExpandido = {};
            if (fechasOrdenadas.length > 0) {
                window.historialExpandido[fechasOrdenadas[0]] = true; // El más reciente abierto por defecto
            }
        }

        window.toggleDiaHistorial = (fecha) => {
            window.historialExpandido[fecha] = !window.historialExpandido[fecha];
            const hDiv = document.getElementById('historial-ejecuciones-dinamico');
            if (hDiv) hDiv.innerHTML = renderHistorialEjecuciones(ejecsFiltradas);
        };

        return fechasOrdenadas.map(fecha => {
            const abierto = !!window.historialExpandido[fecha];
            const grupos = agrupados[fecha];
            const totalHorasDia = Object.values(grupos).reduce((sumG, g) => 
                sumG + Object.values(g).reduce((sumC, cList) => 
                    sumC + cList.reduce((sumE, e) => sumE + (e.horasReales || 0), 0)
                , 0)
            , 0);

            let htmlDia = `
                <div class="dia-historial-container" style="margin-bottom:1rem; border:1px solid rgba(255,255,255,0.08); border-radius:12px; overflow:hidden; background:rgba(255,255,255,0.01);">
                    <!-- CABECERA DIA -->
                    <div onclick="toggleDiaHistorial('${fecha}')" 
                         style="display:flex; align-items:center; justify-content:space-between; padding:0.6rem 1rem; background:rgba(255,255,255,0.04); cursor:pointer; user-select:none;">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <i class="fa-solid ${abierto ? 'fa-chevron-down' : 'fa-chevron-right'}" style="color:var(--primary); font-size: 0.8rem;"></i>
                            <span style="font-size:0.85rem; font-weight:600; color:white;">
                                <i class="fa-solid fa-calendar-day" style="opacity:0.7; margin-right:0.3rem; font-size: 0.8rem;"></i> 
                                <span style="text-transform: capitalize;">${getNombreDiaSemana(fecha)}</span> (${fecha})
                            </span>
                        </div>
                        <span class="badge" style="background:rgba(59, 130, 246, 0.2); color:#93C5FD; font-weight:bold; font-size:0.75rem; padding: 0.2rem 0.6rem;">
                            ${totalHorasDia.toFixed(1)}h ejecutadas
                        </span>
                    </div>
                    
                    <!-- CONTENIDO DIA -->
                    <div style="display:${abierto ? 'block' : 'none'}; padding:1rem; border-top:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.15);">
            `;

            // Recorrer grupos
            const gruposOrdenados = Object.keys(grupos).sort();
            gruposOrdenados.forEach(grupo => {
                const cultivos = grupos[grupo];
                htmlDia += `
                    <div style="margin-bottom:1rem; border-left:3px solid var(--primary); padding-left:0.75rem;">
                        <h4 style="color:var(--primary); text-transform:uppercase; font-size:0.9rem; font-weight:800; margin-bottom:0.5rem; letter-spacing:0.5px;">
                            ${grupo}
                        </h4>
                `;

                // Recorrer cultivos
                const cultivosOrdenados = Object.keys(cultivos).sort();
                cultivosOrdenados.forEach(cultivo => {
                    const ejecs = cultivos[cultivo];
                    htmlDia += `
                        <div style="margin-bottom:0.5rem; margin-left:0.5rem;">
                            <h5 style="color:#F59E0B; font-size:0.8rem; font-weight:700; margin-bottom:0.3rem;">
                                <i class="fa-solid fa-leaf" style="font-size:0.75rem; margin-right:0.25rem;"></i> CULTIVO: ${cultivo}
                            </h5>
                            
                            <table style="width:100%; font-size:0.8rem; border-collapse:collapse; margin-bottom:0.5rem; background:rgba(255,255,255,0.02); border-radius:6px; overflow:hidden;">
                                <thead>
                                    <tr style="background:rgba(0,0,0,0.3); color:var(--text-muted); text-transform:uppercase; font-size:0.65rem;">
                                        <th style="padding:0.4rem 0.6rem;">Actividad</th>
                                        <th style="padding:0.4rem 0.6rem; text-align:center;">Bloque</th>
                                        <th style="padding:0.4rem 0.6rem; text-align:center;">Tipo</th>
                                        <th style="padding:0.4rem 0.6rem; text-align:right;">Horas</th>
                                        <th style="padding:0.4rem 0.6rem; text-align:right;">Unidades</th>
                                        <th style="padding:0.4rem 0.6rem; text-align:center;">Rendimiento</th>
                                        <th style="padding:0.4rem 0.6rem; text-align:center; width:100px;">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${ejecs.map(e => {
                                        const esImprevisto = !e.planificacion && e.observacion?.includes('[IMPREVISTO]');
                                        const actNombre = e.planificacion?.actividad?.nombre || e.actividad?.nombre || '-';
                                        const bloqueStr = e.planificacion?.bloque || e.planificacion?.valvulas || '-';
                                        const obsEscapada = (e.observacion || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
                                        
                                        return `
                                            <tr style="border-top:1px solid rgba(255,255,255,0.03);">
                                                <td style="padding:0.5rem 0.6rem;">
                                                    <strong>${actNombre}</strong>
                                                    ${e.observacion ? `<br><small style="color:var(--text-muted); font-style:italic;">"${e.observacion}"</small>` : ''}
                                                </td>
                                                <td style="padding:0.5rem 0.6rem; text-align:center; color:white;">${bloqueStr}</td>
                                                <td style="padding:0.5rem 0.6rem; text-align:center;">
                                                    ${esImprevisto 
                                                        ? '<span class="badge" style="background:rgba(245, 158, 11, 0.2); color:#FCD34D; font-size:0.65rem; padding:0.1rem 0.3rem;">IMPREV.</span>' 
                                                        : '<span class="badge" style="background:rgba(59, 130, 246, 0.2); color:#93C5FD; font-size:0.65rem; padding:0.1rem 0.3rem;">PLAN.</span>'}
                                                </td>
                                                <td style="padding:0.5rem 0.6rem; text-align:right; font-weight:600; color:white;">${(e.horasReales || 0).toFixed(1)}h</td>
                                                <td style="padding:0.5rem 0.6rem; text-align:right; font-weight:600; color:white;">${(e.unidadesReales || 0).toLocaleString()}</td>
                                                <td style="padding:0.5rem 0.6rem; text-align:center;">
                                                    <span class="badge" style="background:rgba(16, 185, 129, 0.15); color:#A7F3D0; font-size:0.7rem;">
                                                        ${(e.rendimientoReal || 0).toFixed(1)} u/h
                                                    </span>
                                                </td>
                                                <td style="padding:0.5rem 0.6rem; text-align:center;">
                                                    <div style="display:flex; gap:0.3rem; justify-content:center;">
                                                        <button class="btn btn-sm" onclick="abrirModalEditarEjecucion(${e.id}, '${e.fecha}', ${e.horasReales}, ${e.unidadesReales}, '${obsEscapada}')"
                                                                style="padding:3px 6px; font-size:0.75rem; border:1px solid rgba(59, 130, 246, 0.3); color:#93C5FD; background:rgba(59, 130, 246, 0.1); cursor:pointer; border-radius:4px;">
                                                            <i class="fa-solid fa-pencil"></i>
                                                        </button>
                                                        <button class="btn btn-sm" onclick="eliminarEjecucionRegistro(${e.id})"
                                                                style="padding:3px 6px; font-size:0.75rem; border:1px solid rgba(239, 68, 68, 0.3); color:#FCA5A5; background:rgba(239, 68, 68, 0.1); cursor:pointer; border-radius:4px;">
                                                            <i class="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                });

                htmlDia += `</div>`;
            });

            htmlDia += `
                    </div>
                </div>
            `;
            return htmlDia;
        }).join('');
    };

    // ========== NAVEGACION CON TECLADO EJECUCION ==========
    const configurarNavegacionTecladoEjecucion = () => {
        const contenedor = document.getElementById('grid-container-ejecucion');
        if (!contenedor) return;

        contenedor.addEventListener('keydown', (e) => {
            const keys = ['Enter', 'ArrowUp', 'ArrowDown'];
            if (!keys.includes(e.key)) return;

            const target = e.target;
            const isUnidades = target.id && target.id.startsWith('unidades-real-');
            const isHoras = target.id && target.id.startsWith('horas-real-');
            if (!isUnidades && !isHoras) return;

            const selector = isUnidades ? 'input[id^="unidades-real-"]' : 'input[id^="horas-real-"]';
            const allInputs = Array.from(contenedor.querySelectorAll(selector));
            const currentIndex = allInputs.indexOf(target);

            if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = currentIndex + 1;
                if (nextIndex < allInputs.length) {
                    allInputs[nextIndex].focus();
                    allInputs[nextIndex].select();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = currentIndex - 1;
                if (prevIndex >= 0) {
                    allInputs[prevIndex].focus();
                    allInputs[prevIndex].select();
                }
            }
        });
        
        contenedor.addEventListener('focusin', (e) => {
            if (e.target.id && (e.target.id.startsWith('unidades-real-') || e.target.id.startsWith('horas-real-'))) {
                e.target.select();
            }
        });
    };

    if (window.historialGlobalExpandido === undefined) {
        window.historialGlobalExpandido = false;
    }
    
    window.toggleHistorialGlobal = () => {
        window.historialGlobalExpandido = !window.historialGlobalExpandido;
        App.navigate('ejecucion');
    };

    const inicioFechaSemana = semanaActual?.fechaInicio ? semanaActual.fechaInicio.split('T')[0] : '';
    const finFechaSemana = semanaActual?.fechaFin ? semanaActual.fechaFin.split('T')[0] : '';
    const ejecucionesFiltradas = (semanaActual && inicioFechaSemana && finFechaSemana)
        ? ejecuciones.filter(e => e.fecha >= inicioFechaSemana && e.fecha <= finFechaSemana)
        : [];

    setTimeout(() => {
        configurarNavegacionTecladoEjecucion();
        if (grupoActivo === 'COSECHA') {
            window.sincronizarCosechaApi();
        }
    }, 100);

    return `
        <div class="fade-in">
            <!-- Header con resumen -->
            <div class="top-actions" style="margin-bottom: 1rem; justify-content: space-between;">
                <div style="display:flex; gap:0.5rem; align-items:center;">
                    <span style="color:var(--text-muted);">Ejecutando:</span>
                    <span class="badge" style="font-size:1rem; padding:0.5rem 1rem; background:rgba(16, 185, 129, 0.2); color:#A7F3D0;">
                        ${semanaActual ? `Semana ${semanaActual.codigoAass}` : 'Sin semana activa'}
                    </span>
                </div>
                <div style="display:flex; gap:1rem; align-items:center;">
                    <div style="text-align:right;">
                        <span style="font-size:0.8rem; color:var(--text-muted);">Avance (Semana):</span>
                        <span style="font-size:1.2rem; font-weight:600; color:${porcentajeEjecucion >= 80 ? '#10B981' : porcentajeEjecucion >= 50 ? '#F59E0B' : '#EF4444'};">
                            ${porcentajeEjecucion.toFixed(0)}%
                        </span>
                    </div>
                    <div style="width:150px; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
                        <div style="width:${porcentajeEjecucion}%; height:100%; background:linear-gradient(90deg, #10B981, #3B82F6); transition:width 0.5s;"></div>
                    </div>
                    ${totalHorasImprevistas > 0 ? `<div style="text-align:right; margin-left:1rem; padding-left:1rem; border-left:1px solid rgba(255,255,255,0.1);"><span style="font-size:0.8rem; color:#F59E0B;">Imprevistos:</span><span style="font-size:1.1rem; font-weight:600; color:#FCD34D;"> ${totalHorasImprevistas.toFixed(1)}h</span></div>` : ''}
                </div>
            </div>
            
            ${renderDiasSemana()}
            
            <!-- Tabla principal de ejecución -->
            <div class="card" style="margin-top:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h3><i class="fa-solid fa-hammer" style="color:var(--primary); margin-right:0.5rem;"></i> Ejecutar Actividades Planificadas</h3>
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <div style="font-size:0.9rem; color:var(--text-muted); text-align:right;">
                            ${totalHorasEjecutadas.toFixed(1)}h de ${totalHorasPlanificadas.toFixed(1)}h planificadas
                        </div>

                        <button class="btn btn-primary" onclick="guardarTodoEjecucion()" 
                                style="background:linear-gradient(135deg, #10B981, #059669); border:none; font-weight:800; font-size:0.95rem; padding:0.8rem 1.5rem; border-radius:8px; box-shadow:0 4px 15px rgba(16, 185, 129, 0.4); letter-spacing:0.5px; text-transform:uppercase; display:inline-flex; align-items:center; gap:0.5rem; cursor:pointer;">
                            <i class="fa-solid fa-floppy-disk"></i> GUARDAR AVANCES DE EJECUCIÓN DEL DÍA
                        </button>
                    </div>
                </div>
                
                <p style="color:var(--text-muted); margin-bottom:1rem; font-size:0.9rem;">
                    <i class="fa-solid fa-info-circle"></i> Ingresa las horas y unidades reales para cada actividad. El rendimiento real se calcula automáticamente.
                </p>
                
                <!-- GRUPO TABS -->
                <div style="padding:0.75rem; background:rgba(0,0,0,0.2); border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:1rem; border-radius:8px;">
                    <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.4rem; text-transform:uppercase; letter-spacing:1px;">Filtro de Actividad Madre</div>
                    <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                        ${renderGrupoTabs()}
                    </div>
                </div>
                
                <div style="overflow-x:auto;">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:30px;"></th>
                                <th>Área</th>
                                <th>Actividad</th>
                                <th>Bloque</th>
                                <th style="text-align:right;">Plan.</th>
                                <th style="text-align:right;">Ejec.</th>
                                <th style="text-align:center;">Unidad</th>
                                <th style="text-align:center;">Cant. Real</th>
                                <th style="text-align:center;">Horas Real</th>
                                <th style="text-align:center;">Rend.</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="grid-container-ejecucion">
                            ${window.renderPlanificacionParaEjecutar()}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Sección Agregar Línea de Planificación -->
            <div class="card" style="margin-top:1.5rem; border: 1px solid rgba(16, 185, 129, 0.3);">
                <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleSeccionAgregar()">
                    <h3 style="margin:0;"><i class="fa-solid fa-plus-circle" style="color:#10B981; margin-right:0.5rem;"></i> Agregar Línea de Planificación</h3>
                    <i id="agregar-toggle-icon" class="fa-solid fa-chevron-down" style="color:var(--text-muted);"></i>
                </div>
                
                <div id="agregar-contenido" style="display:none; margin-top:1.5rem;">
                    <p style="color:var(--text-muted); margin-bottom:1rem; font-size:0.9rem;"><i class="fa-solid fa-lightbulb"></i> Agrega actividades adicionales solicitadas que no estaban en la planificación original.</p>
                    
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:1rem;">
                        <div>
                            <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--text-muted);">Área</label>
                            <select id="agregar-area" onchange="filtrarCultivosEjecucion(this.value)" style="width:100%; padding:0.6rem; border-radius:8px; background:#1E293B; border:1px solid rgba(255,255,255,0.2); color:white;">${renderAreasOptions()}</select>
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--text-muted);">Cultivo (Producto)</label>
                            <select id="agregar-cultivo" onchange="filtrarActividadesAgregar()" style="width:100%; padding:0.6rem; border-radius:8px; background:#1E293B; border:1px solid rgba(255,255,255,0.2); color:white;" disabled><option value="">Selecciona área primero</option></select>
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--text-muted);">Actividad</label>
                            <select id="agregar-actividad" onchange="actualizarBloqueAgregar(this.value)" style="width:100%; padding:0.6rem; border-radius:8px; background:#1E293B; border:1px solid rgba(255,255,255,0.2); color:white;" disabled><option value="">Selecciona cultivo primero</option></select>
                        </div>
                        <div id="agregar-bloque-container" style="display:none;">
                            <label id="agregar-bloque-label" style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--text-muted);">Bloque(s)</label>
                            <input type="text" id="agregar-bloque" list="list-bloques" placeholder="Ej: B1, B2" style="width:100%; padding:0.6rem; border-radius:8px; background:var(--surface-glass); border:1px solid rgba(255,255,255,0.2); color:white;" onfocus="this.select()">
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--text-muted);">Rendimiento (unid/h)</label>
                            <input type="number" id="agregar-rendimiento" placeholder="Auto" min="0.1" step="0.1" oninput="calcularHorasAgregar()" style="width:100%; padding:0.6rem; border-radius:8px; background:var(--surface-glass); border:1px solid rgba(255,255,255,0.2); color:white;">
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--text-muted);">Unidades *</label>
                            <input type="number" id="agregar-unidades" placeholder="Ej: 30" min="0" oninput="calcularHorasAgregar()" style="width:100%; padding:0.6rem; border-radius:8px; background:var(--surface-glass); border:1px solid rgba(255,255,255,0.2); color:white;">
                        </div>
                        <div style="display:flex; flex-direction:column; justify-content:flex-end;">
                            <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--text-muted);">Horas Calculadas</label>
                            <div style="padding:0.6rem; text-align:center;"><span id="agregar-horas-preview" style="font-size:1.1rem; color:#10B981;">--</span></div>
                        </div>
                    </div>
                    
                    <div style="margin-top:1rem;">
                        <label style="display:block; margin-bottom:0.5rem; font-size:0.85rem; color:var(--text-muted);">Observación (opcional)</label>
                        <textarea id="agregar-observacion" rows="2" placeholder="Ej: Actividad solicitada adicionalmente por supervisor..." style="width:100%; padding:0.6rem; border-radius:8px; background:var(--surface-glass); border:1px solid rgba(255,255,255,0.2); color:white; resize:vertical;"></textarea>
                    </div>
                    
                    <button class="btn btn-primary" style="margin-top:1rem; width:100%;" onclick="agregarLineaPlanificacion()">
                        <i class="fa-solid fa-plus-circle"></i> Agregar a Planificación
                    </button>
                </div>
            </div>
            
            <!-- Historial -->
            ${ejecucionesFiltradas.length > 0 ? `
            <div class="card" style="margin-top:1.5rem; border: 1px solid rgba(139, 92, 246, 0.2);">
                <div onclick="window.toggleHistorialGlobal()" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
                    <h3 style="margin:0;"><i class="fa-solid fa-history" style="color:var(--secondary); margin-right:0.5rem;"></i> Historial de Ejecuciones de la Semana <span class="badge" style="margin-left:0.5rem; background:var(--secondary); color:white;">${ejecucionesFiltradas.length}</span></h3>
                    <i class="fa-solid ${window.historialGlobalExpandido ? 'fa-chevron-up' : 'fa-chevron-down'}" style="color:var(--text-muted);"></i>
                </div>
                <div id="historial-ejecuciones-dinamico" style="margin-top:1.5rem; display:${window.historialGlobalExpandido ? 'block' : 'none'};">
                    ${renderHistorialEjecuciones(ejecucionesFiltradas)}
                </div>
            </div>
            ` : ''}
        </div>

        <!-- MODAL DE EDICIÓN DE EJECUCIONES -->
        <div id="modal-edit-ejecucion" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:9999; justify-content:center; align-items:center;">
            <div class="modal-content" style="background:#1E293B; border:1px solid rgba(255,255,255,0.15); border-radius:12px; padding:1.5rem; max-width:400px; width:90%; color:white; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <h3 style="margin-top:0; margin-bottom:1rem; color:var(--primary); display:flex; align-items:center; gap:0.5rem;">
                    <i class="fa-solid fa-pencil"></i> Editar Ejecución
                </h3>
                <input type="hidden" id="edit-ejec-id">
                
                <div style="margin-bottom:1rem;">
                    <label style="display:block; margin-bottom:0.4rem; font-size:0.85rem; color:var(--text-muted);">Fecha</label>
                    <input type="date" id="edit-ejec-fecha" style="width:100%; padding:0.6rem; border-radius:8px; background:#0F172A; border:1px solid rgba(255,255,255,0.15); color:white;">
                </div>
                
                <div style="margin-bottom:1rem;">
                    <label style="display:block; margin-bottom:0.4rem; font-size:0.85rem; color:var(--text-muted);">Cantidad Real Trabajada</label>
                    <input type="number" id="edit-ejec-unidades" min="0" style="width:100%; padding:0.6rem; border-radius:8px; background:#0F172A; border:1px solid rgba(255,255,255,0.15); color:white; font-weight:700;">
                </div>
                
                <div style="margin-bottom:1rem;">
                    <label style="display:block; margin-bottom:0.4rem; font-size:0.85rem; color:var(--text-muted);">Horas Reales Invertidas</label>
                    <input type="number" id="edit-ejec-horas" min="0.1" step="0.1" style="width:100%; padding:0.6rem; border-radius:8px; background:#0F172A; border:1px solid rgba(255,255,255,0.15); color:white; font-weight:700;">
                </div>
                
                <div style="margin-bottom:1.5rem;">
                    <label style="display:block; margin-bottom:0.4rem; font-size:0.85rem; color:var(--text-muted);">Observación</label>
                    <textarea id="edit-ejec-observacion" rows="2" style="width:100%; padding:0.6rem; border-radius:8px; background:#0F172A; border:1px solid rgba(255,255,255,0.15); color:white; resize:vertical;"></textarea>
                </div>
                
                <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button class="btn btn-outline" onclick="cerrarModalEditarEjecucion()" style="padding:0.5rem 1rem;">Cancelar</button>
                    <button class="btn btn-primary" onclick="guardarEditarEjecucion()" style="background:linear-gradient(135deg, #10B981, #059669); border:none; padding:0.5rem 1.2rem; font-weight:bold;">Guardar</button>
                </div>
            </div>
        </div>
    `;
});
