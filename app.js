// Initialize MapLibre GL JS Map
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: MA_CENTER,
  zoom: MA_ZOOM
});

let isMapLocked = true;
let isPlaying = false;
let playInterval = null;

map.on('load', () => {
  // Add GeoJSON data source
  map.addSource('ma-towns', {
    type: 'geojson',
    data: './data/ma_towns.geojson' // Relative path for GitHub Pages
  });

  // Base Polygon Fill Layer
  map.addLayer({
    id: 'towns-base',
    type: 'fill',
    source: 'ma-towns',
    paint: {
      'fill-color': '#339af0',
      'fill-opacity': 0.4,
      'fill-outline-color': '#1c7ed6'
    },
    filter: ['all', ['<=', ['get', 'start_year'], 1620], ['>', ['get', 'end_year'], 1620]]
  });

  // Highlight Layer (Triggered on hover)
  map.addLayer({
    id: 'towns-highlight',
    type: 'fill',
    source: 'ma-towns',
    paint: {
      'fill-color': '#fab005',
      'fill-opacity': 0.85,
      'fill-outline-color': '#e67700'
    },
    filter: ['==', ['get', 'town_id'], '']
  });

  initMapLockControl();
  initPanelResizer();
  initPanelMinimization();
  initLibrary();
  setupSliderControls();
});

// ==========================================
// 1. MAP FOCUS LOCK / UNLOCK TOGGLE
// ==========================================
function initMapLockControl() {
  const lockBtn = document.getElementById('lock-view-btn');
  const lockIcon = document.getElementById('lock-icon');
  const lockText = document.getElementById('lock-text');

  // Set initial locked state
  setMapLockState(true);

  lockBtn.addEventListener('click', () => {
    setMapLockState(!isMapLocked);
  });

  function setMapLockState(locked) {
    isMapLocked = locked;
    if (locked) {
      lockBtn.classList.add('locked');
      lockText.textContent = 'Locked';
      lockIcon.innerHTML = `
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      `;
      // Lock interactions & reset camera to Massachusetts
      map.flyTo({ center: MA_CENTER, zoom: MA_ZOOM });
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.boxZoom.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
    } else {
      lockBtn.classList.remove('locked');
      lockText.textContent = 'Unlocked';
      lockIcon.innerHTML = `
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
      `;
      // Enable camera movement
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.boxZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();
    }
  }
}

// ==========================================
// 2. SIDEBAR PANEL RESIZER (DRAG BOUNDARY)
// ==========================================
function initPanelResizer() {
  const resizer = document.getElementById('panel-resizer');
  const timelineSection = document.getElementById('timeline-section');
  const librarySection = document.getElementById('library-section');
  const sidebar = document.getElementById('sidebar');

  let isDragging = false;

  resizer.addEventListener('mousedown', (e) => {
    isDragging = true;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'ns-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const sidebarRect = sidebar.getBoundingClientRect();
    const offsetY = e.clientY - sidebarRect.top;
    const totalHeight = sidebarRect.height;

    // Boundary limits (minimum 60px height when unminimized)
    const minHeight = 60;
    const clampedY = Math.max(minHeight, Math.min(totalHeight - minHeight, offsetY));

    const topPercent = (clampedY / totalHeight) * 100;
    const bottomPercent = 100 - topPercent;

    // Unminimize panels if user starts dragging resizer
    timelineSection.classList.remove('minimized');
    librarySection.classList.remove('minimized');

    timelineSection.style.height = `${topPercent}%`;
    timelineSection.style.flex = `0 0 ${topPercent}%`;
    librarySection.style.height = `${bottomPercent}%`;
    librarySection.style.flex = `0 0 ${bottomPercent}%`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      resizer.classList.remove('dragging');
      document.body.style.cursor = '';
    }
  });
}

