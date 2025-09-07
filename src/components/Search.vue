<template> 
  <div v-if="open" class="search-overlay" @click.self="$emit('close')">
    <div class="search-panel shadow-lg">
      <!-- Header -->
      <div class="d-flex align-items-center gap-2 p-3 border-bottom bg-white sticky-top">
        <i class="bi bi-search fs-5"></i>
        <input
          ref="inputEl"
          v-model.trim="q"
          type="search"
          class="form-control form-control-sm"
          :placeholder="placeholder"
          @keydown.enter.prevent="openFirst"
        />
        <button class="btn btn-sm btn-outline-secondary" @click="$emit('close')">Kapat</button>
      </div>

      <div class="px-3 pt-2 text-muted small">
        <div v-if="!q"></div>
        <div v-else-if="totalCount===0">Sonuç bulunamadı.</div>
        <div v-else>{{ totalCount }} sonuç ({{ grouped.length }} sayfa, {{ sectionResults.length }} bölüm).</div>
      </div>

      <!-- BÖLÜM ADI SONUÇLARI -->
      <div v-if="sectionResults.length" class="mt-2">
        <div class="px-3 py-2 bg-light border-top border-bottom small fw-semibold sticky-sub">
          <i class="bi bi-folder2-open me-1"></i> Bölüm adları
        </div>
        <div class="list-group list-group-flush">
          <button
            v-for="s in sectionResults"
            :key="s.noteId"
            class="list-group-item list-group-item-action"
            @click="openSection(s.noteId)"
          >
            <div class="d-flex justify-content-between align-items-center">
              <div class="fw-semibold">{{ s.sectionName }}</div>
              <span class="badge bg-warning-subtle text-warning">bölüm</span>
            </div>
            <div class="mt-1 small text-secondary" v-html="s.snippet"></div>
          </button>
        </div>
      </div>

      <!-- SAYFA SONUÇLARI -->
      <div class="results">
        <div v-for="g in grouped" :key="g.pageId" class="mb-3">
          <div class="px-3 py-2 bg-light border-top border-bottom small fw-semibold sticky-sub">
            <i class="bi bi-journal-text me-1"></i>
            {{ g.pageTitle || 'Adsız sayfa' }}
            <span v-if="g.sectionName" class="text-muted"> • {{ g.sectionName }}</span>
            <span v-if="g.pageId===currentPageId" class="badge bg-secondary ms-2">bu sayfa</span>
          </div>

          <div class="list-group list-group-flush">
            <!-- Başlık -->
            <button
              v-if="g.titleHit"
              class="list-group-item list-group-item-action"
              @click="openTitle(g.pageId)"
            >
              <div class="d-flex justify-content-between align-items-center">
                <div class="fw-semibold"><i class="bi bi-type me-1"></i> Başlıkta eşleşme</div>
                <span class="badge bg-light text-dark">başlık</span>
              </div>
              <div class="mt-1 small text-secondary" v-html="g.titleHit.snippet"></div>
            </button>

            <!-- TARİH -->
            <button
              v-for="r in g.dateHits"
              :key="'date-'+r.id+'-'+r.matchAt"
              class="list-group-item list-group-item-action"
              @click="openTitle(g.pageId)"
            >
              <div class="d-flex justify-content-between align-items-center">
                <div class="fw-semibold"><i class="bi bi-calendar3 me-1"></i> Tarihte eşleşme</div>
                <span class="badge bg-success-subtle text-success">tarih</span>
              </div>
              <div class="mt-1 small text-secondary" v-html="r.snippet"></div>
            </button>

            <!-- SAAT -->
            <button
              v-for="r in g.timeHits"
              :key="'time-'+r.id+'-'+r.matchAt"
              class="list-group-item list-group-item-action"
              @click="openTitle(g.pageId)"
            >
              <div class="d-flex justify-content-between align-items-center">
                <div class="fw-semibold"><i class="bi bi-clock me-1"></i> Saatte eşleşme</div>
                <span class="badge bg-info-subtle text-info">saat</span>
              </div>
              <div class="mt-1 small text-secondary" v-html="r.snippet"></div>
            </button>

            <!-- Not içerikleri -->
            <button
              v-for="r in g.bodyHits"
              :key="'body-'+r.id+'-'+r.matchAt"
              class="list-group-item list-group-item-action"
              @click="openNote(g.pageId, r.id)"
            >
              <div class="d-flex justify-content-between">
                <div class="fw-semibold"><i class="bi bi-sticky me-1"></i> Not</div>
                <span class="badge bg-primary-subtle text-primary">içerik</span>
              </div>
              <div class="mt-1 small text-secondary" v-html="r.snippet"></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  pages: { type: Array, default: () => [] },
  currentPageId: { type: String, default: '' }
})
const emit = defineEmits(['close','open-locate'])

