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

        // Apply sorting if requested (sort by effective price when discounts present)
        if (currentSort === 'price-asc'){
            items = items.slice().sort((a,b)=> (Number(getDiscountedPrice(a))||0) - (Number(getDiscountedPrice(b))||0));
        } else if (currentSort === 'price-desc'){
            items = items.slice().sort((a,b)=> (Number(getDiscountedPrice(b))||0) - (Number(getDiscountedPrice(a))||0));
        }
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
                        <button class="btn btn-buy">Añadir al Carrito</button>
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
        // viewer counters only shown on product detail pages
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
        renderCardList(items, container);
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
        const initial = Number(prod.discountPercentage) || 0;
        editor.innerHTML = `
            <label style="display:flex;align-items:center;gap:8px"><span>Descuento %</span><input type="number" min="0" max="100" value="${initial}" class="offer-percent" style="width:80px;padding:6px;border-radius:8px;border:1px solid rgba(0,0,0,0.06)" /></label>
            <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
                <div class="offer-preview" style="font-weight:800;color:var(--wine-700)">${formatCOP(getDiscountedPrice(prod))}</div>
                <button class="btn btn-save-offer">Guardar</button>
                <button class="btn-outline btn-cancel-offer">Cancelar</button>
            </div>`;
        const body = cardEl.querySelector('.card-body') || cardEl;
        body.appendChild(editor);
        const input = editor.querySelector('.offer-percent');
        const preview = editor.querySelector('.offer-preview');
        function updatePreview(){
            const val = Math.max(0, Math.min(100, Number(input.value) || 0));
            const temp = Object.assign({}, prod, { discountPercentage: val });
            preview.textContent = formatCOP(getDiscountedPrice(temp));
        }
        input.addEventListener('input', updatePreview);
        editor.querySelector('.btn-cancel-offer').addEventListener('click', () => editor.remove());
        editor.querySelector('.btn-save-offer').addEventListener('click', async () => {
            const val = Math.max(0, Math.min(100, Number(input.value) || 0));
            await applyDiscountToProduct(prod.id || idx, val);
            editor.remove();
        });
        updatePreview();
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
        const subtotal = items.reduce((s,it) => s + (it.unitPrice * it.qty), 0);
        const total = items.reduce((s,it) => {
            const p = Math.round(it.unitPrice * (100 - (Number(it.discountPercentage)||0)) / 100);
            return s + (p * it.qty);
        }, 0);
        return { id, createdAt: Date.now(), status: 'pending', items, subtotal, total };
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

    function renderInvoicesManager(area){
        if (!area) return;
        area.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="font-weight:800">Facturas</div><div>Total ventas: <span id="invoices-total">${formatCOP(0)}</span></div></div><div id="invoices-list"></div><div id="invoice-detail" style="margin-top:12px"></div>`;
        loadInvoices().then(invoices => {
            const list = area.querySelector('#invoices-list');
            renderInvoicesList(list, invoices || []);
            const totalEl = area.querySelector('#invoices-total');
            if (totalEl) totalEl.textContent = formatCOP(computeTotalSales(invoices || []));
        });
    }

    function renderInvoicesList(container, invoices){
        if (!container) return;
        container.innerHTML = '';
        (invoices || []).forEach(inv => {
            const div = document.createElement('div');
            div.className = 'admin-invoice-row';
            div.style.padding = '8px';
            div.style.borderBottom = '1px solid rgba(0,0,0,0.04)';
            div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div><strong>${inv.id}</strong> <small style="color:var(--muted);margin-left:6px">${new Date(inv.createdAt || Date.now()).toLocaleString()}</small><div style="color:${inv.status==='confirmed'?'green':'#666'};font-weight:700;margin-top:6px">${inv.status}</div></div><div><button class="btn btn-view-invoice" data-id="${inv.id}">Ver / Editar</button></div></div>`;
            container.appendChild(div);
        });
        // attach view handlers
        Array.from(container.querySelectorAll('.btn-view-invoice')).forEach(b => b.addEventListener('click', async (e) => {
            const id = b.dataset.id;
            const detail = container.parentElement.querySelector('#invoice-detail');
            if (!detail) return;
            // find invoice
            const invoices = await loadInvoices();
            const inv = (invoices || []).find(x => x.id === id);
            if (!inv) { detail.innerHTML = '<div>No encontrada</div>'; return; }
            openInvoiceEditorInAdmin(detail, inv);
        }));
    }

    function openInvoiceEditorInAdmin(area, inv){
        if (!area) return;
        area.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.style.border = '1px solid rgba(0,0,0,0.04)';
        wrap.style.padding = '12px';
        wrap.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div><strong>Factura ${inv.id}</strong><div style="color:var(--muted);font-size:0.9rem">${new Date(inv.createdAt||Date.now()).toLocaleString()}</div></div><div><button class="btn btn-confirm-invoice">Confirmar</button> <button class="btn btn-save-invoice">Guardar</button></div></div><div id="invoice-items" style="margin-top:12px"></div><div id="invoice-totals" style="margin-top:12px;font-weight:800">Total: ${formatCOP(inv.total || inv.subtotal || 0)}</div>`;
        area.appendChild(wrap);
        const itemsContainer = wrap.querySelector('#invoice-items');
        function renderItems(){
            itemsContainer.innerHTML = '';
            (inv.items || []).forEach((it, idx) => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.alignItems = 'center';
                row.style.padding = '8px 0';
                row.innerHTML = `<div style="flex:1"><strong>${escapeHtml(it.name)}</strong><div style="color:var(--muted);font-size:0.9rem">${formatCOP(it.unitPrice)} cada uno</div></div><div style="width:160px;display:flex;gap:8px;align-items:center"><input data-idx="${idx}" class="input-qty" type="number" min="1" value="${it.qty}" style="width:70px;padding:6px" /><input data-idx="${idx}" class="input-discount" type="number" min="0" max="100" value="${it.discountPercentage||0}" style="width:70px;padding:6px" /><button data-idx="${idx}" class="btn btn-remove-invoice-item">Eliminar</button></div>`;
                itemsContainer.appendChild(row);
            });
            // attach handlers
            Array.from(itemsContainer.querySelectorAll('.input-qty')).forEach(i => i.addEventListener('change', (e)=>{
                const idx = Number(i.dataset.idx); inv.items[idx].qty = Math.max(1, Number(i.value)||1); recalcTotals();
            }));
            Array.from(itemsContainer.querySelectorAll('.input-discount')).forEach(i => i.addEventListener('change', (e)=>{
                const idx = Number(i.dataset.idx); inv.items[idx].discountPercentage = Math.max(0, Math.min(100, Number(i.value)||0)); recalcTotals();
            }));
            Array.from(itemsContainer.querySelectorAll('.btn-remove-invoice-item')).forEach(b => b.addEventListener('click', (e)=>{
                const idx = Number(b.dataset.idx); inv.items.splice(idx,1); renderItems(); recalcTotals();
            }));
        }
        function recalcTotals(){
            inv.subtotal = (inv.items || []).reduce((s,it) => s + ((Number(it.unitPrice)||0) * (Number(it.qty)||1)), 0);
            inv.total = (inv.items || []).reduce((s,it) => {
                const p = Math.round((Number(it.unitPrice)||0) * (100 - (Number(it.discountPercentage)||0))/100);
                return s + (p * (Number(it.qty)||1));
            }, 0);
            wrap.querySelector('#invoice-totals').textContent = 'Total: ' + formatCOP(inv.total || inv.subtotal || 0);
        }
        // Save handler
        wrap.querySelector('.btn-save-invoice').addEventListener('click', async () => {
            try{ await persistInvoice(inv); alert('Factura guardada.'); renderInvoicesManager(document.getElementById('admin-invoices-area')); }catch(e){ alert('Error guardando factura.'); console.warn(e); }
        });
        // Confirm handler
        wrap.querySelector('.btn-confirm-invoice').addEventListener('click', async () => {
            if (!confirm('Confirmar factura y descontar stock? esta acción actualizará inventario.')) return;
            try{
                await confirmInvoice(inv.id);
                renderInvoicesManager(document.getElementById('admin-invoices-area'));
            }catch(e){ console.warn('Confirm invoice failed', e); alert('No se pudo confirmar la factura: ' + (e && e.message ? e.message : String(e))); }
        });

        renderItems(); recalcTotals();
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
                        try{ const r2 = await fetch(base.replace(/\/$/, '') + '/api/products'); if (r2.ok){ DJ_PRODUCTS_DATA = await r2.json(); renderProducts(); renderAllProducts(); renderBestSellersWidget(); } }catch(e){}
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
    })();

    // Admin: abrir el gestor de Ofertas desde el panel (botón en admin.html)
    try{
        const path = window.location.pathname.split('/').pop();
        if (path === 'admin.html' || window.location.pathname.indexOf('/admin') !== -1){
            const btn = document.getElementById('admin-offers-btn');
            const area = document.getElementById('admin-offers-area');
            if (btn && area){
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Ensure admin authentication (demo): if not authed, prompt now
                    if (!sessionStorage.getItem('admin_authed')){
                        const pass = prompt('Contraseña de administrador (demo):');
                        if (pass !== 'admin123'){
                            alert('Acceso denegado. Ingresa la contraseña en el panel.');
                            return;
                        }
                        sessionStorage.setItem('admin_authed','1');
                    }
                    adminOffersActive = true;
                    // create controls + grid for offers management
                    area.innerHTML = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input id="product-search-input" class="search-box" placeholder="Buscar productos..." style="flex:1" /><button id="categories-btn" class="btn-outline">Categorias</button><div id="active-filter-label" style="margin-left:8px;color:var(--muted)"></div></div><div class="grid-container"></div>`;
                    attachSearchCategoriesHandlers && attachSearchCategoriesHandlers();
                    createCategoryFilterUI();
                    renderProducts();
                    area.scrollIntoView({ behavior: 'smooth' });
                });
            }
                // invoices manager
                const invBtn = document.getElementById('admin-invoices-btn');
                const invArea = document.getElementById('admin-invoices-area');
                if (invBtn && invArea){
                    invBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (!sessionStorage.getItem('admin_authed')){
                            const pass = prompt('Contraseña de administrador (demo):');
                            if (pass !== 'admin123'){ alert('Acceso denegado. Ingresa la contraseña en el panel.'); return; }
                            sessionStorage.setItem('admin_authed','1');
                        }
                        adminOffersActive = false;
                        renderInvoicesManager(invArea);
                        invArea.scrollIntoView({ behavior: 'smooth' });
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
        const totalUnits = cart.reduce((s, it) => s + (Number(it.qty) || 1), 0);
        cartCountEl.innerText = totalUnits;
        cartItemsContainer.innerHTML = '';
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p style="color:#666">Tu carrito está vacío.</p>';
        } else {
            cart.forEach((it, idx) => {
                const qty = Number(it.qty) || 1;
                const subtotal = (Number(it.price) || 0) * qty;
                const div = document.createElement('div');
                div.className = 'cart-item';
                div.innerHTML = `<div><strong>${escapeHtml(it.name)}</strong><div style="font-size:0.9rem;color:#666">${formatCOP(it.price)}${qty>1? ' ×'+qty + ' = ' + formatCOP(subtotal) : ''}</div></div><div><button data-idx="${idx}" class="btn-remove">Eliminar</button></div>`;
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
        if (!cartPanel) return;
        cartPanel.classList.add('show');
        cartPanel.setAttribute('aria-hidden', 'false');
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
        const plainMsg = `Hola quiero comprar (Factura: ${saved.id || invoice.id}):\n${lines.join('\n')}\nTotal: ${total}`;
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
    attachSearchCategoriesHandlers();
});