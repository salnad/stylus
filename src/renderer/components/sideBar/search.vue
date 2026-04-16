<template>
    <div
      class="side-bar-search"
    >
      <div class="search-wrapper">
        <input
          type="text" v-model="keyword"
          placeholder="Search in folder..."
          @keyup="search"
        >
        <div class="controls">
          <span
            title="Case Sensitive"
            class="is-case-sensitive"
            :class="{'active': isCaseSensitive}"
            @click.stop="caseSensitiveClicked()"
          >
            <svg :viewBox="FindCaseIcon.viewBox" aria-hidden="true">
              <use :xlink:href="FindCaseIcon.url" />
            </svg>
          </span>
          <span
            title="Select whole word"
            class="is-whole-word"
            :class="{'active': isWholeWord}"
            @click.stop="wholeWordClicked()"
          >
            <svg :viewBox="FindWordIcon.viewBox" aria-hidden="true">
              <use :xlink:href="FindWordIcon.url" />
            </svg>
          </span>
          <span
            title="Use query as RegEx"
            class="is-regex"
            :class="{'active': isRegexp}"
            @click.stop="regexpClicked()"
          >
            <svg :viewBox="FindRegexIcon.viewBox" aria-hidden="true">
              <use :xlink:href="FindRegexIcon.url" />
            </svg>
          </span>
        </div>
      </div>

      <div class="search-message-section" v-if="showNoFolderOpenedMessage">
        <span>No folder open</span>
      </div>
      <div class="search-message-section" v-if="showNoResultFoundMessage">No results found.</div>
      <div class="search-message-section" v-if="searchErrorString">{{ searchErrorString }}</div>

      <div
        class="cancel-area"
        v-show="showSearchCancelArea"
      >
        <el-button
          type="primary"
          size="mini"
          @click="cancelSearcher"
        >
          Cancel <i class="el-icon-video-pause"></i>
        </el-button>
      </div>
      <div v-if="searchResult.length" class="search-result-info">{{searchResultInfo}}</div>
      <div class="search-result" v-if="searchResult.length">
        <search-result-item
          v-for="(item, index) of searchResult"
          :key="index"
          :searchResult="item"
        ></search-result-item>
      </div>
      <div class="empty" v-else>
        <div class="no-data">
          <svg :viewBox="EmptyIcon.viewBox" aria-hidden="true">
            <use :xlink:href="EmptyIcon.url" />
          </svg>
          <button
            class="button-primary"
            v-if="showNoFolderOpenedMessage"
            @click="openFolder"
          >
            Open Folder
          </button>
        </div>
      </div>
    </div>
</template>

<script lang="ts">
import Vue from 'vue'
import bus from '../../bus'
import log from 'electron-log'
import SearchResultItem from './searchResultItem.vue'
import RipgrepDirectorySearcher, { type SearchResult } from '../../node/ripgrepSearcher'
import EmptyIcon from '@/assets/icons/undraw_empty.svg'
import FindCaseIcon from '@/assets/icons/searchIcons/iconCase.svg'
import FindWordIcon from '@/assets/icons/searchIcons/iconWord.svg'
import FindRegexIcon from '@/assets/icons/searchIcons/iconRegex.svg'
import { MARKDOWN_INCLUSIONS } from '../../../common/filesystem/paths'
import type { DocumentState, SearchMatches } from '@/store/help'
import type { TreeFolderEntry } from '@/store/treeCtrl'
import type { PreferencesState } from '@/store/preferences'
import type { LayoutState } from '@/store/layout'

type CancelSearchCallback = (() => void) | null

interface SearchStoreState {
  layout: Pick<LayoutState, 'rightColumn' | 'showSideBar'>
  editor: {
    currentFile: Pick<DocumentState, 'searchMatches'>
  }
  project: {
    projectTree: TreeFolderEntry | null
  }
  preferences: Pick<
    PreferencesState,
    'searchExclusions' | 'searchMaxFileSize' | 'searchIncludeHidden' | 'searchNoIgnore' | 'searchFollowSymlinks'
  >
}

