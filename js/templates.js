import {
  db,
  initPage,
  qs,
  toast,
  confirmAction,
  esc,
  fullName,
} from "./common.js";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  FONT_OPTIONS,
  TOKENS,
  buildSampleData,
  replaceTokens,
  defaultBlocks,
  migrateLegacyTemplate,
  cloneBlocks,
  newBlockId,
  contentToChipHtml,
  chipHtmlElementToContent,
} from "./certificateBlocks.js";

const currentUser = await initPage([
  "administrator",
  "viewer",
]);

const canReadOnly = currentUser.profile.role !== "administrator";

let churches = [];
let pastors = [];
let templates = [];

const firstValue = (object, keys, fallback = "") => {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
};

/**
 * Firestore rejects undefined values, including undefined properties nested
 * inside arrays such as template blocks. Return a clean copy containing only
 * values that Firestore can save.
 */
function removeUndefined(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefined(item));
  }

  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, removeUndefined(item)]),
    );
  }

  return value;
}

function normalizeChurch(documentItem) {
  const data = documentItem.data();
  return {
    ...data,
    id: documentItem.id,
    name: firstValue(data, ["name", "churchName", "church_name"]),
    address: firstValue(data, ["address", "churchAddress", "church_address"]),
    regNo: firstValue(data, ["regNo", "registrationNumber", "registrationNo"]),
    freeText: firstValue(data, ["freeText", "churchFreeText", "additionalText"]),
  };
}

function normalizePastor(documentItem) {
  const data = documentItem.data();
  const storedName = firstValue(data, ["fullName", "pastorName", "name"]);
  const parts = String(storedName).trim().split(/\s+/).filter(Boolean);
  return {
    ...data,
    id: documentItem.id,
    churchId: String(firstValue(data, ["churchId", "church_id", "church"])),
    firstName: firstValue(data, ["firstName", "first_name"], parts[0] || ""),
    lastName: firstValue(data, ["lastName", "last_name"], parts.slice(1).join(" ")),
    position: firstValue(data, ["position", "title", "pastorTitle"]),
  };
}

/** Editor state for the template currently open in the canvas. */
let state = {
  templateId: "",
  templateName: "",
  churchId: "",
  churchName: "",
  pastorId: "",
  pastorName: "",
  paperSize: "a4",
  orientation: "portrait",
  blocks: defaultBlocks(),
};

let selectedBlockId = null;
let dragInfo = null;
let resizeInfo = null;

const canvas = qs("#certCanvas");
const propertiesPanel = qs("#propertiesPanel");
const layersList = qs("#layersList");

/**
 * Load churches, pastors and certificate templates.
 */
async function load() {
  try {
    const results = await Promise.allSettled([
        getDocs(collection(db, "churches")),
        getDocs(collection(db, "pastors")),
        getDocs(collection(db, "certificateTemplates")),
      ]);

    const [churchResult, pastorResult, templateResult] = results;
    churches = churchResult.status === "fulfilled"
      ? churchResult.value.docs.map(normalizeChurch)
      : [];
    pastors = pastorResult.status === "fulfilled"
      ? pastorResult.value.docs.map(normalizePastor)
      : [];
    templates = templateResult.status === "fulfilled"
      ? templateResult.value.docs.map((documentItem) => ({
          ...documentItem.data(),
          id: documentItem.id,
        }))
      : [];

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `Unable to load ${["churches", "pastors", "certificateTemplates"][index]}`,
          result.reason,
        );
      }
    });

    loadChurchOptions();
    updatePastorOptions();
    renderTemplateList();
    renderCanvas();
    renderLayers();

    if (results.some((result) => result.status === "rejected")) {
      toast("Some data could not be loaded. Check Firestore rules and the console.", "error");
    }
  } catch (error) {
    console.error(error);

    toast(
      "Unable to load certificate templates.",
      "error",
    );
  }
}

/**
 * Display the available churches.
 */
function loadChurchOptions() {
  qs("#churchId").innerHTML =
    '<option value="">Select church</option>' +
    churches
      .map(
        (church) =>
          `<option value="${church.id}">${esc(church.name)}</option>`,
      )
      .join("");

  qs("#churchId").value = state.churchId || "";
}

/**
 * Filter pastors using the selected church.
 */
