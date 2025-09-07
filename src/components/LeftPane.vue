<template>
   <aside ref="rootEl" class="bg-light border-end d-flex flex-column h-100" :class="{ collapsed: isLeftCollapsed }">
  
    <div class="aside-top d-flex align-items-center p-2">
      <button
        class="btn btn-sm btn-light rounded-2"
        @click="$emit('toggle-left')"
        :title="'Sol paneli ' + (isLeftCollapsed ? 'genişlet' : 'daralt')"
      >
        <i class="bi bi-list"></i>
      </button>
    </div>

    
    <div v-if="!isLeftCollapsed" class="aside-body d-flex flex-column flex-grow-1 p-2">
    
      <button
        class="btn btn-light w-100 d-flex align-items-center gap-2 border rounded-3 shadow-sm mb-2 px-2"
        @click="toggleNotebook"
      >
        <i :class="['bi', notebookCollapsed ? 'bi-caret-right-fill' : 'bi-caret-down-fill']"></i>
        <i class="bi bi-journal-bookmark-fill"></i>
        <span class="fw-semibold text-truncate">{{ currentNotebookName }}</span>
      </button>

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

        <li v-if="notes.length > 0" class="list-group-item py-1 px-3 border-0">
          <button 
            class="btn btn-link text-decoration-none ps-2 pe-0 py-1 text-purple"
            @click="$emit('add-note')"
          >
            <i class="bi bi-plus-lg me-1"></i> Yeni Bölüm
          </button>
        </li>
      </ul>

      <div v-if="notes.length === 0 && !notebookCollapsed" class="mt-2">
        <button 
          class="btn btn-link text-decoration-none ps-2 pe-0 py-1 text-purple w-100 text-start"
          @click="$emit('add-note')"
        >
          <i class="bi bi-plus-lg me-1"></i> Yeni Bölüm
        </button>
      </div>
    </div>

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

<div v-if="confirmState.show" class="modal fade show" style="display:block;" role="dialog" aria-modal="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content shadow-lg border-0 rounded-3">
      <div class="modal-header">
        <h5 class="modal-title">Bölümü sil</h5>
        <button type="button" class="btn-close" @click="cancelDelete" aria-label="Kapat"></button>
      </div>
      <div class="modal-body">
        "<strong>{{ confirmState.name }}</strong>" bölümünü silmek istediğinize emin misiniz?
       
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="cancelDelete">İptal</button>
        <button class="btn btn-danger" @click="confirmDelete">
          <i class="bi bi-trash me-1"></i> Sil
        </button>
      </div>
    </div>
  </div>
</div>
<div v-if="confirmState.show" class="modal-backdrop fade show"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
const lastMouse = ref({ x: 0, y: 0 });
function trackMouse(e){ lastMouse.value = { x: e.clientX, y: e.clientY }; }

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('click', closeContextMenu);
  window.addEventListener('mousemove', trackMouse, { passive: true });
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('click', closeContextMenu);
  window.removeEventListener('mousemove', trackMouse);
});

const rootEl = ref(null)


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

const contextMenu = ref({ visible: false, x: 0, y: 0, note: null })
   function openContextMenu(e, note) {
     contextMenu.value = { visible: true, x: e.clientX, y: e.clientY, note }
 }



function closeContextMenu() { contextMenu.value.visible = false }
function deleteNote(id) { askDelete(id) }

function onKeydown(e){
  if (e.key !== 'Delete') return;

  const rect = rootEl.value?.getBoundingClientRect();
  const insidePanel = !!rect &&
    lastMouse.value.x >= rect.left && lastMouse.value.x <= rect.right &&
    lastMouse.value.y >= rect.top  && lastMouse.value.y <= rect.bottom;

  if (!insidePanel && !contextMenu.value.visible) return;

  if (rename.value.id) return;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;

  const note = props.notes.find(n => n.id === props.selectedNoteId);
  if (!note) return;
  askDelete(note.id);
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('click', closeContextMenu);
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('click', closeContextMenu);
});


const confirmState = ref({ show: false, id: null, name: '' })

function askDelete(id){
  const n = props.notes.find(x => x.id === id)
  confirmState.value = {
    show: true,
    id,
    name: n?.name || 'Adsız bölüm'
  }
  closeContextMenu()
}
function cancelDelete(){
  confirmState.value.show = false
}
function confirmDelete(){
  if (confirmState.value.id){
    emit('delete-note', confirmState.value.id)
  }
  confirmState.value.show = false
}


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

.context-menu {z-index: 100000; min-width: 200px; }
.context-menu .dropdown-item{
  background-color: transparent;
  transition: background-color .18s ease-in-out;
  border-radius: .10rem;
}
.context-menu{
  padding: .40rem;           
  border-radius: 8px !important;
  min-width: 200px;
}

.context-menu .dropdown-item{
          display: flex;             
  align-items: center;
  gap: .5rem;                
  padding: .5rem .75rem;     
  line-height: 1.25;
  border-radius: .25rem;     
  font-size: .95rem;     
}
.context-menu .dropdown-item i{
  flex: 0 0 1rem;            
  margin-right: .25rem;      
}

.context-menu .dropdown-item:nth-child(odd){
  background-color: rgba(244, 243, 245, 0.04);  
}
.context-menu .dropdown-item:nth-child(even){
  background-color: rgba(254, 254, 254, 0.08);  
}
.context-menu .dropdown-item:hover,
.context-menu .dropdown-item:focus{
  background-color: rgba(41, 14, 82, 0.16);  
}
.context-menu .dropdown-item:active{
  background-color: rgba(84, 33, 180, 0.22);
}

:root {
  --lp-sel-bg: rgba(111, 66, 193, .10);   
  --lp-sel-bc: rgba(111, 66, 193, .38);
}

.note-item.is-active{
  background: var(--lp-sel-bg) !important;
  border: 1px solid var(--lp-sel-bc) !important;
  box-shadow: 0 6px 18px rgba(111, 66, 193, .12);
}

.note-item.is-active:hover{
  background: var(--lp-sel-bg) !important;
}

.note-item.is-active .label{
  color: #2D1E99;
  font-weight: 600;
}
.note-item.is-active .color-bar{
  background: #6f42c1 !important;
  width: 8px; 
}

.modal { z-index: 2050; }
.modal-backdrop { z-index: 2040; }

.modal-content { border-radius: 8px; }


</style>
