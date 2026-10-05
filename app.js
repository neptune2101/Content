(() => {
  "use strict";
  const STATUSES = ["รอดำเนินการ", "กำลังดำเนินการ", "รอตรวจสอบ", "เสร็จแล้ว"];
  const STORAGE_KEY = "hugcode-workboard-v1";
  const DEFAULT_STATE = {
    tasks: [
      { id: "task-01", title: "ออกแบบหน้าแดชบอร์ดสรุปยอด", module: "Dashboard", description: "ออกแบบการ์ดสรุปยอดขายและกราฟแนวโน้มรายสัปดาห์ให้ดูง่ายบนมือถือ", tags: ["UI", "Dashboard"], assignee: "มินตรา", assigner: "นที", priority: "สูง", assignedAt: "2026-10-01T09:30:00.000Z", dueDate: "2026-10-09", status: "กำลังดำเนินการ", comments: [{ author: "นที", text: "ฝากดูเรื่อง responsive สำหรับหน้าจอเล็กด้วยนะ", createdAt: "2026-10-02T03:00:00.000Z" }] },
      { id: "task-02", title: "เพิ่ม API ค้นหาสินค้า", module: "Catalog API", description: "รองรับค้นหาด้วยชื่อสินค้าและรหัส พร้อมแบ่งหน้าผลลัพธ์", tags: ["API", "Backend"], assignee: "ธนา", assigner: "มินตรา", priority: "ปานกลาง", assignedAt: "2026-10-02T07:45:00.000Z", dueDate: "2026-10-12", status: "รอดำเนินการ", comments: [] },
      { id: "task-03", title: "ตรวจสอบขั้นตอนสมัครสมาชิก", module: "Authentication", description: "ไล่ตรวจ validation, ข้อความผิดพลาด และการยืนยันอีเมล", tags: ["QA", "Auth"], assignee: "ปาริชาติ", assigner: "นที", priority: "สูง", assignedAt: "2026-10-02T11:15:00.000Z", dueDate: "2026-10-07", status: "รอตรวจสอบ", comments: [{ author: "ปาริชาติ", text: "ทดสอบบน Safari แล้ว เหลือเช็กกรณีอีเมลซ้ำ", createdAt: "2026-10-03T06:20:00.000Z" }] },
      { id: "task-04", title: "ปรับรูปแบบอีเมลแจ้งเตือน", module: "Notifications", description: "อัปเดตหัวข้อและลิงก์ในอีเมลแจ้งเตือนคำสั่งซื้อ", tags: ["Email", "Content"], assignee: "มินตรา", assigner: "ธนา", priority: "ต่ำ", assignedAt: "2026-09-29T04:00:00.000Z", dueDate: "2026-10-04", status: "เสร็จแล้ว", comments: [] },
      { id: "task-05", title: "แก้ปัญหาตะกร้าค้างหลังล็อกอิน", module: "Shopping Cart", description: "คืนค่ารายการสินค้าในตะกร้าหลังผู้ใช้เข้าสู่ระบบสำเร็จ", tags: ["Bug", "Cart"], assignee: "ธนา", assigner: "ปาริชาติ", priority: "ปานกลาง", assignedAt: "2026-10-03T02:10:00.000Z", dueDate: "2026-10-11", status: "กำลังดำเนินการ", comments: [] },
      { id: "task-06", title: "เขียนคู่มือ API สำหรับทีม", module: "Documentation", description: "เพิ่มตัวอย่าง request และ response สำหรับ endpoint หลัก", tags: ["Docs"], assignee: "ปาริชาติ", assigner: "มินตรา", priority: "ต่ำ", assignedAt: "2026-10-01T08:05:00.000Z", dueDate: "2026-10-15", status: "รอดำเนินการ", comments: [] }
    ],
    options: { statuses: [...STATUSES], modules: ["Dashboard", "Catalog API", "Authentication", "Notifications", "Shopping Cart", "Documentation"], assignees: ["มินตรา", "ธนา", "ปาริชาติ", "นที"], assigners: ["นที", "มินตรา", "ธนา", "ปาริชาติ"] }
  };
  const $ = (id) => document.getElementById(id);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const dateOnly = (date) => { if (!date) return ""; const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  let state = clone(DEFAULT_STATE), supabase = null, demoMode = false, currentUser = null, saveTimer = null, realtimeChannel = null, authMode = "login", activeDetailId = null, localPending = false;

  function readBackup() { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (parsed?.state && Array.isArray(parsed.state.tasks)) { localPending = parsed.pending === true; return normalizeState(parsed.state); } if (parsed && Array.isArray(parsed.tasks) && parsed.options) { localPending = false; return normalizeState(parsed); } } catch (_) {} return null; }
  function normalizeState(value) {
    const result = { tasks: Array.isArray(value.tasks) ? value.tasks : [], options: { ...clone(DEFAULT_STATE.options), ...(value.options || {}) } };
    result.options.statuses = Array.isArray(result.options.statuses) && result.options.statuses.length ? result.options.statuses : [...STATUSES];
    result.tasks = result.tasks.map(t => ({ ...t, comments: Array.isArray(t.comments) ? t.comments : [], tags: Array.isArray(t.tags) ? t.tags : [], status: result.options.statuses.includes(t.status) ? t.status : result.options.statuses[0] }));
    return result;
  }
  function backup() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, pending: localPending, savedAt: new Date().toISOString() })); } catch (_) { toast("บันทึกข้อมูลสำรองในเครื่องไม่สำเร็จ", true); } }
  function setConnection(mode, label) { const node = $("connectionStatus"); node.className = `connection ${mode}`; node.lastElementChild.textContent = label; }
  function toast(message, error = false) { const node = document.createElement("div"); node.className = `toast${error ? " error" : ""}`; node.textContent = message; $("toastRegion").append(node); setTimeout(() => node.remove(), 3400); }
  function formattedDate(value) { if (!value) return "ไม่ระบุวันส่ง"; const d = new Date(`${value}T00:00:00`); return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(d); }
  function fullDateTime(value) { if (!value) return "—"; return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  function avatarText(name) { return (name || "?").trim().slice(0, 1).toUpperCase(); }

  function showSetup() { $("setupView").hidden = false; $("authView").hidden = true; $("appView").hidden = true; }
  function showAuth() { $("setupView").hidden = true; $("authView").hidden = false; $("appView").hidden = true; }
  function showApp() { $("setupView").hidden = true; $("authView").hidden = true; $("appView").hidden = false; $("userEmail").textContent = demoMode ? "ตัวอย่างในเครื่อง" : (currentUser?.email || ""); render(); }
  async function boot() {
    const config = window.HUGCODE_SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey) { showSetup(); return; }
    if (!window.supabase?.createClient) { showSetup(); $("setupError").textContent = "โหลด Supabase client ไม่สำเร็จ โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต"; return; }
    supabase = window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    setConnection("", "กำลังตรวจสอบบัญชี");
    const { data, error } = await supabase.auth.getSession();
    if (error) { showAuth(); $("authError").textContent = error.message; return; }
    currentUser = data.session?.user || null;
    supabase.auth.onAuthStateChange((_event, session) => { currentUser = session?.user || null; if (!currentUser && !demoMode) { clearRealtime(); showAuth(); } });
    if (currentUser) await enterWorkspace(); else showAuth();
  }
  async function enterWorkspace() {
    demoMode = false; showApp(); setConnection("", "กำลังซิงก์ข้อมูล");
    const local = readBackup(); if (local) state = local; const hadPendingLocalEdits = localPending;
    try {
      const { data, error } = await supabase.from("workboard_state").select("state").eq("id", 1).maybeSingle();
      if (error) throw error;
      if (data?.state && !hadPendingLocalEdits) state = normalizeState(data.state);
      else { const backupState = readBackup(); if (backupState) state = backupState; await persistNow(); }
      backup(); setConnection("online", "เชื่อมต่อแล้ว · ซิงก์เรียลไทม์"); $("lastSync").textContent = "ซิงก์แล้ว";
    } catch (error) {
      setConnection("offline", "ออฟไลน์ · ใช้ข้อมูลสำรอง"); $("lastSync").textContent = "ในเครื่อง";
      toast("เชื่อมต่อบอร์ดไม่ได้ กำลังใช้ข้อมูลสำรองในเครื่อง", true);
    }
    render(); subscribeRealtime();
  }
  function subscribeRealtime() {
    clearRealtime(); if (!supabase || demoMode) return;
    realtimeChannel = supabase.channel("hugcode-shared-workboard").on("postgres_changes", { event: "*", schema: "public", table: "workboard_state", filter: "id=eq.1" }, payload => {
      if (payload.new?.state) { state = normalizeState(payload.new.state); backup(); render(); $("lastSync").textContent = "อัปเดตแล้ว"; setConnection("online", "ซิงก์เรียลไทม์"); }
    }).subscribe(status => { if (status === "SUBSCRIBED") setConnection("online", "เชื่อมต่อแล้ว · ซิงก์เรียลไทม์"); else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnection("offline", "ซิงก์ขัดข้อง · สำรองในเครื่อง"); });
  }
  function clearRealtime() { if (realtimeChannel && supabase) supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
  async function persistNow() {
    backup(); if (demoMode || !supabase || !currentUser) { if (demoMode) $("lastSync").textContent = "บันทึกในเครื่อง"; return; }
    const { error } = await supabase.from("workboard_state").upsert({ id: 1, state, updated_at: new Date().toISOString(), updated_by: currentUser.id }, { onConflict: "id" });
    if (error) { localPending = true; backup(); setConnection("offline", "ซิงก์ไม่สำเร็จ · สำรองในเครื่อง"); toast(`ซิงก์ไม่สำเร็จ: ${error.message}`, true); }
    else { localPending = false; backup(); setConnection("online", "เชื่อมต่อแล้ว · ซิงก์เรียลไทม์"); $("lastSync").textContent = "ซิงก์แล้ว"; }
  }
  function scheduleSave() { if (!demoMode) localPending = true; backup(); clearTimeout(saveTimer); saveTimer = setTimeout(persistNow, 350); }
  function filteredTasks() {
    const query = $("searchInput").value.trim().toLocaleLowerCase("th"), assignee = $("assigneeFilter").value, from = $("assignedFrom").value, dueTo = $("dueTo").value;
    return state.tasks.filter(task => {
      const haystack = [task.title, task.description, task.module, ...(task.tags || []), task.assignee, task.assigner].join(" ").toLocaleLowerCase("th");
      return (!query || haystack.includes(query)) && (!assignee || task.assignee === assignee) && (!from || dateOnly(task.assignedAt) >= from) && (!dueTo || (task.dueDate && task.dueDate <= dueTo));
    });
  }
  function render() {
    if ($("appView").hidden) return;
    const filtered = filteredTasks(); $("totalTasks").textContent = state.tasks.length; $("activeTasks").textContent = state.tasks.filter(t => t.status === "กำลังดำเนินการ").length;
    const select = $("assigneeFilter"), old = select.value; select.innerHTML = '<option value="">ผู้รับผิดชอบทั้งหมด</option>' + state.options.assignees.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join(""); if (state.options.assignees.includes(old)) select.value = old;
    const board = $("board"); board.innerHTML = state.options.statuses.map(status => {
      const items = filtered.filter(task => task.status === status);
      return `<section class="board-column" data-status="${escapeHtml(status)}" aria-label="${escapeHtml(status)}"><div class="column-heading"><div class="column-name"><span class="column-dot" aria-hidden="true"></span>${escapeHtml(status)}<span class="column-badge">${items.length}</span></div></div><div class="column-list" data-status="${escapeHtml(status)}">${items.length ? items.map(renderCard).join("") : `<div class="empty-column">${filtered.length ? "ไม่มีงานในสถานะนี้" : (state.tasks.length ? "ไม่พบงานที่ตรงกับตัวกรอง" : "ลากงานมาวางที่นี่")}</div>`}</div></section>`;
    }).join("");
  }
  function renderCard(task) {
    const due = task.dueDate, today = dateOnly(new Date()), dueClass = due && due < today && task.status !== "เสร็จแล้ว" ? "overdue" : due === today ? "today" : "";
    return `<article class="task-card" draggable="true" data-task-id="${escapeHtml(task.id)}" aria-label="งาน ${escapeHtml(task.title)}"><div class="card-top"><h3 class="card-title" data-action="details" data-id="${escapeHtml(task.id)}" tabindex="0">${escapeHtml(task.title)}</h3><button class="card-menu" data-action="menu" data-id="${escapeHtml(task.id)}" aria-label="เมนูงาน ${escapeHtml(task.title)}" aria-haspopup="menu" aria-expanded="false" type="button">⋯</button></div><div class="module-label">${escapeHtml(task.module || "ไม่ระบุโมดูล")}</div>${task.description ? `<p class="card-description">${escapeHtml(task.description)}</p>` : ""}<div class="tags">${(task.tags || []).slice(0, 2).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}<span class="priority priority-${escapeHtml(task.priority || "ปานกลาง")}">${escapeHtml(task.priority || "ปานกลาง")}</span></div><div class="card-meta"><div class="assignee"><span class="avatar" aria-hidden="true">${escapeHtml(avatarText(task.assignee))}</span><span class="assignee-name">${escapeHtml(task.assignee || "ยังไม่มอบหมาย")}</span></div><span class="due-date ${dueClass}">${due ? `ส่ง ${formattedDate(due)}` : "ไม่ระบุวันส่ง"}</span></div></article>`;
  }
  function openTask(id = null) {
    const task = id ? state.tasks.find(item => item.id === id) : null; $("taskForm").reset(); $("taskFormError").textContent = ""; $("taskId").value = task?.id || ""; $("taskDialogTitle").textContent = task ? "แก้ไขงาน" : "เพิ่มงานใหม่";
    fillSelect("taskModule", state.options.modules, task?.module || ""); fillSelect("taskAssignee", state.options.assignees, task?.assignee || ""); fillSelect("taskAssigner", state.options.assigners, task?.assigner || ""); fillSelect("taskStatus", state.options.statuses, task?.status || state.options.statuses[0]);
    $("taskTitle").value = task?.title || ""; $("taskDescription").value = task?.description || ""; $("taskPriority").value = task?.priority || "ปานกลาง"; $("taskDueDate").value = task?.dueDate || ""; $("taskTags").value = (task?.tags || []).join(", "); $("taskDialog").showModal(); $("taskTitle").focus();
  }
  function fillSelect(id, values, selected) { const node = $(id); node.innerHTML = `<option value="">${id === "taskModule" ? "ไม่ระบุโมดูล" : "ไม่ระบุ"}</option>` + values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join(""); node.value = values.includes(selected) ? selected : ""; }
  function saveTask(event) {
    event.preventDefault(); const id = $("taskId").value, existing = state.tasks.find(t => t.id === id), now = new Date().toISOString();
    const title = $("taskTitle").value.trim(); if (!title) { $("taskFormError").textContent = "กรุณาระบุชื่องาน"; return; }
    const updated = { id: existing?.id || crypto.randomUUID(), title, module: $("taskModule").value, status: $("taskStatus").value || state.options.statuses[0], description: $("taskDescription").value.trim(), assignee: $("taskAssignee").value, assigner: $("taskAssigner").value, priority: $("taskPriority").value, dueDate: $("taskDueDate").value, tags: $("taskTags").value.split(",").map(s => s.trim()).filter(Boolean), assignedAt: existing?.assignedAt || now, comments: existing?.comments || [] };
    if (existing) state.tasks = state.tasks.map(t => t.id === id ? updated : t); else state.tasks.unshift(updated);
    $("taskDialog").close(); scheduleSave(); render(); toast(existing ? "บันทึกการแก้ไขแล้ว" : "เพิ่มงานแล้ว");
  }
  function showDetails(id) {
    const task = state.tasks.find(t => t.id === id); if (!task) return; activeDetailId = id;
    $("detailContent").innerHTML = `<div class="detail-top"><div><p class="eyebrow">รายละเอียดงาน</p><h2 id="detailTitle" class="detail-title">${escapeHtml(task.title)}</h2><p class="detail-module">${escapeHtml(task.module || "ไม่ระบุโมดูล")}</p></div><span class="detail-status">${escapeHtml(task.status)}</span></div><p class="detail-description">${escapeHtml(task.description || "ไม่มีรายละเอียดเพิ่มเติม")}</p><div class="detail-tags tags">${(task.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}<span class="priority priority-${escapeHtml(task.priority || "ปานกลาง")}">${escapeHtml(task.priority || "ปานกลาง")}</span></div><div class="detail-grid"><div class="detail-item"><span>ผู้รับผิดชอบ</span><strong>${escapeHtml(task.assignee || "ไม่ระบุ")}</strong></div><div class="detail-item"><span>ผู้มอบหมาย</span><strong>${escapeHtml(task.assigner || "ไม่ระบุ")}</strong></div><div class="detail-item"><span>วันที่และเวลาที่มอบหมาย</span><strong>${escapeHtml(fullDateTime(task.assignedAt))}</strong></div><div class="detail-item"><span>กำหนดส่ง</span><strong>${escapeHtml(task.dueDate ? formattedDate(task.dueDate) : "ไม่ระบุ")}</strong></div></div><section class="comment-section"><h3>ความคิดเห็น (${task.comments.length})</h3><div class="comment-list">${task.comments.length ? task.comments.map(c => `<article class="comment"><div class="comment-head"><strong>${escapeHtml(c.author || "ทีม")}</strong><time>${escapeHtml(fullDateTime(c.createdAt))}</time></div><p class="comment-body">${escapeHtml(c.text)}</p></article>`).join("") : '<p class="muted small">ยังไม่มีความคิดเห็น</p>'}</div><form id="commentForm" class="comment-form"><label class="sr-only" for="commentInput">เพิ่มความคิดเห็น</label><input id="commentInput" maxlength="500" required placeholder="เขียนความคิดเห็น…"><button class="button primary" type="submit">ส่ง</button></form></section><div class="detail-actions"><button class="button secondary" data-detail-action="delete" type="button">ลบงาน</button><div><button class="button secondary close-detail" type="button">ปิด</button> <button class="button primary" data-detail-action="edit" type="button">แก้ไขงาน</button></div></div>`;
    $("detailDialog").showModal();
  }
  function addComment(event) { event.preventDefault(); const task = state.tasks.find(t => t.id === activeDetailId), text = $("commentInput").value.trim(); if (!task || !text) return; task.comments.push({ author: demoMode ? "ผู้ใช้งาน" : (currentUser?.email?.split("@")[0] || "ทีม"), text, createdAt: new Date().toISOString() }); scheduleSave(); showDetails(task.id); $("commentInput").focus(); }
  function moveTask(id, status) { const task = state.tasks.find(t => t.id === id); if (!task || !state.options.statuses.includes(status)) return; task.status = status; scheduleSave(); render(); toast(`ย้ายงานไปยัง ${status} แล้ว`); }
  function removeTask(id) { const task = state.tasks.find(t => t.id === id); if (!task || !confirm(`ลบงาน “${task.title}” ใช่หรือไม่?`)) return; state.tasks = state.tasks.filter(t => t.id !== id); $("detailDialog").close(); scheduleSave(); render(); toast("ลบงานแล้ว"); }
  function openMenu(id, anchor) {
    const card = anchor.closest(".task-card"); if (!card) return;
    const existing = card.querySelector(".card-context-menu"); if (existing) { existing.remove(); anchor.setAttribute("aria-expanded", "false"); return; }
    document.querySelectorAll(".card-context-menu").forEach(node => node.remove()); document.querySelectorAll(".card-menu[aria-expanded=true]").forEach(node => node.setAttribute("aria-expanded", "false"));
    anchor.setAttribute("aria-expanded", "true");
    const menu = document.createElement("div"); menu.className = "card-context-menu"; menu.setAttribute("role", "menu"); menu.innerHTML = `<span class="menu-caption">ย้ายไปยัง</span>${state.options.statuses.map(status => `<button type="button" role="menuitem" data-action="move" data-status="${escapeHtml(status)}" data-id="${escapeHtml(id)}" ${state.tasks.find(t => t.id === id)?.status === status ? "disabled" : ""}>${escapeHtml(status)}</button>`).join("")}<button class="delete-menu-item" type="button" role="menuitem" data-action="delete" data-id="${escapeHtml(id)}">ลบงาน</button>`;
    card.append(menu); menu.querySelector("button:not(:disabled)")?.focus();
  }
  function exportExcel() {
    if (!window.XLSX) { toast("โหลดตัวส่งออก Excel ไม่สำเร็จ โปรดลองใหม่เมื่อเชื่อมต่ออินเทอร์เน็ต", true); return; }
    const rows = filteredTasks().map(t => ({ "ชื่องาน": t.title, "โมดูล": t.module, "รายละเอียด": t.description, "แท็ก": t.tags.join(", "), "ผู้รับผิดชอบ": t.assignee, "ผู้มอบหมาย": t.assigner, "ความสำคัญ": t.priority, "วันที่มอบหมาย": fullDateTime(t.assignedAt), "กำหนดส่ง": t.dueDate, "สถานะ": t.status, "ความคิดเห็น": t.comments.map(c => `${c.author}: ${c.text}`).join(" | ") }));
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "งานทีม"); XLSX.writeFile(book, `hugcode-workboard-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
  const OPTION_GROUPS = [{ key: "assignees", label: "ผู้รับผิดชอบ", taskField: "assignee" }, { key: "assigners", label: "ผู้มอบหมาย", taskField: "assigner" }, { key: "modules", label: "โมดูล", taskField: "module" }, { key: "statuses", label: "สถานะ", taskField: "status" }];
  function renderSettings() {
    $("settingsContent").innerHTML = OPTION_GROUPS.map(group => `<section class="settings-group" data-group="${group.key}"><h3>${group.label}</h3><div class="settings-list">${state.options[group.key].map((value, index) => `<div class="setting-row"><input aria-label="${group.label} ${escapeHtml(value)}" data-value-index="${index}" value="${escapeHtml(value)}" maxlength="40"><button type="button" data-setting="rename" data-index="${index}" aria-label="บันทึกการเปลี่ยนชื่อ">✓</button><button type="button" data-setting="delete" data-index="${index}" aria-label="ลบ ${escapeHtml(value)}">×</button></div>`).join("")}</div><button class="setting-add" type="button" data-setting="add">＋ เพิ่ม${group.label}</button></section>`).join("");
  }
  function settingAction(event) {
    const button = event.target.closest("[data-setting]"); if (!button) return; const group = OPTION_GROUPS.find(g => g.key === button.closest("[data-group]").dataset.group), list = state.options[group.key], index = Number(button.dataset.index);
    if (button.dataset.setting === "add") { const value = prompt(`เพิ่ม${group.label}ใหม่`); if (!value?.trim()) return; if (list.some(v => v.toLocaleLowerCase("th") === value.trim().toLocaleLowerCase("th"))) { toast("รายการนี้มีอยู่แล้ว", true); return; } list.push(value.trim()); }
    if (button.dataset.setting === "rename") { const value = button.parentElement.querySelector("input").value.trim(), old = list[index]; if (!value) { toast("ชื่อต้องไม่ว่าง", true); return; } if (list.some((v, i) => i !== index && v.toLocaleLowerCase("th") === value.toLocaleLowerCase("th"))) { toast("รายการนี้มีอยู่แล้ว", true); return; } list[index] = value; if (old !== value) state.tasks.forEach(task => { if (task[group.taskField] === old) task[group.taskField] = value; }); }
    if (button.dataset.setting === "delete") { const old = list[index], used = state.tasks.some(task => task[group.taskField] === old); if (used || (group.key === "statuses" && list.length <= 1)) { toast(used ? "ยังลบไม่ได้ เพราะมีงานใช้งานรายการนี้อยู่" : "ต้องมีสถานะอย่างน้อยหนึ่งรายการ", true); return; } if (!confirm(`ลบรายการ “${old}” ใช่หรือไม่?`)) return; list.splice(index, 1); }
    scheduleSave(); renderSettings(); render();
  }
  function setupEvents() {
    $("authForm").addEventListener("submit", async event => { event.preventDefault(); if (!supabase) return; const errorNode = $("authError"); errorNode.textContent = ""; const email = $("authEmail").value.trim(), password = $("authPassword").value; $("authSubmit").disabled = true;
      const result = authMode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password }); $("authSubmit").disabled = false;
      if (result.error) errorNode.textContent = result.error.message; else if (authMode === "signup" && !result.data.session) errorNode.textContent = "ตรวจสอบอีเมลเพื่อยืนยันบัญชี จากนั้นเข้าสู่ระบบได้เลย"; else { currentUser = result.data.user; await enterWorkspace(); }
    });
    $("toggleAuthMode").addEventListener("click", () => { authMode = authMode === "login" ? "signup" : "login"; $("authTitle").textContent = authMode === "login" ? "ยินดีต้อนรับกลับมา" : "สร้างบัญชีทีม"; $("authSubmit").textContent = authMode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"; $("toggleAuthMode").textContent = authMode === "login" ? "ยังไม่มีบัญชี? สมัครสมาชิก" : "มีบัญชีแล้ว? เข้าสู่ระบบ"; $("authError").textContent = ""; });
    $("previewButton").addEventListener("click", () => { state = readBackup() || clone(DEFAULT_STATE); demoMode = true; currentUser = null; setConnection("offline", "ตัวอย่างในเครื่อง · ไม่ได้ซิงก์"); showApp(); });
    $("signOutButton").addEventListener("click", async () => { if (demoMode) { demoMode = false; showSetup(); return; } await supabase?.auth.signOut(); currentUser = null; showAuth(); });
    $("addTaskButton").addEventListener("click", () => openTask()); $("taskForm").addEventListener("submit", saveTask); $("searchInput").addEventListener("input", render); $("assigneeFilter").addEventListener("change", render); $("assignedFrom").addEventListener("change", render); $("dueTo").addEventListener("change", render);
    $("clearFilters").addEventListener("click", () => { $("searchInput").value = ""; $("assigneeFilter").value = ""; $("assignedFrom").value = ""; $("dueTo").value = ""; render(); }); $("exportButton").addEventListener("click", exportExcel); $("settingsButton").addEventListener("click", () => { renderSettings(); $("settingsDialog").showModal(); }); $("settingsContent").addEventListener("click", settingAction);
    document.querySelectorAll(".close-dialog,.cancel-dialog").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
    $("board").addEventListener("click", event => { const button = event.target.closest("[data-action]"); if (!button) { document.querySelectorAll(".card-context-menu").forEach(node => node.remove()); document.querySelectorAll(".card-menu[aria-expanded=true]").forEach(node => node.setAttribute("aria-expanded", "false")); return; } if (button.dataset.action === "details") showDetails(button.dataset.id); if (button.dataset.action === "menu") openMenu(button.dataset.id, button); if (button.dataset.action === "move") moveTask(button.dataset.id, button.dataset.status); if (button.dataset.action === "delete") removeTask(button.dataset.id); });
    $("board").addEventListener("keydown", event => { if (event.target.matches("[data-action=details]") && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); showDetails(event.target.dataset.id); } });
    $("board").addEventListener("dragstart", event => { const card = event.target.closest(".task-card"); if (!card) return; event.dataTransfer.setData("text/plain", card.dataset.taskId); event.dataTransfer.effectAllowed = "move"; card.classList.add("dragging"); }); $("board").addEventListener("dragend", event => event.target.closest(".task-card")?.classList.remove("dragging"));
    $("board").addEventListener("dragover", event => { const column = event.target.closest(".board-column"); if (!column) return; event.preventDefault(); column.classList.add("drag-over"); }); $("board").addEventListener("dragleave", event => { const column = event.target.closest(".board-column"); if (column && !column.contains(event.relatedTarget)) column.classList.remove("drag-over"); }); $("board").addEventListener("drop", event => { const column = event.target.closest(".board-column"); if (!column) return; event.preventDefault(); column.classList.remove("drag-over"); moveTask(event.dataTransfer.getData("text/plain"), column.dataset.status); });
    $("detailDialog").addEventListener("click", event => { const button = event.target.closest("[data-detail-action]"); if (button?.dataset.detailAction === "edit") { const id = activeDetailId; $("detailDialog").close(); openTask(id); } if (button?.dataset.detailAction === "delete") removeTask(activeDetailId); if (event.target.closest(".close-detail")) $("detailDialog").close(); }); $("detailDialog").addEventListener("submit", addComment);
  }
  setupEvents(); boot();
})();
