// ==========================================
// CONSTANTS & STATE STORE
// ==========================================
const MA_CENTER = [-71.3824, 42.4072];
const MA_ZOOM = 8;
const MIN_YEAR = 1620;
const MAX_YEAR = 2020;

// Application State
let currentYear = 1620;
let isLinked = false; // Linked Mode (default Unlinked per spec)
let isMapLocked = true;
let isPlaying = false;
let playInterval = null;
let currentZoomIndex = 0; // 0: CENTURY, 1: DECADE, 2: YEAR

let selectedCardId = null;
let highlightedCardId = null;
let historyStack = ["root"];
let historyIndex = 0;

// Timeline Event Records
const eventsData = [
  { id: "evt-1620", year: 1620, monthDay: null, title: "Plymouth Colony", desc: "Mayflower lands; Plymouth established.", townId: "plymouth" },
  { id: "evt-1630", year: 1630, monthDay: "August 5", title: "Boston Incorporated", desc: "Boston settled under John Winthrop.", townId: "boston", cardLinkId: "john-winthrop" },
  { id: "evt-1636-dedham", year: 1636, yearOnly: false, monthDay: "March 23", title: "Dedham Plantation Grant", desc: "Dedham incorporated from inland plantation grant.", townId: "dedham", cardLinkId: "dedham-grant" },
  { id: "evt-1636-cambridge", year: 1636, yearOnly: true, monthDay: null, title: "Cambridge Incorporated", desc: "Newe Towne renamed Cambridge.", townId: "cambridge" },
  { id: "evt-1636-springfield", year: 1636, yearOnly: true, monthDay: null, title: "Springfield Settlement", desc: "Springfield settlement established.", townId: "springfield" },
  { id: "evt-1636-scituate", year: 1636, yearOnly: true, monthDay: null, title: "Scituate Incorporated", desc: "Scituate incorporated in Plymouth Colony.", townId: "scituate" },
  { id: "evt-1673-wrentham", year: 1673, monthDay: "October 15", title: "Wrentham Incorporated", desc: "Wrentham split from Dedham.", townId: "wrentham" },
  { id: "evt-1711-needham", year: 1711, monthDay: "November 5", title: "Needham Incorporated", desc: "Needham incorporated from northern Dedham.", townId: "needham" }
];

// Map Initialization
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: MA_CENTER,
  zoom: MA_ZOOM
});

// Initialization Handler
document.addEventListener("DOMContentLoaded", () => {
  initMapLockControl();
  initPanelResizer();
  initPanelMinimization();
  initLibrary();
  renderTimelineEvents();
  setupSliderTimeline();
  setupControlsRow();
  updateSystemState();
});

map.on('load', () => {
  map.addSource('ma-towns', { type: 'geojson', data: './data/ma_towns.geojson' });
  map.addLayer({
    id: 'towns-base', type: 'fill', source: 'ma-towns',
    paint: { 'fill-color': '#339af0', 'fill-opacity': 0.4, 'fill-outline-color': '#1c7ed6' },
    filter: ['all', ['<=', ['get', 'start_year'], currentYear], ['>', ['get', 'end_year'], currentYear]]
  });
  map.addLayer({
    id: 'towns-highlight', type: 'fill', source: 'ma-towns',
    paint: { 'fill-color': '#fab005', 'fill-opacity': 0.85, 'fill-outline-color': '#e67700' },
    filter: ['==', ['get', 'town_id'], '']
  });
});

// ==========================================
// 1. STATE MACHINE & CORE UPDATES
// ==========================================
function updateSystemState() {
  // Update Showing Bar
  document.getElementById('year-field').value = currentYear;
  const eventsInYear = eventsData.filter(e => e.year === currentYear);
  document.getElementById('events-amount').textContent = `(${eventsInYear.length} ${eventsInYear.length === 1 ? 'event' : 'events'})`;

  // Update Map Layer
  if (map.getLayer('towns-base')) {
    map.setFilter('towns-base', [
      'all',
      ['<=', ['get', 'start_year'], currentYear],
      ['>', ['get', 'end_year'], currentYear]
    ]);
  }

  // Position Timeline Handle
  positionTimelineHandle(currentYear);

  // Position Here Indicator
  const targetYear = getActiveIndicatorYear();
  positionHereIndicator(targetYear);

  // Sync Map Highlight
  updateMapHighlight();
}

