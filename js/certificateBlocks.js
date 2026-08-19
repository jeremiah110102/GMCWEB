/**
 * certificateBlocks.js
 *
 * Shared data model for certificate templates.
 *
 * A template is stored as:
 * {
 *   templateName, churchId, churchName, pastorId, pastorName,
 *   paperSize, orientation,
 *   blocks: [ Block, ... ]
 * }
 *
 * A Block is one of:
 *   - "image"       { id, type, src, x, y, w, h }
 *   - "text"        { id, type, content, x, y, w,
 *                     fontFamily, fontSize, color, align,
 *                     bold, italic, underline, uppercase,
 *                     borderTop, borderBottom }
 *   - "witnessGrid" { id, type, names /* string[] * /, columns, x, y, w,
 *                     fontFamily, fontSize, color, align, bold }
 *
 * All x / y / w values are PERCENTAGES of the canvas width/height (0-100),
 * so a template scales cleanly across paper size and orientation, and
 * exactly matches whatever the browser prints from the live preview.
 *
 * Text content may contain tokens like {{name}}, {{birthPlace}}, etc.
 * replaceTokens() swaps these for real (or sample) values. This same
 * function should be reused by any future "generate this certificate for
 * a real child" export page — just pass real data instead of sample data.
 */

export const FONT_OPTIONS = [
  "Georgia",
  "Times New Roman",
  "Garamond",
  "Arial",
  "Verdana",
  "Broadway",
  "Algerian",
  "Monotype Corsiva",
  "Bookman Old Style",
];

export const TOKENS = [
  { key: "freeText", label: "Free Text" },
  { key: "name", label: "Child's Name" },
  { key: "sex", label: "Sex" },
  { key: "birthPlace", label: "Birth Place" },
  { key: "birthDate", label: "Birth Date" },
  { key: "fatherName", label: "Father's Name" },
  { key: "motherName", label: "Mother's Name" },
  { key: "churchName", label: "Church Name" },
  { key: "churchAddress", label: "Church Address" },
  { key: "churchFreeText", label: "Church Additional Text" },
  { key: "regNo", label: "Church Registration No." },
  { key: "pastorName", label: "Pastor Name" },
  { key: "pastorTitle", label: "Pastor Title" },
  { key: "dedicationDate", label: "Dedication Date" },
  { key: "witnesses", label: "Witnesses (list)" },
  { key: "scripture", label: "Scripture / Verse" },
  { key: "pageNo", label: "Page No." },
];

let uidCounter = 0;

/** Generate a short unique id for a new block. */
export function newBlockId(prefix = "b") {
  uidCounter += 1;

  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }

  return `${prefix}_${Date.now()}_${uidCounter}`;
}

/**
 * Sample data used to preview a template with placeholder values.
 * A future "print certificate for a real child" page should build an
 * equivalent object from real record data and pass it to replaceTokens
 * instead of this sample set.
 */
export function buildSampleData(selectedChurch, selectedPastor) {
  return {
    freeText: "FREE TEXT",
    name: "CHILD NAME",
    sex: "Male",
    birthPlace: "Birth Place",
    birthDate: "Birth Date",
    fatherName: "FATHER'S NAME",
    motherName: "MOTHER'S NAME",
    churchName:
      selectedChurch?.name || selectedChurch?.churchName || "CHURCH NAME",
    churchAddress:
      selectedChurch?.address || selectedChurch?.churchAddress || "Complete church address",
    churchFreeText:
      selectedChurch?.freeText || selectedChurch?.churchFreeText || "",
    regNo:
      selectedChurch?.regNo ||
      selectedChurch?.registrationNumber ||
      selectedChurch?.registrationNo ||
      "Sec. Reg. No. XXXXXXXXX",
    pastorName: selectedPastor
      ? `${selectedPastor.firstName || ""} ${
          selectedPastor.lastName || ""
        }`.trim() || "PASTOR NAME"
      : "PASTOR NAME",
    pastorTitle: selectedPastor?.position || "Officiating Minister",
    dedicationDate: "this __ day of ______, 20__",
    witnesses: [
      "WITNESS ONE",
      "WITNESS TWO",
      "WITNESS THREE",
      "WITNESS FOUR",
      "WITNESS FIVE",
      "WITNESS SIX",
      "WITNESS SEVEN",
      "WITNESS EIGHT",
    ],
    scripture:
      'His name called JESUS: "and they brought Him to Jerusalem, to present Him to the Lord" (Luke 2:21-22).',
    pageNo: "__",
  };
}

