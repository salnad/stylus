<template>
  <div class="pref-markdown">
    <h4>Markdown</h4>
    <compound>
      <template #head>
        <h6 class="title">Lists:</h6>
      </template>
      <template #children>
        <bool
          description="Prefer loose list items"
          :bool="preferLooseListItem"
          :onChange="value => onSelectChange('preferLooseListItem', value)"
          more="https://spec.commonmark.org/0.29/#loose"
        ></bool>
        <cur-select
          description="Preferred marker for bullet lists"
          :value="bulletListMarker"
          :options="bulletListMarkerOptions"
          :onChange="value => onSelectChange('bulletListMarker', value)"
          more="https://spec.commonmark.org/0.29/#bullet-list-marker"
        ></cur-select>
        <cur-select
          description="Preferred marker for ordered lists"
          :value="orderListDelimiter"
          :options="orderListDelimiterOptions"
          :onChange="value => onSelectChange('orderListDelimiter', value)"
          more="https://spec.commonmark.org/0.29/#ordered-list"
        ></cur-select>
        <cur-select
          description="Preferred list indentation"
          :value="listIndentation"
          :options="listIndentationOptions"
          :onChange="value => onSelectChange('listIndentation', value)"
        ></cur-select>
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">Markdown extensions:</h6>
      </template>
      <template #children>
        <cur-select
          description="Front matter format"
          :value="frontmatterType"
          :options="frontmatterTypeOptions"
          :onChange="value => onSelectChange('frontmatterType', value)"
        ></cur-select>
        <bool
          description="Enable Pandoc-style superscript and subscript"
          :bool="superSubScript"
          :onChange="value => onSelectChange('superSubScript', value)"
          more="https://pandoc.org/MANUAL.html#superscripts-and-subscripts"
        ></bool>
        <bool
          description="Enable Pandoc-style footnotes"
          notes="Requires restart."
          :bool="footnote"
          :onChange="value => onSelectChange('footnote', value)"
          more="https://pandoc.org/MANUAL.html#footnotes"
        ></bool>
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">Compatibility:</h6>
      </template>
      <template #children>
        <bool
          description="Enable HTML rendering"
          :bool="isHtmlEnabled"
          :onChange="value => onSelectChange('isHtmlEnabled', value)"
        ></bool>
        <bool
          description="Enable GitLab compatibility mode"
          :bool="isGitlabCompatibilityEnabled"
          :onChange="value => onSelectChange('isGitlabCompatibilityEnabled', value)"
        ></bool>
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">Diagrams:</h6>
      </template>
      <template #children>
        <cur-select
          description="Sequence diagram theme"
          :value="sequenceTheme"
          :options="sequenceThemeOptions"
          :onChange="value => onSelectChange('sequenceTheme', value)"
          more="https://bramp.github.io/js-sequence-diagrams/"
        ></cur-select>
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">Misc:</h6>
      </template>
      <template #children>
        <cur-select
          description="Preferred heading style"
          :value="preferHeadingStyle"
          :options="preferHeadingStyleOptions"
          :onChange="value => onSelectChange('preferHeadingStyle', value)"
          :disable="true"
        ></cur-select>
      </template>
    </compound>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import type { PreferenceState } from 'common/types/preferences'
import Compound from '../common/compound/index.vue'
import Bool from '../common/bool/index.vue'
import CurSelect from '../common/select/index.vue'
import {
  bulletListMarkerOptions,
  orderListDelimiterOptions,
  preferHeadingStyleOptions,
  listIndentationOptions,
  frontmatterTypeOptions,
  sequenceThemeOptions
} from './config'

interface PreferencesRootState {
  preferences: PreferenceState
}

type MarkdownPreferenceKey =
  | 'preferLooseListItem'
  | 'bulletListMarker'
  | 'orderListDelimiter'
  | 'preferHeadingStyle'
  | 'listIndentation'
  | 'frontmatterType'
  | 'superSubScript'
  | 'footnote'
  | 'isHtmlEnabled'
  | 'isGitlabCompatibilityEnabled'
  | 'sequenceTheme'

export default Vue.extend({
  components: {
    Compound,
    Bool,
    CurSelect
  },
  data () {
    return {
      bulletListMarkerOptions,
      orderListDelimiterOptions,
      preferHeadingStyleOptions,
      listIndentationOptions,
      frontmatterTypeOptions,
      sequenceThemeOptions
    }
  },
  computed: {
    preferLooseListItem (): boolean {
      return (this.$store.state as PreferencesRootState).preferences.preferLooseListItem
    },
    bulletListMarker (): PreferenceState['bulletListMarker'] {
      return (this.$store.state as PreferencesRootState).preferences.bulletListMarker
    },
    orderListDelimiter (): PreferenceState['orderListDelimiter'] {
      return (this.$store.state as PreferencesRootState).preferences.orderListDelimiter
    },
    preferHeadingStyle (): PreferenceState['preferHeadingStyle'] {
      return (this.$store.state as PreferencesRootState).preferences.preferHeadingStyle
    },
    listIndentation (): PreferenceState['listIndentation'] {
      return (this.$store.state as PreferencesRootState).preferences.listIndentation
    },
    frontmatterType (): PreferenceState['frontmatterType'] {
      return (this.$store.state as PreferencesRootState).preferences.frontmatterType
    },
    superSubScript (): boolean {
      return (this.$store.state as PreferencesRootState).preferences.superSubScript
    },
    footnote (): boolean {
      return (this.$store.state as PreferencesRootState).preferences.footnote
    },
    isHtmlEnabled (): boolean {
      return (this.$store.state as PreferencesRootState).preferences.isHtmlEnabled
    },
    isGitlabCompatibilityEnabled (): boolean {
      return (this.$store.state as PreferencesRootState).preferences.isGitlabCompatibilityEnabled
    },
    sequenceTheme (): PreferenceState['sequenceTheme'] {
      return (this.$store.state as PreferencesRootState).preferences.sequenceTheme
    }
  },
  methods: {
    onSelectChange (type: MarkdownPreferenceKey, value: PreferenceState[MarkdownPreferenceKey]) {
      this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
    }
  }
})
</script>

<style scoped>
  .pref-markdown {
  }
</style>
