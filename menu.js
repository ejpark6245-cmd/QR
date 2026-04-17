// OLD & WISE — QR Menu Script  |  Google Sheet CSV Version

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/10qxYwshsPafTAUvADQTNfJenXS0B0Na23S_ZgCaLnZ4/export?format=csv&gid=673871259";

const CATS = {
  "사이드 디쉬": { icon: "🍽", en: "SIDE DISH" },
  "클래식 칵테일": { icon: "🍸", en: "CLASSIC" },
  "칵테일": { icon: "🥃", en: "COCKTAIL" },
  "과일 칵테일": { icon: "🍹", en: "FRUITY" },
  "크리미 칵테일": { icon: "🥛", en: "CREAMY" },
  "위스키 하이볼": { icon: "🥤", en: "HIGHBALL" },
  "위스키": { icon: "🥃", en: "WHISKEY" },
  "데킬라": { icon: "🌵", en: "TEQUILA" },
  "브랜디": { icon: "🍇", en: "BRANDY" },
  "와인": { icon: "🍷", en: "WINE" },
  "맥주": { icon: "🍺", en: "BEER" },
  "논알콜": { icon: "🫧", en: "NON-ALCH" },
};

function formatPrice(price) {
  const num = Number(price);
  if (!Number.isFinite(num)) return "";
  return Math.round(num * 10000).toLocaleString("ko-KR");
}

function slugify(str) {
  return "sec-" + String(str).replace(/\s+/g, "-").replace(/[^\w가-힣-]/g, "");
}

function normalizeRowKeys(row) {
  const clean = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    const safeKey = String(key || "").replace(/^\uFEFF/, "").trim();
    clean[safeKey] = typeof value === "string" ? value.trim() : value;
  });
  return clean;
}

