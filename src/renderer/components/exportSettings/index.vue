<template>
  <div class="print-settings-dialog">
    <el-dialog
      :visible.sync="showExportSettingsDialog"
      :show-close="false"
      :modal="true"
      custom-class="ag-dialog-table"
      width="500px"
    >
      <h3>Export Options</h3>
      <el-tabs v-model="activeName">
        <el-tab-pane label="Info" name="info">
          <span class="text">Please customize the page appearance and click on "export" to continue.</span>
        </el-tab-pane>
        <el-tab-pane label="Page" name="page">
          <!-- HTML -->
          <div v-if="!isPrintable">
            <text-box
              description="The page title:"
              :input="htmlTitle"
              :emitTime="0"
              :onChange="value => onSelectChange('htmlTitle', value)"
            ></text-box>
          </div>

          <!-- PDF/Print -->
          <div v-if="isPrintable">
            <div v-if="exportType === 'pdf'">
              <cur-select
                class="page-size-select"
                description="Page size:"
                :value="pageSize"
                :options="pageSizeList"
                :onChange="value => onSelectChange('pageSize', value)"
              ></cur-select>
              <div v-if="pageSize === 'custom'" class="row">
                <div>Width/Height in mm:</div>
                <el-input-number v-model="pageSizeWidth" size="mini" controls-position="right" :min="100"></el-input-number>
                <el-input-number v-model="pageSizeHeight" size="mini" controls-position="right" :min="100"></el-input-number>
              </div>

              <bool
                description="Landscape orientation:"
                :bool="isLandscape"
                :onChange="value => onSelectChange('isLandscape', value)"
              ></bool>
            </div>

            <div class="row">
              <div class="description">Page margin in mm:</div>
              <div>
                <div class="label">Top/Bottom:</div>
                <el-input-number v-model="pageMarginTop" size="mini" controls-position="right" :min="0" :max="100"></el-input-number>
                <el-input-number v-model="pageMarginBottom" size="mini" controls-position="right" :min="0" :max="100"></el-input-number>
              </div>
              <div>
                <div class="label">Left/Right:</div>
                <el-input-number v-model="pageMarginLeft" size="mini" controls-position="right" :min="0" :max="100"></el-input-number>
                <el-input-number v-model="pageMarginRight" size="mini" controls-position="right" :min="0" :max="100"></el-input-number>
              </div>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="Style" name="style">
          <bool
            description="Overwrite theme font settings:"
            :bool="fontSettingsOverwrite"
            :onChange="value => onSelectChange('fontSettingsOverwrite', value)"
          ></bool>
          <div v-if="fontSettingsOverwrite">
            <font-text-box
              description="Font family:"
              :value="fontFamily"
              :onChange="value => onSelectChange('fontFamily', value)"
            ></font-text-box>
            <range
              description="Font size"
              :value="fontSize"
              :min="8"
              :max="32"
              unit="px"
              :step="1"
              :onChange="value => onSelectChange('fontSize', value)"
            ></range>
            <range
              description="Line height"
              :value="lineHeight"
              :min="1.0"
              :max="2.0"
              :step="0.1"
              :onChange="value => onSelectChange('lineHeight', value)"
            ></range>
          </div>
          <bool
            description="Auto numbering headings:"
            :bool="autoNumberingHeadings"
            :onChange="value => onSelectChange('autoNumberingHeadings', value)"
          ></bool>
          <bool
            description="Show front matter:"
            :bool="showFrontMatter"
            :onChange="value => onSelectChange('showFrontMatter', value)"
          ></bool>
        </el-tab-pane>
        <el-tab-pane label="Theme" name="theme">
          <div class="text">You can change the document appearance by choosing a theme or create a handcrafted one.</div>
          <cur-select
            description="Theme:"
            more="https://github.com/marktext/marktext/blob/develop/docs/EXPORT_THEMES.md"
            :value="theme"
            :options="themeList"
            :onChange="value => onSelectChange('theme', value)"
          ></cur-select>
        </el-tab-pane>
        <el-tab-pane v-if="isPrintable" label="Header & Footer" name="header">
          <div class="text">The text appear on all pages if header and/or footer is defined.</div>
          <cur-select
            description="Header type:"
            :value="headerType"
            :options="headerFooterTypes"
            :onChange="value => onSelectChange('headerType', value)"
          ></cur-select>
          <text-box
            v-if="headerType === 2"
            description="The left header text:"
            :input="headerTextLeft"
            :emitTime="0"
            :onChange="value => onSelectChange('headerTextLeft', value)"
          ></text-box>
          <text-box
            v-if="headerType !== 0"
            description="The main header text:"
            :input="headerTextCenter"
            :emitTime="0"
            :onChange="value => onSelectChange('headerTextCenter', value)"
          ></text-box>
          <text-box
            v-if="headerType === 2"
            description="The right header text:"
            :input="headerTextRight"
            :emitTime="0"
            :onChange="value => onSelectChange('headerTextRight', value)"
          ></text-box>

          <cur-select
            description="Footer type:"
            :value="footerType"
            :options="headerFooterTypes"
            :onChange="value => onSelectChange('footerType', value)"
          ></cur-select>
          <text-box
            v-if="footerType === 2"
            description="The left footer text:"
            :input="footerTextLeft"
            :emitTime="0"
            :onChange="value => onSelectChange('footerTextLeft', value)"
          ></text-box>
          <text-box
            v-if="footerType !== 0"
            description="The main footer text:"
            :input="footerTextCenter"
            :emitTime="0"
            :onChange="value => onSelectChange('footerTextCenter', value)"
          ></text-box>
          <text-box
            v-if="footerType === 2"
            description="The right footer text:"
            :input="footerTextRight"
            :emitTime="0"
            :onChange="value => onSelectChange('footerTextRight', value)"
          ></text-box>

          <bool
            description="Customize style:"
            :bool="headerFooterCustomize"
            :onChange="value => onSelectChange('headerFooterCustomize', value)"
          ></bool>

          <div v-if="headerFooterCustomize">
            <bool
              description="Allow styled header and footer:"
              :bool="headerFooterStyled"
              :onChange="value => onSelectChange('headerFooterStyled', value)"
            ></bool>
            <range
              description="Header and footer font size"
              :value="headerFooterFontSize"
              :min="8"
              :max="20"
              unit="px"
              :step="1"
              :onChange="value => onSelectChange('headerFooterFontSize', value)"
            ></range>
          </div>
        </el-tab-pane>

        <el-tab-pane label="Table of Contents" name="toc">
          <bool
            description="Include top heading:"
            detailedDescription="Includes the first heading level too."
            :bool="tocIncludeTopHeading"
            :onChange="value => onSelectChange('tocIncludeTopHeading', value)"
          ></bool>
          <text-box
            description="Title:"
            :input="tocTitle"
            :emitTime="0"
            :onChange="value => onSelectChange('tocTitle', value)"
          ></text-box>
         </el-tab-pane>
      </el-tabs>
      <div class="button-controlls">
        <button class="button-primary" @click="handleClicked">
          Export...
        </button>
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { isDirectory, isFile } from 'common/filesystem'
import bus from '../../bus'
import Bool from '@/prefComponents/common/bool/index.vue'
import CurSelect from '@/prefComponents/common/select/index.vue'
import FontTextBox from '@/prefComponents/common/fontTextBox/index.vue'
import Range from '@/prefComponents/common/range/index.vue'
import TextBox from '@/prefComponents/common/textBox/index.vue'
import {
  pageSizeList,
  headerFooterTypes,
  headerFooterStyles,
  exportThemeList,
  type SelectOption
} from './exportOptions'

