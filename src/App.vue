<template>
  <div class="layout" :class="{ collapsed: isLeftCollapsed }">
    <!-- SOL -->
    <LeftPane
      :current-notebook-name="currentNotebookName"
      :notes="notes"
      :selected-note-id="selectedNoteId"
      :is-left-collapsed="isLeftCollapsed"
      @toggle-left="toggleLeft"
      @add-note="addNote"
      @select-note="selectNote"
      @delete-note="deleteNote"
      @rename-note="renameNote"
    />

    <!-- ORTA -->
    <MiddlePane
      :pages="pagesForNote"
      :selected-page-id="selectedPageId"
      @add-page="addPage"
      @select-page="selectPage"
      @set-sort="sortPages"
      @delete-page="deletePage"
    />

    <!-- SAĞ -->
    <EditorPane
      :key="selectedPageId"
      :page="currentPage"
      :pages="pages"
      @update-page="onUpdatePage"
      @open-page="onSearchLocate"
    />

    <!-- GLOBAL SEARCH OVERLAY -->
    <Search
      :open="searchOpen"
      :pages="allPagesWithNoteName"
      :current-page-id="currentPage?.id || ''"
      @close="searchOpen = false"
      @open-locate="onSearchLocate"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import LeftPane   from './components/LeftPane.vue'
import MiddlePane from './components/MiddlePane.vue'
import EditorPane from './components/EditorPane.vue'
import Search     from './components/Search.vue'

/* ---------- STATE ---------- */
const isLeftCollapsed = ref(false)

const notebooks = ref([{ id: 'nb-1', name: 'Stajyer @ Çalışma' }])
const notes = ref([
  { id: 'n-1', notebookId: 'nb-1', name: 'Yeni Bölüm 1', color: '#f1c40f' },
  { id: 'n-2', notebookId: 'nb-1', name: 'Yeni Bölüm 2', color: '#1e8e3e' }
])

// Sayfalar
const pages = ref([
  { id: 'p-1', noteId: 'n-1', title: 'İlk Sayfa', blocks: [] }
])

const selectedNotebookId = ref('nb-1')
const selectedNoteId     = ref(notes.value[0]?.id || null)
const selectedPageId     = ref(pages.value[0]?.id || null)

/* ---------- COMPUTED ---------- */
const currentNotebookName = computed(() =>
  notebooks.value.find(n => n.id === selectedNotebookId.value)?.name || 'Defter'
)

const pagesForNote = computed(() =>
  pages.value.filter(p => p.noteId === selectedNoteId.value)
)

const currentPage = computed(() =>
  pages.value.find(p => p.id === selectedPageId.value) || null
)

/* Bölüm adı (noteName) → Search için sayfalara iliştir */
const noteIdToName = computed(() =>
  Object.fromEntries(notes.value.map(n => [n.id, n.name]))
)
const allPagesWithNoteName = computed(() =>
  pages.value.map(p => ({ ...p, noteName: noteIdToName.value[p.noteId] || '' }))
)

/* ---------- ACTIONS ---------- */
function toggleLeft () { isLeftCollapsed.value = !isLeftCollapsed.value }

function addNote () {
  const id = 'n-' + Date.now()
  notes.value.push({ id, notebookId: selectedNotebookId.value, name: 'Yeni Bölüm', color: '#7f8c8d' })
  selectedNoteId.value = id
  selectedPageId.value = pages.value.find(p => p.noteId === id)?.id || null
}

function selectNote (id) {
  selectedNoteId.value = id
  selectedPageId.value = pages.value.find(p => p.noteId === id)?.id || null
}