/** Replace {{token}} placeholders in a string with values from `data`. */
export function replaceTokens(content, data) {
  if (!content) return "";

  return content.replace(/{{\s*(\w+)\s*}}/g, (match, key) => {
    const value = data?.[key];

    if (Array.isArray(value)) {
      return value.join(", ");
    }

    return value !== undefined && value !== null
      ? String(value)
      : match;
  });
}

/** Fresh copy of the default certificate layout (matches the sample cert). */
export function defaultBlocks() {
  return [
    {
      id: newBlockId("logo"),
      type: "image",
      src: "assets/img/logo.png",
      x: 3,
      y: 4,
      w: 16,
      h: 12,
    },
    {
      id: newBlockId("churchName"),
      type: "text",
      content: "{{churchName}}",
      x: 21,
      y: 5,
      w: 76,
      fontFamily: "Georgia",
      fontSize: 16,
      color: "#17223b",
      align: "left",
      bold: true,
      uppercase: true,
    },
    {
      id: newBlockId("churchAddress"),
      type: "text",
      content: "{{churchAddress}}",
      x: 21,
      y: 9,
      w: 76,
      fontFamily: "Georgia",
      fontSize: 11,
      color: "#202938",
      align: "left",
    },
    {
      id: newBlockId("regNo"),
      type: "text",
      content: "{{regNo}}",
      x: 21,
      y: 12,
      w: 76,
      fontFamily: "Georgia",
      fontSize: 10,
      color: "#202938",
      align: "left",
    },
    {
      id: newBlockId("certTitle"),
      type: "text",
      content: "DEDICATION CERTIFICATE",
      x: 15,
      y: 17,
      w: 70,
      fontFamily: "Georgia",
      fontSize: 24,
      color: "#17223b",
      align: "center",
      borderTop: true,
      borderBottom: true,
    },
    {
      id: newBlockId("introText"),
      type: "text",
      content: "This certifies that",
      x: 10,
      y: 24,
      w: 80,
      fontFamily: "Georgia",
      fontSize: 13,
      color: "#202938",
      align: "center",
    },
    {
      id: newBlockId("dedicatedName"),
      type: "text",
      content: "{{name}}",
      x: 10,
      y: 27,
      w: 80,
      fontFamily: "Georgia",
      fontSize: 22,
      color: "#17223b",
      align: "center",
      bold: true,
      underline: true,
      uppercase: true,
    },
    {
      id: newBlockId("sexLine"),
      type: "text",
      content: "Sex:  {{sex}}",
      x: 25,
      y: 32,
      w: 50,
      fontFamily: "Georgia",
      fontSize: 11,
      color: "#202938",
      align: "center",
    },
    {
      id: newBlockId("birthPlace"),
      type: "text",
      content: "Birth Place:  {{birthPlace}}",
      x: 12,
      y: 35,
      w: 76,
      fontFamily: "Georgia",
      fontSize: 11,
      color: "#202938",
      align: "left",
    },
    {
      id: newBlockId("birthDate"),
      type: "text",
      content: "Birth Date:  {{birthDate}}",
      x: 12,
      y: 38,
      w: 76,
      fontFamily: "Georgia",
      fontSize: 11,
      color: "#202938",
      align: "left",
    },
    {
      id: newBlockId("dedicatedByText"),
      type: "text",
      content: "Was dedicated to the Lord by",
      x: 10,
      y: 42,
      w: 80,
      fontFamily: "Georgia",
      fontSize: 12,
      color: "#202938",
      align: "center",
    },
    {
      id: newBlockId("fatherName"),
      type: "text",
      content: "{{fatherName}}",
      x: 12,
      y: 46,
      w: 35,
      fontFamily: "Georgia",
      fontSize: 12,
      color: "#17223b",
      align: "center",
      bold: true,
      underline: true,
      uppercase: true,
    },
    {
      id: newBlockId("motherName"),
      type: "text",
      content: "{{motherName}}",
      x: 53,
      y: 46,
      w: 35,
      fontFamily: "Georgia",
      fontSize: 12,
      color: "#17223b",
      align: "center",
      bold: true,
      underline: true,
      uppercase: true,
    },
    {
      id: newBlockId("fatherLabel"),
      type: "text",
      content: "Father",
      x: 12,
      y: 49,
      w: 35,
      fontFamily: "Georgia",
      fontSize: 10,
      color: "#202938",
      align: "center",
    },
    {
      id: newBlockId("motherLabel"),
      type: "text",
      content: "Mother",
      x: 53,
      y: 49,
      w: 35,
      fontFamily: "Georgia",
      fontSize: 10,
      color: "#202938",
      align: "center",
    },
    {
      id: newBlockId("ackParagraph"),
      type: "text",
      content:
        "This certifies that {{name}} was dedicated to the Lord.",
      x: 8,
      y: 52,
      w: 84,
      fontFamily: "Georgia",
      fontSize: 11,
      color: "#202938",
      align: "center",
    },
    {
      id: newBlockId("venueLine"),
      type: "text",
      content: "The solemn act of dedication was held at",
      x: 8,
      y: 60,
      w: 84,
      fontFamily: "Georgia",
      fontSize: 11,
      color: "#202938",
      align: "center",
    },
    {
      id: newBlockId("venueChurchName"),
      type: "text",
      content: "{{churchName}}",
      x: 8,
      y: 63,
      w: 84,
      fontFamily: "Georgia",
      fontSize: 13,
      color: "#17223b",
      align: "center",
      bold: true,
    },
    {
      id: newBlockId("venueAddress"),
      type: "text",
      content: "{{churchAddress}}",
      x: 8,
      y: 66,
      w: 84,
      fontFamily: "Georgia",
      fontSize: 11,
      color: "#202938",
      align: "center",
    },
    {
      id: newBlockId("dedicationDateLine"),
      type: "text",
      content: "On {{dedicationDate}}",
      x: 8,
      y: 69,
      w: 84,
      fontFamily: "Georgia",
      fontSize: 11,
      color: "#202938",
      align: "center",
    },
    {
      id: newBlockId("witnessesLabel"),
      type: "text",
      content: "WITNESSES:",
      x: 8,
      y: 73,
      w: 84,
      fontFamily: "Georgia",
      fontSize: 10,
      color: "#202938",
      align: "center",
      bold: true,
    },
    {
      id: newBlockId("witnessGrid"),
      type: "witnessGrid",
      names: [],
      columns: 4,
      x: 6,
      y: 76,
      w: 88,
      fontFamily: "Georgia",
      fontSize: 10,
      color: "#202938",
      align: "left",
      bold: true,
    },
    {
      id: newBlockId("pastorName"),
      type: "text",
      content: "{{pastorName}}",
      x: 30,
      y: 89,
      w: 40,
      fontFamily: "Georgia",
      fontSize: 12,
      color: "#17223b",
      align: "center",
      bold: true,
      underline: true,
      uppercase: true,
    },
    {
      id: newBlockId("pastorTitle"),
      type: "text",
      content: "{{pastorTitle}}",
      x: 30,
      y: 92,
      w: 40,
      fontFamily: "Georgia",
      fontSize: 10,
      color: "#202938",
      align: "center",
    },
    {
      id: newBlockId("scripture"),
      type: "text",
      content: "{{scripture}}",
      x: 8,
      y: 95,
      w: 84,
      fontFamily: "Georgia",
      fontSize: 9,
      color: "#202938",
      align: "left",
      italic: true,
    },
    {
      id: newBlockId("pageNo"),
      type: "text",
      content: "Dc Page No. {{pageNo}}",
      x: 5,
      y: 99,
      w: 40,
      fontFamily: "Georgia",
      fontSize: 9,
      color: "#202938",
      align: "left",
    },
  ];
}

