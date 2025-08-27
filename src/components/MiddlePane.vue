<template>
  <div class="middle-pane d-flex flex-column border-end">
    <!-- ÜST KISIM -->
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
        </ul>
      </div>
    </div>

    <!-- SAYFA LİSTESİ -->
    <ul class="list-group list-group-flush flex-grow-1 overflow-auto">
      <li
        v-for="p in pages"
        :key="p.id"
        class="list-group-item page-item"
        :class="{ active: p.id === selectedPageId }"
        @click="$emit('select-page', p.id)"
        @contextmenu.prevent="$emit('delete-page', p.id)"
      >
        {{ p.title }}

        <button
          class="page-del btn btn-link p-0 text-danger"
          title="Sayfayı sil"
          aria-label="Sayfayı sil"
          @click.stop="$emit('delete-page', p.id)"
        >
          <i class="bi bi-trash"></i>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
defineProps({
  pages: { type: Array, required: true },
  selectedPageId: { type: String, default: null }
})
defineEmits(['add-page', 'select-page', 'set-sort', 'delete-page'])
</script>

<style scoped>
.middle-pane { width: 280px; font-size: 0.9rem; }
.text-purple { color:#6f42c1!important } .text-purple:hover{ color:#5a32a3!important }
.page-item { cursor:pointer; border:none; font-size:.95rem; color:#212529; position:relative; padding-right:36px; }
.page-item:hover { background:#f1f1f1; color:#212529 }
.page-item.active { background:#e9ecef; font-weight:600; color:#000 }
.page-del { position:absolute; right:10px; top:50%; transform:translateY(-50%); opacity:0; transition:opacity .15s }
.page-item:hover .page-del, .page-item.active .page-del { opacity:1 }
</style>
