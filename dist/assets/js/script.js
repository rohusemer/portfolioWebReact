// Script para ocultar/mostrar la barra de navegación al hacer scroll
let lastScrollTop = 0;
const navbar = document.querySelector('.navbar');

// Make sure the navbar element exists before adding the scroll listener
if (navbar) {
    const navbarHeight = navbar.offsetHeight; // Get the height of the navbar

    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        if (scrollTop > lastScrollTop && scrollTop > navbarHeight) {
            navbar.classList.add('navbar-hidden'); // Scrolling down and scrolled past the navbar height
        } else {
            navbar.classList.remove('navbar-hidden'); // Scrolling up or at the top
        }
        lastScrollTop = scrollTop;
    });
}
// Script para desplazamiento suave
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Script para modo oscuro
// Estas variables y listeners se inicializarán después de cargar la navbar
let darkModeToggle;

// Script para animar secciones al hacer scroll
document.addEventListener('DOMContentLoaded', () => {
    const sectionsToAnimate = document.querySelectorAll('section');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate__animated', 'animate__fadeInUp');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.2
    });

    sectionsToAnimate.forEach(section => {
        observer.observe(section);
    });

    // --- Script para cargar y mostrar dibujos guardados y eliminar ---
    const drawingsGallery = document.getElementById('drawings-gallery');

    function renderDrawings() {
        if (!drawingsGallery) return; // Asegurarse de que la galería existe en la página actual

        drawingsGallery.innerHTML = ''; // Limpiar la galería antes de renderizar

        const savedDrawings = JSON.parse(localStorage.getItem('drawings')) || [];

        if (savedDrawings.length > 0) {
            savedDrawings.forEach(dataURL => {
                const drawingContainer = document.createElement('div');
                drawingContainer.classList.add('col-md-4', 'mb-4', 'position-relative');

                const img = document.createElement('img');
                img.src = dataURL; // Asignar directamente la Data URL a src
                img.alt = 'Dibujo Guardado';
                img.classList.add('img-fluid'); // Mantener solo img-fluid, quitamos lazy-img por ahora

                const deleteButton = document.createElement('button');
                deleteButton.classList.add('btn', 'btn-danger', 'btn-sm', 'position-absolute', 'top-0', 'end-0', 'm-2');
                deleteButton.innerHTML = '<i class="fas fa-times"></i>';

                drawingContainer.appendChild(img);
                drawingContainer.appendChild(deleteButton);
                drawingsGallery.appendChild(drawingContainer);
            });

            // Una vez que las imágenes de los dibujos se han añadido al DOM, observarlas para lazy loading
            // const lazyImagesInGallery = drawingsGallery.querySelectorAll('img.lazy-img');
            // lazyImagesInGallery.forEach(img => lazyImageObserver.observe(img));


        } else {
            drawingsGallery.innerHTML = '<p class="text-center">Aún no tienes dibujos guardados. ¡Ve a la Pizarra Interactiva y crea uno!</p>';
        }
    }

    function deleteDrawing(dataURLToDelete) {
        let savedDrawings = JSON.parse(localStorage.getItem('drawings')) || [];
        savedDrawings = savedDrawings.filter(dataURL => dataURL !== dataURLToDelete);
        localStorage.setItem('drawings', JSON.stringify(savedDrawings));
        renderDrawings();
    }

    // ... resto del script ...

    document.addEventListener('DOMContentLoaded', () => {
       // ... otros listeners ...

        // Cargar y mostrar los dibujos al cargar la página (solo en index.html)
        // Esta función solo se ejecutará si el elemento 'drawings-gallery' existe en la página
        renderDrawings();

    });

    // --- Script para Lazy Loading de Imágenes ---
     const lazyImages = document.querySelectorAll('img.lazy-img'); // Seleccionar todas las imágenes con la clase lazy-img que ya están en el HTML inicial

    const lazyImageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.getAttribute('data-src');

                if (src) {
                    img.src = src;
                    img.removeAttribute('data-src');
                }

                observer.unobserve(img);
            }
        });
    });

    lazyImages.forEach(img => {
        lazyImageObserver.observe(img);
    });
    // --- Fin Script para Lazy Loading de Imágenes ---


    // --- Script para cargar componente de navegación ---
    async function loadNavbar() {
        try {
            const response = await fetch('/components/header.html');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const navbarHTML = await response.text();
            const navbarContainer = document.getElementById('navbar-container');
            if (navbarContainer) {
                navbarContainer.innerHTML = navbarHTML;
                 // Volver a inicializar la lógica de modo oscuro para el botón en la barra de navegación cargada dinámicamente
                 darkModeToggle = document.getElementById('darkModeToggle'); // Asignar el botón obtenido después de la carga
                 if(darkModeToggle){
                      darkModeToggle.addEventListener('click', () => {
                        document.body.classList.toggle('dark-mode');
                        if (document.body.classList.contains('dark-mode')) {
                            localStorage.setItem('theme', 'dark');
                            darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
                        } else {
                            localStorage.setItem('theme', 'light');
                            darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
                        }
                    });
                     // Asegurar que el icono del modo oscuro sea correcto al cargar la página
                    if (localStorage.getItem('theme') === 'dark') {
                        document.body.classList.add('dark-mode');
                        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
                    } else {
                         document.body.classList.remove('dark-mode'); // Asegurarse de que no tenga la clase si no está en modo oscuro
                         darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
                    }
                 }
            }
        } catch (error) {
            console.error('Error loading navbar component:', error);
        }
    }

    loadNavbar(); // Cargar la barra de navegación al cargar el DOM
    // --- Fin Script para cargar componente de navegación ---


    // Cargar y mostrar los dibujos al cargar la página (solo en index.html)
    // Esta función solo se ejecutará si el elemento 'drawings-gallery' existe en la página
    renderDrawings();


}); // Cierre del DOMContentLoaded listener
