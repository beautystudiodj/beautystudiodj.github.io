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
    let adminOffersActive = false; // when true, edit controls are shown (admin panel)
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
        // Return products loaded from the repository `db.json` (synchronous accessor).
        // Merge any local overrides (fallback when no server/Firestore available).
        const prods = DJ_PRODUCTS_DATA ? DJ_PRODUCTS_DATA.slice() : [];
        try {
            const raw = localStorage.getItem('dj_local_product_updates');
            if (raw) {
                const map = JSON.parse(raw);
                prods.forEach(p => {
                    const key = p.id || p.title || '';
                    if (key && map[key]) Object.assign(p, map[key]);
                });
            }
        } catch(e) { /* ignore local overrides errors */ }
        return prods;
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
        return '$' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function escapeHtml(text) {
        return (text || '').replace(/[&"'<>]/g, function (a) { return {'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'}[a]; });
    }
    window.__escapeHtml = escapeHtml;

    // Returns the computed discounted price for a product (uses `discountPercentage` when present)
    function getDiscountedPrice(p){
        const price = Number((p && p.price) || 0);
        const dp = Number((p && p.discountPercentage) || 0);
        if (dp > 0) return Math.round(price * (100 - dp) / 100);
        return price;
    }

    function getQueryParam(name){
        try{ return new URLSearchParams(window.location.search).get(name); }catch(e){ return null; }
    }

    function renderProducts() {
        // Prefer rendering into the grid that sits inside the same section
        // as the homepage search input (if present). Fall back to the
        // first .grid-container on the page for legacy pages.
        let grid = null;
        const searchInput = document.getElementById('product-search-input');
        if (searchInput){
            const section = searchInput.closest('section') || searchInput.parentElement;
            if (section) grid = section.querySelector('.grid-container');
        }
        if (!grid) grid = document.querySelector('.grid-container');
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

        // Offer detection helpers
        function isOnOffer(p){
            if (!p) return false;
            const dp = Number(p.discountPercentage || p.discount || p.offerPercent || 0) || 0;
            const flag = Boolean(p.onOffer || p.oferta || p.isOffer || p.on_sale || p.sale);
            const hasOfferPrice = (typeof p.offerPrice !== 'undefined' && p.offerPrice !== null) || (typeof p.salePrice !== 'undefined' && p.salePrice !== null) || (typeof p.discountedPrice !== 'undefined' && p.discountedPrice !== null);
            return dp > 0 || flag || hasOfferPrice;
        }

        try{
            const path = (window.location.pathname || '').split('/').pop().toLowerCase();
            const isPublicOffersPage = (path === 'ofertas.html' || path === 'ofertas');
            // Public offers page: show only products that are on offer
            if (isPublicOffersPage){
                items = items.filter(isOnOffer);
            }
            // Admin offers panel: do not filter out products here (we show all), ordering handled later
        }catch(e){ /* ignore path parsing errors and continue rendering normally */ }

        // Apply sorting if requested (sort by effective price when discounts present)
        if (currentSort === 'price-asc'){
            items = items.slice().sort((a,b)=> (Number(getDiscountedPrice(a))||0) - (Number(getDiscountedPrice(b))||0));
        } else if (currentSort === 'price-desc'){
            items = items.slice().sort((a,b)=> (Number(getDiscountedPrice(b))||0) - (Number(getDiscountedPrice(a))||0));
        }

        // If admin offers panel is active, place offered products first while preserving relative order
        try{
            if (adminOffersActive === true){
                const offered = [];
                const rest = [];
                items.forEach(p => { if (isOnOffer(p)) offered.push(p); else rest.push(p); });
                items = offered.concat(rest);
            }
        }catch(e){ /* ignore */ }
        grid.innerHTML = '';
        items.forEach((prod, idx) => {
            const div = document.createElement('div');
            div.className = 'card';
            const discounted = getDiscountedPrice(prod);
            div.dataset.price = discounted || '0';
            div.dataset.index = idx;
            div.dataset.id = prod.id || '';
            const link = prod.id ? `product.html?id=${encodeURIComponent(prod.id)}` : `product.html?idx=${idx}`;

            // price presentation: show original crossed-out + discounted price when applicable
            const originalPrice = Number(prod.price || 0);
            let priceHtml = '';
            if (prod.discountPercentage && Number(prod.discountPercentage) > 0){
                priceHtml = `<div class="price-row"><span class="price-original">${formatCOP(originalPrice)}</span><span class="price price-discount">${formatCOP(discounted)}</span></div><div class="offer-badge" aria-hidden="true" style="position:absolute;top:10px;left:10px;background:var(--wine-700);color:#fff;padding:6px 8px;border-radius:8px;font-weight:800">-${Number(prod.discountPercentage)}%</div>`;
            } else {
                priceHtml = `<p class="price">${formatCOP(originalPrice)}</p>`;
            }

            div.innerHTML = `
                <a href="${link}" class="card-link"><img src="${escapeHtml(prod.image || 'https://placehold.co/500x360/ddd/000?text=Sin+imagen')}" class="card-img-top" alt="${escapeHtml(prod.title)}"></a>
                <div class="card-body">
                    <span class="eyebrow">${escapeHtml(prod.eyebrow || '')}</span>
                    <h3><a href="${link}">${escapeHtml(prod.title)}</a></h3>
                    ${priceHtml}
                    <p class="stock">Disponibles: ${prod.stock || 0} unidades</p>
                    <div style="display:flex;gap:8px">
                        ${!adminOffersActive ? '<button class="btn btn-buy">Añadir al Carrito</button>' : ''}
                        ${sessionStorage.getItem('admin_authed') && adminOffersActive ? '<button class="btn btn-edit-offer">Editar oferta</button>' : ''}
                    </div>
                </div>`;
            grid.appendChild(div);
        });
            // adjust title alignment: center when fits, left when truncated
            try{ adjustCardTitleAlignment && adjustCardTitleAlignment(grid); }catch(e){}
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
        // attach edit handlers if admin
        if (sessionStorage.getItem('admin_authed')){
            const edits = grid.querySelectorAll('.btn-edit-offer');
            edits.forEach((btn) => {
                btn.addEventListener('click', (e)=>{
                    e.preventDefault();
                    const card = btn.closest('.card');
                    const idx = parseInt(card.dataset.index, 10);
                    const prod = (loadProducts()||[])[idx];
                    openOfferEditor(card, prod, idx);
                });
            });
        }
        // ensure no card-level viewer counters remain (viewer counters only on detail pages)
        try{ removeCardViewerCounters && removeCardViewerCounters(); }catch(e){}
        try{ cleanupViewerTimers && cleanupViewerTimers(); }catch(e){}
    }

    // --- Best sellers widget: choose random products and persist selection for 5 days ---
    function renderBestSellersItems(items, container){
        container.innerHTML = '';
        items.forEach(prod => {
            const div = document.createElement('div');
            div.className = 'card best-card';
            const link = prod.id ? `product.html?id=${encodeURIComponent(prod.id)}` : `product.html?title=${encodeURIComponent(prod.title||'')}`;
            const originalPrice = Number(prod.price || 0);
            const discounted = getDiscountedPrice(prod);
            // Build price HTML (to be placed inside card body so it matches other product cards)
            const priceHtml = (prod.discountPercentage && Number(prod.discountPercentage) > 0) ? (`<div class="price-row"><span class="price-original">${formatCOP(originalPrice)}</span><span class="price price-discount">${formatCOP(discounted)}</span></div>`) : (`<p class="price">${formatCOP(originalPrice)}</p>`);

            div.innerHTML = `
                <a href="${link}" class="card-link"><img src="${escapeHtml(prod.image || 'https://placehold.co/500x360/ddd/000?text=Sin+imagen')}" class="card-img-top" alt="${escapeHtml(prod.title)}"></a>
                <div class="card-body">
                    <span class="eyebrow">${escapeHtml(prod.eyebrow || '')}</span>
                    <h3><a href="${link}">${escapeHtml(prod.title || '')}</a></h3>
                    ${priceHtml}
                    <div class="best-cta-row">
                        <button type="button" class="btn buy-now" data-title="${escapeHtml(prod.title || '')}" data-price="${Number(discounted || originalPrice)}" aria-label="Comprar ${escapeHtml(prod.title || '')}">Comprar ahora</button>
                    </div>
                </div>
                <div class="best-badge" aria-hidden="true">TOP</div>`;
            // Attach click handler to add to cart
            container.appendChild(div);
            const buyBtn = div.querySelector('.buy-now');
            if (buyBtn){
                buyBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const title = buyBtn.dataset.title || prod.title || '';
                    const price = Number(buyBtn.dataset.price || prod.price || 0) || 0;
                    try{ addItemToCart({ name: title, price }); } catch(err){ console.warn('No se pudo añadir al carrito', err); }
                });
            }
            
        });
        // after rendering best-sellers, adjust title alignment
        try{ adjustCardTitleAlignment && adjustCardTitleAlignment(container); }catch(e){}
        // start auto-scroll for this horizontal strip (if available)
        try{ if (typeof initHorizontalAutoScroll === 'function') initHorizontalAutoScroll(container); }catch(e){ console.warn('horizontal auto-scroll init failed', e); }
        // viewer counters only shown on product detail pages
    }

    function renderBestSellersWidget(count = 8){
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

    // Render a horizontal strip for recent products (similar look to best-sellers)
    function renderRecentStrip(items, container){
        if (!container) return;
        container.innerHTML = '';
        items.forEach(prod => {
            const div = document.createElement('div');
            div.className = 'card best-card';
            const link = prod.id ? `product.html?id=${encodeURIComponent(prod.id)}` : `product.html?title=${encodeURIComponent(prod.title||'')}`;
            const originalPrice = Number(prod.price || 0);
            const discounted = getDiscountedPrice(prod);
            const priceHtml = (prod.discountPercentage && Number(prod.discountPercentage) > 0) ? (`<div class="price-row"><span class="price-original">${formatCOP(originalPrice)}</span><span class="price price-discount">${formatCOP(discounted)}</span></div>`) : (`<p class="price">${formatCOP(originalPrice)}</p>`);
            div.innerHTML = `
                <a href="${link}" class="card-link"><img src="${escapeHtml(prod.image || 'https://placehold.co/500x360/ddd/000?text=Sin+imagen')}" class="card-img-top" alt="${escapeHtml(prod.title)}"></a>
                <div class="card-body">
                    <span class="eyebrow">${escapeHtml(prod.eyebrow || '')}</span>
                    <h3><a href="${link}">${escapeHtml(prod.title || '')}</a></h3>
                    ${priceHtml}
                    <div class="best-cta-row">
                        <button type="button" class="btn buy-now" data-title="${escapeHtml(prod.title || '')}" data-price="${Number(discounted || originalPrice)}" aria-label="Comprar ${escapeHtml(prod.title || '')}">Comprar ahora</button>
                    </div>
                </div>`;
            container.appendChild(div);
            const buyBtn = div.querySelector('.buy-now');
            if (buyBtn){
                buyBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const title = buyBtn.dataset.title || prod.title || '';
                    const price = Number(buyBtn.dataset.price || prod.price || 0) || 0;
                    try{ addItemToCart({ name: title, price }); } catch(err){ console.warn('No se pudo añadir al carrito', err); }
                });
            }
        });
        try{ adjustCardTitleAlignment && adjustCardTitleAlignment(container); }catch(e){}
        try{ if (typeof initHorizontalAutoScroll === 'function') initHorizontalAutoScroll(container); }catch(e){ console.warn('horizontal auto-scroll init failed', e); }
    }

    // Center titles if they fully fit; left-align when truncated so the start is visible
    function adjustCardTitleAlignment(root){
        try{
            const scope = root || document;
            const anchors = Array.from((scope.querySelectorAll && scope.querySelectorAll('.card h3 a')) || []);
            anchors.forEach(a => {
                a.classList.remove('title-left','title-centered');
                // force layout read
                const isOverflowing = (a.scrollWidth > a.clientWidth + 1);
                if (isOverflowing) a.classList.add('title-left'); else a.classList.add('title-centered');
            });
        }catch(e){ /* ignore */ }
    }

    // --- Recent products and full catalog rendering ---
    function getProductTimestamp(p){
        if (!p) return 0;
        // Firestore timestamp
        if (p.createdAt){
            const v = p.createdAt;
            if (typeof v === 'number') return v;
            if (typeof v === 'string'){
                const n = Date.parse(v);
                if (!isNaN(n)) return n;
                const asNum = parseInt(v,10); if (!isNaN(asNum)) return asNum;
            }
            if (v.seconds) return Number(v.seconds) * 1000;
            if (typeof v.toDate === 'function'){
                try { return v.toDate().getTime(); } catch(e){}
            }
        }
        if (p.timestamp){
            const t = p.timestamp;
            if (typeof t === 'number') return t;
            if (typeof t === 'string'){
                const n = Date.parse(t); if (!isNaN(n)) return n; const asNum = parseInt(t,10); if (!isNaN(asNum)) return asNum;
            }
        }
        return 0;
    }

    function renderCardList(items, container){
        container.innerHTML = '';
        if (!items || items.length === 0){
            container.innerHTML = '<p style="color:var(--muted)">No hay productos disponibles.</p>';
            return;
        }
        items.forEach((prod, idx) => {
            const div = document.createElement('div');
            div.className = 'card';
            const discounted = getDiscountedPrice(prod);
            div.dataset.price = discounted || '0';
            const link = prod.id ? `product.html?id=${encodeURIComponent(prod.id)}` : `product.html?idx=${idx}`;
            const originalPrice = Number(prod.price || 0);
            const priceHtml = (prod.discountPercentage && Number(prod.discountPercentage) > 0) ? (`<div class="price-row"><span class="price-original">${formatCOP(originalPrice)}</span><span class="price price-discount">${formatCOP(discounted)}</span></div>`) : (`<p class="price">${formatCOP(originalPrice)}</p>`);
            div.innerHTML = `
                <a href="${link}" class="card-link"><img src="${escapeHtml(prod.image || 'https://placehold.co/500x360/ddd/000?text=Sin+imagen')}" class="card-img-top" alt="${escapeHtml(prod.title)}"></a>
                <div class="card-body">
                    <span class="eyebrow">${escapeHtml(prod.eyebrow || '')}</span>
                    <h3><a href="${link}">${escapeHtml(prod.title || '')}</a></h3>
                    ${priceHtml}
                    <a href="${link}" class="btn">Ver producto</a>
                </div>`;
            container.appendChild(div);
        });
        // viewer counters only shown on product detail pages
    }

    /* Viewer counters simulation: small random walk (1..50) updating every 4-5s */
    function cleanupViewerTimers(){
        if (!window.__VIEWER_TIMERS__) window.__VIEWER_TIMERS__ = {};
        const map = window.__VIEWER_TIMERS__;
        Object.keys(map).forEach(id => {
            const el = document.querySelector('[data-viewer-id="' + id + '"]');
            if (!el){
                const t = map[id];
                try{ if (t && t.timerId) clearTimeout(t.timerId); }catch(e){}
                try{ if (t && t.intervalId) clearInterval(t.intervalId); }catch(e){}
                delete map[id];
            }
        });
    }

    function startViewerForElement(el){
        if (!el) return;
        if (!window.__VIEWER_TIMERS__) window.__VIEWER_TIMERS__ = {};
        if (el.dataset.viewerId && window.__VIEWER_TIMERS__[el.dataset.viewerId]) return; // already running
        const id = el.dataset.viewerId || ('v' + Math.random().toString(36).slice(2,9));
        el.dataset.viewerId = id;
        const initial = Math.floor(Math.random()*50) + 1;
        window.__VIEWER_TIMERS__[id] = { value: initial, timerId: null };

        function doUpdate(){
            const cur = Number(window.__VIEWER_TIMERS__[id].value) || 1;
            const delta = Math.floor(Math.random()*5) - 2; // -2..+2
            let next = cur + delta;
            if (next < 1) next = 1;
            if (next > 50) next = 50;
            window.__VIEWER_TIMERS__[id].value = next;
            el.innerHTML = `<span class="eye">👀</span> ${next} ${next===1? 'persona está viendo' : 'personas viendo'} esto ahora`;
            el.classList.add('viewer-update');
            setTimeout(()=> el.classList.remove('viewer-update'), 700);
            const delay = 4000 + Math.floor(Math.random()*1000);
            window.__VIEWER_TIMERS__[id].timerId = setTimeout(doUpdate, delay);
        }

        // initial render + schedule
        el.innerHTML = `<span class="eye">👀</span> ${initial} ${initial===1? 'persona está viendo' : 'personas viendo'} esto ahora`;
        const firstDelay = 4000 + Math.floor(Math.random()*1000);
        window.__VIEWER_TIMERS__[id].timerId = setTimeout(doUpdate, firstDelay);
    }

    function removeCardViewerCounters(){
        // remove any existing viewer counters inside product cards and clear their timers
        try{
            const els = Array.from(document.querySelectorAll('.card .viewer-count'));
            if (!els.length) return;
            if (!window.__VIEWER_TIMERS__) window.__VIEWER_TIMERS__ = {};
            els.forEach(el => {
                const id = el.dataset.viewerId;
                if (id && window.__VIEWER_TIMERS__ && window.__VIEWER_TIMERS__[id]){
                    try{ clearTimeout(window.__VIEWER_TIMERS__[id].timerId); }catch(e){}
                    try{ clearInterval(window.__VIEWER_TIMERS__[id].intervalId); }catch(e){}
                    delete window.__VIEWER_TIMERS__[id];
                }
                try{ el.remove(); }catch(e){}
            });
        }catch(e){/* ignore */}
    }

    function attachViewerCounters(){
        // Only attach viewer counters to product detail views (`.product-info`) —
        // cards should not show this counter.
        cleanupViewerTimers();
        const productInfos = Array.from(document.querySelectorAll('.product-info'));
        productInfos.forEach(pi => {
            if (pi.querySelector('.viewer-count')) return;
            const div = document.createElement('div');
            div.className = 'viewer-count';
            const ref = pi.querySelector('.eyebrow') || pi.querySelector('h1') || pi.firstChild;
            if (ref && ref.parentNode) ref.insertAdjacentElement('afterend', div);
            else pi.appendChild(div);
            startViewerForElement(div);
        });
    }

    function renderRecentProducts(count = 6){
        const container = document.getElementById('recent-products-grid');
        if (!container) return;
        const products = loadProducts() || [];
        if (!products || products.length === 0){
            container.innerHTML = '<p style="color:var(--muted)">No hay productos aún.</p>';
            return;
        }
        const withTs = products.map(p => ({...p, __ts: getProductTimestamp(p)}));
        const allZero = withTs.every(p => !p.__ts);
        let items;
        if (!allZero){
            items = withTs.slice().sort((a,b) => (b.__ts || 0) - (a.__ts || 0)).slice(0, Math.min(count, withTs.length));
        } else {
            // fallback: take last 'count' items (assume array append = newest)
            items = products.slice(-count).reverse();
        }
        // render recent products as a horizontal strip (scroll when overflowing)
        renderRecentStrip(items, container);
    }

    function renderAllProducts(){
        const container = document.getElementById('all-products-grid');
        if (!container) return;
        const products = loadProducts() || [];
        renderCardList(products, container);
    }

    // Try to render a product detail page if present
    function tryRenderProductDetail(){
        const container = document.getElementById('product-detail');
        if (!container) return; // not a detail page
        const id = getQueryParam('id');
        const idx = getQueryParam('idx');
        renderProductDetail(id, idx);
    }
    // Live sales simulation: shows occasional simulated "someone bought" notifications (with product preview)
    function startLiveSalesSimulation(){
        if (window.__LIVE_SALES_STARTED__) return;
        window.__LIVE_SALES_STARTED__ = true;
        const FIRST = ['María','Ana','Carolina','Luisa','Sofía','Valentina','Camila','Laura','Isabella','Natalia','Daniela','Paola','Juliana','Gabriela','Alejandra','Andrés','Juan','Carlos','Luis','Diego','Mateo','Santiago','Sebastián','David','Miguel','Javier'];
        const LAST = ['García','Rodríguez','Pérez','Gómez','Sánchez','Martínez','Lozano','Hernández','Ramírez','Torres','Castillo','Ruiz','Fernández','Rojas','Vargas','Castro','Jiménez','Moreno','Ortiz','Silva'];

        function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

        function sampleProducts(){
            const prods = loadProducts() || [];
            let pool = [];
            if (prods.length){
                pool = prods.map(p => ({ id: p.id || null, title: p.title || p.name || 'Producto', image: p.image || '', price: p.price || 0 }));
            } else {
                pool = [
                    { id: null, title: 'Labial Lip Crush Velvet', image: 'https://placehold.co/80x80/810319/ffffff?text=Lip', price: 18900 },
                    { id: null, title: 'Serum Glass Skin 24h', image: 'https://placehold.co/80x80/4f0012/ffffff?text=Serum', price: 27500 },
                    { id: null, title: 'Paleta Nude Attraction', image: 'https://placehold.co/80x80/a00927/ffffff?text=Paleta', price: 33000 },
                    { id: null, title: 'Kit Glow Express', image: 'https://placehold.co/80x80/aa3377/ffffff?text=Kit', price: 42000 },
                    { id: null, title: 'Brillo Labial Shine', image: 'https://placehold.co/80x80/ff6b6b/ffffff?text=Brillo', price: 12900 }
                ];
            }
            const count = Math.random() < 0.35 ? (Math.random() < 0.4 ? 2 : 3) : 1; // mostly 1, sometimes 2-3
            const picked = [];
            const copy = pool.slice();
            for (let i=0;i<count && copy.length;i++){
                const idx = Math.floor(Math.random()*copy.length);
                picked.push(copy.splice(idx,1)[0]);
            }
            return picked;
        }

        function showSale(){
            const first = rand(FIRST);
            const last = rand(LAST);
            const name = `${first} ${last}`;
            const items = sampleProducts();
            const productLinksHtml = items.map(it => {
                const href = it.id ? 'product.html?id=' + encodeURIComponent(it.id) : 'product.html';
                return `<a href="${href}" class="live-sale-link" style="color:var(--wine-700);font-weight:700;text-decoration:none">${escapeHtml(it.title)}</a>`;
            });
            const textHtml = items.length === 1 ? productLinksHtml[0] : (productLinksHtml.slice(0,2).join(', ') + (items.length>2 ? ' y más' : ''));

            const el = document.createElement('div');
            el.className = 'live-sale';
            const initials = (first[0]||'').toUpperCase() + (last[0]||'').toUpperCase();
            el.innerHTML = `
                <div class="live-sale-avatar">${escapeHtml(initials)}</div>
                <div class="live-sale-body"><strong>${escapeHtml(name)}</strong><div class="live-sale-text">acaba de comprar ${textHtml}</div></div>
                <div class="live-sale-preview">${items.map(it=>`<a href="${it.id ? 'product.html?id=' + encodeURIComponent(it.id) : 'product.html'}"><img src="${escapeHtml(it.image || 'https://placehold.co/64x64/ddd/000?text=img')}" alt="${escapeHtml(it.title)}"></a>`).join('')}</div>
            `;
            document.body.appendChild(el);
            // animate in
            requestAnimationFrame(()=> el.classList.add('show'));
            // remove after timeout
            setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 260); }, 4200 + Math.floor(Math.random()*1400));
        }

        function scheduleNext(){
            // increase randomness and spacing so notifications feel less frequent
            const delay = 10000 + Math.floor(Math.random()*20000); // 10s..30s
            window.__LIVE_SALES_TIMER__ = setTimeout(()=>{
                try{ showSale(); }catch(e){}
                scheduleNext();
            }, delay);
        }

        scheduleNext();
    }

    function renderProductDetail(id, idxParam){
        const container = document.getElementById('product-detail');
        if (!container) return;
        const products = loadProducts() || [];
        let prod = null;
        if (id){ prod = products.find(p => String(p.id) === String(id)); }
        if (!prod && idxParam != null){ const i = parseInt(idxParam, 10); if (!isNaN(i) && products[i]) prod = products[i]; }
        if (!prod){
            // fallback: try matching by title
            const titleKey = id ? String(id).toLowerCase() : null;
            if (titleKey){ prod = products.find(p => String(p.title || '').toLowerCase().replace(/\s+/g,'-') === titleKey); }
        }
        if (!prod){ container.innerHTML = '<p style="color:var(--muted)">Producto no encontrado.</p>'; return; }

        const discounted = getDiscountedPrice(prod);
        const originalPrice = Number(prod.price || 0);
        const detailPriceHtml = (prod.discountPercentage && Number(prod.discountPercentage) > 0) ? (`<div class="price-row"><span class="price-original">${formatCOP(originalPrice)}</span><span class="price price-discount" style="font-weight:900">${formatCOP(discounted)}</span></div><div class="offer-badge" style="display:inline-block;margin-top:8px;background:var(--wine-700);color:#fff;padding:6px 8px;border-radius:8px;font-weight:800">-${Number(prod.discountPercentage)}%</div>`) : (`<p class="price">${formatCOP(originalPrice)}</p>`);

        const html = `
            <div class="product-detail">
                <div class="product-gallery">
                    <img src="${escapeHtml(prod.image || 'https://placehold.co/800x600/ddd/000?text=Sin+imagen')}" alt="${escapeHtml(prod.title)}" class="product-main-img">
                </div>
                <div class="product-info">
                    <span class="eyebrow">${escapeHtml(prod.eyebrow || '')}</span>
                    <h1>${escapeHtml(prod.title || '')}</h1>
                    ${detailPriceHtml}
                    <p class="description" style="color:var(--muted);line-height:1.6">${escapeHtml(prod.description || '')}</p>
                    <div class="qty-row">
                        <button id="qty-minus" class="qty-btn" aria-label="Disminuir cantidad">−</button>
                        <input id="qty-input" type="number" value="1" min="1" aria-label="Cantidad" />
                        <button id="qty-plus" class="qty-btn" aria-label="Aumentar cantidad">+</button>
                        <div style="margin-left:12px;color:var(--muted)">Disponibles: <strong id="prod-stock">${prod.stock || 0}</strong></div>
                    </div>
                    <div class="product-actions">
                        <button id="add-to-cart-btn" class="btn">Añadir al carrito</button>
                        <a href="productos.html" class="btn-outline">Seguir comprando</a>
                    </div>
                </div>
            </div>`;
        container.innerHTML = html;

        // attach viewer counter for product detail
        try{ attachViewerCounters(); }catch(e){ /* ignore if helper not yet present */ }

        const qtyInput = document.getElementById('qty-input');
        const minus = document.getElementById('qty-minus');
        const plus = document.getElementById('qty-plus');
        const addBtn = document.getElementById('add-to-cart-btn');
        minus && minus.addEventListener('click', (e) => { e.preventDefault(); qtyInput.value = Math.max(1, Number(qtyInput.value) - 1); });
        plus && plus.addEventListener('click', (e) => { e.preventDefault(); qtyInput.value = Math.max(1, Number(qtyInput.value) + 1); });
        qtyInput && qtyInput.addEventListener('change', () => { if (Number(qtyInput.value) < 1) qtyInput.value = 1; });
        addBtn && addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const qty = Math.max(1, Number(qtyInput.value) || 1);
            const price = getDiscountedPrice(prod) || Number(prod.price || 0);
            addItemToCart({ name: prod.title || '', price, qty });
        });
    }

    // Inicializar productos y UI de filtros: preferir Firestore, si no cae a db.json del repo
    
    // Persistencia del descuento: intenta Firestore -> API -> localStorage
    async function persistProductDiscount(prod, percent){
        if (!prod) return false;
        const p = Number(percent) || 0;
        // 1) Firestore
        try{
            if (window.__FIRESTORE_DB__ && prod.id){
                await window.__FIRESTORE_DB__.collection('products').doc(String(prod.id)).update({ discountPercentage: p });
                console.log('[DJ] Discount updated in Firestore for', prod.id, p);
                return true;
            }
        }catch(e){ console.warn('Firestore update failed', e); }

        // 2) Remote API
        try{
            if (prod.id){
                const resp = await apiFetch(`/products/${encodeURIComponent(String(prod.id))}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ discountPercentage: p })
                });
                if (resp && resp.ok){
                    try{ const json = await resp.json();
                        // merge returned product into memory if possible
                        if (json && json.id){
                            const idx = (DJ_PRODUCTS_DATA || []).findIndex(x => String(x.id) === String(json.id));
                            if (idx !== -1) DJ_PRODUCTS_DATA[idx] = Object.assign({}, DJ_PRODUCTS_DATA[idx], json);
                        }
                    }catch(e){}
                    console.log('[DJ] Discount updated via API for', prod.id, p);
                    return true;
                }
            }
        }catch(e){ console.warn('API update failed', e); }

        // 3) Fallback: localStorage map of overrides
        try{
            const key = prod.id || prod.title || ('idx_' + ((DJ_PRODUCTS_DATA||[]).indexOf(prod)));
            const raw = localStorage.getItem('dj_local_product_updates') || '{}';
            const map = JSON.parse(raw || '{}');
            map[key] = Object.assign({}, map[key] || {}, { discountPercentage: p });
            localStorage.setItem('dj_local_product_updates', JSON.stringify(map));
            // apply in-memory
            const inprod = (DJ_PRODUCTS_DATA || []).find(x => (x.id && String(x.id) === String(prod.id)) || (x.title === prod.title));
            if (inprod) inprod.discountPercentage = p;
            console.log('[DJ] Discount saved locally for', key, p);
            return true;
        }catch(e){ console.warn('localStorage persist failed', e); }

        return false;
    }

    // Aplica descuento a producto (por id o por índice)
    async function applyDiscountToProduct(identifier, percent){
        let prod = null;
        if (typeof identifier === 'number'){
            prod = (DJ_PRODUCTS_DATA || [])[identifier];
        } else {
            prod = (DJ_PRODUCTS_DATA || []).find(p => String(p.id) === String(identifier) || p.title === identifier);
        }
        if (!prod) return false;
        prod.discountPercentage = Number(percent) || 0;
        // persist
        const ok = await persistProductDiscount(prod, prod.discountPercentage);
        // re-render relevant areas
        try{ renderProducts(); }catch(e){}
        try{ renderAllProducts(); }catch(e){}
        try{ renderBestSellersWidget(); }catch(e){}
        try{ tryRenderProductDetail(); }catch(e){}
        return ok;
    }

    // Editor inline para ofertas dentro de cada tarjeta (admin)
    function openOfferEditor(cardEl, prod, idx){
        if (!cardEl || !prod) return;
        // close existing editors
        Array.from(document.querySelectorAll('.offer-editor')).forEach(x => x.remove());
        const editor = document.createElement('div');
        editor.className = 'offer-editor';
        editor.style.marginTop = '10px';
        const initial = Math.max(0, Math.min(100, Number(prod.discountPercentage) || 0));

        const originalPrice = Number(prod.price || 0) || 0;
        const initialDiscounted = getDiscountedPrice(prod);

        editor.innerHTML = `
            <div style="border-top:1px solid var(--line); margin-top:12px; padding-top:12px;">
                <div style="margin-bottom:10px">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px">
                        <label style="font-weight:700; font-size:0.85rem">Descuento: <span class="offer-percent-display">${initial}</span>%</label>
                        <input type="number" min="0" max="100" value="${initial}" class="offer-percent-input" style="width:50px; padding:3px; border-radius:4px; border:1px solid var(--line); font-size:0.8rem" />
                    </div>
                    <input type="range" min="0" max="100" value="${initial}" class="offer-range" style="width:100%; height:4px; cursor:pointer" />
                </div>
                
                <div style="background:var(--blush-100); padding:8px; border-radius:6px; margin-bottom:10px; font-size:0.85rem">
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px">
                        <span style="color:var(--muted)">Nuevo precio:</span>
                        <strong class="offer-preview">${formatCOP(initialDiscounted)}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem">
                        <span style="color:var(--muted)">Ahorro:</span>
                        <span class="offer-savings" style="color:var(--wine-700); font-weight:700">${formatCOP(Math.max(0, originalPrice - initialDiscounted))}</span>
                    </div>
                </div>

                <div style="display:flex; gap:6px">
                    <button class="btn small btn-save-offer" style="flex:1; padding:6px 0">Aplicar</button>
                    <button class="btn-outline small btn-cancel-offer" style="flex:1; padding:6px 0">Cancelar</button>
                </div>
            </div>`;

        const body = cardEl.querySelector('.card-body') || cardEl;
        body.appendChild(editor);

        const range = editor.querySelector('.offer-range');
        const numInput = editor.querySelector('.offer-percent-input');
        const percentDisplay = editor.querySelector('.offer-percent-display');
        const preview = editor.querySelector('.offer-preview');
        const savingsEl = editor.querySelector('.offer-savings');
        const saveBtn = editor.querySelector('.btn-save-offer');
        const cancelBtn = editor.querySelector('.btn-cancel-offer');

        function update(val){
            val = Math.max(0, Math.min(100, Number(val) || 0));
            range.value = val;
            numInput.value = val;
            percentDisplay.textContent = val;
            const temp = Object.assign({}, prod, { discountPercentage: val });
            const discounted = getDiscountedPrice(temp);
            preview.textContent = formatCOP(discounted);
            savingsEl.textContent = formatCOP(Math.max(0, originalPrice - discounted));
        }

        range.addEventListener('input', () => update(range.value));
        numInput.addEventListener('input', () => update(numInput.value));
        numInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });

        cancelBtn.addEventListener('click', () => editor.remove());

        async function save(){
            const val = Math.max(0, Math.min(100, Number(numInput.value) || 0));
            try{
                saveBtn.disabled = true; saveBtn.textContent = 'Guardando...';
                await applyDiscountToProduct(prod.id || idx, val);
                saveBtn.textContent = 'Guardado';
                setTimeout(()=> editor.remove(), 450);
            }catch(e){
                console.warn('Save discount failed', e);
                alert('No se pudo guardar el descuento.');
                saveBtn.disabled = false; saveBtn.textContent = 'Aplicar';
            }
        }

        saveBtn.addEventListener('click', save);
        // initialize preview with initial value
        update(initial);
    }

    // -----------------------------
    // Invoices: generator + admin manager
    // -----------------------------
    function createInvoiceFromCart(){
        const id = 'inv' + Date.now() + Math.floor(Math.random()*900 + 100);
        const items = (cart || []).map(it => {
            const prod = (DJ_PRODUCTS_DATA || []).find(p => (p.title || p.name) === it.name);
            return {
                id: (prod && prod.id) ? prod.id : (it.id || null),
                name: it.name,
                unitPrice: Number(it.price) || 0,
                qty: Number(it.qty) || 1,
                discountPercentage: Number(it.discountPercentage) || 0
            };
        });
        // subtotal before coupons
        const subtotal = items.reduce((s,it) => s + (it.unitPrice * it.qty), 0);
        // apply any active coupon if applicable
        const coupon = getActiveCoupon();
        let couponDiscount = 0;
        if (coupon && Number(coupon.discountPercent) > 0 && subtotal >= (Number(coupon.minTotal)||0)){
            couponDiscount = Math.round(subtotal * (Number(coupon.discountPercent) || 0) / 100);
        }
        // item-level discounts (offers) still apply per item
        const totalAfterItemDiscounts = items.reduce((s,it) => {
            const p = Math.round(it.unitPrice * (100 - (Number(it.discountPercentage)||0)) / 100);
            return s + (p * it.qty);
        }, 0);
        // final total subtracting coupon (coupon is global after item discounts)
        const total = Math.max(0, totalAfterItemDiscounts - couponDiscount);
        const auth = window.__FIRESTORE_AUTH__;
        const uid = (auth && auth.currentUser) ? auth.currentUser.uid : null;
        return { id, createdAt: Date.now(), status: 'pending', uid, items, subtotal, coupon: coupon ? { code: coupon.code, discountPercent: coupon.discountPercent, amount: couponDiscount, expiresAt: coupon.expiresAt } : null, total };
    }

    async function persistInvoice(inv){
        // Try Firestore first
        try{
            const ok = await (window.waitForFirestore ? window.waitForFirestore(3000) : Promise.resolve(false));
            if (ok && window.__FIRESTORE_DB__){
                const db = window.__FIRESTORE_DB__;
                if (!inv.id){
                    const ref = await db.collection('invoices').add(inv);
                    inv.id = ref.id;
                    return inv;
                } else {
                    await db.collection('invoices').doc(inv.id).set(inv, { merge: true });
                    return inv;
                }
            }
        }catch(e){ console.warn('Firestore invoice persist failed', e); }

        // API fallback
        try{
            const base = getApiBase();
            if (base){
                const url = base.replace(/\/$/, '') + '/api/invoices' + (inv.id ? ('/' + inv.id) : '');
                const method = inv.id ? 'PUT' : 'POST';
                const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inv) });
                if (r.ok){ const data = await r.json(); return data; }
            }
        }catch(e){ console.warn('API invoice persist failed', e); }

        // localStorage fallback
        try{
            const raw = localStorage.getItem('dj_invoices') || '[]';
            const arr = JSON.parse(raw || '[]');
            if (!inv.id) inv.id = 'inv' + Date.now() + Math.floor(Math.random()*900 + 100);
            const idx = arr.findIndex(x => x.id === inv.id);
            if (idx === -1) arr.unshift(inv); else arr[idx] = Object.assign({}, arr[idx], inv);
            localStorage.setItem('dj_invoices', JSON.stringify(arr));
            return inv;
        }catch(e){ console.warn('localStorage invoice persist failed', e); }

        throw new Error('Could not persist invoice');
    }

    async function loadInvoices(){
        // Firestore
        try{
            const ok = await (window.waitForFirestore ? window.waitForFirestore(3000) : Promise.resolve(false));
            if (ok && window.__FIRESTORE_DB__){
                const snapshot = await window.__FIRESTORE_DB__.collection('invoices').get();
                return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            }
        }catch(e){ console.warn('Firestore load invoices failed', e); }

        // API
        try{
            const base = getApiBase();
            if (base){
                const url = base.replace(/\/$/, '') + '/api/invoices';
                const r = await fetch(url);
                if (r.ok) return await r.json();
            }
        }catch(e){ console.warn('API load invoices failed', e); }

        // localStorage
        try{ return JSON.parse(localStorage.getItem('dj_invoices') || '[]'); }catch(e){ return []; }
    }

    function computeTotalSales(invoices){
        if (!Array.isArray(invoices)) return 0;
        return invoices.filter(i => i.status === 'confirmed').reduce((s,i) => s + (Number(i.total) || Number(i.subtotal) || 0), 0);
    }

    // ─── Admin Products Panel (rendered inline, no external fetch) ───────────
    async function renderAdminProductsPanel(area){
        if (!area) return;
        area.innerHTML = `
            <div class="admin-card" style="padding:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px">
                    <h3 style="margin:0">Gestionar Productos</h3>
                    <a class="btn small" href="add.html">+ Agregar producto</a>
                </div>
                <div id="adm-products-list" style="display:flex;flex-direction:column;gap:10px"></div>
                <div style="margin-top:12px">
                    <button id="adm-commit-stock" class="btn" disabled>Actualizar stock</button>
                </div>
            </div>`;

        let admProds = null;
        let admPending = {};  // id -> newStock
        let admEditing = null;

        // Load products
        try{
            const ok = await (window.waitForFirestore ? window.waitForFirestore(4000) : Promise.resolve(false));
            if (ok && window.__FIRESTORE_DB__){
                const snap = await window.__FIRESTORE_DB__.collection('products').get();
                admProds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }
        }catch(e){}
        if (!admProds || !admProds.length){
            try{
                const r = await fetch('/db.json', { cache: 'no-cache' });
                if (r.ok){ const data = await r.json(); admProds = Array.isArray(data) ? data : (data.products || []); }
            }catch(e){}
        }
        admProds = admProds || DJ_PRODUCTS_DATA || [];

        function admShowToast(msg){ let t=document.getElementById('adm-toast'); if(!t){t=document.createElement('div');t.id='adm-toast';t.className='toast';document.body.appendChild(t);} t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1400); }

        function admRender(){
            const list = area.querySelector('#adm-products-list');
            if (!list) return;
            list.innerHTML = '';
            if (!admProds || !admProds.length){
                list.innerHTML = '<p style="color:var(--muted)">No hay productos.</p>';
                return;
            }
            admProds.forEach(p => {
                const stock = admPending[p.id] !== undefined ? admPending[p.id] : (p.stock || 0);
                const dirty = admPending[p.id] !== undefined && admPending[p.id] !== p.stock;
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,0.06);flex-wrap:wrap;' + (dirty ? 'background:#fffbe6;' : '');
                if (admEditing === p.id){
                    const sv = v => escapeHtml(String(v == null ? '' : v));
                    row.innerHTML = `
                        <img src="${escapeHtml(p.image||'')}" style="width:54px;height:54px;object-fit:cover;border-radius:8px;flex-shrink:0" onerror="this.src='https://placehold.co/54x54/eee/999?text=?'">
                        <div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:6px">
                            <input id="ae-title" value="${sv(p.title)}" placeholder="Título" style="width:100%;padding:5px;border-radius:6px;border:1px solid var(--line)">
                            <div style="display:flex;gap:6px;flex-wrap:wrap">
                                <input id="ae-price" type="number" value="${sv(p.price)}" placeholder="Precio" style="width:110px;padding:5px;border-radius:6px;border:1px solid var(--line)">
                                <input id="ae-stock" type="number" value="${sv(p.stock)}" placeholder="Stock" style="width:80px;padding:5px;border-radius:6px;border:1px solid var(--line)">
                                <select id="ae-cat" style="padding:5px;border-radius:6px;border:1px solid var(--line);flex:1">
                                    <option value="">Categoría...</option>
                                    ${DJ_CATEGORIES.map(c=>`<option value="${escapeHtml(c)}"${p.eyebrow===c?' selected':''}>${escapeHtml(c)}</option>`).join('')}
                                </select>
                            </div>
                            <input id="ae-image" value="${sv(p.image)}" placeholder="URL imagen" style="width:100%;padding:5px;border-radius:6px;border:1px solid var(--line)">
                            <textarea id="ae-desc" rows="2" placeholder="Descripción" style="width:100%;padding:5px;border-radius:6px;border:1px solid var(--line)">${sv(p.description)}</textarea>
                            <div style="display:flex;gap:6px">
                                <button class="btn small adm-save-edit" data-id="${escapeHtml(p.id)}">Guardar</button>
                                <button class="btn-outline small adm-cancel-edit" data-id="${escapeHtml(p.id)}">Cancelar</button>
                            </div>
                        </div>`;
                } else {
                    row.innerHTML = `
                        <img src="${escapeHtml(p.image||'')}" style="width:54px;height:54px;object-fit:cover;border-radius:8px;flex-shrink:0" onerror="this.src='https://placehold.co/54x54/eee/999?text=?'">
                        <div style="flex:1;min-width:160px">
                            <div style="font-weight:700;font-size:0.9rem">${escapeHtml(p.title||'')}</div>
                            <div style="color:var(--muted);font-size:0.8rem">${escapeHtml(p.eyebrow||'')} · ${formatCOP(p.price)}</div>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px">
                            <button class="btn-outline small adm-dec" data-id="${escapeHtml(p.id)}">−</button>
                            <span id="adm-stock-${escapeHtml(p.id)}" style="font-weight:700;min-width:32px;text-align:center">${stock}</span>
                            <button class="btn-outline small adm-inc" data-id="${escapeHtml(p.id)}">+</button>
                        </div>
                        <div style="display:flex;gap:6px">
                            <button class="btn small adm-edit" data-id="${escapeHtml(p.id)}">Editar</button>
                            <button class="btn-outline small adm-del" data-id="${escapeHtml(p.id)}" style="color:#c0392b;border-color:#c0392b">Eliminar</button>
                        </div>`;
                }
                list.appendChild(row);
            });

            // Stock buttons
            list.querySelectorAll('.adm-dec').forEach(b => b.addEventListener('click', () => {
                const id = b.dataset.id; const p = admProds.find(x=>x.id===id); if(!p) return;
                const cur = admPending[id]!==undefined ? admPending[id] : (p.stock||0);
                admPending[id] = Math.max(0, cur-1);
                const el = list.querySelector('#adm-stock-'+id); if(el) el.textContent = admPending[id];
                b.closest('div[style]').style.background='#fffbe6';
                area.querySelector('#adm-commit-stock').disabled = false;
            }));
            list.querySelectorAll('.adm-inc').forEach(b => b.addEventListener('click', () => {
                const id = b.dataset.id; const p = admProds.find(x=>x.id===id); if(!p) return;
                const cur = admPending[id]!==undefined ? admPending[id] : (p.stock||0);
                admPending[id] = cur+1;
                const el = list.querySelector('#adm-stock-'+id); if(el) el.textContent = admPending[id];
                b.closest('div[style]').style.background='#fffbe6';
                area.querySelector('#adm-commit-stock').disabled = false;
            }));

            // Edit
            list.querySelectorAll('.adm-edit').forEach(b => b.addEventListener('click', () => {
                admEditing = b.dataset.id; admRender();
            }));
            list.querySelectorAll('.adm-cancel-edit').forEach(b => b.addEventListener('click', () => {
                admEditing = null; admRender();
            }));
            list.querySelectorAll('.adm-save-edit').forEach(b => b.addEventListener('click', async () => {
                const id = b.dataset.id;
                const updated = {
                    title: area.querySelector('#ae-title')?.value.trim() || '',
                    price: parseInt(area.querySelector('#ae-price')?.value||'0',10)||0,
                    stock: parseInt(area.querySelector('#ae-stock')?.value||'0',10)||0,
                    eyebrow: area.querySelector('#ae-cat')?.value||'',
                    image: area.querySelector('#ae-image')?.value.trim()||'',
                    description: area.querySelector('#ae-desc')?.value.trim()||''
                };
                if (!updated.title){ admShowToast('El título es obligatorio'); return; }
                try{
                    const ok = await (window.waitForFirestore ? window.waitForFirestore(3000) : Promise.resolve(false));
                    if (ok && window.__FIRESTORE_DB__){
                        await window.__FIRESTORE_DB__.collection('products').doc(id).update(updated);
                        admShowToast('Guardado en Firestore');
                    } else { admShowToast('Guardado localmente'); }
                }catch(e){ admShowToast('Guardado localmente'); }
                const idx = admProds.findIndex(x=>x.id===id);
                if(idx!==-1) admProds[idx] = Object.assign({}, admProds[idx], updated);
                admEditing = null; admRender();
            }));

            // Delete
            list.querySelectorAll('.adm-del').forEach(b => b.addEventListener('click', async () => {
                if(!confirm('¿Eliminar este producto? No se puede deshacer.')) return;
                const id = b.dataset.id;
                try{
                    const ok = await (window.waitForFirestore ? window.waitForFirestore(3000) : Promise.resolve(false));
                    if(ok && window.__FIRESTORE_DB__) await window.__FIRESTORE_DB__.collection('products').doc(id).delete();
                }catch(e){}
                admProds = admProds.filter(x=>x.id!==id);
                delete admPending[id];
                admShowToast('Producto eliminado');
                admRender();
            }));
        }

        // Commit stock
        area.querySelector('#adm-commit-stock').addEventListener('click', async () => {
            const ids = Object.keys(admPending);
            if (!ids.length){ return; }
            try{
                const ok = await (window.waitForFirestore ? window.waitForFirestore(3000) : Promise.resolve(false));
                if(ok && window.__FIRESTORE_DB__){
                    const batch = window.__FIRESTORE_DB__.batch();
                    ids.forEach(id => { const ref = window.__FIRESTORE_DB__.collection('products').doc(id); batch.update(ref, { stock: admPending[id] }); });
                    await batch.commit();
                    admShowToast('Stock actualizado en Firestore');
                } else { admShowToast('Stock guardado localmente'); }
            }catch(e){ admShowToast('No se pudo actualizar el stock'); console.warn(e); }
            ids.forEach(id=>{ const p=admProds.find(x=>x.id===id); if(p) p.stock=admPending[id]; });
            admPending = {};
            area.querySelector('#adm-commit-stock').disabled = true;
            admRender();
        });

        admRender();
    }

    // ─── Admin Staff Panel (rendered inline, no external fetch) ─────────────
    async function renderAdminStaffPanel(area){
        if (!area) return;
        area.innerHTML = `
            <div class="admin-card" style="padding:16px">
                <h3 style="margin-bottom:14px">Gestionar Staff</h3>
                <p id="adm-staff-status" style="font-weight:700;font-size:0.85rem;margin-bottom:12px">⏳ Conectando...</p>
                <form id="adm-staff-form" class="admin-form" style="max-width:600px">
                    <label>Nombre completo *<input name="name" required placeholder="Ej: Ana López"></label>
                    <label>Rol / Cargo<input name="role" placeholder="Ej: Asesora de Belleza"></label>
                    <label>Bio<textarea name="bio" rows="2" placeholder="Especialidad y experiencia"></textarea></label>
                    <label>Imagen (URL)<input name="image" placeholder="https://..."></label>
                    <div style="margin-top:10px">
                        <button type="submit" class="btn">Agregar miembro</button>
                    </div>
                </form>
                <div id="adm-staff-list" style="margin-top:20px"></div>
            </div>`;

        const statusEl = area.querySelector('#adm-staff-status');
        const staffForm = area.querySelector('#adm-staff-form');
        const staffListEl = area.querySelector('#adm-staff-list');

        function showStatus(ok){ statusEl.textContent = ok ? '🟢 Conectado a Firestore' : '🟡 Modo local (Firestore no disponible)'; statusEl.style.color = ok ? 'green' : '#856404'; }
        function staffToast(msg){ let t=document.getElementById('adm-toast'); if(!t){t=document.createElement('div');t.id='adm-toast';t.className='toast';document.body.appendChild(t);} t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1400); }

        async function loadStaff(){
            try{
                const ok = await (window.waitForFirestore ? window.waitForFirestore(4000) : Promise.resolve(false));
                if (ok && window.__FIRESTORE_DB__){
                    showStatus(true);
                    const snap = await window.__FIRESTORE_DB__.collection('staff').orderBy('name').get();
                    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
                }
            }catch(e){ console.warn('Firestore staff load failed', e); }
            showStatus(false);
            try{ return JSON.parse(localStorage.getItem('dj_staff') || '[]'); }catch(e){ return []; }
        }

        async function renderStaffList(){
            staffListEl.innerHTML = '<p style="color:var(--muted)">Cargando...</p>';
            const arr = await loadStaff();
            staffListEl.innerHTML = '<h4 style="margin-bottom:10px">Miembros del equipo</h4>';
            if (!arr.length){ staffListEl.innerHTML += '<p style="color:var(--muted)">Sin miembros aún.</p>'; return; }
            arr.forEach(m => {
                const card = document.createElement('div');
                card.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,0.07);margin-bottom:8px;flex-wrap:wrap';
                card.innerHTML = `
                    ${m.image ? `<img src="${escapeHtml(m.image)}" style="width:46px;height:46px;object-fit:cover;border-radius:50%;flex-shrink:0" onerror="this.style.display='none'">` : ''}
                    <div style="flex:1;min-width:140px">
                        <div style="font-weight:700;font-size:0.9rem">${escapeHtml(m.name||'')}</div>
                        <div style="color:var(--muted);font-size:0.8rem">${escapeHtml(m.role||'')}</div>
                        ${m.bio ? `<div style="font-size:0.78rem;color:var(--muted);margin-top:2px">${escapeHtml(m.bio)}</div>` : ''}
                    </div>
                    <button class="btn-outline small adm-del-staff" data-id="${escapeHtml(m.id||'')}" data-name="${escapeHtml(m.name||'')}" style="color:#c0392b;border-color:#c0392b;align-self:center">Despedir</button>`;
                staffListEl.appendChild(card);
            });

            staffListEl.querySelectorAll('.adm-del-staff').forEach(b => b.addEventListener('click', async () => {
                if (!confirm(`¿Despedir a ${b.dataset.name}? Esta persona será eliminada del equipo.`)) return;
                const id = b.dataset.id;
                try{
                    const ok = await (window.waitForFirestore ? window.waitForFirestore(3000) : Promise.resolve(false));
                    if (ok && window.__FIRESTORE_DB__) await window.__FIRESTORE_DB__.collection('staff').doc(id).delete();
                    else {
                        const arr = JSON.parse(localStorage.getItem('dj_staff')||'[]').filter(x=>x.id!==id);
                        localStorage.setItem('dj_staff', JSON.stringify(arr));
                    }
                }catch(e){ const arr = JSON.parse(localStorage.getItem('dj_staff')||'[]').filter(x=>x.id!==id); localStorage.setItem('dj_staff',JSON.stringify(arr)); }
                staffToast(`${b.dataset.name} ha sido despedido/a del equipo.`);
                renderStaffList();
            }));
        }

        staffForm.addEventListener('submit', async function(e){
            e.preventDefault();
            const member = {
                name: staffForm.name.value.trim(),
                role: staffForm.role.value.trim(),
                bio: staffForm.bio.value.trim(),
                image: staffForm.image.value.trim()
            };
            if (!member.name){ staffToast('El nombre es obligatorio'); return; }
            try{
                const ok = await (window.waitForFirestore ? window.waitForFirestore(3000) : Promise.resolve(false));
                if (ok && window.__FIRESTORE_DB__){
                    await window.__FIRESTORE_DB__.collection('staff').add(member);
                    staffToast('Miembro guardado en Firestore');
                } else {
                    const arr = JSON.parse(localStorage.getItem('dj_staff')||'[]');
                    arr.unshift(Object.assign({ id: 'local_'+Date.now() }, member));
                    localStorage.setItem('dj_staff', JSON.stringify(arr));
                    staffToast('Guardado localmente');
                }
            }catch(err){
                const arr = JSON.parse(localStorage.getItem('dj_staff')||'[]');
                arr.unshift(Object.assign({ id: 'local_'+Date.now() }, member));
                localStorage.setItem('dj_staff', JSON.stringify(arr));
                staffToast('Guardado localmente');
            }
            staffForm.reset();
            renderStaffList();
        });

        renderStaffList();
    }

    async function deleteInvoice(id){
        // Firestore
        try{
            const ok = await (window.waitForFirestore ? window.waitForFirestore(3000) : Promise.resolve(false));
            if (ok && window.__FIRESTORE_DB__){
                await window.__FIRESTORE_DB__.collection('invoices').doc(id).delete();
                return;
            }
        }catch(e){ console.warn('Firestore delete invoice failed', e); }
        // API
        try{
            const base = getApiBase();
            if (base){
                const r = await fetch(base.replace(/\/$/, '') + '/api/invoices/' + encodeURIComponent(id), { method: 'DELETE' });
                if (r.ok) return;
            }
        }catch(e){ console.warn('API delete invoice failed', e); }
        // localStorage
        try{
            const arr = JSON.parse(localStorage.getItem('dj_invoices') || '[]');
            localStorage.setItem('dj_invoices', JSON.stringify(arr.filter(x => x.id !== id)));
        }catch(e){ console.warn('localStorage delete invoice failed', e); }
    }

    function renderInvoicesManager(area){
        if (!area) return;
        area.innerHTML = `
            <div class="admin-card" style="padding:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                    <h3 style="margin:0">Facturas</h3>
                    <div style="font-size:0.9rem;color:var(--muted)">Total ventas confirmadas: <strong id="invoices-total" style="color:var(--wine-700)">${formatCOP(0)}</strong></div>
                </div>
                <div id="invoices-list"><p style="color:var(--muted)">Cargando...</p></div>
                <div id="invoice-detail" style="margin-top:16px"></div>
            </div>`;
        loadInvoices().then(invoices => {
            const list = area.querySelector('#invoices-list');
            renderInvoicesList(area, invoices || []);
            const totalEl = area.querySelector('#invoices-total');
            if (totalEl) totalEl.textContent = formatCOP(computeTotalSales(invoices || []));
        });
    }

    function renderInvoicesList(area, invoices){
        const container = area.querySelector('#invoices-list');
        if (!container) return;
        container.innerHTML = '';
        if (!invoices.length){
            container.innerHTML = '<p style="color:var(--muted)">No hay facturas registradas.</p>';
            return;
        }
        invoices.forEach(inv => {
            const confirmed = inv.status === 'confirmed';
            const total = formatCOP(inv.total || inv.subtotal || 0);
            const date = new Date(inv.createdAt || Date.now()).toLocaleString('es-CO');
            const badge = confirmed
                ? `<span style="background:#d4edda;color:#155724;padding:2px 8px;border-radius:20px;font-size:0.75rem;font-weight:700">Confirmada</span>`
                : `<span style="background:#fff3cd;color:#856404;padding:2px 8px;border-radius:20px;font-size:0.75rem;font-weight:700">Pendiente</span>`;
            const div = document.createElement('div');
            div.className = 'admin-invoice-row';
            div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.06);gap:8px;flex-wrap:wrap';
            div.innerHTML = `
                <div style="flex:1;min-width:180px">
                    <div style="font-weight:700;font-size:0.9rem">${escapeHtml(inv.id)}</div>
                    <div style="color:var(--muted);font-size:0.8rem;margin:2px 0">${date}</div>
                    <div style="margin-top:4px">${badge}</div>
                </div>
                <div style="font-weight:800;color:var(--wine-700);min-width:90px;text-align:right">${total}</div>
                <div style="display:flex;gap:6px">
                    <button class="btn small btn-view-invoice" data-id="${escapeHtml(inv.id)}">Ver / Editar</button>
                    ${!confirmed ? `<button class="btn small btn-confirm-invoice-list" data-id="${escapeHtml(inv.id)}">Confirmar</button>` : ''}
                    <button class="btn-outline small btn-delete-invoice" data-id="${escapeHtml(inv.id)}" style="color:#c0392b;border-color:#c0392b">Borrar</button>
                </div>`;
            container.appendChild(div);
        });

        // View / Edit
        container.querySelectorAll('.btn-view-invoice').forEach(b => b.addEventListener('click', async () => {
            const detail = area.querySelector('#invoice-detail');
            if (!detail) return;
            // toggle off if already open
            if (detail.dataset.openId === b.dataset.id){ detail.innerHTML = ''; detail.dataset.openId = ''; return; }
            detail.innerHTML = '<p style="color:var(--muted)">Cargando factura...</p>';
            const invoices = await loadInvoices();
            const inv = (invoices || []).find(x => x.id === b.dataset.id);
            if (!inv){ detail.innerHTML = '<p>Factura no encontrada.</p>'; return; }
            detail.dataset.openId = b.dataset.id;
            openInvoiceEditorInAdmin(area, detail, inv);
        }));

        // Quick confirm from list
        container.querySelectorAll('.btn-confirm-invoice-list').forEach(b => b.addEventListener('click', async () => {
            if (!confirm('¿Confirmar factura y descontar stock?')) return;
            try{
                await confirmInvoice(b.dataset.id);
                renderInvoicesManager(area.closest('#admin-panel-area') || area);
            }catch(e){ alert('No se pudo confirmar: ' + (e && e.message ? e.message : String(e))); }
        }));

        // Delete
        container.querySelectorAll('.btn-delete-invoice').forEach(b => b.addEventListener('click', async () => {
            if (!confirm('¿Eliminar esta factura? Esta acción no se puede deshacer.')) return;
            try{
                await deleteInvoice(b.dataset.id);
                renderInvoicesManager(area.closest('#admin-panel-area') || area);
            }catch(e){ alert('Error al eliminar: ' + (e && e.message ? e.message : String(e))); }
        }));
    }

    function openInvoiceEditorInAdmin(area, detailArea, inv){
        detailArea.innerHTML = '';
        const confirmed = inv.status === 'confirmed';
        const wrap = document.createElement('div');
        wrap.style.cssText = 'border:1px solid rgba(0,0,0,0.08);border-radius:10px;padding:14px;background:#fafafa;margin-top:4px';
        wrap.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:12px">
                <div>
                    <strong style="font-size:1rem">Factura ${escapeHtml(inv.id)}</strong>
                    <div style="color:var(--muted);font-size:0.82rem">${new Date(inv.createdAt||Date.now()).toLocaleString('es-CO')}</div>
                    ${inv.clientName ? `<div style="font-size:0.85rem;margin-top:2px">Cliente: <strong>${escapeHtml(inv.clientName)}</strong></div>` : ''}
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    ${!confirmed ? `<button class="btn small btn-confirm-invoice">✓ Confirmar</button>` : ''}
                    <button class="btn small btn-save-invoice">Guardar</button>
                    <button class="btn-outline small btn-close-editor">✕ Cerrar</button>
                </div>
            </div>
            <div id="invoice-items-editor" style="margin-bottom:12px"></div>
            <div style="display:flex;justify-content:flex-end;align-items:center;gap:12px;border-top:1px solid rgba(0,0,0,0.06);padding-top:10px">
                <span style="color:var(--muted);font-size:0.85rem">Total:</span>
                <strong id="invoice-totals" style="font-size:1.1rem;color:var(--wine-700)">${formatCOP(inv.total || inv.subtotal || 0)}</strong>
            </div>`;
        detailArea.appendChild(wrap);

        const itemsContainer = wrap.querySelector('#invoice-items-editor');

        function recalcTotals(){
            inv.subtotal = (inv.items || []).reduce((s,it) => s + ((Number(it.unitPrice)||0) * (Number(it.qty)||1)), 0);
            inv.total = (inv.items || []).reduce((s,it) => {
                const p = Math.round((Number(it.unitPrice)||0) * (100 - (Number(it.discountPercentage)||0))/100);
                return s + (p * (Number(it.qty)||1));
            }, 0);
            const el = wrap.querySelector('#invoice-totals');
            if (el) el.textContent = formatCOP(inv.total || inv.subtotal || 0);
        }

        function renderItems(){
            itemsContainer.innerHTML = '';
            if (!inv.items || !inv.items.length){
                itemsContainer.innerHTML = '<p style="color:var(--muted);font-size:0.85rem">Sin productos.</p>';
                return;
            }
            (inv.items || []).forEach((it, idx) => {
                const lineTotal = Math.round((Number(it.unitPrice)||0) * (100-(Number(it.discountPercentage)||0))/100) * (Number(it.qty)||1);
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.04);gap:8px;flex-wrap:wrap';
                row.innerHTML = `
                    <div style="flex:1;min-width:120px">
                        <strong style="font-size:0.9rem">${escapeHtml(it.name||it.title||'')}</strong>
                        <div style="color:var(--muted);font-size:0.8rem">${formatCOP(it.unitPrice||it.price||0)} c/u</div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                        <label style="font-size:0.78rem;color:var(--muted)">Cant.
                            <input data-idx="${idx}" class="input-qty" type="number" min="1" value="${it.qty||1}" style="width:54px;padding:4px;border-radius:6px;border:1px solid var(--line);margin-left:4px">
                        </label>
                        <label style="font-size:0.78rem;color:var(--muted)">Desc.%
                            <input data-idx="${idx}" class="input-discount" type="number" min="0" max="100" value="${it.discountPercentage||0}" style="width:54px;padding:4px;border-radius:6px;border:1px solid var(--line);margin-left:4px">
                        </label>
                        <span style="font-weight:700;font-size:0.88rem;min-width:80px;text-align:right" class="line-total-${idx}">${formatCOP(lineTotal)}</span>
                        <button data-idx="${idx}" class="btn-outline small btn-remove-item" style="padding:3px 8px;font-size:0.75rem;color:#c0392b;border-color:#c0392b">✕</button>
                    </div>`;
                itemsContainer.appendChild(row);
            });

            itemsContainer.querySelectorAll('.input-qty').forEach(i => i.addEventListener('input', () => {
                const idx = Number(i.dataset.idx);
                inv.items[idx].qty = Math.max(1, Number(i.value)||1);
                recalcTotals();
                const lt = wrap.querySelector('.line-total-'+idx);
                if (lt){ const p = Math.round((Number(inv.items[idx].unitPrice)||0)*(100-(Number(inv.items[idx].discountPercentage)||0))/100); lt.textContent = formatCOP(p * inv.items[idx].qty); }
            }));
            itemsContainer.querySelectorAll('.input-discount').forEach(i => i.addEventListener('input', () => {
                const idx = Number(i.dataset.idx);
                inv.items[idx].discountPercentage = Math.max(0, Math.min(100, Number(i.value)||0));
                recalcTotals();
                const lt = wrap.querySelector('.line-total-'+idx);
                if (lt){ const p = Math.round((Number(inv.items[idx].unitPrice)||0)*(100-(Number(inv.items[idx].discountPercentage)||0))/100); lt.textContent = formatCOP(p * (inv.items[idx].qty||1)); }
            }));
            itemsContainer.querySelectorAll('.btn-remove-item').forEach(b => b.addEventListener('click', () => {
                inv.items.splice(Number(b.dataset.idx), 1);
                renderItems(); recalcTotals();
            }));
        }

        // Save
        wrap.querySelector('.btn-save-invoice').addEventListener('click', async () => {
            try{
                await persistInvoice(inv);
                const toast = document.createElement('div');
                toast.textContent = 'Factura guardada.';
                toast.className = 'toast show';
                document.body.appendChild(toast);
                setTimeout(()=>{ toast.remove(); }, 1400);
                renderInvoicesManager(area.closest('#admin-panel-area') || area);
            }catch(e){ alert('Error guardando factura.'); console.warn(e); }
        });

        // Confirm
        const confirmBtn = wrap.querySelector('.btn-confirm-invoice');
        if (confirmBtn) confirmBtn.addEventListener('click', async () => {
            if (!confirm('¿Confirmar factura y descontar stock? Esta acción actualizará el inventario.')) return;
            try{
                await confirmInvoice(inv.id);
                renderInvoicesManager(area.closest('#admin-panel-area') || area);
            }catch(e){ alert('No se pudo confirmar: ' + (e && e.message ? e.message : String(e))); }
        });

        // Close
        wrap.querySelector('.btn-close-editor').addEventListener('click', () => {
            detailArea.innerHTML = '';
            detailArea.dataset.openId = '';
        });

        renderItems();
        recalcTotals();
    }

    // ─── Sales / Ventas Dashboard ─────────────────────────────────────────────
    async function renderAdminSalesPanel(area){
        if (!area) return;
        area.innerHTML = `
            <div class="admin-card" style="padding:18px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:18px">
                    <h3 style="margin:0">📊 Dashboard de Ventas</h3>
                    <button id="ventas-refresh" class="btn-outline small">↺ Actualizar</button>
                </div>
                <div id="ventas-loading" style="color:var(--muted);padding:24px 0;text-align:center">Cargando datos...</div>
                <div id="ventas-content" style="display:none">
                    <!-- KPI row -->
                    <div id="ventas-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:22px"></div>
                    <!-- Period selector -->
                    <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
                        <span style="font-size:0.85rem;color:var(--muted);font-weight:600">Período:</span>
                        <button class="period-btn btn-outline small" data-period="7" style="font-size:0.78rem">7 días</button>
                        <button class="period-btn btn-outline small active" data-period="30" style="font-size:0.78rem">30 días</button>
                        <button class="period-btn btn-outline small" data-period="90" style="font-size:0.78rem">90 días</button>
                        <button class="period-btn btn-outline small" data-period="365" style="font-size:0.78rem">12 meses</button>
                    </div>
                    <!-- Charts row -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
                        <div style="background:#fafafa;border:1px solid rgba(0,0,0,0.07);border-radius:12px;padding:14px">
                            <div style="font-weight:700;font-size:0.88rem;margin-bottom:10px;color:var(--ink)">Ventas diarias (COP)</div>
                            <canvas id="chart-daily" height="160"></canvas>
                        </div>
                        <div style="background:#fafafa;border:1px solid rgba(0,0,0,0.07);border-radius:12px;padding:14px">
                            <div style="font-weight:700;font-size:0.88rem;margin-bottom:10px;color:var(--ink)">Estado de facturas</div>
                            <canvas id="chart-status" height="160"></canvas>
                        </div>
                    </div>
                    <!-- Top products -->
                    <div style="background:#fafafa;border:1px solid rgba(0,0,0,0.07);border-radius:12px;padding:14px;margin-bottom:20px">
                        <div style="font-weight:700;font-size:0.88rem;margin-bottom:10px;color:var(--ink)">🏆 Productos más vendidos (unidades)</div>
                        <canvas id="chart-products" height="120"></canvas>
                    </div>
                    <!-- Recent confirmed invoices -->
                    <div style="background:#fafafa;border:1px solid rgba(0,0,0,0.07);border-radius:12px;padding:14px">
                        <div style="font-weight:700;font-size:0.88rem;margin-bottom:10px;color:var(--ink)">🧾 Últimas ventas confirmadas</div>
                        <div id="ventas-recent"></div>
                    </div>
                </div>
            </div>`;

        let activePeriod = 30;
        let allInvoices = [];

        // Period button handlers
        area.querySelectorAll('.period-btn').forEach(b => b.addEventListener('click', () => {
            area.querySelectorAll('.period-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            activePeriod = Number(b.dataset.period);
            drawCharts(allInvoices, activePeriod);
        }));

        area.querySelector('#ventas-refresh').addEventListener('click', () => loadAndRender());

        async function loadAndRender(){
            const loadingEl = area.querySelector('#ventas-loading');
            const contentEl = area.querySelector('#ventas-content');
            if (loadingEl) loadingEl.style.display = 'block';
            if (contentEl) contentEl.style.display = 'none';
            allInvoices = await loadInvoices();
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
            renderKPIs(allInvoices);
            drawCharts(allInvoices, activePeriod);
            renderRecentSales(allInvoices);
        }

        function renderKPIs(invoices){
            const confirmed = invoices.filter(i => i.status === 'confirmed');
            const pending   = invoices.filter(i => i.status !== 'confirmed');
            const totalRevenue = confirmed.reduce((s,i) => s + (Number(i.total) || Number(i.subtotal) || 0), 0);
            const avgTicket = confirmed.length ? Math.round(totalRevenue / confirmed.length) : 0;
            // units sold
            const unitsSold = confirmed.reduce((s,i) => s + (i.items||[]).reduce((a,it) => a + (Number(it.qty)||1), 0), 0);
            // today revenue
            const todayStart = new Date(); todayStart.setHours(0,0,0,0);
            const todayRev = confirmed.filter(i => (i.confirmedAt||i.createdAt||0) >= todayStart.getTime())
                                      .reduce((s,i) => s + (Number(i.total)||Number(i.subtotal)||0), 0);

            const kpis = [
                { label: 'Total Ventas', value: formatCOP(totalRevenue), icon: '💰', color: '#d4edda', text: '#155724' },
                { label: 'Facturas Confirmadas', value: confirmed.length, icon: '✅', color: '#d4edda', text: '#155724' },
                { label: 'Facturas Pendientes', value: pending.length, icon: '⏳', color: '#fff3cd', text: '#856404' },
                { label: 'Ticket Promedio', value: formatCOP(avgTicket), icon: '🎟', color: '#cce5ff', text: '#004085' },
                { label: 'Unidades Vendidas', value: unitsSold, icon: '📦', color: '#e2d9f3', text: '#5a2d91' },
                { label: 'Ventas Hoy', value: formatCOP(todayRev), icon: '📅', color: '#f8d7da', text: '#721c24' },
            ];

            const kpiArea = area.querySelector('#ventas-kpis');
            kpiArea.innerHTML = kpis.map(k => `
                <div style="background:${k.color};border-radius:12px;padding:14px 12px;text-align:center">
                    <div style="font-size:1.5rem;margin-bottom:4px">${k.icon}</div>
                    <div style="font-size:1.1rem;font-weight:800;color:${k.text}">${k.value}</div>
                    <div style="font-size:0.76rem;color:${k.text};opacity:0.85;margin-top:2px">${k.label}</div>
                </div>`).join('');
        }

        async function drawCharts(invoices, periodDays){
            // Load Chart.js dynamically
            if (!window.Chart){
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
                    s.onload = resolve; s.onerror = reject;
                    document.head.appendChild(s);
                });
            }
            const Chart = window.Chart;

            const now = Date.now();
            const cutoff = now - periodDays * 86400000;
            const confirmed = invoices.filter(i => i.status === 'confirmed' && (i.confirmedAt || i.createdAt || 0) >= cutoff);

            // ── Daily chart ──
            const dayMap = {};
            const fmt = d => {
                const dt = new Date(d);
                return periodDays <= 30 ? dt.toLocaleDateString('es-CO',{day:'2-digit',month:'short'})
                                        : dt.toLocaleDateString('es-CO',{month:'short',year:'2-digit'});
            };
            // generate labels
            const labels = [];
            for (let d = periodDays - 1; d >= 0; d--){
                const dt = new Date(now - d * 86400000);
                const key = periodDays <= 90 ? dt.toDateString() : (dt.getFullYear() + '-' + dt.getMonth());
                if (!dayMap[key]) { dayMap[key] = 0; labels.push({ key, label: fmt(dt.getTime()) }); }
            }
            confirmed.forEach(inv => {
                const ts = inv.confirmedAt || inv.createdAt || 0;
                const dt = new Date(ts);
                const key = periodDays <= 90 ? dt.toDateString() : (dt.getFullYear() + '-' + dt.getMonth());
                if (dayMap[key] !== undefined) dayMap[key] += Number(inv.total || inv.subtotal || 0);
            });

            const dailyCanvas = area.querySelector('#chart-daily');
            if (dailyCanvas._chartInst) dailyCanvas._chartInst.destroy();
            dailyCanvas._chartInst = new Chart(dailyCanvas, {
                type: 'bar',
                data: {
                    labels: labels.map(l => l.label),
                    datasets: [{ label: 'Ventas COP', data: labels.map(l => dayMap[l.key] || 0),
                        backgroundColor: 'rgba(120,40,80,0.18)', borderColor: 'rgba(120,40,80,0.8)',
                        borderWidth: 1.5, borderRadius: 4 }]
                },
                options: { responsive: true, plugins: { legend: { display: false } },
                    scales: { y: { ticks: { callback: v => '$' + (v/1000).toFixed(0) + 'k' }, grid: { color: 'rgba(0,0,0,0.04)' } },
                              x: { ticks: { font: { size: 10 } }, grid: { display: false } } } }
            });

            // ── Status pie chart ──
            const nConfirmed = invoices.filter(i => i.status === 'confirmed').length;
            const nPending   = invoices.filter(i => i.status === 'pending').length;
            const nOther     = invoices.length - nConfirmed - nPending;
            const statusCanvas = area.querySelector('#chart-status');
            if (statusCanvas._chartInst) statusCanvas._chartInst.destroy();
            statusCanvas._chartInst = new Chart(statusCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['Confirmadas', 'Pendientes', 'Otras'],
                    datasets: [{ data: [nConfirmed, nPending, nOther],
                        backgroundColor: ['rgba(21,87,36,0.8)', 'rgba(133,100,4,0.8)', 'rgba(90,90,90,0.6)'],
                        borderWidth: 2, borderColor: '#fff' }]
                },
                options: { responsive: true, cutout: '60%',
                    plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
            });

            // ── Top products bar chart ──
            const prodMap = {};
            confirmed.forEach(inv => {
                (inv.items || []).forEach(it => {
                    const name = it.name || it.title || '—';
                    prodMap[name] = (prodMap[name] || 0) + (Number(it.qty) || 1);
                });
            });
            const sorted = Object.entries(prodMap).sort((a,b) => b[1]-a[1]).slice(0, 8);
            const prodCanvas = area.querySelector('#chart-products');
            if (prodCanvas._chartInst) prodCanvas._chartInst.destroy();
            if (sorted.length){
                prodCanvas._chartInst = new Chart(prodCanvas, {
                    type: 'bar',
                    data: {
                        labels: sorted.map(([n]) => n.length > 22 ? n.slice(0,22)+'…' : n),
                        datasets: [{ label: 'Unidades', data: sorted.map(([,v]) => v),
                            backgroundColor: sorted.map((_,i) => `hsla(${300 - i*25},55%,45%,0.75)`),
                            borderRadius: 4, borderWidth: 0 }]
                    },
                    options: { indexAxis: 'y', responsive: true,
                        plugins: { legend: { display: false } },
                        scales: { x: { ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.04)' } },
                                  y: { ticks: { font: { size: 11 } }, grid: { display: false } } } }
                });
            } else {
                prodCanvas.style.display = 'none';
                prodCanvas.insertAdjacentHTML('afterend','<p style="color:var(--muted);font-size:0.85rem">Sin ventas en el período.</p>');
            }
        }

        function renderRecentSales(invoices){
            const confirmed = invoices.filter(i => i.status === 'confirmed')
                                      .sort((a,b) => (b.confirmedAt||b.createdAt||0) - (a.confirmedAt||a.createdAt||0))
                                      .slice(0, 10);
            const el = area.querySelector('#ventas-recent');
            if (!el) return;
            if (!confirmed.length){
                el.innerHTML = '<p style="color:var(--muted);font-size:0.85rem">No hay ventas confirmadas aún.</p>';
                return;
            }
            el.innerHTML = `
                <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
                    <thead>
                        <tr style="border-bottom:2px solid rgba(0,0,0,0.08);color:var(--muted)">
                            <th style="text-align:left;padding:6px 4px;font-weight:600">Factura</th>
                            <th style="text-align:left;padding:6px 4px;font-weight:600">Fecha</th>
                            <th style="text-align:left;padding:6px 4px;font-weight:600">Productos</th>
                            <th style="text-align:right;padding:6px 4px;font-weight:600">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${confirmed.map(inv => {
                            const date = new Date(inv.confirmedAt||inv.createdAt||Date.now()).toLocaleString('es-CO',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'});
                            const items = (inv.items||[]).map(it => `${escapeHtml(it.name||'')} ×${it.qty||1}`).join(', ');
                            return `<tr style="border-bottom:1px solid rgba(0,0,0,0.04)">
                                <td style="padding:7px 4px;font-weight:600;color:var(--wine-700)">${escapeHtml(inv.id||'')}</td>
                                <td style="padding:7px 4px;color:var(--muted)">${date}</td>
                                <td style="padding:7px 4px;color:var(--ink);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(items)}</td>
                                <td style="padding:7px 4px;text-align:right;font-weight:700;color:var(--wine-700)">${formatCOP(inv.total||inv.subtotal||0)}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>`;
        }

        loadAndRender();
    }

    async function confirmInvoice(id){
        const errors = [];
        // Try API confirmation (server will handle stock update)
        try{
            const base = getApiBase();
            if (base){
                const url = base.replace(/\/$/, '') + '/api/invoices/' + id + '/confirm';
                let r = null;
                try{
                    r = await fetch(url, { method: 'POST' });
                }catch(fetchErr){
                    errors.push('API fetch error: ' + (fetchErr && fetchErr.message ? fetchErr.message : String(fetchErr)));
                    r = null;
                }
                if (r){
                    if (r.ok){
                        const data = await r.json();
                        // refresh products from API if possible
                        try{ const r2 = await fetch(base.replace(/\/$/, '') + '/api/products'); if (r2.ok){ DJ_PRODUCTS_DATA = await r2.json(); renderProducts(); renderAllProducts(); renderBestSellersWidget(); try{ connectPromoSlidesToProducts(); }catch(e){} } }catch(e){}
                        alert('Factura confirmada. Stocks actualizados.');
                        return data;
                    } else {
                        let bodyText = '';
                        try{ bodyText = await r.text(); }catch(e){ bodyText = String(e); }
                        errors.push('API: ' + r.status + ' ' + r.statusText + ' - ' + bodyText);
                    }
                }
            }
        }catch(e){ errors.push('API unexpected error: ' + (e && e.message ? e.message : String(e))); }

        // Firestore: confirm invoice and decrement product stock
        try{
            const ok = await (window.waitForFirestore ? window.waitForFirestore(3000) : Promise.resolve(false));
            if (ok && window.__FIRESTORE_DB__){
                const db = window.__FIRESTORE_DB__;
                const invDoc = await db.collection('invoices').doc(id).get();
                if (invDoc.exists){
                    const inv = { id: invDoc.id, ...invDoc.data() };
                    if (inv.status === 'confirmed') throw new Error('Esta factura ya fue confirmada.');
                    // Read current stock for each item first
                    const stockUpdates = [];
                    for (const it of (inv.items || [])){
                        if (!it.id || !(Number(it.qty) > 0)) continue;
                        try{
                            const prodDoc = await db.collection('products').doc(it.id).get();
                            if (prodDoc.exists){
                                const currentStock = Number(prodDoc.data().stock || 0);
                                stockUpdates.push({ ref: prodDoc.ref, newStock: Math.max(0, currentStock - Number(it.qty)) });
                            }
                        }catch(prodErr){ console.warn('Could not read product stock for', it.id, prodErr); }
                    }
                    // Write all changes in a batch
                    const batch = db.batch();
                    stockUpdates.forEach(u => batch.update(u.ref, { stock: u.newStock }));
                    batch.update(db.collection('invoices').doc(id), { status: 'confirmed', confirmedAt: Date.now() });
                    await batch.commit();
                    // Sync DJ_PRODUCTS_DATA in memory
                    stockUpdates.forEach(u => {
                        const pidx = (DJ_PRODUCTS_DATA || []).findIndex(p => p.id === u.ref.id);
                        if (pidx !== -1) DJ_PRODUCTS_DATA[pidx].stock = u.newStock;
                    });
                    renderProducts(); renderAllProducts(); renderBestSellersWidget();
                    alert('Factura confirmada. Stocks actualizados.');
                    return { status: 'confirmed', id };
                } else {
                    errors.push('Firestore: factura no encontrada');
                }
            }
        }catch(e){ errors.push('Firestore error: ' + (e && e.message ? e.message : String(e))); }

        // Fallback: localStorage adjustments
        try{
            const raw = localStorage.getItem('dj_invoices') || '[]';
            const arr = JSON.parse(raw || '[]');
            const idx = arr.findIndex(i => i.id === id);
            if (idx !== -1){
                const inv = arr[idx];
                (inv.items || []).forEach(it => {
                    const pidx = (DJ_PRODUCTS_DATA || []).findIndex(p => p.id === it.id || (p.title||p.name) === it.name);
                    if (pidx !== -1){
                        DJ_PRODUCTS_DATA[pidx].stock = Math.max(0, Number(DJ_PRODUCTS_DATA[pidx].stock || 0) - Number(it.qty || 0));
                    }
                });
                inv.status = 'confirmed';
                inv.confirmedAt = Date.now();
                arr[idx] = inv;
                localStorage.setItem('dj_invoices', JSON.stringify(arr));
                // save updated products to localStorage for fallback visibility
                try{ localStorage.setItem('dj_local_products', JSON.stringify(DJ_PRODUCTS_DATA)); }catch(e){}
                alert('Factura confirmada (local). Stocks actualizados en localStorage.');
                renderProducts();
                return inv;
            } else {
                errors.push('localStorage: invoice not found');
            }
        }catch(e){ errors.push('localStorage error: ' + (e && e.message ? e.message : String(e))); }

        throw new Error(errors.join(' | '));
    }

    (async function initRepoProducts(){
        populateCategorySelects();

        // Note: admin-only offers UI is available from the admin panel (admin.html)
        // and not injected into the public 'ofertas.html' page.

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
                    renderRecentProducts();
                    renderAllProducts();
                    tryRenderProductDetail();
                    startLiveSalesSimulation();
                    try{ connectPromoSlidesToProducts(); }catch(e){}
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
        renderRecentProducts();
        renderAllProducts();
        tryRenderProductDetail();
        startLiveSalesSimulation();
                try{ connectPromoSlidesToProducts(); }catch(e){}
    })();

    // Admin: abrir gestores desde el panel (botones en admin.html/index.html)
    try{
        const path = window.location.pathname.split('/').pop();
        if (path === 'admin.html' || window.location.pathname.indexOf('/admin') !== -1){
            const offersBtn = document.getElementById('admin-offers-btn');
            const invBtn = document.getElementById('admin-invoices-btn');
            const productsBtn = document.getElementById('admin-products-btn');
            const ventasBtn = document.getElementById('admin-ventas-btn');
            const staffBtn = document.getElementById('admin-staff-btn');
            const adminPanel = document.getElementById('admin-panel-area');
            const actionBtns = Array.from(document.querySelectorAll('.admin-action-btn')) || [];

            function setAdminActive(selected){
                actionBtns.forEach(b => {
                    b.classList.remove('active');
                    b.classList.remove('primary');
                    b.classList.add('ghost');
                });
                if (selected && selected.classList) {
                    selected.classList.remove('ghost');
                    selected.classList.add('active');
                }
            }
            function clearAdminPanel(){ if (adminPanel) adminPanel.innerHTML = ''; }

            // Productos
            if (productsBtn){
                productsBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    setAdminActive(productsBtn);
                    clearAdminPanel();
                    renderAdminProductsPanel(adminPanel);
                    try{ adminPanel.scrollIntoView({ behavior: 'smooth' }); }catch(e){}
                });
            }

            // Ofertas -> render inside unified adminPanel
            if (offersBtn && adminPanel){
                offersBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (!sessionStorage.getItem('admin_authed')){
                        const pass = prompt('Contraseña de administrador (demo):');
                        if (pass !== 'admin123'){ alert('Acceso denegado. Ingresa la contraseña en el panel.'); return; }
                        sessionStorage.setItem('admin_authed','1');
                    }
                    adminOffersActive = true;
                    setAdminActive(offersBtn);
                    clearAdminPanel();
                    adminPanel.innerHTML = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input id="product-search-input" class="search-box" placeholder="Buscar productos..." style="flex:1" /><button id="categories-btn" class="btn-outline">Categorias</button><div id="active-filter-label" style="margin-left:8px;color:var(--muted)"></div></div><div class="grid-container"></div>`;
                    attachSearchCategoriesHandlers && attachSearchCategoriesHandlers();
                    createCategoryFilterUI();
                    renderProducts();
                    adminPanel.scrollIntoView({ behavior: 'smooth' });
                });
            }

            // Facturas -> render inside unified adminPanel
            if (invBtn && adminPanel){
                invBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (!sessionStorage.getItem('admin_authed')){
                        const pass = prompt('Contraseña de administrador (demo):');
                        if (pass !== 'admin123'){ alert('Acceso denegado. Ingresa la contraseña en el panel.'); return; }
                        sessionStorage.setItem('admin_authed','1');
                    }
                    adminOffersActive = false;
                    setAdminActive(invBtn);
                    clearAdminPanel();
                    renderInvoicesManager(adminPanel);
                    adminPanel.scrollIntoView({ behavior: 'smooth' });
                });
            }

            // Ventas → dashboard de facturación
            if (ventasBtn && adminPanel){
                ventasBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    setAdminActive(ventasBtn);
                    clearAdminPanel();
                    renderAdminSalesPanel(adminPanel);
                    try{ adminPanel.scrollIntoView({ behavior: 'smooth' }); }catch(e){}
                });
            }

            // Staff
            if (staffBtn && adminPanel){
                staffBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    setAdminActive(staffBtn);
                    clearAdminPanel();
                    renderAdminStaffPanel(adminPanel);
                    try{ adminPanel.scrollIntoView({ behavior: 'smooth' }); }catch(e){}
                });
            }
        }
    }catch(e){ /* ignore admin UI attach errors */ }

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
        // normalize
        try{ item.qty = Math.max(1, Number(item.qty) || 1); }catch(e){ item.qty = 1; }
        item.price = Number(item.price) || 0;
        cart.push(item);
        saveCart();
        updateCartDisplay();
        // Visual feedback: pop the cart button and show a toast
        popCartButton();
        showAddToCartToast(item.name || 'Producto', item.qty || 1);
        // open cart panel with smooth animation
        showCartTemporarily();
    }

    function removeItemFromCart(index) {
        cart.splice(index, 1);
        saveCart();
        updateCartDisplay();
    }

    function cartTotal() {
        return cart.reduce((s, it) => s + ((Number(it.price) || 0) * (Number(it.qty) || 1)), 0);
    }

    function updateCartDisplay() {
        if (!cartPanel) return; // page without cart UI
        const totalUnits = cart.reduce((s, it) => s + (Number(it.qty) || 1), 0);
        if (cartCountEl) cartCountEl.innerText = totalUnits;
        cartItemsContainer.innerHTML = '';
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="cart-empty" style="color:#666">Tu carrito está vacío.</p>';
        } else {
            cart.forEach((it, idx) => {
                const qty = Number(it.qty) || 1;
                const subtotal = (Number(it.price) || 0) * qty;
                // try to find product image from repo data
                const prodMatch = (DJ_PRODUCTS_DATA || []).find(p => (p.title||p.name) === it.name) || {};
                const imgSrc = escapeHtml(it.image || prodMatch.image || 'https://placehold.co/80x80/ddd/000?text=img');
                const div = document.createElement('div');
                div.className = 'cart-item';
                div.innerHTML = `
                    <img src="${imgSrc}" alt="${escapeHtml(it.name)}" class="cart-item-img" />
                    <div class="cart-item-info">
                        <strong>${escapeHtml(it.name)}</strong>
                        <div class="cart-item-meta">
                            <span class="cart-item-price">${formatCOP(it.price)}${qty>1? ' ×'+qty + ' = ' + formatCOP(subtotal) : ''}</span>
                            <div class="qty-controls">
                                <button class="qty-btn" data-idx="${idx}" data-op="dec">−</button>
                                <input class="qty-input" data-idx="${idx}" type="number" min="1" value="${qty}" />
                                <button class="qty-btn" data-idx="${idx}" data-op="inc">+</button>
                            </div>
                        </div>
                    </div>
                    <button data-idx="${idx}" class="btn-remove icon" aria-label="Eliminar item">✕</button>
                `;
                cartItemsContainer.appendChild(div);
            });
        }
        // compute subtotal and apply coupon if active
        const subtotal = cartTotal();
        const activeCoupon = getActiveCoupon();
        let couponDiscount = 0;
        const minTotal = activeCoupon ? (Number(activeCoupon.minTotal) || 0) : 0;
        if (activeCoupon && subtotal >= minTotal){
            couponDiscount = Math.round(subtotal * (Number(activeCoupon.discountPercent) || 0) / 100);
        }
        // ensure cart discount display exists
        try{
            const footer = cartPanel.querySelector('.cart-footer');
            if (footer){
                let discountRow = footer.querySelector('#cart-discount');
                if (!discountRow){
                    discountRow = document.createElement('div');
                    discountRow.id = 'cart-discount';
                    discountRow.style.fontSize = '0.95rem';
                    discountRow.style.color = 'var(--muted)';
                    discountRow.style.display = 'none';
                    footer.insertBefore(discountRow, footer.firstChild);
                }
                if (activeCoupon){
                    if (couponDiscount > 0){
                        discountRow.style.display = '';
                        discountRow.innerHTML = `Cupón <strong>${escapeHtml(activeCoupon.code)}</strong> aplicado: -${formatCOP(couponDiscount)} <button id="remove-coupon-btn" class="btn-outline small" style="margin-left:8px">Quitar cupón</button>`;
                        const btn = discountRow.querySelector('#remove-coupon-btn');
                        if (btn) btn.addEventListener('click', (e)=>{ e.preventDefault(); removeCoupon(); });
                    } else {
                        discountRow.style.display = '';
                        discountRow.innerHTML = `Cupón <strong>${escapeHtml(activeCoupon.code)}</strong> tomado — válido para compras mayores a ${formatCOP(activeCoupon.minTotal)}. <button id="remove-coupon-btn" class="btn-outline small" style="margin-left:8px">Quitar</button>`;
                        const btn = discountRow.querySelector('#remove-coupon-btn');
                        if (btn) btn.addEventListener('click', (e)=>{ e.preventDefault(); removeCoupon(); });
                    }
                } else {
                    discountRow.style.display = 'none';
                    discountRow.innerHTML = '';
                }
            }
        }catch(e){ /* ignore UI errors */ }

        const finalTotal = Math.max(0, subtotal - (couponDiscount || 0));
        cartTotalEl.innerText = formatCOP(finalTotal);

        // attach handlers for qty controls and remove buttons
        cartItemsContainer.querySelectorAll('.qty-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = Number(btn.dataset.idx);
            const op = btn.dataset.op;
            if (!cart[idx]) return;
            if (op === 'inc') cart[idx].qty = (Number(cart[idx].qty) || 1) + 1;
            else cart[idx].qty = Math.max(1, (Number(cart[idx].qty) || 1) - 1);
            saveCart();
            updateCartDisplay();
        }));

        cartItemsContainer.querySelectorAll('.qty-input').forEach(inp => inp.addEventListener('change', (e) => {
            const idx = Number(inp.dataset.idx);
            if (!cart[idx]) return;
            cart[idx].qty = Math.max(1, Number(inp.value) || 1);
            saveCart();
            updateCartDisplay();
        }));

        cartItemsContainer.querySelectorAll('.btn-remove').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.idx, 10);
            removeItemFromCart(idx);
        }));
    }

    function showCartTemporarily() {
        if (!cartPanel) return;
        cartPanel.classList.add('show');
        if (cartPanel.setAttribute) cartPanel.setAttribute('aria-hidden', 'false');
        // ensure keyboard focus lands on close button for accessibility
        try { if (cartClose) cartClose.focus(); } catch(e){}
    }

    // Small animation on the floating cart button to draw attention
    function popCartButton(){
        try{
            if (!cartButton) return;
            cartButton.classList.add('pop');
            setTimeout(()=>{ cartButton.classList.remove('pop'); }, 360);
        }catch(e){ /* ignore */ }
    }

    // Toast feedback when adding an item to the cart
    function showAddToCartToast(name, qty){
        try{
            const t = document.createElement('div');
            t.className = 'cart-toast';
            const qtyText = (qty && Number(qty) > 1) ? ` <span style="opacity:0.9">(x${Number(qty)})</span>` : '';
            t.innerHTML = `<div class="toast-inner">✔ Añadido: <strong>${escapeHtml(name)}</strong>${qtyText}</div>`;
            document.body.appendChild(t);
            // animate in
            requestAnimationFrame(()=> t.classList.add('show'));
            // remove after delay
            setTimeout(()=>{
                t.classList.remove('show');
                setTimeout(()=>{ try{ t.remove(); }catch(e){} }, 260);
            }, 1700);
        }catch(e){ console.warn('Toast error', e); }
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

    // Checkout: generar factura y abrir WhatsApp con lista de productos y total
    checkoutBtn && checkoutBtn.addEventListener('click', async () => {
        if (cart.length === 0) {
            alert('Tu carrito está vacío.');
            return;
        }
        // create invoice and persist (Firestore -> API -> localStorage)
        const invoice = createInvoiceFromCart();
        let saved = null;
        try{
            saved = await persistInvoice(invoice);
            try{ alert('Factura generada: ' + (saved.id || invoice.id)); }catch(e){}
        }catch(e){ console.warn('No se pudo guardar la factura:', e); saved = invoice; }

        // clear cart after generating invoice
        cart = [];
        saveCart();
        updateCartDisplay();

        const lines = (saved.items || []).map(it => {
            const qty = Number(it.qty) || 1;
            const unit = formatCOP(it.unitPrice || it.price || 0);
            const subtotal = formatCOP((Number(it.unitPrice || it.price) || 0) * qty);
            return qty > 1 ? `- ${it.name} x${qty} (${unit}) — ${subtotal}` : `- ${it.name} (${unit})`;
        });
        const total = formatCOP(saved.total || saved.subtotal || 0 || cartTotal());
        const plainMsg = `Hola D&J Beauty Studio 🌸\n\nYa tengo mi carrito listo y quiero generar mi factura para concretar la compra.\n\n🧾 Factura: ${saved.id || invoice.id}\n📦 Productos:\n${lines.join('\n')}\n\n💰 Total: ${total}\n\n¿Podemos coordinar el pago y el envío? ¡Gracias! 💖`;
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
    function attachSearchCategoriesHandlers(){
        const searchInput = document.getElementById('product-search-input');
        const categoriesBtn = document.getElementById('categories-btn');

        function debounce(fn, wait = 250){
            let t;
            return function(...args){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,args), wait); };
        }

        if (searchInput){
            // avoid duplicate handlers by cloning node
            try{ searchInput.removeEventListener && searchInput.removeEventListener('input', null); }catch(e){}
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
    }

    // Attach handlers to any present search/categories controls on load
    // Initialize promo slider for homepage banners
    function initPromoSlider(){
        try{
            const slider = document.getElementById('promo-slider');
            if (!slider) return;
            const slides = Array.from(slider.querySelectorAll('.promo-slide'));
            if (!slides.length) return;
            // create dots
            const dots = document.createElement('div'); dots.className = 'dots';
            slides.forEach((s, i) =>{
                if (i === 0) s.classList.add('active'); else s.classList.remove('active');
                const d = document.createElement('button'); d.className = 'dot' + (i===0? ' active':'' ); d.type = 'button';
                d.addEventListener('click', ()=>{ goTo(i); });
                dots.appendChild(d);
            });
            slider.appendChild(dots);
            let cur = 0; let timer = null;
            function goTo(n){
                if (n === cur) return;
                slides[cur].classList.remove('active');
                dots.children[cur].classList.remove('active');
                cur = n;
                slides[cur].classList.add('active');
                dots.children[cur].classList.add('active');
            }
            function next(){ goTo((cur + 1) % slides.length); }
            function reset(){ if (timer) clearInterval(timer); if (slides.length>1) timer = setInterval(next, 4200); }
            reset();
            // pause on hover
            slider.addEventListener('mouseenter', ()=> { if (timer) clearInterval(timer); });
            slider.addEventListener('mouseleave', ()=> { reset(); });
        }catch(e){ console.warn('promo slider init failed', e); }
    }

        // Connect promo slides to products when product data is available
        function connectPromoSlidesToProducts(){
            try{
                const slider = document.getElementById('promo-slider');
                if (!slider) return;
                const slides = Array.from(slider.querySelectorAll('a.promo-slide'));
                const products = DJ_PRODUCTS_DATA || [];
                if (!products.length) return;

                const normalize = (s='') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_]/g,' ').replace(/\s+/g,' ').trim();

                slides.forEach(a => {
                    const img = a.querySelector('img');
                    if (!img) return;
                    const src = img.getAttribute('src') || '';
                    const basename = src.split('/').pop() || '';
                    const nameNoExt = basename.replace(/\.[^/.]+$/, '');
                    const targetKey = normalize(nameNoExt);

                    let found = products.find(p => {
                        try{
                            const pimg = normalize((p.image || ''));
                            if (pimg && pimg.indexOf(targetKey) !== -1) return true;
                            const ptitle = normalize(p.title || p.name || '');
                            if (ptitle && ptitle.indexOf(targetKey) !== -1) return true;
                            // also try without the word 'banner' or 'bann' prefixes
                            const cleaned = targetKey.replace(/^banner\s*/,'').replace(/^bann\s*/,'');
                            if (cleaned && (pimg.indexOf(cleaned) !== -1 || ptitle.indexOf(cleaned) !== -1)) return true;
                        }catch(e){ /* ignore */ }
                        return false;
                    });

                    if (found){
                        const link = found.id ? `product.html?id=${encodeURIComponent(found.id)}` : `product.html?title=${encodeURIComponent(found.title||found.name||'')}`;
                        a.setAttribute('href', link);
                        a.setAttribute('aria-label', 'Ver producto: ' + (found.title || found.name || ''));
                        a.dataset.productId = found.id || (found.title || found.name || '');
                        try{ img.setAttribute('alt', (found.title || found.name || '') + ' — ' + (img.getAttribute('alt')||'')); }catch(e){}
                    }
                });
            }catch(e){ console.warn('connectPromoSlidesToProducts failed', e); }
        }

    // Auto-scroll for horizontal scrollers (advance one product at a time, infinite loop)
    function initHorizontalAutoScroll(containerOrSelector, opts = {}){
        try{
            const interval = Number(opts.interval) || 2800; // ms between advances
            const duration = Number(opts.duration) || 450; // ms animation time
            let container = null;
            if (!containerOrSelector) return;
            if (typeof containerOrSelector === 'string'){
                container = document.getElementById(containerOrSelector) || document.querySelector(containerOrSelector);
            } else if (containerOrSelector instanceof Element){
                container = containerOrSelector;
            } else { return; }
            if (!container) return;

            // Cleanup previous instance if any
            if (container._bestScrollCleanup){ try{ container._bestScrollCleanup(); }catch(e){} }

            // collect original item nodes (ignore existing clones)
            const originals = Array.from(container.children).filter(n => n && n.nodeType === 1);
            if (!originals.length || originals.length <= 1) return;

            // disable scroll-snap while auto-driving
            const origSnap = container.style.scrollSnapType || '';
            container.style.scrollSnapType = 'none';

            // append clones of original items to enable seamless looping
            const clones = originals.map(n => n.cloneNode(true));
            clones.forEach(c => container.appendChild(c));
            container._hscrollClones = clones;

            // reattach buy handlers on clones so buttons work
            try{
                clones.forEach(cl => {
                    cl.querySelectorAll && cl.querySelectorAll('.buy-now').forEach(b => {
                        b.addEventListener('click', (e) => {
                            e.preventDefault();
                            const title = b.dataset.title || b.getAttribute('data-title') || '';
                            const price = Number(b.dataset.price || b.getAttribute('data-price') || 0) || 0;
                            try{ addItemToCart({ name: title, price }); }catch(err){ console.warn('add to cart failed', err); }
                        });
                    });
                });
            }catch(e){}

            // layout measurements
            let gap = 0;
            let itemWidths = [];
            let itemOffsets = [];
            let origTotal = 0;

            function computeLayout(){
                try{ gap = parseFloat(getComputedStyle(container).gap || getComputedStyle(container).columnGap || '0') || 0; }catch(e){ gap = 0; }
                itemWidths = originals.map(el => Math.round(el.getBoundingClientRect().width));
                itemOffsets = [];
                let acc = 0;
                for (let i = 0; i < itemWidths.length; i++){
                    itemOffsets.push(acc);
                    acc += itemWidths[i];
                    if (i < itemWidths.length - 1) acc += gap;
                }
                origTotal = Math.max(1, acc);
            }

            computeLayout();
            // recalc when images load
            const imgs = Array.from(container.querySelectorAll('img'));
            let pending = imgs.length;
            if (pending === 0) computeLayout();
            else {
                imgs.forEach(img => {
                    if (img.complete) pending--; else img.addEventListener('load', ()=>{ pending--; if (pending<=0) computeLayout(); }, { once:true });
                });
                setTimeout(computeLayout, 400);
            }

            // animation state
            let currentIndex = 0;
            let autoTimer = null;
            let rafId = null;
            let paused = false;
            let resumeTimeout = null;
            let animating = false;
            let scrollTick = null;

            function easeInOutQuad(t){ return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t; }

            function smoothScrollTo(target){
                if (rafId) cancelAnimationFrame(rafId);
                return new Promise((resolve) => {
                    const start = container.scrollLeft;
                    const change = target - start;
                    const startTime = performance.now();
                    function animate(now){
                        const t = Math.min(1, (now - startTime) / duration);
                        const eased = easeInOutQuad(t);
                        container.scrollLeft = start + change * eased;
                        if (t < 1) rafId = requestAnimationFrame(animate);
                        else {
                            rafId = null;
                            if (container.scrollLeft >= origTotal) container.scrollLeft -= origTotal;
                            resolve();
                        }
                    }
                    rafId = requestAnimationFrame(animate);
                });
            }

            function computeTargetForIndex(index){
                const loops = Math.floor(index / originals.length);
                const idx = index % originals.length;
                return (itemOffsets[idx] || 0) + (loops * origTotal);
            }

            function advance(){
                if (paused || animating) return;
                animating = true;
                currentIndex++;
                const target = computeTargetForIndex(currentIndex);
                smoothScrollTo(target).then(()=>{ animating = false; });
            }

            function startAuto(){ if (autoTimer) clearInterval(autoTimer); autoTimer = setInterval(advance, interval); }
            function stopAuto(){ if (autoTimer) clearInterval(autoTimer); autoTimer = null; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

            function pauseTemporary(ms = 3500){ paused = true; if (resumeTimeout) clearTimeout(resumeTimeout); resumeTimeout = setTimeout(()=>{ paused = false; resumeTimeout = null; }, ms); }
            function pauseNow(){ paused = true; if (resumeTimeout){ clearTimeout(resumeTimeout); resumeTimeout = null; } }
            function resumeNow(){ paused = false; }

            // event handlers
            const onEnter = () => pauseNow();
            const onLeave = () => resumeNow();
            const onUserInteract = () => pauseTemporary(opts.pauseAfterInteract || 3500);
            const onScroll = () => {
                if (animating) return;
                if (scrollTick) clearTimeout(scrollTick);
                scrollTick = setTimeout(()=>{
                    const pos = container.scrollLeft % origTotal;
                    let nearest = 0; let best = Infinity;
                    for (let i = 0; i < itemOffsets.length; i++){
                        const d = Math.abs(pos - itemOffsets[i]);
                        if (d < best){ best = d; nearest = i; }
                    }
                    currentIndex = nearest;
                }, 120);
            };

            const onResize = () => { computeLayout(); };

            container.addEventListener('mouseenter', onEnter);
            container.addEventListener('mouseleave', onLeave);
            container.addEventListener('pointerdown', onUserInteract, { passive: true });
            container.addEventListener('touchstart', onUserInteract, { passive: true });
            container.addEventListener('wheel', onUserInteract, { passive: true });
            container.addEventListener('scroll', onScroll);
            window.addEventListener('resize', onResize);

            container._bestScrollCleanup = function(){
                stopAuto();
                try{ container.removeEventListener('mouseenter', onEnter); }catch(e){}
                try{ container.removeEventListener('mouseleave', onLeave); }catch(e){}
                try{ container.removeEventListener('pointerdown', onUserInteract); }catch(e){}
                try{ container.removeEventListener('touchstart', onUserInteract); }catch(e){}
                try{ container.removeEventListener('wheel', onUserInteract); }catch(e){}
                try{ container.removeEventListener('scroll', onScroll); }catch(e){}
                try{ window.removeEventListener('resize', onResize); }catch(e){}
                if (resumeTimeout) { clearTimeout(resumeTimeout); resumeTimeout = null; }
                // remove clones
                try{ if (container._hscrollClones){ container._hscrollClones.forEach(c=> c.remove()); delete container._hscrollClones; } }catch(e){}
                // restore scroll-snap
                try{ container.style.scrollSnapType = origSnap || ''; }catch(e){}
                container._bestScrollCleanup = null;
            };

            // start from beginning and auto-advance
            try{ container.scrollLeft = 0; }catch(e){}
            startAuto();
        }catch(e){ console.warn('initHorizontalAutoScroll error', e); }
    }

    attachSearchCategoriesHandlers();
    initPromoSlider();
});

