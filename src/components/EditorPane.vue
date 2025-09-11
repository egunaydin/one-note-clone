<template>
  <div class="editor-root d-flex flex-column h-100 border-start" ref="rootEl">
   
    <div v-if="noPageWarn" class="add-page-toast alert alert-warning py-2 px-3 small shadow-sm center">
      Lütfen sayfa ekleyin !!!
    </div>


    <div class="editor-header d-flex align-items-center justify-content-between px-3 pt-3">
      <div
        ref="titleEl"
        class="page-title fw-bold fs-4"
        :contenteditable="!!pageExists"
        :data-placeholder="pageExists ? 'Adsız sayfa' : ''"
        @mousedown.stop="onTitleMouseDown"
        @input="onTitleInput"
        @focus="onTitleFocus"
        @keydown.enter.prevent
      ></div>

      <div class="d-flex align-items-center gap-2">
      
        <button
          class="btn btn-light btn-sm"
          :disabled="!pageExists || !blocks.length"
          @click="purgeState.show = true"
          title="Bu sayfadaki tüm not kutularını sil"
        >
          <i class="bi bi-trash"></i>
        </button>

        <button class="btn btn-light btn-sm" @click="searchOpen = true" title="Tüm sayfalarda ara (Ctrl+K)">
          <i class="bi bi-search"></i>
        </button>
      </div>
    </div>

    <div class="px-3" v-if="pageExists">
      <hr class="my-2" />
      <div class="text-muted small d-flex justify-content-between align-items-center">
        <span>
          <button v-if="!isEditingDate" class="btn btn-link p-0 text-muted text-decoration-none" @click="startEditDate">
            {{ dateDisplay || 'tarih yok' }}
          </button>
          <input
            v-else
            type="date"
            class="form-control form-control-sm d-inline-block"
            style="max-width:210px"
            v-model="dateISO"
            @keydown.enter.prevent="stopEditDate(true)"
            @keydown.esc.prevent="stopEditDate(false)"
            @blur="stopEditDate(true)"
          />
        </span>

        <span>
          <button v-if="!isEditingTime" class="btn btn-link p-0 text-muted text-decoration-none" @click="startEditTime">
            {{ timeDisplay || 'saat yok' }}
          </button>
          <input
            v-else
            type="time"
            class="form-control form-control-sm d-inline-block"
            style="max-width:120px"
            v-model="timeHM"
            step="60"
            @keydown.enter.prevent="stopEditTime(true)"
            @keydown.esc.prevent="stopEditTime(false)"
            @blur="stopEditTime(true)"
          />
        </span>
      </div>
    </div>

    
    <div
      class="editor-canvas position-relative flex-grow-1"
      ref="canvasEl"
      tabindex="0"
      @click="onCanvasClick"
      @mousemove="rememberPointer"
      @keydown="handleCanvasKeydown"
      @contextmenu.prevent
    >
      <div class="position-relative" :style="{ width: canvasW + 'px', height: canvasH + 'px' }">
        <div
          v-if="caret.show"
          class="caret-ghost"
          :style="{ left: caret.x + 'px', top: caret.y + 'px', height: caret.h + 'px' }"
        ></div>

        <NoteBox
          v-for="b in blocks"
          :key="b.id"
          :id="b.id"
          :x="b.x" :y="b.y" :w="b.w" :h="b.h" :z="b.z"
          :html="b.html" :bg-color="b.bgColor || '#ffffff'" :locked="!!b.locked"
          @update:position="onBoxMove"
          @update:size="onBoxResize"
          @update:z="onBoxBringFront"
          @update:content="onBoxContent"
          @update:bg="onBoxBg"
          @update:locked="onBoxLocked"
          @duplicate="onBoxDuplicate"
          @delete="onBoxDelete"
        />
      </div>
    </div>

    <Search
      :open="searchOpen"
      :pages="pagesForSearch"
      :current-page-id="props.page?.id || ''"
      @close="searchOpen = false"
      @open-locate="onSearchLocate"
    />

    
    <div v-if="purgeState.show" class="modal fade show" style="display:block;" role="dialog" aria-modal="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow-lg border-0 rounded-3">
          <div class="modal-header">
            <h5 class="modal-title">Tüm not kutularını sil</h5>
            <button type="button" class="btn-close" @click="cancelPurge" aria-label="Kapat"></button>
          </div>
          <div class="modal-body">
            Bu sayfadaki <strong>{{ blocks.length }}</strong> not kutusunu kalıcı olarak silmek istediğinize emin misiniz?
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="cancelPurge">İptal</button>
            <button class="btn btn-danger" @click="confirmPurge">
              <i class="bi bi-trash me-1"></i> Tümünü Sil
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="purgeState.show" class="modal-backdrop fade show" @click="cancelPurge"></div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import Search  from './Search.vue'
import NoteBox from './NoteBox.vue'