/**
 * Upgrade a template saved under the OLD flat-field schema (templateName,
 * certificateTitle, titleFontFamily, ... no `blocks` array) into the new
 * block-based schema, carrying over whatever styling it had.
 * Templates that already have `blocks` are returned unchanged.
 */
export function migrateLegacyTemplate(template) {
  if (Array.isArray(template.blocks)) {
    return template;
  }

  const blocks = defaultBlocks();
  const byId = (namePrefix) =>
    blocks.find((block) => block.id.startsWith(namePrefix));

  const certTitle = byId("certTitle");
  if (certTitle && template.certificateTitle) {
    certTitle.content = template.certificateTitle;
    certTitle.fontFamily =
      template.titleFontFamily || certTitle.fontFamily;
    certTitle.fontSize =
      template.titleFontSize || certTitle.fontSize;
    certTitle.color = template.titleFontColor || certTitle.color;
    certTitle.align = template.titleAlignment || certTitle.align;
  }

  const dedicatedName = byId("dedicatedName");
  if (dedicatedName) {
    dedicatedName.fontFamily =
      template.nameFontFamily || dedicatedName.fontFamily;
    dedicatedName.fontSize =
      template.nameFontSize || dedicatedName.fontSize;
    dedicatedName.color =
      template.nameFontColor || dedicatedName.color;
    dedicatedName.align =
      template.nameAlignment || dedicatedName.align;
  }

  const ackParagraph = byId("ackParagraph");
  if (ackParagraph && template.certificateMessage) {
    ackParagraph.content = template.certificateMessage;
    ackParagraph.fontFamily =
      template.bodyFontFamily || ackParagraph.fontFamily;
    ackParagraph.fontSize =
      template.bodyFontSize || ackParagraph.fontSize;
    ackParagraph.color =
      template.bodyFontColor || ackParagraph.color;
    ackParagraph.align =
      template.bodyAlignment || ackParagraph.align;
  }

  const churchAddress = byId("churchAddress");
  if (churchAddress && template.addressFreeText) {
    churchAddress.content = `{{churchAddress}}\n${template.addressFreeText}`;
    churchAddress.fontFamily =
      template.addressFontFamily || churchAddress.fontFamily;
    churchAddress.fontSize =
      template.addressFontSize || churchAddress.fontSize;
  }

  return {
    ...template,
    blocks,
  };
}