// ==========================================
// 3. MINIMIZE & DEFAULT RESTORE BUTTONS
// ==========================================
function initPanelMinimization() {
  const timeline = document.getElementById('timeline-section');
  const library = document.getElementById('library-section');
  const minimizeBtns = document.querySelectorAll('.minimize-btn');

// Helper to update minimize buttons visibility
  function updateMinimizeButtonsVisibility() {
    const isAnyMinimized = timeline.classList.contains('minimized') || library.classList.contains('minimized');
    
    minimizeBtns.forEach(btn => {
      if (isAnyMinimized) {
        btn.classList.add('hidden-btn'); // Hide minimize buttons on BOTH panels
      } else {
        btn.classList.remove('hidden-btn'); // Show minimize buttons on both panels
      }
    });
  }

  function resetToDefaultSizes() {
    timeline.classList.remove('minimized');
    library.classList.remove('minimized');

    timeline.style.height = '50%';
    timeline.style.flex = '0 0 50%';
    library.style.height = '50%';
    library.style.flex = '0 0 50%';

    updateMinimizeButtonsVisibility();
  }

  // Default Buttons (Square & Rectangle icons)
  document.querySelectorAll('.default-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetToDefaultSizes();
    });
  });

  // Timeline Minimize Button Click
  timeline.querySelector('.minimize-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    timeline.classList.add('minimized');
    library.classList.remove('minimized');
    
    library.style.height = 'calc(100% - 34px)';
    library.style.flex = '1';

    updateMinimizeButtonsVisibility();
  });

  // Library Minimize Button Click
  library.querySelector('.minimize-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    library.classList.add('minimized');
    timeline.classList.remove('minimized');
    
    timeline.style.height = 'calc(100% - 34px)';
    timeline.style.flex = '1';

    updateMinimizeButtonsVisibility();
  });

  // Clicking minimized stripe bar restores panel
  timeline.querySelector('.stripe-bar').addEventListener('click', resetToDefaultSizes);
  library.querySelector('.stripe-bar').addEventListener('click', resetToDefaultSizes);
}

// ==========================================
// 4. LIBRARY EXPLORER & PATH STATUS BAR
// ==========================================
const libraryStore = {
  root: {
    title: "Home",
    type: "folder",
    children: [
      { id: "folder-figures", title: "Notable Figures", type: "folder", icon: "📁" },
      { id: "folder-events", title: "Key Events", type: "folder", icon: "📁" },
      { id: "folder-locations", title: "Historic Locations", type: "folder", icon: "📁" }
    ]
  },
  "folder-figures": {
    title: "Notable Figures",
    path: ["Home", "Notable Figures"],
    type: "folder",
    children: [
      { id: "john-winthrop", title: "John Winthrop", type: "card", icon: "👤" }
    ]
  },
  "folder-events": {
    title: "Key Events",
    path: ["Home", "Key Events"],
    type: "folder",
    children: [
      { id: "dedham-grant", title: "Dedham Land Grant", type: "card", icon: "📜" }
    ]
  },
  "folder-locations": {
    title: "Historic Locations",
    path: ["Home", "Historic Locations"],
    type: "folder",
    children: []
  },
  "john-winthrop": {
    type: "card",
    title: "John Winthrop (1588–1649)",
    path: ["Home", "Notable Figures", "John Winthrop"],
    category: "Notable Figures",
    content: "John Winthrop was an English Puritan lawyer and one of the leading figures in founding the Massachusetts Bay Colony."
  },
  "dedham-grant": {
    type: "card",
    title: "Dedham Plantation Grant (1636)",
    path: ["Home", "Key Events", "Dedham Land Grant"],
    category: "Key Events",
    content: "In 1636, the General Court granted a vast tract of land southwest of Boston to form Dedham."
  }
};

let historyStack = ["root"];
let historyIndex = 0;
let isPathRowVisible = true;

