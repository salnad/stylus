<template>
  <div class="pref-spellchecker">
    <h4>Spelling</h4>
    <compound>
      <template #head>
        <bool
          description="Enable spell checking"
          :bool="spellcheckerEnabled"
          :onChange="handleSpellcheckerEnabled"
        ></bool>
      </template>
      <template #children>
        <bool
          description="Hide marks for spelling errors"
          :bool="spellcheckerNoUnderline"
          :disable="!spellcheckerEnabled"
          :onChange="value => onSelectChange('spellcheckerNoUnderline', value)"
        ></bool>
        <bool
          v-show="isOsx"
          description="Automatically detect document language"
          :bool="true"
          :disable="true"
        ></bool>
        <cur-select
          v-show="!isOsx"
          description="Default language for spell checking"
          :value="spellcheckerLanguage"
          :options="availableDictionaries"
          :disable="!spellcheckerEnabled"
          :onChange="handleSpellcheckerLanguage"
        ></cur-select>
      </template>
    </compound>

    <div v-if="isOsx && spellcheckerEnabled" class="description">
      The used language will be detected automatically while typing. Additional languages may be added through "Language & Region" in your system preferences pane.
    </div>

    <div v-if="!isOsx && spellcheckerEnabled">
      <h6 class="title">Custom dictionary:</h6>
      <div class="description">Edit words in custom dictionary.</div>
      <el-table
        :data="wordsInCustomDictionary"
        empty-text="No words available"
        style="width: 100%"
      >
        <el-table-column prop="word" label="Word">
        </el-table-column>

        <el-table-column fixed="right" label="Options" width="90">
          <template slot-scope="scope">
            <el-button @click="handleDeleteClick(scope.row)" type="text" size="small" title="Delete">
              <i class="el-icon-delete"></i>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { ipcRenderer } from 'electron'
import log from 'electron-log'
import type { PreferencesState } from '@/store/preferences'
import type { SelectOption } from '../general/config'
import Compound from '../common/compound/index.vue'
import CurSelect from '../common/select/index.vue'
import Bool from '../common/bool/index.vue'
import Separator from '../common/separator/index.vue'
import { isOsx } from '@/util'
import { SpellChecker } from '@/spellchecker'
import { getLanguageName } from '@/spellchecker/languageMap'
import notice from '@/services/notification'

interface RootState {
  preferences: PreferencesState
}

interface WordDictionaryEntry {
  word: string
}

export default Vue.extend({
  components: {
    Bool,
    Compound,
    CurSelect,
    Separator
  },
  data () {
    return {
      isOsx,
      availableDictionaries: [] as Array<SelectOption<string>>,
      wordsInCustomDictionary: [] as WordDictionaryEntry[],
      errorMessage: '',
      spellchecker: null as SpellChecker | null
    }
  },
  computed: {
    spellcheckerEnabled (): boolean {
      return (this.$store.state as RootState).preferences.spellcheckerEnabled
    },
    spellcheckerNoUnderline (): boolean {
      return (this.$store.state as RootState).preferences.spellcheckerNoUnderline
    },
    spellcheckerLanguage (): string {
      return (this.$store.state as RootState).preferences.spellcheckerLanguage
    }
  },
  mounted () {
    if (!isOsx) {
      this.getAvailableDictionaries()
        .then(dicts => {
          this.availableDictionaries = dicts
        })

      ipcRenderer.invoke('mt::spellchecker-get-custom-dictionary-words')
        .then((words: string[]) => {
          this.wordsInCustomDictionary = words.map(word => ({ word }))
        })
    }
  },
  methods: {
    async getAvailableDictionaries (): Promise<Array<SelectOption<string>>> {
      const dictionaries = await SpellChecker.getAvailableDictionaries()
      return dictionaries.map(selectedItem => ({
        value: selectedItem,
        label: getLanguageName(selectedItem) ?? `Unknown (${selectedItem})`
      }))
    },
    async ensureDictLanguage (lang: string): Promise<void> {
      if (!this.spellchecker) {
        this.spellchecker = new SpellChecker(true, 'en-US')
      }
      await this.spellchecker.switchLanguage(lang)
    },

    handleSpellcheckerLanguage (languageCode: string) {
      this.ensureDictLanguage(languageCode)
        .then(() => {
          this.onSelectChange('spellcheckerLanguage', languageCode)
        })
        .catch((error: Error) => {
          log.error(error)
          notice.notify({
            title: 'Failed to switch language',
            type: 'error',
            message: error.message
          })
        })
    },
    handleSpellcheckerEnabled (isEnabled: boolean) {
      this.onSelectChange('spellcheckerEnabled', isEnabled)
    },
    onSelectChange (type: keyof PreferencesState, value: PreferencesState[keyof PreferencesState]) {
      this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
    },
    handleDeleteClick (selectedItem: WordDictionaryEntry) {
      if (selectedItem && typeof selectedItem.word === 'string') {
        ipcRenderer.invoke('mt::spellchecker-remove-word', selectedItem.word)
          .then((success: boolean) => {
            if (success) {
              this.wordsInCustomDictionary = this.wordsInCustomDictionary.filter(item => item.word !== selectedItem.word)
            } else {
              notice.notify({
                title: 'Failed to remove custom word',
                type: 'error',
                message: 'An unexpected error occurred while saving.'
              })
            }
          })
          .catch((error: Error) => log.error(error))
      }
    }
  }
})
</script>

