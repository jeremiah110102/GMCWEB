import {
  db,
  initPage,
  renderTable,
  esc,
  fullName,
  formatDate,
} from "./common.js";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
await initPage();
const names = [
  ["churches", "Churches"],
  ["pastors", "Pastors"],
  ["certificateTemplates", "Templates"],
  ["dedications", "Dedication records"],
];
const counts = await Promise.all(
  names.map(([c]) => getCountFromServer(collection(db, c))),
);
document.querySelector("#statsGrid").innerHTML = names
  .map(
    ([, label], i) =>
      `<article class="stat-card"><span>${label}</span><strong>${counts[i].data().count}</strong><i></i></article>`,
  )
  .join("");
const snap = await getDocs(
  query(collection(db, "dedications"), orderBy("createdAt", "desc"), limit(7)),
);
const rows = snap.docs.map((d) => {
  const x = d.data();
  return `<tr><td><strong>${esc(x.certificateNumber)}</strong></td><td>${esc(fullName(x))}</td><td>${esc(x.churchName)}</td><td>${formatDate(x.dedicationDate)}</td><td><span class="badge ${(x.status || "active").toLowerCase()}">${esc(x.status || "Active")}</span></td><td><a class="btn ghost" href="certificate.html?id=${d.id}">Preview</a></td></tr>`;
});
renderTable(
  "#recentRecords",
  ["Certificate #", "Name", "Church", "Date", "Status", ""],
  rows,
  "No dedication records yet.",
);
