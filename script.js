const STORAGE_KEY = 'yards_v1';
const ACTIVE_KEY = 'yards_active_id_v1';
const THEME_KEY = 'ssmanager_theme_v1';
const TAB_KEY = 'ssmanager_active_tab_v1';
const containerDepthFt = 8;
const DOOR_LENGTH_FT = 3;
const DOOR_THICKNESS_FT = 0.75;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 6;
const DOOR_EDGES = ['north', 'south', 'east', 'west'];

/** @type {const} */
const containerTypes = [
  { type: '8ft', widthFt: 8 },
  { type: '10ft', widthFt: 10 },
  { type: '20ft', widthFt: 20 },
  { type: '40ft', widthFt: 40 },
  { type: '45ft', widthFt: 45 },
];

const containerTypeKeys = containerTypes.map((item) => item.type);

const ftToUnitFactor = {
  ft: 1,
  m: 0.3048,
  cm: 30.48,
};

const state = {
  yards: [],
  activeYardId: null,
  snapEnabled: true,
  baseScale: 1,
  scale: 1,
  view: { zoom: 1, panX: 0, panY: 0, userAdjusted: false },
  theme: 'light',
  activeTab: 'layout',
};

let selectedContainerId = null;
let currentDrag = null;
let hintTimeout = null;
let lastRenderedYardId = null;

const panState = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  originPanX: 0,
  originPanY: 0,
};

const els = {
  appShell: document.querySelector('.app-shell'),
  tabLinks: Array.from(document.querySelectorAll('.tab-link')),
  tabPanels: {
    layout: document.getElementById('layoutPanel'),
    yards: document.getElementById('yardsPanel'),
    settings: document.getElementById('settingsPanel'),
    occupants: document.getElementById('occupantsPanel'),
  },
  yardList: document.getElementById('yardList'),
  newYardBtn: document.getElementById('newYardBtn'),
  renameYardBtn: document.getElementById('renameYardBtn'),
  duplicateYardBtn: document.getElementById('duplicateYardBtn'),
  deleteYardBtn: document.getElementById('deleteYardBtn'),
  paletteItems: document.getElementById('paletteItems'),
  defaultRatesForm: document.getElementById('defaultRatesForm'),
  snapToggle: document.getElementById('snapToggle'),
  yardSummary: document.getElementById('yardSummary'),
  scaleInfo: document.getElementById('scaleInfo'),
  hint: document.getElementById('hint'),
  yardSvg: document.getElementById('yardSvg'),
  emptyState: document.getElementById('emptyState'),
  yardWrapper: document.getElementById('yardWrapper'),
  yardModal: document.getElementById('yardModal'),
  yardForm: document.getElementById('yardForm'),
  yardNameInput: document.getElementById('yardNameInput'),
  yardWidthInput: document.getElementById('yardWidthInput'),
  yardHeightInput: document.getElementById('yardHeightInput'),
  yardUnitSelect: document.getElementById('yardUnitSelect'),
  yardModalClose: document.getElementById('yardModalClose'),
  yardModalCancel: document.getElementById('yardModalCancel'),
  layerTabs: document.getElementById('layerTabs'),
  addLayerBtn: document.getElementById('addLayerBtn'),
  renameLayerBtn: document.getElementById('renameLayerBtn'),
  deleteLayerBtn: document.getElementById('deleteLayerBtn'),
  containerDetails: document.getElementById('containerDetails'),
  detailsCloseBtn: document.getElementById('detailsCloseBtn'),
  detailPlaceholder: document.getElementById('detailPlaceholder'),
  containerForm: document.getElementById('containerForm'),
  detailTitle: document.getElementById('detailTitle'),
  detailRenter: document.getElementById('detailRenter'),
  detailEmail: document.getElementById('detailEmail'),
  detailPhone: document.getElementById('detailPhone'),
  detailAddress: document.getElementById('detailAddress'),
  detailStartDate: document.getElementById('detailStartDate'),
  detailRate: document.getElementById('detailRate'),
  detailOccupied: document.getElementById('detailOccupied'),
  customFieldContainer: document.getElementById('customFieldContainer'),
  doorList: document.getElementById('doorList'),
  addDoorBtn: document.getElementById('addDoorBtn'),
  customFieldForm: document.getElementById('customFieldForm'),
  customFieldLabel: document.getElementById('customFieldLabel'),
  customFieldType: document.getElementById('customFieldType'),
  customFieldList: document.getElementById('customFieldList'),
  occupantTableHead: document.getElementById('occupantTableHead'),
  occupantTableBody: document.getElementById('occupantTableBody'),
  themeToggle: document.getElementById('themeToggle'),
};
const createYardTriggers = Array.from(document.querySelectorAll('[data-trigger="create-yard"]'));

const defaultRateInputs = {};

init();

function init() {
  loadState();
  renderPalette();
  mapDefaultRateInputs();
  attachEventListeners();
  renderAll();
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        state.yards = parsed.map(upgradeYard).filter(Boolean);
      }
    }
    const activeId = localStorage.getItem(ACTIVE_KEY);
    if (activeId) {
      state.activeYardId = activeId;
    }
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      state.theme = storedTheme;
    }
    const storedTab = localStorage.getItem(TAB_KEY);
    if (['layout', 'yards', 'settings', 'occupants'].includes(storedTab)) {
      state.activeTab = storedTab;
    }
  } catch (err) {
    console.warn('Failed to load yards from storage', err);
    state.yards = [];
    state.activeYardId = null;
    state.theme = 'light';
    state.activeTab = 'layout';
  }
  if (!state.activeYardId && state.yards.length > 0) {
    state.activeYardId = state.yards[0].id;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.yards));
  if (state.activeYardId) {
    localStorage.setItem(ACTIVE_KEY, state.activeYardId);
  }
  localStorage.setItem(THEME_KEY, state.theme);
  localStorage.setItem(TAB_KEY, state.activeTab);
}

function upgradeYard(yard) {
  if (!yard || typeof yard !== 'object') {
    return null;
  }
  const width = Number(yard.width);
  const height = Number(yard.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  const safeUnit = ['ft', 'm', 'cm'].includes(yard.unit) ? yard.unit : 'ft';
  const name = typeof yard.name === 'string' && yard.name.trim() ? yard.name.trim() : 'Untitled Yard';

  const legacyContainers = Array.isArray(yard.containers)
    ? yard.containers.map(upgradeContainer).filter(Boolean)
    : [];

  let layers = Array.isArray(yard.layers)
    ? yard.layers
        .map((layer, index) => upgradeLayer(layer, layer?.name || `Layer ${index + 1}`))
        .filter(Boolean)
    : [];

  if (!layers.length) {
    layers = [
      {
        id: generateId(),
        name: 'Ground Level',
        containers: legacyContainers,
      },
    ];
  } else if (legacyContainers.length) {
    const seen = new Set();
    layers.forEach((layer) => {
      layer.containers.forEach((container) => seen.add(container.id));
    });
    legacyContainers.forEach((container) => {
      if (!seen.has(container.id)) {
        layers[0].containers.push(container);
        seen.add(container.id);
      }
    });
  }

  const defaultRates = sanitizeDefaultRates(yard.defaultRates);
  const customFields = sanitizeCustomFields(yard.customFields);
  const activeLayerId = layers.some((layer) => layer.id === yard.activeLayerId)
    ? yard.activeLayerId
    : layers[0].id;
  const allContainers = layers.flatMap((layer) => layer.containers);
  const nextNumber = smallestAvailableNumericLabel(allContainers);

  const result = {
    id: yard.id || generateId(),
    name,
    width: Number(width.toFixed(3)),
    height: Number(height.toFixed(3)),
    unit: safeUnit,
    layers,
    activeLayerId,
    defaultRates,
    customFields,
    nextContainerNumber: nextNumber,
  };
  result.layers.forEach((layer) => {
    layer.containers.forEach((container) => ensureContainerCustomValues(result, container));
  });
  result.nextContainerNumber = ensureNextContainerNumber(result);
  return result;
}

function upgradeLayer(layer, fallbackName) {
  const name = typeof layer?.name === 'string' && layer.name.trim() ? layer.name.trim() : fallbackName;
  const containers = Array.isArray(layer?.containers)
    ? layer.containers.map(upgradeContainer).filter(Boolean)
    : [];
  return {
    id: layer?.id || generateId(),
    name,
    containers,
  };
}

function createDefaultRates() {
  const defaults = {};
  containerTypeKeys.forEach((key) => {
    defaults[key] = '';
  });
  return defaults;
}

function sanitizeDefaultRates(rates) {
  const defaults = createDefaultRates();
  if (!rates || typeof rates !== 'object') {
    return defaults;
  }
  containerTypeKeys.forEach((key) => {
    if (rates[key] !== undefined && rates[key] !== null && rates[key] !== '') {
      defaults[key] = String(rates[key]);
    }
  });
  return defaults;
}

function sanitizeCustomFields(fields) {
  if (!Array.isArray(fields)) {
    return [];
  }
  const result = [];
  fields.forEach((field) => {
    if (!field || typeof field !== 'object') return;
    const rawLabel = typeof field.label === 'string' ? field.label.trim() : '';
    if (!rawLabel) return;
    const type = field.type === 'boolean' ? 'boolean' : 'text';
    result.push({
      id: field.id || generateId(),
      label: rawLabel,
      type,
    });
  });
  return result;
}

function sanitizeCustomValues(values) {
  if (!values || typeof values !== 'object') {
    return {};
  }
  const result = {};
  Object.keys(values).forEach((key) => {
    const value = values[key];
    if (typeof value === 'boolean' || typeof value === 'string' || value === null) {
      result[key] = value;
    }
  });
  return result;
}

function ensureContainerCustomValues(yard, container) {
  if (!yard || !container) {
    return;
  }
  container.customValues = sanitizeCustomValues(container.customValues);
  const values = container.customValues;
  const fields = Array.isArray(yard.customFields) ? yard.customFields : [];
  fields.forEach((field) => {
    if (!(field.id in values)) {
      values[field.id] = field.type === 'boolean' ? false : '';
    } else if (field.type === 'boolean') {
      values[field.id] = Boolean(values[field.id]);
    } else {
      values[field.id] = values[field.id] != null ? String(values[field.id]) : '';
    }
  });
  Object.keys(values).forEach((key) => {
    if (!fields.some((field) => field.id === key)) {
      delete values[key];
    }
  });
}

function nextAvailableSequence(usedSequences) {
  let candidate = 1;
  if (usedSequences && usedSequences.size) {
    while (usedSequences.has(candidate)) {
      candidate += 1;
    }
  }
  return candidate;
}

function findLayerById(yard, layerId) {
  if (!yard || !Array.isArray(yard.layers)) {
    return null;
  }
  return yard.layers.find((layer) => layer.id === layerId) || null;
}

function getActiveLayer(yard) {
  if (!yard) return null;
  const current = findLayerById(yard, yard.activeLayerId);
  if (current) {
    return current;
  }
  if (Array.isArray(yard.layers) && yard.layers.length > 0) {
    const fallback = yard.layers[0];
    yard.activeLayerId = fallback.id;
    return fallback;
  }
  return null;
}

function getActiveLayerContainers(yard) {
  const layer = getActiveLayer(yard);
  return layer ? layer.containers : [];
}

function getAllContainers(yard) {
  if (!yard || !Array.isArray(yard.layers)) {
    return [];
  }
  return yard.layers.flatMap((layer) => layer.containers);
}

function findContainerEntry(yard, containerId) {
  if (!yard || !containerId || !Array.isArray(yard.layers)) {
    return null;
  }
  for (const layer of yard.layers) {
    const index = layer.containers.findIndex((container) => container.id === containerId);
    if (index !== -1) {
      return { layer, container: layer.containers[index], index };
    }
  }
  return null;
}

function upgradeContainer(container) {
  if (!container || typeof container !== 'object') {
    return null;
  }
  const widthFt = Number(container.widthFt) || Number(container.width) || 10;
  const baseLabel =
    typeof container.label === 'string' && container.label.trim()
      ? container.label.trim()
      : `${widthFt}`;
  return {
    id: container.id || generateId(),
    type: container.type || `${widthFt}ft`,
    widthFt,
    x: Number.isFinite(container.x) ? container.x : 0,
    y: Number.isFinite(container.y) ? container.y : 0,
    rotation: container.rotation === 90 ? 90 : 0,
    label: baseLabel,
    renter: container.renter ? String(container.renter) : '',
    monthlyRate: container.monthlyRate ? String(container.monthlyRate) : '',
    phone: container.phone ? String(container.phone) : '',
    email: container.email ? String(container.email) : '',
    address: container.address ? String(container.address) : '',
    startDate:
      typeof container.startDate === 'string' && container.startDate.trim()
        ? container.startDate.trim()
        : '',
    occupied:
      typeof container.occupied === 'boolean'
        ? container.occupied
        : Boolean(container.renter && String(container.renter).trim()),
    doors: sanitizeDoors(container.doors),
    customValues: sanitizeCustomValues(container.customValues),
  };
}

function parseNumericLabel(label) {
  if (typeof label !== 'string') {
    return null;
  }
  const trimmed = label.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return null;
  }
  const value = Number.parseInt(trimmed, 10);
  return Number.isFinite(value) ? value : null;
}