function updatePastorOptions() {
  const selectedChurchId = String(qs("#churchId").value || "");

  const availablePastors = pastors.filter(
    (pastor) =>
      !selectedChurchId ||
      String(pastor.churchId || "") === selectedChurchId,
  );

  qs("#pastorId").innerHTML =
    '<option value="">Select pastor</option>' +
    availablePastors
      .map(
        (pastor) =>
          `<option value="${pastor.id}">${esc(fullName(pastor))}</option>`,
      )
      .join("");

  qs("#pastorId").value = state.pastorId || "";
}

function selectedChurch() {
  return churches.find((church) => church.id === state.churchId);
}

function selectedPastor() {
  return pastors.find((pastor) => pastor.id === state.pastorId);
}

/* ------------------------------------------------------------------ */
/*  Canvas rendering                                                   */
/* ------------------------------------------------------------------ */

/**
 * Rebuild the whole canvas from state.blocks. Called after any structural
 * change (add/delete block, load template, church/pastor change, paper
 * size change). In-place drag/resize updates DOM directly for smoothness
 * and only call this on drop/commit.
 */
function renderCanvas() {
  canvas.classList.toggle(
    "landscape",
    state.orientation === "landscape",
  );

  canvas.innerHTML = "";

  const sampleData = buildSampleData(
    selectedChurch(),
    selectedPastor(),
  );

  state.blocks.forEach((block) => {
    canvas.appendChild(renderBlockElement(block, sampleData));
  });

  highlightSelection();
}

function renderBlockElement(block, sampleData) {
  const element = document.createElement("div");

  element.className = "cert-block";
  element.dataset.id = block.id;
  element.style.left = `${block.x}%`;
  element.style.top = `${block.y}%`;
  element.style.width = `${block.w}%`;

  if (block.type === "image") {
    element.classList.add("cert-block--image");
    element.style.aspectRatio = "1 / 1";

    const img = document.createElement("img");
    img.src = block.src;
    img.alt = "Church logo";
    element.appendChild(img);
  } else if (block.type === "witnessGrid") {
    element.classList.add("cert-block--witness");

    const names =
      block.names && block.names.length
        ? block.names
        : sampleData.witnesses;

    const grid = document.createElement("div");
    grid.className = "witness-grid";
    grid.style.gridTemplateColumns = `repeat(${block.columns}, 1fr)`;
    grid.style.fontFamily = `'${block.fontFamily}', serif`;
    grid.style.fontSize = `${block.fontSize * 0.55}px`;
    grid.style.color = block.color;
    grid.style.fontWeight = block.bold ? "bold" : "normal";
    grid.style.textAlign = block.align;

    names.forEach((name) => {
      const cell = document.createElement("div");
      cell.textContent = name;
      grid.appendChild(cell);
    });

    element.appendChild(grid);
  } else {
    element.classList.add("cert-block--text");

    const content = document.createElement("div");
    content.className = "cert-block-content";
    content.style.fontFamily = `'${block.fontFamily}', serif`;
    content.style.fontSize = `${block.fontSize * 0.55}px`;
    content.style.color = block.color;
    content.style.textAlign = block.align;
    content.style.fontWeight = block.bold ? "bold" : "normal";
    content.style.fontStyle = block.italic ? "italic" : "normal";
    content.style.textDecoration = block.underline
      ? "underline"
      : "none";
    content.style.textTransform = block.uppercase
      ? "uppercase"
      : "none";

    if (block.borderTop) {
      content.style.borderTop = "2px solid currentColor";
      content.style.paddingTop = "6px";
    }

    if (block.borderBottom) {
      content.style.borderBottom = "2px solid currentColor";
      content.style.paddingBottom = "6px";
    }

    content.innerHTML = contentToChipHtml(
      replaceTokens(block.content, sampleData),
    );
    content.spellcheck = false;

    content.addEventListener("dblclick", (event) => {
      if (canReadOnly) return;
      event.stopPropagation();
      enterEditMode(block.id, content, sampleData);
    });

    element.appendChild(content);
  }

  const resizeHandle = document.createElement("div");
  resizeHandle.className = "resize-handle";
  element.appendChild(resizeHandle);

  const dragHandle = document.createElement("div");
  dragHandle.className = "drag-handle";
  dragHandle.title = "Drag to move";
  dragHandle.innerHTML = "&#10021;&#10021;";
  element.appendChild(dragHandle);

  const deleteHandle = document.createElement("button");
  deleteHandle.type = "button";
  deleteHandle.className = "block-delete";
  deleteHandle.title = "Delete block";
  deleteHandle.textContent = "\u00d7";
  deleteHandle.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteBlock(block.id);
  });
  element.appendChild(deleteHandle);

  element.addEventListener("pointerdown", (event) => {
    if (canReadOnly) return;
    if (event.target.closest(".cert-block-content[contenteditable='true']")) {
      return;
    }

    selectBlock(block.id);

    if (event.target.closest(".resize-handle")) {
      startResize(event, block.id);
    } else if (event.target.closest(".block-delete")) {
      return;
    } else {
      startDrag(event, block.id);
    }
  });

  element.addEventListener("click", (event) => {
    event.stopPropagation();
    selectBlock(block.id);
  });

  return element;
}

