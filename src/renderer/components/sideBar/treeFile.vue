<template>
  <div
    :title="file.pathname"
    class="side-bar-file"
    :style="{'padding-left': `${(depth * 20) + 20}px`, 'opacity': file.isMarkdown ? 1 : 0.75 }"
    @click="handleFileClick()"
    :class="[{'current': currentFile.pathname === file.pathname, 'active': file.id === activeItem.id }]"
    ref="file"
  >
    <file-icon
      :name="file.name"
    ></file-icon>
    <input
      type="text"
      @click.stop="noop"
      class="rename"
      v-if="renameCache === file.pathname"
      v-model="newName"
      ref="renameInput"
      @keydown.enter="rename"
    >
    <span v-else>{{ file.name }}</span>
  </div>
</template>

<script lang="ts">
import Vue, { type PropType } from 'vue'
import FileIcon from './icon.vue'
import { ipcRenderer } from 'electron'
import { isSamePathSync } from 'common/filesystem/paths'
import { showContextMenu } from '../../contextMenu/sideBar'
import bus from '../../bus'
import type { TreeFileEntry } from '@/store/treeCtrl'
import type { DocumentState } from '@/store/help'

interface ProjectStoreState {
  project: {
    renameCache: string | null
    activeItem: Partial<TreeFileEntry>
    clipboard: unknown
  }
  editor: {
    currentFile: DocumentState
    tabs: DocumentState[]
  }
}

interface TreeFileVm extends Vue {
  file: TreeFileEntry
  currentFile: DocumentState
  tabs: DocumentState[]
  clipboard: unknown
  newName: string
  focusRenameInput(): void
  handleContextMenu(event: MouseEvent): void
}

export default Vue.extend({
  name: 'file',
  components: {
    FileIcon
  },
  props: {
    file: {
      type: Object as PropType<TreeFileEntry>,
      required: true
    },
    depth: {
      type: Number,
      required: true
    }
  },
  data () {
    return {
      newName: ''
    }
  },
  computed: {
    renameCache (): string | null {
      return (this.$store.state as ProjectStoreState).project.renameCache
    },
    activeItem (): Partial<TreeFileEntry> {
      return (this.$store.state as ProjectStoreState).project.activeItem
    },
    clipboard (): unknown {
      return (this.$store.state as ProjectStoreState).project.clipboard
    },
    currentFile (): DocumentState {
      return (this.$store.state as ProjectStoreState).editor.currentFile
    },
    tabs (): DocumentState[] {
      return (this.$store.state as ProjectStoreState).editor.tabs
    }
  },
  created () {
    const vm = this as unknown as TreeFileVm
    this.$nextTick(() => {
      (this.$refs.file as HTMLDivElement | undefined)?.addEventListener('contextmenu', vm.handleContextMenu as (event: MouseEvent) => void)
      bus.$on('SIDEBAR::show-rename-input', vm.focusRenameInput)
    })
  },
  beforeDestroy () {
    const vm = this as unknown as TreeFileVm
    bus.$off('SIDEBAR::show-rename-input', vm.focusRenameInput)
  },
  methods: {
    noop () {},
    handleFileClick () {
      const vm = this as unknown as TreeFileVm
      const { file } = vm
      const { isMarkdown, pathname } = file
      if (!isMarkdown || !pathname) return

      const openedTab = vm.tabs.find(tab => isSamePathSync(tab.pathname, pathname))
      if (openedTab) {
        if (vm.currentFile === openedTab) {
          return
        }
        vm.$store.dispatch('UPDATE_CURRENT_FILE', openedTab)
      } else {
        ipcRenderer.send('mt::open-file', pathname, {})
      }
    },
    handleContextMenu (event: MouseEvent) {
      const vm = this as unknown as TreeFileVm
      event.preventDefault()
      vm.$store.dispatch('CHANGE_ACTIVE_ITEM', vm.file)
      showContextMenu(event, !!vm.clipboard)
    },
    focusRenameInput () {
      const vm = this as unknown as TreeFileVm
      this.$nextTick(() => {
        const renameInput = this.$refs.renameInput as HTMLInputElement | undefined
        if (renameInput) {
          renameInput.focus()
          vm.newName = vm.file.name
        }
      })
    },
    rename () {
      const vm = this as unknown as TreeFileVm
      if (vm.newName) {
        vm.$store.dispatch('RENAME_IN_SIDEBAR', vm.newName)
      }
    }
  }
})
</script>

<style scoped>
  .side-bar-file {
    display: flex;
    position: relative;
    align-items: center;
    cursor: default;
    user-select: none;
    height: 30px;
    box-sizing: border-box;
    padding-right: 15px;
    &:hover {
      background: var(--sideBarItemHoverBgColor);
    }
    & > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    &::before {
      content: '';
      position: absolute;
      display: block;
      left: 0;
      background: var(--themeColor);
      width: 2px;
      height: 0;
      top: 50%;
      transform: translateY(-50%);
      transition: all .2s ease;
    }
  }
  .side-bar-file.current::before {
    height: 100%;
  }
  .side-bar-file.current > span {
    color: var(--themeColor);
  }
  .side-bar-file.active > span {
    color: var(--sideBarTitleColor);
  }
  input.rename {
    height: 22px;
    outline: none;
    margin: 5px 0;
    padding: 0 8px;
    color: var(--sideBarColor);
    border: 1px solid var(--floatBorderColor);
    background: var(--floatBorderColor);
    width: 100%;
    border-radius: 3px;
  }
</style>