function smallestAvailableNumericLabel(containers) {
  if (!Array.isArray(containers) || containers.length === 0) {
    return 1;
  }
  const used = new Set();
  containers.forEach((container) => {
    const value = parseNumericLabel(container?.label);
    if (value !== null) {
      used.add(value);
    }
  });
  let candidate = 1;
  while (used.has(candidate)) {
    candidate += 1;
  }
  return candidate;
}

function ensureNextContainerNumber(yard) {
  const next = smallestAvailableNumericLabel(getAllContainers(yard));
  if (yard) {
    yard.nextContainerNumber = next;
  }
  return next;
}

function previewNextContainerLabel(yard) {
  const next = ensureNextContainerNumber(yard);
  return String(next);
}

function commitNextContainerLabel(yard) {
  if (!yard) {
    return;
  }
  ensureNextContainerNumber(yard);
}

function sanitizeDoors(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((door) => {
      if (!door || typeof door !== 'object') return null;
      const edge = DOOR_EDGES.includes(door.edge) ? door.edge : 'north';
      let offset = Number(door.offset);
      if (!Number.isFinite(offset)) {
        offset = 0.5;
      }
      offset = Math.min(Math.max(offset, 0), 1);
      return {
        id: door.id || generateId(),
        edge,
        offset,
      };
    })
    .filter(Boolean);
}

function attachEventListeners() {
  els.newYardBtn.addEventListener('click', openYardModal);
  createYardTriggers.forEach((button) => button.addEventListener('click', openYardModal));
  els.renameYardBtn.addEventListener('click', handleRenameYard);
  els.duplicateYardBtn.addEventListener('click', handleDuplicateYard);
  els.deleteYardBtn.addEventListener('click', handleDeleteYard);
  els.snapToggle.addEventListener('change', () => {
    state.snapEnabled = els.snapToggle.checked;
    renderScaleInfo();
  });

  els.tabLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const tab = link.dataset.tab;
      if (!tab || tab === state.activeTab) return;
      setActiveTab(tab);
    });
  });

  if (els.defaultRatesForm) {
    els.defaultRatesForm.addEventListener('input', handleDefaultRateInput);
  }

  if (els.customFieldForm) {
    els.customFieldForm.addEventListener('submit', handleCustomFieldFormSubmit);
  }
  if (els.customFieldList) {
    els.customFieldList.addEventListener('click', handleCustomFieldListClick);
  }

  if (els.layerTabs) {
    els.layerTabs.addEventListener('click', handleLayerTabClick);
  }
  if (els.addLayerBtn) {
    els.addLayerBtn.addEventListener('click', handleAddLayer);
  }
  if (els.renameLayerBtn) {
    els.renameLayerBtn.addEventListener('click', handleRenameLayer);
  }
  if (els.deleteLayerBtn) {
    els.deleteLayerBtn.addEventListener('click', handleDeleteLayer);
  }

  if (els.themeToggle) {
    els.themeToggle.addEventListener('change', () => {
      state.theme = els.themeToggle.checked ? 'dark' : 'light';
      applyTheme();
      saveState();
      renderActiveYard();
    });
  }

  if (els.detailsCloseBtn) {
    els.detailsCloseBtn.addEventListener('click', () => selectContainer(null));
  }

  els.yardSvg.addEventListener('pointerdown', (event) => {
    if (event.target === els.yardSvg) {
      selectContainer(null);
    }
  });

  els.yardSvg.addEventListener('pointermove', handlePointerMove);
  els.yardSvg.addEventListener('pointerup', handlePointerUp);
  els.yardSvg.addEventListener('pointercancel', handlePointerUp);

  document.addEventListener('pointermove', handleGlobalPointerMove);
  document.addEventListener('pointerup', handleGlobalPointerUp);
  document.addEventListener('keydown', handleGlobalKeyDown);
  window.addEventListener('resize', () => renderActiveYard());

  els.yardForm.addEventListener('submit', handleYardFormSubmit);
  els.yardModalClose.addEventListener('click', closeYardModal);
  els.yardModalCancel.addEventListener('click', closeYardModal);
  els.yardModal.addEventListener('click', (event) => {
    if (event.target === els.yardModal) {
      closeYardModal();
    }
  });

  els.containerForm.addEventListener('input', handleDetailInput);
  els.containerForm.addEventListener('submit', (event) => event.preventDefault());

  if (els.addDoorBtn) {
    els.addDoorBtn.addEventListener('click', handleAddDoor);
  }
  if (els.doorList) {
    els.doorList.addEventListener('input', handleDoorListChange);
    els.doorList.addEventListener('change', handleDoorListChange);
    els.doorList.addEventListener('click', handleDoorListClick);
  }

  if (els.yardWrapper) {
    els.yardWrapper.addEventListener('wheel', handleWheel, { passive: false });
    els.yardWrapper.addEventListener('pointerdown', handleViewPointerDown);
  }
  document.addEventListener('pointermove', handleViewPointerMove);
  document.addEventListener('pointerup', handleViewPointerUp);
  document.addEventListener('pointercancel', handleViewPointerUp);
}

function renderAll() {
  applyTheme();
  setActiveTab(state.activeTab, { force: true, silent: true });
  renderYardList();
  renderDefaultRates();
  renderLayerList();
  renderActiveYard();
  renderScaleInfo();
  renderCustomFieldList();
  renderOccupantTable();
  updateDetailPanel();
}

function setActiveTab(tab, options = {}) {
  const allowed = ['layout', 'yards', 'settings', 'occupants'];
  const targetTab = allowed.includes(tab) ? tab : 'layout';
  const { force = false, silent = false } = options;
  if (!force && state.activeTab === targetTab) {
    return;
  }
  state.activeTab = targetTab;
  els.tabLinks.forEach((link) => {
    const isActive = link.dataset.tab === targetTab;
    link.classList.toggle('is-active', isActive);
    link.setAttribute('aria-selected', String(isActive));
  });
  Object.entries(els.tabPanels).forEach(([key, panel]) => {
    if (!panel) return;
    const active = key === targetTab;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });
  if (!silent) {
    saveState();
  }
  if (!silent) {
    if (targetTab === 'layout') {
      renderActiveYard();
      updateDetailPanel();
    } else if (targetTab === 'yards') {
      renderYardList();
    } else if (targetTab === 'settings') {
      renderDefaultRates();
      renderCustomFieldList();
    } else if (targetTab === 'occupants') {
      renderOccupantTable();
    }
  }
}

