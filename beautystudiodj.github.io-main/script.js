/* script.js - Lógica para D&J Beauty Studio */

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Marcar enlace activo en el menú
    const currentPath = window.location.pathname.split("/").pop();
    const navLinks = document.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath || (currentPath === '' && link.getAttribute('href') === 'index.html')) {
            link.classList.add('active');
        }
    });

    // 2. Efecto Fade-In al cargar
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.6s ease';
    setTimeout(() => document.body.style.opacity = '1', 100);

    // 3. Funcionalidad de Botones "Comprar" / "Reservar"
    const botonesCompra = document.querySelectorAll('.btn-buy');
    
    botonesCompra.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const producto = btn.closest('.card').querySelector('h3').innerText;
            alert(`¡Excelente elección! Has añadido "${producto}" a tu carrito de belleza 🍒.`);
        });
    });

    // 4. Funcionalidad Botón Contacto / Staff
    const botonesContacto = document.querySelectorAll('.btn-contact');
    botonesContacto.forEach(btn => {
        btn.addEventListener('click', () => {
            alert("Redirigiendo a WhatsApp para agendar cita... (Simulación)");
        });
    });
    
    // 5. Saludo en consola
    console.log("%c D&J Beauty Studio ", "background: #810319; color: #fff; padding: 5px; border-radius: 3px;");
});
