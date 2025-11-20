document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. Mobile Menu Toggle Logic ---
    const btn = document.getElementById("mobile-menu-btn");
    const menu = document.getElementById("mobile-menu");

    if (btn && menu) {
        btn.addEventListener("click", () => {
            menu.classList.toggle("hidden");
        });
    }

    // --- 2. Highlight Current Page ---
    // We select 'nav a' and '#mobile-menu a' to ensure both menus get highlighted
    const navLinks = document.querySelectorAll("nav a, #mobile-menu a");
    const currentUrl = window.location.href;

    navLinks.forEach(link => {
        // Check if the link matches the current URL
        if (link.href === currentUrl) {
            link.classList.add("active");
        }
    });
  
    // --- 3. Update Footer Year ---
    document.querySelectorAll("#year").forEach(el => {
        el.textContent = new Date().getFullYear();
    });
});