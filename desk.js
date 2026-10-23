'use strict';
/* 연습실 예약 PC 화면 (2026-10-22 민제, 1차 시안 = Figma 4안). 학원에 둔 수강생 컴퓨터에서 /desk 를 연다.
   가운데 = 도면(얇은 선, 방은 테두리 색: 예약 가능 주황 / 사용 중 옅은 회색 / 고른 방 굵은 주황),
   왼쪽 = 고른 방 카드(시간 길이 → 예약하기), 아래 = 구역·시작 시간. 예약·내 예약은 이름 + 끝 4자리로 본인 확인.
   1분 동안 아무것도 안 하면 처음 화면으로 (다음 사람이 남의 예약을 건드리지 않게) */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BRAND = '#FF6B35', INK = '#111111', SOFT = '#D9D6D0', MUTE = '#C2BDB5';
const D = { r: null, z: 0, slot: null, sel: null, len: 2, t: '', me: null };
// 인터넷 예약 화면 (C안, 2026-10-23): desk.html 이 window.PRACTICE_FN 을 정해 두면 카운터 PC 대신 인터넷 서버 함수로.
// 이 PC 열쇠(예약 PC 등록)는 이 브라우저에 보관. 카운터 PC 화면(/desk)일 때는 예전처럼 카운터 PC로.
const CLOUD = window.PRACTICE_FN || '';
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { } } };
const ACTION = { '/api/kiosk/desk/rooms': 'rooms', '/api/kiosk/desk/login': 'login', '/api/kiosk/desk/me': 'me', '/api/kiosk/desk/reserve': 'reserve', '/api/kiosk/desk/cancel': 'cancel', '/api/kiosk/desk/checkin': 'checkin' };

async function call(path, body) {
  if (CLOUD) {
    const action = ACTION[path]; if (!action) return { ok: true };   // 로그아웃 등: 인터넷 쪽 출입증은 5분 뒤 저절로 끝남
    let j = {};
    try { const r = await fetch(CLOUD, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, device: store.get('inmuu_desk_device') || '', ...(body || {}) }) }); j = await r.json(); }
    catch { throw new Error('net'); }
    if (j.needRegister) { registerScreen(); throw new Error('pin'); }
    if (j.notReady) { $('#app').innerHTML = `<div class="center card"><h3>연습실 서버 준비 중이에요</h3><p class="hint">${esc(j.error || '')}</p></div>`; throw new Error('off'); }
    // 방 목록을 못 받으면 (학원 시스템 로그인 등) 이유를 그대로 보여 줌 — 자동 다시 시도는 서버가 30분 막아 둠
    if (action === 'rooms' && !j.ok) { $('#app').innerHTML = `<div class="center card"><h3>지금 예약 화면을 열 수 없어요</h3><p class="hint">${esc(j.error || '잠시 후 다시 시도해 주세요.')}</p></div>`; throw new Error('off'); }
    return j;
  }
  const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  let j = {}; try { j = await r.json(); } catch { }
  if (r.status === 401 && j.error === 'kiosk_pin') { pinScreen(); throw new Error('pin'); }
  if (r.status === 403) { $('#app').innerHTML = `<div class="center card"><h3>연습실 예약 화면이 꺼져 있어요</h3><p class="hint">카운터 PC 대시보드 [설정]에서 키오스크(태블릿·연습실 예약 PC) 사용을 켜 주세요.</p></div>`; throw new Error('off'); }
  return j;
}

