const CSV_URL =
  "https://docs.google.com/spreadsheets/d/10qxYwshsPafTAUvADQTNfJenXS0B0Na23S_ZgCaLnZ4/export?format=csv&gid=673871259";

const els = {};
let sectionObserver = null;

document.addEventListener("DOMContentLoaded", init);

function init() {
  els.catNav = document.getElementById("catNav");
  els.menuMain = document.getElementById("menuMain");
  els.sidebar = document.getElementById("sidebar");
  els.burgerBtn = document.getElementById("burgerBtn");
  els.sidebarOverlay = document.getElementById("sidebarOverlay");

  bindSidebar();
  loadMenu();

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1024) closeSidebar();
  });
}

async function loadMenu() {
  renderLoading();

  try {
    if (!window.Papa) {
      throw new Error("PapaParse가 로드되지 않았습니다.");
    }

    const url = `${CSV_URL}&t=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`CSV 요청 실패: ${response.status}`);
    }

    const csvText = (await response.text()).replace(/^\uFEFF/, "");

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: "greedy",
    });

    const items = normalizeRows(parsed.data);

    if (!items.length) {
      renderEmpty();
      return;
    }

    const groups = groupByCategory(items);
    renderCategoryNav(groups);
    renderSections(groups);
    setupActiveSectionSpy();
  } catch (error) {
    console.error(error);
    renderError();
  }
}

function normalizeRows(rawRows) {
  return rawRows
    .map((rawRow, index) => {
      const row = normalizeRowKeys(rawRow);

      const item = {
        category: getField(row, ["카테고리", "category", "분류"]),
        name: getField(row, ["메뉴명", "메뉴", "name", "item", "상품명"]),
        price: getField(row, ["가격(만원)", "가격", "price", "금액"]),
        oldPrice: getField(row, ["할인전가격(만원)", "할인전가격", "정가", "oldPrice"]),
        bottlePrice: getField(row, ["보틀가격(만원)", "보틀가격", "bottlePrice"]),
        description: getField(row, ["재료/설명", "설명", "description", "desc"]),
        abv: getField(row, ["도수", "abv", "알콜도수"]),
        note: getField(row, ["메모", "비고", "note"]),
        visible: toVisible(getField(row, ["노출여부(y/n)", "노출여부", "노출", "visible"])),
        hidden: toBoolean(getField(row, ["숨김", "hidden", "hide"])),
        soldout: toBoolean(getField(row, ["품절", "soldout", "sold out"])),
        order: Number(getField(row, ["순서", "order", "정렬"])),
        _index: index,
      };

      item.detail = buildDetail(item);

      return item;
    })
    .filter((item) => item.category && item.name && item.visible && !item.hidden);
}

function normalizeRowKeys(row) {
  const clean = {};

  Object.entries(row || {}).forEach(([key, value]) => {
    const safeKey = String(key || "").replace(/^\uFEFF/, "").trim();
    clean[safeKey] = typeof value === "string" ? value.trim() : value;
  });

  return clean;
}

function getField(row, candidates) {
  for (const key of candidates) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function toBoolean(value) {
  const v = String(value || "").trim().toLowerCase();
  return ["y", "yes", "true", "1", "o", "품절", "숨김"].includes(v);
}

function toVisible(value) {
  const v = String(value || "").trim().toLowerCase();

  if (!v) return true;
  if (["n", "no", "false", "0", "hide", "hidden", "비노출"].includes(v)) return false;
  if (["y", "yes", "true", "1", "show", "visible", "노출"].includes(v)) return true;

  return true;
}

function buildDetail(item) {
  const parts = [];

  if (item.description) parts.push(item.description);
  if (item.note) parts.push(item.note);
  if (item.abv) parts.push(`도수 ${item.abv}`);

  return parts.join(" · ");
}

function groupByCategory(items) {
  const map = new Map();

  items.forEach((item) => {
    if (!map.has(item.category)) {
      map.set(item.category, []);
    }
    map.get(item.category).push(item);
  });

  return Array.from(map.entries()).map(([category, categoryItems], index) => {
    const sortedItems = [...categoryItems].sort((a, b) => {
      const aOrder = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
      const bOrder = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;

      if (aOrder !== bOrder) return aOrder - bOrder;
      return a._index - b._index;
    });

    return {
      category,
      id: `section-${slugify(category)}-${index + 1}`,
      items: sortedItems,
    };
  });
}

function renderCategoryNav(groups) {
  els.catNav.innerHTML = groups
    .map(
      (group, index) => `
        <a
          href="#${group.id}"
          class="cat-link cat-nav-link ${index === 0 ? "is-active active" : ""}"
          data-target="${group.id}"
        >
          <span>${escapeHtml(group.category)}</span>
        </a>
      `
    )
    .join("");

  els.catNav.querySelectorAll(".cat-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();

      const targetId = link.dataset.target;
      scrollToSection(targetId);
      setActiveNav(targetId);

      if (window.innerWidth <= 1024) {
        closeSidebar();
      }
    });
  });
}

function renderSections(groups) {
  els.menuMain.innerHTML = groups
    .map(
      (group) => `
        <section class="menu-section section-block" id="${group.id}">
          <div class="section-head menu-section-head">
            <h2 class="section-title menu-section-title">${escapeHtml(group.category)}</h2>
          </div>

          <div class="menu-list menu-items">
            ${group.items.map((item) => renderMenuItem(item)).join("")}
          </div>
        </section>
      `
    )
    .join("");
}

function renderMenuItem(item) {
  const oldPriceHtml =
    item.oldPrice && item.oldPrice !== item.price
      ? `<div class="menu-price-old"><s>${escapeHtml(item.oldPrice)}</s></div>`
      : "";

  const priceHtml = item.price
    ? `<div class="menu-price-main">${escapeHtml(item.price)}</div>`
    : "";

  const bottlePriceHtml = item.bottlePrice
    ? `<div class="menu-price-sub">보틀 ${escapeHtml(item.bottlePrice)}</div>`
    : "";

  const priceBlock =
    oldPriceHtml || priceHtml || bottlePriceHtml
      ? `<div class="menu-price item-price">${oldPriceHtml}${priceHtml}${bottlePriceHtml}</div>`
      : "";

  return `
    <article class="menu-item menu-card ${item.soldout ? "is-soldout soldout" : ""}">
      <div class="menu-item-head item-head">
        <div class="menu-item-left item-left">
          <h3 class="menu-title menu-item-name">${escapeHtml(item.name)}</h3>
          ${
            item.detail
              ? `<p class="menu-desc menu-item-desc">${escapeHtml(item.detail).replace(/\n/g, "<br>")}</p>`
              : ""
          }
        </div>

        <div class="menu-item-right item-right">
          ${priceBlock}
          ${item.soldout ? `<div class="menu-badge menu-item-badge">품절</div>` : ""}
        </div>
      </div>
    </article>
  `;
}

function renderLoading() {
  els.catNav.innerHTML = "";

  els.menuMain.innerHTML = `
    <section class="menu-state">
      <div class="menu-empty">
        <h2 class="section-title">메뉴 불러오는 중...</h2>
        <p class="menu-desc">잠시만 기다려 주세요.</p>
      </div>
    </section>
  `;
}

function renderEmpty() {
  els.catNav.innerHTML = "";

  els.menuMain.innerHTML = `
    <section class="menu-state">
      <div class="menu-empty">
        <h2 class="section-title">메뉴가 비어 있습니다</h2>
        <p class="menu-desc">Google Sheet에 메뉴를 입력하면 여기에 표시됩니다.</p>
      </div>
    </section>
  `;
}

function renderError() {
  els.catNav.innerHTML = "";

  els.menuMain.innerHTML = `
    <section class="menu-state is-error">
      <div class="menu-empty">
        <h2 class="section-title">메뉴를 불러오지 못했습니다</h2>
        <p class="menu-desc">시트 공개 설정과 CSV 링크를 확인해 주세요.</p>
        <button type="button" class="retry-btn" id="retryMenuBtn">다시 불러오기</button>
      </div>
    </section>
  `;

  const retryBtn = document.getElementById("retryMenuBtn");
  if (retryBtn) {
    retryBtn.addEventListener("click", loadMenu);
  }
}

function setupActiveSectionSpy() {
  if (sectionObserver) {
    sectionObserver.disconnect();
  }

  const sections = document.querySelectorAll(".menu-section");
  if (!sections.length) return;

  sectionObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntries = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visibleEntries.length > 0) {
        setActiveNav(visibleEntries[0].target.id);
      }
    },
    {
      rootMargin: "-20% 0px -55% 0px",
      threshold: [0.1, 0.25, 0.5, 0.75],
    }
  );

  sections.forEach((section) => sectionObserver.observe(section));
  setActiveNav(sections[0].id);
}

function setActiveNav(targetId) {
  els.catNav.querySelectorAll(".cat-link").forEach((link) => {
    const isActive = link.dataset.target === targetId;
    link.classList.toggle("is-active", isActive);
    link.classList.toggle("active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function scrollToSection(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;

  const offset = window.innerWidth <= 1024 ? 84 : 32;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;

  window.scrollTo({
    top,
    behavior: "smooth",
  });
}

function bindSidebar() {
  if (els.burgerBtn) {
    els.burgerBtn.setAttribute("aria-expanded", "false");

    els.burgerBtn.addEventListener("click", () => {
      const willOpen = !document.body.classList.contains("sidebar-open");
      setSidebarState(willOpen);
    });
  }

  if (els.sidebarOverlay) {
    els.sidebarOverlay.addEventListener("click", closeSidebar);
  }
}

function setSidebarState(isOpen) {
  document.body.classList.toggle("sidebar-open", isOpen);

  [els.sidebar, els.sidebarOverlay, els.burgerBtn].forEach((el) => {
    if (!el) return;
    el.classList.toggle("is-open", isOpen);
    el.classList.toggle("open", isOpen);
    el.classList.toggle("active", isOpen);
  });

  if (els.burgerBtn) {
    els.burgerBtn.setAttribute("aria-expanded", String(isOpen));
  }
}

function closeSidebar() {
  setSidebarState(false);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
