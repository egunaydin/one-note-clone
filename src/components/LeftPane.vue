<template>
  <aside class="bg-light border-end d-flex flex-column h-100" :class="{ collapsed: isLeftCollapsed }">
    <!-- ÜST (Hamburger) -->
    <div class="aside-top d-flex align-items-center p-2">
      <button
        class="btn btn-sm btn-light rounded-2"
        @click="$emit('toggle-left')"
        :title="'Sol paneli ' + (isLeftCollapsed ? 'genişlet' : 'daralt')"
      >
        <i class="bi bi-list"></i>
      </button>
    </div>

    <!-- İçerik -->
    <div v-if="!isLeftCollapsed" class="aside-body d-flex flex-column flex-grow-1 p-2">
      <!-- Notebook Başlık -->
      <button
        class="btn btn-light w-100 d-flex align-items-center gap-2 border rounded-3 shadow-sm mb-2 px-2"
        @click="toggleNotebook"
      >
        <i :class="['bi', notebookCollapsed ? 'bi-caret-right-fill' : 'bi-caret-down-fill']"></i>
        <i class="bi bi-journal-bookmark-fill"></i>
        <span class="fw-semibold text-truncate">{{ currentNotebookName }}</span>
      </button>

      <!-- Not listesi -->
      <ul v-if="!notebookCollapsed" class="list-group list-group-flush flex-grow-1 overflow-auto">
        <li
          v-for="(note, idx) in notes"
          :key="note.id"
          class="list-group-item py-2 px-3 d-flex align-items-center gap-2 border-0 note-item"
          :class="{ 'is-active': note.id === selectedNoteId }"
          role="button"
          @click="$emit('select-note', note.id)"
          @dblclick.stop="startRename(note)"
          @contextmenu.prevent="openContextMenu($event, note)"
        >
          <span class="color-bar" :style="{ background: note.color }"></span>

          <!-- İsim: normal görünüm / inline rename -->
          <template v-if="rename.id === note.id">
            <input
              ref="renameInput"
              v-model.trim="rename.name"
              class="form-control form-control-sm inline-rename"
              @click.stop
              @keydown.enter.prevent="commitRename()"
              @keydown.esc.prevent="cancelRename()"
              @blur="commitRename()"
            />
          </template>
          <template v-else>
            <span class="text-truncate label" :class="note.id===selectedNoteId ? 'fw-semibold' : ''">
              {{ note.name || 'Adsız bölüm' }}
            </span>
          </template>
        </li>

        <!-- En son notun altına Yeni Bölüm -->
        <li v-if="notes.length > 0" class="list-group-item py-1 px-3 border-0">
          <button 
            class="btn btn-link text-decoration-none ps-2 pe-0 py-1 text-purple"
            @click="$emit('add-note')"
          >
            <i class="bi bi-plus-lg me-1"></i> Yeni Bölüm
          </button>
        </li>
      </ul>

      <!-- Eğer hiç not yoksa defter başlığının altında -->
      <div v-if="notes.length === 0 && !notebookCollapsed" class="mt-2">
        <button 
          class="btn btn-link text-decoration-none ps-2 pe-0 py-1 text-purple w-100 text-start"
          @click="$emit('add-note')"
        >
          <i class="bi bi-plus-lg me-1"></i> Yeni Bölüm
        </button>
      </div>
    </div>

    <!-- Context Menu -->
    <div 
      v-if="contextMenu.visible" 
      class="context-menu bg-white border rounded shadow-sm position-absolute"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <button class="dropdown-item" @click="startRename(contextMenu.note)">
        <i class="bi bi-pencil me-2"></i> Yeniden Adlandır
      </button>
      <button class="dropdown-item text-danger" @click="deleteNote(contextMenu.note.id)">
        <i class="bi bi-trash me-2"></i> Sil
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  currentNotebookName: { type: String, required: true },
  notes: { type: Array, required: true },
  selectedNoteId: { type: String, default: null },
  isLeftCollapsed: { type: Boolean, default: false }
})
const emit = defineEmits(['toggle-left', 'add-note', 'select-note', 'delete-note', 'rename-note'])

const notebookCollapsed = ref(false)
function toggleNotebook() {
  notebookCollapsed.value = !notebookCollapsed.value
}

/* Inline rename state */
const rename = ref({ id: null, name: '' })
const renameInput = ref(null)

function startRename(note){
  closeContextMenu()
  rename.value = { id: note.id, name: note.name || '' }
  nextTick(() => renameInput.value?.focus())
}
function commitRename(){
  if (!rename.value.id) return
  const newName = (rename.value.name || '').trim()
  emit('rename-note', rename.value.id, newName)   // App.vue’de ikinci argüman varsa prompt açmadan kaydedilecek
  rename.value = { id:null, name:'' }
}
function cancelRename(){ rename.value = { id:null, name:'' } }

/* Context Menu */
const contextMenu = ref({ visible: false, x: 0, y: 0, note: null })
function openContextMenu(e, note) {
  contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, note }
}
function closeContextMenu() { contextMenu.value.visible = false }
function deleteNote(id) { emit('delete-note', id); closeContextMenu() }

onMounted(() => document.addEventListener('click', closeContextMenu))
onBeforeUnmount(() => document.removeEventListener('click', closeContextMenu))
</script>

<style scoped>
.note-item { border-radius: .5rem; transition: background .2s; }
.note-item:hover { background: #f8f9fa; }
.note-item.is-active { background:#fff; border:1px solid #e9ecef; box-shadow: 0 2px 10px rgba(0,0,0,.04); }
.note-item .label { font-size: .95rem; }
.color-bar { display:inline-block; width:6px; height:16px; border-radius:2px; }

.inline-rename{ height:28px; font-size:.95rem; padding:.15rem .4rem; }

.text-purple { color: #6f42c1; }
.text-purple:hover { color: #5a32a3; }

.context-menu { z-index: 2000; min-width: 150px; }
</style>