function getActiveIndicatorYear() {
  if (selectedCardId) {
    const card = eventsData.find(e => e.id === selectedCardId);
    return card ? card.year : currentYear;
  }
  if (highlightedCardId) {
    const card = eventsData.find(e => e.id === highlightedCardId);
    return card ? card.year : currentYear;
  }
  return currentYear;
}

function updateMapHighlight() {
  let activeTownId = '';
  if (selectedCardId) {
    const card = eventsData.find(e => e.id === selectedCardId);
    if (card) activeTownId = card.townId;
  }
  if (map.getLayer('towns-highlight')) {
    map.setFilter('towns-highlight', ['==', ['get', 'town_id'], activeTownId]);
  }
}

// ==========================================
// 2. TIMELINE PANEL & EVENT CARD LOGIC
// ==========================================
function renderTimelineEvents() {
  const container = document.getElementById('event-cards-list');
  container.innerHTML = '';

  eventsData.forEach(event => {
    const card = document.createElement('div');
    card.className = 'event-card';
    card.id = `card-${event.id}`;

    const dateHtml = event.monthDay && !event.yearOnly
      ? `<span class="card-year-col">${event.year}</span><span class="card-divider-col">•</span><span class="card-date-col">${event.monthDay}</span>`
      : `<span class="card-year-col">${event.year}</span>`;

    const linkHtml = event.cardLinkId
      ? `<a href="#" class="library-link" data-card-id="${event.cardLinkId}">${event.title}</a>`
      : event.title;

    card.innerHTML = `
      <div class="card-date-row">${dateHtml}</div>
      <div class="card-content-row">
        <div class="card-title">${linkHtml}</div>
        <div class="card-desc">${event.desc}</div>
      </div>
      <div class="card-footer-row">
        <span class="card-sources-col">Sources</span>
        <button class="card-go-btn" data-tooltip="Go">
          <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 1l8 5-8 5V1z"/></svg>
        </button>
      </div>
    `;

    // Event Listeners (Per Spec 2.2 State Machine)
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('library-link')) return;

      if (e.target.closest('.card-go-btn')) {
        handleGoButtonClick(event);
      } else {
        handleCardBodyClick(event);
      }
    });

    container.appendChild(card);
  });
}

function handleCardBodyClick(event) {
  // Spec 2.2: If system is Linked and a card is Selected, clicking card body does NOTHING
  if (isLinked && selectedCardId) return;

  // Unlinked mode: highlight card, move Here indicator to event year, map does NOT move
  highlightedCardId = event.id;
  selectedCardId = null;
  updateCardVisualStates();
  updateSystemState();
}

function handleGoButtonClick(event) {
  // Spec 2.2: Clicking currently Selected card's Go button toggles it to Highlighted and Unlinks system
  if (selectedCardId === event.id && isLinked) {
    selectedCardId = null;
    highlightedCardId = event.id;
    setLinkedState(false);
  } else {
    // Select card, move handle to year, update map
    selectedCardId = event.id;
    highlightedCardId = null;
    currentYear = event.year;

    // Scroll card to Top Position (~35px offset)
    scrollCardToTopPosition(event.id);
  }
  updateCardVisualStates();
  updateSystemState();
}

function scrollCardToTopPosition(eventId) {
  const cardEl = document.getElementById(`card-${eventId}`);
  const panelBody = document.getElementById('timeline-body');
  if (cardEl && panelBody) {
    const targetScroll = Math.max(0, cardEl.offsetTop - 35);
    panelBody.scrollTo({ top: targetScroll, behavior: 'smooth' });
  }
}

