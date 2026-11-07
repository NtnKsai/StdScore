/* Student List Manager - NtnKsai
 * Frontend: GitHub Pages | Auth: Google Identity Services | API: Apps Script
 */
(() => {
  'use strict';
  const CONFIG = window.APP_CONFIG || {};
  const LABELS = { number: 'เลขที่', firstName: 'ชื่อ', lastName: 'นามสกุล', nickname: 'ชื่อเล่น', classroom: 'ห้องเรียน' };
  let idToken = '';
  let currentUser = '';
  let students = [];
  let classrooms = [];
  let activeView = 'dashboard';
  let selectedRooms = new Set();
  let visibleColumns = ['number', 'firstName', 'lastName', 'nickname'];
  let currentPage = 1;
  let pageSize = 25;
  let pendingDelete = null;
  let gisReady = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const nowText = () => new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

  function toast(message, type = 'success') {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    $('#toast-region').appendChild(node);
    window.setTimeout(() => node.remove(), 3600);
  }

  function setLoginStatus(message, isError = false) {
    const el = $('#login-status');
    el.textContent = message;
    el.style.color = isError ? '#bf4545' : '';
  }

  function isConfigured() {
    return CONFIG.GOOGLE_CLIENT_ID && CONFIG.API_URL &&
      !CONFIG.GOOGLE_CLIENT_ID.includes('ใส่_') &&
      !CONFIG.API_URL.includes('ใส่_') &&
      CONFIG.API_URL.startsWith('https://script.google.com/');
  }

  function loadGoogleIdentity() {
    if (!isConfigured()) {
      setLoginStatus('โปรดตั้งค่า GOOGLE_CLIENT_ID และ API_URL ในไฟล์ config.js ก่อนใช้งาน', true);
      return;
    }
    setLoginStatus('กำลังโหลด Google Sign-In…');
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.google?.accounts?.id) {
        setLoginStatus('ไม่สามารถโหลด Google Sign-In ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต', true);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        callback: onGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true
      });
      window.google.accounts.id.renderButton($('#google-signin'), {
        type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular',
        text: 'signin_with', logo_alignment: 'left', width: 280, locale: 'th'
      });
      gisReady = true;
      setLoginStatus('พร้อมเข้าสู่ระบบด้วยบัญชี Google');
    };
    script.onerror = () => setLoginStatus('โหลด Google Sign-In ไม่สำเร็จ', true);
    document.head.appendChild(script);
  }

  async function onGoogleCredential(response) {
    if (!response?.credential) {
      setLoginStatus('ไม่พบข้อมูลยืนยันตัวตนจาก Google', true);
      return;
    }
    idToken = response.credential;
    setLoginStatus('กำลังตรวจสอบสิทธิ์และเชื่อมต่อฐานข้อมูล…');
    try {
      const data = await apiGet('bootstrap');
      if (!data.ok) throw new Error(data.message || 'ไม่สามารถเข้าสู่ระบบได้');
      currentUser = data.user?.email || '';
      students = Array.isArray(data.students) ? data.students : [];
      classrooms = Array.isArray(data.classrooms) ? data.classrooms : [];
      selectedRooms = new Set(classrooms.map(room => room.id));
      $('#user-email').textContent = currentUser;
      $('#login-screen').classList.add('hidden');
      $('#app-shell').classList.remove('hidden');
      setView('dashboard');
      renderAll();
      toast(`เข้าสู่ระบบสำเร็จ: ${currentUser}`);
    } catch (error) {
      idToken = '';
      setLoginStatus(error.message || 'เข้าสู่ระบบไม่สำเร็จ', true);
    }
  }

  function apiUrl() {
    if (!isConfigured()) throw new Error('ยังไม่ได้ตั้งค่า API_URL หรือ GOOGLE_CLIENT_ID ใน config.js');
    return CONFIG.API_URL;
  }

  function apiGet(action, params = {}) {
    return new Promise((resolve, reject) => {
      if (!idToken) return reject(new Error('กรุณาเข้าสู่ระบบใหม่อีกครั้ง'));
      let callbackName = `slm_jsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const query = new URLSearchParams({ action, token: idToken, callback: callbackName, ...params });
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
        fn(value);
      };
      window[callbackName] = data => finish(resolve, data);
      script.onerror = () => finish(reject, new Error('เชื่อมต่อ Google Apps Script ไม่สำเร็จ กรุณาตรวจสอบ URL และสิทธิ์การเผยแพร่'));
      const timeout = window.setTimeout(() => finish(reject, new Error('หมดเวลารอการตอบกลับจากฐานข้อมูล')), 30000);
      script.src = `${apiUrl()}?${query.toString()}`;
      document.head.appendChild(script);
    });
  }

  async function apiPost(action, payload = {}) {
    if (!idToken) throw new Error('กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const request = { action, token: idToken, nonce, ...payload };
    const body = new URLSearchParams({ payload: JSON.stringify(request) });
    try {
      // POST is sent in no-cors mode (form-urlencoded is a CORS-safelisted content type).
      // The API stores its result briefly; we retrieve it through authenticated JSONP below.
      await fetch(apiUrl(), {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body
      });
    } catch (error) {
      throw new Error('ส่งข้อมูลไปยัง Google Apps Script ไม่สำเร็จ: ' + (error.message || 'ตรวจสอบการเชื่อมต่อ'));
    }
    for (let attempt = 0; attempt < 40; attempt++) {
      const response = await apiGet('pollResult', { nonce });
      if (response && response.pending) {
        await new Promise(resolve => window.setTimeout(resolve, 500));
        continue;
      }
      return response;
    }
    throw new Error('ไม่ได้รับผลการบันทึกจากเซิร์ฟเวอร์ภายในเวลาที่กำหนด');
  }

  async function runMutation(button, action, payload, successText) {
    const original = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'กำลังบันทึก…'; }
    try {
      const result = await apiPost(action, payload);
      if (!result?.ok) throw new Error(result?.message || 'ไม่สามารถบันทึกข้อมูลได้');
      await refreshData(false);
      toast(successText || result.message || 'บันทึกข้อมูลเรียบร้อย');
      return result;
    } catch (error) {
      toast(error.message, 'error');
      throw error;
    } finally {
      if (button) { button.disabled = false; button.textContent = original; }
    }
  }

  async function refreshData(showToast = true) {
    const data = await apiGet('bootstrap');
    if (!data.ok) throw new Error(data.message || 'โหลดข้อมูลไม่สำเร็จ');
    students = Array.isArray(data.students) ? data.students : [];
    classrooms = Array.isArray(data.classrooms) ? data.classrooms : [];
    const validIds = new Set(classrooms.map(room => room.id));
    selectedRooms = new Set([...selectedRooms].filter(id => validIds.has(id)));
    renderAll();
    $('#last-sync').textContent = `อัปเดตล่าสุด ${nowText()}`;
    if (showToast) toast('โหลดข้อมูลล่าสุดเรียบร้อย');
  }

  function setView(view) {
    activeView = view;
    const headings = { dashboard: 'ภาพรวม', students: 'รายชื่อนักเรียน', classrooms: 'จัดการห้องเรียน', settings: 'ตั้งค่าระบบ' };
    $$('.view-section').forEach(section => section.classList.toggle('hidden', section.id !== `view-${view}`));
    $$('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    $('#page-heading').textContent = headings[view] || 'ภาพรวม';
    $('#sidebar').classList.remove('open');
  }

  function renderAll() {
    renderDashboard();
    renderRoomFilters();
    renderStudents();
    renderClassrooms();
    renderClassroomSelect();
  }

  function renderDashboard() {
    const activeRooms = classrooms.filter(room => students.some(student => student.classroomId === room.id)).length;
    $('#stat-students').textContent = students.length.toLocaleString('th-TH');
    $('#stat-rooms').textContent = classrooms.length.toLocaleString('th-TH');
    $('#stat-active-rooms').textContent = activeRooms.toLocaleString('th-TH');
    const maxCount = Math.max(1, ...classrooms.map(room => students.filter(student => student.classroomId === room.id).length));
    $('#room-summary').innerHTML = classrooms.length ? classrooms.map(room => {
      const count = students.filter(student => student.classroomId === room.id).length;
      return `<div class="room-summary-row"><strong>${escapeHtml(room.name)}</strong><div class="bar-track"><div class="bar-fill" style="width:${Math.round(count / maxCount * 100)}%"></div></div><span class="room-count">${count}</span></div>`;
    }).join('') : '<div class="empty-state compact">ยังไม่มีห้องเรียน กรุณาเพิ่มห้องเรียนก่อน</div>';
  }

  function renderRoomFilters() {
    const wrap = $('#room-filter-list');
    wrap.innerHTML = classrooms.map(room => `<label><input type="checkbox" value="${escapeHtml(room.id)}" ${selectedRooms.has(room.id) ? 'checked' : ''} /> ${escapeHtml(room.name)}</label>`).join('') || '<span class="muted-text">ยังไม่มีห้องเรียน</span>';
    const labels = classrooms.filter(room => selectedRooms.has(room.id)).map(room => room.name);
    $('#selected-room-label').textContent = selectedRooms.size === classrooms.length ? 'ทุกห้องเรียน' : (labels.length ? labels.join(', ') : 'ไม่ได้เลือกห้องเรียน');
  }

  function filteredStudents() {
    const search = $('#student-search').value.trim().toLocaleLowerCase('th-TH');
    return students.filter(student => {
      const roomMatches = selectedRooms.has(student.classroomId);
      const roomName = classrooms.find(room => room.id === student.classroomId)?.name || '';
      const searchable = [student.number, student.firstName, student.lastName, student.nickname, roomName].join(' ').toLocaleLowerCase('th-TH');
      return roomMatches && (!search || searchable.includes(search));
    }).sort((a, b) => {
      const roomA = classrooms.find(room => room.id === a.classroomId)?.name || '';
      const roomB = classrooms.find(room => room.id === b.classroomId)?.name || '';
      const sortKey = $('#sort-by')?.value || 'number';
      return roomA.localeCompare(roomB, 'th') || String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''), 'th', { numeric: true });
    });
  }

  function selectedColumns() {
    return visibleColumns.filter(key => key !== 'classroom' || visibleColumns.includes('classroom'));
  }

  function renderStudents() {
    const filtered = filteredStudents();
    const columns = selectedColumns();
    const size = pageSize === 'all' ? Math.max(1, filtered.length) : Number(pageSize);
    const pages = Math.max(1, Math.ceil(filtered.length / size));
    currentPage = Math.min(currentPage, pages);
    const start = (currentPage - 1) * size;
    const rows = filtered.slice(start, start + size);
    $('#result-count').textContent = `${filtered.length.toLocaleString('th-TH')} รายการ`;
    $('#students-thead').innerHTML = `<tr>${columns.map(key => `<th>${LABELS[key]}</th>`).join('')}<th>จัดการ</th></tr>`;
    $('#students-tbody').innerHTML = rows.map(student => `<tr>${columns.map(key => {
      const value = key === 'classroom' ? (classrooms.find(room => room.id === student.classroomId)?.name || student.classroomName || '-') : student[key];
      return `<td>${escapeHtml(value || '-')}</td>`;
    }).join('')}<td><div class="table-actions"><button class="mini-action" data-edit-student="${escapeHtml(student.id)}">แก้ไข</button><button class="mini-action delete" data-delete-student="${escapeHtml(student.id)}">ลบ</button></div></td></tr>`).join('');
    $('#table-empty').classList.toggle('hidden', filtered.length > 0);
    $('.table-wrap').classList.toggle('hidden', filtered.length === 0);
    $('#table-range').textContent = filtered.length ? `แสดง ${start + 1}–${Math.min(start + rows.length, filtered.length)} จาก ${filtered.length} รายการ` : 'แสดง 0 รายการ';
    $('#page-indicator').textContent = `${currentPage} / ${pages}`;
    $('#prev-page').disabled = currentPage <= 1;
    $('#next-page').disabled = currentPage >= pages;
  }

  function renderClassrooms() {
    $('#classroom-count').textContent = `${classrooms.length} ห้อง`;
    $('#classroom-cards').innerHTML = classrooms.length ? classrooms.map(room => {
      const count = students.filter(student => student.classroomId === room.id).length;
      return `<article class="classroom-card"><div class="classroom-card-icon">▤</div><div class="classroom-card-main"><strong>${escapeHtml(room.name)}</strong><small>${count} คน</small></div><div class="classroom-card-actions"><button aria-label="แก้ไข ${escapeHtml(room.name)}" data-edit-classroom="${escapeHtml(room.id)}">✎</button><button aria-label="ลบ ${escapeHtml(room.name)}" data-delete-classroom="${escapeHtml(room.id)}">×</button></div></article>`;
    }).join('') : '<div class="empty-state"><div class="empty-icon">▤</div><strong>ยังไม่มีห้องเรียน</strong><p>กดปุ่มเพิ่มห้องเรียนเพื่อเริ่มต้น</p></div>';
    renderClassroomSelect();
  }

  function renderClassroomSelect() {
    const select = $('#student-classroom');
    const old = select.value;
    select.innerHTML = '<option value="">เลือกห้องเรียน</option>' + classrooms.map(room => `<option value="${escapeHtml(room.id)}">${escapeHtml(room.name)}</option>`).join('');
    if (classrooms.some(room => room.id === old)) select.value = old;
    $('#student-modal').querySelector('button[type="submit"]').disabled = classrooms.length === 0;
  }

  function openStudentModal(student = null) {
    if (!classrooms.length) {
      toast('กรุณาเพิ่มห้องเรียนก่อนเพิ่มนักเรียน', 'error');
      setView('classrooms');
      return;
    }
    $('#student-form').reset();
    $('#student-form-error').textContent = '';
    $('#student-id').value = student?.id || '';
    $('#student-modal-title').textContent = student ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียน';
    $('#student-classroom').value = student?.classroomId || (classrooms[0]?.id || '');
    $('#student-number').value = student?.number || '';
    $('#student-firstname').value = student?.firstName || '';
    $('#student-lastname').value = student?.lastName || '';
    $('#student-nickname').value = student?.nickname || '';
    showModal('student-modal');
    $('#student-number').focus();
  }

  function openClassroomModal(room = null) {
    $('#classroom-form').reset();
    $('#classroom-form-error').textContent = '';
    $('#classroom-id').value = room?.id || '';
    $('#classroom-name').value = room?.name || '';
    $('#classroom-modal-title').textContent = room ? 'แก้ไขห้องเรียน' : 'เพิ่มห้องเรียน';
    showModal('classroom-modal');
    $('#classroom-name').focus();
  }

  function showModal(id) { $(`#${id}`).classList.remove('hidden'); }
  function closeModal(id) { $(`#${id}`).classList.add('hidden'); }

  function askDelete(message, action) {
    $('#confirm-message').textContent = message;
    pendingDelete = action;
    showModal('confirm-modal');
  }

  async function saveStudent(event) {
    event.preventDefault();
    const button = $('#save-student-button');
    const id = $('#student-id').value;
    const payload = {
      id,
      classroomId: $('#student-classroom').value,
      number: $('#student-number').value.trim(),
      firstName: $('#student-firstname').value.trim(),
      lastName: $('#student-lastname').value.trim(),
      nickname: $('#student-nickname').value.trim()
    };
    $('#student-form-error').textContent = '';
    if (!payload.classroomId || !payload.number || !payload.firstName) {
      $('#student-form-error').textContent = 'กรุณากรอกห้องเรียน เลขที่ และชื่อให้ครบถ้วน';
      return;
    }
    try {
      await runMutation(button, id ? 'updateStudent' : 'createStudent', payload, id ? 'แก้ไขข้อมูลนักเรียนเรียบร้อย' : 'เพิ่มนักเรียนเรียบร้อย');
      closeModal('student-modal');
    } catch (error) { $('#student-form-error').textContent = error.message; }
  }

  async function saveClassroom(event) {
    event.preventDefault();
    const button = $('#save-classroom-button');
    const id = $('#classroom-id').value;
    const payload = { id, name: $('#classroom-name').value.trim() };
    $('#classroom-form-error').textContent = '';
    if (!payload.name) { $('#classroom-form-error').textContent = 'กรุณาระบุชื่อห้องเรียน'; return; }
    try {
      await runMutation(button, id ? 'updateClassroom' : 'createClassroom', payload, id ? 'แก้ไขห้องเรียนเรียบร้อย' : 'เพิ่มห้องเรียนเรียบร้อย');
      if (!id) selectedRooms.add((classrooms.find(room => room.name === payload.name) || {}).id);
      renderRoomFilters();
      closeModal('classroom-modal');
    } catch (error) { $('#classroom-form-error').textContent = error.message; }
  }

  function exportCsv() {
    const columns = selectedColumns();
    const rows = filteredStudents();
    const csvValue = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const content = [columns.map(key => csvValue(LABELS[key])).join(','), ...rows.map(student => columns.map(key => {
      const value = key === 'classroom' ? (classrooms.find(room => room.id === student.classroomId)?.name || '') : student[key];
      return csvValue(value || '');
    }).join(','))].join('\r\n');
    downloadBlob('\ufeff' + content, `student-list-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    toast('ดาวน์โหลดไฟล์ CSV แล้ว');
  }

  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function copyList() {
    const columns = selectedColumns();
    const rows = filteredStudents();
    const text = [columns.map(key => LABELS[key]).join('\t'), ...rows.map(student => columns.map(key => key === 'classroom' ? (classrooms.find(room => room.id === student.classroomId)?.name || '') : (student[key] || '')).join('\t'))].join('\n');
    try { await navigator.clipboard.writeText(text); toast('คัดลอกรายชื่อแล้ว'); }
    catch { toast('เบราว์เซอร์ไม่อนุญาตให้คัดลอก กรุณาใช้ HTTPS', 'error'); }
  }

  function printList() {
    const columns = selectedColumns();
    const rows = filteredStudents();
    const roomNames = classrooms.filter(room => selectedRooms.has(room.id)).map(room => room.name).join(', ') || 'ไม่ได้เลือกห้องเรียน';
    const th = columns.map(key => `<th>${LABELS[key]}</th>`).join('');
    const body = rows.map(student => `<tr>${columns.map(key => `<td>${escapeHtml(key === 'classroom' ? (classrooms.find(room => room.id === student.classroomId)?.name || '') : student[key] || '')}</td>`).join('')}</tr>`).join('');
    $('#print-area').innerHTML = `<h1>รายชื่อนักเรียน</h1><p>โรงเรียนวัดแคทราย(บุญประชาสรรค์) · ห้องเรียน: ${escapeHtml(roomNames)} · จำนวน ${rows.length} คน · พิมพ์วันที่ ${nowText()}</p><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table><div class="print-footer">จัดทำโดย Student List Manager · NtnKsai</div>`;
    window.print();
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); if (row.some(value => value.trim())) rows.push(row); row = []; cell = '';
      } else cell += char;
    }
    row.push(cell); if (row.some(value => value.trim())) rows.push(row);
    return rows;
  }

  function normalizeHeader(text) { return String(text || '').trim().toLowerCase().replace(/[\s_\-]/g, ''); }
  async function importCsvFile(file) {
    const text = (await file.text()).replace(/^\uFEFF/, '');
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error('ไฟล์ CSV ต้องมีแถวหัวตารางและข้อมูลอย่างน้อย 1 รายการ');
    const headers = rows[0].map(normalizeHeader);
    const aliases = {
      number: ['number', 'no', 'studentnumber', 'เลขที่'],
      classroom: ['classroom', 'room', 'class', 'ห้อง', 'ห้องเรียน'],
      firstName: ['firstname', 'name', 'ชื่อ'],
      lastName: ['lastname', 'surname', 'นามสกุล'],
      nickname: ['nickname', 'ชื่อเล่น']
    };
    const indexes = {};
    Object.entries(aliases).forEach(([key, names]) => { indexes[key] = headers.findIndex(header => names.map(normalizeHeader).includes(header)); });
    if (indexes.number < 0 || indexes.classroom < 0 || indexes.firstName < 0) throw new Error('หัวตารางต้องมี เลขที่, ห้อง, ชื่อ (หรือใช้ number,classroom,firstName)');
    const records = rows.slice(1).map(row => {
      const get = key => indexes[key] >= 0 ? String(row[indexes[key]] || '').trim() : '';
      const roomName = get('classroom');
      const room = classrooms.find(item => item.name.toLocaleLowerCase('th') === roomName.toLocaleLowerCase('th'));
      return { classroomId: room?.id || '', number: get('number'), firstName: get('firstName'), lastName: get('lastName'), nickname: get('nickname') };
    }).filter(record => record.number && record.firstName && record.classroomId);
    if (!records.length) throw new Error('ไม่พบรายการที่ถูกต้อง โปรดตรวจสอบชื่อห้องเรียนในไฟล์ CSV ให้ตรงกับระบบ');
    if (!window.confirm(`พบข้อมูลที่พร้อมนำเข้า ${records.length} รายการ ต้องการดำเนินการหรือไม่? รายการที่เลขที่ซ้ำในห้องเดียวกันจะถูกข้าม`)) return;
    const result = await apiPost('importStudents', { students: records });
    if (!result.ok) throw new Error(result.message || 'นำเข้าข้อมูลไม่สำเร็จ');
    await refreshData(false);
    toast(`นำเข้าสำเร็จ ${result.imported} รายการ · ข้าม ${result.skipped} รายการ`);
  }

  function downloadCsvTemplate() {
    const template = '\ufeffเลขที่,ห้อง,ชื่อ,นามสกุล,ชื่อเล่น\r\n1,ป.1/1,สมชาย,ใจดี,บอล\r\n';
    downloadBlob(template, 'student-import-template.csv', 'text/csv;charset=utf-8');
  }

  function bindEvents() {
    $$('.nav-link').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
    $$('[data-view-link]').forEach(button => button.addEventListener('click', () => setView(button.dataset.viewLink)));
    $$('[data-action="go-add-student"]').forEach(button => button.addEventListener('click', () => { setView('students'); openStudentModal(); }));
    $('#menu-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#student-form').addEventListener('submit', saveStudent);
    $('#classroom-form').addEventListener('submit', saveClassroom);
    $('#add-classroom-button').addEventListener('click', () => openClassroomModal());
    $$('[data-close-modal]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
    $$('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(backdrop.id); }));
    $('#student-search').addEventListener('input', () => { currentPage = 1; renderStudents(); });
    $('#room-filter-list').addEventListener('change', event => { if (event.target.matches('input[type="checkbox"]')) { event.target.checked ? selectedRooms.add(event.target.value) : selectedRooms.delete(event.target.value); currentPage = 1; renderRoomFilters(); renderStudents(); } });
    $('#select-all-rooms').addEventListener('click', () => { selectedRooms = new Set(classrooms.map(room => room.id)); renderRoomFilters(); renderStudents(); });
    $('#clear-rooms').addEventListener('click', () => { selectedRooms.clear(); renderRoomFilters(); renderStudents(); });
    $('#column-options').addEventListener('change', () => { visibleColumns = $$('#column-options input:checked').map(input => input.value); renderStudents(); });
    $('#page-size').addEventListener('change', event => { pageSize = event.target.value === 'all' ? 'all' : Number(event.target.value); currentPage = 1; renderStudents(); });
    $('#sort-by').addEventListener('change', () => { currentPage = 1; renderStudents(); });
    $('#prev-page').addEventListener('click', () => { currentPage--; renderStudents(); });
    $('#next-page').addEventListener('click', () => { currentPage++; renderStudents(); });
    $('#export-csv-button').addEventListener('click', exportCsv);
    $('#copy-list-button').addEventListener('click', copyList);
    $('#print-list-button').addEventListener('click', printList);
    $('#import-csv-button').addEventListener('click', () => $('#csv-file').click());
    $('#csv-file').addEventListener('change', async event => { const file = event.target.files?.[0]; if (!file) return; try { await importCsvFile(file); } catch (error) { toast(error.message, 'error'); } finally { event.target.value = ''; } });
    $('#refresh-data-button').addEventListener('click', async () => { const button = $('#refresh-data-button'); button.disabled = true; try { await refreshData(); } catch (error) { toast(error.message, 'error'); } finally { button.disabled = false; } });
    $('#download-template-button').addEventListener('click', downloadCsvTemplate);
    $('#classroom-cards').addEventListener('click', event => {
      const edit = event.target.closest('[data-edit-classroom]');
      const del = event.target.closest('[data-delete-classroom]');
      if (edit) { const room = classrooms.find(item => item.id === edit.dataset.editClassroom); if (room) openClassroomModal(room); }
      if (del) { const room = classrooms.find(item => item.id === del.dataset.deleteClassroom); if (room) askDelete(`ต้องการลบห้องเรียน ${room.name} ใช่หรือไม่?`, async () => { const result = await apiPost('deleteClassroom', { id: room.id }); if (!result.ok) throw new Error(result.message); selectedRooms.delete(room.id); await refreshData(false); toast('ลบห้องเรียนเรียบร้อย'); }); }
    });
    $('#students-tbody').addEventListener('click', event => {
      const edit = event.target.closest('[data-edit-student]');
      const del = event.target.closest('[data-delete-student]');
      if (edit) { const student = students.find(item => item.id === edit.dataset.editStudent); if (student) openStudentModal(student); }
      if (del) { const student = students.find(item => item.id === del.dataset.deleteStudent); if (student) askDelete(`ต้องการลบ ${student.firstName} ${student.lastName || ''} ใช่หรือไม่?`, async () => { const result = await apiPost('deleteStudent', { id: student.id }); if (!result.ok) throw new Error(result.message); await refreshData(false); toast('ลบนักเรียนเรียบร้อย'); }); }
    });
    $('#confirm-delete-button').addEventListener('click', async event => {
      if (!pendingDelete) return;
      const button = event.currentTarget;
      button.disabled = true;
      try { await pendingDelete(); closeModal('confirm-modal'); }
      catch (error) { toast(error.message, 'error'); }
      finally { button.disabled = false; pendingDelete = null; }
    });
    $('#logout-button').addEventListener('click', () => {
      idToken = ''; currentUser = ''; students = []; classrooms = [];
      if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
      $('#app-shell').classList.add('hidden'); $('#login-screen').classList.remove('hidden');
      setLoginStatus('ออกจากระบบแล้ว สามารถเข้าสู่ระบบด้วยบัญชี Google ได้อีกครั้ง');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadGoogleIdentity();
  });
})();
