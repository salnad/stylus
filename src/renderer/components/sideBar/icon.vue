<template>
    <span :class="className" class="file-icon"></span>
</template>

<script lang="ts">
import Vue from 'vue'
import fileIcons from 'muya/lib/ui/fileIcons'

export default Vue.extend({
  props: {
    name: {
      type: String,
      required: true,
      default: 'mock.md'
    }
  },
  computed: {
    className (): string[] {
      let classNames = fileIcons.getClassByName(this.name ? this.name : 'mock.md')

      if (!classNames) {
        // Use fallback icon when the icon is unknown.
        classNames = fileIcons.getClassByName('mock.md')
      }
      return (classNames || 'atom-icon light-cyan').split(/\s/)
    }
  }
})
</script>

<style scoped>
  .file-icon {
    flex-shrink: 0;
    margin-right: 5px;
  }
</style>
