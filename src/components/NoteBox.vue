<template>
  <div
    class="note-box position-absolute bg-white"
    :style="boxStyle"
    :data-id="id"
    @mousedown="bringToFront"
  >
    <!-- ÜST BAR (drag) -->
    <div class="box-header px-2">
      <div class="drag-handle" title="Taşı" @mousedown.stop="startDrag">
        <!-- <i class="bi bi-arrows-move"></i> -->
      </div>
    </div>

    <!-- İÇERİK (scroll bu sarmalayıcıda) -->
    <div class="note-body p-3">
      <div
        ref="editorEl"
        class="note-content"
        role="textbox"
        aria-multiline="true"
        :contenteditable="!locked"
        spellcheck="false" autocapitalize="off"
        tabindex="0"
        @focus="onEditorFocus"
        @blur="onEditorBlur"
        @mousedown.stop="onEditorDown"
        @click.stop="focusEditor"
        @contextmenu.prevent.stop="openMenu($event)"
        @input="onInput"
        @keydown.stop="onKeydown"
        @paste.prevent="onPastePlain"
      ></div>
    </div>

    <!-- Sağ-alt köşe – yeniden boyutlandırma -->
    <div class="resizer" @mousedown.stop="startResize" title="Yeniden boyutlandır"></div>

    <!-- SAĞ TIK MENÜ -->
    <teleport to="body">
      <div
        v-if="menu.show"
        ref="menuEl"
        class="rt-menu card shadow-sm"
        :style="{ left: menu.screen.x + 'px', top: menu.screen.y + 'px' }"
        @mousedown.stop
        @click.stop
      >
        <div class="card-body py-2">
          <div class="d-flex align-items-center flex-wrap gap-2">

            <!-- Yazı tipi -->
            <select class="form-select form-select-sm" style="width:auto" :disabled="locked"
                    v-model="fontFamily" @change="applyFontFamily">
              <option v-for="f in fonts" :key="f" :value="f">{{ f }}</option>
            </select>

            <!-- Yazı boyutu -->
            <select class="form-select form-select-sm" style="width:72px" :disabled="locked"
                    v-model.number="fontSizePx" @change="applyFontSize">
              <option v-for="s in fontSizesPx" :key="s" :value="s">{{ s }}</option>
            </select>

            <!-- Kalın / İtalik / Altı çizili -->
            <div class="btn-group">
              <button class="btn btn-sm btn-light" :disabled="locked" title="Kalın" @click="exec('bold')">
                <i class="bi bi-type-bold"></i>
              </button>
              <button class="btn btn-sm btn-light" :disabled="locked" title="İtalik" @click="exec('italic')">
                <i class="bi bi-type-italic"></i>
              </button>
              <button class="btn btn-sm btn-light" :disabled="locked" title="Altı çizili" @click="exec('underline')">
                <i class="bi bi-type-underline"></i>
              </button>
            </div>

            <!-- Yazı rengi -->
            <div class="dropdown">
              <button class="btn btn-sm btn-light dropdown-toggle" data-bs-toggle="dropdown"
                      :disabled="locked" title="Yazı rengi">
                <i class="bi bi-droplet-half"></i>
              </button>
              <div class="dropdown-menu p-2">
                <button v-for="c in textColors" :key="c"
                        class="color-swatch btn btn-sm me-1 mb-1"
                        :class="{ active: currentTextColor === c }"
                        :style="swatchStyle(c)"
                        @click="applyTextColor(c)">
                  <i v-if="currentTextColor === c" class="bi bi-check2"></i>
                </button>
              </div>
            </div>

            <!-- Metin vurgusu (Beyaz = iptal) -->
            <div class="dropdown">
              <button class="btn btn-sm btn-light dropdown-toggle" data-bs-toggle="dropdown"
                      :disabled="locked" title="Metin vurgusu">
                <i class="bi bi-highlighter"></i>
              </button>
              <div class="dropdown-menu p-2">
                <button v-for="c in highlightColors" :key="c"
                        class="color-swatch btn btn-sm me-1 mb-1"
                        :class="{ active: currentHighlightColor === c }"
                        :style="swatchStyle(c)"
                        @click="applyHighlight(c)">
                  <i v-if="currentHighlightColor === c" class="bi bi-check2"></i>
                </button>
              </div>
            </div>

            <!-- Madde işaretli liste -->
            <button class="btn btn-sm btn-light" :disabled="locked" title="Madde işaretli liste"
                    @click="exec('insertUnorderedList')">
              <i class="bi bi-list-ul"></i>
            </button>

            <!-- Numaralı liste + stil -->
            <div class="btn-group">
              <button class="btn btn-sm btn-light" :disabled="locked" title="Numaralı liste"
                      @click="toggleOrderedList">
                <i class="bi bi-list-ol"></i>
              </button>
              <button class="btn btn-sm btn-light dropdown-toggle dropdown-toggle-split" :disabled="locked"
                      data-bs-toggle="dropdown" aria-expanded="false" title="Numara stili seç">
                <span class="visually-hidden">Stil</span>
              </button>
              <ul class="dropdown-menu">
                <li><button class="dropdown-item" @click="setOrderedListStyle('decimal')">1, 2, 3</button></li>
                <li><button class="dropdown-item" @click="setOrderedListStyle('lower-alpha')">a, b, c</button></li>
                <li><button class="dropdown-item" @click="setOrderedListStyle('upper-alpha')">A, B, C</button></li>
                <li><button class="dropdown-item" @click="setOrderedListStyle('lower-roman')">i, ii, iii</button></li>
                <li><button class="dropdown-item" @click="setOrderedListStyle('upper-roman')">I, II, III</button></li>
              </ul>
            </div>

            <!-- Kutuyu sil -->
            <button class="btn btn-sm btn-outline-danger" title="Kutuyu sil" @click="$emit('delete', { id })">
              <i class="bi bi-trash"></i>
            </button>

          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  id: { type: String, required: true },
  x:  { type: Number, required: true },
  y:  { type: Number, required: true },
  w:  { type: Number, default: 240 },
  h:  { type: Number, default: 120 },
  z:  { type: Number, default: 1 },
  html: { type: String, default: '' },
  bgColor: { type: String, default: '#ffffff' },
  locked: { type: Boolean, default: false },
})
const emit = defineEmits([
  'update:position', 'update:size', 'update:z',
  'update:content', 'update:bg', 'update:locked',
  'duplicate', 'delete'
])