function getField(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function toVisible(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return true;
  if (["n", "no", "false", "0"].includes(v)) return false;
  if (["y", "yes", "true", "1"].includes(v)) return true;
  return true;
}

function categoryEnglish(nameKr) {
  if (CATS[nameKr]?.en) return CATS[nameKr].en;
  return String(nameKr || "").toUpperCase();
}

async function loadMenu() {
  const response = await fetch(`${CSV_URL}&t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("메뉴 로드 실패");

  const csvText = (await response.text()).replace(/^\uFEFF/, "");

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: "greedy",
  });

  const rows = parsed.data
    .map((rawRow, index) => {
      const row = normalizeRowKeys(rawRow);

      return {
        category_kr: getField(row, ["카테고리"]),
        name_kr: getField(row, ["메뉴명"]),
        name_en: getField(row, ["영문명", "메뉴영문명", "name_en"]),
        price: Number(getField(row, ["가격(만원)", "가격"])),
        original_price: Number(getField(row, ["할인전가격(만원)", "할인전가격"])),
        bottle_price: Number(getField(row, ["보틀가격(만원)", "보틀가격"])),
        ingredients: getField(row, ["재료/설명", "설명"]),
        abv: getField(row, ["도수"]),
        note: getField(row, ["메모"]),
        visible: toVisible(getField(row, ["노출여부(y/n)", "노출여부"])),
        order: Number(getField(row, ["순서", "정렬"])),
        _index: index,
      };
    })
    .filter((item) => item.category_kr && item.name_kr && item.visible);

  const groupedMap = new Map();

  rows.forEach((item) => {
    if (!groupedMap.has(item.category_kr)) {
      groupedMap.set(item.category_kr, []);
    }
    groupedMap.get(item.category_kr).push(item);
  });

  const categories = Array.from(groupedMap.entries()).map(([categoryName, items]) => {
    const sortedItems = [...items].sort((a, b) => {
      const aOrder = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
      const bOrder = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a._index - b._index;
    });

    return {
      name_kr: categoryName,
      name_en: categoryEnglish(categoryName),
      items: sortedItems.map((item) => ({
        name_kr: item.name_kr,
        name_en: item.name_en || "",
        price: Number.isFinite(item.price) ? item.price : null,
        original_price: Number.isFinite(item.original_price) ? item.original_price : null,
        bottle_price: Number.isFinite(item.bottle_price) ? item.bottle_price : null,
        ingredients: item.ingredients || "",
        abv: item.abv || "",
        note: item.note || "",
      })),
    };
  });

  return { categories };
}

/* ── Nav 렌더 ── */
function renderNav(categories) {
  const nav = document.getElementById("catNav");
  nav.innerHTML = "";

  categories.forEach((cat, idx) => {
    const meta = CATS[cat.name_kr] || { icon: "•", en: cat.name_en };

    const btn = document.createElement("button");
    btn.className = "cat-item" + (idx === 0 ? " active" : "");
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

    btn.addEventListener("click", () => {
      const target = document.getElementById(slugify(cat.name_kr));
      if (target) {
        const isMobile = window.innerWidth <= 720;
        const offset = isMobile ? 62 : 28;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "smooth" });
      }
      if (window.innerWidth <= 720) closeSidebar();
    });

    nav.appendChild(btn);
  });
}

/* ── Menu 렌더 ── */
function renderMenu(data) {
  const main = document.getElementById("menuMain");
  main.innerHTML = "";

  data.categories.forEach((cat) => {
    const section = document.createElement("section");
    section.className = "menu-section";
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

    const list = section.querySelector(".item-list");

    cat.items.forEach((item) => {
      const el = document.createElement("article");
      el.className = "menu-item";

      const noteHtml = item.note ? `<div class="item-note">${item.note}</div>` : "";

      let ingredientsHtml = "";
      if (item.ingredients || item.abv) {
        const ing = item.ingredients || "";
        const sep = item.ingredients && item.abv ? " · " : "";
        const abv = item.abv ? `<span class="abv">${item.abv}</span>` : "";
        ingredientsHtml = `<div class="item-ingredients">${ing}${sep}${abv}</div>`;
      }

      let priceHtml = "";
      if (
        Number.isFinite(item.original_price) &&
        Number.isFinite(item.price) &&
        item.original_price > item.price
      ) {
        el.classList.add("is-sale");
        priceHtml = `
          <div class="price-original">${formatPrice(item.original_price)}</div>
          <div class="price-amount">${formatPrice(item.price)}</div>
          <div class="price-unit">won</div>
        `;
      } else if (Number.isFinite(item.bottle_price) && Number.isFinite(item.price)) {
        priceHtml = `
          <div class="price-amount">${formatPrice(item.price)}</div>
          <div class="price-bottle">${formatPrice(item.bottle_price)}</div>
          <div class="price-unit">glass / bottle</div>
        `;
      } else if (Number.isFinite(item.price)) {
        priceHtml = `
          <div class="price-amount">${formatPrice(item.price)}</div>
          <div class="price-unit">won</div>
        `;
      } else {
        priceHtml = `<div class="price-unit"></div>`;
      }

      el.innerHTML = `
        <div class="item-info">
          <div class="item-name-kr">${item.name_kr}</div>
          <div class="item-name-en">${item.name_en || ""}</div>
          ${ingredientsHtml}
          ${noteHtml}
        </div>
        <div class="item-leader">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="item-price">
          ${priceHtml}
        </div>
      `;
      list.appendChild(el);
    });

    main.appendChild(section);
  });
}

/* ── Scroll Spy ── */
function setupScrollSpy(categories) {
  const sectionIds = categories.map((c) => slugify(c.name_kr));
  const pills = () => document.querySelectorAll(".cat-item");

  function activate(idx) {
    pills().forEach((p, i) => p.classList.toggle("active", i === idx));

    const activePill = document.querySelectorAll(".cat-item")[idx];
    if (activePill) {
      activePill.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idx = sectionIds.indexOf(entry.target.id);
          if (idx !== -1) activate(idx);
        }
      });
    },
    {
      rootMargin: "-10% 0px -60% 0px",
      threshold: 0,
    }
  );

  sectionIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

/* ── Mobile Sidebar ── */
function openSidebar() {
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("sidebarOverlay")?.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebarOverlay")?.classList.remove("open");
  document.body.style.overflow = "";
}

/* ── Init ── */
async function init() {
  try {
    const data = await loadMenu();
    renderNav(data.categories);
    renderMenu(data);
    setupScrollSpy(data.categories);
  } catch (e) {
    document.getElementById("menuMain").innerHTML = `
      <div style="padding:4rem 2rem;text-align:center;color:var(--text-muted)">
        <div style="font-family:'Playfair Display',serif;font-size:1.5rem;color:var(--gold);margin-bottom:0.5rem">Oops</div>
        <p>메뉴를 불러오지 못했습니다.</p>
        <p style="font-size:12px;margin-top:0.5rem;opacity:0.5">${e.message}</p>
      </div>
    `;
  }

  document.getElementById("burgerBtn")?.addEventListener("click", openSidebar);
  document.getElementById("sidebarOverlay")?.addEventListener("click", closeSidebar);
}

document.addEventListener("DOMContentLoaded", init);