function updateCardVisualStates() {
  document.querySelectorAll('.event-card').forEach(card => {
    card.classList.remove('selected', 'highlighted');
  });

  if (selectedCardId) {
    const selEl = document.getElementById(`card-${selectedCardId}`);
    if (selEl) selEl.classList.add('selected');
  } else if (highlightedCardId) {
    const hlEl = document.getElementById(`card-${highlightedCardId}`);
    if (hlEl) hlEl.classList.add('highlighted');
  }
}

// ==========================================
// 3. SLIDER TIMELINE & ZOOM SYSTEM
// ==========================================
function setupSliderTimeline() {
  const zoomSlider = document.getElementById('zoom-slider');
  const zoomTitle = document.getElementById('zoom-level-title');

  renderTimelineAxis();

  zoomSlider.addEventListener('input', (e) => {
    currentZoomIndex = parseInt(e.target.value, 10);
    const titles = ["CENTURY", "DECADE", "YEAR"];
    zoomTitle.textContent = titles[currentZoomIndex];
    renderTimelineAxis();
  });

  document.getElementById('zoom-out-btn').addEventListener('click', () => {
    if (currentZoomIndex > 0) { currentZoomIndex--; zoomSlider.value = currentZoomIndex; zoomTitle.textContent = ["CENTURY", "DECADE", "YEAR"][currentZoomIndex]; renderTimelineAxis(); }
  });

  document.getElementById('zoom-in-btn').addEventListener('click', () => {
    if (currentZoomIndex < 2) { currentZoomIndex++; zoomSlider.value = currentZoomIndex; zoomTitle.textContent = ["CENTURY", "DECADE", "YEAR"][currentZoomIndex]; renderTimelineAxis(); }
  });
}

function renderTimelineAxis() {
  const ticksContainer = document.getElementById('ticks-container');
  const titlesRow = document.getElementById('year-titles-row');
  const circlesContainer = document.getElementById('circles-container');
  const track = document.getElementById('timeline-track');

  ticksContainer.innerHTML = '';
  titlesRow.innerHTML = '';
  circlesContainer.innerHTML = '';

  let majorInterval = 25;
  let minorInterval = 5;

  if (currentZoomIndex === 1) { majorInterval = 10; minorInterval = 1; }
  else if (currentZoomIndex === 2) { majorInterval = 1; minorInterval = 0.1; }

  const totalYears = MAX_YEAR - MIN_YEAR;

  // Render Ticks & Labels
  for (let yr = MIN_YEAR; yr <= MAX_YEAR; yr += minorInterval) {
    const pct = ((yr - MIN_YEAR) / totalYears) * 100;
    const isMajor = (yr % majorInterval === 0);

    const tick = document.createElement('div');
    tick.className = `tick-mark ${isMajor ? 'major' : 'minor'}`;
    tick.style.left = `${pct}%`;
    ticksContainer.appendChild(tick);

    if (isMajor && yr % 25 === 0) {
      const label = document.createElement('span');
      label.className = 'year-title-label';
      label.style.left = `${pct}%`;
      label.textContent = Math.round(yr);
      titlesRow.appendChild(label);
    }
  }

  // Render Event Circles (Stacked / Clustered per Spec 3)
  const groupedEvents = {};
  eventsData.forEach(event => {
    let bucketYear = event.year;
    if (currentZoomIndex === 0) bucketYear = Math.floor(event.year / 5) * 5; // 5-yr clusters
    if (!groupedEvents[bucketYear]) groupedEvents[bucketYear] = [];
    groupedEvents[bucketYear].push(event);
  });

  Object.keys(groupedEvents).forEach(bYear => {
    const list = groupedEvents[bYear];
    const pct = ((bYear - MIN_YEAR) / totalYears) * 100;

    const circle = document.createElement('div');
    circle.className = 'event-circle';
    circle.style.left = `${pct}%`;

    const rangeEnd = parseInt(bYear, 10) + (currentZoomIndex === 0 ? 4 : 0);
    const tooltipText = currentZoomIndex === 0 && list.length > 1
      ? `${bYear}–${rangeEnd} (${list.length} events)`
      : `${list[0].year} (${list.length} ${list.length === 1 ? 'event' : 'events'})`;

    circle.addEventListener('mouseenter', () => {
      document.getElementById('circle-tooltip-bar').textContent = tooltipText;
    });
    circle.addEventListener('mouseleave', () => {
      document.getElementById('circle-tooltip-bar').textContent = '';
    });

    circle.addEventListener('click', () => {
      currentYear = list[0].year;
      if (isLinked) {
        selectedCardId = list[0].id;
        scrollCardToTopPosition(list[0].id);
        updateCardVisualStates();
      }
      updateSystemState();
    });

    circlesContainer.appendChild(circle);
  });

  positionTimelineHandle(currentYear);
  positionHereIndicator(getActiveIndicatorYear());
}

