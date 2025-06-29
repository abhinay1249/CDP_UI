// =========================== script.js ===========================
// Dynamic behaviour for CDP Segmentation UI – custom autocomplete + loading + modal

document.addEventListener("DOMContentLoaded", () => {
  /* ---------- DOM refs ---------- */
  const segNameTop   = document.getElementById("segmentName");
  const segDescTop   = document.getElementById("segmentDesc");   // optional
  const sourceTop    = document.getElementById("sourceDisplay");
  const targetTop    = document.getElementById("targetTable");   // make sure the input has this id

  const previewSection = document.getElementById("previewSection");
  const createSection  = document.getElementById("createSection");
  const previewRadios  = [...document.getElementsByName("previewChoice")];
  const previewMsg     = document.getElementById("previewValidation");

  const plusBtn   = document.getElementById("plusBtn");
  const minusBtn  = document.getElementById("minusBtn");
  const filterInp = document.getElementById("filterCount");
  const filtersEl = document.getElementById("filtersContainer");

  const statsBox  = document.getElementById("statsBox");
  const statInit  = document.getElementById("statInitial");
  const statCurr  = document.getElementById("statCurrent");

  const sourceTbl    = document.getElementById("sourceTable");
  const sourceDisplay= document.getElementById("sourceDisplay");
  const loadedBanner = document.getElementById("loadedBanner");
  const initRecsEl   = document.getElementById("initialRecords");
  const initAttrsEl  = document.getElementById("initialAttributes");

  const saveBtn   = document.getElementById("saveBtn");

  /* ---------- Autocomplete lists ---------- */
  const ATTR_LIST = [
    "Group_Id","Customer_Id","First_Name","Last_Name","Total_Purchases",
    "Last Purchase Date","Avg_Order_Value","Avg_Time_Between_Purchases",
    "Loyalty_Members","Loyalty_Tier","Subscription_Status","Most_Preferred_Product",
    "Gender","Country","Lifetime Value"
  ];
  const COND_LIST = [
    "Equals","Not Equals","Contains","Starts With","Ends With",
    "Is In","Is Not in","Is Null","Greater Than","Less Than"
  ];

  /* ---------- Autocomplete helper ---------- */
  function attachAutocomplete(input, list) {
    let box;
    const close = () => { if (box) box.remove(); box = null; };
    const open  = (matches) => {
      close(); if (!matches.length) return;
      box = document.createElement("div");
      box.className = "autocomplete-list";
      matches.forEach(item => {
        const div = document.createElement("div");
        div.className = "autocomplete-item";
        div.textContent = item;
        div.addEventListener("mousedown", () => { input.value = item; close(); });
        box.appendChild(div);
      });
      input.parentNode.appendChild(box);
    };
    input.addEventListener("input", () => {
      const v = input.value.trim().toLowerCase();
      open(v ? list.filter(i => i.toLowerCase().includes(v)) : list);
    });
    ["focus","click"].forEach(evt =>
      input.addEventListener(evt, () => { if (!box) open(list); })
    );
    input.addEventListener("blur", () => setTimeout(close, 120));
  }

  /* ---------- One filter card template ---------- */
  const buildFilterRow = (idx) => `
    <div class="filter-header">Filter ${idx}</div>
    <div class="filters-inline">
      <div class="form-row input-arrow autocomplete-wrapper" style="flex:1;">
        <label>Attribute</label>
        <input type="text" class="attrInput" placeholder="Select attribute" autocomplete="off">
      </div>
      <div class="form-row input-arrow autocomplete-wrapper" style="flex:1;">
        <label>Condition</label>
        <input type="text" class="opInput" placeholder="Choose condition" autocomplete="off">
      </div>
      <div class="form-row" style="flex:1;">
        <label>Value</label>
        <input type="text" class="valInput" placeholder="Enter value">
      </div>
    </div>
  `;

  /* ---------- Render filters ---------- */
  function renderFilters() {
    const n = Number(filterInp.value);
    filtersEl.innerHTML = "";
    if (n === 0) { statsBox.classList.add("hidden"); return; }

    for (let i = 1; i <= n; i++) {
      const card = document.createElement("div");
      card.className = "filter";
      card.innerHTML = buildFilterRow(i);
      filtersEl.appendChild(card);

      attachAutocomplete(card.querySelector(".attrInput"), ATTR_LIST);
      attachAutocomplete(card.querySelector(".opInput"),   COND_LIST);
    }

    if (+statInit.textContent > 0) {
      statCurr.textContent = Math.floor(+statInit.textContent / (n * 2 + 1));
      statsBox.classList.remove("hidden");
    }
  }

  /* ---------- Arrow click opens input OR select ---------- */
  document.addEventListener("click", (e) => {
    const wrap = e.target.closest(".input-arrow");
    if (wrap && e.target === wrap) {
      // Input field case
      const inp = wrap.querySelector("input[type='text']");
      if (inp) { inp.focus(); inp.dispatchEvent(new Event("click")); return; }

      // <select> dropdown case
      const sel = wrap.querySelector("select");
      if (sel) {
        sel.focus();
        sel.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      }
    }
  });

  /* ---------- Toggle Yes/No sections ---------- */
  function toggleSections() {
    const r = previewRadios.find(r => r.checked);
    createSection.classList.toggle("hidden", !(r && r.value === "No"));
    previewSection.classList.toggle("hidden", !(r && r.value === "Yes"));
  }
  previewRadios.forEach(r => r.addEventListener("change", () => {
    previewMsg.classList.add("hidden");
    toggleSections();
  }));

  /* ---------- Simulate backend lookup ---------- */
  function simulateBackendLookup(tbl) {
    initRecsEl.textContent  = Math.floor(Math.random() * 5000) + 500;
    initAttrsEl.textContent = Math.floor(Math.random() * 25) + 5;
    statInit.textContent    = initRecsEl.textContent;
    loadedBanner.classList.remove("hidden");
    if (!sourceDisplay.value.trim()) sourceDisplay.value = `CDP_DB.CDP_SCHEMA.${tbl}`;
    renderFilters();
  }
  sourceTbl.addEventListener("blur", () => {
    const tbl = sourceTbl.value.trim();
    if (tbl) simulateBackendLookup(tbl);
  });

  /* ---------- Save Segment ---------- */
  saveBtn.addEventListener("click", () => {
    const numFilters = +filterInp.value;

    if (numFilters === 0) {
      showModal("⚠️ Missing Filters", "Select the number of filters required.");
      return;
    }

    // Validate each filter (Attr, Cond, Val)
    const cardsIncomplete = [...document.querySelectorAll(".filter")].some(card => {
      const attr = card.querySelector(".attrInput")?.value.trim();
      const cond = card.querySelector(".opInput")?.value.trim();
      const val  = card.querySelector(".valInput")?.value.trim();
      return !attr || !cond || !val;
    });
    if (cardsIncomplete) {
      showModal("⚠️ Incomplete Filters", "Fill Attribute, Condition, and Value for every filter.");
      return;
    }

    // Validate top-level fields
    if (!segNameTop.value.trim() || !sourceTop.value.trim() || !targetTop.value.trim()) {
      showModal("⚠️ Missing Details", "Please enter Segment Name, Source, and Target Snowflake Table.");
      return;
    }

    // Spinner → success modal
    document.getElementById("loadingOverlay").classList.remove("hidden");
    setTimeout(() => {
      document.getElementById("loadingOverlay").classList.add("hidden");
      showModal("✅ Segment has been successfully Created and saved!", "", true);
    }, 2000);
  });

  /* ---------- Modal helper ---------- */
  function showModal(title, message, resetOnClose = false) {
    const modal   = document.getElementById("successModal");
    const content = modal.querySelector(".modal-content");
    content.innerHTML = `
      <h3>${title}</h3>
      ${message ? `<p>${message}</p>` : ""}
      <button id="okBtn" class="btn-primary">OK</button>
    `;
    modal.classList.remove("hidden");

    content.querySelector("#okBtn").addEventListener("click", () => {
      modal.classList.add("hidden");
      if (resetOnClose) {
        // reset everything
        filterInp.value = 0;
        renderFilters();
        segNameTop.value = "";
        segDescTop.value = "";
        sourceTop.value  = "";
        targetTop.value  = "";
      }
    });
  }

  /* ---------- Filter counter buttons ---------- */
  plusBtn.addEventListener("click", () => {
    if (+filterInp.value < 10) {
      filterInp.value++;
      renderFilters();
    }
  });

  minusBtn.addEventListener("click", () => {
    if (+filterInp.value > 0) {
      filterInp.value--;
      renderFilters();

      if (+filterInp.value === 0) {
        segNameTop.value = "";
        segDescTop.value = "";
        sourceTop.value  = "";
        targetTop.value  = "";
      }
    }
  });

  /* ---------- Init ---------- */
  renderFilters();
});
