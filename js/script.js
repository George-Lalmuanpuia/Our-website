// Highlight current page in nav
document.addEventListener("DOMContentLoaded", () => 
    {
    const navLinks = document.querySelectorAll("nav a");
    navLinks.forEach(link => 
        {
            if (link.href === window.location.href) 
            {
                link.classList.add("active");
            }
        });
  
    // Update footer year
    document.querySelectorAll("#year").forEach(el => 
        {
            el.textContent = new Date().getFullYear();
        });
    });