<template>
  <div class="d-flex flex-column h-100 border-start" ref="rootEl">
    <!-- ÜST SATIR -->
    <div class="d-flex align-items-center justify-content-between px-3 pt-3">
      <div class="page-title fw-bold fs-4" contenteditable @input="onTitleInput">{{ pageTitle }}</div>
      <div class="d-flex align-items-center gap-2">
        <button type="button" class="btn btn-light" @click="onSearch" title="Arama">
          <i class="bi bi-search"></i>
        </button>
        <button type="button" class="btn btn-outline-secondary" @click="toggleFullscreen"
                :title="isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'">
          <i class="bi" :class="isFullscreen ? 'bi-fullscreen-exit' : 'bi-fullscreen'"></i>
        </button>
      </div>
    </div>

    <!-- ÇİZGİ + TARİH/SAAT -->
    <div class="px-3">
      <hr class="my-2" />
      <div class="text-muted small d-flex justify-content-between">
        <span>{{ today }}</span><span>{{ nowStr }}</span>
      </div>
    </div>

    <!-- KANVAS -->
    <div
      class="editor-canvas position-relative flex-grow-1"
      ref="canvasEl"
      tabindex="0"
      @click.self="onCanvasClick"
      @mousemove="rememberPointer"
      @keydown="handleCanvasKeydown"
      @contextmenu.prevent
    >
      <!-- BOŞ ALAN İMLECİ -->
      <div
        v-if="caret.show"
        class="caret-ghost"
        :style="{ left: caret.x + 'px', top: caret.y + 'px', height: caret.h + 'px' }"
      ></div>

      <!-- NOT KUTULARI -->
      <div
        v-for="b in blocks"
        :key="b.id"
        class="note-box position-absolute bg-white"
        :style="noteStyle(b)"
        :data-id="b.id"
        @contextmenu.prevent.stop="openCtxMenu($event, b)"
      >
        <!-- HEADER (basılıyken ikon çıkar; tüm header’dan sürükle) -->
        <div
          class="box-header d-flex align-items-center justify-content-between px-2"
          @mousedown.stop="startDragFromHeader($event, b)"
          @mouseup.stop="endDrag"
          @mouseleave.stop="endDrag"
        >
          <i v-if="moveHintId === b.id" class="move-indicator bi bi-arrows-move text-secondary"></i>
          <div class="flex-grow-1"></div>
        </div>

        <!-- İÇERİK -->
        <div class="p-3">
          <textarea
            class="note-content"
            :placeholder="placeholder"
            v-model="b.text"
            wrap="soft"
            rows="1"
            @focus="caret.show=false"
            @input="onTAInput(b)"
            @paste="pastePlain($event, b)"
          ></textarea>
        </div>

        <!-- Sağ-alt köşe – yeniden boyutlandırma -->
        <div class="resizer" @mousedown.stop="startResize($event, b)" title="Yeniden boyutlandır"></div>
      </div>

      <!-- SAĞ TIK MENÜSÜ -->
      <div
        v-if="ctxMenu.show"
        class="dropdown-menu show shadow-sm"
        :style="{ position:'absolute', left: ctxMenu.x + 'px', top: ctxMenu.y + 'px', display:'block' }"
        @click.stop
      >
        <button class="dropdown-item" @click.stop="focusContent(ctxMenu.blockId)">Düzenle</button>
        <button class="dropdown-item" @click.stop="duplicateById(ctxMenu.blockId)">Çoğalt</button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item text-danger" @click.stop="deleteById(ctxMenu.blockId)">Sil</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

/* ===== PROPS / EMIT ===== */
const props = defineProps({ page: { type: Object, required: true } })
const emit  = defineEmits(['update-page'])

/* ===== SABİTLER ===== */
const GRID = 8
const MIN_W = 160, MIN_H = 96

/* ===== STATE ===== */
const rootEl = ref(null)
const canvasEl = ref(null)
const isFullscreen = ref(false)
const placeholder = 'Yazmaya başlamak için tıklayın…'
const pageTitle = ref('Başlıksız Sayfa')
const blocks = reactive([])
const moveHintId = ref(null)

/* Boş alan imleci */
const caret = reactive({ show:false, x: 200, y: 160, h: 22 })

