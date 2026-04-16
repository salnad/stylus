import { ipcRenderer } from 'electron'
import bus from '../bus'

interface LayoutState {
  rightColumn: string
  showSideBar: boolean
  showTabBar: boolean
  sideBarWidth: number
}

interface LayoutPayload {
  rightColumn?: string
  showSideBar?: boolean
  showTabBar?: boolean
}

const width = localStorage.getItem('side-bar-width')
const parsedWidth = Number(width)
const sideBarWidth = Number.isFinite(parsedWidth) ? Math.max(parsedWidth, 220) : 280

const state: LayoutState = {
  rightColumn: 'files',
  showSideBar: false,
  showTabBar: false,
  sideBarWidth
}

const getters = {}

const mutations = {
  SET_LAYOUT (currentState: LayoutState, layout: LayoutPayload): void {
    if (typeof layout.showSideBar !== 'undefined') {
      const { windowId } = global.marktext.env
      ipcRenderer.send('mt::update-sidebar-menu', windowId, !!layout.showSideBar)
    }
    Object.assign(currentState, layout)
  },
  TOGGLE_LAYOUT_ENTRY (currentState: LayoutState, entryName: keyof LayoutState): void {
    if (typeof currentState[entryName] === 'boolean') {
      currentState[entryName] = !currentState[entryName] as never
    }
  },
  SET_SIDE_BAR_WIDTH (currentState: LayoutState, widthValue: number): void {
    localStorage.setItem('side-bar-width', String(Math.max(widthValue, 220)))
    currentState.sideBarWidth = widthValue
  }
}

const actions = {
  LISTEN_FOR_LAYOUT ({ state: currentState, commit, dispatch }: {
    state: LayoutState
    commit(type: string, payload?: unknown): void
    dispatch(type: string, payload?: unknown): void
  }): void {
    ipcRenderer.on('mt::set-view-layout', (_event, layout: LayoutPayload) => {
      if (layout.rightColumn) {
        commit('SET_LAYOUT', {
          ...layout,
          rightColumn: layout.rightColumn === currentState.rightColumn ? '' : layout.rightColumn,
          showSideBar: true
        })
      } else {
        commit('SET_LAYOUT', layout)
      }
      dispatch('DISPATCH_LAYOUT_MENU_ITEMS')
    })

    ipcRenderer.on('mt::toggle-view-layout-entry', (_event, entryName: keyof LayoutState) => {
      commit('TOGGLE_LAYOUT_ENTRY', entryName)
      dispatch('DISPATCH_LAYOUT_MENU_ITEMS')
    })

    bus.$on('view:toggle-layout-entry', (entryName: keyof LayoutState) => {
      commit('TOGGLE_LAYOUT_ENTRY', entryName)
      const { windowId } = global.marktext.env
      ipcRenderer.send('mt::view-layout-changed', windowId, { [entryName]: currentState[entryName] })
    })
  },

  DISPATCH_LAYOUT_MENU_ITEMS ({ state: currentState }: {
    state: LayoutState
  }): void {
    const { windowId } = global.marktext.env
    const { showTabBar, showSideBar } = currentState
    ipcRenderer.send('mt::view-layout-changed', windowId, { showTabBar, showSideBar })
  },

  CHANGE_SIDE_BAR_WIDTH ({ commit }: {
    commit(type: string, payload?: unknown): void
  }, widthValue: number): void {
    commit('SET_SIDE_BAR_WIDTH', widthValue)
  }
}

export default { state, getters, mutations, actions }
