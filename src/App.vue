<template>
  <div class="layout" :class="{ collapsed: isLeftCollapsed }">
    <LeftPane
      current-notebook-name="Logiesse OneNote"
      :notes="notes"
      :selected-note-id="selectedNoteId"
      :is-left-collapsed="isLeftCollapsed"
      @toggle-left="toggleLeft"
      @add-note="addNote"
      @select-note="selectNote"
      @delete-note="deleteNote"
      @rename-note="renameNote"
    />

    <MiddlePane
      :pages="pagesForNote"
      :selected-page-id="selectedPageId"
      @add-page="addPage"
      @select-page="selectPage"
      @set-sort="sortPages"
      @delete-page="deletePage"
    />

    <EditorPane
      :key="selectedPageId"
      :page="currentPage"
      :pages="pages"
      @update-page="onUpdatePage"
      @open-page="onSearchLocate"
    />

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

const isLeftCollapsed = ref(false)

const notebooks = ref([{ id: 'nb-1', name: 'Stajyer' }])
const notes = ref([
  { id: 'n-1', notebookId: 'nb-1', name: 'Yeni Bölüm 1', color: '#f1c40f' }
])

const pages = ref([
  { id: 'p-1', noteId: 'n-1', title: 'İlk Sayfa', blocks: [] }
])

const selectedNotebookId = ref('nb-1')
const selectedNoteId     = ref(notes.value[0]?.id || null)
const selectedPageId     = ref(pages.value[0]?.id || null)

const pagesForNote = computed(() =>
  pages.value.filter(p => p.noteId === selectedNoteId.value)
)
const currentPage = computed(() =>
  pages.value.find(p => p.id === selectedPageId.value) || null
)
const noteIdToName = computed(() =>
  Object.fromEntries(notes.value.map(n => [n.id, n.name]))
)
const allPagesWithNoteName = computed(() =>
  pages.value.map(p => ({ ...p, noteName: noteIdToName.value[p.noteId] || '' }))
)

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
  const yeni = prompt('Yeni isim:', note.name)
  if (yeni !== null) note.name = (yeni || '').trim() || 'Adsız bölüm'
}

function addPage () {
  if (!selectedNoteId.value) return
  const id = 'p-' + Date.now()
  pages.value.push({ id, noteId: selectedNoteId.value, title: 'Adsız sayfa', blocks: [] })
  selectedPageId.value = id
}
function selectPage (id) { selectedPageId.value = id }

function sortPages (type) {
  const ts = (p) => {
    const d = (p?.dateISO || '').trim()
    const t = (p?.timeHM  || '00:00').trim()
    const v = d ? Date.parse(`${d}T${t}:00`) : NaN
    return Number.isFinite(v) ? v : -Infinity
  }
  if (type === 'alpha') { pages.value = [...pages.value].sort((a, b) => (a.title || '').localeCompare((b.title || ''), 'tr')); return }
  if (type === 'date-new') { pages.value = [...pages.value].sort((a, b) => ts(b) - ts(a)); return }
  if (type === 'date-old') { pages.value = [...pages.value].sort((a, b) => ts(a) - ts(b)); return }
}

function onUpdatePage (updated) {
  const page = pages.value.find(p => p.id === updated.id)
  if (page) Object.assign(page, updated)
}
function deletePage (id) {
  const page = pages.value.find(p => p.id === id)
  if (!page) return
  pages.value = pages.value.filter(p => p.id !== id)
  if (selectedPageId.value === id) {
    selectedPageId.value = pages.value.find(p => p.noteId === page.noteId)?.id || null
  }
}

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

const searchOpen = ref(false)

function handleGlobalOpenLocate (e) {
  const { pageId, noteId } = e.detail || {}
  if (pageId || noteId) onSearchLocate({ pageId, noteId })
}

const highlightNoteId = ref('')
async function onSearchLocate (payload = {}) {
  const { pageId, noteId } = payload

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
  if (noteId) {
    selectedNoteId.value = noteId
    await nextTick()
    const first = pages.value.find(p => p.noteId === noteId) || null
    selectedPageId.value = first?.id || null
    searchOpen.value = false
  }
}

function onGlobalKey (e) {
  const k = (e.key || '').toLowerCase()
  if ((e.ctrlKey || e.metaKey) && k === 'k') {
    e.preventDefault()
    e.stopPropagation()             
    e.stopImmediatePropagation?.()
    if (e.repeat) return
    if (!searchOpen.value) searchOpen.value = true
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKey, true) 
  window.addEventListener('oneNote:openLocate', handleGlobalOpenLocate)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey, true)
  window.removeEventListener('oneNote:openLocate', handleGlobalOpenLocate)
})
</script>

<style>
html, body, #app { height: 100%; }
body { overflow: hidden; }

.layout {
  height: 100%;
  display: grid;
  grid-template-columns: 260px 280px 1fr; 
  grid-template-rows: 1fr;               
  overflow: hidden;                     
  transition: grid-template-columns .2s ease;
}
.layout.collapsed { grid-template-columns: 48px 280px 1fr; }

.layout > * { min-height: 0; }

.left-pane,
.middle-pane,
.editor-root {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.aside-body,                      
.middle-pane > .list-group,      
.editor-root .editor-canvas {     
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
}

.search-overlay { overscroll-behavior: contain; }
</style>