export default Vue.extend({
  components: {
    SearchResultItem
  },
  data () {
    return {
      ripgrepDirectorySearcher: new RipgrepDirectorySearcher(),
      EmptyIcon,
      FindCaseIcon,
      FindWordIcon,
      FindRegexIcon,
      keyword: '',
      searchResult: [] as SearchResult[],
      searcherRunning: false,
      showSearchCancelArea: false,
      showSearchCancelAreaTimer: null as number | null,
      searchErrorString: '',
      searcherCancelCallback: null as CancelSearchCallback,
      isCaseSensitive: false,
      isWholeWord: false,
      isRegexp: false
    }
  },
  watch: {
    showSideBar (value: boolean, oldValue: boolean) {
      if (value && !oldValue && this.rightColumn === 'search') {
        this.keyword = this.searchMatches.value
      }
    }
  },
  created () {
    this.$nextTick(() => {
      this.keyword = this.searchMatches.value
      bus.$on('findInFolder', this.handleFindInFolder)
      if (this.keyword.length > 0 && this.searcherRunning === false) {
        this.searcherRunning = true
        this.search()
      }
    })
  },
  beforeDestroy () {
    bus.$off('findInFolder', this.handleFindInFolder)
  },
  computed: {
    rightColumn (): string {
      return (this.$store.state as SearchStoreState).layout.rightColumn
    },
    showSideBar (): boolean {
      return (this.$store.state as SearchStoreState).layout.showSideBar
    },
    searchMatches (): SearchMatches {
      return (this.$store.state as SearchStoreState).editor.currentFile.searchMatches
    },
    projectTree (): TreeFolderEntry | null {
      return (this.$store.state as SearchStoreState).project.projectTree
    },
    searchExclusions (): string[] {
      return (this.$store.state as SearchStoreState).preferences.searchExclusions
    },
    searchMaxFileSize (): string {
      return (this.$store.state as SearchStoreState).preferences.searchMaxFileSize
    },
    searchIncludeHidden (): boolean {
      return (this.$store.state as SearchStoreState).preferences.searchIncludeHidden
    },
    searchNoIgnore (): boolean {
      return (this.$store.state as SearchStoreState).preferences.searchNoIgnore
    },
    searchFollowSymlinks (): boolean {
      return (this.$store.state as SearchStoreState).preferences.searchFollowSymlinks
    },
    searchResultInfo (): string {
      const fileCount = this.searchResult.length
      const matchCount = this.searchResult.reduce((acc, item) => acc + item.matches.length, 0)
      return `${matchCount} ${matchCount > 1 ? 'matches' : 'match'} in ${fileCount} ${fileCount > 1 ? 'files' : 'file'}`
    },
    showNoFolderOpenedMessage (): boolean {
      return !this.projectTree || !this.projectTree.pathname
    },
    showNoResultFoundMessage (): boolean {
      return this.searchResult.length === 0 && this.searcherRunning === false && this.keyword.length > 0
    }
  },
  methods: {
    search () {
      const projectTree = this.projectTree
      if (!projectTree) {
        return
      }

      const rootDirectoryPath = projectTree.pathname
      const {
        keyword,
        searcherRunning,
        searcherCancelCallback,
        isCaseSensitive,
        isWholeWord,
        isRegexp,
        ripgrepDirectorySearcher
      } = this

      if (searcherRunning && searcherCancelCallback) {
        searcherCancelCallback()
      }

      this.searchErrorString = ''
      this.searcherCancelCallback = null

      if (!keyword) {
        this.searchResult = []
        this.searcherRunning = false
        return
      }

      let canceled = false
      this.searcherRunning = true
      this.startShowSearchCancelAreaTimer()

      const newSearchResult: SearchResult[] = []
      const promises = ripgrepDirectorySearcher.search([rootDirectoryPath], keyword, {
        didMatch: searchResult => {
          if (!canceled) {
            newSearchResult.push(searchResult)
          }
        },
        didSearchPaths: numPathsFound => {
          if (!canceled && numPathsFound > 100) {
            canceled = true
            promises.cancel()
            this.searchErrorString = 'Search was limited to 100 files.'
          }
        },
        isCaseSensitive,
        isWholeWord,
        isRegexp,
        exclusions: this.searchExclusions,
        maxFileSize: this.searchMaxFileSize || undefined,
        includeHidden: this.searchIncludeHidden,
        noIgnore: this.searchNoIgnore,
        followSymlinks: this.searchFollowSymlinks,
        inclusions: MARKDOWN_INCLUSIONS
      })
        .then(() => {
          this.searchResult = newSearchResult
          this.searcherRunning = false
          this.searcherCancelCallback = null
          this.stopShowSearchCancelAreaTimer()
        })
        .catch((error: Error) => {
          canceled = true
          promises.cancel()
          this.searcherRunning = false
          this.searcherCancelCallback = null
          this.stopShowSearchCancelAreaTimer()
          this.searchErrorString = error.message
          log.error(error)
        })

      this.searcherCancelCallback = () => {
        this.stopShowSearchCancelAreaTimer()
        canceled = true
        promises.cancel()
      }
    },
    startShowSearchCancelAreaTimer () {
      this.stopShowSearchCancelAreaTimer()

      const SHOW_SEARCH_CANCEL_DELAY_MS = 5000
      this.showSearchCancelAreaTimer = window.setTimeout(() => {
        this.showSearchCancelArea = true
      }, SHOW_SEARCH_CANCEL_DELAY_MS)
    },
    stopShowSearchCancelAreaTimer () {
      this.showSearchCancelArea = false
      if (this.showSearchCancelAreaTimer === null) {
        return
      }
      window.clearTimeout(this.showSearchCancelAreaTimer)
      this.showSearchCancelAreaTimer = null
    },
    cancelSearcher () {
      if (this.searcherCancelCallback) {
        this.searcherCancelCallback()
        this.searcherCancelCallback = null
      }
    },
    caseSensitiveClicked () {
      this.isCaseSensitive = !this.isCaseSensitive
      this.search()
    },
    wholeWordClicked () {
      this.isWholeWord = !this.isWholeWord
      this.search()
    },
    regexpClicked () {
      this.isRegexp = !this.isRegexp
      this.search()
    },
    openFolder () {
      this.$store.dispatch('ASK_FOR_OPEN_PROJECT')
    },
    handleFindInFolder () {
      this.keyword = this.searchMatches.value
    }
  }
})
</script>