function positionTimelineHandle(year) {
  const handle = document.getElementById('timeline-handle');
  const pct = ((year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;
  if (handle) handle.style.left = `${pct}%`;
}

function positionHereIndicator(year) {
  const indicator = document.getElementById('here-indicator');
  const pct = ((year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;
  if (indicator) {
    indicator.style.left = `${pct}%`;
    indicator.className = `here-indicator ${isLinked || selectedCardId ? 'blue' : 'gray'}`;
  }
}

// ==========================================
// 4. CONTROLS ROW & LINK BUTTON LOGIC
// ==========================================
function setupControlsRow() {
  const playBtn = document.getElementById('play-pause-btn');
  const playIcon = document.getElementById('play-icon');
  const playText = document.getElementById('play-text');
  const linkBtn = document.getElementById('link-btn');
  const yearField = document.getElementById('year-field');
  const statusText = document.getElementById('showing-status-text');

  // Stepper Buttons
  document.getElementById('prev-year-btn').addEventListener('click', () => {
    pausePlayback();
    if (currentYear > MIN_YEAR) { currentYear--; updateSystemState(); }
  });
  document.getElementById('next-year-btn').addEventListener('click', () => {
    pausePlayback();
    if (currentYear < MAX_YEAR) { currentYear++; updateSystemState(); }
  });
  document.getElementById('prev-event-btn').addEventListener('click', () => {
    pausePlayback();
    stepEvent(-1);
  });
  document.getElementById('next-event-btn').addEventListener('click', () => {
    pausePlayback();
    stepEvent(1);
  });

  // Play / Pause Animation
  playBtn.addEventListener('click', () => {
    if (isPlaying) pausePlayback(); else startPlayback();
  });

  function startPlayback() {
    isPlaying = true;
    playIcon.textContent = '║║';
    playText.textContent = 'Pause';
    playInterval = setInterval(() => {
      if (currentYear >= MAX_YEAR) {
        pausePlayback(); // Spec 2.3.2: Auto-pause at 2020
      } else {
        currentYear++;
        updateSystemState();
      }
    }, 1500); // Spec 2.3.1: 1.5s per event step
  }

  function pausePlayback() {
    isPlaying = false;
    playIcon.textContent = '▶';
    playText.textContent = 'Play';
    clearInterval(playInterval);
  }

  // Link Button Toggle (Spec 2.4 / Showing Controls)
  linkBtn.addEventListener('click', () => {
    setLinkedState(!isLinked);
  });

  // Year Field Manual Typing (Spec 2.4)
  yearField.addEventListener('focus', () => { statusText.textContent = "Type Year, Hit Enter"; });
  yearField.addEventListener('blur', () => { statusText.textContent = ""; });
  yearField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = parseInt(yearField.value, 10);
      if (isNaN(val) || val < MIN_YEAR || val > MAX_YEAR) {
        statusText.textContent = "Invalid Year";
      } else {
        currentYear = val;
        statusText.textContent = "";
        if (isLinked) {
          const firstEvt = eventsData.find(evt => evt.year === currentYear);
          if (firstEvt) {
            selectedCardId = firstEvt.id;
            scrollCardToTopPosition(firstEvt.id);
            updateCardVisualStates();
          }
        }
        updateSystemState();
        yearField.blur();
      }
    }
  });
}

function setLinkedState(linked) {
  isLinked = linked;
  const linkBtn = document.getElementById('link-btn');
  const linkedIndicator = document.getElementById('linked-indicator');

  if (isLinked) {
    linkBtn.classList.add('linked');
    linkedIndicator.className = 'linked-indicator blue';

    // Move Here indicator to Handle position & select top event
    const evt = eventsData.find(e => e.year === currentYear);
    if (evt) {
      selectedCardId = evt.id;
      highlightedCardId = null;
      scrollCardToTopPosition(evt.id);
      updateCardVisualStates();
    }
  } else {
    linkBtn.classList.remove('linked');
    linkedIndicator.className = 'linked-indicator gray';
    if (selectedCardId) {
      highlightedCardId = selectedCardId;
      selectedCardId = null;
      updateCardVisualStates();
    }
  }
  updateSystemState();
}

function stepEvent(direction) {
  const sorted = [...eventsData].sort((a,b) => a.year - b.year);
  let currentIndex = sorted.findIndex(e => e.year === currentYear);
  if (currentIndex === -1) currentIndex = 0;

  let nextIndex = currentIndex + direction;
  if (nextIndex >= 0 && nextIndex < sorted.length) {
    const nextEvt = sorted[nextIndex];
    currentYear = nextEvt.year;
    if (isLinked) {
      selectedCardId = nextEvt.id;
      scrollCardToTopPosition(nextEvt.id);
      updateCardVisualStates();
    }
    updateSystemState();
  }
}

// ==========================================
// 5. MAP FOCUS LOCK & PANEL RESIZER
// ==========================================
function initMapLockControl() {
  const lockBtn = document.getElementById('lock-view-btn');
  const lockIcon = document.getElementById('lock-icon');
  const lockText = document.getElementById('lock-text');

  lockBtn.addEventListener('click', () => {
    isMapLocked = !isMapLocked;
    if (isMapLocked) {
      lockBtn.classList.add('locked'); lockText.textContent = 'Locked';
      lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`;
      map.flyTo({ center: MA_CENTER, zoom: MA_ZOOM });
      map.dragPan.disable(); map.scrollZoom.disable();
    } else {
      lockBtn.classList.remove('locked'); lockText.textContent = 'Unlocked';
      lockIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>`;
      map.dragPan.enable(); map.scrollZoom.enable();
    }
  });
}

function initPanelResizer() {
  const resizer = document.getElementById('panel-resizer');
  const timelineSection = document.getElementById('timeline-section');
  const librarySection = document.getElementById('library-section');
  const sidebar = document.getElementById('sidebar');

  let isDragging = false;

  resizer.addEventListener('mousedown', () => { isDragging = true; resizer.classList.add('dragging'); });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const sidebarRect = sidebar.getBoundingClientRect();
    const offsetY = e.clientY - sidebarRect.top;
    const totalHeight = sidebarRect.height;

    // Enforce Hard Pixel Boundary Limits per Spec Section 4.2
    const minTimelineHeight = 34 + 34; // Header + Header height
    const minLibraryHeight = 34 + 34 + 34; // Header + Header + Path Bar

    const clampedY = Math.max(minTimelineHeight, Math.min(totalHeight - minLibraryHeight, offsetY));
    const topPercent = (clampedY / totalHeight) * 100;

    timelineSection.style.height = `${topPercent}%`;
    librarySection.style.height = `${100 - topPercent}%`;
  });
  document.addEventListener('mouseup', () => { if (isDragging) { isDragging = false; resizer.classList.remove('dragging'); } });
}

