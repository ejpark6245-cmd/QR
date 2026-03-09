// OLD & WISE — QR Menu Script  |  v2

const CATS = {
    '사이드 디쉬': { icon: '🍽', en: 'SIDE DISH' },
    '클래식 칵테일': { icon: '🍸', en: 'CLASSIC' },
    '칵테일': { icon: '🥃', en: 'COCKTAIL' },
    '과일 칵테일': { icon: '🍹', en: 'FRUITY' },
    '크리미 칵테일': { icon: '🥛', en: 'CREAMY' },
    '맥주': { icon: '🍺', en: 'BEER' },
    '논알콜': { icon: '🫧', en: 'NON-ALCH' },
};

function formatPrice(price) {
    return Math.round(price * 10000).toLocaleString('ko-KR');
}

function slugify(str) {
    return 'sec-' + str.replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '');
}

async function loadMenu() {
    const res = await fetch('menu.json');
    if (!res.ok) throw new Error('메뉴 로드 실패');
    return res.json();
}

/* ── Nav 렌더 ── */
function renderNav(categories) {
    const nav = document.getElementById('catNav');
    nav.innerHTML = '';

    categories.forEach((cat, idx) => {
        const meta = CATS[cat.name_kr] || { icon: '•', en: cat.name_en };

        const btn = document.createElement('button');
        btn.className = 'cat-item' + (idx === 0 ? ' active' : '');
        btn.dataset.target = slugify(cat.name_kr);
        btn.dataset.idx = idx;
        btn.innerHTML = `
      <span class="cat-icon">${meta.icon}</span>
      <span class="cat-text">
        <span class="cat-name-kr">${cat.name_kr}</span>
        <span class="cat-name-en">${meta.en}</span>
      </span>
      <span class="cat-count">${cat.items.length}</span>
    `;

        btn.addEventListener('click', () => {
            const target = document.getElementById(slugify(cat.name_kr));
            if (target) {
                const isMobile = window.innerWidth <= 720;
                const offset = isMobile ? 62 : 28;
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
            // Mobile: close sidebar on click
            if (window.innerWidth <= 720) closeSidebar();
        });

        nav.appendChild(btn);
    });
}

/* ── Menu 렌더 ── */
function renderMenu(data) {
    const main = document.getElementById('menuMain');
    main.innerHTML = '';

    data.categories.forEach((cat) => {
        const section = document.createElement('section');
        section.className = 'menu-section';
        section.id = slugify(cat.name_kr);

        section.innerHTML = `
      <div class="section-header">
        <h2 class="section-en">${cat.name_en}</h2>
        <div class="section-kr">
          ${cat.name_kr}
          <span class="section-count">${cat.items.length}종</span>
        </div>
        <div class="section-rule"></div>
      </div>
      <div class="item-list"></div>
    `;

        const list = section.querySelector('.item-list');

        cat.items.forEach((item) => {
            const el = document.createElement('article');
            el.className = 'menu-item';
            el.innerHTML = `
        <div class="item-info">
          <div class="item-name-kr">${item.name_kr}</div>
          <div class="item-name-en">${item.name_en}</div>
        </div>
        <div class="item-leader">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="item-price">
          <div class="price-amount">${formatPrice(item.price)}</div>
          <div class="price-unit">won</div>
        </div>
      `;
            list.appendChild(el);
        });

        main.appendChild(section);
    });
}

/* ── Scroll Spy ── */
function setupScrollSpy(categories) {
    const sectionIds = categories.map(c => slugify(c.name_kr));
    const pills = () => document.querySelectorAll('.cat-item');

    function activate(idx) {
        pills().forEach((p, i) => p.classList.toggle('active', i === idx));

        // Scroll nav item into view
        const activePill = document.querySelectorAll('.cat-item')[idx];
        if (activePill) {
            activePill.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const idx = sectionIds.indexOf(entry.target.id);
                if (idx !== -1) activate(idx);
            }
        });
    }, {
        rootMargin: '-10% 0px -60% 0px',
        threshold: 0
    });

    sectionIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
    });
}

/* ── Mobile Sidebar ── */
function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

/* ── Init ── */
async function init() {
    try {
        const data = await loadMenu();
        renderNav(data.categories);
        renderMenu(data);
        setupScrollSpy(data.categories);
    } catch (e) {
        document.getElementById('menuMain').innerHTML = `
      <div style="padding:4rem 2rem;text-align:center;color:var(--text-muted)">
        <div style="font-family:'Playfair Display',serif;font-size:1.5rem;color:var(--gold);margin-bottom:0.5rem">Oops</div>
        <p>메뉴를 불러오지 못했습니다.</p>
        <p style="font-size:12px;margin-top:0.5rem;opacity:0.5">${e.message}</p>
      </div>
    `;
    }

    // Burger button
    document.getElementById('burgerBtn')?.addEventListener('click', openSidebar);
    document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);
}

document.addEventListener('DOMContentLoaded', init);
