{ pkgs, ... }: {
  # Entorno de desarrollo basado en Node.js versión 20
  environment.systemPackages = [
    pkgs.nodejs_20
  ];

  # Procesos que se ejecutan al iniciar el entorno
  services.processes = [
    {
      # Instala las dependencias de npm la primera vez que se inicia el entorno
      name = "npm-install";
      command = "npm install";
      runOnce = true; # Asegura que solo se ejecute una vez
    }
  ];

  # Define el comando principal para iniciar el servidor de desarrollo
  processes.start-dev-server = {
    command = "npm run dev";
    # Hace que este proceso esté disponible como un comando en el IDE
    available = true; 
  };

  # Configuración de la vista previa de la aplicación
  previews = [
    {
      # Puerto que utiliza lite-server por defecto
      port = 3000;
      # Inicia el servidor de desarrollo automáticamente cuando se abre la vista previa
      start = "start-dev-server";
    }
  ];

  # Extensiones de VS Code recomendadas para este proyecto
  extensions = [
    "dbaeumer.vscode-eslint", # Para linting de JavaScript
    "esbenp.prettier-vscode", # Para formateo de código
    "ms-vscode.html-css"      # Soporte para HTML y CSS
  ];
}