function renderPalette() {
  els.paletteItems.innerHTML = '';
  const longest = Math.max(...containerTypes.map((type) => type.widthFt));
  containerTypes.forEach((type) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'palette-item';
    item.dataset.type = type.type;
    item.setAttribute('aria-label', `${type.widthFt} ft container`);
    const mini = document.createElement('span');
    mini.className = 'palette-mini';
    const relative = Math.max((type.widthFt / longest) * 72, 16);
    mini.style.width = `${relative}px`;

    const label = document.createElement('span');
    label.textContent = `${type.widthFt} ft container`;

    item.appendChild(mini);
    item.appendChild(label);
    item.addEventListener('pointerdown', (event) => startPaletteDrag(event, type));
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        startPaletteDragFromKeyboard(type);
      }
    });
    els.paletteItems.appendChild(item);
  });
}

function mapDefaultRateInputs() {
  if (!els.defaultRatesForm) return;
  containerTypeKeys.forEach((key) => {
    const input = els.defaultRatesForm.querySelector(`[name="${key}"]`);
    if (input) {
      defaultRateInputs[key] = input;
    }
  });
}

function renderDefaultRates() {
  if (!els.defaultRatesForm) return;
  const yard = getActiveYard();
  const disabled = !yard;
  els.defaultRatesForm.classList.toggle('is-disabled', disabled);
  containerTypeKeys.forEach((key) => {
    const input = defaultRateInputs[key];
    if (!input) return;
    input.disabled = disabled;
    input.value = yard ? yard.defaultRates?.[key] ?? '' : '';
  });
}

function handleDefaultRateInput(event) {
  if (!(event.target instanceof HTMLInputElement)) {
    return;
  }
  const key = event.target.name;
  if (!containerTypeKeys.includes(key)) {
    return;
  }
  const yard = getActiveYard();
  if (!yard) {
    event.target.value = '';
    return;
  }
  yard.defaultRates[key] = event.target.value;
  saveState();
}

function handleCustomFieldFormSubmit(event) {
  event.preventDefault();
  const yard = getActiveYard();
  if (!yard) {
    return;
  }
  const labelInput = els.customFieldLabel;
  const typeSelect = els.customFieldType;
  const label = labelInput ? labelInput.value.trim() : '';
  const typeValue = typeSelect ? typeSelect.value : 'text';
  if (!label) {
    showHint('Enter a label for the custom field.');
    if (labelInput) labelInput.focus();
    return;
  }
  const type = typeValue === 'boolean' ? 'boolean' : 'text';
  const field = { id: generateId(), label, type };
  yard.customFields.push(field);
  yard.layers.forEach((layer) => {
    layer.containers.forEach((container) => ensureContainerCustomValues(yard, container));
  });
  if (labelInput) {
    labelInput.value = '';
  }
  if (typeSelect) {
    typeSelect.value = 'boolean';
  }
  saveState();
  renderCustomFieldList();
  renderOccupantTable();
  updateDetailPanel();
}

function handleCustomFieldListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.matches('[data-action="remove-field"]')) return;
  const fieldId = target.dataset.fieldId;
  if (!fieldId) return;
  const yard = getActiveYard();
  if (!yard) return;
  yard.customFields = yard.customFields.filter((field) => field.id !== fieldId);
  yard.layers.forEach((layer) => {
    layer.containers.forEach((container) => {
      if (container.customValues && fieldId in container.customValues) {
        delete container.customValues[fieldId];
      }
    });
  });
  saveState();
  renderCustomFieldList();
  renderOccupantTable();
  updateDetailPanel();
}

function renderCustomFieldList() {
  if (!els.customFieldList || !els.customFieldForm) return;
  const yard = getActiveYard();
  const inputs = [els.customFieldLabel, els.customFieldType, els.customFieldForm.querySelector('button[type="submit"]')];
  const disable = !yard;
  inputs.forEach((input) => {
    if (input) {
      input.disabled = disable;
    }
  });
  els.customFieldList.innerHTML = '';
  if (!yard) {
    const empty = document.createElement('p');
    empty.className = 'custom-empty';
    empty.textContent = 'Create a yard to manage custom fields.';
    els.customFieldList.appendChild(empty);
    return;
  }

  yard.customFields = sanitizeCustomFields(yard.customFields);
  yard.layers.forEach((layer) => {
    layer.containers.forEach((container) => ensureContainerCustomValues(yard, container));
  });
  if (!yard.customFields.length) {
    const empty = document.createElement('p');
    empty.className = 'custom-empty';
    empty.textContent = 'No custom fields yet.';
    els.customFieldList.appendChild(empty);
    return;
  }

  yard.customFields.forEach((field) => {
    const item = document.createElement('div');
    item.className = 'custom-field-item';
    item.dataset.fieldId = field.id;

    const info = document.createElement('div');
    info.className = 'custom-field-info';
    const label = document.createElement('strong');
    label.textContent = field.label;
    const type = document.createElement('span');
    type.className = 'custom-field-type';
    type.textContent = field.type === 'boolean' ? 'Toggle' : 'Text';
    info.appendChild(label);
    info.appendChild(type);

    const actions = document.createElement('div');
    actions.className = 'custom-field-controls';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-danger';
    remove.dataset.action = 'remove-field';
    remove.dataset.fieldId = field.id;
    remove.textContent = 'Remove';
    actions.appendChild(remove);

    item.appendChild(info);
    item.appendChild(actions);
    els.customFieldList.appendChild(item);
  });
}

function renderOccupantTable() {
  if (!els.occupantTableHead || !els.occupantTableBody) return;
  const yard = getActiveYard();
  els.occupantTableHead.innerHTML = '';
  els.occupantTableBody.innerHTML = '';

  const headRow = document.createElement('tr');
  const baseColumns = [
    'Container',
    'Size',
    'Renter',
    'Phone',
    'Email',
    'Address',
    'Start date',
    'Monthly rate',
    'Occupied',
  ];
  baseColumns.forEach((label) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    headRow.appendChild(th);
  });
  const customFields = yard ? yard.customFields : [];
  if (Array.isArray(customFields)) {
    customFields.forEach((field) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = field.label;
      headRow.appendChild(th);
    });
  }
  els.occupantTableHead.appendChild(headRow);

  if (!yard) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = baseColumns.length + (customFields?.length || 0);
    cell.textContent = 'Create a yard to view container occupants.';
    row.appendChild(cell);
    els.occupantTableBody.appendChild(row);
    return;
  }

  const containers = getAllContainers(yard);
  if (!containers.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = baseColumns.length + (customFields?.length || 0);
    cell.textContent = 'No containers yet.';
    row.appendChild(cell);
    els.occupantTableBody.appendChild(row);
    return;
  }

  const sorted = containers.slice().sort((a, b) => {
    const aNum = parseNumericLabel(a.label);
    const bNum = parseNumericLabel(b.label);
    if (aNum !== null && bNum !== null) {
      return aNum - bNum;
    }
    return String(a.label || '').localeCompare(String(b.label || ''));
  });

  sorted.forEach((container) => {
    const row = document.createElement('tr');
    const label = container.label && container.label.trim() ? container.label.trim() : `${container.widthFt}`;
    const rateNumber = Number(container.monthlyRate);
    const cells = [
      label,
      `${container.widthFt} ft`,
      container.renter || '—',
      container.phone || '—',
      container.email || '—',
      container.address || '—',
      container.startDate || '—',
      container.monthlyRate && Number.isFinite(rateNumber) ? formatCurrency(rateNumber) : '—',
      container.occupied ? 'Yes' : 'No',
    ];
    cells.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      row.appendChild(td);
    });
    if (Array.isArray(customFields)) {
      customFields.forEach((field) => {
        const td = document.createElement('td');
        const raw = container.customValues ? container.customValues[field.id] : undefined;
        if (field.type === 'boolean') {
          td.textContent = raw ? 'Yes' : 'No';
        } else {
          td.textContent = raw ? String(raw) : '—';
        }
        row.appendChild(td);
      });
    }
    els.occupantTableBody.appendChild(row);
  });
}

function renderYardList() {
  els.yardList.innerHTML = '';
  state.yards.forEach((yard) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    const title = document.createElement('span');
    title.className = 'yard-name';
    title.textContent = yard.name;

    const meta = document.createElement('span');
    meta.className = 'yard-meta';
    const layerCount = Array.isArray(yard.layers) ? yard.layers.length : 0;
    const totalContainers = getAllContainers(yard).length;
    const layerLabel = `${layerCount} layer${layerCount === 1 ? '' : 's'}`;
    const containerLabel = `${totalContainers} container${totalContainers === 1 ? '' : 's'}`;
    meta.textContent = `${formatNumber(yard.width)}×${formatNumber(yard.height)} ${yard.unit} • ${layerLabel} • ${containerLabel}`;

    button.appendChild(title);
    button.appendChild(meta);
    button.classList.toggle('is-active', yard.id === state.activeYardId);
    button.addEventListener('click', () => {
      state.activeYardId = yard.id;
      saveState();
      selectedContainerId = null;
      renderAll();
    });
    li.appendChild(button);
    els.yardList.appendChild(li);
  });
}