// ---------- 처음 한 번: 예약 PC 등록 (인터넷 화면) ----------
function registerScreen() {
  $('#app').innerHTML = `<div class="center card"><h3>연습실 예약 PC 등록</h3><p class="hint">처음 한 번만 직원이 등록 코드를 넣어 주세요.<br>카운터 PC [연습실] → [예약 PC 등록 코드]에서 만들어요.</p>
    <label for="code">등록 코드 (6자리)</label><input id="code" inputmode="numeric" maxlength="6" autocomplete="off" name="reg-code-nofill">
    <label for="label">이 PC 이름 (예: 5층 예약 PC)</label><input id="label" maxlength="30" autocomplete="off">
    <div class="row"><button class="btn pri" id="regGo">등록</button></div><div class="msg" id="regMsg"></div>
    <p class="hint" style="margin-top:18px;font-size:13px">이 PC를 켜면 예약 화면이 저절로 뜨게 하려면: <a href="desk-setup.bat" download>바로가기 만들기 파일 받기</a> → 받은 파일 더블클릭 (처음 한 번)</p></div>`;
  let busy = false;
  const go = async () => {
    if (busy) return; busy = true; $('#regGo').disabled = true;
    const r = await fetch(CLOUD, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'register', code: $('#code').value, label: $('#label').value }) }).then(x => x.json()).catch(() => ({}));
    busy = false; if ($('#regGo')) $('#regGo').disabled = false;
    if (r.ok) { store.set('inmuu_desk_device', r.token); store.set('inmuu_desk_label', $('#label').value); start(); } else $('#regMsg').textContent = r.error || '등록하지 못했어요. 인터넷 연결을 확인해 주세요.';
  };
  $('#regGo').onclick = go; $('#code').focus();
}