<style scoped>
  .side-bar-search {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .search-wrapper {
    display: flex;
    margin: 37px 15px 10px 15px;
    padding: 0 6px;
    border-radius: 14px;
    height: 28px;
    border: 1px solid var(--floatBorderColor);
    background: var(--inputBgColor);
    box-sizing: border-box;
    align-items: center;
    & > input {
      color: var(--sideBarColor);
      background: transparent;
      height: 100%;
      flex: 1;
      border: none;
      outline: none;
      padding: 0 8px;
      font-size: 13px;
      width: 50%;
    }
    & > .controls {
      display: flex;
      flex-shrink: 0;
      margin-top: 3px;
      & > span {
        cursor: pointer;
        width: 20px;
        height: 20px;
        margin-left: 2px;
        margin-right: 2px;
        &:hover {
          color: var(--sideBarIconColor);
        }
        & > svg {
          fill: var(--sideBarIconColor);
          &:hover {
            fill: var(--highlightThemeColor);
          }
        }
        &.active svg {
            fill: var(--highlightThemeColor);
        }
      }
    }

    & > svg {
      cursor: pointer;
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      margin-right: 10px;
      &:hover {
        color: var(--sideBarIconColor);
      }
    }
  }
  .cancel-area {
    text-align: center;
    margin-bottom: 16px;
  }
  .search-message-section {
    overflow-wrap: break-word;
  }
  .search-result-info,
  .search-message-section {
    padding-left: 15px;
    margin-bottom: 5px;
    font-size: 12px;
    color: var(--sideBarColor);
  }
  .empty,
  .search-result {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    &::-webkit-scrollbar:vertical {
      width: 8px;
    }
  }
  .empty {
    font-size: 14px;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    padding-bottom: 100px;
    & .no-data {
      display: flex;
      align-items: center;
      flex-direction: column;
    }
    & .no-data svg {
      fill: var(--themeColor);
      width: 120px;
    }
    & .no-data .button-primary {
      display: block;
      margin-top: 20px;
    }
  }
</style>