function renderLayerList() {
  if (!els.layerTabs) return;
  const yard = getActiveYard();
  els.layerTabs.innerHTML = '';
  if (!yard) {
    if (els.addLayerBtn) {
      els.addLayerBtn.disabled = true;
    }
    if (els.renameLayerBtn) {
      els.renameLayerBtn.disabled = true;
    }
    if (els.deleteLayerBtn) {
      els.deleteLayerBtn.disabled = true;
    }
    const empty = document.createElement('p');
    empty.className = 'layer-empty';
    empty.textContent = 'Create a yard to manage layers.';
    els.layerTabs.appendChild(empty);
    return;
  }

  const layers = Array.isArray(yard.layers) ? yard.layers : [];
  layers.forEach((layer) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'layer-tab';
    button.dataset.layerId = layer.id;
    const label = document.createElement('span');
    label.className = 'layer-tab-label';
    label.textContent = layer.name;
    const count = document.createElement('span');
    count.className = 'layer-tab-count';
    count.textContent = `${layer.containers.length}`;
    button.appendChild(label);
    button.appendChild(count);
    button.classList.toggle('is-active', layer.id === yard.activeLayerId);
    els.layerTabs.appendChild(button);
  });

  if (els.addLayerBtn) {
    els.addLayerBtn.disabled = false;
  }
  if (els.renameLayerBtn) {
    els.renameLayerBtn.disabled = !layers.length;
  }
  if (els.deleteLayerBtn) {
    els.deleteLayerBtn.disabled = layers.length <= 1;
  }
}

function handleLayerTabClick(event) {
  const button = event.target.closest('.layer-tab');
  if (!button) return;
  const layerId = button.dataset.layerId;
  if (!layerId) return;
  const yard = getActiveYard();
  if (!yard || yard.activeLayerId === layerId) return;
  const targetLayer = findLayerById(yard, layerId);
  if (!targetLayer) return;
  yard.activeLayerId = layerId;
  selectedContainerId = null;
  saveState();
  renderAll();
}

function handleAddLayer() {
  const yard = getActiveYard();
  if (!yard) {
    showHint('Create a yard before adding layers.');
    return;
  }
  const defaultName = `Layer ${yard.layers.length + 1}`;
  const name = prompt('Layer name', defaultName);
  if (name === null) {
    return;
  }
  const trimmed = name.trim() || defaultName;
  const layer = {
    id: generateId(),
    name: trimmed,
    containers: [],
  };
  yard.layers.push(layer);
  yard.activeLayerId = layer.id;
  ensureNextContainerNumber(yard);
  saveState();
  renderAll();
  showHint('Layer added.');
}

function handleRenameLayer() {
  const yard = getActiveYard();
  if (!yard) return;
  const layer = getActiveLayer(yard);
  if (!layer) return;
  const name = prompt('Rename layer', layer.name);
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  layer.name = trimmed;
  saveState();
  renderAll();
}

function handleDeleteLayer() {
  const yard = getActiveYard();
  if (!yard) return;
  const layers = Array.isArray(yard.layers) ? yard.layers : [];
  if (layers.length <= 1) {
    showHint('At least one layer is required.');
    return;
  }
  const layer = getActiveLayer(yard);
  if (!layer) return;
  if (!confirm(`Delete layer "${layer.name}" and its containers?`)) {
    return;
  }
  yard.layers = layers.filter((item) => item.id !== layer.id);
  yard.activeLayerId = yard.layers[0]?.id || null;
  selectedContainerId = null;
  ensureNextContainerNumber(yard);
  saveState();
  renderAll();
}

function renderActiveYard() {
  const yard = getActiveYard();
  const previouslySelected = selectedContainerId;
  els.yardSvg.innerHTML = '';

  const hasYard = Boolean(yard);
  if (els.emptyState) {
    els.emptyState.hidden = hasYard;
    els.emptyState.style.display = hasYard ? 'none' : '';
  }
  if (!yard) {
    resetViewTransform();
    lastRenderedYardId = null;
    state.baseScale = 1;
    state.scale = 1;
    els.yardSvg.style.transform = 'translate(0px, 0px) scale(1)';
    els.yardSvg.setAttribute('width', '100%');
    els.yardSvg.setAttribute('height', '100%');
    els.yardSummary.textContent = '';
    selectContainer(null);
    return;
  }

  const activeLayer = getActiveLayer(yard);
  const containers = activeLayer ? activeLayer.containers : [];
  const allContainers = getAllContainers(yard);

  if (yard.id !== lastRenderedYardId) {
    resetViewTransform();
  }

  const available = els.yardWrapper.getBoundingClientRect();
  const padding = 32;
  const availableWidth = Math.max(available.width - padding, 200);
  const availableHeight = Math.max(available.height - padding, 200);
  const scaleCandidate = Math.min(
    availableWidth / yard.width,
    availableHeight / yard.height
  );
  const minScale = 8 / convertFtToUnit(1, yard.unit);
  const previousBase = state.baseScale || 1;
  state.baseScale = Math.max(scaleCandidate, minScale);

  if (state.view.userAdjusted) {
    const ratio = state.baseScale / previousBase;
    state.view.panX *= ratio;
    state.view.panY *= ratio;
  }

  const wrapperRect = els.yardWrapper.getBoundingClientRect();
  if (!state.view.userAdjusted) {
    const baseWidthPx = yard.width * state.baseScale;
    const baseHeightPx = yard.height * state.baseScale;
    state.view.panX = (wrapperRect.width - baseWidthPx) / 2;
    state.view.panY = (wrapperRect.height - baseHeightPx) / 2;
  }

  els.yardSvg.setAttribute('viewBox', `0 0 ${yard.width} ${yard.height}`);
  els.yardSvg.setAttribute('width', yard.width * state.baseScale);
  els.yardSvg.setAttribute('height', yard.height * state.baseScale);
  els.yardSvg.style.width = `${yard.width * state.baseScale}px`;
  els.yardSvg.style.height = `${yard.height * state.baseScale}px`;

  renderGrid(yard);
  const layerIndex = yard.layers.findIndex((layer) => layer.id === activeLayer.id);
  if (layerIndex > 0) {
    yard.layers.slice(0, layerIndex).forEach((layer) => {
      renderContainers(yard, layer.containers, { onionSkin: true });
    });
  }
  renderContainers(yard, containers, { onionSkin: false });
  if (
    previouslySelected &&
    containers.some((container) => container.id === previouslySelected)
  ) {
    selectContainer(previouslySelected);
  } else {
    selectContainer(null);
  }
  applyViewTransform();
  renderScaleInfo();
  const dims = `${formatNumber(yard.width)} × ${formatNumber(yard.height)} ${yard.unit}`;
  const layerLabel = activeLayer ? `${activeLayer.name} • ${containers.length} container${containers.length === 1 ? '' : 's'}` : 'No active layer';
  const totalLabel = `${allContainers.length} total`;
  els.yardSummary.textContent = `${yard.name} • ${dims} • ${layerLabel} • ${totalLabel}`;
  lastRenderedYardId = yard.id;
}

function applyViewTransform() {
  if (!els.yardSvg) return;
  state.view.zoom = Math.min(Math.max(state.view.zoom, ZOOM_MIN), ZOOM_MAX);
  const transform = `translate(${state.view.panX}px, ${state.view.panY}px) scale(${state.view.zoom})`;
  els.yardSvg.style.transformOrigin = '0 0';
  els.yardSvg.style.transform = transform;
  state.scale = state.baseScale * state.view.zoom;
}

function resetViewTransform() {
  state.view = { zoom: 1, panX: 0, panY: 0, userAdjusted: false };
}

function renderGrid(yard) {
  const gridSize = gridUnit(yard.unit);
  const isDark = state.theme === 'dark';
  const gridStroke = isDark ? '#334155' : '#cbd5e1';
  const borderStroke = isDark ? '#475569' : '#94a3b8';
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
  pattern.setAttribute('id', 'grid-pattern');
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  pattern.setAttribute('width', gridSize);
  pattern.setAttribute('height', gridSize);

  const gridStrokeWidth = Math.max(1, Math.min(gridSize * 0.05, 2));
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', `M ${gridSize} 0 L 0 0 0 ${gridSize}`);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', gridStroke);
  path.setAttribute('stroke-width', gridStrokeWidth);
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  path.setAttribute('shape-rendering', 'crispEdges');

  pattern.appendChild(path);
  defs.appendChild(pattern);
  els.yardSvg.appendChild(defs);

  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('width', yard.width);
  background.setAttribute('height', yard.height);
  background.setAttribute('fill', 'url(#grid-pattern)');
  background.setAttribute('stroke', borderStroke);
  background.setAttribute('stroke-width', Math.max(1, Math.min(gridSize * 0.1, 2)));
  background.setAttribute('vector-effect', 'non-scaling-stroke');
  els.yardSvg.appendChild(background);
}