// ---------- 처음 한 번: 키오스크 PIN ----------
function pinScreen() {
  $('#app').innerHTML = `<div class="center card"><h3>연습실 예약 PC 연결</h3><p class="hint">처음 한 번만 직원이 키오스크 PIN을 넣어 주세요.</p>
    <input id="pin" type="password" inputmode="numeric" autocomplete="new-password" name="kiosk-pin-nofill"><div class="row"><button class="btn pri" id="pinGo">연결</button></div><div class="msg" id="pinMsg"></div>
    <p class="hint" style="margin-top:18px;font-size:13px">이 PC를 켜면 예약 화면이 바로 뜨게 하려면: <a href="/desk-setup.bat">바로가기 만들기 파일 받기</a> → 받은 파일 더블클릭</p></div>`;
  // 여러 번 눌러도 한 번만 보낸다 (2026-10-23: 3초에 5번 들어가 1분 잠김)
  let busy = false;
  const go = async () => {
    if (busy) return; busy = true; $('#pinGo').disabled = true;
    const r = await fetch('/api/kiosk/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: $('#pin').value }) }).then(x => x.json()).catch(() => ({}));
    busy = false; if ($('#pinGo')) $('#pinGo').disabled = false;
    if (r.ok) start(); else { $('#pinMsg').textContent = r.error || '연결하지 못했어요.'; $('#pin').select(); }
  };
  $('#pinGo').onclick = go; $('#pin').onkeydown = e => { if (e.key === 'Enter') go(); }; $('#pin').focus();
}

// ---------- 구역 (도면이 없는 지점은 방 목록을 바둑판으로) ----------
function zones() {
  const r = D.r;
  if (r.layout && r.layout.length) return r.layout;
  const rooms = r.rooms, cols = 6, w = 150, h = 110, gap = 14;
  return [{ key: 'all', name: '연습실', open: 20, close: 44, viewBox: `0 0 ${cols * (w + gap) + gap} ${Math.ceil(rooms.length / cols) * (h + gap) + gap}`, deco: '',
    rooms: rooms.map((x, i) => ({ key: 'r' + x.id, label: x.type, drawn: x.type, roomId: x.id, roomName: x.name, x: gap + (i % cols) * (w + gap), y: gap + Math.floor(i / cols) * (h + gap), w, h })), extra: [] }];
}
const roomOf = id => D.r.rooms.find(x => x.id === id);
const tm = s => `${String(Math.floor(s / 2) % 24).padStart(2, '0')}:${s % 2 ? '30' : '00'}`;
const lenText = n => n === 1 ? '30분' : n % 2 ? `${(n - 1) / 2}시간 30분` : `${n / 2}시간`;
// 큰 번호: 바꾼 이름이 있으면 그것, 없으면 학원 시스템 이름의 숫자(ROOM4 → 4), 아니면 학원 시스템 이름 그대로
const bigOf = p => p.label !== p.drawn ? p.label : (/^ROOM\s*(\d+)$/i.exec(p.roomName || '') || [])[1] || p.roomName || '연결 전';
// 그 시간부터 이어서 비어 있는 칸 수
function run(room, slot) { let n = 0; while (room && room.free.includes(slot + n)) n++; return n; }

// 고른 방의 오늘 하루 일정 (2026-10-22 민제: 왼쪽 카드와 도면 사이에 세로로 30분 단위)
// 수업 = 진한 회색, 연습 예약 = 옅은 회색, 내가 고른 시간 = 주황 테두리, 지금 = 주황 선. 예약 가능한 빈 칸을 누르면 그 시간이 시작 시간
function schedCol(room, slot, len, now, win) {
  if (!room) return `<div class="card sched"><div class="st"><span>방 일정</span></div><p class="hint" style="margin-top:12px">방을 고르면 그 방의<br>오늘 일정이 여기 떠요.</p></div>`;
  const a = room.hf, b = Math.max(room.ht, a + 1), row = s => s - a + 1;
  const cells = [];
  for (let s = a; s < b; s++) {
    const can = win.includes(s) && room.free.includes(s), hr = s % 2 ? '' : 'hr';
    cells.push(`<div class="st-t ${hr}" style="grid-row:${row(s)}">${s % 2 ? '' : tm(s)}</div><div class="st-c ${hr} ${s < now ? 'past' : ''} ${can ? 'can' : ''}" style="grid-row:${row(s)}" ${can ? `data-slot="${s}"` : ''}></div>`);
  }
  for (const d of room.day) if (d.to > a && d.from < b) {
    const f = Math.max(d.from, a), t = Math.min(d.to, b);
    cells.push(`<div class="st-b ${d.kind === '수업' ? 'les' : 'pra'} ${d.to <= now ? 'past' : ''} ${t - f === 1 ? 'one' : ''}" style="grid-row:${row(f)} / span ${t - f}"><b>${d.kind}</b><span>${d.time}~${d.end}</span></div>`);
  }
  cells.push(`<div class="st-p ${len === 1 ? 'one' : ''}" style="grid-row:${row(slot)} / span ${len}"><b>고른 시간</b><span>${tm(slot)}~${slot + len >= 48 ? '24:00' : tm(slot + len)}</span></div>`);
  const nowTop = (now - a) * 30 + (new Date().getMinutes() % 30);
  return `<div class="card sched"><div class="st"><span>오늘 이 방 일정</span><span class="hint" style="font-size:13px">${room.open}~${room.close}</span></div>
    <div class="dleg"><span><i style="background:#8A847B"></i>수업</span><span><i style="background:#D9D6D0"></i>연습</span><span><i class="p"></i>고른 시간</span></div>
    <div class="st-wrap" id="stWrap"><div class="st-grid" style="grid-template-rows:repeat(${b - a}, 30px)">${cells.join('')}
      ${now >= a && now < b ? `<i class="st-now" style="top:${nowTop}px"></i>` : ''}</div></div></div>`;
}

// ---------- 화면 ----------
function draw() {
  const r = D.r; if (!r) return;
  const Z = zones(); if (D.z >= Z.length) D.z = 0;
  const z = Z[D.z];
  if (D.slot == null || !r.window.some(w => w.slot === D.slot)) D.slot = r.nowSlot;
  const selP = z.rooms.find(p => p.roomId != null && p.roomId === D.sel) || null;
  if (selP && !run(roomOf(selP.roomId), D.slot)) D.sel = null;
  // 글씨·선 굵기 배율: 구역마다 도면 크기가 달라도 화면에서 같은 크기로 보이게 (7층 기준 1)
  const vb = z.viewBox.split(' ').map(Number), per = v => Math.min(680 / v[2], 740 / v[3]), sc = per([0, 0, 805, 810]) / per(vb);
  let svg = z.deco || '';
  for (const p of z.rooms) {
    const room = p.roomId != null ? roomOf(p.roomId) : null;
    const ok = room && run(room, D.slot) > 0, me = ok && p.roomId === D.sel;
    const g = 4 * sc, small = p.w < 90 * sc;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const stroke = !room ? SOFT : me ? BRAND : ok ? BRAND : SOFT, sw = (me ? 5 : ok ? 2 : 1) * sc;
    const big = room ? bigOf(p) : '연결 전', fs = (small ? 24 : big.length > 3 ? 20 : 32) * sc;
    svg += `<g class="room ${ok ? '' : 'busy'}" data-room="${p.roomId ?? ''}">
      <rect x="${p.x + g}" y="${p.y + g}" width="${p.w - 2 * g}" height="${p.h - 2 * g}" fill="#FFFFFF" stroke="${stroke}" stroke-width="${sw}" ${room ? '' : 'stroke-dasharray="5 5"'}/>
      <text x="${cx}" y="${cy - 4 * sc}" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" font-weight="700" fill="${me ? BRAND : ok ? INK : MUTE}">${esc(big)}</text>
      <text x="${cx}" y="${cy + fs * 0.75}" text-anchor="middle" dominant-baseline="middle" font-size="${(small ? 11 : 13) * sc}" font-weight="500" fill="${me ? BRAND : ok ? '#6B655C' : MUTE}">${esc(p.drawn)}</text></g>`;
  }
  const extra = (z.extra || []).map(e => { const room = roomOf(e.id), ok = run(room, D.slot) > 0;
    return `<button class="chip" data-room="${e.id}" ${ok ? '' : 'disabled'} style="${ok ? `border-color:${D.sel === e.id ? BRAND : BRAND};${D.sel === e.id ? 'border-width:3px' : ''}` : ''}">${esc(e.name)} · ${esc(e.type)}</button>`; }).join('');
  const avail = z.rooms.filter(p => p.roomId != null && run(roomOf(p.roomId), D.slot) > 0).length;
  const sel = D.sel != null ? (z.rooms.find(p => p.roomId === D.sel) || (z.extra || []).map(e => ({ roomId: e.id, roomName: e.name, label: e.type, drawn: e.type })).find(p => p.roomId === D.sel)) : null;
  const selRoom = sel ? roomOf(sel.roomId) : null;
  const blocked = CLOUD && D.me && D.me.canBook === false;
  const maxLen = selRoom && !blocked ? Math.min(4, run(selRoom, D.slot), !CLOUD && D.me ? D.me.remain : 4) : 0;
  if (D.len > maxLen) D.len = Math.max(1, maxLen);
  const times = `<label style="margin-top:16px">언제부터 쓸까요?</label>
      <div class="chips">${r.window.map(w => `<button class="chip ${w.slot === D.slot ? 'on' : ''}" data-slot="${w.slot}" ${selRoom && !run(selRoom, w.slot) ? 'disabled' : ''}>${w.slot === r.nowSlot ? '지금 ' : ''}${w.time}</button>`).join('')}</div>`;
  const left = sel ? `<div class="card">
      <div class="st"><span>예약 가능 · ${tm(D.slot)}부터</span><span class="pill">${esc(z.name)}</span></div>
      <h2>${esc(/^\d+$/.test(bigOf(sel)) ? bigOf(sel) + '번' : bigOf(sel))} · ${esc(sel.drawn)}</h2><div class="code">학원 시스템 ${esc(sel.roomName)}</div>${selRoom && selRoom.drumOnly ? `<div class="code" style="color:${BRAND}">드럼 수강생만 예약할 수 있어요</div>` : ''}
      ${times}
      <label style="margin-top:16px">몇 시간 쓸까요?</label>
      <div class="chips">${[1, 2, 3, 4].map(n => `<button class="chip ${n === D.len ? 'on' : ''}" data-len="${n}" ${n <= maxLen ? '' : 'disabled'}>${lenText(n)}</button>`).join('')}</div>
      <button class="go" id="reserve" ${maxLen ? '' : 'disabled'}>${maxLen ? `${tm(D.slot)}부터 ${lenText(D.len)} 예약하기` : blocked ? '지금 예약이 끝나면 다음 예약을 할 수 있어요' : '오늘 예약할 수 있는 시간을 다 썼어요'}</button></div>
`
    : `<div class="card"><div class="st"><span>${tm(D.slot)}부터 예약 가능 ${avail}개</span><span class="pill">${esc(z.name)}</span></div>
      ${times}
      <p class="hint" style="margin-top:14px">${D.slot < z.open || D.slot >= z.close
        ? `이 구역은 ${tm(z.open)}~${tm(z.close)}에만 쓸 수 있어요.${Z.some(q => q.open === 0 && q.close === 48) ? `<br>지금은 <b style="color:${BRAND}">${esc(Z.find(q => q.open === 0 && q.close === 48).name)}</b>을 이용해 주세요.` : ''}`
        : `시작 시간을 고르고 도면에서<br><b style="color:${BRAND}">주황 테두리</b> 방을 눌러 주세요.`}</p></div>`;
  const rules = r.rules;
  $('#app').innerHTML = `<header><h1>인생뮤직 연습실</h1><span class="sub">${esc(r.branch || '')}${r.branch ? ' · ' : ''}${esc(z.name)} · ${z.open === 0 && z.close === 48 ? '24시간' : tm(z.open) + '~' + tm(z.close)}</span>
      <div class="legend"><span><i style="border:2px solid ${BRAND}"></i>예약 가능</span><span><i style="border:1px solid ${SOFT}"></i>사용 중</span><span><i style="border:4px solid ${BRAND}"></i>고른 방</span></div>
      <button class="mine" id="mine">내 예약 · 취소</button><span class="clock" id="clock"></span></header>
    <main><div class="col">${left}
      <div class="card"><p class="hint">${CLOUD ? `한 번 예약은 최대 ${rules.maxHours}시간<br>예약 시간이 끝나면 다음 예약 가능<br>예약 시작 ${rules.noShowMinutes}분 안에 방문 QR로 입실<br>예약은 학원 예약 PC에서만 가능합니다` : `하루 ${rules.baseHours}시간 · 다 쓰면 30분씩 연장<br>예약 시작 ${rules.noShowMinutes}분 안에 방문 QR로 입실<br>예약은 학원에서만`}</p></div></div>
      <div class="col">${schedCol(selRoom, D.slot, D.len, r.nowSlot, r.window.map(w => w.slot))}</div>
      <div class="col"><div class="zones">${Z.map((q, i) => `<button class="z ${i === D.z ? 'on' : ''}" data-z="${i}">${esc(q.name)}</button>`).join('')}</div>
      <div class="plan" style="flex:1"><svg viewBox="${z.viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(z.name)} 도면">${svg}</svg></div>
      ${extra ? `<div class="extra">도면에 없는 방 ${extra}</div>` : ''}</div></main>`;
  tick();
  // 일정 칸은 고른 시간이 가운데쯤 오게
  const sw = $('#stWrap'), sp = sw?.querySelector('.st-p'); if (sw && sp) sw.scrollTop = Math.max(0, sp.offsetTop - sw.clientHeight / 3);
  document.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { D.z = +b.dataset.z; D.sel = null; poke(); draw(); });
  document.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { D.slot = +b.dataset.slot; poke(); draw(); });
  document.querySelectorAll('[data-len]').forEach(b => b.onclick = () => { D.len = +b.dataset.len; poke(); draw(); });
  document.querySelectorAll('[data-room]').forEach(el => el.onclick = () => {
    const id = el.dataset.room === '' ? null : +el.dataset.room; if (id == null || !run(roomOf(id), D.slot)) return;
    D.sel = id; poke(); draw();
  });
  $('#reserve')?.addEventListener('click', () => withMe(reserve));
  $('#mine').onclick = () => withMe(myModal);
}