function deleteNote (id) {
  const removedPageIds = new Set(pages.value.filter(p => p.noteId === id).map(p => p.id))
  pages.value = pages.value.filter(p => p.noteId !== id)
  if (removedPageIds.has(selectedPageId.value)) selectedPageId.value = null

  notes.value = notes.value.filter(n => n.id !== id)

  if (selectedNoteId.value === id) {
    selectedNoteId.value = notes.value[0]?.id || null
    selectedPageId.value = pages.value.find(p => p.noteId === selectedNoteId.value)?.id || null
  } else if (!selectedPageId.value) {
    selectedPageId.value = pages.value.find(p => p.noteId === selectedNoteId.value)?.id || null
  }
}

function renameNote (id, newName) {
  const note = notes.value.find(n => n.id === id)
  if (!note) return
  if (typeof newName === 'string') {
    note.name = newName || 'Adsız bölüm'
    return
  }
  // (opsiyonel eski davranış)
  const yeni = prompt('Yeni isim:', note.name)
  if (yeni !== null) note.name = (yeni || '').trim() || 'Adsız bölüm'
}

/* Pages */
function addPage () {
  if (!selectedNoteId.value) return
  const id = 'p-' + Date.now()
  pages.value.push({ id, noteId: selectedNoteId.value, title: 'Adsız sayfa', blocks: [] })
  selectedPageId.value = id
}
function selectPage (id) { selectedPageId.value = id }

function sortPages (type) {
  // tarih+saati timestamp'e çevir
  const ts = (p) => {
    const d = (p?.dateISO || '').trim()
    const t = (p?.timeHM  || '00:00').trim()
    const v = d ? Date.parse(`${d}T${t}:00`) : NaN
    return Number.isFinite(v) ? v : -Infinity
  }

  if (type === 'alpha') {
    pages.value = [...pages.value].sort((a, b) => (a.title || '').localeCompare((b.title || ''), 'tr'))
    return
  }
  if (type === 'date-new') { // yeni → eski
    pages.value = [...pages.value].sort((a, b) => ts(b) - ts(a))
    return
  }
  if (type === 'date-old') { // eski → yeni
    pages.value = [...pages.value].sort((a, b) => ts(a) - ts(b))
    return
  }
  // 'none' → dokunma
}

function onUpdatePage (updated) {
  const page = pages.value.find(p => p.id === updated.id)
  if (page) Object.assign(page, updated) // referans koru
}

function deletePage (id) {
  const page = pages.value.find(p => p.id === id)
  if (!page) return
  pages.value = pages.value.filter(p => p.id !== id)
  if (selectedPageId.value === id) {
    selectedPageId.value = pages.value.find(p => p.noteId === page.noteId)?.id || null
  }
}

/* ---------- PERSIST (localStorage) ---------- */
const STORAGE_KEY = 'one-note-notebook-v1'
const safeParse = (json, fb) => { try { return JSON.parse(json) ?? fb } catch { return fb } }
const migratePage = (p) => ({ ...p, blocks: Array.isArray(p.blocks) ? p.blocks : (p.notes ?? []) })

function hydrateFromStorage () {
  const saved = safeParse(localStorage.getItem(STORAGE_KEY), null)
  if (!saved) return

  notebooks.value = saved.notebooks ?? notebooks.value
  notes.value     = saved.notes     ?? notes.value
  pages.value     = (saved.pages ?? []).map(migratePage)

  selectedNotebookId.value = saved.selectedNotebookId ?? selectedNotebookId.value
  selectedNoteId.value     = saved.selectedNoteId     ?? selectedNoteId.value
  selectedPageId.value     = saved.selectedPageId     ?? selectedPageId.value
  isLeftCollapsed.value    = saved.isLeftCollapsed    ?? isLeftCollapsed.value

  // seçimleri doğrula
  if (!notes.value.find(n => n.id === selectedNoteId.value)) {
    selectedNoteId.value = notes.value[0]?.id || null
  }
  if (!pages.value.find(p => p.id === selectedPageId.value && p.noteId === selectedNoteId.value)) {
    selectedPageId.value = pages.value.find(p => p.noteId === selectedNoteId.value)?.id || null
  }
}
hydrateFromStorage()

