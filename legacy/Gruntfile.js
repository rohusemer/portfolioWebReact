module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
      pkg: grunt.file.readJSON('package.json'),
  
      watch: {
        css: {
          files: ['public/assets/css/**/*.css'], // Observa todos los archivos CSS en la carpeta public
          tasks: ['cssmin'], // Ejecuta la tarea cssmin cuando cambien los archivos CSS
          options: {
            spawn: false,
          },
        },
        js: {
          files: ['public/assets/js/**/*.js'], // Observa todos los archivos JS en la carpeta public
          tasks: ['uglify'], // Ejecuta la tarea uglify cuando cambien los archivos JS
          options: {
            spawn: false,
          },
        },
        // Puedes añadir más configuraciones de watch para otros tipos de archivos (HTML, etc.)
      },
  
      cssmin: {
        target: {
          files: [{
            expand: true,
            cwd: 'public/assets/css/', // Directorio de origen de los archivos CSS
            src: ['**/*.css', '!**/*.min.css'], // Selecciona todos los archivos .css excepto los que ya están minificados
            dest: 'dist/assets/css/', // Directorio de destino para los archivos CSS minificados
            ext: '.min.css' // Añade la extensión .min.css a los archivos minificados
          }]
        }
      },
  
      uglify: {
        target: {
          files: [{
            expand: true,
            cwd: 'public/assets/js/', // Directorio de origen de los archivos JS
            src: ['**/*.js', '!**/*.min.js'], // Selecciona todos los archivos .js excepto los que ya están minificados
            dest: 'dist/assets/js/', // Directorio de destino para los archivos JS minificados
            ext: '.min.js' // Añade la extensión .min.js a los archivos minificados
          }]
        }
      },
  
      // Puedes añadir otras tareas como copy, clean, etc.
      copy: {
        main: {
          files: [
            // Copiar archivos HTML a la carpeta dist
            {expand: true, cwd: 'public/', src: ['*.html'], dest: 'dist/'},
            // Copiar otros directorios si es necesario (img, components, pdf, etc.)
            {expand: true, cwd: 'public/img/', src: ['**'], dest: 'dist/img/'},
            {expand: true, cwd: 'public/components/', src: ['**'], dest: 'dist/components/'},
            {expand: true, cwd: 'public/assets/pdf/', src: ['**'], dest: 'dist/assets/pdf/'},
            // Asegúrate de copiar también los archivos CSS y JS si no los estás minificando/concatenando
             {expand: true, cwd: 'public/assets/css/', src: ['**/*.min.css'], dest: 'dist/assets/css/'}, // Copiar CSS minificados si existen
             {expand: true, cwd: 'public/assets/js/', src: ['**/*.min.js'], dest: 'dist/assets/js/'}, // Copiar JS minificados si existen
             {expand: true, cwd: 'public/assets/css/', src: ['**/*.css', '!**/*.min.css'], dest: 'dist/assets/css/'}, // Copiar CSS no minificados
             {expand: true, cwd: 'public/assets/js/', src: ['**/*.js', '!**/*.min.js'], dest: 'dist/assets/js/'}, // Copiar JS no minificados
  
             // Copiar cualquier otro archivo estático que necesites (ej: favicon.ico)
             {expand: true, cwd: 'public/', src: ['*.ico'], dest: 'dist/'},
          ]
        }
      },
  
       clean: {
          dist: ['dist'] // Limpia el directorio dist
       },
       
       shell: {
        liteServer: {
          command: 'lite-server --baseDir=dist'
        }
      }
  
    });
  
    // Load the plugins.
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-shell');
  
    // Default task(s).
    grunt.registerTask('default', ['clean', 'cssmin', 'uglify', 'copy', 'shell:liteServer']);
  };
  