canvas.addEventListener("click", () => {
  selectBlock(null);
});

/* ------------------------------------------------------------------ */
/*  Selection                                                          */
/* ------------------------------------------------------------------ */

function selectBlock(blockId) {
  selectedBlockId = blockId;
  highlightSelection();
  renderProperties();
  renderLayers();
}

function highlightSelection() {
  canvas.querySelectorAll(".cert-block").forEach((element) => {
    element.classList.toggle(
      "selected",
      element.dataset.id === selectedBlockId,
    );
  });
}

function getBlock(blockId) {
  return state.blocks.find((block) => block.id === blockId);
}

/* ------------------------------------------------------------------ */
/*  Drag / resize                                                      */
/* ------------------------------------------------------------------ */

function startDrag(event, blockId) {
  const block = getBlock(blockId);
  const canvasRect = canvas.getBoundingClientRect();
  const element = canvas.querySelector(
    `.cert-block[data-id="${blockId}"]`,
  );

  dragInfo = {
    blockId,
    element,
    canvasRect,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: block.x,
    startY: block.y,
  };

  element.setPointerCapture(event.pointerId);
  element.addEventListener("pointermove", onDragMove);
  element.addEventListener("pointerup", onDragEnd);
  element.addEventListener("pointercancel", onDragEnd);
}

function onDragMove(event) {
  if (!dragInfo) return;

  const deltaXPercent =
    ((event.clientX - dragInfo.startClientX) /
      dragInfo.canvasRect.width) *
    100;

  const deltaYPercent =
    ((event.clientY - dragInfo.startClientY) /
      dragInfo.canvasRect.height) *
    100;

  const block = getBlock(dragInfo.blockId);

  const newX = clamp(
    dragInfo.startX + deltaXPercent,
    0,
    100 - block.w,
  );

  const newY = clamp(dragInfo.startY + deltaYPercent, 0, 96);

  dragInfo.element.style.left = `${newX}%`;
  dragInfo.element.style.top = `${newY}%`;

  dragInfo.pendingX = newX;
  dragInfo.pendingY = newY;
}

function onDragEnd(event) {
  if (!dragInfo) return;

  const block = getBlock(dragInfo.blockId);

  if (dragInfo.pendingX !== undefined) {
    block.x = round1(dragInfo.pendingX);
    block.y = round1(dragInfo.pendingY);
  }

  dragInfo.element.removeEventListener("pointermove", onDragMove);
  dragInfo.element.removeEventListener("pointerup", onDragEnd);
  dragInfo.element.removeEventListener("pointercancel", onDragEnd);
  dragInfo.element.releasePointerCapture(event.pointerId);

  dragInfo = null;
}

function startResize(event, blockId) {
  event.stopPropagation();

  const block = getBlock(blockId);
  const canvasRect = canvas.getBoundingClientRect();
  const element = canvas.querySelector(
    `.cert-block[data-id="${blockId}"]`,
  );

  resizeInfo = {
    blockId,
    element,
    canvasRect,
    startClientX: event.clientX,
    startW: block.w,
  };

  element.setPointerCapture(event.pointerId);
  element.addEventListener("pointermove", onResizeMove);
  element.addEventListener("pointerup", onResizeEnd);
  element.addEventListener("pointercancel", onResizeEnd);
}

function onResizeMove(event) {
  if (!resizeInfo) return;

  const deltaXPercent =
    ((event.clientX - resizeInfo.startClientX) /
      resizeInfo.canvasRect.width) *
    100;

  const block = getBlock(resizeInfo.blockId);

  const newW = clamp(
    resizeInfo.startW + deltaXPercent,
    5,
    100 - block.x,
  );

  resizeInfo.element.style.width = `${newW}%`;
  resizeInfo.pendingW = newW;
}