const snapshot = () => ({
  notebooks: notebooks.value,
  notes:     notes.value,
  pages:     pages.value,
  selectedNotebookId: selectedNotebookId.value,
  selectedNoteId:     selectedNoteId.value,
  selectedPageId:     selectedPageId.value,
  isLeftCollapsed:    isLeftCollapsed.value,
})

let persistT
watch(() => snapshot(), (st) => {
  clearTimeout(persistT)
  persistT = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(st))
  }, 150)
}, { deep: true })

// Sekmeler arası senkron
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY || !e.newValue) return
  const next = safeParse(e.newValue, null); if (!next) return

  notebooks.value = next.notebooks ?? notebooks.value
  notes.value     = next.notes     ?? notes.value
  pages.value     = (next.pages ?? []).map(migratePage)

  selectedNotebookId.value = next.selectedNotebookId ?? selectedNotebookId.value
  selectedNoteId.value     = next.selectedNoteId     ?? selectedNoteId.value
  selectedPageId.value     = next.selectedPageId     ?? selectedPageId.value
  isLeftCollapsed.value    = next.isLeftCollapsed    ?? isLeftCollapsed.value

  if (!notes.value.find(n => n.id === selectedNoteId.value)) {
    selectedNoteId.value = notes.value[0]?.id || null
  }
  if (!pages.value.find(p => p.id === selectedPageId.value && p.noteId === selectedNoteId.value)) {
    selectedPageId.value = pages.value.find(p => p.noteId === selectedNoteId.value)?.id || null
  }
})

/* ---------- SEARCH: kısayol + global event ---------- */
const searchOpen = ref(false)
function onGlobalKey (e) {
  if ((e.ctrlKey||e.metaKey) && (e.key||'').toLowerCase()==='k'){
    e.preventDefault()
    searchOpen.value = true
  }
}
onMounted(() => {
  window.addEventListener('keydown', onGlobalKey)
  // Search.vue her nerede olursa olsun tıklama garanti gelsin
  window.addEventListener('oneNote:openLocate', handleGlobalOpenLocate)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey)
  window.removeEventListener('oneNote:openLocate', handleGlobalOpenLocate)
})

function handleGlobalOpenLocate (e) {
  const { pageId, noteId } = e.detail || {}
  if (pageId || noteId) onSearchLocate({ pageId, noteId })
}

/* Search/EditorPane → sayfayı ya da doğrudan bölümü aç (TEK versiyon) */
const highlightNoteId = ref('') // istersen EditorPane'e iletebilirsin

async function onSearchLocate (payload = {}) {
  const { pageId, noteId } = payload

  // 1) Belirli bir sayfa
  if (pageId) {
    const page = pages.value.find(p => p.id === pageId)
    if (!page) return
    selectedNoteId.value = page.noteId
    await nextTick()
    selectedPageId.value = pageId
    if (payload.noteId) highlightNoteId.value = payload.noteId
    searchOpen.value = false
    return
  }

  // 2) Sadece bölüm
  if (noteId) {
    selectedNoteId.value = noteId
    await nextTick()
    const first = pages.value.find(p => p.noteId === noteId) || null
    selectedPageId.value = first?.id || null
    searchOpen.value = false
  }
}
</script>

<style>
.layout {
  height: 100vh;
  display: grid;
  grid-template-columns: 260px 280px 1fr; /* SOL - ORTA - SAĞ */
  grid-template-rows: auto 1fr;
  transition: grid-template-columns .2s ease;
}
.app-header { grid-column: 1 / -1; }

.layout.collapsed {
  grid-template-columns: 48px 280px 1fr;
}

/* Sadece EditorPane scroll alsın */
html, body, #app { height: 100%; }
body { overflow: hidden; }

/* Grid konteyneri taşmasın; çocuklar içeride scroll etsin */
.layout { height: 100vh; overflow: hidden; }
.layout > * { min-height: 0; }
</style>
