{
  pkgs ? import <nixpkgs> {},
}: let
  # Entorno para el Frontend (Node.js con Astro)
  node-env = pkgs.mkShell {
    name = "frontend-env";
    buildInputs = with pkgs; [
      nodejs_20 # Versión de Node.js recomendada para Astro
      nodePackages.npm
      # Otras dependencias de Node que puedas necesitar
    ];
    shellHook = ''
      echo "Entorno de Frontend (Node.js) activado."
      echo "Usa 'npm install' y 'npm run dev' para iniciar el frontend."
    '';
  };

  # Entorno para el Backend (Python con Flask)
  python-env = pkgs.mkShell {
    name = "backend-env";
    buildInputs = with pkgs; [
      python311 # Usando Python 3.11
      python311Packages.pip
      python311Packages.flask
      python311Packages.flask-cors
      # Añadir aquí paquetes de Python para Supabase y MongoDB en el futuro
    ];
    shellHook = ''
      echo "Entorno de Backend (Python) activado."
      echo "Usa 'pip install -r requirements.txt' y 'flask run' para iniciar el backend."
    '';
  };

in pkgs.mkShell {
  buildInputs = [ node-env python-env ];
  shellHook = ''
    echo "---------------------------------------------------------------------"
    echo "  Entorno de Desarrollo de Portafolio Activado (Frontend + Backend)  "
    echo "---------------------------------------------------------------------"
    echo "Para trabajar en el frontend, navega a la carpeta 'frontend'."
    echo "Para trabajar en el backend, navega a la carpeta 'backend'."
  '';
}