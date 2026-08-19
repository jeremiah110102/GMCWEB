import {
  db,
  initPage,
  qs,
  toast,
  fullName,
  formatDate,
} from "./common.js";

import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  migrateLegacyTemplate,
  replaceTokens,
} from "./certificateBlocks.js";

await initPage();

const recordId = new URLSearchParams(location.search).get("id");
const loading = qs("#certificateLoading");
const paper = qs("#certificatePaper");

function stop(message) {
  if (loading) loading.textContent = message;
  throw new Error(message);
}

if (!recordId) stop("No certificate record selected.");

const dedicationSnapshot = await getDoc(doc(db, "dedications", recordId));
if (!dedicationSnapshot.exists()) stop("Certificate record not found.");

const dedication = { id: dedicationSnapshot.id, ...dedicationSnapshot.data() };

async function getOptionalDocument(collectionName, documentId) {
  if (!documentId) return null;
  const snapshot = await getDoc(doc(db, collectionName, String(documentId)));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

const [churchRecord, pastorRecord, templateRecord] = await Promise.all([
  getOptionalDocument("churches", dedication.churchId),
  getOptionalDocument("pastors", dedication.pastorId),
  getOptionalDocument("certificateTemplates", dedication.templateId),
]);

if (!templateRecord) stop("The certificate template could not be found.");

const church = churchRecord || {
  name: dedication.churchName || "",
  address: dedication.churchAddress || "",
  regNo: dedication.churchRegistrationNumber || "",
};

const pastor = pastorRecord || {
  firstName: "",
  lastName: "",
  position: dedication.pastorTitle || "Officiating Minister",
};

const template = migrateLegacyTemplate(templateRecord);
const godparents = (dedication.godparents || [])
  .map((person) => typeof person === "string" ? person : person?.name)
  .filter(Boolean);

const churchName = church.name || church.churchName || dedication.churchName || "";
const churchAddress = church.address || church.churchAddress || dedication.churchAddress || "";
const registrationNumber =
  church.regNo || church.registrationNumber || church.registrationNo || "";
const pastorName = dedication.pastorName || fullName(pastor);

const tokenData = {
  name: fullName(dedication),
  sex: dedication.gender || dedication.sex || "",
  birthPlace: dedication.birthplace || dedication.birthPlace || "",
  birthDate: formatDate(dedication.birthDate),
  fatherName: dedication.fatherName || "",
  motherName: dedication.motherName || "",
  churchName,
  churchAddress,
  regNo: registrationNumber
    ? `Sec. Reg. No. ${registrationNumber}`
    : "",
  pastorName,
  pastorTitle: pastor.position || dedication.pastorTitle || "Officiating Minister",
  dedicationDate: formatDate(dedication.dedicationDate),
  witnesses: godparents,
  scripture:
    dedication.scripture ||
    '“They brought Him to Jerusalem to present Him to the Lord.” — Luke 2:22',
  pageNo: dedication.pageNo || dedication.certificateNumber || "",
  certificateNumber: dedication.certificateNumber || "",
};

function applyTextStyle(element, block) {
  element.style.fontFamily = `"${block.fontFamily || "Georgia"}", serif`;
  element.style.fontSize = `${Number(block.fontSize) || 12}pt`;
  element.style.color = block.color || "#090909";
  element.style.textAlign = block.align || "center";
  element.style.fontWeight = block.bold ? "700" : "400";
  element.style.fontStyle = block.italic ? "italic" : "normal";
  element.style.textDecoration = block.underline ? "underline" : "none";
  element.style.textTransform = block.uppercase ? "uppercase" : "none";
  element.style.whiteSpace = "pre-wrap";
  element.style.lineHeight = "1.25";

  if (block.borderTop) {
    element.style.borderTop = "2px solid currentColor";
    element.style.paddingTop = "6px";
  }
  if (block.borderBottom) {
    element.style.borderBottom = "2px solid currentColor";
    element.style.paddingBottom = "6px";
  }
}

function renderBlock(block) {
  const element = document.createElement("div");
  element.className = `certificate-output-block certificate-output-block--${block.type}`;
  element.style.position = "absolute";
  element.style.left = `${Number(block.x) || 0}%`;
  element.style.top = `${Number(block.y) || 0}%`;
  element.style.width = `${Number(block.w) || 10}%`;
  element.style.boxSizing = "border-box";

  if (block.type === "image") {
    const image = document.createElement("img");
    image.src = block.src || "assets/img/logo.png";
    image.alt = "Church logo";
    image.crossOrigin = "anonymous";
    image.style.display = "block";
    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "contain";
    element.style.height = `${Number(block.h) || Number(block.w) || 10}%`;
    element.appendChild(image);
    return element;
  }

  applyTextStyle(element, block);

  if (block.type === "witnessGrid") {
    element.style.display = "grid";
    element.style.gridTemplateColumns = `repeat(${Math.max(1, Number(block.columns) || 2)}, minmax(0, 1fr))`;
    element.style.gap = "8px 18px";
    const names = godparents.length ? godparents : ["—"];
    names.forEach((name) => {
      const cell = document.createElement("span");
      cell.textContent = name;
      element.appendChild(cell);
    });
  } else {
    element.textContent = replaceTokens(block.content || "", tokenData);
  }

  return element;
}

function renderCertificate() {
  const landscape = template.orientation === "landscape";
  paper.innerHTML = "";
  paper.hidden = false;
  paper.classList.toggle("landscape", landscape);
  paper.dataset.paperSize = template.paperSize || "a4";
  paper.style.position = "relative";
  paper.style.overflow = "hidden";
  paper.style.boxSizing = "border-box";
  paper.style.background = "#ffffff";
  paper.style.width = "100%";
  paper.style.aspectRatio = landscape ? "297 / 210" : "210 / 297";

  (template.blocks || []).forEach((block) => {
    paper.appendChild(renderBlock(block));
  });

  if (loading) loading.remove();
}

renderCertificate();

const safeName = (value) => String(value || "certificate")
  .replace(/[^a-z0-9]+/gi, "-")
  .replace(/^-+|-+$/g, "");
const fileBase = () =>
  `${safeName(dedication.certificateNumber)}-${safeName(fullName(dedication))}`;

async function capturePaper(scale = 3) {
  await document.fonts.ready;
  return html2canvas(paper, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
  });
}