function onResizeEnd(event) {
  if (!resizeInfo) return;

  const block = getBlock(resizeInfo.blockId);

  if (resizeInfo.pendingW !== undefined) {
    block.w = round1(resizeInfo.pendingW);
  }

  resizeInfo.element.removeEventListener("pointermove", onResizeMove);
  resizeInfo.element.removeEventListener("pointerup", onResizeEnd);
  resizeInfo.element.removeEventListener(
    "pointercancel",
    onResizeEnd,
  );
  resizeInfo.element.releasePointerCapture(event.pointerId);

  resizeInfo = null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

/* ------------------------------------------------------------------ */
/*  Inline text editing                                                */
/* ------------------------------------------------------------------ */

let editingElement = null;

function enterEditMode(blockId, contentElement, sampleData) {
  const block = getBlock(blockId);
  if (!block) return;

  const previewData = sampleData || buildSampleData(
    selectedChurch(),
    selectedPastor(),
  );

  editingElement = contentElement;
  contentElement.innerHTML = contentToChipHtml(block.content);
  contentElement.contentEditable = "true";
  contentElement.focus();

  const range = document.createRange();
  range.selectNodeContents(contentElement);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  const commit = () => {
    const currentBlock = getBlock(blockId);
    if (!currentBlock) return;
    currentBlock.content = chipHtmlElementToContent(contentElement).trim();
    contentElement.contentEditable = "false";
    contentElement.removeEventListener("blur", commit);
    editingElement = null;
    contentElement.innerHTML = contentToChipHtml(
      replaceTokens(currentBlock.content, previewData),
    );
  };

  contentElement.addEventListener("blur", commit);
}

/** Insert a token chip at the current cursor position in the active edit field. */
function insertTokenAtCursor(tokenKey) {
  if (!editingElement) return;

  editingElement.focus();

  const label =
    TOKENS.find((token) => token.key === tokenKey)?.label ||
    tokenKey;

  const chip = document.createElement("span");
  chip.className = "token-chip";
  chip.contentEditable = "false";
  chip.dataset.token = tokenKey;
  chip.textContent = label;

  const selection = window.getSelection();

  if (
    selection.rangeCount &&
    editingElement.contains(selection.anchorNode)
  ) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(chip);
    range.setStartAfter(chip);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    editingElement.appendChild(chip);
  }
}

/* ------------------------------------------------------------------ */
/*  Layers panel                                                       */
/* ------------------------------------------------------------------ */

function renderLayers() {
  if (!layersList) return;

  layersList.innerHTML = state.blocks
    .map((block, index) => {
      const label = layerLabel(block);

      return `
        <button
          type="button"
          class="layer-item ${block.id === selectedBlockId ? "selected" : ""}"
          data-id="${block.id}"
        >
          <span>${esc(label)}</span>
          <span class="layer-index">${index + 1}</span>
        </button>
      `;
    })
    .join("");

  layersList.querySelectorAll(".layer-item").forEach((button) => {
    button.addEventListener("click", () => {
      selectBlock(button.dataset.id);
    });
  });
}

function layerLabel(block) {
  if (block.type === "image") return "Logo image";
  if (block.type === "witnessGrid") return "Witnesses grid";

  const plain = block.content
    .replace(/{{\s*\w+\s*}}/g, (match) => {
      const key = match.replace(/[{}]/g, "").trim();
      return TOKENS.find((token) => token.key === key)?.label || key;
    })
    .trim();

  return plain.slice(0, 28) || "Text block";
}

/* ------------------------------------------------------------------ */
/*  Properties panel                                                   */
/* ------------------------------------------------------------------ */

