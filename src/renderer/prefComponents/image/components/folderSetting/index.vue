<template>
  <section class="image-folder">
    <h5>Global or relative image folder</h5>
    <text-box description="Global image folder" :input="imageFolderPath"
      :regexValidator="/^(?:$|([a-zA-Z]:)?[\/\\].*$)/" :defaultValue="folderPathPlaceholder"
      :onChange="value => modifyImageFolderPath(value)"></text-box>
    <div>
      <el-button size="mini" @click="modifyImageFolderPath(undefined)">Open...</el-button>
      <el-button size="mini" @click="openImageFolder">Show in Folder</el-button>
    </div>
    <compound>
      <template #head>
        <bool description="Prefer relative assets folder"
          more="https://github.com/marktext/marktext/blob/develop/docs/IMAGES.md"
          :bool="imagePreferRelativeDirectory"
          :onChange="value => onSelectChange('imagePreferRelativeDirectory', value)"></bool>
      </template>
      <template #children>
        <text-box description="Relative image folder name" :input="imageRelativeDirectoryName"
          :regexValidator="/^(?:$|(?![a-zA-Z]:)[^\/\\].*$)/"
          :defaultValue="relativeDirectoryNamePlaceholder"
          :onChange="value => onSelectChange('imageRelativeDirectoryName', value)"></text-box>
        <div class="footnote">
          Include <code>${filename}</code> in the text-box above to automatically insert the document file name.
        </div>
      </template>
    </compound>
  </section>
</template>

<script lang="ts">
import Vue from 'vue'
import { shell } from 'electron'
import Bool from '@/prefComponents/common/bool/index.vue'
import Compound from '@/prefComponents/common/compound/index.vue'
import TextBox from '@/prefComponents/common/textBox/index.vue'
import type { PreferencesState } from '@/store/preferences'

type FolderSettingPreferenceKey = 'imagePreferRelativeDirectory' | 'imageRelativeDirectoryName'

interface FolderSettingState {
  preferences: Pick<PreferencesState, 'imageFolderPath' | 'imagePreferRelativeDirectory' | 'imageRelativeDirectoryName' | 'imageInsertAction'>
}

export default Vue.extend({
  components: {
    Bool,
    Compound,
    TextBox
  },
  computed: {
    imageFolderPath (): string {
      return (this.$store.state as FolderSettingState).preferences.imageFolderPath
    },
    imagePreferRelativeDirectory (): boolean {
      return (this.$store.state as FolderSettingState).preferences.imagePreferRelativeDirectory
    },
    imageRelativeDirectoryName (): string {
      return (this.$store.state as FolderSettingState).preferences.imageRelativeDirectoryName
    },
    imageInsertAction (): PreferencesState['imageInsertAction'] {
      return (this.$store.state as FolderSettingState).preferences.imageInsertAction
    },
    folderPathPlaceholder (): string {
      return (this.$store.state as FolderSettingState).preferences.imageFolderPath || ''
    },
    relativeDirectoryNamePlaceholder (): string {
      return (this.$store.state as FolderSettingState).preferences.imageRelativeDirectoryName || 'assets'
    }
  },
  methods: {
    openImageFolder () {
      shell.openPath(this.imageFolderPath)
    },
    modifyImageFolderPath (value?: string) {
      return this.$store.dispatch('SET_IMAGE_FOLDER_PATH', value)
    },
    onSelectChange (type: FolderSettingPreferenceKey, value: PreferencesState[FolderSettingPreferenceKey]) {
      this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
    }
  }
})
</script>

<style scoped>
.image-folder .footnote {
  font-size: 13px;
  & code {
    font-size: 13px;
  }
}
</style>
