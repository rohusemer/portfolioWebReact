// Responsive Navigation Toggle
const navToggle = document.querySelector('.nav-toggle'); // Assuming you have an element with class 'nav-toggle' for the hamburger button
const navMenu = document.querySelector('.nav-menu'); // Assuming your navigation menu has the class 'nav-menu'
if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('nav-menu-visible'); // Toggle a class to make the menu visible/hidden
        // Optional: Toggle an ARIA attribute for accessibility
        const expanded = navToggle.getAttribute('aria-expanded') === 'true' || false;
        navToggle.setAttribute('aria-expanded', !expanded);
    });
    // Close the menu when a link is clicked (optional)
    navMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('nav-menu-visible');
            navToggle.setAttribute('aria-expanded', 'false');
        });
    });
} else {
    console.error('Navigation toggle or menu element not found.');
}

// Dark Mode Toggle
const darkModeToggle = document.querySelector('.dark-mode-toggle'); // Assuming you have an element with class 'dark-mode-toggle'
const body = document.body;

if (darkModeToggle && body) {
    darkModeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
    });
} else {
    console.error('Dark mode toggle or body element not found.');
}

