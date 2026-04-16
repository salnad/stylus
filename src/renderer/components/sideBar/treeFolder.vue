<template>
  <div
    class="side-bar-folder"
  >
    <div
      class="folder-name" @click="folderNameClick"
      :style="{'padding-left': `${(depth * 20) + 20}px`}"
      :class="[{ 'active': folder.id === activeItem.id }]"
      :title="folder.pathname"
      ref="folder"
    >
      <svg class="icon" aria-hidden="true">
        <use :xlink:href="`#${folder.isCollapsed ? 'icon-folder-close' : 'icon-folder-open'}`"></use>
      </svg>
      <input
        type="text"
        @click.stop="noop"
        class="rename"
        v-if="renameCache === folder.pathname"
        v-model="newName"
        ref="renameInput"
        @keydown.enter="rename"
      >
      <span v-else class="text-overflow">{{folder.name}}</span>
    </div>
    <div
      class="folder-contents"
      v-if="!folder.isCollapsed"
    >
      <folder
        v-for="(childFolder, index) of folder.folders" :key="index + 'folder'"
        :folder="childFolder"
        :depth="depth + 1"
      ></folder>
      <input
        type="text" v-if="createCache.dirname === folder.pathname"
        class="new-input"
        :style="{'margin-left': `${depth * 5 + 15}px` }"
        ref="input"
        @keydown.enter="handleInputEnter"
        v-model="createName"
      >
      <file
        v-for="(file, index) of folder.files" :key="index + 'file'"
        :file="file"
        :depth="depth + 1"
      ></file>
    </div>
  </div>
</template>

<script lang="ts">
import Vue, { type PropType } from 'vue'
import { showContextMenu } from '../../contextMenu/sideBar'
import bus from '../../bus'
import File from './treeFile.vue'
import type { TreeFolderEntry, TreeFileEntry } from '@/store/treeCtrl'

interface ProjectStoreState {
  project: {
    renameCache: string | null
    createCache: { dirname?: string, type?: 'file' | 'directory' }
    activeItem: Partial<TreeFileEntry>
    clipboard: { type?: 'copy' | 'cut', src?: string, dest?: string } | null
  }
}

type FolderInstance = Vue & {
  folder: TreeFolderEntry
  createName: string
  newName: string
  renameCache: string | null
  createCache: { dirname?: string, type?: 'file' | 'directory' }
  activeItem: Partial<TreeFileEntry>
  clipboard: { type?: 'copy' | 'cut', src?: string, dest?: string } | null
  handleInputFocus(): void
  focusRenameInput(): void
}

export default Vue.extend({
  name: 'folder',
  data () {
    return {
      createName: '',
      newName: ''
    }
  },
  props: {
    folder: {
      type: Object as PropType<TreeFolderEntry>,
      required: true
    },
    depth: {
      type: Number,
      required: true
    }
  },
  components: {
    File
  },
  computed: {
    renameCache (): string | null {
      return (this.$store.state as ProjectStoreState).project.renameCache
    },
    createCache (): ProjectStoreState['project']['createCache'] {
      return (this.$store.state as ProjectStoreState).project.createCache
    },
    activeItem (): Partial<TreeFileEntry> {
      return (this.$store.state as ProjectStoreState).project.activeItem
    },
    clipboard (): ProjectStoreState['project']['clipboard'] {
      return (this.$store.state as ProjectStoreState).project.clipboard
    }
  },
  created () {
    this.$nextTick(() => {
      const vm = this as unknown as FolderInstance
      const folderRef = this.$refs.folder as HTMLElement | undefined
      folderRef?.addEventListener('contextmenu', (event: MouseEvent) => {
        event.preventDefault()
        this.$store.dispatch('CHANGE_ACTIVE_ITEM', vm.folder)
        showContextMenu(event, !!vm.clipboard)
      })
      bus.$on('SIDEBAR::show-new-input', vm.handleInputFocus)
      bus.$on('SIDEBAR::show-rename-input', vm.focusRenameInput)
    })
  },
  beforeDestroy () {
    const vm = this as unknown as FolderInstance
    bus.$off('SIDEBAR::show-new-input', vm.handleInputFocus)
    bus.$off('SIDEBAR::show-rename-input', vm.focusRenameInput)
  },
  methods: {
    folderNameClick () {
      const vm = this as unknown as FolderInstance
      vm.folder.isCollapsed = !vm.folder.isCollapsed
    },
    noop () {},
    focusRenameInput () {
      const vm = this as unknown as FolderInstance
      this.$nextTick(() => {
        const renameInput = this.$refs.renameInput as HTMLInputElement | undefined
        if (renameInput) {
          renameInput.focus()
          vm.newName = vm.folder.name
        }
      })
    },
    handleInputFocus () {
      const vm = this as unknown as FolderInstance
      this.$nextTick(() => {
        const input = this.$refs.input as HTMLInputElement | undefined
        input?.focus()
        vm.createName = ''
        vm.folder.isCollapsed = false
      })
    },
    handleInputEnter () {
      const vm = this as unknown as FolderInstance
      this.$store.dispatch('CREATE_FILE_DIRECTORY', vm.createName)
    },
    rename () {
      const vm = this as unknown as FolderInstance
      const { newName } = vm
      if (newName) {
        this.$store.dispatch('RENAME_IN_SIDEBAR', newName)
      }
    }
  }
})
</script>

<style scoped>
  .side-bar-folder {
    & > .folder-name {
      cursor: default;
      user-select: none;
      display: flex;
      align-items: center;
      height: 30px;
      padding-right: 15px;
      & > svg {
        flex-shrink: 0;
        color: var(--sideBarIconColor);
        margin-right: 5px;
      }
      &:hover {
        background: var(--sideBarItemHoverBgColor);
      }
    }
  }
  .new-input, input.rename {
    outline: none;
    height: 22px;
    margin: 5px 0;
    padding: 0 6px;
    color: var(--sideBarColor);
    border: 1px solid var(--floatBorderColor);
    background: var(--floatBorderColor);
    width: 70%;
    border-radius: 3px;
  }
</style>