const inputEl = ref(null)
const q = ref('')
const placeholder = 'Tüm sayfalarda ara…'

watch(() => props.open, async v => {
  if (v) { await nextTick(); inputEl.value?.focus() } else { q.value = '' }
})

/* ---- ÇİFT TETİK ÖNLEYİCİ: Panel açıkken Ctrl/Cmd+K ve ESC = KAPAT ---- */
function hotkeysWhenOpen(e){
  if (!props.open) return
  const key = (e.key || '').toLowerCase()

  // Ctrl/Cmd + K -> kapat
  if ((e.ctrlKey || e.metaKey) && key === 'k'){
    e.preventDefault()
    e.stopImmediatePropagation()
    emit('close')
    return
  }
  // Escape -> kapat
  if (key === 'escape'){
    e.preventDefault()
    e.stopImmediatePropagation()
    emit('close')
  }
}
onMounted(() => document.addEventListener('keydown', hotkeysWhenOpen, true))   // capture
onBeforeUnmount(() => document.removeEventListener('keydown', hotkeysWhenOpen, true))

/* ----------------- (devamı aynı) yardımcılar & arama mantığı ----------------- */
const escHtml = (s='') => s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))
function stripHtml(html=''){ const d=document.createElement('div'); d.innerHTML=html; return d.textContent||d.innerText||'' }
function normalizeTr(str=''){ return str.toLowerCase('tr-TR').replace(/\s+/g,' ').trim() }
function extractBlocks(page){
  let blocks = []
  if (Array.isArray(page.blocks)) blocks = page.blocks
  else if (typeof page.content === 'string'){
    try{ const parsed = JSON.parse(page.content); if (Array.isArray(parsed)) blocks = parsed }catch{}
  }
  return blocks
}
function toDateSafe(iso=''){ if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null; const d=new Date(`${iso}T00:00:00`); return isNaN(d.getTime())?null:d }
function ddmmyyyyDots(iso=''){ const m=iso.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m?`${m[3]}.${m[2]}.${m[1]}`:'' }
function ddmmyyyySlashes(iso=''){ const m=iso.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m?`${m[3]}/${m[2]}/${m[1]}`:'' }

const sections = computed(() => {
  const map = new Map()
  for (const p of props.pages || []) {
    if (p.noteId && (p.noteName || p.noteName === '')) {
      if (!map.has(p.noteId)) map.set(p.noteId, String(p.noteName || 'Adsız bölüm'))
    }
  }
  return Array.from(map, ([noteId, sectionName]) => ({ noteId, sectionName }))
})

function parseQuery(s=''){
  s = s.trim()
  if (!s) return { type:'empty' }
  const m = s.match(/^"(.*)"$/)
  if (m) return { type:'phrase', phrase: normalizeTr(m[1]) }
  const terms = normalizeTr(s).split(' ').filter(Boolean)
  return terms.length ? { type:'and', terms } : { type:'empty' }
}
function buildSnippet(raw, norm, at, len, pad=42){
  const safe = escHtml(raw)
  const start = Math.max(0, at - pad)
  const end   = Math.min(norm.length, at + len + pad)
  const before = safe.slice(start, Math.max(start, start + (at - start)))
  const mid    = safe.slice(Math.max(start, start + (at - start)),
                            Math.max(start, start + (at - start) + len))
  const after  = safe.slice(Math.max(start, start + (at - start) + len), end)
  return `${start>0?'…':''}${before}<mark>${mid}</mark>${after}${end<safe.length?'…':''}`
}

const sectionResults = computed(() => {
  const p = parseQuery(q.value)
  if (p.type === 'empty') return []
  const hits = []
  for (const s of sections.value) {
    const raw = s.sectionName
    const norm = normalizeTr(raw)
    if (p.type === 'phrase') {
      const at = norm.indexOf(p.phrase)
      if (at >= 0) hits.push({ ...s, snippet: buildSnippet(raw, norm, at, p.phrase.length) })
    } else {
      let ok = true; const tpos=[]
      for (const t of p.terms){ const i = norm.indexOf(t); if (i<0){ ok=false; break } tpos.push({i,len:t.length}) }
      if (ok){
        tpos.sort((a,b)=>a.i-b.i)
        const f = tpos[0]
        hits.push({ ...s, snippet: buildSnippet(raw, norm, f.i, f.len) })
      }
    }
  }
  return hits
})

