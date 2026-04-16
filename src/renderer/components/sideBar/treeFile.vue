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
import { fileMixins } from '../../mixins'
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

export default Vue.extend({
  mixins: [fileMixins],
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
    this.$nextTick(() => {
      (this.$refs.file as HTMLDivElement | undefined)?.addEventListener('contextmenu', this.handleContextMenu)
      bus.$on('SIDEBAR::show-rename-input', this.focusRenameInput)
    })
  },
  beforeDestroy () {
    bus.$off('SIDEBAR::show-rename-input', this.focusRenameInput)
  },
  methods: {
    noop () {},
    handleContextMenu (event: MouseEvent) {
      event.preventDefault()
      this.$store.dispatch('CHANGE_ACTIVE_ITEM', this.file)
      showContextMenu(event, !!this.clipboard)
    },
    focusRenameInput () {
      this.$nextTick(() => {
        const renameInput = this.$refs.renameInput as HTMLInputElement | undefined
        if (renameInput) {
          renameInput.focus()
          this.newName = this.file.name
        }
      })
    },
    rename () {
      if (this.newName) {
        this.$store.dispatch('RENAME_IN_SIDEBAR', this.newName)
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