<style scoped>
  .pref-spellchecker {
    & div.description {
      margin-top: 10px;
      margin-bottom: 2px;
      color: var(--iconColor);
      font-size: 14px;
    }
    & h6.title {
      font-weight: 400;
      font-size: 1.1em;
      margin-bottom: 0;
    }
  }
  .el-table, .el-table__expanded-cell {
    background: var(--editorBgColor);
  }
  .el-table button {
    padding: 1px 2px;
    margin: 5px 10px;
    color: var(--themeColor);
    background: none;
    border: none;
  }
  .el-table button:hover,
  .el-table button:active {
    opacity: 0.9;
    background: none;
    border: none;
  }
</style>
<style>
  .pref-spellchecker .el-table table {
    margin: 0;
    border: none;
  }
  .pref-spellchecker .el-table th,
  .pref-spellchecker .el-table tr {
    background: var(--editorBgColor);
  }
  .pref-spellchecker .el-table th.el-table__cell.is-leaf,
  .pref-spellchecker .el-table th,
  .pref-spellchecker .el-table td {
    border: none;
  }
  .pref-spellchecker .el-table th.el-table__cell.is-leaf:last-child,
  .pref-spellchecker .el-table th:last-child,
  .pref-spellchecker .el-table td:last-child {
    border-right: 1px solid var(--tableBorderColor);
  }
  .pref-spellchecker .el-table--border::after,
  .pref-spellchecker .el-table--group::after,
  .pref-spellchecker .el-table::before,
  .pref-spellchecker .el-table__fixed-right::before,
  .pref-spellchecker .el-table__fixed::before {
    background: var(--tableBorderColor);
  }
  .pref-spellchecker .el-table__body tr.hover-row.current-row>td,
  .pref-spellchecker .el-table__body tr.hover-row.el-table__row--striped.current-row>td,
  .pref-spellchecker .el-table__body tr.hover-row.el-table__row--striped>td,
  .pref-spellchecker .el-table__body tr.hover-row>td {
    background: var(--selectionColor);
  }
  .pref-spellchecker .el-table .el-table__cell {
    padding: 2px 0;
    margin: 4px 6px;
  }

  .pref-spellchecker li.el-select-dropdown__item {
    color: var(--editorColor);
    height: 30px;
  }
  .pref-spellchecker li.el-select-dropdown__item.hover, li.el-select-dropdown__item:hover {
    background: var(--floatHoverColor);
  }
  .pref-spellchecker div.el-select-dropdown {
    background: var(--floatBgColor);
    border-color: var(--floatBorderColor);
    & .popper__arrow {
      display: none;
    }
  }
  .pref-spellchecker input.el-input__inner {
    height: 30px;
    background: transparent;
    color: var(--editorColor);
    border-color: var(--editorColor10);
  }
  .pref-spellchecker .el-input__icon,
  .pref-spellchecker .el-input__inner {
    line-height: 30px;
  }
</style>