/* Saat */
const nowTick = ref(new Date())
let clockTimer = null
onMounted(() => { clockTimer = setInterval(() => nowTick.value = new Date(), 60_000) })
onBeforeUnmount(() => clearInterval(clockTimer))
const nowStr = computed(() => nowTick.value.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' }))
const today  = new Date().toLocaleDateString('tr-TR', { day:'2-digit', month:'long', year:'numeric', weekday:'long' })

/* ===== PROPS -> LOCAL ===== */
const loadFromProps = async () => {
  pageTitle.value = props.page?.title || 'Başlıksız Sayfa'

  let incoming = []
  if (Array.isArray(props.page?.blocks)) incoming = props.page.blocks
  else if (typeof props.page?.content === 'string') {
    try { const parsed = JSON.parse(props.page.content); if (Array.isArray(parsed)) incoming = parsed } catch {}
  }
  blocks.splice(0, blocks.length, ...incoming.map(b => ({ manual:false, ...b })))
  await nextTick()
  for (const b of blocks) autosize(b, false)
  hideCtxMenu()
}
watch(() => props.page?.id, () => loadFromProps())
onMounted(loadFromProps)

/* ===== EMIT (debounce) ===== */
let deb = null
function emitUpdate () {
  clearTimeout(deb)
  deb = setTimeout(() => {
    const outBlocks = blocks.map(b => ({ id:b.id, x:b.x, y:b.y, w:b.w, h:b.h, z:b.z, text:b.text }))
    emit('update-page', {
      id: props.page.id,
      title: pageTitle.value,
      content: JSON.stringify(outBlocks),
      blocks: outBlocks
    })
  }, 80)
}

/* ===== BAŞLIK ===== */
const onTitleInput = (e) => { pageTitle.value = e.target.innerText.trim(); emitUpdate() }

/* ===== KANVAS / POINTER ===== */
const pointer = ref({ x: 220, y: 180 })

const rememberPointer = (e) => {
  const rect = canvasEl.value.getBoundingClientRect()
  // scroll'u hesaba kat (scrollbar olduğu için)
  pointer.value = {
    x: e.clientX - rect.left + canvasEl.value.scrollLeft,
    y: e.clientY - rect.top  + canvasEl.value.scrollTop
  }
}

const onCanvasClick = (e) => {
  if (!canvasEl.value) return
  canvasEl.value.focus()
  rememberPointer(e)
  // grid'e oturt, caret'i göster
  caret.x = snap(pointer.value.x)
  caret.y = snap(pointer.value.y)
  caret.show = true
  hideCtxMenu()
}

/* ===== KLAVYE: yazınca yeni kutu ===== */
const handleCanvasKeydown = async (e) => {
  if (document.activeElement !== canvasEl.value) return
  if (ctxMenu.show) return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const isChar  = e.key?.length === 1
  const isEnter = e.key === 'Enter'
  if (!isChar && !isEnter) return
  e.preventDefault()

  const b = createBlockAt(pointer.value.x, pointer.value.y)
  caret.show = false
  await nextTick()
  const ta = getTA(b.id)
  if (ta) {
    ta.focus()
    if (isChar) b.text += e.key
    if (isEnter) b.text += '\n'
    ta.value = b.text
    autosize(b, true)
    selectId.value = b.id
    bringToFront(b.id)
    emitUpdate()
  }
}

/* ===== HELPERS ===== */
const newId = () => 'b_' + Math.random().toString(36).slice(2, 9)
const getTA  = (id) => canvasEl.value?.querySelector(`.note-box[data-id="${id}"] .note-content`)
const getBox = (id) => canvasEl.value?.querySelector(`.note-box[data-id="${id}"]`)
const snap   = (v) => Math.round(v / GRID) * GRID
const nextZ  = () => Math.max(1, ...blocks.map(b => b.z ?? 1)) + 1
const noteStyle = (b) => ({ left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px', zIndex: b.z ?? 1 })

const clampInside = (b) => {
  const cw = Math.max(canvasEl.value.clientWidth,  canvasEl.value.scrollWidth)
  const ch = Math.max(canvasEl.value.clientHeight, canvasEl.value.scrollHeight)
  b.x = Math.min(Math.max(0, b.x), cw - Math.max(MIN_W, b.w))
  b.y = Math.min(Math.max(0, b.y), ch - Math.max(MIN_H, b.h))
}

/** kutu-metriği */
function getBoxMetrics(b){
  const box = getBox(b.id)
  const headerH = box?.querySelector('.box-header')?.offsetHeight ?? 0
  const wrap = getTA(b.id)?.parentElement
  const cs = wrap ? getComputedStyle(wrap) : null
  const padV = cs ? (parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)) : 0
  return { headerH, padV }
}

function autosize(b, fitBox = false){
  const ta = getTA(b.id); if (!ta) return
  const { headerH, padV } = getBoxMetrics(b)

  ta.style.height = 'auto'
  const contentH = Math.max(24, ta.scrollHeight)
  const targetTA = fitBox ? Math.max(contentH, b.h - headerH - padV) : contentH
  ta.style.height = targetTA + 'px'
  ta.scrollTop = 0

  const needBox = Math.max(MIN_H, headerH + padV + targetTA)
  if (b.manual && !fitBox) b.h = Math.max(b.h, needBox)
  else b.h = needBox
}

function syncTAtoBox(b){
  const ta = getTA(b.id); if (!ta) return
  const { headerH, padV } = getBoxMetrics(b)
  ta.style.height = Math.max(24, b.h - headerH - padV) + 'px'
  ta.scrollTop = 0
}

/* ===== BLOK OLUŞTURMA ===== */
const createBlockAt = (x, y) => {
  const cw = Math.max(canvasEl.value.clientWidth,  canvasEl.value.scrollWidth)
  const ch = Math.max(canvasEl.value.clientHeight, canvasEl.value.scrollHeight)
  const block = { id:newId(), x:Math.max(8, x-120), y:Math.max(8, y-60), w:240, h:MIN_H, text:'', z: nextZ(), manual:false }
  block.x = Math.min(block.x, cw - MIN_W)
  block.y = Math.min(block.y, ch - MIN_H)
  blocks.push(block)
  emitUpdate()
  return block
}

/* ===== SEÇİM ===== */
const selectId = ref(null)
const focusContent = async (id) => {
  hideCtxMenu(); caret.show = false; selectId.value = id; bringToFront(id)
  await nextTick()
  const ta = getTA(id); if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length }
}

/* ===== TEXTAREA ===== */
function onTAInput(b){
  autosize(b)
  emitUpdate()
}
function pastePlain(ev, b){
  ev.preventDefault()
  const txt = (ev.clipboardData?.getData('text') || '').replace(/\r\n/g, '\n')
  const ta = ev.target
  const start = ta.selectionStart, end = ta.selectionEnd
  ta.value = ta.value.slice(0,start) + txt + ta.value.slice(end)
  b.text = ta.value
  ta.selectionStart = ta.selectionEnd = start + txt.length
  autosize(b); emitUpdate()
}

/* ===== SAĞ TIK MENÜ ===== */
const ctxMenu = reactive({ show:false, x:0, y:0, blockId:null, justOpened:false })
const openCtxMenu = (e, b) => {
  const rect = canvasEl.value.getBoundingClientRect()
  const menuW = 200, menuH = 140
  let x = e.clientX - rect.left + canvasEl.value.scrollLeft
  let y = e.clientY - rect.top  + canvasEl.value.scrollTop
  if (x + menuW > canvasEl.value.scrollWidth)  x = canvasEl.value.scrollWidth  - menuW - 4
  if (y + menuH > canvasEl.value.scrollHeight) y = canvasEl.value.scrollHeight - menuH - 4
  Object.assign(ctxMenu, { show:true, x:Math.max(4,x), y:Math.max(4,y), blockId:b.id, justOpened:true })
  setTimeout(() => { ctxMenu.justOpened = false }, 0)
}
const hideCtxMenu = () => { ctxMenu.show = false; ctxMenu.blockId = null }
const deleteById = (id) => {
  const i = blocks.findIndex(x => x.id === id)
  if (i !== -1) { blocks.splice(i, 1); hideCtxMenu(); if (selectId.value === id) selectId.value = null; emitUpdate() }
}
const duplicateById = (id) => {
  const org = blocks.find(b => b.id === id); if (!org) return
  const copy = { ...JSON.parse(JSON.stringify(org)), id: newId(), x: org.x + 16, y: org.y + 16, z: nextZ(), manual: org.manual }
  blocks.push(copy); selectId.value = copy.id; hideCtxMenu(); emitUpdate()
}
const bringToFront = (id) => { const b = blocks.find(x => x.id === id); if (b) { b.z = nextZ(); emitUpdate() } }

/* Dış tık / ESC + canvas dışı tıkta caret gizle */
const onDocClick = (ev) => {
  if (!ctxMenu.show || ctxMenu.justOpened) {
    // caret: canvas dışına tıklanınca gizle
    if (canvasEl.value && !canvasEl.value.contains(ev.target)) caret.show = false
  }
  const menuEl = document.querySelector('.dropdown-menu.show')
  if (menuEl && menuEl.contains(ev.target)) return
  hideCtxMenu()
}
const onDocKey = (ev) => { if (ev.key === 'Escape') { hideCtxMenu(); caret.show = false } }
onMounted(() => {
  document.addEventListener('click', onDocClick, true)
  document.addEventListener('keydown', onDocKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true)
  document.removeEventListener('keydown', onDocKey)
})

/* ===== DRAG – header’dan ===== */
let drag = null
const startDragFromHeader = (e, b) => {
  if (e.button !== 0) return
  hideCtxMenu(); caret.show = false
  selectId.value = b.id; bringToFront(b.id)
  moveHintId.value = b.id
  drag = { b, startX:e.clientX, startY:e.clientY, ox:b.x, oy:b.y }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', endDrag)
}
const onDrag = (e) => {
  if (!drag) return
  const { b, startX, startY, ox, oy } = drag
  const dx = e.clientX - startX, dy = e.clientY - startY
  let nx = ox + dx, ny = oy + dy
  if (!e.altKey) { nx = snap(nx); ny = snap(ny) }
  b.x = nx; b.y = ny; clampInside(b)
}
const endDrag = () => {
  if (!drag) { moveHintId.value = null; return }
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
  drag = null
  moveHintId.value = null
  emitUpdate()
}

/* ===== RESIZE ===== */
let rez = null
const startResize = (e, b) => {
  hideCtxMenu(); caret.show = false
  selectId.value = b.id; bringToFront(b.id)
  rez = { b, startX:e.clientX, startY:e.clientY, ow:b.w, oh:b.h }
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', endResize)
}
const onResize = (e) => {
  if (!rez) return
  const { b, startX, startY, ow, oh } = rez
  const dx = e.clientX - startX, dy = e.clientY - startY
  let nw = Math.max(MIN_W, ow + dx)
  let nh = Math.max(MIN_H, oh + dy)
  if (!e.altKey) { nw = snap(nw); nh = snap(nh) }
  b.w = nw; b.h = nh; b.manual = true
  clampInside(b)
  syncTAtoBox(b)
}
const endResize = () => {
  if (!rez) return
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', endResize)
  rez = null; emitUpdate()
}

/* ===== FULLSCREEN / SEARCH ===== */
const toggleFullscreen = async () => {
  try {
    if (!document.fullscreenElement) { await rootEl.value.requestFullscreen(); isFullscreen.value = true }
    else { await document.exitFullscreen(); isFullscreen.value = false }
  } catch { alert('Tarayıcınız tam ekran isteğini reddetti.') }
}
const onSearch = () => alert('Arama şu an placeholder. İstersen içerikte arama/vurgulama ekleyebilirim.')
</script>

<style scoped>
.page-title { outline:none; }

/* Kanvas: artı scroll bar */
.editor-canvas {
  background:#fff;
  min-height:0;
  height:100%;
  overflow:auto;          /* 🔥 dikey/yatay scrollbar */
  padding-bottom: 200px;  /* alta çalışma alanı */
  user-select:none;
  cursor:text;
}

/* Boş alan caret'i */
.caret-ghost{
  position:absolute;
  width:2px;
  background:#6c757d;
  animation: caretBlink 1s steps(1) infinite;
  z-index:5;
  border-radius:1px;
  opacity:.9;
}
@keyframes caretBlink { 50% { opacity:0; } }

/* Not kutusu */
.note-box{
  box-sizing:border-box;
  border:1px solid transparent;
  border-radius:12px;
  box-shadow:0 1px 2px rgba(0,0,0,.06);
  transition:box-shadow .15s, border-color .15s;
}
.note-box:hover,
.note-box:focus-within{
  border-color:#cfd4da;
  box-shadow:0 8px 24px rgba(33,37,41,.08);
}

/* Header */
.box-header{
  position:relative;
  height:28px;
  background:linear-gradient(180deg,#f8f9fa,#f1f3f5);
  border-bottom:1px solid #e9ecef;
  border-top-left-radius:12px;
  border-top-right-radius:12px;
  user-select:none;
}

/* Basılıyken çıkan ikon */
.move-indicator{
  position:absolute;
  left:50%;
  top:50%;
  transform:translate(-50%,-50%);
  pointer-events:none;
  opacity:.85;
  font-size:14px;
}

/* TEXTAREA – autosize */
.note-content{
  display:block;
  width:100%;
  min-height:72px;
  height:auto;
  border:none;
  outline:none;
  background:transparent;
  resize:none;
  overflow:hidden;
  white-space:pre-wrap;
  word-break:break-word;
  font:inherit;
  line-height:1.4;
}

/* Sağ-alt köşe */
.resizer{
  position:absolute; right:6px; bottom:6px;
  width:16px; height:16px; border:none; border-radius:4px;
  background:
    linear-gradient(135deg, transparent 0 50%, #adb5bd 50% 52%, transparent 52% 100%),
    linear-gradient(135deg, transparent 0 70%, #ced4da 70% 72%, transparent 72% 100%);
  cursor:se-resize; opacity:.7;
}
.note-box:hover .resizer{ opacity:1; }
</style>