const props = defineProps({
  page:  { type: Object, default: null },
  pages: { type: Array,  default: () => [] }
})
const emit  = defineEmits(['update-page','open-page'])

const GRID = 8
const MIN_W = 160, MIN_H = 120
const GROW_PAD = 320

const rootEl   = ref(null)
const canvasEl = ref(null)
const titleEl  = ref(null)
const pageTitle = ref('Başlıksız Sayfa')
const blocks = reactive([])
const caret  = reactive({ show:false, x:200, y:160, h:22 })
const pageExists = computed(() => !!props.page)

const undoStack = ref([])   // [{type:'delete', item, index}] veya {type:'purge', items}]
const redoStack = ref([])
watch(() => props.page?.id, () => {  // sayfa değişince geçmişi sıfırla
  undoStack.value = []
  redoStack.value = []
})


const noPageWarn = ref(false)
let noPageWarnT = null
function showNoPageWarning () {
  clearTimeout(noPageWarnT)
  noPageWarn.value = true
  noPageWarnT = setTimeout(() => (noPageWarn.value = false), 1600)
}


const canvasW = computed(() => {
  const base = canvasEl.value ? canvasEl.value.clientWidth : 0
  const maxRight = Math.max(0, ...blocks.map(b => b.x + Math.max(MIN_W, b.w)))
  return Math.max(base, maxRight) + GROW_PAD
})
const canvasH = computed(() => {
  const base = canvasEl.value ? canvasEl.value.clientHeight : 0
  const maxBottom = Math.max(0, ...blocks.map(b => b.y + Math.max(MIN_H, b.h)))
  return Math.max(base, maxBottom) + GROW_PAD
})


const dateISO = ref(''), timeHM  = ref('')
const isEditingDate = ref(false), isEditingTime = ref(false)
const prevDateISO = ref(''), prevTimeHM  = ref('')

const dateDisplay = computed(() =>
  dateISO.value
    ? new Date(`${dateISO.value}T00:00:00`).toLocaleDateString('tr-TR',
        {day:'2-digit',month:'long',year:'numeric',weekday:'long'})
    : ''
)
const timeDisplay  = computed(() => timeHM.value || '')

const searchOpen = ref(false)
const pagesForSearch = computed(() =>
  (props.pages?.length ? props.pages : (props.page ? [props.page] : [])).filter(Boolean)
)


const purgeState = ref({ show:false })
function cancelPurge(){ purgeState.value.show = false }
function confirmPurge(){

  if (blocks.length){
    const snapshot = blocks.map(b => JSON.parse(JSON.stringify(b)))
    undoStack.value.push({ type:'purge', items: snapshot })
    redoStack.value = []
  }
  blocks.splice(0, blocks.length)
  emitUpdate()
  caret.show = false
  purgeState.value.show = false
}

function undo(){
  const act = undoStack.value.pop()
  if (!act) return
  if (act.type === 'delete'){
    const idx = Math.min(act.index, blocks.length)
    blocks.splice(idx, 0, act.item)
    emitUpdate()
  } else if (act.type === 'purge'){
    blocks.splice(0, blocks.length, ...act.items)
    emitUpdate()
  }
  redoStack.value.push(act)
}
function redo(){
  const act = redoStack.value.pop()
  if (!act) return
  if (act.type === 'delete'){
    const i = blocks.findIndex(b => b.id === act.item.id)
    if (i !== -1) blocks.splice(i,1)
    emitUpdate()
  } else if (act.type === 'purge'){
    blocks.splice(0, blocks.length)
    emitUpdate()
  }
  undoStack.value.push(act)
}

