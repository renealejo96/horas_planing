

async function test() {
    try {
        const areaId = 4; // Desbrote
        const cultivoId = 5; // Solidago
        
        const areas = await fetch('http://localhost:8080/api/admin/areas').then(r => r.json());
        const actividades = await fetch('http://localhost:8080/api/admin/actividades').then(r => r.json());
        const rendimientosGlobales = await fetch('http://localhost:8080/api/admin/rendimientos').then(r => r.json());
        
        console.log(`Loaded ${areas.length} areas, ${actividades.length} activities, ${rendimientosGlobales.length} yields.`);
        
        const activityBelongsToArea = (a, areaId) => {
            const area = areas.find(ar => ar.id == areaId);
            if (!area) return false;
            
            // Direct match
            if (a.area && a.area.id == areaId) return true;
            
            // Fallback: match activity.laborMadre with area.codigo/nombre
            if (a.laborMadre && area.codigo) {
                const cleanAreaCode = area.codigo.replace('PY_', '').toUpperCase();
                if (a.laborMadre.toUpperCase() === cleanAreaCode) return true;
            }
            if (a.laborMadre && area.nombre) {
                if (a.laborMadre.toUpperCase() === area.nombre.toUpperCase()) return true;
            }
            
            // Fallback 2: check if there's any Rendimiento mapping for this activity that has the grupo matching this area
            const matchingRends = rendimientosGlobales.filter(r => r.actividad?.id === a.id);
            for (const r of matchingRends) {
                if (r.grupo && area.codigo) {
                    const cleanAreaCode = area.codigo.replace('PY_', '').toUpperCase();
                    if (r.grupo.toUpperCase() === cleanAreaCode) return true;
                }
                if (r.grupo && area.nombre) {
                    if (r.grupo.toUpperCase() === area.nombre.toUpperCase()) return true;
                }
            }
            
            return false;
        };
        
        const actividadesArea = actividades.filter(a => {
            const belongsToArea = activityBelongsToArea(a, areaId);
            if (!belongsToArea) return false;
            
            const hasDirectCrop = a.producto && a.producto.id == cultivoId;
            const isGeneral = !a.producto;
            const hasYieldForCrop = rendimientosGlobales.some(r => r.actividad?.id == a.id && r.producto?.id == cultivoId);
            
            return hasDirectCrop || isGeneral || hasYieldForCrop;
        });
        
        console.log(`\nFiltered activities count for Area ${areaId} & Crop ${cultivoId}: ${actividadesArea.length}`);
        actividadesArea.forEach(a => {
            console.log(`- ID: ${a.id}, Name: ${a.nombre}, laborMadre: ${a.laborMadre}, area: ${a.area ? a.area.nombre : 'null'}, producto: ${a.producto ? a.producto.nombre : 'null'}`);
        });
        
    } catch (e) {
        console.error(e);
    }
}

test();
