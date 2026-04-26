/* script.js - Lógica para D&J Beauty Studio */

// Categorías preestablecidas disponibles en el panel
const DJ_CATEGORIES = [
    'Labios', 'Piel Glow', 'Ojos', 'Brochas Pro', 'Cuidado corporal', 'Cuidado facial', 'Cuidado capilar', 'Cejas', 'Rostro', 'Higiene', 'Edición limitada', 'Accesorios', 'Pestañas', 'Maquillaje', 'Fragancias', 'Mascarillas', 'Serums', 'Tratamientos', 'Sombra de ojos', 'Delineadores', 'Iluminadores', 'Contorno', 'Base de maquillaje', 'Polvos compactos', 'Blush', 'Labiales líquidos', 'Labiales en barra', 'Brillos labiales', 'Cremas corporales', 'Exfoliantes faciales', 'Tónicos faciales', 'Shampoos', 'Acondicionadores',
    
];

// API base helpers: allow using a remote API by setting a meta tag
function getApiBase(){
    try{
        const meta = document.querySelector('meta[name="api-base"]');
        const globalBase = window.__API_BASE__ || window.__apiBase__ || '';
        const base = (meta && meta.content) ? meta.content.trim() : (globalBase || '').toString();
        return base.replace(/\/$/, '');
    }catch(e){ return ''; }
}

async function apiFetch(endpoint, opts){
    const base = getApiBase();
    const url = (base ? (base.replace(/\/$/, '') + '/api') : '/api') + endpoint;
    return fetch(url, opts);
}

