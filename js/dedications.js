import {
  db,
  initPage,
  qs,
  renderTable,
  toast,
  confirmAction,
  esc,
  fullName,
  formatDate,
} from "./common.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const ctx = await initPage();
const onForm = !!qs("#dedicationForm");
if (onForm && ctx.profile.role === "viewer") {
  location.replace("dedication-records.html");
}
let churches = [],
  pastors = [],
  templates = [],
  records = [];
const params = new URLSearchParams(location.search);
function number() {
  const d = new Date(),
    r = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
  return `DC-${d.getFullYear()}-${String(r).padStart(4, "0")}`;
}
function godparentRow(x = {}) {
  const div = document.createElement("div");
  div.className = "godparent-row";
  div.innerHTML = `<label>Complete name *<input class="gp-name" required value="${esc(x.name || "")}"></label><label>Type<select class="gp-type"><option ${x.type === "Godfather" ? "selected" : ""}>Godfather</option><option ${x.type === "Godmother" ? "selected" : ""}>Godmother</option></select></label><label>Address<input class="gp-address" value="${esc(x.address || "")}"></label><label>Contact<input class="gp-contact" value="${esc(x.contactNumber || "")}"></label><button class="btn danger remove-gp" type="button">Remove</button>`;
  div.querySelector(".remove-gp").onclick = () => div.remove();
  qs("#godparentsList").append(div);
}
async function formInit() {
  const [c, p, t] = await Promise.all(
    ["churches", "pastors", "certificateTemplates"].map((n) =>
      getDocs(collection(db, n)),
    ),
  );
  churches = c.docs.map((d) => ({ id: d.id, ...d.data() }));
  pastors = p.docs.map((d) => ({ id: d.id, ...d.data() }));
  templates = t.docs.map((d) => ({ id: d.id, ...d.data() }));
  qs("#churchId").innerHTML =
    '<option value="">Select church</option>' +
    churches
      .map((x) => `<option value="${x.id}">${esc(x.name)}</option>`)
      .join("");
  const editId = params.get("id");
  const cert = editId ? "" : number();
  qs("#certificateNumberBadge").textContent = cert || "Editing record";
  qs("#addGodparent").onclick = () => godparentRow();
  qs("#churchId").onchange = filterLinks;
  if (editId) {
    const s = await getDoc(doc(db, "dedications", editId));
    if (!s.exists()) return toast("Record not found.", "error");
    const x = s.data();
    qs("#recordId").value = editId;
    qs("#formTitle").textContent = "Edit Dedication";
    qs("#certificateNumberBadge").textContent = x.certificateNumber;
    [
      "firstName",
      "middleName",
      "lastName",
      "suffix",
      "gender",
      "birthDate",
      "birthplace",
      "address",
      "fatherName",
      "motherName",
      "dedicationDate",
      "dedicationPlace",
      "churchId",
      "status",
    ].forEach((k) => (qs("#" + k).value = x[k] || ""));
    filterLinks();
    qs("#pastorId").value = x.pastorId;
    qs("#templateId").value = x.templateId;
    (x.godparents || []).forEach(godparentRow);
  } else godparentRow();
}
function filterLinks() {
  const id = qs("#churchId").value;
  qs("#pastorId").disabled = !id;
  qs("#templateId").disabled = !id;
  qs("#pastorId").innerHTML =
    '<option value="">Select pastor</option>' +
    pastors
      .filter((x) => x.churchId === id)
      .map((x) => `<option value="${x.id}">${esc(fullName(x))}</option>`)
      .join("");
  qs("#templateId").innerHTML =
    '<option value="">Select template</option>' +
    templates
      .filter((x) => x.churchId === id)
      .map((x) => `<option value="${x.id}">${esc(x.templateName)}</option>`)
      .join("");
}
if (onForm) {
  await formInit();
  qs("#dedicationForm").onsubmit = async (e) => {
    e.preventDefault();
    const church = churches.find((x) => x.id === qs("#churchId").value),
      pastor = pastors.find((x) => x.id === qs("#pastorId").value),
      template = templates.find((x) => x.id === qs("#templateId").value);
    const id = qs("#recordId").value;
    const keys = [
      "firstName",
      "middleName",
      "lastName",
      "suffix",
      "gender",
      "birthDate",
      "birthplace",
      "address",
      "fatherName",
      "motherName",
      "dedicationDate",
      "dedicationPlace",
      "status",
    ];
    const data = Object.fromEntries(
      keys.map((k) => [k, qs("#" + k).value.trim()]),
    );
    data.godparents = [...document.querySelectorAll(".godparent-row")].map(
      (r) => ({
        name: r.querySelector(".gp-name").value.trim(),
        type: r.querySelector(".gp-type").value,
        address: r.querySelector(".gp-address").value.trim(),
        contactNumber: r.querySelector(".gp-contact").value.trim(),
      }),
    );
    Object.assign(data, {
      churchId: church.id,
      churchName: church.name,
      churchAddress: church.address,
      pastorId: pastor.id,
      pastorName: fullName(pastor),
      templateId: template.id,
      updatedAt: serverTimestamp(),
      updatedBy: ctx.user.uid,
    });
    if (id) await updateDoc(doc(db, "dedications", id), data);
    else
      await addDoc(collection(db, "dedications"), {
        ...data,
        certificateNumber: qs("#certificateNumberBadge").textContent,
        createdAt: serverTimestamp(),
        createdBy: ctx.user.uid,
      });
    toast(id ? "Record corrected and saved." : "Dedication saved.");
    setTimeout(() => (location.href = "dedication-records.html"), 700);
  };
} else {
  await recordsInit();
}
async function recordsInit() {
  const [c, r] = await Promise.all([
    getDocs(collection(db, "churches")),
    getDocs(query(collection(db, "dedications"), orderBy("createdAt", "desc"))),
  ]);
  churches = c.docs.map((d) => ({ id: d.id, ...d.data() }));
  records = r.docs.map((d) => ({ id: d.id, ...d.data() }));
  qs("#recordChurchFilter").innerHTML =
    '<option value="">All churches</option>' +
    churches
      .map((x) => `<option value="${x.id}">${esc(x.name)}</option>`)
      .join("");
  [
    "recordSearch",
    "recordChurchFilter",
    "recordStatusFilter",
    "recordSort",
  ].forEach((id) =>
    qs("#" + id).addEventListener(
      id === "recordSearch" ? "input" : "change",
      () => renderRecords(1),
    ),
  );
  renderRecords(1);
}
function renderRecords(page = 1) {
  const term = qs("#recordSearch").value.toLowerCase(),
    church = qs("#recordChurchFilter").value,
    status = qs("#recordStatusFilter").value,
    sort = qs("#recordSort").value;
  let list = records.filter(
    (x) =>
      (!church || x.churchId === church) &&
      (!status || x.status === status) &&
      [x.certificateNumber, fullName(x), x.pastorName]
        .join(" ")
        .toLowerCase()
        .includes(term),
  );
  list.sort((a, b) =>
    sort === "name-asc"
      ? fullName(a).localeCompare(fullName(b))
      : sort === "name-desc"
        ? fullName(b).localeCompare(fullName(a))
        : sort === "date-asc"
          ? String(a.dedicationDate).localeCompare(String(b.dedicationDate))
          : String(b.dedicationDate).localeCompare(String(a.dedicationDate)),
  );
  const size = 10,
    pages = Math.max(1, Math.ceil(list.length / size));
  page = Math.min(page, pages);
  const slice = list.slice((page - 1) * size, page * size);
  renderTable(
    "#recordsTable",
    [
      "Certificate #",
      "Dedicated person",
      "Church",
      "Pastor",
      "Date",
      "Status",
      "Actions",
    ],
    slice.map(
      (x) =>
        `<tr><td><strong>${esc(x.certificateNumber)}</strong></td><td>${esc(fullName(x))}</td><td>${esc(x.churchName)}</td><td>${esc(x.pastorName)}</td><td>${formatDate(x.dedicationDate)}</td><td><span class="badge ${(x.status || "active").toLowerCase()}">${esc(x.status)}</span></td><td><div class="actions"><a class="btn ghost" href="certificate.html?id=${x.id}">Preview / Print</a>${ctx.profile.role !== "viewer" ? `<a class="btn secondary" href="dedication-form.html?id=${x.id}">Edit</a>` : ""}${ctx.profile.role === "administrator" ? `<button class="btn danger delete-record" data-id="${x.id}">Delete</button>` : ""}</div></td></tr>`,
    ),
  );
  document.querySelectorAll(".delete-record").forEach(
    (b) =>
      (b.onclick = async () => {
        if (confirmAction("Permanently delete this dedication record?")) {
          await deleteDoc(doc(db, "dedications", b.dataset.id));
          records = records.filter((x) => x.id !== b.dataset.id);
          toast("Record deleted.");
          renderRecords(page);
        }
      }),
  );
  qs("#pagination").innerHTML = Array.from(
    { length: pages },
    (_, i) =>
      `<button class="${i + 1 === page ? "active" : ""}" data-page="${i + 1}">${i + 1}</button>`,
  ).join("");
  document
    .querySelectorAll("#pagination button")
    .forEach((b) => (b.onclick = () => renderRecords(+b.dataset.page)));
}
