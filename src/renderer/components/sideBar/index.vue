<template>
  <div
    v-show="showSideBar"
    class="side-bar"
    ref="sideBar"
    :style="[ !rightColumn ? { 'min-width': '45px' } : {}, { 'width': `${finalSideBarWidth}px` } ]"
  >
    <div class="left-column">
      <ul>
        <li
          v-for="(c, index) of sideBarIcons"
          :key="index"
          @click="handleLeftIconClick(c.name)"
          :class="{ 'active': c.name === rightColumn }"
        >
          <svg :viewBox="c.icon.viewBox">
            <use :xlink:href="c.icon.url"></use>
          </svg>
        </li>
      </ul>
      <ul class="bottom">
        <li
          v-for="(c, index) of sideBarBottomIcons"
          :key="index"
          @click="handleLeftBottomClick(c.name)"
        >
          <svg :viewBox="c.icon.viewBox">
            <use :xlink:href="c.icon.url"></use>
          </svg>
        </li>
      </ul>
    </div>
    <div class="right-column" v-show="rightColumn">
      <tree
        :project-tree="projectTree"
        :opened-files="openedFiles"
        :tabs="tabs"
        v-if="rightColumn === 'files'"
      ></tree>
      <side-bar-search
        v-else-if="rightColumn === 'search'"
      ></side-bar-search>
      <toc
        v-else-if="rightColumn === 'toc'"
      ></toc>
    </div>
    <div class="drag-bar" ref="dragBar" v-show="rightColumn"></div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { sideBarIcons, sideBarBottomIcons } from './help'
import Tree from './tree.vue'
import SideBarSearch from './search.vue'
import Toc from './toc.vue'
import type { TreeFolderEntry } from '@/store/treeCtrl'
import type { DocumentState } from '@/store/help'

interface SideBarStoreState {
  layout: {
    rightColumn: string
    showSideBar: boolean
    sideBarWidth: number
  }
  project: {
    projectTree: TreeFolderEntry | null
  }
  editor: {
    tabs: DocumentState[]
  }
}

type MouseHandler = ((event: MouseEvent) => void) | null

export default Vue.extend({
  components: {
    Tree,
    SideBarSearch,
    Toc
  },
  data () {
    return {
      sideBarIcons,
      sideBarBottomIcons,
      openedFiles: [] as DocumentState[],
      sideBarViewWidth: 280,
      mouseDownHandler: null as MouseHandler,
      mouseMoveHandler: null as MouseHandler,
      mouseUpHandler: null as MouseHandler
    }
  },
  computed: {
    rightColumn (): string {
      return (this.$store.state as SideBarStoreState).layout.rightColumn
    },
    showSideBar (): boolean {
      return (this.$store.state as SideBarStoreState).layout.showSideBar
    },
    projectTree (): TreeFolderEntry | null {
      return (this.$store.state as SideBarStoreState).project.projectTree
    },
    sideBarWidth (): number {
      return (this.$store.state as SideBarStoreState).layout.sideBarWidth
    },
    tabs (): DocumentState[] {
      return (this.$store.state as SideBarStoreState).editor.tabs
    },
    finalSideBarWidth (): number {
      if (!this.showSideBar) return 0
      if (this.rightColumn === '') return 45
      return this.sideBarViewWidth < 220 ? 220 : this.sideBarViewWidth
    }
  },
  mounted () {
    const dragBar = this.$refs.dragBar as HTMLElement | undefined
    if (!dragBar) {
      return
    }

    let startX = 0
    let currentSideBarWidth = this.sideBarWidth
    let startWidth = currentSideBarWidth

    this.sideBarViewWidth = currentSideBarWidth

    this.mouseUpHandler = () => {
      if (this.mouseMoveHandler) {
        document.removeEventListener('mousemove', this.mouseMoveHandler, false)
      }
      if (this.mouseUpHandler) {
        document.removeEventListener('mouseup', this.mouseUpHandler, false)
      }
      this.$store.dispatch('CHANGE_SIDE_BAR_WIDTH', currentSideBarWidth < 220 ? 220 : currentSideBarWidth)
    }

    this.mouseMoveHandler = (event: MouseEvent) => {
      const offset = event.clientX - startX
      currentSideBarWidth = startWidth + offset
      this.sideBarViewWidth = currentSideBarWidth
    }

    this.mouseDownHandler = (event: MouseEvent) => {
      startX = event.clientX
      startWidth = this.sideBarWidth
      if (this.mouseMoveHandler) {
        document.addEventListener('mousemove', this.mouseMoveHandler, false)
      }
      if (this.mouseUpHandler) {
        document.addEventListener('mouseup', this.mouseUpHandler, false)
      }
    }

    dragBar.addEventListener('mousedown', this.mouseDownHandler, false)
  },
  beforeDestroy () {
    const dragBar = this.$refs.dragBar as HTMLElement | undefined
    if (dragBar && this.mouseDownHandler) {
      dragBar.removeEventListener('mousedown', this.mouseDownHandler, false)
    }
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler, false)
    }
    if (this.mouseUpHandler) {
      document.removeEventListener('mouseup', this.mouseUpHandler, false)
    }
  },
  methods: {
    handleLeftIconClick (name: string) {
      if (this.rightColumn === name) {
        this.$store.commit('SET_LAYOUT', { rightColumn: '' })
        this.$store.dispatch('CHANGE_SIDE_BAR_WIDTH', this.finalSideBarWidth)
      } else {
        const needDispatch = this.rightColumn === ''
        this.$store.commit('SET_LAYOUT', { rightColumn: name })
        this.sideBarViewWidth = this.sideBarWidth
        if (needDispatch) {
          this.$store.dispatch('CHANGE_SIDE_BAR_WIDTH', this.finalSideBarWidth)
        }
      }
    },
    handleLeftBottomClick (name: string) {
      if (name === 'settings') {
        this.$store.dispatch('OPEN_SETTING_WINDOW')
      }
    }
  }
})
</script>

<style scoped>
  .side-bar {
    display: flex;
    flex-shrink: 0;
    flex-grow: 0;
    width: 280px;
    height: 100vh;
    min-width: 220px;
    position: relative;
    color: var(--sideBarColor);
    user-select: none;
    background: var(--sideBarBgColor);
    border-right: 1px solid var(--itemBgColor);
    & .left-column {
      & svg {
        fill: var(--iconColor);
      }
    }
  }

  .left-column {
    height: 100%;
    width: 45px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-top: 40px;
    box-sizing: border-box;
    & > ul {
      opacity: 1;
    }
  }

  .left-column ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    & > li {
      width: 45px;
      height: 45px;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: space-around;
      align-items: center;
      cursor: pointer;
      & > svg {
        width: 18px;
        height: 18px;
        fill: var(--sideBarIconColor);
        opacity: 1;
        transition: transform .25s ease-in-out;
      }
      &.active > svg {
        fill: var(--themeColor);
      }
    }
  }

  .side-bar:hover .left-column ul li svg {
    opacity: 1;
  }
  .right-column {
    flex: 1;
    width: calc(100% - 50px);
    overflow: hidden;
  }
  .drag-bar {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    height: 100%;
    width: 3px;
    cursor: col-resize;
    &:hover {
      border-right: 2px solid var(--iconColor);
    }
  }
</style>
