<template>
  <div class="pref-image-uploader">
    <h5>Uploader</h5>
    <section class="current-uploader">
      <div v-if="isValidUploaderService(currentUploader)">The current image uploader is
        {{ getServiceNameById(currentUploader) }}.</div>
      <span v-else>Currently no uploader is selected. Please select an uploader and config
        it.</span>
    </section>
    <section class="configration">
      <cur-select :value="currentUploader" :options="uploaderOptions"
        :onChange="value => setCurrentUploader(value)"></cur-select>
      <div class="picgo" v-if="currentUploader === 'picgo'">
        <div v-if="!picgoExists" class="warning">
          Your system does not have <span class="link"
            @click="open('https://github.com/PicGo/PicGo-Core')">picgo</span> installed, please
          install it before use.
        </div>
      </div>
      <div class="github" v-if="currentUploader === 'github'">
        <div class="warning">Github will be removed in a future version, please use picgo</div>
        <div class="form-group">
          <div class="label">
            GitHub token:
            <el-tooltip class="item" effect="dark"
              content="The token is saved by Keychain on macOS, Secret Service API/libsecret on Linux and Credential Vault on Windows"
              placement="top-start">
              <i class="el-icon-info"></i>
            </el-tooltip>
          </div>
          <el-input v-model="githubToken" placeholder="Input token" size="mini"></el-input>
        </div>
        <div class="form-group">
          <div class="label">Owner name:</div>
          <el-input v-model="github.owner" placeholder="owner" size="mini"></el-input>
        </div>
        <div class="form-group">
          <div class="label">Repo name:</div>
          <el-input v-model="github.repo" placeholder="repo" size="mini"></el-input>
        </div>
        <div class="form-group">
          <div class="label">Branch name (optional):</div>
          <el-input v-model="github.branch" placeholder="branch" size="mini"></el-input>
        </div>
        <legal-notices-checkbox class="github"
          :class="[{ 'error': legalNoticesErrorStates.github }]"
          :uploaderService="uploadServices.github"></legal-notices-checkbox>
        <div class="form-group">
          <el-button size="mini" :disabled="githubDisable" @click="save('github')">Save
          </el-button>
        </div>
      </div>
      <div class="script" v-else-if="currentUploader === 'cliScript'">
        <div class="description">The script will be executed with the image file path as its only
          argument and it should output any valid value for the <code>src</code> attribute of a
          <em>HTMLImageElement</em>.
        </div>
        <div class="form-group">
          <div class="label">Shell script location:</div>
          <el-input v-model="cliScript" placeholder="Script absolute path" size="mini"></el-input>
        </div>
        <div class="form-group">
          <el-button size="mini" :disabled="cliScriptDisable" @click="save('cliScript')">Save
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { shell } from 'electron'
import services, { isValidService, type UploaderServiceMap } from './services'
import LegalNoticesCheckbox from './legalNoticesCheckbox.vue'
import { isFileExecutableSync } from '@/util/fileSystem'
import CurSelect from '@/prefComponents/common/select/index.vue'
import commandExists from 'command-exists'
import notice from '@/services/notification'
import type { SelectOption } from '@/prefComponents/general/config'
import type { PreferencesState } from '@/store/preferences'

type UploaderKind = 'none' | 'picgo' | 'github' | 'cliScript'
type SavableUploaderKind = 'github' | 'cliScript'

interface GitHubConfig {
  owner: string
  repo: string
  branch: string
}

interface UploaderStoreState {
  preferences: Pick<PreferencesState, 'currentUploader' | 'imageBed' | 'githubToken' | 'cliScript'>
}