function renderContainers(yard, containers, options = {}) {
  const onionSkin = Boolean(options.onionSkin);
  containers.forEach((container) => {
    ensureContainerCustomValues(yard, container);
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('container-group');
    group.dataset.id = container.id;
    group.dataset.type = container.type;
    group.classList.toggle('is-occupied', Boolean(container.occupied));
    if (onionSkin) {
      group.classList.add('onion-skin');
      group.setAttribute('tabindex', '-1');
      group.setAttribute('aria-hidden', 'true');
    } else {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', `${container.label} container`);
    }

    const dims = getContainerDimensions(yard, container);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('container-rect');
    rect.setAttribute('width', dims.width);
    rect.setAttribute('height', dims.height);
    rect.setAttribute('rx', 0);
    rect.setAttribute('ry', 0);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('container-label');
    text.setAttribute('x', dims.width / 2);
    text.setAttribute('y', dims.height / 2);
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('text-anchor', 'middle');
    const labelColor = state.theme === 'dark' ? '#e2e8f0' : '#0f172a';
    text.setAttribute('fill', labelColor);
    text.setAttribute('font-size', Math.max(Math.min(dims.width, dims.height) * 0.24, 0.45));
    const labelText = container.label && String(container.label).trim() ? String(container.label).trim() : `${container.widthFt}`;
    text.textContent = labelText;

    const doorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    doorGroup.classList.add('door-group');
    const doors = Array.isArray(container.doors) ? container.doors : (container.doors = []);
    doors.forEach((door) => {
      const doorElement = createDoorElement(yard, dims, door);
      if (doorElement) {
        doorGroup.appendChild(doorElement);
      }
    });

    group.appendChild(rect);
    if (doorGroup.childNodes.length > 0) {
      group.appendChild(doorGroup);
    }
    group.appendChild(text);
    setContainerTransform(group, container.x, container.y);

    if (!onionSkin) {
      group.addEventListener('pointerdown', (event) => handleContainerPointerDown(event, container.id));
      group.addEventListener('focus', () => selectContainer(container.id));
      group.addEventListener('blur', () => {
        if (selectedContainerId === container.id) {
          selectContainer(null);
        }
      });
    }

    els.yardSvg.appendChild(group);
  });
}

function renderScaleInfo() {
  const yard = getActiveYard();
  if (!yard) {
    els.scaleInfo.textContent = '';
    return;
  }
  const unitStep = gridUnit(yard.unit);
  const gridLabel = formatNumber(unitStep);
  const zoomPercent = Math.round(state.view.zoom * 100);
  els.scaleInfo.textContent = `Scale: 1 grid ≈ ${gridLabel} ${yard.unit} • Zoom ${zoomPercent}% (${state.snapEnabled ? 'snap on' : 'snap off'})`;
  els.snapToggle.checked = state.snapEnabled;
}

function handleWheel(event) {
  const yard = getActiveYard();
  if (!yard || !els.yardWrapper) return;
  event.preventDefault();
  const wrapperRect = els.yardWrapper.getBoundingClientRect();
  const pointerX = event.clientX - wrapperRect.left;
  const pointerY = event.clientY - wrapperRect.top;
  const scaleBefore = state.baseScale * state.view.zoom;
  if (scaleBefore <= 0) {
    return;
  }
  const yardX = (pointerX - state.view.panX) / scaleBefore;
  const yardY = (pointerY - state.view.panY) / scaleBefore;
  const zoomStep = Math.exp(-event.deltaY * 0.002);
  state.view.zoom = Math.min(Math.max(state.view.zoom * zoomStep, ZOOM_MIN), ZOOM_MAX);
  const scaleAfter = state.baseScale * state.view.zoom;
  state.view.panX = pointerX - yardX * scaleAfter;
  state.view.panY = pointerY - yardY * scaleAfter;
  state.view.userAdjusted = true;
  applyViewTransform();
  renderScaleInfo();
}

function handleViewPointerDown(event) {
  if (event.button !== 1) return;
  if (!getActiveYard() || !els.yardWrapper) return;
  event.preventDefault();
  panState.active = true;
  panState.pointerId = event.pointerId;
  panState.startX = event.clientX;
  panState.startY = event.clientY;
  panState.originPanX = state.view.panX;
  panState.originPanY = state.view.panY;
  state.view.userAdjusted = true;
  els.yardWrapper.classList.add('is-panning');
  if (typeof els.yardWrapper.setPointerCapture === 'function') {
    try {
      els.yardWrapper.setPointerCapture(event.pointerId);
    } catch (err) {
      // ignore capture errors
    }
  }
}

function handleViewPointerMove(event) {
  if (!panState.active || event.pointerId !== panState.pointerId) return;
  const dx = event.clientX - panState.startX;
  const dy = event.clientY - panState.startY;
  state.view.panX = panState.originPanX + dx;
  state.view.panY = panState.originPanY + dy;
  applyViewTransform();
}

function handleViewPointerUp(event) {
  if (!panState.active || event.pointerId !== panState.pointerId) return;
  panState.active = false;
  panState.pointerId = null;
  if (els.yardWrapper) {
    els.yardWrapper.classList.remove('is-panning');
    if (typeof els.yardWrapper.releasePointerCapture === 'function') {
      try {
        els.yardWrapper.releasePointerCapture(event.pointerId);
      } catch (err) {
        // ignore release errors
      }
    }
  }
}

function startPaletteDrag(event, type) {
  event.preventDefault();
  const pointerId = event.pointerId;
  currentDrag = {
    mode: 'palette',
    pointerId,
    type,
    ghost: createGhost(type),
  };
  document.body.appendChild(currentDrag.ghost);
  updateGhostPosition(event);
  document.addEventListener('pointermove', updateGhostPosition);
}

function startPaletteDragFromKeyboard(type) {
  const yard = getActiveYard();
  if (!yard) {
    showHint('Create a yard before placing containers.');
    return;
  }
  const layer = getActiveLayer(yard);
  if (!layer) {
    showHint('Add a layer before placing containers.');
    return;
  }
  const container = createContainerFromType(yard, type);
  container.x = 0;
  container.y = 0;
  if (!isCollision(yard, container, container.id, layer)) {
    layer.containers.push(container);
    commitNextContainerLabel(yard);
    saveState();
    selectedContainerId = container.id;
    renderAll();
  } else {
    showHint('No free space at the origin. Move existing containers.');
  }
}

function updateGhostPosition(event) {
  if (!currentDrag || currentDrag.mode !== 'palette') return;
  const ghost = currentDrag.ghost;
  ghost.style.left = `${event.clientX + 12}px`;
  ghost.style.top = `${event.clientY + 12}px`;
}

function handleGlobalPointerMove(event) {
  if (currentDrag && currentDrag.mode === 'palette' && event.pointerId === currentDrag.pointerId) {
    updateGhostPosition(event);
  }
}

function handleGlobalPointerUp(event) {
  if (!currentDrag) return;
  if (currentDrag.mode === 'palette' && event.pointerId === currentDrag.pointerId) {
    finishPaletteDrag(event);
  }
}

function finishPaletteDrag(event) {
  document.removeEventListener('pointermove', updateGhostPosition);
  if (currentDrag?.ghost) {
    currentDrag.ghost.remove();
  }
  const yard = getActiveYard();
  if (!yard) {
    showHint('Create a yard before placing containers.');
    currentDrag = null;
    return;
  }
  const layer = getActiveLayer(yard);
  if (!layer) {
    showHint('Add a layer before placing containers.');
    currentDrag = null;
    return;
  }
  const rect = els.yardSvg.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  ) {
    currentDrag = null;
    return;
  }

  const pointer = yardPointerToUnits(event);
  const container = createContainerFromType(yard, currentDrag.type);
  const dims = getContainerDimensions(yard, container);
  let x = pointer.x - dims.width / 2;
  let y = pointer.y - dims.height / 2;

  if (state.snapEnabled) {
    x = snapValue(x, yard.unit);
    y = snapValue(y, yard.unit);
  }

  const clamped = clampToBounds({ x, y }, dims.width, dims.height, yard);
  container.x = clamped.x;
  container.y = clamped.y;

  if (isCollision(yard, container, container.id, layer)) {
    if (state.snapEnabled) {
      const fallback = findNearestSpot(yard, layer, container, dims.width, dims.height);
      if (fallback) {
        container.x = fallback.x;
        container.y = fallback.y;
      } else {
        showHint('No free space available here.');
        currentDrag = null;
        return;
      }
    } else {
      showHint('Containers cannot overlap.');
      currentDrag = null;
      return;
    }
  }

  layer.containers.push(container);
  commitNextContainerLabel(yard);
  saveState();
  selectedContainerId = container.id;
  renderAll();
  currentDrag = null;
}

function handleContainerPointerDown(event, containerId) {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const yard = getActiveYard();
  if (!yard) return;
  const entry = findContainerEntry(yard, containerId);
  if (!entry) return;
  const { container, layer } = entry;
  selectContainer(containerId);
  const dims = getContainerDimensions(yard, container);
  const pointer = yardPointerToUnits(event);
  const offsetX = pointer.x - container.x;
  const offsetY = pointer.y - container.y;
  const group = event.currentTarget;
  group.classList.add('dragging');
  const parent = group.parentNode;
  if (parent && parent.lastChild !== group) {
    parent.appendChild(group);
  }

  currentDrag = {
    mode: 'move',
    pointerId: event.pointerId,
    containerId,
    offsetX,
    offsetY,
    element: group,
    width: dims.width,
    height: dims.height,
    lastValid: { x: container.x, y: container.y },
    valid: true,
    layerId: layer?.id || yard.activeLayerId,
  };
  group.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!currentDrag || currentDrag.mode !== 'move') return;
  if (event.pointerId !== currentDrag.pointerId) return;
  const yard = getActiveYard();
  if (!yard) return;
  const entry = findContainerEntry(yard, currentDrag.containerId);
  if (!entry) return;
  const { container: base, layer } = entry;
  currentDrag.layerId = layer?.id || currentDrag.layerId;
  const pointer = yardPointerToUnits(event);
  let x = pointer.x - currentDrag.offsetX;
  let y = pointer.y - currentDrag.offsetY;
  if (state.snapEnabled) {
    x = snapValue(x, yard.unit);
    y = snapValue(y, yard.unit);
  }
  const clamped = clampToBounds({ x, y }, currentDrag.width, currentDrag.height, yard);
  const candidate = {
    id: currentDrag.containerId,
    widthFt: base.widthFt,
    rotation: base.rotation,
    x: clamped.x,
    y: clamped.y,
  };
  const collides = isCollision(yard, candidate, currentDrag.containerId, layer);
  currentDrag.valid = !collides;
  if (!collides) {
    currentDrag.lastValid = { x: clamped.x, y: clamped.y };
    currentDrag.element.classList.remove('invalid');
  } else {
    currentDrag.element.classList.add('invalid');
  }
  setContainerTransform(currentDrag.element, clamped.x, clamped.y);
}

