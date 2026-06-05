package com.finca.horas.repositories;

import com.finca.horas.entities.Rendimiento;
import com.finca.horas.entities.Producto;
import com.finca.horas.entities.Actividad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface RendimientoRepository extends JpaRepository<Rendimiento, Long> {
    Optional<Rendimiento> findByProductoAndActividad(Producto producto, Actividad actividad);
    List<Rendimiento> findByProducto(Producto producto);
    List<Rendimiento> findByActividad(Actividad actividad);
    List<Rendimiento> findByActivoTrue();
    
    // ========== QUERIES POR GRUPO (Actividad Madre) ==========
    
    // Obtener grupos únicos (DESBROTE, SIEMBRA, COSECHA, etc.) - solo los que tienen rendimiento
    @Query("SELECT DISTINCT r.grupo FROM Rendimiento r WHERE r.grupo IS NOT NULL AND r.rendimiento IS NOT NULL AND r.rendimiento > 0 AND r.activo = true ORDER BY r.grupo")
    List<String> findDistinctGrupos();
    
    // Obtener todos los rendimientos de un grupo con sus relaciones
    @Query("SELECT r FROM Rendimiento r JOIN FETCH r.producto p JOIN FETCH r.actividad a WHERE r.grupo = :grupo AND r.rendimiento IS NOT NULL AND r.rendimiento > 0 AND r.activo = true ORDER BY p.nombre, a.nombre")
    List<Rendimiento> findByGrupoConRendimiento(@Param("grupo") String grupo);
    
    // Obtener rendimiento específico por grupo + producto + labor
    @Query("SELECT r FROM Rendimiento r JOIN FETCH r.producto p JOIN FETCH r.actividad a WHERE r.grupo = :grupo AND p.codigo = :productoCodigo AND a.nombre = :laborNombre AND r.activo = true")
    Optional<Rendimiento> findByGrupoProductoLabor(@Param("grupo") String grupo, @Param("productoCodigo") String productoCodigo, @Param("laborNombre") String laborNombre);
    
    // Buscar por grupo y producto (para encontrar actividad de ese cultivo)
    @Query("SELECT r FROM Rendimiento r JOIN FETCH r.producto p JOIN FETCH r.actividad a WHERE r.grupo = :grupo AND p.codigo = :productoCodigo AND r.rendimiento IS NOT NULL AND r.activo = true")
    List<Rendimiento> findByGrupoAndProducto(@Param("grupo") String grupo, @Param("productoCodigo") String productoCodigo);

    // ========== QUERIES LEGACY ==========
    
    @Query("SELECT DISTINCT a.nombre FROM Rendimiento r JOIN r.actividad a WHERE r.activo = true ORDER BY a.nombre")
    List<String> findDistinctLabores();
    
    @Query("SELECT DISTINCT r.producto FROM Rendimiento r JOIN r.actividad a WHERE LOWER(a.nombre) LIKE LOWER(CONCAT(:laborNombre, '%')) AND r.activo = true")
    List<Producto> findProductosByLaborNombre(@Param("laborNombre") String laborNombre);
    
    @Query("SELECT r FROM Rendimiento r JOIN FETCH r.actividad a JOIN FETCH r.producto p WHERE LOWER(a.nombre) LIKE LOWER(CONCAT(:laborNombre, '%')) AND p.codigo = :productoCodigo AND r.activo = true")
    List<Rendimiento> findByLaborAndProducto(@Param("laborNombre") String laborNombre, @Param("productoCodigo") String productoCodigo);
    
    @Query("SELECT r FROM Rendimiento r JOIN FETCH r.actividad a JOIN FETCH r.producto p WHERE LOWER(a.nombre) LIKE '%cosecha%' AND p.codigo = :productoCodigo AND r.activo = true")
    Optional<Rendimiento> findRendimientoCosecha(@Param("productoCodigo") String productoCodigo);
}