const GRID = 8, MIN_W = 160, MIN_H = 96
const editorEl = ref(null)
const menuEl   = ref(null)
const drag = ref({ active:false, sx:0, sy:0, ox:0, oy:0 })
const rez  = ref({ active:false, sx:0, sy:0, ow:0, oh:0 })
const menu = ref({ show:false, screen:{ x:0, y:0 } })

const fonts = ['Calibri',
  'Segoe UI',
  'Arial',
  'Tahoma',
  'Verdana',
  'Georgia',
  'Times New Roman',
  'Consolas',
  'Courier New']
const fontSizesPx = [11,12,14,16,18,24,26,28]
const fontFamily = ref(fonts[0])
const fontSizePx = ref(14)
const textColors = ['#000000','#343a40','#0d6efd','#198754','#dc3545','#fd7e14','#6f42c1']
const highlightColors = ['#ffffff','#fff3cd','#e2e3e5','#d1e7dd','#cfe2ff','#f8d7da'] // ilk: Beyaz = iptal
const currentTextColor = ref(null)
const currentHighlightColor = ref(null)
const swatchStyle = (c) => ({ background:c, border:'1px solid #dee2e6', width:'24px', height:'24px', position:'relative' })

const boxStyle = computed(() => ({
  left: props.x + 'px',
  top:  props.y + 'px',
  width:  Math.max(MIN_W, props.w) + 'px',
  height: Math.max(MIN_H, props.h) + 'px',
  zIndex: props.z,
  background: props.bgColor
}))

onMounted(() => {
  if (editorEl.value) editorEl.value.innerHTML = props.html || ''
  document.addEventListener('click', onDocClick, true)
  document.addEventListener('keydown', onDocKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true)
  document.removeEventListener('keydown', onDocKey)
  document.body.classList.remove('note-focused')
})

watch(() => props.html, (v) => {
  if (editorEl.value && editorEl.value.innerHTML !== v) editorEl.value.innerHTML = v || ''
})

function onInput(){ requestAnimationFrame(() => emit('update:content', { id: props.id, html: editorEl.value?.innerHTML || '' })) }

