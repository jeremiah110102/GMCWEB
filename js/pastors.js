import {
  db,
  initPage,
  qs,
  renderTable,
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
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const { profile } = await initPage();
let pastors = [],
  churches = [];
async function load() {
  const [c, p] = await Promise.all([
    getDocs(query(collection(db, "churches"), orderBy("name"))),
    getDocs(query(collection(db, "pastors"), orderBy("lastName"))),
  ]);
  churches = c.docs.map((d) => ({ id: d.id, ...d.data() }));
  pastors = p.docs.map((d) => ({ id: d.id, ...d.data() }));
  const opts = churches
    .map((x) => `<option value="${x.id}">${esc(x.name)}</option>`)
    .join("");
  qs("#assignedChurch").innerHTML =
    '<option value="">Select church</option>' + opts;
  qs("#churchFilter").innerHTML =
    '<option value="">All churches</option>' + opts;
  render();
}
function render() {
  const term = qs("#searchInput").value.toLowerCase(),
    church = qs("#churchFilter").value;
  const list = pastors.filter(
    (x) =>
      (!church || x.churchId === church) &&
      [fullName(x), x.position, x.churchName]
        .join(" ")
        .toLowerCase()
        .includes(term),
  );
  renderTable(
    "#pastorTable",
    ["Pastor", "Position", "Assigned church", "Contact", "Actions"],
    list.map(
      (x) =>
        `<tr><td><strong>${esc(fullName(x))}</strong></td><td>${esc(x.position)}</td><td>${esc(x.churchName)}</td><td>${esc(x.contactNumber || "—")}</td><td><div class="actions"><button class="btn ghost view" data-id="${x.id}">View</button>${profile.role === "administrator" ? `<button class="btn secondary edit" data-id="${x.id}">Edit</button><button class="btn danger delete" data-id="${x.id}">Delete</button>` : ""}</div></td></tr>`,
    ),
  );
  document.querySelectorAll(".view,.edit").forEach(
    (b) =>
      (b.onclick = () =>
        fill(
          pastors.find((x) => x.id === b.dataset.id),
          b.classList.contains("view"),
        )),
  );
  document.querySelectorAll(".delete").forEach(
    (b) =>
      (b.onclick = async () => {
        if (confirmAction("Delete this pastor?")) {
          await deleteDoc(doc(db, "pastors", b.dataset.id));
          toast("Pastor deleted.");
          load();
        }
      }),
  );
}
function fill(x, view) {
  [
    "firstName",
    "middleName",
    "lastName",
    "suffix",
    "position",
    "contactNumber",
  ].forEach((k) => (qs("#" + k).value = x[k] || ""));
  qs("#pastorId").value = x.id;
  qs("#assignedChurch").value = x.churchId;
  qs("#pastorModalTitle").textContent = view ? "Pastor details" : "Edit pastor";
  qs("#pastorForm")
    .querySelectorAll("input,select")
    .forEach((i) => (i.disabled = view));
  qs("#pastorForm button[type=submit]").hidden = view;
  qs("#pastorModal").showModal();
}
qs("#pastorModal").addEventListener("close", () => {
  qs("#pastorForm").reset();
  qs("#pastorId").value = "";
  qs("#pastorForm")
    .querySelectorAll("input,select")
    .forEach((i) => (i.disabled = false));
  qs("#pastorForm button[type=submit]").hidden = false;
});
qs("#pastorForm").onsubmit = async (e) => {
  e.preventDefault();
  if (e.submitter?.value !== "default") return;
  const church = churches.find((x) => x.id === qs("#assignedChurch").value);
  const data = {
    firstName: qs("#firstName").value.trim(),
    middleName: qs("#middleName").value.trim(),
    lastName: qs("#lastName").value.trim(),
    suffix: qs("#suffix").value.trim(),
    position: qs("#position").value.trim(),
    contactNumber: qs("#contactNumber").value.trim(),
    churchId: church.id,
    churchName: church.name,
    updatedAt: serverTimestamp(),
  };
  const id = qs("#pastorId").value;
  if (id) await updateDoc(doc(db, "pastors", id), data);
  else
    await addDoc(collection(db, "pastors"), {
      ...data,
      createdAt: serverTimestamp(),
    });
  qs("#pastorModal").close();
  toast(id ? "Pastor updated." : "Pastor added.");
  load();
};
qs("#searchInput").oninput = render;
qs("#churchFilter").onchange = render;
load();
