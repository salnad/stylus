import axios, { type AxiosAdapter } from 'axios'
import adapter from 'axios/lib/adapters/http'

const httpAdapter = adapter as AxiosAdapter

axios.defaults.adapter = httpAdapter

const http = axios.create({
  adapter: httpAdapter
})

export default http