// Global dynamic promo bar: replace the top `.promo-bar` on any page
function initGlobalPromoBar(){
    try{
        const phraseTemplates = {
            'labios': [
                '{title} — labios irresistibles que hablan por ti.',
                'Atrévete con {title}: color y confianza todo el día.',
                '{title}: pinta tu mejor versión ahora.',
                'Luce radiante con {title} y sonríe sin miedo.'
            ],
            'piel': [
                '{title} — glow inmediato, piel que inspira.',
                'Renueva tu rutina con {title} y siente la diferencia.',
                '{title}: hidratación y luminosidad en cada aplicación.',
                'Descubre la textura de {title} y presume piel sana.'
            ],
            'ojos': [
                '{title} — mirada que atrapa todas las miradas.',
                'Destaca tu mirada con {title} y sorprende.',
                '{title}: color intenso para looks memorables.',
                'Dale a tus ojos poder con {title}.'
            ],
            'brochas': [
                '{title} — herramientas pro para resultados perfectos.',
                'Eleva tu técnica con {title}.',
                '{title}: precisión y acabado profesional.',
                'Acaba tu look con {title} y marca la diferencia.'
            ],
            'serum': [
                '{title} — cuidado que transforma la piel.',
                'Dale a tu piel el amor que merece con {title}.',
                '{title}: potencia tu rutina con resultados visibles.',
                'Nutre, repara y revela con {title}.'
            ],
            'paleta': [
                '{title} — combina y crea looks infinitos.',
                'Versatilidad y color con {title}.',
                '{title}: tu aliado para maquillajes de impacto.',
                'Crea, mezcla y brilla con {title}.'
            ],
            'brillo': [
                '{title} — destellos que suman confianza.',
                'Un toque de {title} y listo para brillar.'
            ]
        };

        const generalTemplates = [
            '{title} — tu nuevo must-have para cada día.',
            'Haz que te pregunten por tu look: {title}.',
            'Brilla con confianza: prueba {title} hoy.',
            'Transforma tu rutina con {title} y siéntete increíble.',
            '{title}: estilo, color y actitud en un solo paso.',
            'Suma un toque de magia con {title}.',
            'Pequeños detalles, grandes cambios — prueba {title}.',
            'Atrévete a cambiar: {title} te acompaña.',
            'Vuelve cada día un poco más tú con {title}.',
            'Descubre por qué todos hablan de {title}.'
        ];

        function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

        function findOrCreateBar(){
            let bar = document.querySelector('.promo-bar');
            if (!bar){
                bar = document.createElement('div');
                bar.className = 'promo-bar';
                document.body.insertBefore(bar, document.body.firstChild);
            }
            bar.setAttribute('aria-live','polite');
            let msgEl = bar.querySelector('.promo-message');
            if (!msgEl){
                msgEl = document.createElement('span');
                msgEl.className = 'promo-message';
                msgEl.style.display = 'inline-block';
                msgEl.style.opacity = 0;
                msgEl.style.transition = 'opacity .35s ease';
                msgEl.style.textTransform = 'none';
                bar.innerHTML = '';
                bar.appendChild(msgEl);
            }
            return { bar, msgEl };
        }

        function getProductsFromSource(){
            if (Array.isArray(window.DJ_PRODUCTS_DATA) && window.DJ_PRODUCTS_DATA.length){
                return window.DJ_PRODUCTS_DATA.map(p => ({ title: p.title || p.name || 'Producto', href: p.id ? 'product.html?id=' + encodeURIComponent(p.id) : 'product.html', eyebrow: p.eyebrow || '' }));
            }
            const cards = Array.from(document.querySelectorAll('.grid-container .card'));
            const products = cards.map(card => {
                const a = card.querySelector('h3 a') || card.querySelector('h3');
                const eyebrowEl = card.querySelector('.eyebrow');
                const title = a ? (a.textContent || a.innerText || '').trim() : 'Producto';
                const href = (a && a.getAttribute) ? (a.getAttribute('href') || 'product.html') : 'product.html';
                const eyebrow = eyebrowEl ? eyebrowEl.textContent.trim() : '';
                return { title, href, eyebrow };
            }).filter(p => p.title);
            if (products.length) return products;
            return [
                { title: 'Labial Lip Crush Velvet', href: 'product.html', eyebrow: 'Labios' },
                { title: 'Serum Glass Skin 24h', href: 'product.html', eyebrow: 'Piel Glow' },
                { title: 'Paleta Nude Attraction', href: 'product.html', eyebrow: 'Ojos' },
                { title: 'Brillo Labial Shine', href: 'product.html', eyebrow: 'Labios' },
                { title: 'Kit Glow Express', href: 'product.html', eyebrow: 'Piel Glow' }
            ];
        }

        function pickTemplateFor(eyebrow){
            if (!eyebrow) return rand(generalTemplates);
            const key = eyebrow.toLowerCase();
            for (const k in phraseTemplates){ if (key.indexOf(k) !== -1) return rand(phraseTemplates[k]); }
            return rand(generalTemplates);
        }

        function renderMessageFor(prod, msgEl){
            if (!prod) return;
            const tpl = pickTemplateFor(prod.eyebrow || '');
            const text = tpl.replace('{title}', prod.title);
            try{ msgEl.style.opacity = 0; }catch(e){}
            setTimeout(() => {
                msgEl.innerHTML = '';
                const a = document.createElement('a');
                a.href = prod.href || 'product.html';
                a.style.color = 'inherit';
                a.style.textDecoration = 'none';
                a.style.fontWeight = '800';
                a.textContent = text;
                msgEl.appendChild(a);
                try{ msgEl.style.opacity = 1; }catch(e){}
            }, 300);
        }

        function startRotation(bar, msgEl){
            let products = getProductsFromSource();
            renderMessageFor(rand(products), msgEl);
            if (bar.__promoInterval__) clearInterval(bar.__promoInterval__);
            bar.__promoInterval__ = setInterval(() => {
                products = getProductsFromSource();
                renderMessageFor(rand(products), msgEl);
            }, 4200 + Math.floor(Math.random()*1800));
        }

        const { bar, msgEl } = findOrCreateBar();
        let attempts = 0;
        function waitForReady(){
            const list = getProductsFromSource();
            if (list.length || attempts > 40){ startRotation(bar, msgEl); return; }
            attempts++;
            setTimeout(waitForReady, 300);
        }
        waitForReady();

        window.addEventListener('beforeunload', ()=>{ try{ if (bar.__promoInterval__) clearInterval(bar.__promoInterval__); }catch(e){} });

    }catch(e){ console.warn('initGlobalPromoBar failed', e); }
}