function handlePointerUp(event) {
  if (!currentDrag || currentDrag.mode !== 'move') return;
  if (event.pointerId !== currentDrag.pointerId) return;
  const yard = getActiveYard();
  if (!yard) return;
  const entry = findContainerEntry(yard, currentDrag.containerId);
  const container = entry?.container;
  currentDrag.element.classList.remove('dragging');
  currentDrag.element.classList.remove('invalid');
  currentDrag.element.releasePointerCapture(event.pointerId);

  if (container && currentDrag.valid) {
    container.x = currentDrag.lastValid.x;
    container.y = currentDrag.lastValid.y;
    saveState();
    renderActiveYard();
  } else {
    showHint('Placement blocked by another container.');
    renderActiveYard();
  }
  currentDrag = null;
}

function handleKeyDown(event) {
  const target = event.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
    return;
  }
  const yard = getActiveYard();
  if (!yard || !selectedContainerId) return;
  const container = getContainerById(yard, selectedContainerId);
  if (!container) return;
  const step = gridUnit(yard.unit);
  let handled = false;
  switch (event.key) {
    case 'Delete':
    case 'Backspace':
      removeSelectedContainer();
      handled = true;
      break;
    case 'ArrowUp':
      attemptMove(container, 0, -step, yard);
      handled = true;
      break;
    case 'ArrowDown':
      attemptMove(container, 0, step, yard);
      handled = true;
      break;
    case 'ArrowLeft':
      attemptMove(container, -step, 0, yard);
      handled = true;
      break;
    case 'ArrowRight':
      attemptMove(container, step, 0, yard);
      handled = true;
      break;
    case 'r':
    case 'R':
      attemptRotate(container, yard);
      handled = true;
      break;
    default:
      break;
  }
  if (handled) {
    event.preventDefault();
  }
}

function attemptMove(container, dx, dy, yard) {
  const dims = getContainerDimensions(yard, container);
  const target = {
    x: container.x + dx,
    y: container.y + dy,
  };
  const clamped = clampToBounds(target, dims.width, dims.height, yard);
  const candidate = { ...container, ...clamped };
  const entry = findContainerEntry(yard, container.id);
  const layer = entry?.layer;
  if (!isCollision(yard, candidate, container.id, layer)) {
    container.x = clamped.x;
    container.y = clamped.y;
    saveState();
    renderActiveYard();
  } else {
    showHint('Movement blocked by collision or bounds.');
  }
}

function attemptRotate(container, yard) {
  const previousRotation = container.rotation;
  const previousPosition = { x: container.x, y: container.y };
  const beforeDims = getContainerDimensions(yard, container);
  const centerX = previousPosition.x + beforeDims.width / 2;
  const centerY = previousPosition.y + beforeDims.height / 2;

  const nextRotation = previousRotation === 90 ? 0 : 90;
  container.rotation = nextRotation;
  const direction = nextRotation === 90 && previousRotation === 0 ? 'clockwise' : 'counterclockwise';
  rotateContainerDoors(container, direction);

  const afterDims = getContainerDimensions(yard, container);
  let nextX = centerX - afterDims.width / 2;
  let nextY = centerY - afterDims.height / 2;

  if (state.snapEnabled) {
    nextX = snapValue(nextX, yard.unit);
    nextY = snapValue(nextY, yard.unit);
  }

  const clamped = clampToBounds({ x: nextX, y: nextY }, afterDims.width, afterDims.height, yard);
  container.x = clamped.x;
  container.y = clamped.y;
  saveState();
  renderActiveYard();
  updateDetailPanel();
}

function removeSelectedContainer() {
  const yard = getActiveYard();
  if (!yard || !selectedContainerId) return;
  const entry = findContainerEntry(yard, selectedContainerId);
  if (entry) {
    entry.layer.containers.splice(entry.index, 1);
    ensureNextContainerNumber(yard);
    saveState();
    renderAll();
    showHint('Container removed.');
  }
}

function startYard(name, width, height, unit) {
  const template = getActiveYard();
  const defaultRates = sanitizeDefaultRates(template?.defaultRates);
  const baseLayer = {
    id: generateId(),
    name: 'Ground Level',
    containers: [],
  };
  const yard = {
    id: generateId(),
    name,
    width,
    height,
    unit,
    layers: [baseLayer],
    activeLayerId: baseLayer.id,
    nextContainerNumber: 1,
    defaultRates,
    customFields: [],
  };
  ensureNextContainerNumber(yard);
  state.yards.push(yard);
  state.activeYardId = yard.id;
  saveState();
  selectedContainerId = null;
  renderAll();
}

function handleCreateYard() {
  openYardModal();
}

function handleRenameYard() {
  const yard = getActiveYard();
  if (!yard) return;
  const name = prompt('Rename yard', yard.name);
  if (!name) return;
  yard.name = name.trim();
  saveState();
  renderAll();
}

function handleDuplicateYard() {
  const yard = getActiveYard();
  if (!yard) return;
  const cloneLayers = Array.isArray(yard.layers)
    ? yard.layers.map((layer) => ({
        id: generateId(),
        name: layer.name,
        containers: layer.containers.map((container) => ({
          ...container,
          id: generateId(),
          doors: Array.isArray(container.doors)
            ? container.doors.map((door) => ({
                ...door,
                id: generateId(),
              }))
            : [],
        })),
      }))
    : [];
  const activeLayerName = getActiveLayer(yard)?.name;
  const clone = {
    id: generateId(),
    name: `${yard.name} Copy`,
    width: yard.width,
    height: yard.height,
    unit: yard.unit,
    layers: cloneLayers,
    activeLayerId: null,
    defaultRates: sanitizeDefaultRates(yard.defaultRates),
    nextContainerNumber: 1,
    customFields: sanitizeCustomFields(yard.customFields),
  };
  const targetLayer = clone.layers.find((layer) => layer.name === activeLayerName) || clone.layers[0] || null;
  if (targetLayer) {
    clone.activeLayerId = targetLayer.id;
  }
  clone.layers.forEach((layer) => {
    layer.containers.forEach((container) => ensureContainerCustomValues(clone, container));
  });
  clone.nextContainerNumber = ensureNextContainerNumber(clone);
  state.yards.push(clone);
  state.activeYardId = clone.id;
  saveState();
  renderAll();
}

function handleDeleteYard() {
  const yard = getActiveYard();
  if (!yard) return;
  if (!confirm(`Delete yard "${yard.name}"?`)) return;
  state.yards = state.yards.filter((y) => y.id !== yard.id);
  if (state.activeYardId === yard.id) {
    state.activeYardId = state.yards[0]?.id || null;
  }
  selectedContainerId = null;
  saveState();
  renderAll();
}

function openYardModal() {
  const template = getActiveYard();
  els.yardForm.reset();
  const defaultName = `Yard ${state.yards.length + 1}`;
  els.yardNameInput.value = defaultName;
  const widthValue = template ? template.width : 100;
  const heightValue = template ? template.height : 60;
  const unitValue = template ? template.unit : 'ft';
  els.yardWidthInput.value = widthValue;
  els.yardHeightInput.value = heightValue;
  els.yardUnitSelect.value = ['ft', 'm', 'cm'].includes(unitValue) ? unitValue : 'ft';
  els.yardModal.hidden = false;
  window.setTimeout(() => {
    els.yardNameInput.focus();
    els.yardNameInput.select();
  }, 0);
}

function closeYardModal() {
  if (els.yardModal.hidden) return;
  els.yardModal.hidden = true;
}

function isModalOpen() {
  return !els.yardModal.hidden;
}

function handleYardFormSubmit(event) {
  event.preventDefault();
  const name = els.yardNameInput.value.trim();
  const width = parseFloat(els.yardWidthInput.value);
  const height = parseFloat(els.yardHeightInput.value);
  const unit = els.yardUnitSelect.value;
  if (!name) {
    showHint('Please enter a yard name.');
    els.yardNameInput.focus();
    return;
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    showHint('Width and height must be positive numbers.');
    els.yardWidthInput.focus();
    return;
  }
  if (!['ft', 'm', 'cm'].includes(unit)) {
    showHint('Units must be ft, m, or cm.');
    els.yardUnitSelect.focus();
    return;
  }
  closeYardModal();
  startYard(name, Number(width.toFixed(3)), Number(height.toFixed(3)), unit);
  els.yardForm.reset();
}

