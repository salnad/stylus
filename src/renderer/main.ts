import Vue from 'vue'
import VueElectron from 'vue-electron'
import sourceMapSupport from 'source-map-support'
import VueRouter from 'vue-router'
import lang from 'element-ui/lib/locale/lang/en'
import locale from 'element-ui/lib/locale'
import axios from './axios'
import store from './store'
import './assets/symbolIcon'
import {
  Dialog,
  Form,
  FormItem,
  InputNumber,
  Button,
  Tooltip,
  Upload,
  Slider,
  Checkbox,
  ColorPicker,
  Col,
  Row,
  Tree,
  Autocomplete,
  Switch,
  Select,
  Option,
  Radio,
  RadioGroup,
  Table,
  TableColumn,
  Tabs,
  TabPane,
  Input
} from 'element-ui'
import services from './services'
import routes from './router'
import bootstrapRenderer from './bootstrap'
import { addElementStyle } from '@/util/theme'

import './assets/styles/index.css'
import './assets/styles/printService.css'

type VueWithHttp = typeof Vue & {
  http?: typeof axios
}

type VuePrototypeWithHttp = Vue & {
  $http?: typeof axios
  [key: string]: unknown
}

interface RendererService {
  name: string
  [key: string]: unknown
}

interface RendererMarkTextState {
  initialState: {
    codeFontFamily?: string | null
    codeFontSize?: string | null
    hideScrollbar?: boolean
    theme?: string | null
    titleBarStyle?: string | null
  } | null
  env: {
    debug: boolean
    paths: {
      electronUserDataPath: string
      logPath: string
      preferencesPath: string
      dataCenterPath: string
      preferencesFilePath: string
      userDataPath: string
      ripgrepBinaryPath: string
    }
    windowId: number
    type: string | null
  }
  paths: {
    electronUserDataPath: string
    logPath: string
    preferencesPath: string
    dataCenterPath: string
    preferencesFilePath: string
    userDataPath: string
    ripgrepBinaryPath: string
  }
}

sourceMapSupport.install({
  environment: 'node',
  handleUncaughtExceptions: false,
  hookRequire: false
})

global.marktext = {} as RendererMarkTextState
bootstrapRenderer()

addElementStyle()

locale.use(lang)

const elementComponents = [
  Dialog,
  Form,
  FormItem,
  InputNumber,
  Button,
  Tooltip,
  Upload,
  Slider,
  Checkbox,
  ColorPicker,
  Col,
  Row,
  Tree,
  Autocomplete,
  Switch,
  Select,
  Option,
  Radio,
  RadioGroup,
  Table,
  TableColumn,
  Tabs,
  TabPane,
  Input
]

elementComponents.forEach(component => {
  Vue.use(component)
})

Vue.use(VueRouter)
Vue.use(VueElectron as unknown as Parameters<typeof Vue.use>[0])

const vueWithHttp = Vue as VueWithHttp
const vuePrototypeWithHttp = Vue.prototype as VuePrototypeWithHttp
vueWithHttp.http = axios
vuePrototypeWithHttp.$http = axios
Vue.config.productionTip = false

const rendererServices = services as RendererService[]
rendererServices.forEach(service => {
  vuePrototypeWithHttp[`$${service.name}`] = service[service.name]
})

const router = new VueRouter({
  routes: routes(global.marktext.env.type)
})

new Vue({
  store,
  router,
  template: '<router-view class="view"></router-view>'
}).$mount('#app')