function onKeydown(e){
  // Shift+Enter: satır içi kırılma
  if (e.key === 'Enter' && e.shiftKey){ e.preventDefault(); insertHTML('<br>'); return }
  // Normal Enter: tarayıcıya bırak (yeni paragraf / li)
  if (e.ctrlKey || e.metaKey){
    const k = e.key.toLowerCase()
    if (k==='b'){ e.preventDefault(); exec('bold') }
    if (k==='i'){ e.preventDefault(); exec('italic') }
    if (k==='u'){ e.preventDefault(); exec('underline') }
  }
  if (e.key === 'Delete' && !menu.value.show) emit('delete', { id: props.id })
}

function onEditorFocus(){ document.body.classList.add('note-focused') }
function onEditorBlur(){ document.body.classList.remove('note-focused') }
function onEditorDown(){ bringToFront(); focusEditor() }
function focusEditor(){ editorEl.value?.focus() }

function exec(cmd, val=null){ if (!props.locked){ document.execCommand(cmd, false, val); onInput() } }
function applyFontFamily(){ exec('fontName', fontFamily.value) }
function applyFontSize(){ wrapInlineSpan({ fontSize: `${fontSizePx.value}px`, fontFamily: fontFamily.value }) }
function applyTextColor(c){ currentTextColor.value = c; wrapInlineSpan({ color: c }) }
function applyHighlight(c){
  currentHighlightColor.value = c
  if (c === '#ffffff'){ wrapInlineSpan({ backgroundColor: 'transparent' }); return onInput() }
  if (document.queryCommandSupported('hiliteColor')) exec('hiliteColor', c); else exec('backColor', c)
}
function wrapInlineSpan(styleObj){
  if (props.locked) return
  const sel = window.getSelection(); if (!sel || sel.rangeCount===0) return
  const range = sel.getRangeAt(0); if (!editorEl.value || !editorEl.value.contains(range.commonAncestorContainer)) return
  const span = document.createElement('span'); Object.assign(span.style, styleObj)
  try{ range.surroundContents(span) }catch{ const frag = range.extractContents(); span.appendChild(frag); range.insertNode(span) }
  sel.removeAllRanges(); sel.addRange(range); onInput()
}

function toggleOrderedList(){ exec('insertOrderedList') }
function setOrderedListStyle(style){
  let ol = closestList('OL')
  if (!ol){ exec('insertOrderedList'); ol = closestList('OL') }
  if (ol){ ol.style.listStyleType = style; onInput() }
}
function closestList(tag){
  const sel = window.getSelection(); if (!sel || sel.rangeCount===0) return null
  let n = sel.anchorNode; if (n && n.nodeType===Node.TEXT_NODE) n = n.parentElement
  while (n && n !== editorEl.value){ if (n.tagName===tag) return n; n = n.parentElement }
  return null
}

function onPastePlain(e){
  if (props.locked) return
  const txt = (e.clipboardData?.getData('text') || '').replace(/\r\n/g, '\n')
  const safe = txt.replace(/[&<>]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[s]))
  insertHTML(safe.replace(/\n/g,'<br>'))
}
function insertHTML(html){ document.execCommand('insertHTML', false, html); onInput() }

async function openMenu(e){
  const boxRect = e.currentTarget.closest('.note-box').getBoundingClientRect()
  const vpW = window.innerWidth, vpH = window.innerHeight
  const GAP = 8, EST_W = 380, EST_H = 96
  let x = boxRect.right + GAP
  let y = Math.min(Math.max(boxRect.top, e.clientY - 40), vpH - EST_H - GAP)
  if (x + EST_W > vpW) x = boxRect.left - EST_W - GAP
  if (x < GAP){ x = Math.min(Math.max(boxRect.left, e.clientX - EST_W/2), vpW - EST_W - GAP); y = boxRect.bottom + GAP }
  menu.value = { show:true, screen:{ x: Math.max(GAP,x), y: Math.max(GAP,y) } }
  await nextTick()
  const realW = menuEl.value?.offsetWidth ?? EST_W
  const realH = menuEl.value?.offsetHeight ?? EST_H
  let rx = menu.value.screen.x, ry = menu.value.screen.y
  if (rx + realW > vpW - GAP) rx = vpW - realW - GAP
  if (ry + realH > vpH - GAP) ry = vpH - realH - GAP
  menu.value.screen = { x: rx, y: ry }
}
function onDocClick(ev){ if (!ev.target.closest('.rt-menu')) menu.value.show = false }
function onDocKey(ev){ if (ev.key==='Escape') menu.value.show = false }