function renderProperties() {
  if (!propertiesPanel) return;

  const block = getBlock(selectedBlockId);

  if (!block) {
    propertiesPanel.innerHTML = `
      <p class="empty-hint">
        Select a block on the certificate to edit its style.
      </p>
    `;

    return;
  }

  if (block.type === "image") {
    propertiesPanel.innerHTML = `
      <h3>Logo</h3>
      <p class="hint-text">Drag to move, drag the corner to resize.</p>
    `;

    return;
  }

  if (block.type === "witnessGrid") {
    propertiesPanel.innerHTML = `
      <h3>Witnesses Grid</h3>

      <label>
        Columns
        <input id="propColumns" type="number" min="1" max="6" value="${block.columns}">
      </label>

      <label>
        Font style
        ${fontSelectHtml("propFontFamily", block.fontFamily)}
      </label>

      <label>
        Font size
        <input id="propFontSize" type="number" min="8" max="36" value="${block.fontSize}">
      </label>

      <label>
        Font color
        <input id="propFontColor" type="color" value="${block.color}">
      </label>

      <label class="checkbox-label">
        <input id="propBold" type="checkbox" ${block.bold ? "checked" : ""}>
        Bold
      </label>

      <label>
        Sample witness names (one per line)
        <textarea id="propWitnessNames" rows="6" placeholder="Used only to preview spacing — real names come from the dedication record.">${esc(
          (block.names || []).join("\n"),
        )}</textarea>
      </label>
    `;

    qs("#propColumns").addEventListener("input", (event) => {
      block.columns = Math.max(
        1,
        Math.min(6, Number(event.target.value) || 1),
      );
      renderCanvas();
    });

    qs("#propFontFamily").addEventListener("change", (event) => {
      block.fontFamily = event.target.value;
      renderCanvas();
    });

    qs("#propFontSize").addEventListener("input", (event) => {
      block.fontSize = Number(event.target.value) || block.fontSize;
      renderCanvas();
    });

    qs("#propFontColor").addEventListener("input", (event) => {
      block.color = event.target.value;
      renderCanvas();
    });

    qs("#propBold").addEventListener("change", (event) => {
      block.bold = event.target.checked;
      renderCanvas();
    });

    qs("#propWitnessNames").addEventListener("input", (event) => {
      block.names = event.target.value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      renderCanvas();
    });

    return;
  }

  // Text block
  propertiesPanel.innerHTML = `
    <h3>Text Block</h3>

    <label>
      Insert field
      <select id="propInsertToken">
        <option value="">Choose a field&hellip;</option>
        ${TOKENS.map(
          (token) =>
            `<option value="${token.key}">${esc(token.label)}</option>`,
        ).join("")}
      </select>
    </label>

    <p class="hint-text">
      Double-click the block on the canvas to edit its text, then use
      the field picker above to insert a field at your cursor.
    </p>

    <label>
      Font style
      ${fontSelectHtml("propFontFamily", block.fontFamily)}
    </label>

    <label>
      Font size
      <input id="propFontSize" type="number" min="6" max="60" value="${block.fontSize}">
    </label>

    <label>
      Font color
      <input id="propFontColor" type="color" value="${block.color}">
    </label>

    <label>
      Alignment
      <select id="propAlign">
        <option value="left" ${block.align === "left" ? "selected" : ""}>Left</option>
        <option value="center" ${block.align === "center" ? "selected" : ""}>Center</option>
        <option value="right" ${block.align === "right" ? "selected" : ""}>Right</option>
        <option value="justify" ${block.align === "justify" ? "selected" : ""}>Justify</option>
      </select>
    </label>

    <div class="toggle-row">
      <label class="checkbox-label">
        <input id="propBold" type="checkbox" ${block.bold ? "checked" : ""}>
        Bold
      </label>

      <label class="checkbox-label">
        <input id="propItalic" type="checkbox" ${block.italic ? "checked" : ""}>
        Italic
      </label>

      <label class="checkbox-label">
        <input id="propUnderline" type="checkbox" ${block.underline ? "checked" : ""}>
        Underline
      </label>

      <label class="checkbox-label">
        <input id="propUppercase" type="checkbox" ${block.uppercase ? "checked" : ""}>
        Uppercase
      </label>
    </div>

    <div class="toggle-row">
      <label class="checkbox-label">
        <input id="propBorderTop" type="checkbox" ${block.borderTop ? "checked" : ""}>
        Line above
      </label>

      <label class="checkbox-label">
        <input id="propBorderBottom" type="checkbox" ${block.borderBottom ? "checked" : ""}>
        Line below
      </label>
    </div>
  `;

  qs("#propInsertToken").addEventListener("change", (event) => {
    const tokenKey = event.target.value;

    if (!tokenKey) return;

    const contentElement = canvas.querySelector(
      `.cert-block[data-id="${block.id}"] .cert-block-content`,
    );

    if (contentElement.contentEditable !== "true") {
      enterEditMode(block.id, contentElement);
    }

    insertTokenAtCursor(tokenKey);
    event.target.value = "";
  });

  qs("#propFontFamily").addEventListener("change", (event) => {
    block.fontFamily = event.target.value;
    renderCanvas();
  });

  qs("#propFontSize").addEventListener("input", (event) => {
    block.fontSize = Number(event.target.value) || block.fontSize;
    renderCanvas();
  });

  qs("#propFontColor").addEventListener("input", (event) => {
    block.color = event.target.value;
    renderCanvas();
  });

  qs("#propAlign").addEventListener("change", (event) => {
    block.align = event.target.value;
    renderCanvas();
  });

  qs("#propBold").addEventListener("change", (event) => {
    block.bold = event.target.checked;
    renderCanvas();
  });

  qs("#propItalic").addEventListener("change", (event) => {
    block.italic = event.target.checked;
    renderCanvas();
  });

  qs("#propUnderline").addEventListener("change", (event) => {
    block.underline = event.target.checked;
    renderCanvas();
  });

  qs("#propUppercase").addEventListener("change", (event) => {
    block.uppercase = event.target.checked;
    renderCanvas();
  });

  qs("#propBorderTop").addEventListener("change", (event) => {
    block.borderTop = event.target.checked;
    renderCanvas();
  });

  qs("#propBorderBottom").addEventListener("change", (event) => {
    block.borderBottom = event.target.checked;
    renderCanvas();
  });
}