qs("#printCertificate").onclick = () => window.print();

qs("#downloadPdf").onclick = async () => {
  const button = qs("#downloadPdf");
  button.disabled = true;
  button.textContent = "Preparing PDF…";

  try {
    const canvas = await capturePaper(3);
    const { jsPDF } = window.jspdf;
    const landscape = template.orientation === "landscape";
    const format = template.paperSize === "letter" ? "letter" : "a4";
    const pdf = new jsPDF({
      orientation: landscape ? "landscape" : "portrait",
      unit: "mm",
      format,
      compress: true,
    });
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", 0, 0, width, height, undefined, "FAST");
    pdf.save(`${fileBase()}.pdf`);
    toast("PDF downloaded.");
  } catch (error) {
    console.error(error);
    toast(error.message || "Unable to create PDF.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Download PDF";
  }
};

qs("#downloadWord").onclick = async () => {
  const button = qs("#downloadWord");
  button.disabled = true;
  button.textContent = "Preparing Word…";

  try {
    const canvas = await capturePaper(2.5);
    const imageBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!imageBlob) throw new Error("Unable to capture the certificate.");

    const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());
    const D = window.docx;
    const landscape = template.orientation === "landscape";
    const letter = template.paperSize === "letter";
    const pageWidth = letter ? 12240 : 11906;
    const pageHeight = letter ? 15840 : 16838;
    const imageWidth = landscape ? 960 : 680;
    const imageHeight = landscape ? 680 : 960;

    const documentFile = new D.Document({
      sections: [{
        properties: {
          page: {
            size: {
              width: landscape ? pageHeight : pageWidth,
              height: landscape ? pageWidth : pageHeight,
              orientation: landscape
                ? D.PageOrientation.LANDSCAPE
                : D.PageOrientation.PORTRAIT,
            },
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        },
        children: [
          new D.Paragraph({
            alignment: D.AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
              new D.ImageRun({
                data: imageBytes,
                transformation: { width: imageWidth, height: imageHeight },
              }),
            ],
          }),
        ],
      }],
    });

    const blob = await D.Packer.toBlob(documentFile);
    saveAs(blob, `${fileBase()}.docx`);
    toast("Word file downloaded.");
  } catch (error) {
    console.error(error);
    toast(error.message || "Unable to create Word file.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Download Word";
  }
};
