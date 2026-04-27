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

// Firestore helpers: inicializados en firebase-config.js
// window.waitForFirestore, window.writeProductToFirestore, etc. ya están disponibles

document.addEventListener('DOMContentLoaded', () => {
    let currentCategoryFilter = '';
    let currentSort = '';
    let currentSearch = '';
    // in-memory products loaded from repository db.json
    let DJ_PRODUCTS_DATA = null;
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
        s.innerHTML = `
            /* Lightweight category dropdown: subtle, compact appearance */
            .category-filters{display:flex;flex-direction:column;gap:8px;margin:8px 0;padding:8px;border-radius:10px;border:1px solid rgba(0,0,0,0.06);background:rgba(255,255,255,0.98);box-shadow:0 6px 18px rgba(20,20,20,0.03);font-size:0.95rem;color:var(--ink)}
            .category-filters .filter-controls{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
            .category-filters .groups{display:block;gap:6px;flex-wrap:nowrap;margin-top:6px}
            .category-group{width:100%;border-radius:6px;padding:6px;background:transparent;border-bottom:1px solid rgba(0,0,0,0.04)}
            .category-group .group-chips{display:block;padding:6px 0;margin:0}
            .category-filters .chip{cursor:pointer;border:none;padding:8px 10px;border-radius:8px;background:transparent;color:var(--wine-700);font-weight:600;font-size:0.95rem;transition:background 0.12s ease;display:block;text-align:left;width:100%}
            .category-filters .chip:hover{background:rgba(129,3,25,0.04)}
            .category-filters .chip.active{background:var(--wine-700);color:var(--white);box-shadow:0 8px 22px rgba(129,3,25,0.08)}
            .filter-controls select{padding:6px 8px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);background:transparent;font-size:0.92rem}
            @media(min-width:900px){.category-filters{flex-direction:row;align-items:flex-start}.category-group{border-bottom:none;padding-right:12px}.category-group .group-chips{display:block}}
            .category-filters.dropdown{position:absolute;display:none;width:300px;max-width:calc(100% - 32px);z-index:99999;padding:10px;border-radius:10px;background:rgba(255,255,255,0.98);border:1px solid rgba(0,0,0,0.06);box-shadow:0 10px 30px rgba(20,20,20,0.06);backdrop-filter:blur(2px);max-height:70vh;overflow:auto;opacity:0;transform:translateY(-6px);transition:opacity 140ms ease, transform 140ms ease}
            .category-group > .chip[data-group]{font-weight:700;color:var(--muted);background:transparent;padding:6px 8px;border-radius:6px;margin-bottom:6px}
        `;
        document.head.appendChild(s);
    }

    function categorizeCategory(cat){
        if (!cat) return 'Otros';
        const key = cat.toString().toLowerCase();
        const groupsKeywords = {
            'Cuidado': ['cuidado','piel','crema','mascarilla','serum','tonic','tónico','exfoli','tratamiento'],
            'Maquillaje': ['labio','labiales','sombra','delineador','polvo','base','blush','iluminador','contorno','maquillaje','ojo','pestaña','brocha','brillo'],
            'Cabello': ['shamp','acondicion','capilar'],
            'Fragancias': ['fragancia'],
            'Higiene': ['higiene'],
            'Accesorios': ['accesorio','brocha','pincel','pestañas']
        };
        for (const groupName in groupsKeywords){
            const kws = groupsKeywords[groupName];
            for (const kw of kws) if (key.includes(kw)) return groupName;
        }
        return 'Otros';
    }

    function createCategoryFilterUI(){
        if (document.querySelector('.category-filters')) return;
        const grid = document.querySelector('.grid-container');
        if (!grid) return;
        injectCategoryStyles();
        const wrapper = document.createElement('div');
        wrapper.className = 'category-filters';

        // Controls: Todos + Sort select
        const controls = document.createElement('div');
        controls.className = 'filter-controls';
        const allBtn = document.createElement('button'); allBtn.type = 'button'; allBtn.className = 'chip active'; allBtn.dataset.cat = ''; allBtn.textContent = 'Todos'; controls.appendChild(allBtn);
        const sortSelect = document.createElement('select'); sortSelect.id = 'filter-sort-select';
        const opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = 'Orden: defecto'; sortSelect.appendChild(opt0);
        const opt1 = document.createElement('option'); opt1.value = 'price-asc'; opt1.textContent = 'Precio: más bajo'; sortSelect.appendChild(opt1);
        const opt2 = document.createElement('option'); opt2.value = 'price-desc'; opt2.textContent = 'Precio: más alto'; sortSelect.appendChild(opt2);
        controls.appendChild(sortSelect);
        wrapper.appendChild(controls);

        // Groups container
        const groupsContainer = document.createElement('div');
        groupsContainer.className = 'groups';

        // Build groups from DJ_CATEGORIES using keyword heuristics
        const groups = {};
        DJ_CATEGORIES.forEach(cat => {
            const g = categorizeCategory(cat);
            if (!groups[g]) groups[g] = [];
            groups[g].push(cat);
        });

        // Include any extra categories found in products
        const products = loadProducts() || [];
        const extraCats = [...new Set(products.map(p => (p.eyebrow||'').trim()).filter(c => c && !DJ_CATEGORIES.some(dc => dc.toLowerCase()===c.toLowerCase())))];
        if (extraCats.length){ if (!groups['Otros']) groups['Otros'] = []; extraCats.forEach(ec => { if (!groups['Otros'].includes(ec)) groups['Otros'].push(ec); }); }

        Object.keys(groups).forEach(groupName => {
            const groupEl = document.createElement('div'); groupEl.className = 'category-group';
            const head = document.createElement('button'); head.type = 'button'; head.className = 'chip'; head.dataset.group = groupName; head.textContent = groupName; groupEl.appendChild(head);
            const inner = document.createElement('div'); inner.className = 'group-chips';
            groups[groupName].forEach(cat => {
                const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.cat = cat; b.textContent = cat; inner.appendChild(b);
            });
            groupEl.appendChild(inner);
            groupsContainer.appendChild(groupEl);
        });

        wrapper.appendChild(groupsContainer);
        // append to body so it can behave as a compact dropdown when needed
        document.body.appendChild(wrapper);
        wrapper.classList.add('dropdown');
        wrapper.style.display = 'none';

        // Events: toggle group, select category (hide dropdown after select)
        wrapper.addEventListener('click', (e) => {
            const groupBtn = e.target.closest('button[data-group]');
            if (groupBtn){
                const groupEl = groupBtn.closest('.category-group');
                const inner = groupEl.querySelector('.group-chips');
                inner.style.display = inner.style.display === 'block' ? 'none' : 'block';
                return;
            }
            const chipBtn = e.target.closest('button[data-cat]');
            if (chipBtn) {
                setCategoryFilter(chipBtn.dataset.cat);
                if (wrapper.classList.contains('dropdown')) wrapper.style.display = 'none';
                return;
            }
        });

        sortSelect.addEventListener('change', () => setSort(sortSelect.value));
    }

    function updateActiveFilterLabel(){
        const label = document.getElementById('active-filter-label');
        if (!label) return;
        const parts = [];
        if (currentCategoryFilter) parts.push('Categoría: ' + currentCategoryFilter);
        if (currentSearch) parts.push('Buscar: ' + (currentSearch.length > 24 ? currentSearch.slice(0,24) + '...' : currentSearch));
        if (currentSort === 'price-asc') parts.push('Orden: Precio ↑');
        else if (currentSort === 'price-desc') parts.push('Orden: Precio ↓');
        label.textContent = parts.join(' • ');
    }

    function setSort(sortKey){
        currentSort = sortKey || '';
        const sel = document.getElementById('filter-sort-select'); if (sel) sel.value = currentSort;
        updateActiveFilterLabel();
        renderProducts();
    }

    function setCategoryFilter(cat){
        currentCategoryFilter = cat || '';
        updateActiveFilterLabel();
        const wrapper = document.querySelector('.category-filters');
        if (!wrapper) return;
        wrapper.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b.dataset.cat === (cat||'')));
        renderProducts();
    }

    function loadProducts() {
        // Return products loaded from the repository `db.json` (synchronous accessor)
        return DJ_PRODUCTS_DATA || [];
    }

    function saveProducts(arr) {
        // Intentionally no-op for repo-backed reads to avoid storing per-browser copies.
        // Kept for compatibility but does not change the repository.
        try { /* no-op */ } catch (e) {}
    }

    function ensureProductData() {
        // Repo-backed mode: do not seed from DOM/localStorage. If no products loaded, return empty list.
        const prods = loadProducts() || [];
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

        // Apply search query filter (title, category, description, price)
        if (currentSearch && currentSearch.trim() !== ''){
            const q = currentSearch.trim().toLowerCase();
            items = items.filter(p => {
                const hay = ((p.title||'') + ' ' + (p.eyebrow||'') + ' ' + (p.description||'')).toLowerCase();
                if (hay.indexOf(q) !== -1) return true;
                if (String(p.price||'').toLowerCase().indexOf(q) !== -1) return true;
                return false;
            });
        }

        // Apply sorting if requested
        if (currentSort === 'price-asc'){
            items = items.slice().sort((a,b)=> (Number(a.price)||0) - (Number(b.price)||0));
        } else if (currentSort === 'price-desc'){
            items = items.slice().sort((a,b)=> (Number(b.price)||0) - (Number(a.price)||0));
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

    // --- Best sellers widget: choose random products and persist selection for 5 days ---
    function renderBestSellersItems(items, container){
        container.innerHTML = '';
        items.forEach(prod => {
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <img src="${escapeHtml(prod.image || 'https://placehold.co/500x360/ddd/000?text=Sin+imagen')}" class="card-img-top" alt="${escapeHtml(prod.title)}">
                <div class="card-body">
                    <span class="eyebrow">${escapeHtml(prod.eyebrow || '')}</span>
                    <h3>${escapeHtml(prod.title || '')}</h3>
                    <p class="price">${formatCOP(prod.price || 0)}</p>
                    <a href="productos.html" class="btn">Ver producto</a>
                </div>`;
            container.appendChild(div);
        });
    }

    function renderBestSellersWidget(count = 3){
        const container = document.getElementById('best-sellers-grid');
        if (!container) return;
        const key = 'dj_best_sellers_v1';
        try{
            const raw = localStorage.getItem(key);
            if (raw){
                const parsed = JSON.parse(raw);
                const age = Date.now() - (parsed.timestamp || 0);
                const fiveDays = 5 * 24 * 60 * 60 * 1000;
                if (parsed && parsed.items && Array.isArray(parsed.items) && age < fiveDays){
                    renderBestSellersItems(parsed.items, container);
                    return;
                }
            }
        }catch(e){ /* ignore and reselect */ }

        const products = loadProducts() || [];
        let items = [];
        if (products.length === 0){
            items = [
                { eyebrow: 'Best seller', title: 'Labial Lip Crush Velvet', price: 18900, image: 'https://placehold.co/500x360/810319/ffffff?text=Lip+Crush' },
                { eyebrow: 'Nuevo', title: 'Serum Glass Skin 24h', price: 27500, image: 'https://placehold.co/500x360/4f0012/ffffff?text=Glass+Skin' },
                { eyebrow: 'Edición limitada', title: 'Paleta Nude Attraction', price: 33000, image: 'https://placehold.co/500x360/a00927/ffffff?text=Eyes+Nude' }
            ];
        } else {
            // shuffle copy and pick first N
            const copy = products.slice();
            for (let i = copy.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
            items = copy.slice(0, Math.min(count, copy.length)).map(p => ({ id: p.id||null, eyebrow: p.eyebrow||'', title: p.title||'', price: p.price||0, image: p.image||'', description: p.description||'', stock: p.stock||0 }));
        }

        try{ localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), items })); }catch(e){ /* ignore storage errors */ }
        renderBestSellersItems(items, container);
    }

    // Inicializar productos y UI de filtros: preferir Firestore, si no cae a db.json del repo
    (async function initRepoProducts(){
        populateCategorySelects();

        // 1) If Firestore configured, subscribe to real-time updates
        try{
            const ok = await (window.waitForFirestore ? window.waitForFirestore(4000) : Promise.resolve(false));
            if (ok && window.__FIRESTORE_DB__){
                const db = window.__FIRESTORE_DB__;
                db.collection('products').onSnapshot(snapshot => {
                    DJ_PRODUCTS_DATA = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    createCategoryFilterUI();
                    renderProducts();
                    renderBestSellersWidget();
                }, err => {
                    console.warn('Firestore products snapshot error', err);
                });
                return;
            }
        }catch(e){ /* continue to repo fallback */ }

        // 2) Fallback to repo db.json (meta repo-base or /db.json)
        const repoBaseMeta = document.querySelector('meta[name="repo-base"]')?.content || window.__REPO_BASE__ || '';
        const candidates = [];
        if (repoBaseMeta) candidates.push(repoBaseMeta.replace(/\/$/, '') + '/db.json');
        candidates.push('/db.json');
        let loaded = false;
        for (const url of candidates){
            try{
                const r = await fetch(url, { cache: 'no-cache' });
                if (r && r.ok){
                    const data = await r.json();
                    DJ_PRODUCTS_DATA = Array.isArray(data) ? data : (data.products || []);
                    loaded = true;
                    break;
                }
            }catch(e){ /* ignore and try next */ }
        }

        if (!loaded){
            DJ_PRODUCTS_DATA = [];
            console.warn('No repository db.json found; site will show no products.');
        }

        createCategoryFilterUI();
        renderProducts();
        renderBestSellersWidget();
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
    // Search input + compact categories button
    (function(){
        const searchInput = document.getElementById('product-search-input');
        const categoriesBtn = document.getElementById('categories-btn');

        function debounce(fn, wait = 250){
            let t;
            return function(...args){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,args), wait); };
        }

        if (searchInput){
            searchInput.addEventListener('input', debounce(function(){
                currentSearch = (searchInput.value || '').trim();
                updateActiveFilterLabel();
                renderProducts();
            }, 250));
        }

        if (categoriesBtn){
            categoriesBtn.addEventListener('click', (e)=>{
                e.preventDefault();
                let wrapper = document.querySelector('.category-filters.dropdown');
                if (!wrapper){
                    createCategoryFilterUI();
                    wrapper = document.querySelector('.category-filters.dropdown');
                }
                if (!wrapper) return;
                if (wrapper.style.display === 'block'){
                    wrapper.style.opacity = '0';
                    wrapper.style.display = 'none';
                    wrapper.setAttribute('aria-hidden','true');
                    return;
                }
                const rect = categoriesBtn.getBoundingClientRect();
                // show briefly to measure width, keep hidden to avoid flash
                wrapper.style.display = 'block';
                wrapper.style.visibility = 'hidden';
                wrapper.style.opacity = '0';
                wrapper.style.transform = 'translateY(-6px)';
                wrapper.style.left = '0px';
                wrapper.style.top = '0px';
                const w = wrapper.offsetWidth || 300;
                const maxLeft = Math.max(8, window.innerWidth - w - 8);
                const calcLeft = Math.min(maxLeft, Math.max(8, Math.round(rect.left + (rect.width / 2) - (w / 2) + window.scrollX)));
                const calcTop = rect.bottom + window.scrollY + 8;
                wrapper.style.left = calcLeft + 'px';
                wrapper.style.top = calcTop + 'px';
                wrapper.style.visibility = '';
                // animate visible
                requestAnimationFrame(()=>{ wrapper.style.opacity = '1'; wrapper.style.transform = 'translateY(0)'; });
                wrapper.setAttribute('aria-hidden','false');
                // close on outside click
                const onDocClick = (ev) => {
                    if (!wrapper.contains(ev.target) && ev.target !== categoriesBtn){
                        wrapper.style.opacity = '0';
                        wrapper.style.display = 'none';
                        wrapper.setAttribute('aria-hidden','true');
                        document.removeEventListener('click', onDocClick);
                    }
                };
                setTimeout(()=>document.addEventListener('click', onDocClick), 10);
            });
        }
    })();
});