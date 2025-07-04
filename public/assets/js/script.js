// Smooth Scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();

        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth',
        });
    });
});

// Responsive Navigation Toggle
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');

if (navToggle && navMenu) {
    navToggle.addEventListener('click', function() {
        navMenu.classList.toggle('nav-menu-visible');
        const expanded = this.getAttribute('aria-expanded') === 'true' || false;
        this.setAttribute('aria-expanded', !expanded);
    });

    navMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function() {
            navMenu.classList.remove('nav-menu-visible');
            navToggle.setAttribute('aria-expanded', 'false'); // Ensure toggle state is updated
        });
    });
} else {
    console.error('Error: Navigation toggle or menu element not found.');
}

// Dark Mode Toggle
const darkModeToggle = document.querySelector('.dark-mode-toggle');
const body = document.body;

if (darkModeToggle && body) {
    darkModeToggle.addEventListener('click', function() {
        body.classList.toggle('dark-mode');
        // Store the theme preference in local storage
        if (body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });

    // Check for saved theme preference on page load
    const savedTheme = localStorage.getItem('theme'); // Corrected variable name
    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
    }
} else {
    console.error('Error: Dark mode toggle or body element not found.');
}

// Contact Form Submission
const contactForm = document.getElementById('contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // Basic client-side validation (you can add more comprehensive validation)
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const message = document.getElementById('message').value.trim();

        if (name === '' || email === '' || message === '') {
            alert('Please fill in all fields.');
            return;
        }
        // Basic email validation
        if (!/\S+@\S+\.\S+/.test(email)) {
            alert('Please enter a valid email address.');
            return;
        }

        fetch('/send-email', { // Replace with your actual server-side endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: name, email: email, message: message }),
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Success:', data);
                alert('Message sent successfully!'); // Provide user feedback
                contactForm.reset(); // Clear the form
            })
            .catch((error) => {
                console.error('Error:', error);
                alert('There was an error sending your message. Please try again later.'); // Provide user feedback
            });
    });
} else {
    console.error('Error: Contact form element not found.');
}