function initPanelMinimization() {
  const timeline = document.getElementById('timeline-section');
  const library = document.getElementById('library-section');
  const minimizeBtns = document.querySelectorAll('.minimize-btn');

  function updateMinimizeButtons() {
    const isAnyMinimized = timeline.classList.contains('minimized') || library.classList.contains('minimized');
    minimizeBtns.forEach(btn => btn.classList.toggle('hidden-btn', isAnyMinimized));
  }

  function resetSizes() {
    timeline.classList.remove('minimized'); library.classList.remove('minimized');
    timeline.style.height = '60%'; library.style.height = '40%';
    updateMinimizeButtons();
  }

  document.querySelectorAll('.default-btn').forEach(btn => btn.addEventListener('click', resetSizes));

  timeline.querySelector('.controls-right .minimize-btn')?.addEventListener('click', () => {
    timeline.classList.add('minimized'); library.classList.remove('minimized');
    library.style.height = 'calc(100% - 34px)'; updateMinimizeButtons();
  });

  library.querySelector('.controls-right .minimize-btn')?.addEventListener('click', () => {
    library.classList.add('minimized'); timeline.classList.remove('minimized');
    timeline.style.height = 'calc(100% - 34px)'; updateMinimizeButtons();
  });

  timeline.querySelector('.stripe-bar').addEventListener('click', resetSizes);
  library.querySelector('.stripe-bar').addEventListener('click', resetSizes);
}