// ---------- 본인 확인 (예약·내 예약 앞에서) ----------
function withMe(next) {
  if (D.t) return next();
  modal(`<h3>본인 확인</h3><p class="hint">수강 중인 분만 예약할 수 있어요.</p>
    <label for="name">이름</label><input id="name" autocomplete="off" placeholder="홍길동">
    <label for="tail">휴대폰 번호 끝 4자리</label><input id="tail" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="1234">
    <div class="msg" id="lmsg"></div><div class="row"><button class="btn" id="mx">닫기</button><button class="btn pri" id="lgo">확인</button></div>`);
  const go = async () => {
    const j = await call('/api/kiosk/desk/login', { name: $('#name').value, tail: $('#tail').value });
    if (!j.ok) { $('#lmsg').textContent = j.error || '확인하지 못했어요.'; return; }
    D.t = j.token; await loadMe(); closeModal(); next();
  };
  $('#lgo').onclick = go; $('#mx').onclick = () => reset();
  $('#tail').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#name').onkeydown = e => { if (e.key === 'Enter') $('#tail').focus(); };
  $('#name').focus();
}
async function loadMe() {
  if (!D.t) return;
  const j = await call('/api/kiosk/desk/me', { t: D.t });
  if (!j.ok) return reset(j.error);
  D.me = j;
}