function updateDetailPanel() {
  const yard = getActiveYard();
  const container = yard && selectedContainerId ? getContainerById(yard, selectedContainerId) : null;
  if (!yard || !container) {
    if (els.containerDetails) {
      els.containerDetails.hidden = true;
    }
    if (els.containerForm) {
      els.containerForm.hidden = true;
      setDetailFormDisabled(true);
      els.containerForm.reset();
      delete els.containerForm.dataset.containerId;
    }
    if (els.doorList) {
      els.doorList.innerHTML = '';
    }
    if (els.customFieldContainer) {
      els.customFieldContainer.innerHTML = '';
    }
    if (els.addDoorBtn) {
      els.addDoorBtn.disabled = true;
    }
    return;
  }

  if (els.containerDetails) {
    els.containerDetails.hidden = false;
  }
  if (els.detailPlaceholder) {
    els.detailPlaceholder.hidden = true;
  }
  els.containerForm.hidden = false;
  setDetailFormDisabled(false);
  els.containerForm.dataset.containerId = container.id;
  els.detailTitle.value = container.label ?? '';
  els.detailTitle.placeholder = `${container.widthFt}`;
  els.detailRenter.value = container.renter || '';
  els.detailRate.value = container.monthlyRate || '';
  els.detailPhone.value = container.phone || '';
  if (els.detailEmail) {
    els.detailEmail.value = container.email || '';
  }
  if (els.detailAddress) {
    els.detailAddress.value = container.address || '';
  }
  if (els.detailStartDate) {
    els.detailStartDate.value = container.startDate || '';
  }
  els.detailOccupied.checked = Boolean(container.occupied);
  setOccupiedFieldState(Boolean(container.occupied));
  renderCustomFieldInputs(yard, container);
  if (els.addDoorBtn) {
    els.addDoorBtn.disabled = false;
  }
  renderDoorList(container);
}

function setDetailFormDisabled(disabled) {
  if (!els.containerForm) return;
  Array.from(els.containerForm.elements).forEach((element) => {
    element.disabled = disabled;
  });
  if (els.addDoorBtn) {
    els.addDoorBtn.disabled = disabled || !selectedContainerId;
  }
  if (els.doorList) {
    Array.from(els.doorList.querySelectorAll('select, input, button'))
      .filter((control) => control !== els.addDoorBtn)
      .forEach((control) => {
        control.disabled = disabled;
      });
  }
}

function renderCustomFieldInputs(yard, container) {
  if (!els.customFieldContainer) return;
  ensureContainerCustomValues(yard, container);
  els.customFieldContainer.innerHTML = '';
  const fields = Array.isArray(yard.customFields) ? yard.customFields : [];
  if (!fields.length) {
    const empty = document.createElement('p');
    empty.className = 'custom-empty';
    empty.textContent = 'No custom fields yet. Add fields in Settings.';
    els.customFieldContainer.appendChild(empty);
    return;
  }

  fields.forEach((field) => {
    if (field.type === 'boolean') {
      const wrapper = document.createElement('label');
      wrapper.className = 'switch toggle-row';
      wrapper.textContent = field.label;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.customFieldId = field.id;
      input.checked = Boolean(container.customValues?.[field.id]);
      wrapper.insertBefore(input, wrapper.firstChild);
      const slider = document.createElement('span');
      slider.className = 'switch-slider';
      wrapper.insertBefore(slider, wrapper.children[1]);
      const status = document.createElement('span');
      status.className = 'switch-label';
      status.textContent = container.customValues?.[field.id] ? 'Enabled' : 'Disabled';
      wrapper.appendChild(status);
      input.addEventListener('change', () => {
        status.textContent = input.checked ? 'Enabled' : 'Disabled';
      });
      els.customFieldContainer.appendChild(wrapper);
    } else {
      const row = document.createElement('div');
      row.className = 'form-row';
      const label = document.createElement('label');
      label.textContent = field.label;
      const input = document.createElement('input');
      input.type = 'text';
      input.dataset.customFieldId = field.id;
      input.value = container.customValues?.[field.id] || '';
      row.appendChild(label);
      row.appendChild(input);
      els.customFieldContainer.appendChild(row);
    }
  });
}

function setOccupiedFieldState(occupied) {
  if (!els.containerForm) return;
  const targets = [
    els.detailRenter,
    els.detailRate,
    els.detailPhone,
    els.detailEmail,
    els.detailAddress,
    els.detailStartDate,
  ];
  targets.forEach((input) => {
    if (!input) return;
    input.disabled = !occupied;
    input.classList.toggle('input-disabled', !occupied);
  });
}

function handleDetailInput(event) {
  if (!selectedContainerId) return;
  const yard = getActiveYard();
  if (!yard) return;
  const container = getContainerById(yard, selectedContainerId);
  if (!container) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return;
  }

  if (target.dataset.customFieldId) {
    const fieldId = target.dataset.customFieldId;
    if (!container.customValues) {
      container.customValues = {};
    }
    container.customValues[fieldId] = target.type === 'checkbox' ? target.checked : target.value;
    renderOccupantTable();
    saveState();
    return;
  }

  const { name } = target;
  switch (name) {
    case 'label':
      container.label = target.value;
      updateContainerLabelDisplay(container);
      renderOccupantTable();
      break;
    case 'renter':
      container.renter = target.value;
      renderOccupantTable();
      break;
    case 'monthlyRate':
      container.monthlyRate = target.value;
      renderOccupantTable();
      break;
    case 'phone':
      container.phone = target.value;
      renderOccupantTable();
      break;
    case 'email':
      container.email = target.value;
      renderOccupantTable();
      break;
    case 'address':
      container.address = target.value;
      renderOccupantTable();
      break;
    case 'startDate':
      container.startDate = target.value;
      renderOccupantTable();
      break;
    case 'occupied': {
      const checked = target.checked;
      container.occupied = checked;
      setOccupiedFieldState(checked);
      if (!checked) {
        container.renter = '';
        container.monthlyRate = '';
        container.phone = '';
        container.email = '';
        container.address = '';
        container.startDate = '';
        if (els.detailRenter) els.detailRenter.value = '';
        if (els.detailRate) els.detailRate.value = '';
        if (els.detailPhone) els.detailPhone.value = '';
        if (els.detailEmail) els.detailEmail.value = '';
        if (els.detailAddress) els.detailAddress.value = '';
        if (els.detailStartDate) els.detailStartDate.value = '';
      }
      renderActiveYard();
      renderOccupantTable();
      break;
    }
    default:
      break;
  }
  saveState();
}

function renderDoorList(container) {
  if (!els.doorList) return;
  els.doorList.innerHTML = '';
  if (!container || !Array.isArray(container.doors) || container.doors.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'door-empty';
    empty.textContent = 'No doors added yet.';
    els.doorList.appendChild(empty);
    return;
  }
  const edgeLabels = {
    north: 'Top edge',
    south: 'Bottom edge',
    west: 'Left edge',
    east: 'Right edge',
  };
  container.doors.forEach((door) => {
    const item = document.createElement('div');
    item.className = 'door-item';
    item.dataset.doorId = door.id;
    item.setAttribute('role', 'listitem');

    const edgeLabel = document.createElement('label');
    edgeLabel.textContent = 'Edge';
    const select = document.createElement('select');
    select.name = 'edge';
    DOOR_EDGES.forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = edgeLabels[value];
      select.appendChild(opt);
    });
    select.value = DOOR_EDGES.includes(door.edge) ? door.edge : 'north';
    edgeLabel.appendChild(select);

    const offsetLabel = document.createElement('label');
    offsetLabel.className = 'door-offset';
    offsetLabel.textContent = '';
    const offsetTitle = document.createElement('span');
    offsetTitle.textContent = 'Offset';
    const range = document.createElement('input');
    range.type = 'range';
    range.name = 'offset';
    range.min = '0';
    range.max = '100';
    range.step = '1';
    const percentRaw = Number(door.offset);
    const clampedPercent = Number.isFinite(percentRaw)
      ? Math.round(Math.min(Math.max(percentRaw, 0), 1) * 100)
      : 50;
    range.value = String(clampedPercent);
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'door-offset-value';
    valueDisplay.textContent = `${clampedPercent}%`;
    offsetLabel.appendChild(offsetTitle);
    offsetLabel.appendChild(range);
    offsetLabel.appendChild(valueDisplay);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'door-remove';
    remove.dataset.action = 'remove-door';
    remove.textContent = 'Remove';

    item.appendChild(edgeLabel);
    item.appendChild(offsetLabel);
    item.appendChild(remove);
    els.doorList.appendChild(item);
  });
}

function handleAddDoor() {
  if (!selectedContainerId) return;
  const yard = getActiveYard();
  if (!yard) return;
  const container = getContainerById(yard, selectedContainerId);
  if (!container) return;
  if (!Array.isArray(container.doors)) {
    container.doors = [];
  }
  container.doors.push({ id: generateId(), edge: 'north', offset: 0.5 });
  saveState();
  renderDoorList(container);
  refreshContainerDoors(container);
}

function handleDoorListChange(event) {
  if (!selectedContainerId) return;
  const yard = getActiveYard();
  if (!yard) return;
  const container = getContainerById(yard, selectedContainerId);
  if (!container || !Array.isArray(container.doors)) return;
  const item = event.target.closest('[data-door-id]');
  if (!item) return;
  const doorId = item.dataset.doorId;
  const door = container.doors.find((entry) => entry.id === doorId);
  if (!door) return;
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if ('disabled' in target && target.disabled) {
    return;
  }
  let changed = false;
  if (target instanceof HTMLSelectElement && target.name === 'edge') {
    door.edge = DOOR_EDGES.includes(target.value) ? target.value : 'north';
    changed = true;
  } else if (target instanceof HTMLInputElement && target.name === 'offset') {
    const value = Number(target.value);
    if (Number.isFinite(value)) {
      const clamped = Math.min(Math.max(value, 0), 100) / 100;
      door.offset = clamped;
      const display = item.querySelector('.door-offset-value');
      if (display) {
        display.textContent = `${Math.round(clamped * 100)}%`;
      }
      changed = true;
    }
  }
  if (changed) {
    saveState();
    refreshContainerDoors(container);
  }
}

function handleDoorListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.matches('.door-remove')) return;
  if (target.disabled) return;
  if (!selectedContainerId) return;
  const yard = getActiveYard();
  if (!yard) return;
  const container = getContainerById(yard, selectedContainerId);
  if (!container || !Array.isArray(container.doors)) return;
  const item = target.closest('[data-door-id]');
  if (!item) return;
  const doorId = item.dataset.doorId;
  const index = container.doors.findIndex((door) => door.id === doorId);
  if (index === -1) return;
  container.doors.splice(index, 1);
  saveState();
  renderDoorList(container);
  refreshContainerDoors(container);
}

function rotateContainerDoors(container, direction) {
  if (!container || !Array.isArray(container.doors) || container.doors.length === 0) {
    return;
  }
  const clockwise = {
    north: 'east',
    east: 'south',
    south: 'west',
    west: 'north',
  };
  const counter = {
    north: 'west',
    west: 'south',
    south: 'east',
    east: 'north',
  };
  container.doors.forEach((door) => {
    const current = DOOR_EDGES.includes(door.edge) ? door.edge : 'north';
    if (direction === 'counterclockwise') {
      door.edge = counter[current];
    } else {
      door.edge = clockwise[current];
    }
  });
}

function updateContainerLabelDisplay(container) {
  const group = els.yardSvg.querySelector(`.container-group[data-id="${container.id}"]`);
  if (!group) {
    renderActiveYard();
    return;
  }
  const text = group.querySelector('.container-label');
  const labelText = container.label && container.label.trim() ? container.label.trim() : `${container.widthFt}`;
  if (text) {
    text.textContent = labelText;
  }
  group.setAttribute('aria-label', `${labelText} container`);
}

function handleGlobalKeyDown(event) {
  if (isModalOpen()) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeYardModal();
    }
    return;
  }
  if (event.key === 'Escape' && selectedContainerId) {
    event.preventDefault();
    selectContainer(null);
    return;
  }
  handleKeyDown(event);
}



function bringContainerGroupToFront(containerId) {
  if (!containerId) return;
  const group = els.yardSvg.querySelector(`.container-group[data-id="${containerId}"]`);
  if (group && group.parentNode && group.parentNode.lastChild !== group) {
    group.parentNode.appendChild(group);
  }
}

function selectContainer(containerId) {
  selectedContainerId = containerId;
  Array.from(els.yardSvg.querySelectorAll('.container-group')).forEach((group) => {
    group.classList.toggle('is-selected', group.dataset.id === containerId);
  });
  if (containerId) {
    bringContainerGroupToFront(containerId);
  }
  updateDetailPanel();
}

function getActiveYard() {
  if (!state.yards.length) {
    if (state.activeYardId) {
      state.activeYardId = null;
      saveState();
    }
    return null;
  }

  if (state.activeYardId) {
    const match = state.yards.find((yard) => yard.id === state.activeYardId);
    if (match) {
      return match;
    }
  }

  const fallbackId = state.yards[0].id;
  if (state.activeYardId !== fallbackId) {
    state.activeYardId = fallbackId;
    saveState();
  }
  return state.yards[0] || null;
}

function createContainerFromType(yard, type) {
  const customValues = {};
  if (yard && Array.isArray(yard.customFields)) {
    yard.customFields.forEach((field) => {
      customValues[field.id] = field.type === 'boolean' ? false : '';
    });
  }
  return {
    id: generateId(),
    type: type.type,
    widthFt: type.widthFt,
    x: 0,
    y: 0,
    rotation: 0,
    label: previewNextContainerLabel(yard),
    renter: '',
    monthlyRate: yard?.defaultRates?.[type.type] ?? '',
    phone: '',
    email: '',
    address: '',
    startDate: '',
    occupied: false,
    doors: [],
    customValues,
  };
}

function yardPointerToUnits(event) {
  const rect = els.yardSvg.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / state.scale,
    y: (event.clientY - rect.top) / state.scale,
  };
}

function snapValue(value, unit) {
  const size = gridUnit(unit);
  return Math.round(value / size) * size;
}

function gridUnit(unit) {
  return convertFtToUnit(1, unit);
}

function convertFtToUnit(value, unit) {
  return value * ftToUnitFactor[unit];
}

function getContainerDimensions(yard, container) {
  const width = convertFtToUnit(container.widthFt, yard.unit);
  const depth = convertFtToUnit(containerDepthFt, yard.unit);
  if (container.rotation === 90) {
    return { width: depth, height: width };
  }
  return { width, height: depth };
}

function createDoorElement(yard, dims, door) {
  if (!door) return null;
  const edge = DOOR_EDGES.includes(door.edge) ? door.edge : 'north';
  let offset = Number(door.offset);
  if (!Number.isFinite(offset)) {
    offset = 0.5;
  }
  offset = Math.min(Math.max(offset, 0), 1);

  const doorLength = convertFtToUnit(DOOR_LENGTH_FT, yard.unit);
  const doorThickness = convertFtToUnit(DOOR_THICKNESS_FT, yard.unit);

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.classList.add('container-door');

  if (edge === 'north' || edge === 'south') {
    const width = Math.min(doorLength, dims.width);
    const height = Math.min(doorThickness, dims.height);
    const maxX = Math.max(dims.width - width, 0);
    const x = Math.min(Math.max(offset * maxX, 0), maxX);
    const y = edge === 'north' ? 0 : Math.max(dims.height - height, 0);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('rx', Math.min(width, height) * 0.15);
    rect.setAttribute('ry', Math.min(width, height) * 0.15);
    return rect;
  }

  const width = Math.min(doorThickness, dims.width);
  const height = Math.min(doorLength, dims.height);
  const maxY = Math.max(dims.height - height, 0);
  const y = Math.min(Math.max(offset * maxY, 0), maxY);
  const x = edge === 'west' ? 0 : Math.max(dims.width - width, 0);
  rect.setAttribute('width', width);
  rect.setAttribute('height', height);
  rect.setAttribute('x', x);
  rect.setAttribute('y', y);
  rect.setAttribute('rx', Math.min(width, height) * 0.15);
  rect.setAttribute('ry', Math.min(width, height) * 0.15);
  return rect;
}

function refreshContainerDoors(container) {
  const yard = getActiveYard();
  if (!yard || !container || !els.yardSvg) return;
  const group = els.yardSvg.querySelector(`.container-group[data-id="${container.id}"]`);
  if (!group) {
    renderActiveYard();
    return;
  }
  let doorGroup = group.querySelector('.door-group');
  const label = group.querySelector('.container-label');
  if (!doorGroup) {
    doorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    doorGroup.classList.add('door-group');
    if (label) {
      group.insertBefore(doorGroup, label);
    } else {
      group.appendChild(doorGroup);
    }
  }
  while (doorGroup.firstChild) {
    doorGroup.removeChild(doorGroup.firstChild);
  }
  const dims = getContainerDimensions(yard, container);
  const doors = Array.isArray(container.doors) ? container.doors : [];
  doors.forEach((door) => {
    const doorElement = createDoorElement(yard, dims, door);
    if (doorElement) {
      doorGroup.appendChild(doorElement);
    }
  });
}

function clampToBounds(position, width, height, yard) {
  return {
    x: Math.min(Math.max(position.x, 0), Math.max(yard.width - width, 0)),
    y: Math.min(Math.max(position.y, 0), Math.max(yard.height - height, 0)),
  };
}

function isCollision(yard, candidate, ignoreId, layerOverride) {
  const dims = getContainerDimensions(yard, candidate);
  const layer = layerOverride || findContainerEntry(yard, candidate.id)?.layer || getActiveLayer(yard);
  const containers = layer ? layer.containers : [];
  return containers.some((container) => {
    if (container.id === ignoreId) return false;
    const otherDims = getContainerDimensions(yard, container);
    return !(
      candidate.x + dims.width <= container.x ||
      candidate.x >= container.x + otherDims.width ||
      candidate.y + dims.height <= container.y ||
      candidate.y >= container.y + otherDims.height
    );
  });
}

function findNearestSpot(yard, layer, container, width, height) {
  const startX = container.x;
  const startY = container.y;
  const step = gridUnit(yard.unit);
  const maxRadius = Math.ceil(Math.max(yard.width, yard.height) / step) + 2;
  for (let radius = 0; radius <= maxRadius && radius < 60; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const x = startX + dx * step;
        const y = startY + dy * step;
        const clamped = clampToBounds({ x, y }, width, height, yard);
        const candidate = { ...container, x: clamped.x, y: clamped.y };
        if (!isCollision(yard, candidate, container.id, layer)) {
          return clamped;
        }
      }
    }
  }
  return null;
}

function setContainerTransform(group, x, y) {
  group.setAttribute('transform', `translate(${x}, ${y})`);
}

function getContainerById(yard, id) {
  const entry = findContainerEntry(yard, id);
  return entry ? entry.container : null;
}

function createGhost(type) {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.textContent = `${type.widthFt} ft`;
  ghost.style.borderColor = '#94a3b8';
  return ghost;
}

function showHint(message) {
  if (!message) return;
  els.hint.textContent = message;
  els.hint.classList.add('visible');
  if (hintTimeout) window.clearTimeout(hintTimeout);
  hintTimeout = window.setTimeout(() => {
    els.hint.classList.remove('visible');
  }, 1800);
}

function formatNumber(value) {
  const rounded = Math.round(value * 1000) / 1000;
  return Number(rounded.toString()).toString();
}

function formatCurrency(value) {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(safe);
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function applyTheme() {
  if (!els.appShell || !els.themeToggle) return;
  const theme = state.theme === 'dark' ? 'dark' : 'light';
  els.appShell.setAttribute('data-theme', theme);
  if (document.documentElement) {
    document.documentElement.setAttribute('data-theme', theme);
  }
  if (document.body) {
    document.body.setAttribute('data-theme', theme);
  }
  els.themeToggle.checked = theme === 'dark';
}