/** Deep-clone a blocks array so edits don't mutate stored/default data. */
export function cloneBlocks(blocks) {
  return blocks.map((block) => ({
    ...block,
    names: block.names ? [...block.names] : undefined,
  }));
}

const TOKEN_LABELS = Object.fromEntries(
  TOKENS.map((token) => [token.key, token.label]),
);

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Turn raw block content (which may contain {{token}} placeholders) into
 * editable HTML where each token is a non-editable "chip" span. This is
 * what a text block's contenteditable area is filled with, so the admin
 * always sees and edits the real template source (not sample data).
 */
export function contentToChipHtml(content) {
  if (!content) return "";

  const parts = content.split(/({{\s*\w+\s*}})/g);

  return parts
    .map((part) => {
      const match = part.match(/^{{\s*(\w+)\s*}}$/);

      if (match) {
        const key = match[1];
        const label = TOKEN_LABELS[key] || key;

        return `<span class="token-chip" contenteditable="false" data-token="${key}">${escapeHtml(
          label,
        )}</span>`;
      }

      return escapeHtml(part).replace(/\n/g, "<br>");
    })
    .join("");
}

/**
 * Walk a contenteditable element that was filled by contentToChipHtml()
 * and reconstruct the raw {{token}} source string from it.
 */
export function chipHtmlElementToContent(element) {
  let out = "";

  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList?.contains("token-chip")) {
        out += `{{${node.dataset.token}}}`;
      } else if (node.tagName === "BR") {
        out += "\n";
      } else {
        out += chipHtmlElementToContent(node);

        if (getComputedStyle(node).display === "block") {
          out += "\n";
        }
      }
    }
  });

  return out;
}