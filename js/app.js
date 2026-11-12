const CONFIG = {
  name: "Lavajato MF",
  slotMinutes: 30,
  capacityPerSlot: 3,
  adminPin: "1234",
  closedWeekdays: [0], // domingo
  reminderHours: [24, 2],
  whatsappShop: "5511999990000"
};

// Horários: seg–sex 8h–16h | sáb 8h–17:30 | dom fechado
function getHours(iso) {
  const d = weekday(iso);
  if (d === 0) return null;
  if (d === 6) return { open: 8, closeH: 17, closeM: 30 }; // sábado
  return { open: 8, closeH: 16, closeM: 0 };               // segunda a sexta
}

const VEHICLES = [
  { id: "baixo", name: "Carro baixo", price: 80 },
  { id: "suv", name: "Carro SUV", price: 100 },
  { id: "caminhonete", name: "Caminhonete", price: 150 },
  { id: "moto", name: "Moto", price: 50 }
];

const SERVICES = [
  { id: "simples", name: "Lavagem Simples", minutes: 30 },
  { id: "completa", name: "Lavagem Completa", minutes: 45 },
  { id: "premium", name: "Lavagem com Cera", minutes: 60 }
];

const KEY = "lavajato_mf_bookings_v1";

function $(sel, root) {
  return (root || document).querySelector(sel);
}
function $$(sel, root) {
  return [...(root || document).querySelectorAll(sel)];
}

