<template>
  <div class="editor-tabs">
    <div
      class="scrollable-tabs"
      ref="tabContainer"
    >
      <ul
        ref="tabDropContainer"
        class="tabs-container"
      >
        <li
          :title="file.pathname"
          :class="{'active': currentFile.id === file.id, 'unsaved': !file.isSaved }"
          v-for="file of tabs"
          :key="file.id"
          :data-id="file.id"
          @click.stop="selectFile(file)"
          @click.middle="closeTab(file.id)"
          @contextmenu.prevent="handleContextMenu($event, file)"
        >
          <span>{{ file.filename }}</span>
          <svg class="close-icon icon" aria-hidden="true"
            @click.stop="removeFileInTab(file)"
          >
            <circle id="unsaved-circle-icon" cx="6" cy="6" r="3"></circle>
            <use id="default-close-icon" xlink:href="#icon-close-small"></use>
          </svg>
        </li>
      </ul>
    </div>
    <div
      class="new-file"
    >
      <svg class="icon" aria-hidden="true"
        @click.stop="newFile()"
      >
        <use xlink:href="#icon-plus"></use>
      </svg>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { shell, clipboard } from 'electron'
import autoScroll from 'dom-autoscroller'
import dragula from 'dragula'
import { tabsMixins } from '../../mixins'
import { showContextMenu } from '../../contextMenu/tabs'
import bus from '../../bus'
import type { DocumentState } from '@/store/help'

interface TabsStoreState {
  editor: {
    currentFile: DocumentState
    tabs: DocumentState[]
  }
}

interface AutoScrollerLike {
  down?: boolean
  destroy(force?: boolean): void
}

interface DrakeLike {
  dragging?: boolean
  destroy(): void
  on(event: 'drop', handler: (el: Element, target: Element | null, source: Element | null, sibling: Element | null) => void): DrakeLike
}

type MaybeElement = HTMLElement | SVGElement

export default Vue.extend({
  mixins: [tabsMixins],
  data () {
    return {
      autoScroller: null as AutoScrollerLike | null,
      drake: null as DrakeLike | null
    }
  },
  computed: {
    currentFile (): DocumentState {
      return (this.$store.state as TabsStoreState).editor.currentFile
    },
    tabs (): DocumentState[] {
      return (this.$store.state as TabsStoreState).editor.tabs
    }
  },
  methods: {
    newFile () {
      this.$store.dispatch('NEW_UNTITLED_TAB', {})
    },
    handleTabScroll (event: WheelEvent) {
      let delta = event.deltaY
      if (event.deltaX !== 0) {
        delta = event.deltaX
      }

      const tabContainer = this.$refs.tabContainer as HTMLElement | undefined
      if (!tabContainer) {
        return
      }

      const newLeft = Math.max(0, Math.min(tabContainer.scrollLeft + delta, tabContainer.scrollWidth))
      tabContainer.scrollLeft = newLeft
    },
    closeTab (tabId: string) {
      const tab = this.tabs.find(file => file.id === tabId)
      if (tab) {
        this.$store.dispatch('CLOSE_TAB', tab)
      }
    },
    closeOthers (tabId: string) {
      const tab = this.tabs.find(file => file.id === tabId)
      if (tab) {
        this.$store.dispatch('CLOSE_OTHER_TABS', tab)
      }
    },
    closeSaved () {
      this.$store.dispatch('CLOSE_SAVED_TABS')
    },
    closeAll () {
      this.$store.dispatch('CLOSE_ALL_TABS')
    },
    rename (tabId: string) {
      const tab = this.tabs.find(file => file.id === tabId)
      if (tab?.pathname) {
        this.$store.dispatch('RENAME_FILE', tab)
      }
    },
    copyPath (tabId: string) {
      const tab = this.tabs.find(file => file.id === tabId)
      if (tab?.pathname) {
        clipboard.writeText(tab.pathname)
      }
    },
    showInFolder (tabId: string) {
      const tab = this.tabs.find(file => file.id === tabId)
      if (tab?.pathname) {
        shell.showItemInFolder(tab.pathname)
      }
    },
    handleContextMenu (event: MouseEvent, tab: DocumentState) {
      if (tab.id) {
        showContextMenu(event, tab)
      }
    }
  },
  created () {
    this.$nextTick(() => {
      bus.$on('TABS::close-this', this.closeTab)
      bus.$on('TABS::close-others', this.closeOthers)
      bus.$on('TABS::close-saved', this.closeSaved)
      bus.$on('TABS::close-all', this.closeAll)
      bus.$on('TABS::rename', this.rename)
      bus.$on('TABS::copy-path', this.copyPath)
      bus.$on('TABS::show-in-folder', this.showInFolder)
    })
  },
  mounted () {
    this.$nextTick(() => {
      const tabContainer = this.$refs.tabContainer as HTMLElement | undefined
      const tabDropContainer = this.$refs.tabDropContainer as HTMLElement | undefined
      if (!tabContainer || !tabDropContainer) {
        return
      }

      tabContainer.addEventListener('wheel', this.handleTabScroll)

      const drake = dragula([tabDropContainer], {
        direction: 'horizontal',
        revertOnSpill: true,
        mirrorContainer: tabDropContainer,
        ignoreInputTextSelection: false
      }) as DrakeLike

      drake.on('drop', (el: Element, _target: Element | null, _source: Element | null, sibling: Element | null) => {
        const droppedId = el.getAttribute('data-id')
        const nextTabId = sibling?.getAttribute('data-id') ?? null
        const isLastTab = !sibling || sibling.classList.contains('gu-mirror')
        if (!droppedId || (sibling && !nextTabId)) {
          throw new Error('Cannot reorder tabs: invalid tab id.')
        }

        this.$store.dispatch('EXCHANGE_TABS_BY_ID', {
          fromId: droppedId,
          toId: isLastTab ? null : nextTabId
        })
      })
      this.drake = drake

      this.autoScroller = autoScroll([tabContainer as unknown as MaybeElement], {
        margin: 20,
        maxSpeed: 6,
        scrollWhenOutside: false,
        autoScroll: () => {
          return !!this.autoScroller?.down && !!drake.dragging
        }
      }) as AutoScrollerLike
    })
  },
  beforeDestroy () {
    const tabContainer = this.$refs.tabContainer as HTMLElement | undefined
    tabContainer?.removeEventListener('wheel', this.handleTabScroll)

    if (this.autoScroller) {
      this.autoScroller.destroy(true)
      this.autoScroller = null
    }
    if (this.drake) {
      this.drake.destroy()
      this.drake = null
    }

    bus.$off('TABS::close-this', this.closeTab)
    bus.$off('TABS::close-others', this.closeOthers)
    bus.$off('TABS::close-saved', this.closeSaved)
    bus.$off('TABS::close-all', this.closeAll)
    bus.$off('TABS::rename', this.rename)
    bus.$off('TABS::copy-path', this.copyPath)
    bus.$off('TABS::show-in-folder', this.showInFolder)
  }
})
</script>

