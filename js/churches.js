import {
  db,
  initPage,
  qs,
  renderTable,
  toast,
  confirmAction,
  esc,
} from "./common.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const { profile } = await initPage();
let items = [];
async function load() {
  const s = await getDocs(query(collection(db, "churches"), orderBy("name")));
  items = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();
}
function render() {
  const term = qs("#searchInput").value.toLowerCase();
  const filtered = items.filter((x) =>
    [x.name, x.address, x.email].join(" ").toLowerCase().includes(term),
  );
  renderTable(
    "#churchTable",
    ["Church", "Address", "Contact", "Email", "Actions"],
    filtered.map(
      (x) =>
        `<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.address)}</td><td>${esc(x.contactNumber || "—")}</td><td>${esc(x.email || "—")}</td><td><div class="actions"><button class="btn ghost view" data-id="${x.id}">View</button>${profile.role === "administrator" ? `<button class="btn secondary edit" data-id="${x.id}">Edit</button><button class="btn danger delete" data-id="${x.id}">Delete</button>` : ""}</div></td></tr>`,
    ),
  );
  document.querySelectorAll(".view,.edit").forEach(
    (b) =>
      (b.onclick = () =>
        fill(
          items.find((x) => x.id === b.dataset.id),
          b.classList.contains("view"),
        )),
  );
  document
    .querySelectorAll(".delete")
    .forEach((b) => (b.onclick = () => remove(b.dataset.id)));
}
function fill(x, view = false) {
  qs("#churchId").value = x.id;
  qs("#churchName").value = x.name;
  qs("#churchAddress").value = x.address;
  qs("#churchContact").value = x.contactNumber || "";
  qs("#churchEmail").value = x.email || "";
  qs("#churchModalTitle").textContent = view ? "Church details" : "Edit church";
  qs("#churchForm")
    .querySelectorAll("input,textarea")
    .forEach((i) => (i.disabled = view));
  qs("#saveChurch").hidden = view;
  qs("#churchModal").showModal();
}
async function remove(id) {
  if (
    confirmAction(
      "Delete this church? Pastors and records using it should be reassigned first.",
    )
  ) {
    await deleteDoc(doc(db, "churches", id));
    toast("Church deleted.");
    load();
  }
}
qs("#churchModal").addEventListener("close", () => {
  qs("#churchForm").reset();
  qs("#churchId").value = "";
  qs("#saveChurch").hidden = false;
  qs("#churchForm")
    .querySelectorAll("input,textarea")
    .forEach((i) => (i.disabled = false));
});
qs("#churchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!e.submitter || e.submitter.value !== "default") return;
  const data = {
    name: qs("#churchName").value.trim(),
    address: qs("#churchAddress").value.trim(),
    contactNumber: qs("#churchContact").value.trim(),
    email: qs("#churchEmail").value.trim(),
    updatedAt: serverTimestamp(),
  };
  const id = qs("#churchId").value;
  if (id) await updateDoc(doc(db, "churches", id), data);
  else
    await addDoc(collection(db, "churches"), {
      ...data,
      createdAt: serverTimestamp(),
    });
  qs("#churchModal").close();
  toast(id ? "Church updated." : "Church added.");
  load();
});
qs("#searchInput").oninput = render;
load();
