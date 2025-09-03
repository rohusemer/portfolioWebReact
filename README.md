# Portafolio Personal - Ronny Segura

Este es el repositorio del código para mi portafolio personal, reconstruido con una arquitectura moderna que separa el frontend del backend.

## Arquitectura

El proyecto está dividido en dos componentes principales:

-   **/frontend**: Una aplicación web construida con **Astro**, utilizando **React** para componentes interactivos y **Tailwind CSS** para el estilizado. El código está escrito en **TypeScript**.
-   **/backend**: Una API RESTful desarrollada en **Python** usando el micro-framework **Flask**.

Esta arquitectura está diseñada para ser escalable, mantenible y de alto rendimiento.

## Stack Tecnológico

-   **Frontend**:
    -   Framework: Astro
    -   Librería UI: React
    -   Lenguaje: TypeScript
    -   Estilos: Tailwind CSS
-   **Backend**:
    -   Framework: Flask
    -   Lenguaje: Python
-   **Base de Datos (Planificada)**:
    -   PostgreSQL (a través de Supabase)
    -   MongoDB
-   **Plataforma de Desarrollo**: Nix

## Cómo Empezar

### Prerrequisitos

Asegúrate de tener instalado [Nix](https://nixos.org/download.html) en tu sistema.

### Instalación y Ejecución

1.  **Clona el repositorio:**
    ```bash
    git clone [URL_DEL_REPOSITORIO]
    cd [NOMBRE_DEL_DIRECTORIO]
    ```

2.  **Activa el entorno de Nix:**
    Al ingresar al directorio, si tienes `direnv` configurado, el entorno de Nix se cargará automáticamente. Si no, puedes iniciarlo manualmente con:
    ```bash
    nix-shell
    ```

3.  **Ejecutar el Backend:**
    ```bash
    cd backend
    pip install -r requirements.txt
    flask run
    ```
    El servidor de la API se iniciará en `http://127.0.0.1:5000`.

4.  **Ejecutar el Frontend:**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    El servidor de desarrollo de Astro se iniciará en `http://localhost:4321`.