function fontSelectHtml(id, selectedValue) {
  return `
    <select id="${id}">
      ${FONT_OPTIONS.map(
        (font) =>
          `<option value="${font}" ${
            font === selectedValue ? "selected" : ""
          }>${font}</option>`,
      ).join("")}
    </select>
  `;
}

/* ------------------------------------------------------------------ */
/*  Add / delete blocks                                                */
/* ------------------------------------------------------------------ */

function addTextBlock() {
  const block = {
    id: newBlockId("text"),
    type: "text",
    content: "New text",
    x: 20,
    y: 40,
    w: 60,
    fontFamily: "Georgia",
    fontSize: 12,
    color: "#202938",
    align: "center",
  };

  state.blocks.push(block);
  renderCanvas();
  renderLayers();
  selectBlock(block.id);
}

function addWitnessGridBlock() {
  const block = {
    id: newBlockId("witness"),
    type: "witnessGrid",
    names: [],
    columns: 4,
    x: 10,
    y: 80,
    w: 80,
    fontFamily: "Georgia",
    fontSize: 10,
    color: "#202938",
    align: "left",
    bold: true,
  };

  state.blocks.push(block);
  renderCanvas();
  renderLayers();
  selectBlock(block.id);
}

function deleteBlock(blockId) {
  state.blocks = state.blocks.filter((block) => block.id !== blockId);

  if (selectedBlockId === blockId) {
    selectedBlockId = null;
  }

  renderCanvas();
  renderLayers();
  renderProperties();
}

document.addEventListener("keydown", (event) => {
  if (canReadOnly) return;
  if (!selectedBlockId) return;

  const activeTag = document.activeElement?.tagName;
  const isEditingText =
    document.activeElement?.isContentEditable ||
    activeTag === "INPUT" ||
    activeTag === "TEXTAREA" ||
    activeTag === "SELECT";

  if (isEditingText) return;

  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    deleteBlock(selectedBlockId);
  }
});

/* ------------------------------------------------------------------ */
/*  Saved templates list                                               */
/* ------------------------------------------------------------------ */

function renderTemplateList() {
  const templateList = qs("#templateList");

  if (!templates.length) {
    templateList.innerHTML = `
      <div class="empty-state">No saved templates found.</div>
    `;

    return;
  }

  templateList.innerHTML = templates
    .map(
      (template) => `
        <button type="button" class="template-item" data-id="${template.id}">
          <strong>${esc(template.templateName)}</strong>
          <br>
          <small>${esc(template.churchName || "No church selected")}</small>
        </button>
      `,
    )
    .join("");

  templateList.querySelectorAll(".template-item").forEach((button) => {
    button.addEventListener("click", () => {
      const found = templates.find(
        (template) => template.id === button.dataset.id,
      );

      if (found) fill(found);
    });
  });
}

/**
 * Load a saved template (migrating it to the block schema if needed)
 * into the editor.
 */