export default Vue.extend({
  components: {
    LegalNoticesCheckbox,
    CurSelect
  },
  data () {
    const uploaderOptions: Array<SelectOption<string>> = Object.keys(services).map(name => {
      const { name: label } = services[name]
      return {
        label,
        value: name
      }
    })

    return {
      uploaderOptions,
      githubToken: '',
      github: {
        owner: '',
        repo: '',
        branch: ''
      } as GitHubConfig,
      cliScript: '',
      picgoExists: true,
      uploadServices: services as UploaderServiceMap,
      legalNoticesErrorStates: {
        github: false
      } as Partial<Record<SavableUploaderKind, boolean>>
    }
  },
  computed: {
    currentUploader (): PreferencesState['currentUploader'] {
      return (this.$store.state as UploaderStoreState).preferences.currentUploader
    },
    imageBed (): PreferencesState['imageBed'] {
      return (this.$store.state as UploaderStoreState).preferences.imageBed
    },
    prefGithubToken (): string {
      return (this.$store.state as UploaderStoreState).preferences.githubToken
    },
    prefCliScript (): string {
      return (this.$store.state as UploaderStoreState).preferences.cliScript
    },
    githubDisable (): boolean {
      return !this.githubToken || !this.github.owner || !this.github.repo
    },
    cliScriptDisable (): boolean {
      if (!this.cliScript) {
        return true
      }
      return !isFileExecutableSync(this.cliScript)
    }
  },
  watch: {
    imageBed (value: PreferencesState['imageBed'], oldValue: PreferencesState['imageBed']) {
      if (value !== oldValue) {
        this.github = {
          ...value.github
        }
      }
    }
  },
  created () {
    this.$nextTick(() => {
      this.github = {
        ...this.imageBed.github
      }
      this.githubToken = this.prefGithubToken
      this.cliScript = this.prefCliScript
      this.testPicgo()

      if (Object.prototype.hasOwnProperty.call(services, this.currentUploader)) {
        services[this.currentUploader as UploaderKind].agreedToLegalNotices = true
      }
    })
  },
  methods: {
    isValidUploaderService (name: string): boolean {
      return isValidService(name)
    },

    getServiceNameById (id: string): string {
      const service = services[id]
      return service ? service.name : id
    },

    open (link: string) {
      shell.openExternal(link)
    },

    save (type: SavableUploaderKind) {
      if (!this.validate(type)) {
        return
      }

      const nextValue = type === 'github' ? this.github : this.cliScript
      const newImageBedConfig = Object.assign({}, this.imageBed, { [type]: nextValue })

      this.$store.dispatch('SET_USER_DATA', {
        type: 'imageBed',
        value: newImageBedConfig
      })

      if (type === 'github') {
        this.$store.dispatch('SET_USER_DATA', {
          type: 'githubToken',
          value: this.githubToken
        })
      } else {
        this.$store.dispatch('SET_USER_DATA', {
          type: 'cliScript',
          value: this.cliScript
        })
      }

      notice.notify({
        title: 'Save Config',
        message: type === 'github'
          ? 'The Github configration has been saved.'
          : 'The command line script configuration has been saved',
        type: 'primary'
      })
    },

    setCurrentUploader (value: string) {
      const type = 'currentUploader'
      this.$store.dispatch('SET_USER_DATA', { type, value })
    },

    testPicgo () {
      this.picgoExists = commandExists.sync('picgo')
    },

    validate (value: SavableUploaderKind): boolean {
      const service = services[value]
      const { agreedToLegalNotices } = service
      if (!agreedToLegalNotices) {
        this.legalNoticesErrorStates[value] = true
        return false
      }
      if (typeof this.legalNoticesErrorStates[value] !== 'undefined') {
        this.legalNoticesErrorStates[value] = false
      }

      return true
    }
  }
})
</script>

<style>
.pref-image-uploader {
  color: var(--editorColor);
  font-size: 14px;

  & .current-uploader {
    margin: 20px 0;
  }
  & .warning {
    color: var(--deleteColor);
  }
  & .link {
    color: var(--themeColor);
    cursor: pointer;
  }
  & .description {
    margin-top: 20px;
    margin-bottom: 20px;
  }
  & .form-group {
    margin: 20px 0 0 0;
  }
  & .label {
    margin-bottom: 10px;
  }
  & .el-input__inner {
    background: transparent;
  }
  & .el-button.btn-reset,
  & .button-group {
    margin-top: 30px;
  }
  & .pref-cb-legal-notices {
    &.github {
      margin-top: 30px;
    }
    &.error {
      border: 1px solid var(--deleteColor);
    }
  }
}
</style>