type ExportType = 'pdf' | 'print' | 'styledHtml'
type ActiveTabName = 'info' | 'page' | 'style' | 'theme' | 'header' | 'toc'

interface HeaderFooterSection {
  type: number
  left: string
  center: string
  right: string
}

interface ExportPayload {
  type: ExportType
  pageSize: string
  pageSizeWidth: number
  pageSizeHeight: number
  isLandscape: boolean
  pageMarginTop: number
  pageMarginRight: number
  pageMarginBottom: number
  pageMarginLeft: number
  autoNumberingHeadings: boolean
  showFrontMatter: boolean
  theme: string | null
  tocTitle: string
  tocIncludeTopHeading: boolean
  htmlTitle?: string
  fontSize?: number
  lineHeight?: number
  fontFamily?: string | null
  header?: HeaderFooterSection
  footer?: HeaderFooterSection
  headerFooterStyled?: boolean
  headerFooterFontSize?: number
}

interface ExportSettingsState {
  exportType: ExportType
  themesLoaded: boolean
  pageSizeList: SelectOption<string>[]
  headerFooterTypes: SelectOption<number>[]
  headerFooterStyles: SelectOption<number>[]
  isPrintable: boolean
  showExportSettingsDialog: boolean
  activeName: ActiveTabName
  htmlTitle: string
  pageSize: string
  pageSizeWidth: number
  pageSizeHeight: number
  isLandscape: boolean
  pageMarginTop: number
  pageMarginRight: number
  pageMarginBottom: number
  pageMarginLeft: number
  fontSettingsOverwrite: boolean
  fontFamily: string
  fontSize: number
  lineHeight: number
  autoNumberingHeadings: boolean
  showFrontMatter: boolean
  theme: string
  themeList: SelectOption<string>[]
  headerType: number
  headerTextLeft: string
  headerTextCenter: string
  headerTextRight: string
  footerType: number
  footerTextLeft: string
  footerTextCenter: string
  footerTextRight: string
  headerFooterCustomize: boolean
  headerFooterStyled: boolean
  headerFooterFontSize: number
  tocTitle: string
  tocIncludeTopHeading: boolean
}