const index = computed(() => {
  const items = []
  for (const p of props.pages || []) {
    const pageId = p.id
    const pageTitle = String(p.title || '')
    const sectionName = String(p.noteName || '')

    items.push({ kind:'pageTitle', pageId, id:'TITLE', raw:pageTitle, norm:normalizeTr(pageTitle), pageTitle, sectionName })

    const iso = String(p.dateISO || '')
    if (iso) {
      const d = toDateSafe(iso)
      const longTr = d ? d.toLocaleDateString('tr-TR', {day:'2-digit',month:'long',year:'numeric',weekday:'long'}) : ''
      for (const raw of [iso, longTr, ddmmyyyyDots(iso), ddmmyyyySlashes(iso)].filter(Boolean)){
        items.push({ kind:'date', pageId, id:'DATE', raw, norm:normalizeTr(raw), pageTitle, sectionName })
      }
    }

    const hm = String(p.timeHM || '')
    if (hm) {
      for (const raw of [hm, hm.replace(':','.')]){
        items.push({ kind:'time', pageId, id:'TIME', raw, norm:normalizeTr(raw), pageTitle, sectionName })
      }
    }

    for (const b of extractBlocks(p)) {
      const bodyRaw = stripHtml(typeof b.html==='string' ? b.html : (typeof b.text==='string' ? b.text : ''))
      items.push({ kind:'noteBody', pageId, id:b.id, raw:bodyRaw, norm:normalizeTr(bodyRaw), pageTitle, sectionName })
    }
  }
  return items
})

const flatResults = computed(() => {
  const p = parseQuery(q.value)
  if (p.type === 'empty') return []
  const hits = []
  for (const it of index.value) {
    if (!it.norm) continue
    if (p.type === 'phrase') {
      const at = it.norm.indexOf(p.phrase)
      if (at >= 0) hits.push({ ...it, matchAt:at, matchLen:p.phrase.length, snippet:buildSnippet(it.raw, it.norm, at, p.phrase.length) })
    } else {
      let ok = true; const pos=[]
      for (const t of p.terms){ const i = it.norm.indexOf(t); if (i<0){ ok=false; break } pos.push({i,len:t.length}) }
      if (ok) {
        pos.sort((a,b)=>a.i-b.i)
        const first = pos[0]
        hits.push({ ...it, matchAt:first.i, matchLen:first.len, snippet:buildSnippet(it.raw, it.norm, first.i, first.len) })
      }
    }
  }
  const typeRank = { pageTitle:0, date:1, time:2, noteBody:3 }
  hits.sort((a,b)=>{
    const tr = (typeRank[a.kind]??9) - (typeRank[b.kind]??9)
    if (tr) return tr
    if (a.pageId !== b.pageId) return String(a.pageTitle).localeCompare(String(b.pageTitle),'tr')
    return a.matchAt - b.matchAt
  })
  return hits
})

const grouped = computed(() => {
  const by = new Map()
  for (const h of flatResults.value) {
    if (!by.has(h.pageId)) by.set(h.pageId, {
      pageId:h.pageId, pageTitle:h.pageTitle, sectionName:h.sectionName || '',
      titleHit:null, dateHits:[], timeHits:[], bodyHits:[]
    })
    const g = by.get(h.pageId)
    if (h.kind==='pageTitle') g.titleHit = h
    else if (h.kind==='date') g.dateHits.push(h)
    else if (h.kind==='time') g.timeHits.push(h)
    else g.bodyHits.push(h)
  }
  return Array.from(by.values())
})

const totalCount = computed(() =>
  flatResults.value.length + sectionResults.value.length
)

/* Actions */
function openFirst(){
  if (sectionResults.value[0]) { openSection(sectionResults.value[0].noteId); return }
  const g = grouped.value[0]; if (!g) return
  if (g.titleHit) openTitle(g.pageId)
  else if (g.dateHits[0]) openTitle(g.pageId)
  else if (g.timeHits[0]) openTitle(g.pageId)
  else if (g.bodyHits[0]) openNote(g.pageId, g.bodyHits[0].id)
}
function openTitle(pageId){
  emit('open-locate', { pageId })
  window.dispatchEvent(new CustomEvent('oneNote:openLocate', { detail:{ pageId } }))
  emit('close')
}
function openNote(pageId, noteId){
  emit('open-locate', { pageId, noteId })
  window.dispatchEvent(new CustomEvent('oneNote:openLocate', { detail:{ pageId, noteId } }))
  emit('close')
}
function openSection(noteId){
  emit('open-locate', { noteId })
  window.dispatchEvent(new CustomEvent('oneNote:openLocate', { detail:{ noteId } }))
  emit('close')
}
</script>

<style scoped>
.search-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.08); z-index:1050; display:flex; justify-content:flex-end; }
.search-panel{ width:min(560px,92vw); height:100%; background:#fff; animation:slideIn .18s ease-out; display:flex; flex-direction:column; overflow:auto; }
@keyframes slideIn{ from{ transform:translateX(20px); opacity:.0 } to{ transform:translateX(0); opacity:1 } }
.results{ padding-bottom:24px; }
.sticky-sub{ position:sticky; top:0; z-index:1; }
</style>