/* DRAG */
function startDrag(e){
  if (e.button!==0) return
  menu.value.show=false
  drag.value = { active:true, sx:e.clientX, sy:e.clientY, ox:props.x, oy:props.y }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', endDrag)
  document.body.classList.add('nb-dragging')
}
function onDrag(e){
  if (!drag.value.active) return
  const dx = e.clientX - drag.value.sx, dy = e.clientY - drag.value.sy
  let nx = drag.value.ox + dx, ny = drag.value.oy + dy
  if (!e.altKey){ nx = snap(nx); ny = snap(ny) }
  emit('update:position', { id: props.id, x:nx, y:ny })
}
function endDrag(){
  if (!drag.value.active) return
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
  drag.value.active = false
  document.body.classList.remove('nb-dragging')
}

/* RESIZE */
function startResize(e){
  menu.value.show=false
  rez.value = { active:true, sx:e.clientX, sy:e.clientY, ow:props.w, oh:props.h }
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', endResize)
}
function onResize(e){
  if (!rez.value.active) return
  const dx = e.clientX - rez.value.sx, dy = e.clientY - rez.value.sy
  let nw = Math.max(MIN_W, rez.value.ow + dx), nh = Math.max(MIN_H, rez.value.oh + dy)
  if (!e.altKey){ nw = snap(nw); nh = snap(nh) }
  emit('update:size', { id: props.id, w:nw, h:nh })
}
function endResize(){
  if (!rez.value.active) return
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', endResize)
  rez.value.active = false
}

function snap(v){ return Math.round(v / GRID) * GRID }
function bringToFront(){ emit('update:z', { id: props.id }) }
</script>

<style scoped>
/* Kutu taşmasını kes */
.note-box{ overflow:hidden; box-sizing:border-box; border:1px solid transparent; border-radius:12px; box-shadow:0 1px 2px rgba(0,0,0,.06); transition:box-shadow .15s, border-color .15s; }
.note-box:hover, .note-box:focus-within{ border-color:#cfd4da; box-shadow:0 8px 24px rgba(33,37,41,.08); }

/* Header */
.box-header{ position:relative; height:28px; background:linear-gradient(180deg,#f8f9fa,#f1f3f5); border-bottom:1px solid #e9ecef; border-top-left-radius:12px; border-top-right-radius:12px; user-select:none; }

/* Drag bar */
.drag-handle{ position:absolute; top:6px; left:50%; transform:translateX(-50%); display:flex; align-items:center; justify-content:center; height:18px; min-width:44px; padding:0 10px; border-radius:9999px; background:linear-gradient(180deg,#f1f3f5,#e9ecef); border:1px solid #dee2e6; box-shadow:0 1px 2px rgba(0,0,0,.04) inset; cursor:grab; user-select:none; }
.drag-handle:active{ cursor:grabbing; }
.drag-handle, .drag-handle:active { cursor: move !important; }

/* İç alan: kutu yüksekliği - header */
.note-body{ height:calc(100% - 28px); overflow:auto; }

/* İçerik: metin taşmasını kır, min-height tüm alan */
.note-content{
  min-height:100%;
  width:100%;
  outline:none;
  background:transparent;
  white-space:pre-wrap;
  word-break:break-word;
  overflow-wrap:anywhere;
  font:inherit; line-height:1.4;
  user-select:text; cursor:text;
}

/* Sağ-alt köşe – resize */
.resizer{ position:absolute; right:6px; bottom:6px; width:16px; height:16px; border:none; border-radius:4px;
  background: linear-gradient(135deg, transparent 0 50%, #adb5bd 50% 52%, transparent 52% 100%),
              linear-gradient(135deg, transparent 0 70%, #ced4da 70% 72%, transparent 72% 100%);
  cursor:se-resize; opacity:.7; }
.note-box:hover .resizer{ opacity:1; }

/* Menü */
.rt-menu{ position:fixed; min-width:360px; max-width:520px; border-radius:.5rem; z-index:9999; }

/* Renk swatch aktif görünümü */
.color-swatch.active{ outline:2px solid #0d6efd; outline-offset:1px; }
.color-swatch i{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:14px; color:#0d6efd; }
</style>

<!-- Not odaktayken dış caret-ghost’u gizle -->
<style>
body.note-focused .caret-ghost{ display:none !important; }
body.nb-dragging,
body.nb-dragging * { cursor: move !important; }

</style>
