<template>
  <div class="pref-image">
    <h4>Image</h4>
    <section class="image-ctrl">
      <div>Default action after an image is inserted from local folder or clipboard
        <el-tooltip class='item' effect='dark'
          content='Clipboard handling is only fully supported on macOS and Windows.'
          placement='top-start'>
          <i class="el-icon-info"></i>
        </el-tooltip>
      </div>
      <CurSelect :value="imageInsertAction" :options="imageActions"
        :onChange="value => onSelectChange('imageInsertAction', value)"></CurSelect>
    </section>
    <Separator />
    <FolderSetting v-if="imageInsertAction === 'folder' || imageInsertAction === 'path'" />
    <Uploader v-if="imageInsertAction === 'upload'" />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import Separator from '../common/separator/index.vue'
import Uploader from './components/uploader/index.vue'
import CurSelect from '@/prefComponents/common/select/index.vue'
import FolderSetting from './components/folderSetting/index.vue'
import { imageActions } from './config'
import type { ImageActionValue } from './config'
import type { PreferencesState } from '@/store/preferences'

interface ImageStoreState {
  preferences: Pick<PreferencesState, 'imageInsertAction'>
}

export default Vue.extend({
  components: {
    Separator,
    CurSelect,
    FolderSetting,
    Uploader
  },
  data () {
    return {
      imageActions
    }
  },
  computed: {
    imageInsertAction (): ImageActionValue {
      return (this.$store.state as ImageStoreState).preferences.imageInsertAction as ImageActionValue
    }
  },
  methods: {
    onSelectChange (type: 'imageInsertAction', value: ImageActionValue) {
      this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
    }
  }
})
</script>

<style>
.pref-image {
  & .image-ctrl {
    font-size: 14px;
    margin: 20px 0;
    color: var(--editorColor);
    & label {
      display: block;
      margin: 20px 0;
    }
  }
}
</style>
