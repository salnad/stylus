<template>
  <div class="about-dialog">
    <el-dialog
      :visible.sync="showAboutDialog"
      :show-close="false"
      :modal="true"
      custom-class="ag-dialog-table"
      width="400px"
    >
      <img class="logo" :src="logo" />
      <el-row>
        <el-col :span="24">
          <h3 class="title">{{ name }}</h3>
        </el-col>
        <el-col :span="24">
          <div class="text">{{ appVersion }}</div>
        </el-col>
        <el-col :span="24">
          <div class="text" style="min-height: auto">{{ copyright }}</div>
        </el-col>
        <el-col :span="24">
          <div class="text">{{ copyrightContributors }}</div>
        </el-col>
      </el-row>
    </el-dialog>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import bus from '../../bus'
import MarkTextLogo from '../../assets/images/logo.png'

interface AboutStoreState {
  appVersion: string
}

export default Vue.extend({
  data () {
    const currentYear = new Date().getFullYear()
    return {
      name: 'MarkText',
      copyright: `Copyright © 2017-${currentYear} Luo Ran`,
      copyrightContributors: `Copyright © 2018-${currentYear} MarkText Contributors`,
      logo: MarkTextLogo,
      showAboutDialog: false
    }
  },
  computed: {
    appVersion (): string {
      return (this.$store.state as AboutStoreState).appVersion
    }
  },
  created () {
    bus.$on('aboutDialog', this.showDialog)
  },
  beforeDestroy () {
    bus.$off('aboutDialog', this.showDialog)
  },
  methods: {
    showDialog () {
      this.showAboutDialog = true
      bus.$emit('editor-blur')
    }
  }
})
</script>

<style>
  .about-dialog el-row,
  .about-dialog el-col {
    display: block;
  }

  .about-dialog img.logo {
    width: 80px;
    height: 80px;
    display: inherit;
    margin: 0 auto;
  }

  .about-dialog .title,
  .about-dialog .text {
    min-height: 32px;
    text-align: center;
  }

  .about-dialog .title {
    color: var(--floatFontColor);
  }

  .about-dialog .text {
    color: var(--floatFontColor);
  }
</style>