type ExportSettingsVm = Vue & ExportSettingsState

export default Vue.extend({
  components: {
    Bool,
    CurSelect,
    FontTextBox,
    Range,
    TextBox
  },
  data () {
    return {
      exportType: 'pdf' as ExportType,
      themesLoaded: false,
      pageSizeList,
      headerFooterTypes,
      headerFooterStyles,
      isPrintable: true,
      showExportSettingsDialog: false,
      activeName: 'info' as ActiveTabName,
      htmlTitle: '',
      pageSize: 'A4',
      pageSizeWidth: 210,
      pageSizeHeight: 297,
      isLandscape: false,
      pageMarginTop: 20,
      pageMarginRight: 15,
      pageMarginBottom: 20,
      pageMarginLeft: 15,
      fontSettingsOverwrite: false,
      fontFamily: 'Default',
      fontSize: 14,
      lineHeight: 1.5,
      autoNumberingHeadings: false,
      showFrontMatter: false,
      theme: 'default',
      themeList: exportThemeList.slice(),
      headerType: 0,
      headerTextLeft: '',
      headerTextCenter: '',
      headerTextRight: '',
      footerType: 0,
      footerTextLeft: '',
      footerTextCenter: '',
      footerTextRight: '',
      headerFooterCustomize: false,
      headerFooterStyled: true,
      headerFooterFontSize: 12,
      tocTitle: '',
      tocIncludeTopHeading: true
    }
  },
  created () {
    bus.$on('showExportDialog', this.showDialog)
  },
  beforeDestroy () {
    bus.$off('showExportDialog', this.showDialog)
  },
  methods: {
    showDialog (type: ExportType) {
      const vm = this as ExportSettingsVm
      vm.exportType = type
      vm.isPrintable = type !== 'styledHtml'
      if (!vm.isPrintable && (vm.activeName === 'header' || vm.activeName === 'page')) {
        vm.activeName = 'info'
      }

      vm.showExportSettingsDialog = true
      bus.$emit('editor-blur')

      if (!vm.themesLoaded) {
        vm.themesLoaded = true
        this.loadThemesFromDisk()
      }
    },
    handleClicked () {
      const vm = this as ExportSettingsVm
      const {
        exportType,
        isPrintable,
        htmlTitle,
        pageSize,
        pageSizeWidth,
        pageSizeHeight,
        isLandscape,
        pageMarginTop,
        pageMarginRight,
        pageMarginBottom,
        pageMarginLeft,
        fontSettingsOverwrite,
        fontFamily,
        fontSize,
        lineHeight,
        autoNumberingHeadings,
        showFrontMatter,
        theme,
        headerType,
        headerTextLeft,
        headerTextCenter,
        headerTextRight,
        footerType,
        footerTextLeft,
        footerTextCenter,
        footerTextRight,
        headerFooterCustomize,
        headerFooterStyled,
        headerFooterFontSize,
        tocTitle,
        tocIncludeTopHeading
      } = vm
      const options: ExportPayload = {
        type: exportType,
        pageSize,
        pageSizeWidth,
        pageSizeHeight,
        isLandscape,
        pageMarginTop,
        pageMarginRight,
        pageMarginBottom,
        pageMarginLeft,
        autoNumberingHeadings,
        showFrontMatter,
        theme: theme === 'default' ? null : theme,
        tocTitle,
        tocIncludeTopHeading
      }

      if (!isPrintable) {
        options.htmlTitle = htmlTitle
      }

      if (fontSettingsOverwrite) {
        Object.assign(options, {
          fontSize,
          lineHeight,
          fontFamily: fontFamily === 'Default' ? null : fontFamily
        })
      }

      if (headerType !== 0) {
        Object.assign(options, {
          header: {
            type: headerType,
            left: headerTextLeft,
            center: headerTextCenter,
            right: headerTextRight
          }
        })
      }

      if (footerType !== 0) {
        Object.assign(options, {
          footer: {
            type: footerType,
            left: footerTextLeft,
            center: footerTextCenter,
            right: footerTextRight
          }
        })
      }

      if (headerFooterCustomize) {
        Object.assign(options, {
          headerFooterStyled,
          headerFooterFontSize
        })
      }

      vm.showExportSettingsDialog = false
      bus.$emit('export', options)
    },
    onSelectChange<K extends keyof ExportSettingsState> (key: K, value: ExportSettingsState[K]) {
      const vm = this as ExportSettingsVm
      ;(vm as unknown as ExportSettingsState)[key] = value
    },
    loadThemesFromDisk () {
      const { userDataPath } = global.marktext.paths
      const themeDir = path.join(userDataPath, 'themes/export')

      if (isDirectory(themeDir)) {
        for (const filename of fs.readdirSync(themeDir)) {
          const fullname = path.join(themeDir, filename)
          if (/.+\.css$/i.test(filename) && isFile(fullname)) {
            fsPromises.readFile(fullname, 'utf8')
              .then(content => {
                const match = content.match(/^(?:\/\*+[ \t]*([A-z0-9 -]+)[ \t]*(?:\*+\/|[\n\r])?)/)
                const label = match && match[1] ? match[1] : filename

                ;(this as ExportSettingsVm).themeList.push({
                  value: filename,
                  label
                })
              })
              .catch((error: Error) => {
                console.error('loadThemesFromDisk failed:', error)
              })
          }
        }
      }
    }
  }
})
</script>

<style scoped>
  .print-settings-dialog {
    user-select: none;
  }
  .row {
    margin-bottom: 8px;
  }
  .description {
    margin-bottom: 10px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .label {
    margin-bottom: 5px;
  }
  .label ~ div {
    margin-right: 20px;
  }
  .text {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .button-controlls {
    margin-top: 8px;
    text-align: right;
  }

  .button-controlls .button-primary {
    font-size: 14px;
  }

  .el-tab-pane section:first-child {
    margin-top: 0;
  }
</style>
<style>
  .print-settings-dialog #pane-header .pref-text-box-item .el-input {
    width: 90% !important;
  }

  .print-settings-dialog .el-dialog__body {
    padding: 0 20px 20px 20px;
  }
  .print-settings-dialog .pref-select-item .el-select {
    width: 240px;
  }
  .print-settings-dialog .el-tabs__content {
    max-height: 350px;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .print-settings-dialog .el-tabs__content::-webkit-scrollbar:vertical {
    width: 5px;
  }
</style>