// ==========================================
// 6. LIBRARY PANEL & PATH BAR
// ==========================================
const libraryStore = {
  root: { title: "Home", type: "folder", children: [{ id: "folder-figures", title: "Notable Figures", type: "folder", icon: "📁" }, { id: "folder-events", title: "Key Events", type: "folder", icon: "📁" }] },
  "folder-figures": { title: "Notable Figures", path: ["Home", "Notable Figures"], type: "folder", children: [{ id: "john-winthrop", title: "John Winthrop", type: "card", icon: "👤" }] },
  "folder-events": { title: "Key Events", path: ["Home", "Key Events"], type: "folder", children: [{ id: "dedham-grant", title: "Dedham Plantation Grant", type: "card", icon: "📜" }] },
  "john-winthrop": { type: "card", title: "John Winthrop (1588–1649)", path: ["Home", "Notable Figures", "John Winthrop"], category: "Notable Figures", content: "English Puritan lawyer and one of the leading figures in founding the Massachusetts Bay Colony." },
  "dedham-grant": { type: "card", title: "Dedham Plantation Grant (1636)", path: ["Home", "Key Events", "Dedham Plantation Grant"], category: "Key Events", content: "In 1636, the General Court granted a vast tract of land southwest of Boston to form Dedham." }
};

function initLibrary() {
  const backBtn = document.getElementById("lib-back");
  const fwdBtn = document.getElementById("lib-forward");
  const toggleBtn = document.getElementById("toggle-path-btn");
  const pathBar = document.getElementById("library-path-row");
  const icon = document.getElementById("path-toggle-icon");

  backBtn.addEventListener("click", () => { if (historyIndex > 0) { historyIndex--; renderLibraryView(historyStack[historyIndex]); } });
  fwdBtn.addEventListener("click", () => { if (historyIndex < historyStack.length - 1) { historyIndex++; renderLibraryView(historyStack[historyIndex]); } });

  toggleBtn.addEventListener("click", () => {
    pathBar.classList.toggle("hidden-text");
    const isHidden = pathBar.classList.contains("hidden-text");
    icon.innerHTML = isHidden
      ? `<rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"/>`
      : `<rect x="2" y="2" width="12" height="12" fill="currentColor"/>`;
  });

  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("library-link")) {
      e.preventDefault();
      const cardId = e.target.dataset.cardId;
      if (cardId && libraryStore[cardId]) navigateToLibrary(cardId);
    }
  });

  renderLibraryView("root");
}

function navigateToLibrary(id) {
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(id); historyIndex = historyStack.length - 1;
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

  const pathArray = item.path || ["Home"];
  pathTextEl.innerHTML = pathArray.map((p, i) => `<a onclick="navigateToLibrary('${i === 0 ? 'root' : id}')">${p}</a>`).join(" &gt; ");

  if (item.type === "folder") {
    let gridHtml = `<div class="explorer-grid">`;
    item.children.forEach(child => {
      gridHtml += `<div class="explorer-item" onclick="navigateToLibrary('${child.id}')"><div class="explorer-icon">${child.icon}</div><div class="explorer-label">${child.title}</div></div>`;
    });
    gridHtml += `</div>`;
    contentEl.innerHTML = gridHtml;
  } else {
    contentEl.innerHTML = `<div class="info-card"><div class="card-category">${item.category}</div><h3>${item.title}</h3><p>${item.content}</p></div>`;
  }
}