<style scoped>
  svg.close-icon #unsaved-circle-icon {
    fill: var(--themeColor);
  }
  .editor-tabs {
    position: relative;
    display: flex;
    flex-direction: row;
    height: 35px;
    user-select: none;
    box-shadow: 0px 0px 9px 2px rgba(0, 0, 0, .1);
    overflow: hidden;
    &:hover > .new-file {
      opacity: 1 !important;
    }
  }
  .scrollable-tabs {
    flex: 0 1 auto;
    height: 35px;
    overflow: hidden;
  }
  .tabs-container {
    min-width: min-content;
    list-style: none;
    margin: 0;
    padding: 0;
    height: 35px;
    position: relative;
    display: flex;
    flex-direction: row;
    overflow-y: hidden;
    z-index: 2;
    &::-webkit-scrollbar:horizontal {
      display: none;
    }
    & > li {
      position: relative;
      padding: 0 8px;
      color: var(--editorColor50);
      font-size: 12px;
      line-height: 35px;
      height: 35px;
      max-width: 280px;
      background: var(--floatBgColor);
      display: flex;
      align-items: center;
      &[aria-grabbed="true"] {
        color: var(--editorColor30) !important;
      }
      & > svg {
        opacity: 0;
      }
      &:focus {
        outline: none;
      }
      &:hover > svg {
        opacity: 1;
      }
      &:hover > svg.close-icon #default-close-icon {
        display: block !important;
      }
      &:hover > svg.close-icon #unsaved-circle-icon {
        display: none !important;
      }
      & > span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-right: 3px;
      }
    }
    & > li.unsaved:not(.active) {
      & > svg.close-icon {
        opacity: 1;
      }
      & > svg.close-icon #unsaved-circle-icon {
        display: block;
      }
      & > svg.close-icon #default-close-icon {
        display: none;
      }
    }
    & > li.active {
      background: var(--itemBgColor);
      z-index: 3;
      &:after {
        content: '';
        position: absolute;
        left: 0;
        bottom: 0;
        right: 0;
        height: 2px;
        background: var(--themeColor);
      }
      & > svg {
        opacity: 1;
      }
      & > svg.close-icon #unsaved-circle-icon {
        display: none;
      }
    }
  }
  .editor-tabs > .new-file {
    flex: 0 0 35px;
    width: 35px;
    height: 35px;
    border-right: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: space-around;
    cursor: pointer;
    color: var(--editorColor50);
    opacity: 0;
    &.always-visible {
      opacity: 1;
    }
  }

  /* dragula effects */
  .gu-mirror {
    position: fixed !important;
    margin: 0 !important;
    z-index: 9999 !important;
    opacity: 0.8;
    cursor: grabbing;
  }
  .gu-hide {
    display: none !important;
  }
  .gu-unselectable {
    user-select: none !important;
  }
  .gu-transit {
    opacity: 0.2;
  }
</style>
