<template>
  <div
    ref="rootEl"
    class="middle-pane d-flex flex-column border-end"
    tabindex="0"
    @mousedown.capture="focusRoot"
  >
    <div class="d-flex justify-content-between align-items-center p-2 border-bottom">
      <button class="btn btn-light border text-purple fw-semibold" @click="$emit('add-page')">
        <i class="bi bi-pencil-square me-1"></i> Sayfa Ekle
      </button>

      <div class="dropdown">
        <button class="btn btn-light border" type="button" id="sortDropdown" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="bi bi-sort-down-alt"></i>
        </button>
        <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="sortDropdown">
          <li><a class="dropdown-item" href="#" @click.prevent="$emit('set-sort', 'none')">Yok</a></li>
          <li><a class="dropdown-item" href="#" @click.prevent="$emit('set-sort', 'alpha')">Alfabetik</a></li>
          <li><a class="dropdown-item" href="#" @click.prevent="$emit('set-sort','date-new')">Tarihe göre – Yeni → Eski</a></li>
          <li><a class="dropdown-item" href="#" @click.prevent="$emit('set-sort','date-old')">Tarihe göre – Eski → Yeni</a></li>
        </ul>
      </div>
    </div>

    <ul class="list-group list-group-flush flex-grow-1 overflow-auto">
      <li
        v-for="p in pages"
        :key="p.id"
        class="list-group-item page-item d-flex align-items-center"
        :class="{ active: p.id === selectedPageId }"
        @click="$emit('select-page', p.id)"
      >
        <span class="title text-truncate flex-grow-1 min-w-0">{{ displayTitle(p) }}</span>

        <button
          class="page-del btn btn-link p-0 text-danger"
          title="Sayfayı sil"
          aria-label="Sayfayı sil"
          @click.stop="askDelete(p.id)"
        >
          <i class="bi bi-trash"></i>
        </button>
      </li>
    </ul>

    <teleport to="body">
      <div v-if="confirmState.show" class="modal fade show" style="display:block;" role="dialog" aria-modal="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content shadow-lg border-0 rounded-3">
            <div class="modal-header">
              <h5 class="modal-title">Sayfayı sil</h5>
              <button type="button" class="btn-close" @click="cancelDelete" aria-label="Kapat"></button>
            </div>
            <div class="modal-body">
              "<strong>{{ confirmState.name }}</strong>" sayfasını silmek istediğinize emin misiniz?
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
    </teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
const rootEl = ref(null)

const props = defineProps({
  pages: { type: Array, required: true },
  selectedPageId: { type: String, default: null }
})
const emit = defineEmits(['add-page', 'select-page', 'set-sort', 'delete-page'])

const displayTitle = (p) => (p?.title || '').trim() || 'Adsız sayfa'

const confirmState = ref({ show: false, id: null, name: '' })
function askDelete(id){
  const page = props.pages.find(x => x.id === id)
  confirmState.value = { show: true, id, name: displayTitle(page) }
}
function cancelDelete(){ confirmState.value.show = false }
function confirmDelete(){
  if (confirmState.value.id) emit('delete-page', confirmState.value.id)
  confirmState.value.show = false
}

watch(() => confirmState.value.show, v => {
  document.body.classList.toggle('modal-open', v)
})

function focusRoot(){ rootEl.value?.focus() }

function onKeydown(e){
  if (confirmState.value.show && (e.key === 'Escape' || e.key === 'Esc')){
    e.preventDefault()
    cancelDelete()
    return
  }
  if (e.key !== 'Delete' || confirmState.value.show) return

  const el = rootEl.value
  const ae = document.activeElement
  if (!el || !ae || !el.contains(ae)) return
  if (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable) return

  const id = props.selectedPageId
  if (!id) return
  askDelete(id)
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('modal-open')
})
</script>

<style scoped>
.middle-pane { width: 280px; font-size: 0.9rem; }
.text-purple { color:#6f42c1!important } 
.text-purple:hover{ color:#5a32a3!important }

.list-group-flush,
.list-group-flush .list-group-item{ border: 0 !important; }

.page-item{
  cursor: pointer;
  font-size: .95rem;
  color: #212529;
  position: relative;
  padding: .5rem .75rem;
  padding-right: 36px;
  min-height: 44px;
  display: flex;
  align-items: center;
  background: transparent;
  transition: background .12s ease, box-shadow .12s ease;
}
.page-item:hover,
.page-item.active{
  background: rgba(122, 104, 129, 0.1) !important;
  color: #4a4074;
  border: 0 !important;
}

.title{ line-height: 1.25rem; flex: 1 1 auto; }

.page-del{
  position: absolute; right: 10px; top: 50%;
  transform: translateY(-50%);
  opacity: 0; transition: opacity .15s ease;
}
.page-item:hover .page-del,
.page-item.active .page-del{ opacity: 1; }

.modal { z-index: 2050; }
.modal-backdrop { z-index: 2040; }

.min-w-0{ min-width: 0; }
.middle-pane:focus,
.middle-pane:focus-visible{
  outline: none !important;
  box-shadow: none !important; 
}

</style>