// Initialize global promo bar on load
try{ initGlobalPromoBar(); }catch(e){ /* ignore */ }

// User panel: Google Sign-In + customer dashboard + admin gate
function initUserPanelUI(){
    try{
        let btn = document.getElementById('user-panel-btn') || document.querySelector('.user-panel-btn');
        if (!btn){
            btn = document.createElement('button');
            btn.id = 'user-panel-btn';
            btn.className = 'user-panel-btn';
            btn.setAttribute('aria-label','Mi cuenta');
            btn.title = 'Mi cuenta';
            document.body.appendChild(btn);
        }

        function updateUserBtnIcon(){
            const auth = window.__FIRESTORE_AUTH__;
            const u = auth ? auth.currentUser : null;
            const _esc = window.__escapeHtml || function(t){return t||'';};
            if (u && u.photoURL){
                btn.innerHTML = `<img src="${_esc(u.photoURL)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
                btn.style.border = '2px solid #25D366';
            } else {
                btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-3-3.87"></path><path d="M4 21v-2a4 4 0 0 1 3-3.87"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
                btn.style.border = '';
            }
        }
        updateUserBtnIcon();

        // Auth ready promise: resolves when Firebase Auth has settled the session
        window.__AUTH_READY__ = new Promise(function(resolve){
            window.__AUTH_READY_RESOLVE_ = resolve;
        });

        // Check auth state early (without waiting for Firestore)
        (async function watchAuth(){
            try{
                const ok = await (window.waitForFirestore ? window.waitForFirestore(5000) : Promise.resolve(false));
                if (ok && window.__FIRESTORE_AUTH__){
                    window.__FIRESTORE_AUTH__.onAuthStateChanged(function(){
                        updateUserBtnIcon();
                        if (window.__AUTH_READY_RESOLVE_) {
                            window.__AUTH_READY_RESOLVE_();
                            window.__AUTH_READY_RESOLVE_ = null;
                        }
                    });
                    // If user is already set, resolve immediately
                    if (window.__FIRESTORE_AUTH__.currentUser && window.__AUTH_READY_RESOLVE_) {
                        window.__AUTH_READY_RESOLVE_();
                        window.__AUTH_READY_RESOLVE_ = null;
                    }
                } else {
                    if (window.__AUTH_READY_RESOLVE_) {
                        window.__AUTH_READY_RESOLVE_();
                        window.__AUTH_READY_RESOLVE_ = null;
                    }
                }
            }catch(e){
                if (window.__AUTH_READY_RESOLVE_) {
                    window.__AUTH_READY_RESOLVE_();
                    window.__AUTH_READY_RESOLVE_ = null;
                }
            }
        })();

        if (document.querySelector('.user-modal')) return; // already initialized

        const modal = document.createElement('div');
        modal.className = 'user-modal';
        modal.setAttribute('role','dialog');
        modal.setAttribute('aria-modal','true');
        modal.setAttribute('aria-hidden','true');
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-card">
                <button class="modal-close" aria-label="Cerrar">✕</button>
                <div id="user-modal-content">
                    <div class="user-modal-loading" style="text-align:center;padding:20px;color:var(--muted)">Cargando...</div>
                </div>
            </div>`;
        document.body.appendChild(modal);

        const show = () => { modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); renderUserModal(); };
        const hide = () => { modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); };

        btn.addEventListener('click', (e) => { e.preventDefault(); show(); });
        modal.querySelector('.modal-close').addEventListener('click', hide);
        modal.querySelector('.modal-backdrop').addEventListener('click', hide);
        document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') hide(); });

        window.__userModalHide = hide;

        // ─── Render content based on auth state ───
        async function renderUserModal(){
            const content = modal.querySelector('#user-modal-content');

            // Wait for auth + Firestore to settle (up to 6s total)
            content.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:0.9rem">Cargando...</div>';

            try{
                await Promise.race([
                    Promise.all([
                        (window.waitForFirestore ? window.waitForFirestore(6000) : Promise.resolve(false)),
                        (window.__AUTH_READY__ || Promise.resolve())
                    ]),
                    new Promise(function(r){ setTimeout(r, 5500); })
                ]);

                const auth2 = window.__FIRESTORE_AUTH__;
                const db = window.__FIRESTORE_DB__;
                const user = auth2 ? auth2.currentUser : null;

                if (!auth2 || !db){
                    content.innerHTML = `
                        <div style="text-align:center;padding:6px 0">
                            <div style="font-size:2.2rem;margin-bottom:8px">🔐</div>
                            <h3 style="margin:0 0 4px">Mi Cuenta</h3>
                            <p style="color:var(--muted);font-size:0.88rem;margin-bottom:4px">El servicio está tardando en conectar.</p>
                            <p style="color:var(--muted);font-size:0.78rem;margin-bottom:16px">Posiblemente hay una sesión pendiente. Intenta reiniciar.</p>
                            <button id="clear-auth-btn" class="btn-outline" style="width:100%;padding:10px;font-size:0.82rem">Limpiar sesión pendiente</button>
                            <div id="retry-auth-msg" style="margin-top:8px;font-size:0.82rem;color:var(--muted)"></div>
                        </div>`;
                    const clearBtn = content.querySelector('#clear-auth-btn');
                    const msg = content.querySelector('#retry-auth-msg');
                    clearBtn.addEventListener('click', async function(){
                        msg.textContent = 'Limpiando...';
                        if (auth2) try{ await auth2.signOut(); }catch(e){}
                        try{
                            var k = Object.keys(localStorage).find(function(x){ return x.indexOf('firebase:auth') !== -1; });
                            if (k) localStorage.removeItem(k);
                        }catch(e){}
                        msg.textContent = 'Listo. Recarga la página.';
                    });
                    return;
                }

                if (!user){
                    _renderSignIn(content, auth2);
                } else {
                    _renderSignedIn(content, user);
                }
            }catch(e){
                content.innerHTML = '<div style="text-align:center;padding:16px;color:#c0392b">Error</div>';
            }
        }

        function _renderSignIn(content, auth){
            content.innerHTML = `
                <div style="text-align:center;padding:6px 0">
                    <div style="font-size:2.2rem;margin-bottom:8px">🔐</div>
                    <h3 style="margin:0 0 4px">Mi Cuenta</h3>
                    <p style="color:var(--muted);font-size:0.88rem;margin-bottom:4px">Inicia sesión para ver tus compras y acceder a promociones exclusivas.</p>
                    <p style="color:var(--muted);font-size:0.78rem;margin-bottom:18px">No es necesario para comprar, solo para beneficios adicionales.</p>
                    <button id="google-signin-btn" class="btn google-btn">
                        <svg viewBox="0 0 24 24" width="18" height="18" style="margin-right:8px"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        Continuar con Google
                    </button>
                    <div class="error" id="user-modal-error" style="margin-top:12px"></div>
                </div>`;

            const googleBtn = content.querySelector('#google-signin-btn');
            const errEl = content.querySelector('#user-modal-error');
            if (googleBtn){
                googleBtn.addEventListener('click', async () => {
                    try{
                        const provider = new window.firebase.auth.GoogleAuthProvider();
                        await auth.signInWithRedirect(provider);
                    }catch(e){
                        if (errEl) { errEl.textContent = 'Error al iniciar sesión: ' + e.message; errEl.style.display = 'block'; }
                    }
                });
            }
        }

        async function _renderSignedIn(content, user){
            const auth = window.__FIRESTORE_AUTH__;
            const isAdmin = (user.email || '').toLowerCase() === 'beautystudiodj@gmail.com';
            const name = user.displayName || user.email || 'Usuario';
            const photo = user.photoURL || '';
            const email = user.email || '';
            const uid = user.uid;

            let invoices = [];
            try{
                const snap = await window.__FIRESTORE_DB__.collection('invoices').where('uid','==',uid).get();
                invoices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                invoices.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
            }catch(e){
                try{
                    const snap = await window.__FIRESTORE_DB__.collection('invoices').get();
                    invoices = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.uid === uid);
                    invoices.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
                }catch(e2){}
            }

            let infoHtml = `
                <div style="text-align:center">
                    ${photo ? `<img src="${escapeHtml(photo)}" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover;margin-bottom:8px;border:2px solid var(--blush-200)">` : '<div style="width:56px;height:56px;border-radius:50%;background:var(--wine-700);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:800;margin-bottom:8px">' + (name[0]||'').toUpperCase() + '</div>'}
                    <h3 style="margin:0 0 2px">${escapeHtml(name)}</h3>
                    <p style="color:var(--muted);font-size:0.82rem;margin:0 0 4px">${escapeHtml(email)}</p>
                    <p style="color:var(--muted);font-size:0.78rem;margin:0 0 14px">${invoices.length} factura${invoices.length !== 1 ? 's' : ''}</p>
                </div>
                <hr style="border:none;border-top:1px solid var(--line);margin:12px 0">`;

            // Admin gate
            if (isAdmin){
                infoHtml += `
                    <div style="background:var(--blush-100);border-radius:10px;padding:12px;margin-bottom:12px;text-align:center">
                        <p style="font-size:0.85rem;font-weight:700;color:var(--wine-700);margin:0 0 8px">👑 Administrador</p>
                        <button id="admin-gate-btn" class="btn small" style="width:100%">Acceder al Panel de Administración</button>
                        <div id="admin-password-area" style="display:none;margin-top:10px">
                            <input id="admin-password-input" type="password" placeholder="Contraseña de admin" class="admin-input" style="margin:0 0 8px" />
                            <button id="admin-login-submit" class="btn small" style="width:100%">Ingresar</button>
                            <div id="admin-password-error" style="color:#c0392b;font-size:0.82rem;margin-top:6px;display:none"></div>
                        </div>
                    </div>`;
            }

            // Customer invoices list
            if (invoices.length > 0){
                infoHtml += `<div style="max-height:260px;overflow-y:auto">`;
                invoices.forEach(inv => {
                    const total = formatCOP(inv.total || inv.subtotal || 0);
                    const date = new Date(inv.createdAt || Date.now()).toLocaleString('es-CO', {day:'2-digit', month:'short', year:'numeric'});
                    const badge = inv.status === 'confirmed'
                        ? '<span style="background:#d4edda;color:#155724;padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:700">Confirmada</span>'
                        : '<span style="background:#fff3cd;color:#856404;padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:700">Pendiente</span>';
                    const items = (inv.items||[]).map(it => escapeHtml(it.name||'')).join(', ');
                    infoHtml += `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);gap:8px">
                            <div style="flex:1;min-width:0">
                                <div style="font-weight:600;font-size:0.85rem;color:var(--wine-700);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${items}</div>
                                <div style="font-size:0.75rem;color:var(--muted)">${date} ${badge}</div>
                            </div>
                            <div style="font-weight:800;font-size:0.88rem;color:var(--wine-700);white-space:nowrap">${total}</div>
                        </div>`;
                });
                infoHtml += `</div>`;
            } else {
                infoHtml += `<p style="text-align:center;color:var(--muted);font-size:0.85rem;margin:8px 0">Aún no tienes compras registradas.</p>`;
            }

            // Full profile link
            infoHtml += `
                <a href="usuario.html" style="display:block;text-align:center;padding:8px;font-size:0.85rem;color:var(--wine-700);font-weight:600;text-decoration:none;border-radius:8px;transition:background.18s" onmouseover="this.style.background='var(--blush-100)'" onmouseout="this.style.background='transparent'">Ver perfil completo →</a>
                <hr style="border:none;border-top:1px solid var(--line);margin:12px 0">
                <button id="user-signout-btn" class="btn-outline" style="width:100%;padding:10px;font-size:0.82rem">Cerrar sesión</button>`;

            content.innerHTML = infoHtml;

            const adminBtn = content.querySelector('#admin-gate-btn');
            if (adminBtn){
                adminBtn.addEventListener('click', () => {
                    const area = content.querySelector('#admin-password-area');
                    area.style.display = area.style.display === 'none' ? 'block' : 'none';
                });
            }
            const adminSubmit = content.querySelector('#admin-login-submit');
            if (adminSubmit){
                adminSubmit.addEventListener('click', () => {
                    const pw = content.querySelector('#admin-password-input').value.trim();
                    const err = content.querySelector('#admin-password-error');
                    if (pw === 'admin123'){
                        sessionStorage.setItem('admin_authed','1');
                        window.__userModalHide && window.__userModalHide();
                        window.location.href = 'admin/index.html';
                    } else {
                        err.textContent = 'Contraseña incorrecta';
                        err.style.display = 'block';
                    }
                });
            }

            const signOutBtn = content.querySelector('#user-signout-btn');
            if (signOutBtn){
                signOutBtn.addEventListener('click', async () => {
                    try{ await auth.signOut(); }catch(e){}
                    renderUserModal();
                });
            }
        }
    }catch(e){ console.warn('initUserPanelUI failed', e); }
}

try{ initUserPanelUI(); }catch(e){ /* ignore */ }

// Coupon popup: appears only on first visit. 5% off for purchases > 50.000 COP, valid 60 minutes.
function getActiveCoupon(){
    try{
        const raw = localStorage.getItem('dj_coupon_active');
        if (!raw) return null;
        const c = JSON.parse(raw);
        if (!c || !c.expiresAt) { localStorage.removeItem('dj_coupon_active'); return null; }
        if (Date.now() > Number(c.expiresAt)){
            localStorage.removeItem('dj_coupon_active'); return null;
        }
        return c;
    }catch(e){ return null; }
}

function removeCoupon(){
    try{ localStorage.removeItem('dj_coupon_active'); updateCartDisplay(); }catch(e){}
}

function scheduleCouponExpiry(){
    try{
        const c = getActiveCoupon();
        if (!c) return;
        const ms = Number(c.expiresAt) - Date.now();
        if (ms <= 0){ removeCoupon(); return; }
        if (window.__dj_coupon_expiry_timer) clearTimeout(window.__dj_coupon_expiry_timer);
        window.__dj_coupon_expiry_timer = setTimeout(()=>{
            try{ removeCoupon(); alert('Tu cupón ha expirado.'); }catch(e){}
        }, ms + 500);
    }catch(e){ }
}

function generateCouponCode(){
    const s = Math.random().toString(36).slice(2).toUpperCase();
    return 'DJ5-' + s.slice(0,6);
}

function initCouponPopup(opts = {}){
    try{
        // allow forcing the popup for testing with URL param/hash: ?showcoupon or #showcoupon
        const debugShow = (location.search && location.search.indexOf('showcoupon') !== -1) || (location.hash && location.hash.indexOf('showcoupon') !== -1);
        // If caller requested force (e.g. after 10s check), bypass the 'seen' guard
        const forceShow = Boolean(opts.force) || debugShow;
        if (localStorage.getItem('dj_coupon_seen') && !forceShow) return; // already shown before
        // build popup node (non-blocking, unobtrusive)
        const popup = document.createElement('div');
        popup.className = 'coupon-popup';
        popup.innerHTML = `
            <div class="coupon-inner">
                <button class="coupon-close" aria-label="Cerrar">✕</button>
                <div class="coupon-top">Tienes un cupón</div>
                <div class="coupon-body">5% de descuento en compras mayores a <strong>${formatCOP(50000)}</strong><br/><small>válido por 60 minutos</small></div>
                <div class="coupon-code">Code: <strong id="coupon-code">-</strong></div>
                <div class="coupon-actions"><button id="take-coupon-btn" class="btn">Tomar cupón</button></div>
            </div>`;
        document.body.appendChild(popup);

        // style and set code only when user takes it (generate code then)
        const closeBtn = popup.querySelector('.coupon-close');
        closeBtn.addEventListener('click', (e)=>{ e.preventDefault(); try{ popup.remove(); }catch(ex){} localStorage.setItem('dj_coupon_seen','1'); });

        const takeBtn = popup.querySelector('#take-coupon-btn');
        takeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const code = generateCouponCode();
            const now = Date.now();
            const expires = now + (60 * 60 * 1000);
            const couponObj = { code, issuedAt: now, expiresAt: expires, discountPercent: 5, minTotal: 50000 };
            try{ localStorage.setItem('dj_coupon_active', JSON.stringify(couponObj)); }catch(e){}
            // mark as seen so popup won't show again
            localStorage.setItem('dj_coupon_seen','1');
            if (debugShow) console.info('Coupon debug: forced show via URL param/hash');
            // update UI: show code briefly then remove
            const codeEl = popup.querySelector('#coupon-code'); if (codeEl) codeEl.textContent = code;
            // apply to cart and refresh display
            try{ updateCartDisplay(); scheduleCouponExpiry(); showAddToCartToast('Cupón ' + code + ' aplicado', 1); }catch(e){}
            setTimeout(()=>{ try{ popup.remove(); }catch(e){} }, 900);
        });

        // auto-hide after 10s if user doesn't interact (but still mark as seen so it won't show again)
        setTimeout(()=>{ if (document.body.contains(popup)){ try{ popup.remove(); }catch(e){} localStorage.setItem('dj_coupon_seen','1'); } }, 10000);

    }catch(e){ console.warn('initCouponPopup failed', e); }
}

// initialize coupon state on load
try{
    scheduleCouponExpiry();
    // Monitor for presence of an active coupon during the first 10 seconds.
    // If no coupon becomes active in that window, show the popup (force show).
    (function monitorCouponForFirst10s(){
        const checkInterval = 700;
        const maxMs = 10000;
        const maxChecks = Math.ceil(maxMs / checkInterval);
        let checks = 0;
        const iv = setInterval(()=>{
            checks++;
            try{ if (getActiveCoupon()){ clearInterval(iv); return; } }catch(e){ /* ignore */ }
            if (checks >= maxChecks){
                clearInterval(iv);
                try{ initCouponPopup({ force: true }); }catch(e){}
            }
        }, checkInterval);
    })();
}catch(e){ }