function onGlobalKey(e){
  
  if (purgeState.value.show && (e.key === 'Escape' || e.key === 'Esc')){
    e.preventDefault()
    cancelPurge()
    return
  }

  const ae = document.activeElement
  const editing = ae && (ae.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(ae.tagName))

  
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !editing){
    e.preventDefault()
    undo()
    return
  }
  if ((e.ctrlKey || e.metaKey) &&
      ((e.shiftKey && e.key.toLowerCase()==='z') || e.key.toLowerCase()==='y') &&
      !editing){
    e.preventDefault()
    redo()
    return
  }


    const k = (e.key || '').toLowerCase()
  if ((e.ctrlKey || e.metaKey) && k==='k'){
    e.preventDefault()
    if (!searchOpen.value) searchOpen.value = true   // sadece AÇ
  }
}
onMounted(() => window.addEventListener('keydown', onGlobalKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey))

const loadFromProps = async () => {
  if (!props.page){
    pageTitle.value = 'Başlıksız Sayfa'
    blocks.splice(0)
    const n=new Date()
    dateISO.value = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
    timeHM.value  = `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`
    await nextTick()
    if (titleEl.value) titleEl.value.textContent = ''   // sayfa yokken başlığı boş göster
    return
  }

  pageTitle.value = props.page.title || ''
  const n = new Date()
  dateISO.value = props.page.dateISO || `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
  timeHM.value  = props.page.timeHM  || `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`

  let incoming = []
  if (Array.isArray(props.page.blocks)) incoming = props.page.blocks
  else if (typeof props.page.content === 'string'){
    try{ const parsed = JSON.parse(props.page.content); if (Array.isArray(parsed)) incoming = parsed }catch{}
  }

  blocks.splice(0, blocks.length, ...incoming.map(b => (({
      id: b.id || newId(),
      x: b.x ?? 8, y: b.y ?? 8,
      w: Math.max(MIN_W, b.w ?? 240),
      h: Math.max(MIN_H, b.h ?? 120),
      z: b.z ?? 1,
      html: typeof b.html === 'string' ? b.html : (typeof b.text==='string' ? b.text.replace(/\r?\n/g,'<br>') : ''),
      bgColor: b.bgColor || '#ffffff',
      locked: !!b.locked
    }))))

  await nextTick()
  if (titleEl.value) titleEl.value.textContent = pageTitle.value   // BAŞLIK GÖRÜNSÜN
}
watch(() => props.page?.id, () => { purgeState.value.show = false; loadFromProps() })
onMounted(loadFromProps)


let deb = null
function emitUpdate(){
  if (!props.page) return
  clearTimeout(deb)
  deb = setTimeout(() => {
    const outBlocks = blocks.map(b => ({
      id:b.id, x:b.x, y:b.y, w:b.w, h:b.h, z:b.z,
      html:b.html, bgColor:b.bgColor, locked:!!b.locked
    }))
    emit('update-page', {
      id: props.page.id,
      title: (pageTitle.value || '').trim(),
      dateISO: dateISO.value,
      timeHM: timeHM.value,
      content: JSON.stringify(outBlocks),
      blocks: outBlocks
    })
  }, 80)
}

function placeTitleCaretEnd(){
  if (!pageExists.value) return
  const el = titleEl.value
  if (!el) return
  const sel = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
  el.focus()
}
const onTitleInput = (e) => {
  if (!pageExists.value) return
  const txt = (e.target.innerText || '').slice(0, 160)
  pageTitle.value = txt
  emitUpdate()
}
const titleMouseDown = ref(false)
function onTitleMouseDown(){
  titleMouseDown.value = true
  requestAnimationFrame(() => { titleMouseDown.value = false })
}
function onTitleFocus(){
  if (titleMouseDown.value) return
  const el = titleEl.value; if (!el) return
  const sel = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

function startEditDate(){
  if (!pageExists.value) return
  prevDateISO.value = dateISO.value
  isEditingDate.value = true
  nextTick(() => { rootEl.value?.querySelector('input[type="date"]')?.focus() })
}
function stopEditDate(commit){
  if (!pageExists.value) return
  const isIso = (s) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s)
  if (!commit)      dateISO.value = prevDateISO.value
  else if (!isIso(dateISO.value)) dateISO.value = prevDateISO.value
  isEditingDate.value = false
  emitUpdate()
}
function startEditTime(){
  if (!pageExists.value) return
  prevTimeHM.value = timeHM.value
  isEditingTime.value = true
  nextTick(() => { rootEl.value?.querySelector('input[type="time"]')?.focus() })
}
function stopEditTime(commit){
  if (!pageExists.value) return
  const isHM = (s) => !s || /^([01]\d|2[0-3]):([0-5]\d)$/.test(s)
  if (!commit)        timeHM.value = prevTimeHM.value
  else if (!isHM(timeHM.value)) timeHM.value = prevTimeHM.value
  isEditingTime.value = false
  emitUpdate()
}

const pointer = ref({ x:220, y:180 })
function rememberPointer(e){
  const r = canvasEl.value.getBoundingClientRect()
  pointer.value = {
    x: e.clientX - r.left + canvasEl.value.scrollLeft,
    y: e.clientY - r.top  + canvasEl.value.scrollTop
  }
}
async function onCanvasClick(e){
  if (!props.page) { showNoPageWarning(); return }
  if (e.target?.closest && e.target.closest('.note-box')) return
  rememberPointer(e)
  caret.x = snap(pointer.value.x)
  caret.y = snap(pointer.value.y)
  caret.show = true
  canvasEl.value?.focus()
}
async function onCanvasDblClick(e){
  if (!props.page) return
  rememberPointer(e)
  caret.x = snap(pointer.value.x)
  caret.y = snap(pointer.value.y)
  const b = createBlockAt(caret.x, caret.y)
  caret.show = false
  await nextTick()
  await alignBlockContentToCaret(b.id)
  focusEditorEndStubborn(b.id)
}
async function handleCanvasKeydown(e){
  if (!props.page) return
  if (document.activeElement !== canvasEl.value) return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const isChar = e.key?.length===1, isEnter = e.key==='Enter'
  if (!isChar && !isEnter) return
  e.preventDefault()
  caret.show = false
  const b = createBlockAt(caret.x, caret.y)
  await nextTick()
  await alignBlockContentToCaret(b.id)
  if (isChar) b.html = (b.html || '') + escapeHtml(e.key)
  else if (isEnter) b.html = (b.html || '') + '<br>'
  emitUpdate()
  await nextTick()
  focusEditorEndStubborn(b.id)
}

function onBoxMove({id,x,y}){ const b=find(id); if(!b) return; b.x=x; b.y=y; clampInside(b); emitUpdate() }
function onBoxResize({id,w,h}){ const b=find(id); if(!b) return; b.w=Math.max(MIN_W,w); b.h=Math.max(MIN_H,h); clampInside(b); emitUpdate() }
function onBoxBringFront({id}){ const b=find(id); if(!b) return; b.z=nextZ(); emitUpdate() }
function onBoxContent({id,html}){ const b=find(id); if(!b) return; b.html=html||''; emitUpdate() }
function onBoxBg({id,color}){ const b=find(id); if(!b) return; b.bgColor=color||'#fff'; emitUpdate() }
function onBoxLocked({id,locked}){ const b=find(id); if(!b) return; b.locked=!!locked; emitUpdate() }
function onBoxDuplicate({id}){ const org=find(id); if(!org) return; const copy={...JSON.parse(JSON.stringify(org)), id:newId(), x:org.x+16, y:org.y+16, z:nextZ()}; blocks.push(copy); emitUpdate() }
function onBoxDelete({id}){
  const i = blocks.findIndex(x => x.id===id)
  if (i !== -1) {
    const removed = JSON.parse(JSON.stringify(blocks[i]))
    undoStack.value.push({ type:'delete', item: removed, index: i })
    redoStack.value = []
    blocks.splice(i,1)
    emitUpdate()
  }
}


function onSearchLocate({ pageId, noteId }){
  searchOpen.value = false
  if (!props.page || props.page.id !== pageId){ emit('open-page', pageId); return }
  highlightLocal(noteId)
}
function highlightLocal(id){
  const box = canvasEl.value?.querySelector(`.note-box[data-id="${id}"]`)
  if (!box) return
  const rect = box.getBoundingClientRect()
  const cont = canvasEl.value
  const needY = rect.top < 0 || rect.bottom > (window.innerHeight || cont.clientHeight)
  if (needY) cont.scrollTop = box.offsetTop - 24
  box.classList.add('search-hit')
  setTimeout(() => box.classList.remove('search-hit'), 1200)
}

const newId = () => 'b_' + Math.random().toString(36).slice(2,9)
const find  = (id) => blocks.find(b => b.id===id)
const snap  = v => Math.round(v/GRID)*GRID
const nextZ = () => Math.max(1, ...blocks.map(b=>b.z??1)) + 1
function clampInside(b){ b.x = Math.max(0,b.x); b.y = Math.max(0,b.y) }
const escapeHtml = s => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))


async function alignBlockContentToCaret(id){
  await nextTick()
  const box = canvasEl.value?.querySelector(`.note-box[data-id="${id}"]`)
  const content = box?.querySelector('.note-content')
  if (!box || !content) return
  const boxRect = box.getBoundingClientRect()
  const contentRect = content.getBoundingClientRect()
  const dx = contentRect.left - boxRect.left
  const dy = contentRect.top  - boxRect.top
  const b = find(id); if (!b) return
  b.x = snap(Math.max(8, caret.x - dx))
  b.y = snap(Math.max(8, caret.y - dy))
  clampInside(b)
  emitUpdate()
}


function focusEditorEndStubborn(id){
  const el = canvasEl.value?.querySelector(`.note-box[data-id="${id}"] .note-content`)
  if (!el) return
  const placeEnd = () => {
    try{
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      el.focus()
    }catch{}
  }
  placeEnd()
  requestAnimationFrame(() => { placeEnd(); requestAnimationFrame(placeEnd) })
  setTimeout(placeEnd, 0)
}

function createBlockAt(x, y){
  const block = {
    id: newId(),
    x: snap(Math.max(8, x)),
    y: snap(Math.max(8, y)),
    w: 240,
    h: 120,
    z: nextZ(),
    html: '',
    bgColor: '#ffffff',
    locked: false
  }
  blocks.push(block); emitUpdate(); return block
}
</script>

<style scoped>
.editor-root { min-height: 0; overflow: hidden; }
.editor-header { min-height: 56px; }
.page-title{ outline:none; min-height:2.25rem; display:block; }
.page-title[contenteditable="true"]:empty:before{ content: attr(data-placeholder); color:#6c757d; }

.editor-canvas{
  background:#fff; min-height:0; height:100%; overflow:auto;
  padding-bottom:200px; user-select:none; cursor:text;
}

.caret-ghost{ position:absolute; width:2px; background:#6c757d; animation: caretBlink 1s steps(1) infinite; z-index:5; border-radius:1px; opacity:.9; }
@keyframes caretBlink { 50% { opacity:0 } }

:deep(.note-box.search-hit){
  box-shadow: 0 0 0 3px rgba(255,193,7,.6) inset, 0 8px 24px rgba(33,37,41,.12) !important;
  transition: box-shadow .25s;
}

.modal { z-index: 2050; }
.modal-backdrop { z-index: 2040; }


.editor-root { position: relative; }
.add-page-toast{
  position: absolute;
  z-index: 2060;
  border-radius: .5rem;
  pointer-events: none;
  max-width: 70%;
  text-align: center;
}
.add-page-toast.center{
  top: 15%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.add-page-toast.alert{
  --bs-alert-bg: #e01818;
  --bs-alert-border-color: #d31f1f;
  --bs-alert-color: #ffffff;
}
</style>

<style>
body.note-focused .caret-ghost{ display:none !important; }
body.nb-dragging, body.nb-dragging * { cursor: move !important; }

</style>  
