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

    // 3. Funcionalidad de Botones "Añadir al Carrito" -> carrito funcional
    const botonesCompra = document.querySelectorAll('.btn-buy');

    const cartButton = document.getElementById('cart-button');
    const cartPanel = document.getElementById('cart-panel');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartCountEl = document.getElementById('cart-count');
    const cartTotalEl = document.getElementById('cart-total');
    const cartClose = document.getElementById('cart-close');
    const checkoutBtn = document.getElementById('checkout');

    let cart = loadCart();
    updateCartDisplay();

    botonesCompra.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const card = btn.closest('.card');
            const producto = card.querySelector('h3').innerText;
            const price = parseInt(card.dataset.price || '0', 10);
            addItemToCart({ name: producto, price });
        });
    });

    function loadCart() {
        try {
            return JSON.parse(localStorage.getItem('dj_cart') || '[]');
        } catch (err) {
            return [];
        }
    }

    function saveCart() {
        localStorage.setItem('dj_cart', JSON.stringify(cart));
    }

    function addItemToCart(item) {
        cart.push(item);
        saveCart();
        updateCartDisplay();
        showCartTemporarily();
    }

    function removeItemFromCart(index) {
        cart.splice(index, 1);
        saveCart();
        updateCartDisplay();
    }

    function cartTotal() {
        return cart.reduce((s, it) => s + (it.price || 0), 0);
    }

    function formatCOP(num) {
        return 'COP $' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function updateCartDisplay() {
        cartCountEl.innerText = cart.length;
        cartItemsContainer.innerHTML = '';
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p style="color:#666">Tu carrito está vacío.</p>';
        } else {
            cart.forEach((it, idx) => {
                const div = document.createElement('div');
                div.className = 'cart-item';
                div.innerHTML = `<div><strong>${escapeHtml(it.name)}</strong><div style="font-size:0.9rem;color:#666">${formatCOP(it.price)}</div></div><div><button data-idx="${idx}" class="btn-remove">Eliminar</button></div>`;
                cartItemsContainer.appendChild(div);
            });
        }
        cartTotalEl.innerText = formatCOP(cartTotal());

        // attach remove handlers
        const removes = document.querySelectorAll('.btn-remove');
        removes.forEach(btn => btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.idx, 10);
            removeItemFromCart(idx);
        }));
    }

    function showCartTemporarily() {
        cartPanel.classList.add('show');
        cartPanel.setAttribute('aria-hidden', 'false');
        setTimeout(() => {
            // leave open for manual close; do not auto-hide
        }, 1200);
    }

    cartButton && cartButton.addEventListener('click', (e) => {
        e.preventDefault();
        const shown = cartPanel.classList.toggle('show');
        cartPanel.setAttribute('aria-hidden', shown ? 'false' : 'true');
    });

    cartClose && cartClose.addEventListener('click', () => {
        cartPanel.classList.remove('show');
        cartPanel.setAttribute('aria-hidden', 'true');
    });

    // Checkout: abrir WhatsApp con lista de productos y total
    checkoutBtn && checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            alert('Tu carrito está vacío.');
            return;
        }
        const lines = cart.map(it => `- ${it.name} (${formatCOP(it.price)})`);
        const total = formatCOP(cartTotal());
        const msg = `Hola%20quiero%20comprar:%0A${encodeURIComponent(lines.join('%0A'))}%0ATotal:%20${encodeURIComponent(total)}`;
        const wa = `https://wa.me/573227098891?text=${msg}`;
        window.open(wa, '_blank');
    });

    function escapeHtml(text) {
        return text.replace(/[&"'<>]/g, function (a) { return {'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'}[a]; });
    }

    // 4. Funcionalidad Botón Contacto / Staff
    const botonesContacto = document.querySelectorAll('.btn-contact');
    botonesContacto.forEach(btn => {
        const number = btn.dataset.number;
        if (number) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const msg = encodeURIComponent('Hola, quiero agendar una cita.');
                const wa = `https://wa.me/${number}?text=${msg}`;
                window.open(wa, '_blank');
            });
            return;
        }
        if (btn.tagName.toLowerCase() === 'a' && btn.getAttribute('href')) return;
        btn.addEventListener('click', () => {
            alert("Redirigiendo a WhatsApp para agendar cita... (Simulación)");
        });
    });
    
    // 5. Saludo en consola
    // 6. Abrir redes sociales en ventana pequeña (popup)
    const socialLinks = document.querySelectorAll('.floating-social .social-link');
    socialLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.href;
            const w = 820;
            const h = 640;
            const left = Math.floor((window.screen.width - w) / 2);
            const top = Math.floor((window.screen.height - h) / 2);
            const features = `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${w},height=${h},top=${top},left=${left}`;
            window.open(href, '_blank', features);
        });
    });

    console.log("%c D&J Beauty Studio ", "background: #810319; color: #fff; padding: 5px; border-radius: 3px;");
});