async function reserve() {
  const room = roomOf(D.sel); if (!room) return;
  if (!CLOUD && D.len > D.me.remain) {
    return modal(`<h3>하루 ${D.r.rules.baseHours}시간까지예요</h3><p class="hint">오늘 ${D.me.baseUsed}시간 예약했어요. 다 쓰신 뒤에는 [내 예약]에서 30분씩 연장할 수 있어요.</p><div class="row"><button class="btn pri" id="mx">확인</button></div>`, () => { $('#mx').onclick = () => { closeModal(); draw(); }; });
  }
  const j = await call('/api/kiosk/desk/reserve', { t: D.t, roomId: D.sel, slot: D.slot, len: D.len });
  if (j.expired) return reset(j.error);
  await refresh();
  if (!j.ok) return modal(`<h3>예약하지 못했어요</h3><p class="hint">${esc(j.error || '')}</p><div class="row"><button class="btn pri" id="mx">확인</button></div>`, () => { $('#mx').onclick = () => { closeModal(); D.sel = null; draw(); }; });
  modal(`<h3>${esc(j.room)} 예약됐어요</h3><p class="hint" style="font-size:18px;color:#111">${j.time}~${j.end}</p>
    <p class="hint" style="margin-top:10px"><b style="color:${BRAND}">${j.checkInBy}까지</b> 방문 앞 QR을 휴대폰으로 찍어 입실해 주세요.<br>입실하지 않으면 다른 분이 쓸 수 있게 방이 풀려요.</p>
    ${j.partial ? `<div class="msg">${esc(j.error)}</div>` : ''}<div class="msg" id="undoMsg"></div>
    <div class="row"><button class="btn" id="undo">방금 예약 취소</button><button class="btn pri" id="mx">확인</button></div>`, () => {
    $('#mx').onclick = () => reset();
    // 잘못 눌렀을 때 그 자리에서 되돌리기 (2026-10-23 민제 "예약화면에서 취소도 할 수 있어야")
    const roomId = D.sel, from = D.slot;
    $('#undo').onclick = async () => {
      if (!confirm('방금 한 예약을 취소할까요?')) return;
      $('#undo').disabled = true; poke();
      const c = await call('/api/kiosk/desk/cancel', { t: D.t, roomId, from });
      if (c.expired) return reset(c.error);
      if (c.ok) return reset('예약을 취소했어요.');
      $('#undo').disabled = false; $('#undoMsg').textContent = c.error || '취소하지 못했어요. 데스크에 말씀해 주세요.';
    };
  });
}