function loadBookings() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveBookings(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function uid() {
  return "AG-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatBR(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function weekday(iso) {
  return new Date(iso + "T12:00:00").getDay();
}

function isClosed(iso) {
  return CONFIG.closedWeekdays.includes(weekday(iso));
}

function slotTimes(iso) {
  const hours = getHours(iso || todayISO());
  if (!hours) return [];
  const times = [];
  let min = hours.open * 60;
  const end = hours.closeH * 60 + hours.closeM;
  while (min < end) {
    const hh = String(Math.floor(min / 60)).padStart(2, "0");
    const mm = String(min % 60).padStart(2, "0");
    times.push(`${hh}:${mm}`);
    min += CONFIG.slotMinutes;
  }
  return times;
}

function occupancy(date, time, bookings) {
  return bookings.filter(
    (b) => b.date === date && b.time === time && b.status !== "cancelado"
  ).length;
}

function serviceById(id) {
  return SERVICES.find((s) => s.id === id) || SERVICES[0];
}

function createReminders(date, time) {
  const when = new Date(`${date}T${time}:00`);
  return CONFIG.reminderHours.map((h) => ({
    hoursBefore: h,
    at: new Date(when.getTime() - h * 3600 * 1000).toISOString(),
    sent: false
  }));
}

function seedIfEmpty() {
  if (loadBookings().length) return;
  const d = todayISO();
  saveBookings([
    {
      id: uid(),
      name: "Ana Souza",
      phone: "11987654321",
      email: "ana@email.com",
      plate: "ABC1D23",
      vehicle: "baixo",
      service: "completa",
      date: d,
      time: "09:00",
      status: "confirmado",
      createdAt: Date.now(),
      reminders: createReminders(d, "09:00")
    },
    {
      id: uid(),
      name: "Carlos Lima",
      phone: "11911112222",
      email: "carlos@email.com",
      plate: "XYZ9F87",
      vehicle: "suv",
      service: "premium",
      date: d,
      time: "09:00",
      status: "confirmado",
      createdAt: Date.now(),
      reminders: createReminders(d, "09:00")
    },
    {
      id: uid(),
      name: "Marina Dias",
      phone: "11933334444",
      email: "marina@email.com",
      plate: "QWE4R56",
      vehicle: "baixo",
      service: "simples",
      date: d,
      time: "10:30",
      status: "confirmado",
      createdAt: Date.now(),
      reminders: createReminders(d, "10:30")
    }
  ]);
}

function showPage(id) {
  const page = document.getElementById(id);
  if (!page) return false;

  $$(".page").forEach((p) => p.classList.remove("active"));
  page.classList.add("active");

  $$("[data-page]").forEach((el) => {
    if (el.classList.contains("nav-btn") || el.closest(".nav")) {
      el.classList.toggle("active", el.getAttribute("data-page") === id);
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (id === "page-agendar") renderSlots();
  if (id === "page-consultas") renderMySearch();
  if (id === "page-admin") renderAdmin();
  if (id === "page-lembretes") renderReminders();
  if (id === "page-home") initHomeStats();
  return true;
}

function renderSlots() {
  const dateEl = $("#bk-date");
  const box = $("#slots");
  const info = $("#slot-info");
  const timeEl = $("#bk-time");
  if (!box || !dateEl) return;

  const date = dateEl.value || todayISO();
  if (!dateEl.value) dateEl.value = date;

  const bookings = loadBookings();
  const now = new Date();
  let selected = timeEl ? timeEl.value : "";

  if (isClosed(date)) {
    box.innerHTML = `<div class="alert alert-warn">Fechado neste dia. Escolha outra data.</div>`;
    if (info) info.textContent = "";
    if (timeEl) timeEl.value = "";
    return;
  }

  const valid = [];
  box.innerHTML = "";

  slotTimes(date).forEach((t) => {
    const used = occupancy(date, t, bookings);
    const full = used >= CONFIG.capacityPerSlot;
    const past = new Date(`${date}T${t}:00`) < now;
    const blocked = full || past;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot " + (blocked ? "full" : "available");
    btn.innerHTML = `${t}<small>${used}/${CONFIG.capacityPerSlot} vagas</small>`;

    if (!blocked) {
      valid.push(t);
      btn.addEventListener("click", () => {
        if (timeEl) timeEl.value = t;
        renderSlots();
      });
    }

    if (selected === t && !blocked) btn.classList.add("selected");
    box.appendChild(btn);
  });

  if (selected && !valid.includes(selected) && timeEl) timeEl.value = "";

  const dayUsed = bookings.filter((b) => b.date === date && b.status !== "cancelado").length;
  const dayCap = slotTimes(date).length * CONFIG.capacityPerSlot;
  const pct = Math.round((dayUsed / dayCap) * 100);
  if (info) {
    info.innerHTML = `
      Ocupação do dia: <b>${dayUsed}/${dayCap}</b> (${pct}%)
      <div class="occupancy-bar"><span style="width:${pct}%"></span></div>
    `;
  }
}

function vehicleById(idOrName) {
  return VEHICLES.find((v) => v.id === idOrName || v.name === idOrName) || VEHICLES[0];
}

function fillServices() {
  const sel = $("#bk-service");
  if (!sel) return;
  sel.innerHTML = SERVICES.map((s) => `<option value="${s.id}">${s.name} (${s.minutes} min)</option>`).join("");
}

function fillVehicles() {
  const sel = $("#bk-vehicle");
  if (!sel) return;
  sel.innerHTML = VEHICLES.map((v) => `<option value="${v.id}">${v.name} — a partir de R$ ${v.price}</option>`).join("");
  updatePriceHint();
  sel.addEventListener("change", updatePriceHint);
}

function updatePriceHint() {
  const hint = $("#price-hint");
  if (!hint) return;
  const v = vehicleById($("#bk-vehicle") && $("#bk-vehicle").value);
  hint.innerHTML = `Valor a partir de <b>R$ ${v.price}</b> para ${v.name}.`;
}

function toast(msg, type) {
  const el = $("#toast");
  if (!el) {
    window.alert(msg);
    return;
  }
  const kind = type === "warn" ? "warn" : type === "ok" ? "ok" : "info";
  el.className = "alert alert-" + kind;
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 4000);
}

function submitBooking(ev) {
  ev.preventDefault();
  ev.stopPropagation();

  const date = $("#bk-date") && $("#bk-date").value;
  const time = $("#bk-time") && $("#bk-time").value;
  const name = ($("#bk-name") && $("#bk-name").value.trim()) || "";
  const phone = (($("#bk-phone") && $("#bk-phone").value) || "").replace(/\D/g, "");

  if (!date) return toast("Escolha uma data.", "warn");
  if (!time) return toast("Escolha um horário disponível.", "warn");
  if (isClosed(date)) return toast("Não abrimos neste dia.", "warn");
  if (!name || phone.length < 10) {
    return toast("Preencha nome e um telefone válido com DDD.", "warn");
  }

  const bookings = loadBookings();
  if (occupancy(date, time, bookings) >= CONFIG.capacityPerSlot) {
    renderSlots();
    return toast("Esse horário acabou de lotar. Escolha outro.", "warn");
  }

  const booking = {
    id: uid(),
    name,
    phone,
    email: ($("#bk-email") && $("#bk-email").value.trim()) || "",
    plate: (($("#bk-plate") && $("#bk-plate").value.trim()) || "").toUpperCase(),
    vehicle: ($("#bk-vehicle") && $("#bk-vehicle").value) || "baixo",
    service: ($("#bk-service") && $("#bk-service").value) || "simples",
    date,
    time,
    status: "confirmado",
    notes: ($("#bk-notes") && $("#bk-notes").value.trim()) || "",
    createdAt: Date.now(),
    reminders: createReminders(date, time)
  };

  bookings.push(booking);
  saveBookings(bookings);

  const form = $("#bk-form");
  if (form) form.reset();
  if ($("#bk-date")) $("#bk-date").value = date;
  if ($("#bk-time")) $("#bk-time").value = "";
  fillServices();
  renderSlots();
  showConfirmation(booking);
  initHomeStats();
}

function showConfirmation(b) {
  const box = $("#confirm-box");
  if (!box) return;
  const s = serviceById(b.service);
  const v = vehicleById(b.vehicle);
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="alert alert-ok">
      <b>Agendamento confirmado!</b> Código <b>${b.id}</b><br>
      ${b.name} · ${v.name} · ${s.name} · ${formatBR(b.date)} às ${b.time}<br>
      Placa ${b.plate || "—"} · A partir de R$ ${v.price} · Lembretes automáticos em 24h e 2h antes.
    </div>
    <div class="hero-actions" style="margin-top:10px">
      <a class="btn btn-primary" target="_blank" rel="noopener" href="${whatsappLink(b, "confirm")}">Enviar confirmação no WhatsApp</a>
      <button class="btn btn-outline" type="button" data-ics="${b.id}">Baixar no calendário</button>
    </div>
  `;
}

function whatsappLink(b, kind) {
  const s = serviceById(b.service);
  let text;
  if (kind === "confirm") {
    text = `Olá, ${b.name}! Seu horário no ${CONFIG.name} está CONFIRMADO.\n📅 ${formatBR(b.date)} às ${b.time}\n🚗 ${s.name} · placa ${b.plate || "—"}\nCódigo: ${b.id}\nChegue 5 minutos antes. Se precisar remarcar, responda esta mensagem.`;
  } else if (kind === "24h") {
    text = `Lembrete ${CONFIG.name}: amanhã, ${formatBR(b.date)} às ${b.time}, está reservado para ${b.name} (${s.name}). Código ${b.id}. Até breve!`;
  } else {
    text = `Lembrete: seu horário é HOJE às ${b.time} no ${CONFIG.name}. ${s.name}, placa ${b.plate || "—"}. Estamos te esperando!`;
  }
  const phone = b.phone.startsWith("55") ? b.phone : "55" + b.phone;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function downloadICS(id) {
  const b = loadBookings().find((x) => x.id === id);
  if (!b) return;
  const s = serviceById(b.service);
  const start = b.date.replace(/-/g, "") + "T" + b.time.replace(":", "") + "00";
  const endDate = new Date(`${b.date}T${b.time}:00`);
  endDate.setMinutes(endDate.getMinutes() + s.minutes);
  const pad = (n) => String(n).padStart(2, "0");
  const end =
    endDate.getFullYear() +
    pad(endDate.getMonth() + 1) +
    pad(endDate.getDate()) +
    "T" +
    pad(endDate.getHours()) +
    pad(endDate.getMinutes()) +
    "00";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LavajatoMF//PT",
    "BEGIN:VEVENT",
    `UID:${b.id}@lavajatomf`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${s.name} — ${CONFIG.name}`,
    `DESCRIPTION:Agendamento ${b.id}. Placa ${b.plate || ""}.`,
    `LOCATION:${CONFIG.name}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Lembrete lava-jato amanhã",
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Lembrete lava-jato em 2 horas",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${b.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function badgeClass(st) {
  if (st === "confirmado") return "badge-ok";
  if (st === "concluido") return "badge-mute";
  if (st === "faltou") return "badge-danger";
  return "badge-warn";
}

function renderMySearch() {
  const box = $("#my-bookings");
  if (!box) return;
  const phone = (($("#find-phone") && $("#find-phone").value) || "").replace(/\D/g, "");
  if (!phone) {
    box.innerHTML = `<div class="alert alert-info">Digite o telefone usado no agendamento para ver ou cancelar.</div>`;
    return;
  }
  const list = loadBookings()
    .filter((b) => b.phone === phone || b.phone.endsWith(phone) || phone.endsWith(b.phone))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (!list.length) {
    box.innerHTML = `<div class="alert alert-warn">Nenhum agendamento encontrado para este telefone.</div>`;
    return;
  }
  box.innerHTML = list
    .map((b) => {
      const s = serviceById(b.service);
      const v = vehicleById(b.vehicle);
      return `<div class="booking-item">
        <div>
          <b>${b.id}</b> · ${formatBR(b.date)} ${b.time}<br>
          <small>${v.name} · ${s.name} · ${b.plate || "sem placa"} · ${b.name}</small>
        </div>
        <div>
          <span class="badge ${badgeClass(b.status)}">${b.status}</span><br>
          ${
            b.status === "confirmado"
              ? `<button class="btn btn-danger" type="button" style="margin-top:6px;padding:6px 10px" data-cancel="${b.id}">Cancelar</button>`
              : ""
          }
        </div>
      </div>`;
    })
    .join("");
}

function cancelBooking(id) {
  const list = loadBookings();
  const b = list.find((x) => x.id === id);
  if (!b) return;
  if (!window.confirm(`Cancelar o horário ${b.id} de ${formatBR(b.date)} às ${b.time}?`)) return;
  b.status = "cancelado";
  saveBookings(list);
  renderMySearch();
  renderSlots();
  initHomeStats();
  toast("Horário cancelado. A vaga foi liberada.", "ok");
}

function tryAdmin() {
  const pinEl = $("#admin-pin");
  const pin = pinEl ? pinEl.value : "";
  if (pin === CONFIG.adminPin) {
    sessionStorage.setItem("mf_admin", "1");
    if ($("#admin-gate")) $("#admin-gate").classList.add("hidden");
    if ($("#admin-panel")) $("#admin-panel").classList.remove("hidden");
    renderAdmin();
  } else {
    toast("PIN incorreto. Dica da demo: 1234", "warn");
  }
}

function renderAdmin() {
  if (sessionStorage.getItem("mf_admin") !== "1") {
    if ($("#admin-gate")) $("#admin-gate").classList.remove("hidden");
    if ($("#admin-panel")) $("#admin-panel").classList.add("hidden");
    return;
  }
  if ($("#admin-gate")) $("#admin-gate").classList.add("hidden");
  if ($("#admin-panel")) $("#admin-panel").classList.remove("hidden");

  const dateEl = $("#admin-date");
  const date = (dateEl && dateEl.value) || todayISO();
  if (dateEl && !dateEl.value) dateEl.value = date;

  const list = loadBookings()
    .filter((b) => b.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
  const active = list.filter((b) => b.status !== "cancelado");

  const kpis = $("#admin-kpis");
  if (kpis) {
    kpis.innerHTML = `
      <div class="stat"><b>${active.length}</b><span>agendamentos no dia</span></div>
      <div class="stat"><b>${active.filter((b) => b.status === "confirmado").length}</b><span>ainda pendentes</span></div>
      <div class="stat"><b>${list.filter((b) => b.status === "faltou").length}</b><span>faltas</span></div>
      <div class="stat"><b>${list.filter((b) => b.status === "cancelado").length}</b><span>cancelados (vaga livre)</span></div>
    `;
  }

  const table = $("#admin-table");
  if (!table) return;
  table.innerHTML = list.length
    ? `<table>
        <thead><tr><th>Hora</th><th>Cliente</th><th>Veículo / Serviço</th><th>Placa</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${list
            .map((b) => {
              const s = serviceById(b.service);
              const v = vehicleById(b.vehicle);
              return `<tr>
                <td>${b.time}</td>
                <td>${b.name}<br><small>${b.phone}</small></td>
                <td>${v.name}<br><small>${s.name} · a partir de R$ ${v.price}</small></td>
                <td>${b.plate || "—"}</td>
                <td><span class="badge ${badgeClass(b.status)}">${b.status}</span></td>
                <td>
                  ${
                    b.status === "confirmado"
                      ? `<button class="btn btn-primary" type="button" style="padding:6px 10px" data-status="${b.id}|concluido">Concluir</button>
                         <button class="btn btn-outline" type="button" style="padding:6px 10px" data-status="${b.id}|faltou">Faltou</button>`
                      : ""
                  }
                </td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>`
    : `<div class="alert alert-info">Nenhum agendamento nesta data.</div>`;
}

function setStatus(id, status) {
  const list = loadBookings();
  const b = list.find((x) => x.id === id);
  if (!b) return;
  b.status = status;
  saveBookings(list);
  renderAdmin();
  initHomeStats();
}

function dueReminders() {
  const now = Date.now();
  const out = [];
  loadBookings().forEach((b) => {
    if (b.status !== "confirmado") return;
    const reminders = b.reminders && b.reminders.length ? b.reminders : createReminders(b.date, b.time);
    b.reminders = reminders;
    reminders.forEach((r, i) => {
      const at = new Date(r.at).getTime();
      out.push({
        booking: b,
        reminder: r,
        index: i,
        due: at <= now && !r.sent,
        upcoming: at > now && !r.sent,
        at
      });
    });
  });
  return out.sort((a, b) => a.at - b.at);
}

function renderRemCard(item) {
  const b = item.booking;
  const label = item.reminder.hoursBefore >= 24 ? "24 horas antes" : "2 horas antes";
  const when = new Date(item.at);
  const waKind = item.reminder.hoursBefore >= 24 ? "24h" : "2h";
  return `<div class="booking-item">
    <div>
      <b>${label}</b> · ${b.name} · ${formatBR(b.date)} ${b.time}<br>
      <small>Disparo programado: ${when.toLocaleString("pt-BR")} · ${b.phone}</small>
    </div>
    <div>
      <a class="btn btn-primary" style="padding:6px 10px" target="_blank" rel="noopener" href="${whatsappLink(b, waKind)}" data-sent="${b.id}|${item.index}">Enviar WhatsApp</a>
    </div>
  </div>`;
}

function renderReminders() {
  const items = dueReminders();
  const due = items.filter((x) => x.due);
  const upcoming = items.filter((x) => x.upcoming);
  const dueBox = $("#rem-due");
  const upBox = $("#rem-upcoming");
  if (dueBox) {
    dueBox.innerHTML = due.length
      ? due.map(renderRemCard).join("")
      : `<div class="alert alert-ok">Nenhum lembrete atrasado agora.</div>`;
  }
  if (upBox) {
    upBox.innerHTML = upcoming.length
      ? upcoming.map(renderRemCard).join("")
      : `<div class="alert alert-info">Não há lembretes futuros no momento.</div>`;
  }
}

function markSent(id, index) {
  const list = loadBookings();
  const b = list.find((x) => x.id === id);
  if (b && b.reminders && b.reminders[index]) b.reminders[index].sent = true;
  saveBookings(list);
  setTimeout(renderReminders, 300);
}

function resetDemo() {
  if (!window.confirm("Apagar todos os agendamentos e recarregar dados de exemplo?")) return;
  localStorage.removeItem(KEY);
  sessionStorage.removeItem("mf_admin");
  seedIfEmpty();
  window.location.reload();
}

function initHomeStats() {
  const list = loadBookings().filter((b) => b.status !== "cancelado");
  const today = list.filter((b) => b.date === todayISO());
  const capToday = slotTimes(todayISO()).length * CONFIG.capacityPerSlot;
  if ($("#stat-today")) $("#stat-today").textContent = String(today.length);
  if ($("#stat-free")) $("#stat-free").textContent = String(Math.max(0, capToday - today.length));
  if ($("#stat-reminders")) {
    $("#stat-reminders").textContent = String(dueReminders().filter((x) => x.upcoming || x.due).length);
  }
}

function onDocumentClick(ev) {
  const pageBtn = ev.target.closest("[data-page]");
  if (pageBtn) {
    ev.preventDefault();
    showPage(pageBtn.getAttribute("data-page"));
    return;
  }

  const icsBtn = ev.target.closest("[data-ics]");
  if (icsBtn) {
    ev.preventDefault();
    downloadICS(icsBtn.getAttribute("data-ics"));
    return;
  }

  const cancelBtn = ev.target.closest("[data-cancel]");
  if (cancelBtn) {
    ev.preventDefault();
    cancelBooking(cancelBtn.getAttribute("data-cancel"));
    return;
  }

  const statusBtn = ev.target.closest("[data-status]");
  if (statusBtn) {
    ev.preventDefault();
    const [id, status] = statusBtn.getAttribute("data-status").split("|");
    setStatus(id, status);
    return;
  }

  const sentBtn = ev.target.closest("[data-sent]");
  if (sentBtn) {
    const [id, index] = sentBtn.getAttribute("data-sent").split("|");
    markSent(id, Number(index));
  }
}

function init() {
  seedIfEmpty();
  fillServices();
  fillVehicles();

  const dateInput = $("#bk-date");
  if (dateInput) {
    dateInput.min = todayISO();
    if (!dateInput.value) dateInput.value = todayISO();
    dateInput.addEventListener("change", () => {
      if ($("#bk-time")) $("#bk-time").value = "";
      renderSlots();
    });
  }

  const adminDate = $("#admin-date");
  if (adminDate) {
    if (!adminDate.value) adminDate.value = todayISO();
    adminDate.addEventListener("change", renderAdmin);
  }

  const form = $("#bk-form");
  if (form) form.addEventListener("submit", submitBooking);

  const findPhone = $("#find-phone");
  if (findPhone) {
    findPhone.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        renderMySearch();
      }
    });
  }

  const adminPin = $("#admin-pin");
  if (adminPin) {
    adminPin.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        tryAdmin();
      }
    });
  }

  const locBtn = $("#btn-localizacao");
  if (locBtn) {
    locBtn.addEventListener("click", () => {
    window.open("https://www.google.com/maps/search/?api=1&query=Rua+Rosacruz+1451+Maring%C3%A1+87060-380", "_blank", "noopener");
    });
  }

  initHomeStats();
  renderSlots();
  showPage("page-home");
}

document.addEventListener("click", onDocumentClick);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

window.showPage = showPage;
window.renderMySearch = renderMySearch;
window.cancelBooking = cancelBooking;
window.tryAdmin = tryAdmin;
window.renderAdmin = renderAdmin;
window.setStatus = setStatus;
window.resetDemo = resetDemo;
window.downloadICS = downloadICS;
window.markSent = markSent;