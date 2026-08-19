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
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
await initPage(["administrator"]);
let users = [];
async function load() {
  const s = await getDocs(collection(db, "users"));
  users = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderTable(
    "#usersTable",
    ["Name", "Email", "Role", "UID", "Actions"],
    users.map(
      (x) =>
        `<tr><td><strong>${esc(x.displayName)}</strong></td><td>${esc(x.email)}</td><td><span class="badge gold">${esc(x.role)}</span></td><td><code>${esc(x.id)}</code></td><td><button class="btn secondary edit-user" data-id="${x.id}">Edit</button> <button class="btn danger delete-user" data-id="${x.id}">Delete profile</button></td></tr>`,
    ),
  );
  document
    .querySelectorAll(".edit-user")
    .forEach(
      (b) => (b.onclick = () => fill(users.find((x) => x.id === b.dataset.id))),
    );
  document.querySelectorAll(".delete-user").forEach(
    (b) =>
      (b.onclick = async () => {
        if (
          confirmAction(
            "Delete this Firestore profile? The Firebase Authentication account must be removed separately.",
          )
        ) {
          await deleteDoc(doc(db, "users", b.dataset.id));
          toast("User profile deleted.");
          load();
        }
      }),
  );
}
function fill(x) {
  qs("#uid").value = x.id;
  qs("#uid").readOnly = true;
  qs("#displayName").value = x.displayName;
  qs("#userEmail").value = x.email;
  qs("#role").value = x.role;
  qs("#userModal").showModal();
}
qs("#userModal").addEventListener("close", () => {
  qs("#userForm").reset();
  qs("#uid").readOnly = false;
});
qs("#userForm").onsubmit = async (e) => {
  e.preventDefault();
  if (e.submitter?.value !== "default") return;
  const uid = qs("#uid").value.trim();
  await setDoc(
    doc(db, "users", uid),
    {
      displayName: qs("#displayName").value.trim(),
      email: qs("#userEmail").value.trim(),
      role: qs("#role").value,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
  qs("#userModal").close();
  toast("User profile saved.");
  load();
};
load();