document.addEventListener('DOMContentLoaded', () => {
    let currentCategoryFilter = '';
    // 1. Marcar enlace activo en el menú
    const currentPath = window.location.pathname.split("/").pop();
    const navLinks = document.querySelectorAll('nav a'); 

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });

    // 2. Efecto Fade-In al cargar
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.6s ease';
    setTimeout(() => document.body.style.opacity = '1', 100);

    // --- Gestión de productos (localStorage) ---

    function populateCategorySelects() {
        const selects = document.querySelectorAll('select[name="eyebrow"]');
        selects.forEach(select => {
            select.innerHTML = '';
            const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Seleccionar...'; select.appendChild(placeholder);
            DJ_CATEGORIES.forEach(cat => {
                const opt = document.createElement('option'); opt.value = cat; opt.textContent = cat; select.appendChild(opt);
            });
            const other = document.createElement('option'); other.value = '__other'; other.textContent = 'Otro (especificar)'; select.appendChild(other);

            select.addEventListener('change', () => {
                const wrapper = document.getElementById('eyebrow-other-label');
                if (!wrapper) return;
                wrapper.style.display = (select.value === '__other') ? 'block' : 'none';
            });
        });
    }

    function injectCategoryStyles(){
        if (document.getElementById('dj-cat-styles')) return;
        const s = document.createElement('style');
        s.id = 'dj-cat-styles';
        s.innerHTML = `.category-filters{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.category-filters .chip{cursor:pointer;border:1px solid #ddd;padding:6px 10px;border-radius:999px;background:#fff}.category-filters .chip.active{background:#810319;color:#fff;border-color:#810319}`;
        document.head.appendChild(s);
    }

    function createCategoryFilterUI(){
        const grid = document.querySelector('.grid-container');
        if (!grid) return;
        injectCategoryStyles();
        const wrapper = document.createElement('div');
        wrapper.className = 'category-filters';

        const allBtn = document.createElement('button'); allBtn.type = 'button'; allBtn.className = 'chip active'; allBtn.dataset.cat = ''; allBtn.textContent = 'Todos'; wrapper.appendChild(allBtn);
        DJ_CATEGORIES.forEach(cat => {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.cat = cat; b.textContent = cat; wrapper.appendChild(b);
        });

        const products = loadProducts() || [];
        const others = [...new Set(products.map(p => (p.eyebrow||'').trim()).filter(c => c && !DJ_CATEGORIES.some(dc => dc.toLowerCase()===c.toLowerCase())) )];
        if (others.length) {
            const b = document.createElement('button'); b.type='button'; b.className='chip'; b.dataset.cat='__others'; b.textContent='Otros'; wrapper.appendChild(b);
        }

        grid.parentNode.insertBefore(wrapper, grid);

        wrapper.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-cat]');
            if (!btn) return;
            setCategoryFilter(btn.dataset.cat);
        });
    }

    function setCategoryFilter(cat){
        currentCategoryFilter = cat || '';
        const wrapper = document.querySelector('.category-filters');
        if (!wrapper) return;
        wrapper.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b.dataset.cat === (cat||'')));
        renderProducts();
    }

    function loadProducts() {
        try {
            const raw = localStorage.getItem('dj_products');
            return raw ? JSON.parse(raw) : null;
        } catch (err) { return null; }
    }

    function saveProducts(arr) {
        try { localStorage.setItem('dj_products', JSON.stringify(arr || [])); } catch (e) {}
    }

    function ensureProductData() {
        let prods = loadProducts();
        if (!prods) {
            const grid = document.querySelector('.grid-container');
            if (grid) {
                const cards = Array.from(grid.querySelectorAll('.card'));
                prods = cards.map((card, idx) => {
                    const imgEl = card.querySelector('img');
                    const eyebrow = card.querySelector('.eyebrow')?.innerText?.trim() || '';
                    const title = card.querySelector('h3')?.innerText?.trim() || '';
                    const priceEl = card.querySelector('.price')?.innerText || '';
                    const priceMatch = (priceEl.match(/(\d[\d.]*)/) || [])[1] || card.dataset.price || '0';
                    const price = parseInt(priceMatch.toString().replace(/\D/g, ''), 10) || 0;
                    const stockText = card.querySelector('.stock')?.innerText || '';
                    const stockMatch = stockText.match(/(\d+)/);
                    const stock = stockMatch ? parseInt(stockMatch[1], 10) : 0;
                    const image = imgEl ? imgEl.src : '';
                    return { id: 'p' + Date.now() + idx, eyebrow, title, price, stock, image, description: '' };
                });
            } else {
                prods = [];
            }
            saveProducts(prods);
        }
        return prods;
    }

    function formatCOP(num) {
        return 'COP $' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function escapeHtml(text) {
        return (text || '').replace(/[&"'<>]/g, function (a) { return {'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'}[a]; });
    }

    function renderProducts() {
        const grid = document.querySelector('.grid-container');
        if (!grid) return;
        const products = loadProducts() || [];
        let items = products;
        if (currentCategoryFilter && currentCategoryFilter !== ''){
            if (currentCategoryFilter === '__others'){
                items = products.filter(p => {
                    const c = (p.eyebrow||'').trim().toLowerCase();
                    return c && !DJ_CATEGORIES.some(dc => dc.toLowerCase() === c);
                });
            } else {
                items = products.filter(p => (p.eyebrow||'').trim().toLowerCase() === currentCategoryFilter.toLowerCase());
            }
        }
        grid.innerHTML = '';
        items.forEach(prod => {
            const div = document.createElement('div');
            div.className = 'card';
            div.dataset.price = prod.price || '0';
            div.innerHTML = `
                <img src="${escapeHtml(prod.image || 'https://placehold.co/500x360/ddd/000?text=Sin+imagen')}" class="card-img-top" alt="${escapeHtml(prod.title)}">
                <div class="card-body">
                    <span class="eyebrow">${escapeHtml(prod.eyebrow || '')}</span>
                    <h3>${escapeHtml(prod.title)}</h3>
                    <p class="price">${formatCOP(prod.price || 0)}</p>
                    <p class="stock">Disponibles: ${prod.stock || 0} unidades</p>
                    <button class="btn btn-buy">Añadir al Carrito</button>
                </div>`;
            grid.appendChild(div);
        });
        // attach buy handlers for newly rendered items
        const botonesCompra = grid.querySelectorAll('.btn-buy');
        botonesCompra.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const card = btn.closest('.card');
                const producto = card.querySelector('h3').innerText;
                const price = parseInt(card.dataset.price || '0', 10);
                addItemToCart({ name: producto, price });
            });
        });
    }

    // Inicializar productos y UI de filtros
    populateCategorySelects();
    ensureProductData();
    createCategoryFilterUI();
    renderProducts();

    // Try to load products from API (if server is running) and refresh UI
    (async function tryLoadFromApi(){
        try{
            const res = await apiFetch('/products');
            if (res && res.ok){
                const prods = await res.json();
                if (Array.isArray(prods)){
                    saveProducts(prods);
                    createCategoryFilterUI();
                    renderProducts();
                }
            }
        }catch(e){ /* ignore if API not available */ }
    })();

    // 3. Funcionalidad de Botones "Añadir al Carrito" -> carrito funcional
    const cartButton = document.getElementById('cart-button');
    const cartPanel = document.getElementById('cart-panel');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartCountEl = document.getElementById('cart-count');
    const cartTotalEl = document.getElementById('cart-total');
    const cartClose = document.getElementById('cart-close');
    const checkoutBtn = document.getElementById('checkout');

    let cart = loadCart();
    updateCartDisplay();
    // Los handlers de 'Añadir al Carrito' se adjuntan dentro de renderProducts()

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
        const plainMsg = `Hola quiero comprar:\n${lines.join('\n')}\nTotal: ${total}`;
        const wa = `https://wa.me/573227098891?text=${encodeURIComponent(plainMsg)}`;
        window.open(wa, '_blank');
    });

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
    
    // 5. Abrir redes sociales en ventana pequeña (popup)
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
