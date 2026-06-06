package com.finca.horas.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Autowired
    private AuthInterceptor authInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Ruta absoluta a la carpeta frontend/ relativa al proyecto
        // Busca primero al lado del backend, luego una carpeta arriba
        String frontendPath = resolveFrontendPath();

        if (frontendPath != null) {
            registry.addResourceHandler("/**")
                    .addResourceLocations("file:" + frontendPath)
                    .setCachePeriod(0); // Sin caché para desarrollo
        }
    }

    private String resolveFrontendPath() {
        // Opciones de rutas donde puede estar el frontend
        String[] posiblesPaths = {
            System.getProperty("user.dir") + "/../frontend/",
            System.getProperty("user.dir") + "/frontend/",
            "d:/todo en vs code/horas_app/frontend/"
        };

        for (String path : posiblesPaths) {
            File dir = new File(path);
            if (dir.exists() && dir.isDirectory() && new File(dir, "index.html").exists()) {
                String canonicalPath = dir.getAbsolutePath().replace("\\", "/") + "/";
                System.out.println("[WebConfig] Sirviendo frontend desde: " + canonicalPath);
                return canonicalPath;
            }
        }

        System.err.println("[WebConfig] ADVERTENCIA: No se encontró la carpeta frontend/");
        return null;
    }
}
