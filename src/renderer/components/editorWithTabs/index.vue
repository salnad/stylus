<template>
    <div
      class="editor-with-tabs"
      :style="{'max-width': showSideBar ? `calc(100vw - ${sideBarWidth}px` : '100vw' }"
    >
      <tabs v-show="showTabBar"></tabs>
      <div class="container">
        <editor
          :markdown="markdown"
          :cursor="cursor"
          :text-direction="textDirection"
          :platform="platform"
        ></editor>
        <source-code
          v-if="sourceCode"
          :markdown="markdown"
          :cursor="cursor"
          :text-direction="textDirection"
        ></source-code>
      </div>
      <tab-notifications></tab-notifications>
    </div>
</template>

<script lang="ts">
import Vue, { type PropType } from 'vue'
import Tabs from './tabs.vue'
import Editor from './editor.vue'
import SourceCode from './sourceCode.vue'
import TabNotifications from './notifications.vue'
import type { LayoutState } from '@/store/layout'

interface CursorLike {
  anchor?: unknown
  focus?: unknown
}

interface EditorWithTabsStoreState {
  layout: Pick<LayoutState, 'showSideBar' | 'sideBarWidth'>
}

export default Vue.extend({
  props: {
    markdown: {
      type: String,
      required: true
    },
    cursor: {
      type: Object as PropType<CursorLike>,
      required: true
    },
    sourceCode: {
      type: Boolean,
      required: true
    },
    showTabBar: {
      type: Boolean,
      required: true
    },
    textDirection: {
      type: String,
      required: true
    },
    platform: {
      type: String,
      required: true
    }
  },
  components: {
    Tabs,
    Editor,
    SourceCode,
    TabNotifications
  },
  computed: {
    showSideBar (): boolean {
      return (this.$store.state as EditorWithTabsStoreState).layout.showSideBar
    },
    sideBarWidth (): number {
      return (this.$store.state as EditorWithTabsStoreState).layout.sideBarWidth
    }
  }
})
</script>

<style scoped>
  .editor-with-tabs {
    position: relative;
    height: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;

    overflow: hidden;
    background: var(--editorBgColor);
    & > .container {
      flex: 1;
      overflow: hidden;
    }
  }
</style>