// ---------- 내 예약: 입실(QR이 안 될 때)·연장·취소 ----------
async function myModal(msg, ok) {
  await loadMe(); if (!D.me) return;
  const m = D.me, my = m.my.filter(b => !b.past);
  modal(`<h3>${esc(m.name)}님 예약</h3><p class="hint">${CLOUD ? (m.canBook ? '지금 새 예약을 할 수 있어요.' : `지금 예약이 끝나는 ${tm(m.after)}부터 다음 예약을 할 수 있어요. (일찍 퇴실하면 바로)`) : `오늘 예약 ${m.baseUsed}/${D.r.rules.baseHours}시간 · 연장 ${m.extUsed}/${D.r.rules.extHours}시간${m.noShows ? ` · 최근 30일 노쇼 ${m.noShows}회` : ''}`}</p>
    ${my.length ? my.map(b => `<div class="my"><div class="h"><span>${esc(b.room)} · ${b.time}~${b.end}</span>
        ${b.checkedIn ? '<span class="tag">입실함</span>' : (b.desk || CLOUD) ? `<span class="tag warn">${b.noShowAt}까지 입실</span>` : '<span class="tag">학원 PC 예약</span>'}</div>
      <div class="a">${b.canCheckIn ? `<button class="btn pri" data-in="${b.roomId}|${b.from}">입실 (QR이 안 될 때)</button>` : ''}
        ${b.canExtend ? `<button class="btn" data-ext="${b.roomId}|${b.to}">30분 연장</button>` : ''}
        ${b.canCancel ? `<button class="btn" data-cancel="${b.roomId}|${b.from}|${b.ongoing ? 1 : 0}">${b.ongoing ? '일찍 나가기' : '예약 취소'}</button>` : ''}</div></div>`).join('')
      : '<p class="hint" style="margin-top:12px">오늘 남은 예약이 없어요.</p>'}
    <div class="msg ${ok ? 'ok' : ''}">${esc(msg || '')}</div><div class="row"><button class="btn pri" id="mx">다 했어요</button></div>`);
  $('#mx').onclick = () => reset();
  const act = async (path, body, okText) => {
    const j = await call(path, { t: D.t, ...body });
    if (j.expired) return reset(j.error);
    await refresh(); myModal(j.ok ? okText(j) : (j.error || '처리하지 못했어요.'), !!j.ok);
  };
  document.querySelectorAll('[data-in]').forEach(b => b.onclick = () => { const [roomId, from] = b.dataset.in.split('|').map(Number); poke(); act('/api/kiosk/desk/checkin', { roomId, from }, () => '입실했어요. 즐거운 연습 되세요!'); });
  document.querySelectorAll('[data-ext]').forEach(b => b.onclick = () => { const [roomId, to] = b.dataset.ext.split('|').map(Number); poke(); act('/api/kiosk/desk/extend', { roomId, to }, j => `30분 연장했어요. (~${j.end})`); });
  document.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => {
    const [roomId, from, ongoing] = b.dataset.cancel.split('|').map(Number); poke();
    if (!confirm(ongoing ? '지금 나가고 남은 시간을 다른 분이 쓸 수 있게 할까요?' : '이 예약을 취소할까요?')) return;
    act('/api/kiosk/desk/cancel', { roomId, from }, j => ongoing ? `남은 ${j.freed}분을 풀었어요. 수고하셨어요!` : '예약을 취소했어요.');
  });
}

