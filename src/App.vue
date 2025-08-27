<template>
  <div class="layout" :class="{ collapsed: isLeftCollapsed }">
    <!-- SOL PANEL -->
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

    <!-- ORTA PANEL -->
    <MiddlePane
      :pages="pagesForNote"
      :selected-page-id="selectedPageId"
      @add-page="addPage"
      @select-page="selectPage"
      @set-sort="sortPages"
      @delete-page="deletePage"
    />

    <!-- SAĞ PANEL -->
    <EditorPane
      v-if="selectedPage"
      :page="selectedPage"
      @update-page="updatePage"
    />
    <p v-else class="text-muted p-4">Sayfa seçiniz…</p>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import LeftPane from './components/LeftPane.vue'
import MiddlePane from './components/MiddlePane.vue'
import EditorPane from './components/EditorPane.vue'

/* ---------- State ---------- */
const isLeftCollapsed = ref(false)

const notebooks = ref([{ id: 'nb-1', name: 'Stajyer @ Çalışma' }])
const notes = ref([
  { id: 'n-1', notebookId: 'nb-1', name: 'Yeni Bölüm 1', color: '#f1c40f' },
  { id: 'n-2', notebookId: 'nb-1', name: 'Yeni Bölüm 2', color: '#1e8e3e' }
])

// ÖNEMLİ: sayfa şeması blocks içerir (EditorPane ile uyumlu)
const pages = ref([
  { id: 'p-1', noteId: 'n-1', title: 'İlk Sayfa', blocks: [] }
])

const selectedNotebookId = ref('nb-1')
const selectedNoteId = ref(notes.value[0]?.id || null)
const selectedPageId = ref(pages.value[0]?.id || null)

/* ---------- Computed ---------- */
const currentNotebookName = computed(() =>
  notebooks.value.find(n => n.id === selectedNotebookId.value)?.name || 'Defter'
)
const pagesForNote = computed(() =>
  pages.value.filter(p => p.noteId === selectedNoteId.value)
)
const selectedPage = computed(() =>
  pages.value.find(p => p.id === selectedPageId.value) || null
)

/* ---------- Actions ---------- */
function toggleLeft() { isLeftCollapsed.value = !isLeftCollapsed.value }

function addNote() {
  const id = 'n-' + Date.now()
  notes.value.push({ id, notebookId: selectedNotebookId.value, name: 'Yeni Bölüm', color: '#7f8c8d' })
  selectedNoteId.value = id
  selectedPageId.value = pages.value.find(p => p.noteId === id)?.id || null
}

function selectNote(id) {
  selectedNoteId.value = id
  selectedPageId.value = pages.value.find(p => p.noteId === id)?.id || null
}

function deleteNote(id) {
  // 1) Bu nota ait sayfaları sil
  const removedPageIds = new Set(pages.value.filter(p => p.noteId === id).map(p => p.id))
  pages.value = pages.value.filter(p => p.noteId !== id)
  if (removedPageIds.has(selectedPageId.value)) selectedPageId.value = null

  // 2) Notu sil
  notes.value = notes.value.filter(n => n.id !== id)

  // 3) Seçimleri onar
  if (selectedNoteId.value === id) {
    selectedNoteId.value = notes.value[0]?.id || null
    selectedPageId.value = pages.value.find(p => p.noteId === selectedNoteId.value)?.id || null
  } else if (!selectedPageId.value) {
    selectedPageId.value = pages.value.find(p => p.noteId === selectedNoteId.value)?.id || null
  }
}

function renameNote(id) {
  const note = notes.value.find(n => n.id === id)
  if (note) {
    const yeni = prompt('Yeni isim:', note.name)
    if (yeni) note.name = yeni
  }
}

/* Pages */
function addPage() {
  if (!selectedNoteId.value) return
  const id = 'p-' + Date.now()
  pages.value.push({ id, noteId: selectedNoteId.value, title: 'Adsız sayfa', blocks: [] })
  selectedPageId.value = id
}
function selectPage(id) { selectedPageId.value = id }
function sortPages(type) {
  if (type === 'alpha') {
    pages.value = [...pages.value].sort((a, b) => a.title.localeCompare(b.title))
  }
}
function updatePage(updated) {
  const page = pages.value.find(p => p.id === updated.id)
  if (page) Object.assign(page, updated) // referansı koru → EditorPane resetlenmez
}
function deletePage(id) {
  const page = pages.value.find(p => p.id === id)
  if (!page) return
  pages.value = pages.value.filter(p => p.id !== id)
  if (selectedPageId.value === id) {
    selectedPageId.value = pages.value.find(p => p.noteId === page.noteId)?.id || null
  }
}

/* ---------- PERSIST: localStorage ---------- */
const STORAGE_KEY = 'one-note-notebook-v1'
const safeParse = (json, fb) => { try { return JSON.parse(json) ?? fb } catch { return fb } }
// Eski kayıtlardaki {notes/content} alanlarını {blocks}’a göçür
const migratePage = (p) => ({ ...p, blocks: Array.isArray(p.blocks) ? p.blocks : (p.notes ?? []) })

function hydrateFromStorage() {
  const saved = safeParse(localStorage.getItem(STORAGE_KEY), null)
  if (!saved) return

  notebooks.value = saved.notebooks ?? notebooks.value
  notes.value     = saved.notes     ?? notes.value
  pages.value     = (saved.pages ?? []).map(migratePage)

  selectedNotebookId.value = saved.selectedNotebookId ?? selectedNotebookId.value
  selectedNoteId.value     = saved.selectedNoteId     ?? selectedNoteId.value
  selectedPageId.value     = saved.selectedPageId     ?? selectedPageId.value
  isLeftCollapsed.value    = saved.isLeftCollapsed    ?? isLeftCollapsed.value

  // Seçimleri doğrula (silinmiş nesnelere işaret etmesin)
  if (!notes.value.find(n => n.id === selectedNoteId.value)) {
    selectedNoteId.value = notes.value[0]?.id || null
  }
  if (!pages.value.find(p => p.id === selectedPageId.value && p.noteId === selectedNoteId.value)) {
    selectedPageId.value = pages.value.find(p => p.noteId === selectedNoteId.value)?.id || null
  }
}
// İlk yüklemede kayıttan getir
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

// 150 ms debounce ile kaydet
let persistT
watch(
  () => snapshot(),
  (st) => {
    clearTimeout(persistT)
    persistT = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(st))
    }, 150)
  },
  { deep: true }
)

// Diğer sekmeyle senkron
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

  // Seçimleri doğrula
  if (!notes.value.find(n => n.id === selectedNoteId.value)) {
    selectedNoteId.value = notes.value[0]?.id || null
  }
  if (!pages.value.find(p => p.id === selectedPageId.value && p.noteId === selectedNoteId.value)) {
    selectedPageId.value = pages.value.find(p => p.noteId === selectedNoteId.value)?.id || null
  }
})
</script>

<style>
.layout {
  height: 100vh;
  display: grid;
  grid-template-columns: 260px 280px 1fr; /* SOL - ORTA - SAĞ */
  transition: grid-template-columns .2s ease;
}
.layout.collapsed {
  grid-template-columns: 48px 280px 1fr;
}
</style>