function fill(template) {
  const migrated = migrateLegacyTemplate(template);

  state = {
    templateId: migrated.id,
    templateName: migrated.templateName || "",
    churchId: migrated.churchId || "",
    churchName: migrated.churchName || "",
    pastorId: migrated.pastorId || "",
    pastorName: migrated.pastorName || "",
    paperSize: migrated.paperSize || "a4",
    orientation: migrated.orientation || "portrait",
    blocks: cloneBlocks(migrated.blocks),
  };

  qs("#templateName").value = state.templateName;
  qs("#paperSize").value = state.paperSize;
  qs("#orientation").value = state.orientation;

  loadChurchOptions();
  qs("#churchId").value = state.churchId;
  updatePastorOptions();

  selectedBlockId = null;
  renderCanvas();
  renderLayers();
  renderProperties();
}

/**
 * Reset the editor to a brand new template.
 */
function resetTemplateForm() {
  state = {
    templateId: "",
    templateName: "",
    churchId: "",
    churchName: "",
    pastorId: "",
    pastorName: "",
    paperSize: "a4",
    orientation: "portrait",
    blocks: defaultBlocks(),
  };

  qs("#templateName").value = "";
  qs("#paperSize").value = "a4";
  qs("#orientation").value = "portrait";

  loadChurchOptions();
  qs("#churchId").value = "";
  updatePastorOptions();

  selectedBlockId = null;
  renderCanvas();
  renderLayers();
  renderProperties();
}

/* ------------------------------------------------------------------ */
/*  Event wiring: meta fields                                          */
/* ------------------------------------------------------------------ */

qs("#churchId").addEventListener("change", () => {
  state.churchId = qs("#churchId").value;
  state.pastorId = "";
  updatePastorOptions();
  renderCanvas();
});

qs("#pastorId").addEventListener("change", () => {
  state.pastorId = qs("#pastorId").value;
  renderCanvas();
});

qs("#paperSize").addEventListener("change", () => {
  state.paperSize = qs("#paperSize").value;
  renderCanvas();
});

qs("#orientation").addEventListener("change", () => {
  state.orientation = qs("#orientation").value;
  renderCanvas();
});

qs("#newTemplate").addEventListener("click", resetTemplateForm);

qs("#addTextBlock").addEventListener("click", addTextBlock);

qs("#addWitnessBlock").addEventListener(
  "click",
  addWitnessGridBlock,
);

/* ------------------------------------------------------------------ */
/*  Delete template                                                    */
/* ------------------------------------------------------------------ */

qs("#deleteTemplate").addEventListener("click", async () => {
  if (!state.templateId) {
    toast("Select a saved template before deleting.", "error");
    return;
  }

  const confirmed = confirmAction(
    "Delete this certificate template?",
  );

  if (!confirmed) return;

  try {
    await deleteDoc(
      doc(db, "certificateTemplates", state.templateId),
    );

    toast("Template deleted.");
    resetTemplateForm();
    await load();
  } catch (error) {
    console.error(error);
    toast("Unable to delete the template.", "error");
  }
});

/* ------------------------------------------------------------------ */
/*  Save template                                                      */
/* ------------------------------------------------------------------ */

qs("#saveTemplate").addEventListener("click", async () => {
  if (currentUser.profile.role !== "administrator") {
    toast("Only administrators can save templates.", "error");
    return;
  }

  const church = selectedChurch();
  const pastor = selectedPastor();
  const templateName = qs("#templateName").value.trim();

  if (!templateName) {
    toast("Please enter a template name.", "error");
    return;
  }

  if (!church) {
    toast("Please select a church.", "error");
    return;
  }

  if (!pastor) {
    toast("Please select a pastor.", "error");
    return;
  }

  const data = removeUndefined({
    templateName,
    churchId: church.id || "",
    churchName: church.name || church.churchName || "",
    pastorId: pastor.id || "",
    pastorName: fullName(pastor) || pastor.pastorName || pastor.name || "",
    paperSize: state.paperSize || "a4",
    orientation: state.orientation || "portrait",
    blocks: cloneBlocks(state.blocks),
  });

  try {
    if (state.templateId) {
      await updateDoc(
        doc(db, "certificateTemplates", state.templateId),
        {
          ...data,
          updatedAt: serverTimestamp(),
        },
      );

      toast("Template updated.");
    } else {
      await addDoc(collection(db, "certificateTemplates"), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast("Template saved.");
    }

    resetTemplateForm();
    await load();
  } catch (error) {
    console.error(error);
    toast("Unable to save the certificate template.", "error");
  }
});

load();