// ---------- 창 ----------
function modal(html, after) {
  closeModal();
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal';
  m.innerHTML = `<div class="sheet">${html}</div>`; document.body.appendChild(m); poke(true);
  if (after) after();
}
function closeModal() { $('#modal')?.remove(); }

// ---------- 1분 동안 아무것도 안 하면 처음 화면 ----------
let idle = null;
function poke(force) { clearTimeout(idle); if (D.t || force || $('#modal')) idle = setTimeout(() => reset(), 60000); }
document.addEventListener('pointerdown', () => poke());
document.addEventListener('keydown', () => poke());
async function reset(msg) {
  if (D.t) call('/api/kiosk/desk/logout', { t: D.t }).catch(() => { });
  Object.assign(D, { t: '', me: null, sel: null, len: 2, slot: null, z: homeZone() });
  closeModal(); clearTimeout(idle);
  await refresh().catch(() => { }); draw();
  if (msg) { modal(`<p class="hint">${esc(msg)}</p><div class="row"><button class="btn pri" id="mx">확인</button></div>`, () => { $('#mx').onclick = () => closeModal(); }); }
}
function tick() { const c = $('#clock'); if (c) c.textContent = new Date().toTimeString().slice(0, 5); }
setInterval(tick, 10000);
async function refresh() { D.r = await call('/api/kiosk/desk/rooms'); }
// 30초마다 빈 방 다시 읽기 (창이 떠 있으면 건너뜀)
setInterval(async () => { if ($('#modal')) return; try { await refresh(); draw(); } catch { } }, 30000);   // 30초 (2026-10-23: 10초면 예약 PC 2대로 Supabase 무료 한도 월 50만 번 초과 — 겹침은 [예약하기] 때 서버가 다시 확인)

// PC마다 처음 보이는 층: 등록 때 적은 PC 이름에 "5층"·"7층"이 있으면 그 층 구역부터 (2026-10-23)
function homeZone() {
  const label = store.get('inmuu_desk_label') || '', floor = /([0-9]+)층/.exec(label)?.[1];
  if (!floor || !D.r) return 0;
  const i = zones().findIndex(z => (z.name || '').startsWith(floor + '층'));
  return i < 0 ? 0 : i;
}
async function start() { try { await refresh(); D.z = homeZone(); draw(); } catch (e) { if (e.message !== 'pin' && e.message !== 'off') $('#app').innerHTML = CLOUD ? `<div class="center card"><h3>연결하지 못했어요</h3><p class="hint">인터넷 연결을 확인해 주세요. 잠시 뒤 다시 시도해요.</p></div>` : `<div class="center card"><h3>연결하지 못했어요</h3><p class="hint">카운터 PC 대시보드가 켜져 있는지 확인해 주세요.</p></div>`; if (CLOUD && e.message === 'net') setTimeout(start, 15000); } }
start();