function initLibrary() {
  const backBtn = document.getElementById("lib-back");
  const fwdBtn = document.getElementById("lib-forward");
  const pathToggleBtn = document.getElementById("toggle-path-btn");
  const pathRow = document.getElementById("library-path-row");
  const pathIcon = document.getElementById("path-toggle-icon");

  backBtn.addEventListener("click", () => {
    if (historyIndex > 0) {
      historyIndex--;
      renderLibraryView(historyStack[historyIndex]);
    }
  });

  fwdBtn.addEventListener("click", () => {
    if (historyIndex < historyStack.length - 1) {
      historyIndex++;
      renderLibraryView(historyStack[historyIndex]);
    }
  });

  // Toggle Path Row Visibility
  pathToggleBtn.addEventListener("click", () => {
    isPathRowVisible = !isPathRowVisible;
    if (isPathRowVisible) {
      pathRow.classList.remove("hidden");
      pathIcon.innerHTML = `<rect x="2" y="2" width="12" height="12" fill="currentColor"/>`; // Filled square
    } else {
      pathRow.classList.add("hidden");
      pathIcon.innerHTML = `<rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"/>`; // Open square
    }
  });

  // Handle Timeline Inline Links
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("library-link")) {
      e.preventDefault();
      const cardId = e.target.dataset.cardId;
      if (cardId && libraryStore[cardId]) {
        navigateTo(cardId);
      }
    }
  });

  renderLibraryView("root");
}

function navigateTo(id) {
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(id);
  historyIndex = historyStack.length - 1;
  renderLibraryView(id);
}

function renderLibraryView(id) {
  const item = libraryStore[id] || libraryStore["root"];
  const contentEl = document.getElementById("library-content");
  const pathTextEl = document.getElementById("library-path-text");
  const backBtn = document.getElementById("lib-back");
  const fwdBtn = document.getElementById("lib-forward");

  backBtn.disabled = historyIndex <= 0;
  fwdBtn.disabled = historyIndex >= historyStack.length - 1;

  // Format path text (Home > Folder 1 > Person A)
  const pathArray = item.path || ["Home"];
  pathTextEl.textContent = pathArray.join(" > ");

  if (item.type === "folder") {
    if (item.children.length === 0) {
      contentEl.innerHTML = `<p style="color: #6c757d; font-size: 0.85rem;">Folder is empty.</p>`;
    } else {
      let gridHtml = `<div class="explorer-grid">`;
      item.children.forEach(child => {
        gridHtml += `
          <div class="explorer-item" onclick="navigateTo('${child.id}')">
            <div class="explorer-icon">${child.icon}</div>
            <div class="explorer-label">${child.title}</div>
          </div>
        `;
      });
      gridHtml += `</div>`;
      contentEl.innerHTML = gridHtml;
    }
  } else if (item.type === "card") {
    contentEl.innerHTML = `
      <div class="info-card">
        <div class="card-category">${item.category}</div>
        <h3>${item.title}</h3>
        <p>${item.content}</p>
      </div>
    `;
  }
}

// ==========================================
// 5. SLIDER CONTROLS & TIMELINE HOVER
// ==========================================
function setupSliderControls() {
  const slider = document.getElementById('year-slider');
  const yearDisplay = document.getElementById('year-display');
  const playBtn = document.getElementById('play-btn');

  slider.addEventListener('input', (e) => {
    updateYear(parseInt(e.target.value, 10));
  });

  playBtn.addEventListener('click', () => {
    if (isPlaying) stopPlayback(); else startPlayback();
  });
}

function updateYear(year) {
  document.getElementById('year-display').textContent = year;
  if (map.getLayer('towns-base')) {
    map.setFilter('towns-base', [
      'all',
      ['<=', ['get', 'start_year'], year],
      ['>', ['get', 'end_year'], year]
    ]);
  }
}

function startPlayback() {
  isPlaying = true;
  document.getElementById('play-btn').textContent = 'Pause';
  const slider = document.getElementById('year-slider');
  playInterval = setInterval(() => {
    let current = parseInt(slider.value, 10);
    if (current >= 1920) stopPlayback(); else { current++; slider.value = current; updateYear(current); }
  }, 300);
}

function stopPlayback() {
  isPlaying = false;
  document.getElementById('play-btn').textContent = 'Play';
  clearInterval(playInterval);
}


function syncAccordion(year) {
  const blocks = document.querySelectorAll('.year-block');
  let targetBlock = document.getElementById(`year-${year}`);

  blocks.forEach(b => b.removeAttribute('open'));

  if (targetBlock) {
    targetBlock.setAttribute('open', 'true');
    targetBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
