// Smooth scrolling for navigation links
// Select all anchor links that start with '#'
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    // Add a click event listener to each selected anchor
    anchor.addEventListener('click', function (e) {
        // Prevent the default jump-to-anchor behavior
        e.preventDefault();

        // Get the target element based on the href attribute
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            // Use smooth scrolling behavior
            behavior: 'smooth'
        });
    });
});

// Dark mode toggle
// Get the dark mode toggle switch element
const darkModeToggle = document.getElementById('darkModeToggle'); // Corrected ID

// Add a change event listener to the toggle switch
darkModeToggle.addEventListener('change', () => {
    // Toggle the 'dark-mode' class on the body element
    document.body.classList.toggle('dark-mode');
});

// Form validation and submission (basic example)
// Get the contact form element
const contactForm = document.getElementById('contact-form');

// Add a submit event listener to the form
contactForm.addEventListener('submit', function(e) {
    // Prevent the default form submission
    e.preventDefault();

    // Get the input values and trim whitespace
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();

    // Basic validation: check if any field is empty
    if (name === '' || email === '' || message === '') {
        alert('Please fill in all fields.');
        return;
    }

    // Basic email format validation
    // Call the validateEmail function to check email format
    if (!validateEmail(email)) {
        alert('Please enter a valid email address.');
        return;
    }

    // In a real application, you would send the form data to a server
    // using Fetch API or XMLHttpRequest.
    /*
    fetch('/send-email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, message }),
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        alert('Your message has been sent!');
        contactForm.reset();
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('There was an error sending your message. Please try again later.');
    });
    */

    // For this example, we'll just log the data and show a success message
    // Log the form data to the console
    console.log('Form submitted:', { name, email, message });
    // Show a success alert message
    alert('Your message has been sent!');
    // Reset the form fields
    contactForm.reset();
});

// Function to validate email format using a regular expression
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Load about section content
document.addEventListener('DOMContentLoaded', () => {
    fetch('/public/components/about.html')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            document.getElementById('about-section').innerHTML = html;
        })
        .catch(error => {
            console.error('Error loading about section:', error);
        });
});
