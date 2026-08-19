import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { requireAuth } from "./auth.js";
export { db };
export const qs = (s, r = document) => r.querySelector(s);
export const qsa = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
export const fullName = (o) =>
  [o.firstName, o.middleName, o.lastName, o.suffix].filter(Boolean).join(" ");
export const formatDate = (v) => {
  if (!v) return "—";
  const d = v?.toDate ? v.toDate() : new Date(`${v}T00:00:00`);
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(d);
};
export function toast(message, type = "success") {
  let box = qs(".toast-container");
  if (!box) {
    box = document.createElement("div");
    box.className = "toast-container";
    document.body.append(box);
  }
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  box.append(item);
  setTimeout(() => item.remove(), 3500);
}
export function confirmAction(message) {
  return window.confirm(message);
}
const nav = [
  ["dashboard", "Dashboard", "dashboard.html"],
  ["churches", "Churches", "churches.html"],
  ["pastors", "Pastors", "pastors.html"],
  ["templates", "Templates", "templates.html"],
  ["dedication-form", "New Dedication", "dedication-form.html"],
  ["dedication-records", "Records", "dedication-records.html"],
  ["users", "Users", "users.html"],
];
export async function initPage(
  allowed = ["administrator", "encoder", "viewer"],
) {
  const ctx = await requireAuth();
  if (!allowed.includes(ctx.profile.role)) {
    toast("You do not have permission to open this page.", "error");
    setTimeout(() => location.replace("dashboard.html"), 800);
    throw new Error("Unauthorized");
  }
  const page = document.body.dataset.page;
  const shell = qs("#appShell");
  const navHtml = nav
    .map(
      ([id, label, url]) =>
        `<a href="${url}" class="${page === id ? "active" : ""} ${id === "users" ? "admin-only" : ""}">${label}</a>`,
    )
    .join("");
  shell.insertAdjacentHTML(
    "afterbegin",
    `<header class="mobile-header"><button class="icon-btn menu-toggle" aria-label="Open menu">☰</button><strong>Church Certificates</strong></header><aside class="app-sidebar"><div class="sidebar-brand"><img src="assets/img/logo.png" alt="Church logo"><div><strong>Church Certificates</strong><small>Dedication Registry</small></div></div><nav class="sidebar-nav">${navHtml}</nav><div class="sidebar-footer"><div class="user-chip"><strong>${esc(ctx.profile.displayName || ctx.user.email)}</strong><small>${esc(ctx.profile.role)}</small></div><button id="logoutButton" class="btn secondary wide">Logout</button></div></aside>`,
  );
  qs(".menu-toggle")?.addEventListener("click", () =>
    qs(".app-sidebar").classList.toggle("open"),
  );
  qs("#logoutButton").addEventListener("click", async () => {
    await signOut(auth);
    location.replace("index.html");
  });
  qsa("[data-open-modal]").forEach((b) =>
    b.addEventListener("click", () =>
      qs(`#${b.dataset.openModal}`)?.showModal(),
    ),
  );
  applyRole(ctx.profile.role);
  return ctx;
}
export function applyRole(role) {
  if (role !== "administrator")
    qsa(".admin-only").forEach((e) => e.classList.add("hidden-by-role"));
  if (role === "viewer")
    qsa(".can-edit,.can-manage").forEach((e) =>
      e.classList.add("hidden-by-role"),
    );
}
export function renderTable(
  target,
  headers,
  rows,
  empty = "No records found.",
) {
  qs(target).innerHTML = rows.length
    ? `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`
    : `<div class="empty-state">${empty}</div>`;
}
export function openModal(id) {
  qs(id).showModal();
}
export function closeModal(id) {
  qs(id).close();
}
